/* ---------- 合成冒險：核心規則（純函式，伺服器與測試共用） ----------
   取代原本的「合成小屋」（更早之前是團隊魔王戰）。
   健康行為 → 能量 → 合成裝備 → 寵物穿上去自動打怪 → 升等、往下一關推進，進度一直存著。

   信任模型（朋友間的小 App，不求滴水不漏，但經濟要有上限）：
   - 能量：伺服器權威。來源只有健康行為（讀 daily_stats）與時間回復。
   - 棋盤與裝備：客戶端權威（每次點擊都打伺服器會很卡），但伺服器記一個「總價值」：
     t 階物品值 2^(t-1) 點能量，合成不會讓價值變多，所以每次存檔時
     新價值 ≤ 舊價值 + 2×花的能量（15% 機率直接掉 2 階）+ 打怪掉落，超過就是資料不對，拒收。
     賣掉、拿去釀藥的東西也一樣：送來的棋盤必須真的少了那些價值，才算數。
   - 戰鬥：伺服器依存好的裝備、等級、技能算，結果固定（沒有亂數），所以重打同一關沒有意義，
     卡關只能靠更好的裝備、升等、換技能 —— 也就是回去照顧健康。
   - 骨頭幣：只有打贏新的一關、圖鑑、寶箱才給；打怪的部分每天封頂。
   - 金幣：只在這個遊戲裡用（城鎮商店、鐵匠），伺服器記帳。 */
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
export const EXPLORE_COST = 3;
export const MAX_ROUNDS = 40;                      // 打 40 回合還沒分出勝負就算輸
export const POTION_MAX = 3, POTION_PRICE = 40;
export const ENH_MAX = 10;
export const enhCost = (lv) => 30 * (lv + 1) ** 2;   // 鐵匠強化：30、120、270…3000 金幣
export const sellPrice = (t) => 3 * tierValue(t);

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
    equip: Array(SLOTS).fill(0), level: 1, xp: 0, stage: 1, wins: 0, shiny: false, skills: [], dex: {},
    daily: null, streak: { last: "", n: 0 },
    gold: 0, potions: 0, enh: Array(SLOTS).fill(0), rush: 0, pachi: null,
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

/* 這次動作會「用掉」多少價值（賣掉、釀藥）。送來的棋盤必須已經少了這些，存檔檢查時一起算。 */
export function actionConsume(body) {
  const a = body && body.action;
  if (a === "sell") return validCell(body.item) && body.item ? tierValue(body.item[1]) : 0;
  if (a === "brew") return Array.isArray(body.items) ? body.items.reduce((s, x) => s + (validCell(x) && x ? tierValue(x[1]) : 0), 0) : 0;
  return 0;
}

/* 存檔同步。payload = { board, equip, spent, action?... }。有問題就丟錯，呼叫端回 400。
   today 有給的話，順便把花掉的能量記進每日任務。 */
export function applySync(st, payload, today) {
  const p = payload || {};
  if (!validBoard(p.board)) throw new Error("棋盤資料不正確");
  if (!validEquip(p.equip)) throw new Error("裝備資料不正確");
  const spent = Math.round(+p.spent || 0);
  if (!(spent >= 0 && spent <= ENERGY_MAX)) throw new Error("能量數值不合理");
  const paid = Math.min(spent, st.energy);         // 能量不夠的部分不算數，也不能換成東西
  const value = totalValue(p.board, p.equip);
  if (value + actionConsume(p) > (st.value || 0) + 2 * paid + (st.credit || 0)) throw new Error("資料對不起來，重新整理一下");
  st.energy -= paid;
  if (today) dailyRoll(st, today).spent += paid;
  st.board = p.board;
  st.equip = p.equip;
  st.value = value;
  st.credit = 0;
  return { over: spent - paid };
}

/* ---------- 角色、怪物與戰鬥 ---------- */
export const SKILL_IDS = DATA.skills.map((s) => s.id);
export const skillSlots = (level) => DATA.skillSlots.filter((l) => (level || 1) >= l).length;
// 鐵匠強化：每級 武器攻擊 +5%、防具血量 +5%、飾品暴擊 +1%（跟著欄位走，換裝備不會不見）
export function heroStats(st) {
  const g = DATA.gear, e = st.equip || [0, 0, 0], h = st.enh || [0, 0, 0], mult = 1 + 0.04 * ((st.level || 1) - 1);
  return {
    atk: Math.round((8 + g.atk[e[0]]) * mult * (1 + 0.05 * h[0])),
    hp: Math.round((60 + g.hp[e[1]]) * mult * (1 + 0.05 * h[1])),
    crit: Math.round((g.crit[e[2]] + 0.01 * h[2]) * 100) / 100,
    skills: (st.skills || []).slice(0, skillSlots(st.level)),
    potions: st.potions || 0,
  };
}

