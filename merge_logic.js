/* ---------- 合成小屋：核心規則（純函式，伺服器與測試共用） ----------
   取代原本的「團隊魔王戰」。魔王戰是「健康行為 → 打魔王的傷害」，一週結算一次；
   這裡改成「健康行為 → 合成的能量」，每天都有回饋。想玩就得先照顧自己。

   信任模型（這是個朋友間的小 App，不是要防到滴水不漏，而是讓經濟有上限）：
   - 能量：伺服器權威。來源只有兩個 —— 健康行為（讀 daily_stats）與時間回復。
     客戶端只能回報「花了幾點」，伺服器扣，扣不夠就夾到 0。
   - 棋盤：客戶端權威（每次拖曳都打伺服器會很卡），存檔時驗證格式。
   - 訂單、房子：伺服器產生、伺服器記帳。客戶端說「交了哪張訂單」，伺服器發獎勵。
     伺服器無法驗證物品真的合成出來，但能量有上限 → 能完成的訂單有上限 → 骨頭幣有上限，
     再加上每日封頂，經濟就跑不掉。 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA = JSON.parse(readFileSync(join(here, "public", "merge_data.json"), "utf8"));

export const CELLS = DATA.cols * DATA.rows;
export const MAX_TIER = 7;
export const ENERGY_START = 30;
export const ENERGY_MAX = 150;
export const ENERGY_PER_BEHAVIOR = 10;
export const REGEN_EVERY_MS = 10 * 60 * 1000;   // 每 10 分鐘回 1 點
export const REGEN_CAP = 20;                      // 時間回復只回到 20，再多要靠健康行為
export const COIN_DAILY_CAP = 40;                 // 其他小遊戲每天約 8–30，魔王戰約每天 17
export const ORDER_SLOTS = 3;

const FOOD = DATA.chains.filter((c) => c.kind === "food").map((c) => c.id);

/* 能量從哪些行為來。熱量達標比較特別：當天還沒過完時，早上只吃一點也會暫時「吃在目標內」，
   當天就發的話等於吃第一餐就先把能量領走了。所以熱量達標一律隔天（那天定案後）才發。
   其他四項在一天之內只會從 0 變 1、不會倒退，當天就能發。 */
export const BEHAVIORS = ["logged", "kcal_hit", "protein_hit", "exercised", "water_hit"];
export const SAME_DAY = ["logged", "protein_hit", "exercised", "water_hit"];
export const BEHAVIOR_LABEL = { logged: "記錄飲食", kcal_hit: "熱量達標", protein_hit: "蛋白達標", exercised: "有運動", water_hit: "喝水達標" };

