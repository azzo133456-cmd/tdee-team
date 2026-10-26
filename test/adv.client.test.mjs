// 合成冒險前後端整合測試：node test/adv.client.test.mjs
// 把 public/app_adv.js 放進 vm 執行，api() 接到一個用真正 adv_logic 實作的假伺服器
// （跟 server.js 的兩條路由同樣的流程，只是沒有資料庫與 HTTP）。
// 重點在前端的同步：排隊、能量對帳、打怪掉落的額度、伺服器拒收時的復原。
import fs from "fs";
import vm from "vm";
import * as A from "../adv_logic.js";

const code = fs.readFileSync(new URL("../public/app_adv.js", import.meta.url), "utf8");
const data = JSON.parse(fs.readFileSync(new URL("../public/adv_data.json", import.meta.url), "utf8"));

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
};

function makeWorld({ rows = [], startEnergy = 30, oldMerge = null } = {}) {
  const TODAY = "2026-10-27";
  let now = Date.UTC(2026, 9, 27, 4);
  const server = { st: null, calls: 0, hold: null, old: oldMerge };
  const timers = new Map(); let tid = 0;
  const html = { advBox: "", advCard: "" };
  const el = (id) => ({ style: {}, set innerHTML(v) { html[id] = v; }, get innerHTML() { return html[id]; } });
  // 跟 server.js 的路由同樣的流程
  const route = (path, body) => {
    let migrated = null;
    if (!server.st) {
      const m = A.migrateFromMerge(server.old, now);
      server.st = m.st; if (!server.old) server.st.energy = startEnergy; else migrated = { refund: m.refund };
    }
    const st = server.st;
    A.regen(st, now);
    if (path === "/api/game/adv") {
      const gained = A.grantHealth(st, rows, TODAY);
      return { state: A.publicState(st, TODAY, now), gained, migrated };
    }
    const copy = JSON.parse(JSON.stringify(st));
    try { A.applySync(copy, body); } catch (e) { const err = new Error(e.message); err.status = 400; throw err; }
    server.st = copy;
    let result = null;
    if (body.action === "fight") result = A.fight(copy, TODAY, () => 0);
    else if (body.action === "train") { try { result = A.train(copy); } catch (e) { result = { kind: "train", error: e.message }; } }
    return { state: A.publicState(copy, TODAY, now), result, pet: result && result.coins ? { coins: 1 } : null };
  };
  const sb = {
    console, JSON, Math: Object.create(Math), Promise,
    setTimeout: (fn) => { timers.set(++tid, fn); return tid; }, clearTimeout: (id) => { timers.delete(id); },
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
  sb.Math.random = () => 0.5;                       // 不觸發 15% 的直接掉 2 階
  vm.createContext(sb);
  vm.runInContext(code + "\nglobalThis.__get=()=>({AS,aSel,aMsg,aPend,aFightView,aBusy});", sb);
  // 跑完所有排隊中的計時器（存檔延遲、戰鬥動畫）
  const flush = async () => { for (let n = 0; n < 200 && timers.size; n++) { const [id, f] = timers.entries().next().value; timers.delete(id); await f(); } await sb.aChain; };
  return { sb, server, html, flush, get: () => sb.__get(), advance: (ms) => { now += ms; } };
}

/* ---------- 載入與健康能量 ---------- */
{
  const w = makeWorld({ startEnergy: 0, rows: [{ date: "2026-10-27", logged: 1, protein_hit: 1, water_hit: 1, kcal_hit: 1 }] });
  await w.sb.loadAdvGame();
  eq("今天三項健康行為 → 能量 30", w.get().AS.energy, 30);
  eq("提示有列出是哪幾項", w.get().aMsg.includes("記錄飲食") && w.get().aMsg.includes("喝水達標"), true);
  eq("畫面有畫出來：等級、第 1 關的怪", w.html.advBox.includes("Lv.1") && w.html.advBox.includes("大老鼠"), true);
}

/* ---------- 合成小屋舊存檔 ---------- */
{
  const w = makeWorld({ oldMerge: { energy: 10, board: [[0, 4], [1, 2]], granted: {} } });
  await w.sb.loadAdvGame();
  eq("舊棋盤退成能量（8+2）並告知", [w.get().AS.energy, w.get().aMsg.includes("⚡10")], [20, true]);
}

/* ---------- 產生、合成、穿裝備 ---------- */
{
  const w = makeWorld();
  await w.sb.loadAdvGame();
  const S = () => w.get().AS;
  w.sb.aSpawn(0); w.sb.aSpawn(0);
  eq("點兩次鐵匠鋪 → 兩把木湯匙", [S().board[0], S().board[1]], [[0, 1], [0, 1]]);
  eq("能量 30 → 28", S().energy, 28);
  w.sb.aTap(0); w.sb.aTap(1);
  eq("合成出 2 階小刀", [S().board[0], S().board[1]], [null, [0, 2]]);
  w.sb.aTap(1); w.sb.aEquip();
  eq("穿上小刀，背包那格空出來", [S().equip, S().board[1]], [[2, 0, 0], null]);
  eq("攻擊立刻變成 8+6", w.sb.aHero().atk, 14);
  w.sb.aSpawn(0); w.sb.aTap(0); w.sb.aEquip();
  eq("換穿木湯匙 → 小刀放回原本那格", [S().equip, S().board[0]], [[1, 0, 0], [0, 2]]);
  await w.flush();
  eq("存檔被伺服器接受：能量與裝備一致", [w.server.st.energy, w.server.st.equip, w.server.st.value], [27, [1, 0, 0], 3]);
  eq("本機能量跟伺服器一致", S().energy, 27);
}

/* ---------- 打怪：先存檔再打、掉落、動畫 ---------- */
{
  const w = makeWorld();
  await w.sb.loadAdvGame();
  const S = () => w.get().AS;
  w.sb.aSpawn(1);
  await w.sb.aFight();
  eq("打之前的存檔一起送出（伺服器扣了 1 能量）", w.server.st.energy, 29);
  eq("打贏第 1 關 → 伺服器前進到第 2 關", w.server.st.stage, 2);
  eq("動畫開始播", !!w.get().aFightView, true);
  eq("掉落物（1 階武器）放進背包第一個空格", S().board[1], [0, 1]);
  eq("播動畫時不能合成", (w.sb.aTap(0), w.get().aSel), null);
  eq("動畫播完前，經驗還顯示打之前的（不劇透）", w.html.advBox.includes("經驗 0/45"), true);
  w.sb.aSkip();
  eq("播完才更新經驗", w.sb.aSkip() || w.html.advBox.includes("經驗 7/45"), true);
  eq("跳過動畫 → 顯示結果", [w.get().aFightView, w.get().aMsg.includes("打倒") && w.get().aMsg.includes("🦴+3")], [null, true]);
  await w.flush();
  eq("掉落物存檔被接受（額度用掉）", [w.server.st.board[1], w.server.st.credit], [[0, 1], 0]);
  eq("畫面換成第 2 關", w.html.advBox.includes("第 2 關"), true);
}

/* ---------- 打輸 ---------- */
{
  const w = makeWorld();
  await w.sb.loadAdvGame();
  w.server.st.stage = 30; w.get().AS.stage = 30;
  await w.sb.aFight(); w.sb.aSkip();
  eq("空手打第 30 關 → 輸，提示去變強", [w.server.st.stage, w.get().aMsg.includes("打倒了")], [30, true]);
}

/* ---------- 請求在路上時又花能量 ---------- */
{
  const w = makeWorld();
  await w.sb.loadAdvGame();
  let release; w.server.hold = new Promise((r) => { release = r; });
  w.sb.aSpawn(2);
  const p = w.sb.aSync();                   // 送出 spent=1，卡在路上
  w.sb.aSpawn(2); w.sb.aSpawn(2);           // 路上又花 2
  w.server.hold = null; release(); await p;
  eq("回來時扣掉路上花的 2 → 27", w.get().AS.energy, 27);
  await w.flush();
  eq("之後全部送完，伺服器也是 27", w.server.st.energy, 27);
}

/* ---------- 訓練 ---------- */
{
  const w = makeWorld({ startEnergy: 4 });
  await w.sb.loadAdvGame();
  await w.sb.aTrain();
  eq("能量不到 5 → 不送出", [w.get().aMsg.includes("訓練要 5"), w.server.calls], [true, 1]);
  w.server.st.energy = 12; await w.sb.loadAdvGame();
  await w.sb.aTrain();
  eq("訓練：伺服器扣 5、經驗 +9", [w.server.st.energy, w.server.st.xp, w.get().AS.energy], [7, 9, 7]);
  eq("訓練完按鈕恢復可以按", [w.get().aBusy, w.html.advBox.includes('disabled onclick="aTrain()"'), w.html.advBox.includes('disabled onclick="aFight()"')], [false, false, false]);
}

/* ---------- 伺服器拒收 → 換回伺服器的版本 ---------- */
{
  const w = makeWorld();
  await w.sb.loadAdvGame();
  w.sb.aSpawn(0); await w.flush();
  w.get().AS.equip = [10, 10, 10];          // 竄改
  w.sb.aQueue(); await w.flush();
  eq("價值對不起來 → 拒收，本機換回伺服器的裝備", w.get().AS.equip, [0, 0, 0]);
  eq("背包也換回伺服器的", w.get().AS.board[0], [0, 1]);
  eq("有提示", w.get().aMsg.includes("重新載入"), true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