/* 第 s 關的怪。每 10 關一個區域、第 10 關是頭目（各有特性）；八個區域打完換「第 2 輪」，數值照公式繼續長。
   前 40 關強度每關 ×1.09：大約每 4 關翻倍一次 —— 剛好是裝備升一階（成本翻倍）帶來的戰力。
   40 關以後裝備差不多做滿了，只剩升等（線性變強），怪物改成線性成長，不然會永遠卡住。
   閃光怪：一般關卡偶爾出現，血 ×1.25、攻 ×1.15，打倒掉更好的東西。 */
export const regionOf = (s) => Math.floor((s - 1) / 10) % DATA.regions.length;
export function monster(s, shiny = false) {
  const k = s - 1, boss = s % 10 === 0;
  const scale = k <= 40 ? 1.09 ** k : 1.09 ** 40 * (1 + 0.06 * (k - 40));
  const R = DATA.regions, region = R[regionOf(s)], round = Math.floor(k / (10 * R.length)) + 1;
  const [e, name] = boss ? region.boss : region.mobs[(k % 10) % region.mobs.length];
  const trait = boss ? region.trait : null;
  let hp = 40 * scale * (boss ? 1.5 : 1), atk = 6 * scale * (boss ? 1.2 : 1);
  if (trait === "heavy") { hp *= 0.8; atk *= 1.4; }
  if (trait === "tank") { hp *= 1.6; atk *= 0.8; }
  if (shiny && !boss) { hp *= 1.25; atk *= 1.15; }
  return {
    stage: s, e, name, boss, shiny: !!shiny && !boss, trait, traitText: trait ? DATA.traits[trait] : "",
    region: region.name + (round > 1 ? `（第 ${round} 輪）` : ""), bg: region.bg,
    hp: Math.round(hp), atk: Math.round(atk),
  };
}

/* 回合制自動戰鬥，寵物先攻。完全沒有亂數：暴擊用累積制（每打一下累積暴擊率，滿 1 就爆），
   技能、怪物特性、藥水也都是固定規則觸發，所以同樣的條件打同一隻怪，結果永遠一樣。
   events: [種類, 數值, 旗標, 對應那一方剩多少血]
     h  寵物打怪（旗標＝暴擊）      hx 寵物的攻擊被閃開
     m  怪打寵物（旗標＝被護盾擋掉）  hh 寵物吸血回血      hp 寵物喝藥水
     mh 怪物回血（吸血或再生） */
