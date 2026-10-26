/* ---------- 合成冒險：核心規則（純函式，伺服器與測試共用） ----------
   取代原本的「合成小屋」（更早之前是團隊魔王戰）。
   健康行為 → 能量 → 合成裝備 → 寵物穿上去自動打怪 → 升等、往下一關推進，進度一直存著。

   信任模型（朋友間的小 App，不求滴水不漏，但經濟要有上限）：
   - 能量：伺服器權威。來源只有健康行為（讀 daily_stats）與時間回復。
   - 棋盤與裝備：客戶端權威（每次點擊都打伺服器會很卡），但伺服器記一個「總價值」：
     t 階物品值 2^(t-1) 點能量，合成不會讓價值變多，所以每次存檔時
     新價值 ≤ 舊價值 + 2×花的能量（15% 機率直接掉 2 階）+ 打怪掉落，超過就是資料不對，拒收。
   - 戰鬥：伺服器依存好的裝備與等級算，結果固定（沒有亂數），所以重打同一關沒有意義，
     卡關只能靠更好的裝備或升等 —— 也就是回去照顧健康。
   - 骨頭幣：只有打贏新的一關才給，每天封頂。 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA = JSON.parse(readFileSync(join(here, "public", "adv_data.json"), "utf8"));

export const CELLS = DATA.cols * DATA.rows;
export const MAX_TIER = 10;
export const SLOTS = DATA.chains.length;          // 每條鏈對應一個裝備欄位
export const ENERGY_START = 30;
export const ENERGY_MAX = 150;
export const ENERGY_PER_BEHAVIOR = 10;
export const REGEN_EVERY_MS = 10 * 60 * 1000;     // 每 10 分鐘回 1 點
export const REGEN_CAP = 20;                       // 時間回復只回到 20，再多要靠健康行為
export const COIN_DAILY_CAP = 40;
export const TRAIN_COST = 5;
export const MAX_ROUNDS = 40;                      // 打 40 回合還沒分出勝負就算輸

/* 能量從哪些行為來。熱量達標要等那天過完才定案，所以一律隔天才發；其他四項當天就能發。 */
export const BEHAVIORS = ["logged", "kcal_hit", "protein_hit", "exercised", "water_hit"];
export const SAME_DAY = ["logged", "protein_hit", "exercised", "water_hit"];
export const BEHAVIOR_LABEL = { logged: "記錄飲食", kcal_hit: "熱量達標", protein_hit: "蛋白達標", exercised: "有運動", water_hit: "喝水達標" };

export function prevDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function newState(now) {
  return {
    v: 1, board: Array(CELLS).fill(null), energy: ENERGY_START, regenAt: now, granted: {},
    equip: Array(SLOTS).fill(0), level: 1, xp: 0, stage: 1, wins: 0,
    value: 0, credit: 0, coinDay: "", coinToday: 0,
  };
}

/* 從舊的合成小屋存檔轉過來：棋盤上的東西照「t 階 = 2^(t-1) 點能量」退成能量，
   已經領過的健康能量紀錄沿用（不然今天的行為會再發一次）。 */
export function migrateFromMerge(old, now) {
  const st = newState(now);
  if (!old || typeof old !== "object") return { st, refund: 0 };
  const items = Array.isArray(old.board) ? old.board : [];
  const refund = items.reduce((a, x) => a + (Array.isArray(x) && Number.isInteger(x[1]) && x[1] >= 1 && x[1] <= 7 ? 2 ** (x[1] - 1) : 0), 0);
  st.energy = Math.min(ENERGY_MAX, Math.max(0, Math.round(+old.energy || 0)) + refund);
  st.granted = old.granted && typeof old.granted === "object" ? old.granted : {};
  st.regenAt = old.regenAt || now;
  return { st, refund };
}

/* 時間回復：只在能量低於 REGEN_CAP 時累積；滿了就把計時器拉到現在，避免存一大包一次領 */
export function regen(st, now) {
  if (!st.regenAt) st.regenAt = now;
  if (st.energy >= REGEN_CAP) { st.regenAt = now; return 0; }
  const ticks = Math.floor((now - st.regenAt) / REGEN_EVERY_MS);
  if (ticks <= 0) return 0;
  const add = Math.min(ticks, REGEN_CAP - st.energy);
  st.energy += add;
  st.regenAt = st.energy >= REGEN_CAP ? now : st.regenAt + ticks * REGEN_EVERY_MS;
  return add;
}

