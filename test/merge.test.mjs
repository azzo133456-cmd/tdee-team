// 合成小屋規則測試：node test/merge.test.mjs（或 npm test）
// 測的是 merge_logic.js 的純函式，不需要資料庫。
import * as M from "../merge_logic.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
};
const throws = (name, fn) => {
  let t = false; try { fn(); } catch { t = true; }
  eq(name, t, true);
};
// 可重現的亂數
const seeded = (s) => () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const T0 = Date.UTC(2026, 9, 26, 4, 0, 0);
const TODAY = "2026-10-26", YDAY = "2026-10-25";

/* ---------- 遊戲資料本身 ---------- */
eq("6 條鏈", M.DATA.chains.length, 6);
eq("每條鏈都是 7 階", M.DATA.chains.every((c) => c.items.length === M.MAX_TIER), true);
eq("鏈的 id 就是它的位置（存檔靠這個對應）", M.DATA.chains.map((c) => c.id), [0, 1, 2, 3, 4, 5]);
eq("三條食物鏈＋三條家具鏈", M.DATA.chains.map((c) => c.kind),
   ["food", "food", "food", "home", "home", "home"]);
const allTasks = M.DATA.rooms.flatMap((r) => r.tasks);
eq("房間任務的 id 不重複", new Set(allTasks.map((t) => t.id)).size, allTasks.length);
eq("每個任務要的物品都存在",
   allTasks.every((t) => !!M.DATA.chains[t.need[0]] && t.need[1] >= 1 && t.need[1] <= M.MAX_TIER), true);
eq("廚房會用到食物鏈（兩種主題混在一起）",
   M.DATA.rooms.find((r) => r.id === "kitchen").tasks.some((t) => M.DATA.chains[t.need[0]].kind === "food"), true);

/* ---------- 新存檔 ---------- */
const s0 = M.newState(T0, seeded(1));
eq("棋盤 7×8＝56 格、全空", [s0.board.length, s0.board.every((x) => x === null)], [56, true]);
eq("起始能量 30", s0.energy, 30);
eq("一開始就有 3 張訂單", s0.orders.length, 3);

/* ---------- 時間回復 ---------- */
{
  const s = M.newState(T0); s.energy = 10;
  eq("25 分鐘回 2 點", M.regen(s, T0 + 25 * 60000), 2);
  eq("能量變 12", s.energy, 12);
  eq("零頭的 5 分鐘保留到下一次", s.regenAt, T0 + 20 * 60000);
  M.regen(s, T0 + 10 * 3600000);
  eq("時間回復最多到 20", s.energy, M.REGEN_CAP);
  s.energy = 50;
  eq("已經超過 20（靠健康行為）時不再回", M.regen(s, T0 + 20 * 3600000), 0);
  eq("而且能量不會被往下拉", s.energy, 50);
  s.energy = 19; s.regenAt = T0 + 20 * 3600000;
  M.regen(s, T0 + 20 * 3600000 + 3 * 3600000);
  eq("回滿時計時器拉到現在（不會囤一大包）", s.regenAt, T0 + 23 * 3600000);
}

/* ---------- 健康行為 → 能量 ---------- */
{
  const s = M.newState(T0); s.energy = 0;
  const rows = [{ date: TODAY, logged: 1, kcal_hit: 1, protein_hit: 1, exercised: 1, water_hit: 1 }];
  const g = M.grantHealth(s, rows, TODAY);
  eq("今天四項各 +10", s.energy, 40);
  eq("今天的熱量達標不發（一天還沒結束）", g.map((x) => x.key).includes("kcal_hit"), false);
  eq("再叫一次不會重複發", M.grantHealth(s, rows, TODAY).length, 0);
  // 隔天：同一天變成「昨天」，熱量達標才發
  const g2 = M.grantHealth(s, [{ date: TODAY, logged: 1, kcal_hit: 1, protein_hit: 1, exercised: 1, water_hit: 1 }], "2026-10-27");
  eq("隔天補發熱量達標，其餘四項已領過不重發", g2.map((x) => x.key), ["kcal_hit"]);
  eq("能量 +10", s.energy, 50);
}
{
  const s = M.newState(T0); s.energy = 0;
  M.grantHealth(s, [
    { date: YDAY, logged: 1, kcal_hit: 1, protein_hit: 0, exercised: 0, water_hit: 0 },
    { date: "2026-10-20", logged: 1, kcal_hit: 1, protein_hit: 1, exercised: 1, water_hit: 1 },
  ], TODAY);
  eq("昨天的（含熱量達標）照發；更早的不發", s.energy, 20);
  s.granted["2026-10-01"] = ["logged"];
  M.grantHealth(s, [], TODAY);
  eq("舊的紀錄會被清掉", Object.keys(s.granted).includes("2026-10-01"), false);
}
{
  const s = M.newState(T0); s.energy = 145;
  M.grantHealth(s, [{ date: TODAY, logged: 1, protein_hit: 1 }], TODAY);
  eq("能量上限 150", s.energy, M.ENERGY_MAX);
}