export function battle(hero, mon) {
  const sk = new Set(hero.skills || []);
  let hh = hero.hp, mh = mon.hp, acc = 0, swings = 0, taken = 0, turns = 0, matk = mon.atk, pots = hero.potions || 0, used = 0;
  const events = [];
  const done = (win) => ({ win, events, potionsUsed: used });
  const strike = () => {
    swings++;
    if (mon.trait === "evade" && swings % 3 === 0) { events.push(["hx", 0, false, mh]); return; }
    acc += hero.crit;
    let d = hero.atk, crit = false;
    if (acc >= 1 - 1e-9) { acc -= 1; d *= sk.has("fury") ? 3 : 2; crit = true; }
    if (sk.has("slayer") && (mon.boss || mon.shiny)) d *= 1.35;
    if (mon.trait === "armor" && !crit) d *= 0.7;
    d = Math.max(1, Math.round(d));
    mh = Math.max(0, mh - d); events.push(["h", d, crit, mh]);
    if (sk.has("leech") && hh < hero.hp) {
      const heal = Math.min(hero.hp - hh, Math.round(d * 0.25));
      if (heal > 0) { hh += heal; events.push(["hh", heal, false, hh]); }
    }
  };
  const hitMe = () => {
    taken++;
    let d = matk;
    if (sk.has("tough")) d *= 0.8;
    const blocked = sk.has("guard") && taken % 4 === 0;
    d = blocked ? 0 : Math.round(d);
    hh = Math.max(0, hh - d); events.push(["m", d, blocked, hh]);
    if (mon.trait === "drain" && d > 0 && mh < mon.hp) {
      const heal = Math.min(mon.hp - mh, Math.round(d * 0.3));
      if (heal > 0) { mh += heal; events.push(["mh", heal, false, mh]); }
    }
    // 藥水：血掉到 35% 以下（還活著）就自動喝一瓶，回 40%
    if (hh > 0 && hh < hero.hp * 0.35 && pots > 0) {
      pots--; used++;
      const heal = Math.min(hero.hp - hh, Math.round(hero.hp * 0.4));
      hh += heal; events.push(["hp", heal, false, hh]);
    }
  };
  for (let r = 0; r < MAX_ROUNDS; r++) {
    strike();
    if (mh <= 0) return done(true);
    if (sk.has("combo") && swings % 3 === 0) { strike(); if (mh <= 0) return done(true); }
    turns++;
    hitMe();
    if (hh <= 0) return done(false);
    if (mon.trait === "double" && turns % 3 === 0) { hitMe(); if (hh <= 0) return done(false); }
    if (mon.trait === "regen" && mh < mon.hp) {
      const heal = Math.min(mon.hp - mh, Math.round(mon.hp * 0.06));
      if (heal > 0) { mh += heal; events.push(["mh", heal, false, mh]); }
    }
    if (mon.trait === "enrage") matk *= 1.08;
  }
  return done(false);
}

export const needXp = (level) => 30 + 15 * level;
export const stageXp = (s) => 5 + 2 * s;
export const trainXp = (st) => 8 + (st.stage || 1);
export const stageGold = (s) => 5 + s;
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
function giveItem(st, chain, tier) {
  st.credit = (st.credit || 0) + tierValue(tier);       // 下次存檔時允許價值增加這麼多
  return [chain, tier];
}

/* ---------- 每日任務與寶箱 ----------
   每天三個任務：一個健康、一個花能量、一個挑戰或訓練。用日期決定抽哪個，大家同一天的任務一樣。
   進度只看伺服器知道的數字（健康能量紀錄、存檔扣掉的能量、打怪與訓練次數），改前端也灌不了。 */