/* 依 daily_stats 發健康能量。只看昨天與今天；每項行為每天只發一次，記在 granted[日期]。 */
export function grantHealth(st, rows, today) {
  const yesterday = prevDay(today);
  st.granted = st.granted || {};
  const gained = [];
  for (const row of rows || []) {
    const date = String(row.date).slice(0, 10);
    if (date !== today && date !== yesterday) continue;
    const keys = date === today ? SAME_DAY : BEHAVIORS;
    const got = st.granted[date] || (st.granted[date] = []);
    for (const k of keys) {
      if (row[k] && !got.includes(k)) {
        got.push(k);
        st.energy += ENERGY_PER_BEHAVIOR;
        gained.push({ date, key: k, label: BEHAVIOR_LABEL[k] });
      }
    }
  }
  for (const d of Object.keys(st.granted)) if (d < yesterday) delete st.granted[d];
  st.energy = Math.min(ENERGY_MAX, st.energy);
  return gained;
}

/* ---------- 棋盤、裝備與總價值 ---------- */
function validCell(x) {
  if (x === null) return true;
  return Array.isArray(x) && x.length === 2
    && Number.isInteger(x[0]) && x[0] >= 0 && x[0] < SLOTS
    && Number.isInteger(x[1]) && x[1] >= 1 && x[1] <= MAX_TIER;
}
export function validBoard(b) { return Array.isArray(b) && b.length === CELLS && b.every(validCell); }
export function validEquip(e) {
  return Array.isArray(e) && e.length === SLOTS && e.every((t) => Number.isInteger(t) && t >= 0 && t <= MAX_TIER);
}
export const tierValue = (t) => (t >= 1 ? 2 ** (t - 1) : 0);
export function totalValue(board, equip) {
  return board.reduce((a, x) => a + (x ? tierValue(x[1]) : 0), 0) + equip.reduce((a, t) => a + tierValue(t), 0);
}

/* 存檔同步。payload = { board, equip, spent }。有問題就丟錯，呼叫端回 400。 */
export function applySync(st, payload) {
  const p = payload || {};
  if (!validBoard(p.board)) throw new Error("棋盤資料不正確");
  if (!validEquip(p.equip)) throw new Error("裝備資料不正確");
  const spent = Math.round(+p.spent || 0);
  if (!(spent >= 0 && spent <= ENERGY_MAX)) throw new Error("能量數值不合理");
  const paid = Math.min(spent, st.energy);         // 能量不夠的部分不算數，也不能換成東西
  const value = totalValue(p.board, p.equip);
  if (value > (st.value || 0) + 2 * paid + (st.credit || 0)) throw new Error("資料對不起來，重新整理一下");
  st.energy -= paid;
  st.board = p.board;
  st.equip = p.equip;
  st.value = value;
  st.credit = 0;
  return { over: spent - paid };
}

/* ---------- 角色、怪物與戰鬥 ---------- */
export function heroStats(st) {
  const g = DATA.gear, e = st.equip || [0, 0, 0], mult = 1 + 0.04 * ((st.level || 1) - 1);
  return { atk: Math.round((8 + g.atk[e[0]]) * mult), hp: Math.round((60 + g.hp[e[1]]) * mult), crit: g.crit[e[2]] };
}

/* 第 s 關的怪。每 10 關一個區域、第 10 關是頭目；五個區域打完換「第 2 輪」，數值照公式繼續長。
   前 40 關強度每關 ×1.09：大約每 4 關翻倍一次 —— 剛好是裝備升一階（成本翻倍）帶來的戰力。
   40 關以後裝備差不多做滿了，只剩升等（線性變強），怪物改成線性成長，不然會永遠卡住。 */
export function monster(s) {
  const k = s - 1, boss = s % 10 === 0;
  const scale = k <= 40 ? 1.09 ** k : 1.09 ** 40 * (1 + 0.06 * (k - 40));
  const R = DATA.regions, region = R[Math.floor(k / 10) % R.length], round = Math.floor(k / (10 * R.length)) + 1;
  const [e, name] = boss ? region.boss : region.mobs[(k % 10) % region.mobs.length];
  return {
    stage: s, e, name, boss, region: region.name + (round > 1 ? `（第 ${round} 輪）` : ""), bg: region.bg,
    hp: Math.round(40 * scale * (boss ? 1.5 : 1)),
    atk: Math.round(6 * scale * (boss ? 1.2 : 1)),
  };
}

