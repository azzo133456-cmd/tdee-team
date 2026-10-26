// 合成小屋前後端整合測試：node test/merge.client.test.mjs
// 把 public/app_pets.js 裡的合成小屋那一段放進 vm 執行，api() 接到一個用真正 merge_logic
// 實作的假伺服器（跟 server.js 的兩條路由同樣的流程，只是沒有資料庫與 HTTP）。
// 重點在前端的同步：請求在路上時又有新動作、能量對帳、交單與佈置。
import fs from "fs";
import vm from "vm";
import * as M from "../merge_logic.js";

const src = fs.readFileSync(new URL("../public/app_pets.js", import.meta.url), "utf8");
const a = src.indexOf("/* ---------- 小遊戲：合成小屋");
const b = src.indexOf("/* ---------- 小遊戲：每日免費轉盤");
if (a < 0 || b < 0) throw new Error("找不到合成小屋那一段");
const code = src.slice(a, b);
const data = JSON.parse(fs.readFileSync(new URL("../public/merge_data.json", import.meta.url), "utf8"));

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
};

function makeWorld({ rows = [], startEnergy = 30 } = {}) {
  const TODAY = "2026-10-26";
  let now = Date.UTC(2026, 9, 26, 4);
  const server = { st: null, calls: 0, hold: null };
  // 前端用 1.2 秒的延遲計時器把連續動作合併成一次同步；這裡把計時器存起來，讓測試自己決定何時觸發
  let timer = null;
  const html = { mergeBox: "", mergeCard: "" };
  const el = (id) => ({ style: {}, set innerHTML(v) { html[id] = v; }, get innerHTML() { return html[id]; } });
  // 跟 server.js 的路由同樣的流程
  const route = (path, body) => {
    if (!server.st) { server.st = M.newState(now); server.st.energy = startEnergy; }
    const st = server.st;
    M.regen(st, now);
    if (path === "/api/game/merge") {
      const gained = M.grantHealth(st, rows, TODAY); M.ensureOrders(st);
      return { state: M.publicState(st, TODAY, now), gained };
    }
    const result = M.applySync(st, body, TODAY);
    return { state: M.publicState(st, TODAY, now), result, pet: result.coins ? { coins: 1 } : null };
  };
  const sb = {
    console, JSON, Math,
    setTimeout: (fn) => { timer = fn; return 1; }, clearTimeout: () => { timer = null; },
    alert() {}, confirm: () => true, petData: null, renderPet() {},
    document: { getElementById: (id) => (id in html ? el(id) : null), addEventListener() {}, visibilityState: "visible" },
    fetch: async () => ({ json: async () => data }),
    api: async (path, opts) => {
      server.calls++;
      const body = opts && opts.body ? JSON.parse(opts.body) : null;
      if (server.hold) await server.hold;          // 讓測試能卡住一個請求，模擬「還在路上」
      return JSON.parse(JSON.stringify(route(path, body)));
    },
  };
  vm.createContext(sb);
  vm.runInContext(code + "\nglobalThis.__get=()=>({MS,mSel,mMsg,mPend});", sb);
  const flush = async () => { const f = timer; timer = null; if (f) await f(); };
  return { sb, server, html, flush, get: () => sb.__get(), advance: (ms) => { now += ms; } };
}

/* ---------- 載入與健康能量 ---------- */
{
  const w = makeWorld({ startEnergy: 0, rows: [{ date: "2026-10-26", logged: 1, protein_hit: 1, exercised: 0, water_hit: 1, kcal_hit: 1 }] });
  await w.sb.loadMergeGame();
  eq("今天三項健康行為 → 能量 30", w.get().MS.energy, 30);
  eq("提示有列出是哪幾項", w.get().mMsg.includes("記錄飲食") && w.get().mMsg.includes("蛋白達標"), true);
  eq("畫面有畫出來", w.html.mergeBox.includes("⚡ 30"), true);
  eq("今天的熱量達標不會被列進提示（隔天才發）", w.get().mMsg.includes("熱量達標"), false);
}

/* ---------- 產生、合成、移動 ---------- */
{
  const w = makeWorld();
  await w.sb.loadMergeGame();
  const S = () => w.get().MS;
  w.sb.Math.random = () => 0.5;                     // 不觸發 15% 的直接掉 2 階
  w.sb.mSpawn(0); w.sb.mSpawn(0);
  eq("點兩次菜園 → 兩顆種子", [S().board[0], S().board[1]], [[0, 1], [0, 1]]);
  eq("能量 30 → 28", S().energy, 28);
  w.sb.mTap(0); w.sb.mTap(1);
  eq("選一個再點另一個一樣的 → 合成成 2 階", S().board[1], [0, 2]);
  eq("原本那格清空", S().board[0], null);
  w.sb.mTap(1); w.sb.mTap(10);
  eq("點空格 → 移動過去", [S().board[1], S().board[10]], [null, [0, 2]]);
  w.sb.mSpawn(1); w.sb.mTap(0); w.sb.mTap(10);
  eq("不同的東西點下去 → 只是改選，不會合成", [S().board[0], S().board[10]], [[1, 1], [0, 2]]);
  eq("而且選取換到新的那格", w.get().mSel, 10);
  // 最高階不能再合
  S().board[24] = [3, 7]; S().board[25] = [3, 7];
  w.sb.mTap(24); w.sb.mTap(25);
  eq("最高階不能再合成", [S().board[24], S().board[25]], [[3, 7], [3, 7]]);
}