export function prevDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function newState(now, rand = Math.random) {
  const st = {
    v: 1, board: Array(CELLS).fill(null), energy: ENERGY_START, regenAt: now,
    granted: {}, orders: [], seq: 0, level: 0, stars: 0,
    home: { done: [], bonusPaid: [] }, coinDay: "", coinToday: 0,
  };
  ensureOrders(st, rand);
  return st;
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

/* 依 daily_stats 發健康能量。只看昨天與今天：太久沒開就領不到，鼓勵每天回來。
   每項行為每天只發一次，記在 granted[日期] 裡。 */
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

/* 訂單只要食物鏈。難度隨完成數慢慢往上：一開始要 2–3 階，最高到 6 階。 */
export function makeOrder(st, rand = Math.random) {
  const maxT = Math.min(6, 2 + Math.floor((st.level || 0) / 3));
  const minT = Math.max(2, maxT - 2);
  const pickT = () => minT + Math.floor(rand() * (maxT - minT + 1));
  const n = rand() < 0.35 ? 2 : 1;
  const chains = [...FOOD].sort(() => rand() - 0.5).slice(0, n);   // 兩項時一定不同鏈
  const need = chains.map((c) => [c, pickT()]);
  const tsum = need.reduce((a, [, t]) => a + t, 0);
  st.seq = (st.seq || 0) + 1;
  return { id: st.seq, need, stars: tsum, coins: 2 + tsum };
}

export function ensureOrders(st, rand = Math.random) {
  st.orders = st.orders || [];
  while (st.orders.length < ORDER_SLOTS) st.orders.push(makeOrder(st, rand));
}

function validCell(x) {
  if (x === null) return true;
  return Array.isArray(x) && x.length === 2
    && Number.isInteger(x[0]) && x[0] >= 0 && x[0] < DATA.chains.length
    && Number.isInteger(x[1]) && x[1] >= 1 && x[1] <= MAX_TIER;
}
export function validBoard(b) {
  return Array.isArray(b) && b.length === CELLS && b.every(validCell);
}

/* 房子：四個房間依序解鎖，房間內的任務也依序做。回傳下一個能做的任務（沒有就 null）。 */
export function nextTask(st) {
  const done = new Set((st.home && st.home.done) || []);
  for (const room of DATA.rooms) {
    const t = room.tasks.find((x) => !done.has(x.id));
    if (t) return { room, task: t };
  }
  return null;
}

/* 存檔同步。payload = { board, spent, delivered:[訂單id], built:[任務id] }。
   回傳這次發了多少骨頭幣與星星；有問題就丟錯，呼叫端回 400。 */
export function applySync(st, payload, today, rand = Math.random) {
  const p = payload || {};
  if (!validBoard(p.board)) throw new Error("棋盤資料不正確");
  const spent = Math.round(+p.spent || 0);
  if (!(spent >= 0 && spent <= ENERGY_MAX)) throw new Error("能量數值不合理");

  if (st.coinDay !== today) { st.coinDay = today; st.coinToday = 0; }
  const over = Math.max(0, spent - st.energy);
  st.energy = Math.max(0, st.energy - spent);
  st.board = p.board;

  const res = { coins: 0, stars: 0, delivered: [], built: [], rooms: [], capped: false, over };

  for (const id of Array.isArray(p.delivered) ? p.delivered.slice(0, ORDER_SLOTS) : []) {
    const i = st.orders.findIndex((o) => o.id === +id);
    if (i < 0) continue;                                   // 已交過或過期的單，略過
    const o = st.orders[i];
    st.stars += o.stars; res.stars += o.stars;
    const room = Math.max(0, COIN_DAILY_CAP - st.coinToday);
    const c = Math.min(o.coins, room);
    if (c < o.coins) res.capped = true;
    st.coinToday += c; res.coins += c;
    st.level = (st.level || 0) + 1;
    st.orders.splice(i, 1);
    res.delivered.push(o.id);
  }
  ensureOrders(st, rand);

  st.home = st.home || { done: [], bonusPaid: [] };
  st.home.bonusPaid = st.home.bonusPaid || [];
  for (const id of Array.isArray(p.built) ? p.built.slice(0, 5) : []) {
    const nx = nextTask(st);
    if (!nx || nx.task.id !== id) continue;                // 只能做「下一個」任務
    if (st.stars < nx.task.stars) continue;
    st.stars -= nx.task.stars;
    st.home.done.push(id);
    res.built.push(id);
    const room = nx.room;
    const finished = room.tasks.every((t) => st.home.done.includes(t.id));
    if (finished && !st.home.bonusPaid.includes(room.id)) {
      // 房間完成獎勵不受每日封頂：一共只有四個房間，本身就有上限
      st.home.bonusPaid.push(room.id);
      res.coins += room.bonus;
      res.rooms.push({ id: room.id, name: room.name, bonus: room.bonus });
    }
  }
  return res;
}

/* 回給前端的版本：拿掉內部欄位，附上今天/昨天哪些健康能量已經領了，
   以及下一點回復還要多久。 */
export function publicState(st, today, now) {
  const yesterday = prevDay(today);
  const nextRegenMs = st.energy >= REGEN_CAP ? null : Math.max(0, REGEN_EVERY_MS - (now - (st.regenAt || now)));
  return {
    board: st.board, energy: st.energy, stars: st.stars, orders: st.orders,
    home: st.home, level: st.level,
    coinToday: st.coinDay === today ? st.coinToday : 0, coinCap: COIN_DAILY_CAP,
    granted: { today: (st.granted && st.granted[today]) || [], yesterday: (st.granted && st.granted[yesterday]) || [] },
    nextRegenMs, regenCap: REGEN_CAP, energyMax: ENERGY_MAX, energyPer: ENERGY_PER_BEHAVIOR,
  };
}