const QUESTS = {
  h2: { label: "完成 2 項健康行為", kind: "health", n: 2 },
  h3: { label: "完成 3 項健康行為", kind: "health", n: 3 },
  s15: { label: "花 15 點能量合成", kind: "spent", n: 15 },
  s25: { label: "花 25 點能量合成", kind: "spent", n: 25 },
  f3: { label: "挑戰或探索 3 次", kind: "fights", n: 3 },
  t1: { label: "訓練 1 次", kind: "trains", n: 1 },
};
function dayHash(today) { let h = 0; for (const c of today) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
export function questIds(today) {
  const h = dayHash(today);
  return [h % 2 ? "h3" : "h2", (h >> 1) % 2 ? "s25" : "s15", (h >> 2) % 2 ? "t1" : "f3"];
}
export function dailyRoll(st, today) {
  if (!st.daily || st.daily.date !== today) st.daily = { date: today, spent: 0, fights: 0, trains: 0, claimed: false };
  return st.daily;
}
export function quests(st, today) {
  const d = dailyRoll(st, today);
  const cur = { health: ((st.granted && st.granted[today]) || []).length, spent: d.spent, fights: d.fights, trains: d.trains };
  return questIds(today).map((id) => {
    const q = QUESTS[id], c = Math.min(q.n, cur[q.kind]);
    return { id, label: q.label, n: q.n, cur: c, done: c >= q.n };
  });
}
// 連續天數算的是「連續幾天開寶箱」：昨天有開就 +1，斷一天從 1 開始。越連續寶箱越好（最高 6 階）。
export const chestTier = (streak) => Math.min(6, 3 + Math.floor((streak - 1) / 2));
export function nextStreak(st, today) {
  const s = st.streak || { last: "", n: 0 };
  return s.last === today ? s.n : s.last === prevDay(today) ? s.n + 1 : 1;
}
export function openChest(st, today, rand = Math.random) {
  const d = dailyRoll(st, today);
  if (d.claimed) throw new Error("今天的寶箱已經開過了");
  if (!quests(st, today).every((q) => q.done)) throw new Error("三個任務都完成才能開寶箱");
  const n = nextStreak(st, today);
  st.streak = { last: today, n };
  d.claimed = true;
  // 開箱轉盤：5% 出 777 升兩階、20% 聽牌成功升一階，其他照原本的階數
  const x = rand(), up = x < 0.05 ? 2 : x < 0.25 ? 1 : 0;
  const r = up === 2 ? [7, 7, 7] : reels(up === 1, 1 + Math.floor(rand() * 6), rand);
  const drop = giveItem(st, Math.floor(rand() * SLOTS), Math.min(8, chestTier(n) + up));
  const coins = 5 + Math.min(n, 7);                     // 寶箱的骨頭幣不算在打怪的每日封頂裡
  const gold = 20 * n * (up === 2 ? 3 : 1);
  st.gold = (st.gold || 0) + gold;
  return { kind: "chest", streak: n, drop, coins, gold, reels: r, up, base: chestTier(n) };
}

/* ---------- 技能 ---------- */
export function setSkills(st, list) {
  if (!Array.isArray(list) || list.some((x) => !SKILL_IDS.includes(x)) || new Set(list).size !== list.length)
    throw new Error("技能資料不正確");
  if (list.length > skillSlots(st.level)) throw new Error(`目前只有 ${skillSlots(st.level)} 個技能欄`);
  st.skills = list.slice();
  return { kind: "skills", skills: st.skills };
}

/* ---------- 圖鑑 ----------
   dex[怪物名稱] = [打倒次數, 打倒閃光版次數]。每種第一次打倒 🦴5、第一次打倒閃光版 🦴10，
   各只有一次、總共有上限，所以不算在每日封頂裡。 */
export const DEX_LIST = (() => {
  const seen = new Set(), out = [];
  DATA.regions.forEach((r, ri) => {
    [...r.mobs, r.boss].forEach(([e, name], i) => {
      if (seen.has(name)) return; seen.add(name);
      out.push({ name, e, region: r.name, ri, boss: i === r.mobs.length });
    });
  });
  return out;
})();
export const SHINY_CHANCE = 0.12;
export const RUSH_CHANCE = 0.08, RUSH_STAGES = 3;
export const EXPLORE_SHINY_CHANCE = 0.2;
function recordDex(st, mon, res) {
  st.dex = st.dex || {};
  const rec = st.dex[mon.name] || (st.dex[mon.name] = [0, 0]);
  if (!rec[0]) { res.dexNew = true; res.coins += 5; }
  if (mon.shiny && !rec[1]) { res.dexShinyNew = true; res.coins += 10; }
  rec[0]++; if (mon.shiny) rec[1]++;
}

/* 挑戰下一關。打贏：前進一關、經驗、骨頭幣（每日封頂）、金幣、掉一件裝備；第一次打倒的怪記進圖鑑另外給幣。 */
export function fight(st, today, rand = Math.random) {
  const d = dailyRoll(st, today); d.fights++;
  const mon = monster(st.stage, st.shiny), hero = heroStats(st), b = battle(hero, mon);
  st.potions = Math.max(0, (st.potions || 0) - b.potionsUsed);
  const res = { kind: "fight", stage: st.stage, mon, hero, win: b.win, events: b.events, potionsUsed: b.potionsUsed,
    xp: 0, levelUps: 0, coins: 0, gold: 0, capped: false, drop: null, dexNew: false, dexShinyNew: false };
  if (!b.win) return res;
  res.xp = stageXp(st.stage) + (mon.shiny ? 10 : 0);
  res.levelUps = addXp(st, res.xp);
  Object.assign(res, payCoins(st, today, mon.boss ? 15 : mon.shiny ? 8 : 3));
  // 確變時間：打贏後偶爾突入，接下來 3 關掉落高一階、金幣 ×2
  const rush = (st.rush || 0) > 0;
  res.rush = rush;
  res.gold = stageGold(st.stage) * (mon.boss ? 3 : 1) * (rush ? 2 : 1); st.gold = (st.gold || 0) + res.gold;
  res.drop = giveItem(st, Math.floor(rand() * SLOTS), Math.min(4, 1 + Math.floor(st.stage / 10)) + (mon.shiny ? 1 : 0) + (rush ? 1 : 0));
  recordDex(st, mon, res);
  st.stage++; st.wins = (st.wins || 0) + 1;
  st.shiny = st.stage % 10 !== 0 && rand() < SHINY_CHANCE;   // 下一關會不會是閃光怪，現在就決定（重打不會變）
  if (rush) st.rush--;
  else if (!mon.boss && rand() < RUSH_CHANCE) { st.rush = RUSH_STAGES; res.rushStart = true; }
  res.rushLeft = st.rush;
  return res;
}

/* 探索：在地圖上回到已經打過的關卡再打一次（花能量）。閃光機率比較高，適合補圖鑑；
   經驗、金幣減半，不給打怪的骨頭幣（圖鑑獎勵照給），有機會掉裝備。 */
export function explore(st, stage, today, rand = Math.random) {
  stage = Math.round(+stage);
  if (!(stage >= 1 && stage < st.stage)) throw new Error("只能探索已經打過的關卡");
  if (st.energy < EXPLORE_COST) throw new Error(`能量不夠，探索要 ${EXPLORE_COST} 點`);
  st.energy -= EXPLORE_COST;
  dailyRoll(st, today).fights++;
  const shiny = stage % 10 !== 0 && rand() < EXPLORE_SHINY_CHANCE;
  const mon = monster(stage, shiny), hero = heroStats(st), b = battle(hero, mon);
  st.potions = Math.max(0, (st.potions || 0) - b.potionsUsed);
  const res = { kind: "explore", stage, mon, hero, win: b.win, events: b.events, potionsUsed: b.potionsUsed,
    xp: 0, levelUps: 0, coins: 0, gold: 0, capped: false, drop: null, dexNew: false, dexShinyNew: false };
  if (!b.win) return res;
  res.xp = Math.ceil(stageXp(stage) / 2) + (shiny ? 10 : 0);
  res.levelUps = addXp(st, res.xp);
  res.gold = Math.ceil(stageGold(stage) / 2); st.gold = (st.gold || 0) + res.gold;
  if (shiny || rand() < 0.3) res.drop = giveItem(st, Math.floor(rand() * SLOTS), Math.min(4, 1 + Math.floor(stage / 10)) + (shiny ? 1 : 0));
  recordDex(st, mon, res);
  return res;
}

/* 訓練：花能量換經驗。裝備做到頂之後，這是繼續變強的主要方法，所以進度不會停。 */
export function train(st, today) {
  if (st.energy < TRAIN_COST) throw new Error(`能量不夠，訓練要 ${TRAIN_COST} 點`);
  st.energy -= TRAIN_COST;
  if (today) dailyRoll(st, today).trains++;
  const xp = trainXp(st);
  return { kind: "train", xp, levelUps: addXp(st, xp) };
}

/* ---------- 城鎮 ----------
   賣東西、釀藥：前端先把東西從背包拿掉再送來，存檔檢查（actionConsume）確認價值真的少了。 */
export function sell(st, item) {
  const gold = sellPrice(item[1]);
  st.gold = (st.gold || 0) + gold;
  return { kind: "sell", item, gold };
}
export function brew(st, items) {
  if (!Array.isArray(items) || items.length !== 3 || !items.every((x) => validCell(x) && x && x[1] <= 2))
    throw new Error("釀藥要 3 件 1～2 階的東西");
  if ((st.potions || 0) >= POTION_MAX) throw new Error(`藥水最多帶 ${POTION_MAX} 瓶`);
  st.potions = (st.potions || 0) + 1;
  return { kind: "brew", potions: st.potions };
}
export function buyPotion(st) {
  if ((st.potions || 0) >= POTION_MAX) throw new Error(`藥水最多帶 ${POTION_MAX} 瓶`);
  if ((st.gold || 0) < POTION_PRICE) throw new Error(`金幣不夠（要 ${POTION_PRICE}）`);
  st.gold -= POTION_PRICE; st.potions = (st.potions || 0) + 1;
  return { kind: "buy", potions: st.potions };
}
export function enhance(st, slot) {
  slot = Math.round(+slot);
  if (!(slot >= 0 && slot < SLOTS)) throw new Error("沒有這個欄位");
  st.enh = st.enh || Array(SLOTS).fill(0);
  const lv = st.enh[slot];
  if (lv >= ENH_MAX) throw new Error("已經強化到頂了");
  const cost = enhCost(lv);
  if ((st.gold || 0) < cost) throw new Error(`金幣不夠（要 ${cost}）`);
  st.gold -= cost; st.enh[slot] = lv + 1;
  return { kind: "enhance", slot, level: lv + 1, cost };
}

/* ---------- 柏青哥 ----------
   三個地方用到同一套「轉盤」：遊樂場機台（A）、開寶箱（B）、彈珠產生器（C）。
   結果全部由伺服器決定，前端只負責把動畫「演」到那個結果；前端改不了中獎。 */
export const PACHI = {
  ballPrice: 2, perPlay: 10, holdMax: 4,       // 不限每天顆數（只受金幣限制；長期回收率約 83%，金幣會慢慢輸掉）
  pStart: 0.18,            // 掉進中央入賞口（啟動轉盤、存一個保留）
  pReturn: 0.15, returnGold: 3,   // 掉進兩側小口：退 3 金幣
  pWin: 1 / 17, pWinKaku: 1 / 3, kakuSpins: 5,
  prize: 40, prize7: 100,
};
// 三格轉盤的數字。中獎三格一樣；沒中有時故意做出「前兩格一樣」的聽牌，增加緊張感
export function reels(win, sym, rand) {
  const r = () => 1 + Math.floor(rand() * 7);
  if (win) return [sym, sym, sym];
  const a = r();
  if (rand() < 0.3) { let c = r(); if (c === a) c = (a % 7) + 1; return [a, a, c]; }   // 聽牌落空
  let b = r(); if (b === a) b = (a % 7) + 1;
  return [a, b, r()];
}
function pachiDay(st, today) {
  if (!st.pachi || st.pachi.day !== today) st.pachi = { day: today, balls: 0, kaku: (st.pachi && st.pachi.kaku) || 0 };
  return st.pachi;
}
/* A：遊樂場打一輪（10 顆）。回傳時間軸：
     ["ball", 落點]   落點 0＝外、1＝左退幣口、2＝中央入賞口、3＝右退幣口、4＝入賞但保留滿了
     ["spin", [三格], 是否聽牌, 是否中, 獎金, 中獎後是否確變, 確變剩幾轉]
   每 3 顆珠子的時間轉一次保留；打完再把剩下的保留轉完。 */
export function pachiPlay(st, today, rand = Math.random) {
  const P = PACHI, d = pachiDay(st, today), cost = P.ballPrice * P.perPlay;
  if ((st.gold || 0) < cost) throw new Error(`金幣不夠（要 ${cost}）`);
  st.gold -= cost; d.balls += P.perPlay;
  const events = [], res = { kind: "pachi", events, gold: 0, items: [], wins: 0, cost };
  let hold = 0;
  const spin = () => {
    hold--;
    const kaku = d.kaku > 0, win = rand() < (kaku ? P.pWinKaku : P.pWin);
    if (kaku) d.kaku--;
    const sym = 1 + Math.floor(rand() * 7), r = reels(win, sym, rand);
    let prize = 0, enter = false;
    if (win) {
      res.wins++;
      prize = sym === 7 ? P.prize7 : P.prize;
      if (sym === 7) res.items.push(giveItem(st, Math.floor(rand() * SLOTS), 4));
      enter = sym % 2 === 1;                   // 奇數大當 → 確變（接下來 5 轉中獎率 1/3）
      if (enter) d.kaku = P.kakuSpins;
      res.gold += prize;
    }
    events.push(["spin", r, !win && r[0] === r[1], win, prize, enter, d.kaku]);
  };
  for (let i = 0; i < P.perPlay; i++) {
    const x = rand();
    let pocket = 0;
    if (x < P.pStart) { pocket = hold < P.holdMax ? 2 : 4; if (hold < P.holdMax) hold++; }
    else if (x < P.pStart + P.pReturn) { pocket = rand() < 0.5 ? 1 : 3; res.gold += P.returnGold; }
    events.push(["ball", pocket]);
    if (i % 3 === 2 && hold > 0) spin();
  }
  while (hold > 0) spin();
  st.gold += res.gold;
  res.kaku = d.kaku; res.ballsToday = d.balls;
  return res;
}

/* C：彈珠產生器。花 1 點能量，珠子穿過 6 排釘子掉進 7 個洞，洞決定階數（兩邊最難掉進去、階數最高），
   種類是玩家瞄準的那一種。path 是每一排往左（0）或往右（1）。 */
export const DROP_TIERS = [3, 2, 1, 1, 1, 2, 3];
export function dropBall(st, chain, today, rand = Math.random) {
  chain = Math.round(+chain);
  if (!(chain >= 0 && chain < SLOTS)) throw new Error("沒有這個種類");
  if (st.energy < 1) throw new Error("能量用完了");
  st.energy -= 1;
  if (today) dailyRoll(st, today).spent += 1;
  const path = []; for (let i = 0; i < 6; i++) path.push(rand() < 0.5 ? 0 : 1);
  const pocket = path.reduce((a, b) => a + b, 0);
  const item = giveItem(st, chain, DROP_TIERS[pocket]);
  return { kind: "drop", path, pocket, item };
}

/* 存檔之後要做的動作。失敗（能量不夠、寶箱還不能開…）只回在 result.error，不影響存檔。
   注意：sell／brew 的東西在存檔檢查時已經確認拿掉了，這裡失敗的話東西不會回來 —— 前端要先擋。 */
export function runAction(st, body, today, rand = Math.random) {
  const action = body && body.action;
  try {
    if (action === "fight") return fight(st, today, rand);
    if (action === "explore") return explore(st, body.stage, today, rand);
    if (action === "train") return train(st, today);
    if (action === "chest") return openChest(st, today, rand);
    if (action === "skills") return setSkills(st, body.skills);
    if (action === "sell") { if (!validCell(body.item) || !body.item) throw new Error("沒有要賣的東西"); return sell(st, body.item); }
    if (action === "brew") return brew(st, body.items);
    if (action === "buy") return buyPotion(st);
    if (action === "enhance") return enhance(st, body.slot);
    if (action === "pachi") return pachiPlay(st, today, rand);
    if (action === "drop") return dropBall(st, body.chain, today, rand);
  } catch (e) { return { kind: action, error: e.message }; }
  return null;
}

/* ---------- 排行榜：比關卡（已打過的最高關），同關比等級 ---------- */
export function leaderboard(rows, meId) {
  return rows
    .filter((r) => r.games && r.games.adv && r.games.adv.v === 1)
    .map((r) => { const a = r.games.adv; return { name: r.username, cleared: (a.stage || 1) - 1, level: a.level || 1, dex: Object.keys(a.dex || {}).length, me: r.user_id === meId }; })
    .sort((a, b) => b.cleared - a.cleared || b.level - a.level || a.name.localeCompare(b.name));
}

export function publicState(st, today, now) {
  const yesterday = prevDay(today), d = dailyRoll(st, today), streak = nextStreak(st, today);
  return {
    board: st.board, equip: st.equip, energy: st.energy,
    level: st.level, xp: st.xp, need: needXp(st.level), stage: st.stage, wins: st.wins || 0,
    hero: heroStats(st), next: monster(st.stage, st.shiny),
    skills: st.skills || [], skillSlots: skillSlots(st.level),
    daily: { quests: quests(st, today), claimed: d.claimed, streak, chestTier: chestTier(streak) },
    dex: st.dex || {},
    gold: st.gold || 0, potions: st.potions || 0, enh: st.enh || Array(SLOTS).fill(0),
    coinToday: st.coinDay === today ? st.coinToday : 0, coinCap: COIN_DAILY_CAP,
    granted: { today: (st.granted && st.granted[today]) || [], yesterday: (st.granted && st.granted[yesterday]) || [] },
    nextRegenMs: st.energy >= REGEN_CAP ? null : Math.max(0, REGEN_EVERY_MS - (now - (st.regenAt || now))),
    regenCap: REGEN_CAP, energyMax: ENERGY_MAX, energyPer: ENERGY_PER_BEHAVIOR,
    trainCost: TRAIN_COST, trainXp: trainXp(st), exploreCost: EXPLORE_COST,
    potionMax: POTION_MAX, potionPrice: POTION_PRICE, enhMax: ENH_MAX,
    rush: st.rush || 0,
    pachi: { ballsToday: st.pachi && st.pachi.day === today ? st.pachi.balls : 0, kaku: (st.pachi && st.pachi.kaku) || 0,
      price: PACHI.ballPrice, perPlay: PACHI.perPlay },
    dropTiers: DROP_TIERS,
  };
}