/* ---------- 能量用完、棋盤滿了 ---------- */
{
  const w = makeWorld({ startEnergy: 1 });
  await w.sb.loadMergeGame();
  w.sb.mSpawn(0); w.sb.mSpawn(0);
  eq("能量 1 只能點一次", w.get().MS.board.filter(Boolean).length, 1);
  eq("沒能量時有提示", w.get().mMsg.includes("能量用完"), true);
  const w2 = makeWorld({ startEnergy: 100 });
  await w2.sb.loadMergeGame();
  w2.get().MS.board.fill([2, 1]);
  const before = w2.get().MS.energy;
  w2.sb.mSpawn(0);
  eq("棋盤滿了不扣能量", w2.get().MS.energy, before);
  eq("而且有提示", w2.get().mMsg.includes("棋盤滿了"), true);
}

/* ---------- 同步：能量對帳 ---------- */
{
  const w = makeWorld({ startEnergy: 30 });
  await w.sb.loadMergeGame();
  w.sb.Math.random = () => 0.5;
  for (let i = 0; i < 5; i++) w.sb.mSpawn(0);
  await w.sb.mSync();
  eq("伺服器扣了 5 點", w.server.st.energy, 25);
  eq("前端也是 25", w.get().MS.energy, 25);
  eq("棋盤存到伺服器", w.server.st.board.filter(Boolean).length, 5);
  // 請求還在路上時又點了 3 次
  let release; w.server.hold = new Promise((r) => (release = r));
  w.sb.mSpawn(0);
  const p = w.sb.mSync();
  w.sb.mSpawn(0); w.sb.mSpawn(0); w.sb.mSpawn(0);
  release(); w.server.hold = null; await p;
  await w.flush();                                   // 1.2 秒後計時器觸發，把路上又花的那 3 點送出去
  eq("路上又花的 3 點會被追送，伺服器最後是 21", w.server.st.energy, 21);
  eq("前端也對得上 21", w.get().MS.energy, 21);
  eq("伺服器的棋盤也包含後來那 3 個", w.server.st.board.filter(Boolean).length, 9);
}

/* ---------- 同步：計時器觸發時請求還在路上 ---------- */
{
  const w = makeWorld({ startEnergy: 30 });
  await w.sb.loadMergeGame();
  w.sb.Math.random = () => 0.5;
  w.sb.mSpawn(0);
  let release; w.server.hold = new Promise((r) => (release = r));
  const p = w.sb.mSync();                            // 第一個請求卡在路上
  w.sb.mSpawn(0); w.sb.mSpawn(0);
  const f = w.flush();                               // 計時器到了，但上一個還沒回來 → 只能先記著
  eq("請求還在路上時不會重複發送", w.server.calls, 2);   // 載入 1 次 + 第一次同步 1 次
  release(); w.server.hold = null;
  await p; await f;
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  eq("等上一個回來再自動補送，伺服器扣了 3 點", w.server.st.energy, 27);
  eq("前端也是 27", w.get().MS.energy, 27);
  eq("待送清單清空", w.get().mPend.spent, 0);
}

/* ---------- 交訂單 ---------- */
{
  const w = makeWorld({ startEnergy: 50 });
  await w.sb.loadMergeGame();
  const S = () => w.get().MS;
  const o = S().orders[0];
  o.need.forEach(([c, t], i) => { S().board[20 + i] = [c, t]; });
  const before = w.server.st.stars;
  await w.sb.mDeliver(o.id);
  await new Promise((r) => setImmediate(r));
  eq("交單後伺服器星星增加", w.server.st.stars - before, o.stars);
  eq("訂單要的東西從棋盤拿走", o.need.every((_, i) => S().board[20 + i] === null), true);
  eq("訂單補回 3 張", S().orders.length, 3);
  eq("交過的單不在了", S().orders.some((x) => x.id === o.id), false);
  eq("有交單成功的提示", w.get().mMsg.includes("交單成功"), true);
  const o2 = S().orders[0];
  w.sb.mDeliver(o2.id);
  eq("東西不夠時交不出去", S().orders.some((x) => x.id === o2.id), true);
}

/* ---------- 佈置房子 ---------- */
{
  const w = makeWorld({ startEnergy: 50 });
  await w.sb.loadMergeGame();
  const S = () => w.get().MS;
  w.server.st.stars = 100; S().stars = 100;
  S().board[5] = [3, 3];                             // 椅子（家具第 3 階）
  await w.sb.mBuild("r0a");
  await new Promise((r) => setImmediate(r));
  eq("伺服器記下第一個任務", w.server.st.home.done, ["r0a"]);
  eq("扣 3 顆星", w.server.st.stars, 97);
  eq("椅子用掉了", S().board[5], null);
  eq("畫面上出現佈置好的椅子", w.html.mergeBox.includes("🪑"), true);
  w.sb.mBuild("r0c");
  eq("跳著做 → 前端就擋下", w.server.st.home.done, ["r0a"]);
}

/* ---------- 同步失敗不會弄丟 ---------- */
{
  const w = makeWorld({ startEnergy: 30 });
  await w.sb.loadMergeGame();
  w.sb.Math.random = () => 0.5;
  w.sb.mSpawn(0); w.sb.mSpawn(0);
  const real = w.sb.api;
  w.sb.api = async () => { throw new Error("斷線"); };
  await w.sb.mSync();
  eq("失敗時花掉的能量放回待送清單", w.get().mPend.spent, 2);
  eq("有提示同步失敗", w.get().mMsg.includes("同步失敗"), true);
  w.sb.api = real;
  await w.sb.mSync();
  eq("網路恢復後補送，伺服器扣了 2 點", w.server.st.energy, 28);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