/* ---------- 訂單 ---------- */
{
  const r = seeded(7);
  const s = M.newState(T0, r);
  let ok = true, distinct = true, foodOnly = true;
  for (let i = 0; i < 300; i++) {
    s.level = i % 20;
    const o = M.makeOrder(s, r);
    const maxT = Math.min(6, 2 + Math.floor(s.level / 3)), minT = Math.max(2, maxT - 2);
    if (!o.need.every(([, t]) => t >= minT && t <= maxT)) ok = false;
    if (o.need.length === 2 && o.need[0][0] === o.need[1][0]) distinct = false;
    if (!o.need.every(([c]) => M.DATA.chains[c].kind === "food")) foodOnly = false;
  }
  eq("訂單難度在範圍內（2 階起、最高 6 階）", ok, true);
  eq("兩項的訂單一定是不同鏈", distinct, true);
  eq("訂單只要食物", foodOnly, true);
  s.level = 0;
  eq("新手只會被要 2 階", [0, 1, 2].every(() => M.makeOrder(s, r).need.every(([, t]) => t === 2)), true);
}

/* ---------- 存檔同步 ---------- */
const emptyBoard = () => Array(M.CELLS).fill(null);
throws("棋盤長度不對 → 擋", () => M.applySync(M.newState(T0), { board: [] }, TODAY));
throws("物品階數超出 → 擋", () => {
  const b = emptyBoard(); b[0] = [0, 9]; M.applySync(M.newState(T0), { board: b }, TODAY);
});
throws("不存在的鏈 → 擋", () => {
  const b = emptyBoard(); b[0] = [99, 1]; M.applySync(M.newState(T0), { board: b }, TODAY);
});
{
  const s = M.newState(T0); s.energy = 20;
  const b = emptyBoard(); b[3] = [1, 2];
  const r = M.applySync(s, { board: b, spent: 5 }, TODAY);
  eq("花 5 點 → 剩 15", s.energy, 15);
  eq("棋盤存起來", s.board[3], [1, 2]);
  eq("沒超支", r.over, 0);
  M.applySync(s, { board: b, spent: 40 }, TODAY);
  eq("超支（例如兩台裝置同時玩）→ 夾到 0", s.energy, 0);
}
{
  const s = M.newState(T0, seeded(3));
  const o = s.orders[0];
  const r = M.applySync(s, { board: emptyBoard(), delivered: [o.id] }, TODAY, seeded(4));
  eq("交單拿星星", s.stars, o.stars);
  eq("交單拿骨頭幣", r.coins, o.coins);
  eq("完成數 +1", s.level, 1);
  eq("補上新訂單，仍然 3 張", s.orders.length, 3);
  eq("交過的單不在了", s.orders.some((x) => x.id === o.id), false);
  const r2 = M.applySync(s, { board: emptyBoard(), delivered: [o.id] }, TODAY);
  eq("同一張單不能交兩次", r2.coins, 0);
  eq("不存在的單號 → 略過", M.applySync(s, { board: emptyBoard(), delivered: [99999] }, TODAY).delivered, []);
}
{
  const s = M.newState(T0, seeded(5));
  let total = 0;
  for (let i = 0; i < 20; i++) total += M.applySync(s, { board: emptyBoard(), delivered: [s.orders[0].id] }, TODAY).coins;
  eq("一天的訂單骨頭幣封頂 40", total, M.COIN_DAILY_CAP);
  eq("封頂後星星照拿（房子不會卡住）", s.stars > 40, true);
  const r = M.applySync(s, { board: emptyBoard(), delivered: [s.orders[0].id] }, "2026-10-27");
  eq("隔天重新計算", r.coins > 0, true);
}

/* ---------- 佈置房子 ---------- */
{
  const s = M.newState(T0);
  eq("第一個任務是客廳的椅子", M.nextTask(s).task.id, "r0a");
  M.applySync(s, { board: emptyBoard(), built: ["r0a"] }, TODAY);
  eq("星星不夠 → 做不了", s.home.done, []);
  s.stars = 100;
  M.applySync(s, { board: emptyBoard(), built: ["r0b"] }, TODAY);
  eq("跳著做 → 擋（只能做下一個）", s.home.done, []);
  M.applySync(s, { board: emptyBoard(), built: ["r0a"] }, TODAY);
  eq("做完椅子", s.home.done, ["r0a"]);
  eq("扣 3 顆星", s.stars, 97);
  s.coinToday = 40; s.coinDay = TODAY;   // 今天訂單幣已封頂
  const r = M.applySync(s, { board: emptyBoard(), built: ["r0b", "r0c", "r0d", "r0e"] }, TODAY);
  eq("客廳完成", r.rooms.map((x) => x.id), ["living"]);
  eq("房間獎勵不受每日封頂", r.coins, 60);
  eq("下一個房間解鎖：臥室", M.nextTask(s).room.id, "bedroom");
  s.stars = 1000;
  for (const id of ["r1a", "r1b", "r1c", "r1d", "r1e"]) M.applySync(s, { board: emptyBoard(), built: [id] }, TODAY);
  eq("房間獎勵每間只發一次",
     M.applySync(s, { board: emptyBoard(), built: [] }, TODAY).rooms.length, 0);
  const all = M.DATA.rooms.flatMap((r) => r.tasks.map((t) => t.id));
  s.home.done = [...all];
  eq("全部做完 → 沒有下一個任務", M.nextTask(s), null);
}

/* ---------- 回給前端的資料 ---------- */
{
  const s = M.newState(T0); s.granted = { [TODAY]: ["logged"], [YDAY]: ["kcal_hit"] };
  const p = M.publicState(s, TODAY, T0);
  eq("不外露內部欄位", ["regenAt", "seq", "coinDay", "v"].some((k) => k in p), false);
  eq("今天領過的行為", p.granted.today, ["logged"]);
  eq("昨天領過的行為", p.granted.yesterday, ["kcal_hit"]);
  s.energy = 50;
  eq("能量高於回復上限時，不顯示倒數", M.publicState(s, TODAY, T0).nextRegenMs, null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