/* 回合制自動戰鬥，寵物先攻。暴擊不用亂數：每打一下累積暴擊率，滿 1 就爆一次（傷害 ×2），
   所以同樣的裝備打同一隻怪，結果永遠一樣。events: [誰打, 傷害, 是否暴擊, 被打的一方剩多少血] */
export function battle(hero, mon) {
  let hh = hero.hp, mh = mon.hp, acc = 0;
  const events = [];
  for (let r = 0; r < MAX_ROUNDS; r++) {
    acc += hero.crit;
    let d = hero.atk, crit = false;
    if (acc >= 1 - 1e-9) { acc -= 1; d *= 2; crit = true; }
    mh = Math.max(0, mh - d); events.push(["h", d, crit, mh]);
    if (mh <= 0) return { win: true, events };
    hh = Math.max(0, hh - mon.atk); events.push(["m", mon.atk, false, hh]);
    if (hh <= 0) return { win: false, events };
  }
  return { win: false, events };
}

export const needXp = (level) => 30 + 15 * level;
export const stageXp = (s) => 5 + 2 * s;
export const trainXp = (st) => 8 + (st.stage || 1);
export function addXp(st, xp) {
  st.xp = (st.xp || 0) + xp;
  let ups = 0;
  while (st.xp >= needXp(st.level)) { st.xp -= needXp(st.level); st.level++; ups++; }
  return ups;
}

function payCoins(st, today, want) {
  if (st.coinDay !== today) { st.coinDay = today; st.coinToday = 0; }
  const c = Math.min(want, Math.max(0, COIN_DAILY_CAP - st.coinToday));
  st.coinToday += c;
  return { coins: c, capped: c < want };
}

/* 挑戰下一關。打贏：前進一關、拿經驗、骨頭幣（每日封頂）、掉一件裝備（記成 credit，下次存檔時允許價值增加）。 */
export function fight(st, today, rand = Math.random) {
  const mon = monster(st.stage), hero = heroStats(st), b = battle(hero, mon);
  const res = { kind: "fight", stage: st.stage, mon, hero, win: b.win, events: b.events, xp: 0, levelUps: 0, coins: 0, capped: false, drop: null };
  if (!b.win) return res;
  res.xp = stageXp(st.stage);
  res.levelUps = addXp(st, res.xp);
  Object.assign(res, payCoins(st, today, mon.boss ? 15 : 3));
  const drop = [Math.floor(rand() * SLOTS), Math.min(4, 1 + Math.floor(st.stage / 10))];
  st.credit = (st.credit || 0) + tierValue(drop[1]);
  res.drop = drop;
  st.stage++; st.wins = (st.wins || 0) + 1;
  return res;
}

/* 訓練：花能量換經驗。裝備做到頂之後，這是繼續變強的唯一方法，所以進度不會停。 */
export function train(st) {
  if (st.energy < TRAIN_COST) throw new Error(`能量不夠，訓練要 ${TRAIN_COST} 點`);
  st.energy -= TRAIN_COST;
  const xp = trainXp(st);
  return { kind: "train", xp, levelUps: addXp(st, xp) };
}

export function publicState(st, today, now) {
  const yesterday = prevDay(today);
  return {
    board: st.board, equip: st.equip, energy: st.energy,
    level: st.level, xp: st.xp, need: needXp(st.level), stage: st.stage, wins: st.wins || 0,
    hero: heroStats(st), next: monster(st.stage),
    coinToday: st.coinDay === today ? st.coinToday : 0, coinCap: COIN_DAILY_CAP,
    granted: { today: (st.granted && st.granted[today]) || [], yesterday: (st.granted && st.granted[yesterday]) || [] },
    nextRegenMs: st.energy >= REGEN_CAP ? null : Math.max(0, REGEN_EVERY_MS - (now - (st.regenAt || now))),
    regenCap: REGEN_CAP, energyMax: ENERGY_MAX, energyPer: ENERGY_PER_BEHAVIOR,
    trainCost: TRAIN_COST, trainXp: trainXp(st),
  };
}
