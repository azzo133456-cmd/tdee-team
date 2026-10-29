// 合成冒險前後端整合測試：node test/adv.client.test.mjs
// 把 public/app_adv.js 放進 vm 執行，api() 接到一個用真正 adv_logic 實作的假伺服器
// （跟 server.js 的兩條路由同樣的流程，只是沒有資料庫與 HTTP）。
// 重點在前端的同步：排隊、能量對帳、打怪掉落的額度、伺服器拒收時的復原。
import fs from "fs";
import vm from "vm";
import * as A from "../adv_logic.js";
import * as DUN from "../dungeon_logic.js";

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
  const html = { advBox: "", advHud: "", advNav: "", advFull: "", advScroll: "" };
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
    if (path === "/api/game/adv/dunboard") return DUN.dunBoard([{ user_id: 1, username: "我", games: { adv: st } }], 1, TODAY);
    if (path === "/api/game/adv/board") return { board: A.leaderboard([{ user_id: 1, username: "我", games: { adv: st } }, { user_id: 2, username: "amy", games: { adv: { v: 1, stage: 50, level: 30 } } }], 1) };
    if (path === "/api/game/adv") {
      const gained = A.grantHealth(st, rows, TODAY);
      return { state: A.publicState(st, TODAY, now), gained, migrated };
    }
    const copy = JSON.parse(JSON.stringify(st));
    try { A.applySync(copy, body, TODAY); } catch (e) { const err = new Error(e.message); err.status = 400; throw err; }
    server.st = copy;
    const result = A.runAction(copy, body, TODAY, server.rand || (() => 0.2));   // 0.2：掉武器、下一關不閃光
    return { state: A.publicState(copy, TODAY, now), result, pet: result && result.coins ? { coins: 1 } : null };
  };
  const sb = {
    console, JSON, Math: Object.create(Math), Promise,
    setTimeout: (fn) => { timers.set(++tid, fn); return tid; }, clearTimeout: (id) => { timers.delete(id); },
    alert() {}, confirm: () => true, petData: null, renderPet() {},
    window: { listeners: {}, addEventListener(t, f) { this.listeners[t] = f; } }, navigator: {}, history: { state: null, pushState(st) { this.state = st; }, back() { this.state = null; } },
    document: { getElementById: (id) => (id in html ? el(id) : null), addEventListener() {}, visibilityState: "visible", body: { style: {} } },
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
  vm.runInContext(code + "\nglobalThis.__get=()=>({AS,aSel,aMsg,aPend,aFightView,aBusy,aOpen,aTab});", sb);
  // 跑完所有排隊中的計時器（存檔延遲、戰鬥動畫）
  const flush = async () => { for (let n = 0; n < 200 && timers.size; n++) { const [id, f] = timers.entries().next().value; timers.delete(id); await f(); } await sb.aChain; };
  // 跑一個會等動畫（setTimeout）的動作：一直觸發計時器，直到它結束
  const run = async (p) => {
    let done = false; p.then(() => { done = true; }, () => { done = true; });
    for (let n = 0; n < 2000 && !done; n++) {
      const e = timers.entries().next().value;
      if (e) { timers.delete(e[0]); await e[1](); }
      await new Promise((r) => setImmediate(r));
    }
    return p;
  };
  return { sb, server, html, flush, run, get: () => sb.__get(), advance: (ms) => { now += ms; } };
}

/* ---------- 載入與健康能量 ---------- */
{
  const w = makeWorld({ startEnergy: 0, rows: [{ date: "2026-10-27", logged: 1, protein_hit: 1, water_hit: 1, kcal_hit: 1 }] });
  await w.sb.loadAdvGame();
  eq("今天三項健康行為 → 能量 30", w.get().AS.energy, 30);
  eq("提示有列出是哪幾項", w.get().aMsg.includes("記錄飲食") && w.get().aMsg.includes("喝水達標"), true);
  eq("畫面有畫出來：等級、第 1 關的怪", w.html.advHud.includes("Lv.1") && w.html.advBox.includes("大老鼠"), true);
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
  eq("動畫播完前，經驗還顯示打之前的（不劇透）", w.html.advHud.includes(">0/45<"), true);
  w.sb.aSkip();
  eq("播完才更新經驗", w.sb.aSkip() || w.html.advHud.includes(">7/45<"), true);
  eq("跳過動畫 → 顯示結果", [w.get().aFightView, w.get().aMsg.includes("打倒") && w.get().aMsg.includes("🦴+8") && w.get().aMsg.includes("圖鑑新增")], [null, true]);
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

/* ---------- 分頁：任務與寶箱 ---------- */
{
  const w = makeWorld({ startEnergy: 60, rows: [{ date: "2026-10-27", logged: 1, protein_hit: 1, water_hit: 1 }] });
  await w.sb.loadAdvGame();
  w.sb.aSetTab("quest");
  eq("任務分頁畫出三個任務、寶箱還不能開", [w.html.advBox.match(/⬜|✅/g).length >= 3, w.html.advBox.includes('disabled onclick="aChest()"')], [true, true]);
  await w.run(w.sb.aChest());
  eq("沒做完硬開 → 伺服器回錯誤訊息", w.get().aMsg.includes("三個任務都完成"), true);
  for (let i = 0; i < 25; i++) w.sb.aSpawn(i % 3);
  await w.flush();
  w.sb.aSetTab("battle");
  for (let i = 0; i < 3; i++) { await w.sb.aFight(); w.sb.aSkip(); }
  await w.sb.aTrain();
  await w.flush();
  eq("任務全部完成", w.get().AS.daily.quests.every((q) => q.done), true);
  w.sb.aSetTab("quest");
  const before = w.get().AS.board.filter(Boolean).length;
  await w.run(w.sb.aChest());
  eq("開寶箱：3 階裝備放進背包、連續 1 天", [w.get().AS.board.filter(Boolean).length - before, w.get().aMsg.includes("連續第 1 天")], [1, true]);
  await w.flush();
  eq("寶箱裝備存檔被接受", w.server.st.credit, 0);
  eq("開過之後顯示明天再來", w.html.advBox.includes("明天再來"), true);
}

/* ---------- 技能 ---------- */
{
  const w = makeWorld();
  await w.sb.loadAdvGame();
  w.sb.aSetTab("skill");
  eq("Lv1 技能分頁：顯示幾級解鎖，按鈕都不能按", [w.html.advBox.includes("Lv.5 解鎖"), (w.html.advBox.match(/disabled onclick="aToggleSkill/g) || []).length], [true, 6]);
  w.server.st.level = 12; await w.sb.loadAdvGame();
  await w.sb.aToggleSkill("combo"); await w.sb.aToggleSkill("guard");
  eq("裝上兩個技能，伺服器也記住", [w.get().AS.skills, w.server.st.skills], [["combo", "guard"], ["combo", "guard"]]);
  await w.sb.aToggleSkill("fury");
  eq("滿了不能再裝", [w.get().aMsg.includes("技能欄滿了"), w.server.st.skills.length], [true, 2]);
  await w.sb.aToggleSkill("combo");
  eq("卸下", w.server.st.skills, ["guard"]);
  eq("戰鬥用的是伺服器上的技能", A.heroStats(w.server.st).skills, ["guard"]);
}

/* ---------- 圖鑑與排行 ---------- */
{
  const w = makeWorld();
  await w.sb.loadAdvGame();
  await w.sb.aFight(); w.sb.aSkip();
  w.sb.aSetTab("dex");
  eq("圖鑑：打過的大老鼠有名字，其他是？？？", [w.html.advBox.includes("大老鼠"), w.html.advBox.includes("？？？"), w.html.advBox.includes("已收集 <b>1/48")], [true, true, true]);
  w.sb.aSetTab("rank"); await w.flush(); await new Promise((r) => setImmediate(r));
  eq("排行：amy 第一、我第二", [w.html.advBox.indexOf("amy") < w.html.advBox.indexOf("我"), w.html.advBox.includes("第 49 關")], [true, true]);
}

/* ---------- 全螢幕：打開、返回鍵 ---------- */
{
  const w = makeWorld();
  w.sb.advOpen(); await w.flush(); await new Promise((r) => setImmediate(r));
  eq("打開：狀態列、分頁、內容都畫出來，記一筆返回紀錄", [w.html.advHud.includes("‹ 返回"), w.html.advNav.includes("城鎮"), w.html.advBox.includes("挑戰第 1 關"), w.sb.history.state], [true, true, true, { adv: 1 }]);
  eq("打開時頁面本身不能捲", w.sb.document.body.style.overflow, "hidden");
  w.sb.history.state = null; w.sb.window.listeners.popstate();      // 手機返回手勢
  eq("返回手勢 → 關掉遊戲", [w.get().aOpen, w.sb.document.body.style.overflow], [false, ""]);
}

/* ---------- 城鎮 ---------- */
{
  const w = makeWorld({ startEnergy: 60 });
  await w.sb.loadAdvGame();
  const S = () => w.get().AS;
  for (let i = 0; i < 6; i++) w.sb.aSpawn(i % 3);              // 0,1,2,0,1,2 各兩件 1 階
  await w.flush();
  w.sb.aSetTab("town");
  eq("城鎮分頁：商店、鐵匠、工坊", ["回復藥", "鐵匠", "工坊"].every((t) => w.html.advBox.includes(t)), true);
  // 賣
  w.sb.aTownPick(0);
  eq("選一件 → 顯示賣價", w.html.advBox.includes("賣 💰3"), true);
  await w.sb.aSell(); await w.flush();
  eq("賣掉：背包少一件、金幣 +3、伺服器接受", [S().board[0], S().gold, w.server.st.gold, w.server.st.value], [null, 3, 3, 5]);
  // 轉換：武器 1 階＋防具 1 階 → 飾品 2 階
  w.sb.aTownMode("convert"); w.sb.aTownPick(3); w.sb.aTownPick(1);
  eq("選兩件同階不同種 → 出現三個選項", (w.html.advBox.match(/onclick="aConvert\(/g) || []).length, 3);
  w.sb.aConvert(2); await w.flush();
  eq("轉換成 2 階飾品，價值不變、伺服器接受", [S().board[3], S().board[1], w.server.st.value], [[2, 2], null, 5]);
  w.sb.aTownMode("convert"); w.sb.aTownPick(2); w.sb.aTownPick(5);
  eq("同種不能轉換", (w.html.advBox.match(/onclick="aConvert\(/g) || []).length, 0);
  // 釀藥
  w.sb.aTownMode("brew"); w.sb.aTownPick(2); w.sb.aTownPick(4); w.sb.aTownPick(5);
  await w.sb.aBrew(); await w.flush();
  eq("3 件 1 階 → 一瓶藥，伺服器記到", [S().potions, w.server.st.potions, S().board.filter(Boolean).length, w.server.st.value], [1, 1, 1, 2]);
  // 買、強化
  w.server.st.gold = 200; await w.sb.loadAdvGame(); w.sb.aSetTab("town");
  await w.sb.aBuy();
  eq("買藥水 −40 金幣", [S().potions, S().gold], [2, 160]);
  await w.sb.aEnhance(0); await w.sb.aEnhance(0);
  eq("強化武器兩次（30＋120）", [S().enh, S().gold], [[2, 0, 0], 10]);
  await w.sb.aEnhance(0);
  eq("金幣不夠 → 本機先擋，不送出", w.get().aMsg.includes("金幣不夠"), true);
  eq("攻擊照強化算", w.sb.aHero().atk, Math.round(8 * 1.1));
}

/* ---------- 地圖：探索打過的關 ---------- */
{
  const w = makeWorld();
  await w.sb.loadAdvGame();
  await w.sb.aFight(); w.sb.aSkip(); await w.flush();
  w.sb.aSetTab("map");
  eq("地圖：第一區打開、其他區鎖著", [w.html.advBox.includes("迷霧森林"), (w.html.advBox.match(/？？？/g) || []).length], [true, 7]);
  w.sb.aMapSel(1);
  eq("點打過的第 1 關 → 可以探索", w.html.advBox.includes(`onclick="aExplore(1)"`), true);
  const e0 = w.server.st.energy;
  await w.sb.aExplore(1);
  eq("探索：伺服器扣 3 能量、切回冒險分頁播動畫", [e0 - w.server.st.energy, w.get().aTab, !!w.get().aFightView], [3, "battle", true]);
  w.sb.aSkip();
  eq("探索打贏：有金幣、關卡不會前進", [w.get().aMsg.includes("💰+"), w.server.st.stage], [true, 2]);
}

/* ---------- 柏青哥 A：遊樂場 ---------- */
{
  const w = makeWorld();
  await w.sb.loadAdvGame();
  w.sb.aSetTab("town");
  eq("城鎮最上面是遊樂場、金幣不夠按鈕不能按", [w.html.advBox.includes("健康機台"), w.html.advBox.includes(`disabled onclick="aPachi()"`)], [true, true]);
  eq("金幣不夠：按鈕上寫原因", w.html.advBox.includes("金幣不夠（要 💰20，有 💰0）"), true);
  w.server.st.gold = 500; w.server.st.pachi = { day: "2026-10-27", balls: 200, kaku: 0 }; await w.sb.loadAdvGame(); w.sb.aSetTab("town");
  eq("打了 200 顆還能繼續打（不設上限）", [w.html.advBox.includes("今天打了 200 顆"), w.html.advBox.includes(`disabled onclick="aPachi()"`)], [true, false]);
  w.server.st.pachi = null; w.server.st.gold = 0; await w.sb.loadAdvGame(); w.sb.aSetTab("town");
  w.server.st.gold = 100; await w.sb.loadAdvGame();
  // 第 1 顆入賞、轉盤中 7（大當＋4 階裝備＋確變），其他珠子都掉出去
  // 第 1 顆入賞、第 2、3 顆掉出去；第 3 顆時轉保留：中（0.0）、數字 7（0.9）、裝備種類（0.0）
  const seq = [0.1, 0.99, 0.99, 0.0, 0.9, 0.0];
  w.server.rand = () => (seq.length ? seq.shift() : 0.99);
  const p = w.sb.aPachi();
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  eq("動畫中：狀態列金幣先顯示扣掉 20 之後的", w.html.advHud.includes("💰80"), true);
  await w.run(p);
  const S = w.get().AS;
  eq("播完：大當訊息、金幣 100−20+100", [w.get().aMsg.includes("大當 1 次"), S.gold, w.server.st.gold], [true, 180, 180]);
  eq("777 送的 4 階裝備放進背包", S.board.filter(Boolean).map((x) => x[1]), [4]);
  await w.flush();
  eq("存檔被接受（額度用掉）", w.server.st.credit, 0);
  eq("7 是奇數 → 確變中 5 轉", [S.pachi.kaku, w.html.advBox.includes("RUSH 確變 5")], [5, true]);
  eq("今天打了 10 顆", S.pachi.ballsToday, 10);
}

/* ---------- 柏青哥 B：寶箱轉盤、確變時間 ---------- */
{
  const w = makeWorld({ startEnergy: 60, rows: [{ date: "2026-10-27", logged: 1, protein_hit: 1, water_hit: 1 }] });
  await w.sb.loadAdvGame();
  for (let i = 0; i < 25; i++) w.sb.aSpawn(i % 3);
  await w.flush();
  for (let i = 0; i < 3; i++) { await w.sb.aFight(); w.sb.aSkip(); }
  await w.sb.aTrain(); await w.flush();
  w.sb.aSetTab("quest");
  w.server.rand = () => 0.01;                          // 777
  const before = w.get().AS.board.filter(Boolean).length;
  await w.run(w.sb.aChest());
  eq("寶箱 777：升兩階（3→5 階）、訊息", [w.get().aMsg.includes("777"), w.get().AS.board.filter(Boolean).length - before], [true, 1]);
  eq("背包裡多了一件 5 階", w.get().AS.board.some((x) => x && x[1] === 5), true);

  const r = makeWorld();
  await r.sb.loadAdvGame();
  r.server.rand = () => 0.05;                          // 打贏後突入確變
  await r.sb.aFight(); r.sb.aSkip();
  eq("確變突入：訊息、戰場上出現確變條", [r.get().aMsg.includes("確變突入"), r.html.advBox.includes("確變時間"), r.get().AS.rush], [true, true, 3]);
}

/* ---------- 柏青哥 C：彈珠產生器 ---------- */
{
  const w = makeWorld({ startEnergy: 10 });
  await w.sb.loadAdvGame();
  eq("預設是點擊產生", w.html.advBox.includes(`onclick="aSpawn(0)"`), true);
  w.sb.aSetGenMode("plinko");
  eq("切到彈珠：出現彈珠台和瞄準", [w.html.advBox.includes("advPlinko"), w.html.advBox.includes(`onclick="aSetAim(2)"`), w.html.advBox.includes(`onclick="aSpawn(0)"`)], [true, true, false]);
  w.sb.aSetAim(2);
  w.server.rand = () => 0.1;                            // 六排都往左 → 3 階
  const ok = await w.run(w.sb.aDrop());
  eq("發射：掉進邊邊的洞 → 3 階飾品放進背包", [ok, w.get().AS.board[0], w.get().aMsg.includes("邊邊")], [true, [2, 3], true]);
  eq("伺服器扣 1 能量（本機也是）", [w.server.st.energy, w.get().AS.energy], [9, 9]);
  await w.flush();
  eq("存檔被接受", [w.server.st.value, w.server.st.credit], [4, 0]);
  w.server.rand = () => 0.6;
  await w.run(w.sb.aDropMany(5));
  eq("連發 5 顆：背包多 5 件、能量 −5", [w.get().AS.board.filter(Boolean).length, w.server.st.energy], [6, 4]);
  w.sb.aSetGenMode("tap");
  eq("切回點擊", w.html.advBox.includes(`onclick="aSpawn(0)"`), true);
}

/* ---------- 遊樂場演出：先讀、聽牌、跳過、自動 ---------- */
{
  const w = makeWorld();
  await w.sb.loadAdvGame();
  const ctx = (code) => vm.runInContext(code, w.sb);
  w.sb.Math.random = () => 0.05;
  eq("中的那轉：保留燈偏紅金（亂數 0.05 → 白，0.9 → 金）", [ctx("pzHoldColor({win:true})"), (w.sb.Math.random = () => 0.95, ctx("pzHoldColor({win:true})"))], ["white", "gold"]);
  const golds = [0, 0.3, 0.75, 0.93, 0.99, 0.999999].filter((x) => (w.sb.Math.random = () => x, ctx("pzHoldColor({win:false,reach:false})")) === "gold");
  eq("沒中、沒聽牌：保留燈不會出金", golds, []);
  w.sb.Math.random = () => 0.1;
  eq("中的那轉 0.1 → 激熱；沒中 0.1 → 超級", [ctx("pzReachType(true)"), ctx("pzReachType(false)")], ["geki", "super"]);
  w.sb.Math.random = () => 0.5;
  w.server.st.gold = 100; await w.sb.loadAdvGame(); w.sb.aSetTab("town");
  const seq = [0.1, 0.99, 0.99, 0.0, 0.9, 0.0];
  w.server.rand = () => (seq.length ? seq.shift() : 0.99);
  const p = w.sb.aPachi();
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  w.sb.aPachiSkip();
  await w.run(p);
  eq("跳過：直接跑完，結果一樣", [w.get().aMsg.includes("大當 1 次"), w.get().AS.gold], [true, 180]);
  eq("跳過會關掉自動", ctx("aPachiAuto"), false);
  w.server.rand = () => 0.99;
  ctx("aPachiAuto=true; aOpen=true");                // 自動只在遊戲畫面開著時接著打
  await w.run(w.sb.aPachi());
  await w.run(new Promise((r) => setTimeout(r, 800)));
  await w.run(new Promise((r) => setTimeout(r, 1)));
  eq("自動：打完一輪接著打下一輪", w.server.st.pachi.balls >= 30, true);
  w.server.st.gold = 5; ctx("AS.gold=5");
  await w.run(new Promise((r) => setTimeout(r, 2000)));
  ctx("aPachiAuto=true"); await w.run(w.sb.aPachi());
  eq("金幣不夠：自動停下來", [ctx("aPachiAuto"), w.get().aMsg.includes("金幣不夠")], [false, true]);
}

/* ---------- 深淵地城 ---------- */
{
  const w = makeWorld();
  await w.sb.loadAdvGame();
  w.sb.aSetTab("dungeon"); await w.flush(); await new Promise((r) => setImmediate(r));
  eq("大廳：兩種開始按鈕、紀錄、排行", ["開始探索", "本週挑戰", "最深", "地城排行"].every((t) => w.html.advBox.includes(t)), true);
  eq("分頁列有地城", w.html.advNav.includes("地城"), true);
  await w.sb.aDunStart("normal");
  const run = () => w.get().AS.dun.run;
  eq("開始：第 1 層、選門", [run().floor, run().phase, w.html.advBox.includes("選一扇門")], [1, "choose", true]);
  w.server.st.dun.doors = ["fight", "camp"]; await w.sb.loadAdvGame(); w.sb.aSetTab("dungeon");
  const p = w.sb.aDunGo(0);
  await p;
  eq("進戰鬥：播動畫、其他分頁鎖住", [!!vm.runInContext("aDunView", w.sb), w.html.advNav.includes(`disabled onclick="aSetTab('map')"`)], [true, true]);
  w.sb.aDunSkip();
  eq("打贏：選祝福、三張卡", [run().phase, (w.html.advBox.match(/onclick="aDunPick\(/g) || []).length, w.get().aMsg.includes("選一個祝福")], ["bless", 3, true]);
  const id = run().offer[1];
  await w.sb.aDunPick(1);
  eq("選了祝福 → 第 2 層、祝福顯示在上面", [run().floor, run().bless[id], w.html.advBox.includes("dunchip")], [2, 1, true]);
  w.sb.confirm = () => true;
  await w.sb.aDunQuit();
  eq("撤退：回大廳、顯示結算", [run().active, w.get().aMsg.includes("這場打過 <b>1</b> 層"), w.html.advBox.includes("開始探索")], [false, true, true]);
  eq("金幣 +3", w.server.st.gold, 3);
  await w.sb.aDunLoadBoard(); w.sb.aDunSetBoard("all");
  eq("歷史排行有自己（一般模式不算本週挑戰）", w.html.advBox.includes("🥇 我"), true);
}
{
  const w = makeWorld();
  await w.sb.loadAdvGame(); w.sb.aSetTab("dungeon");
  await w.sb.aDunStart("weekly");
  const d = w.server.st.dun; d.floor = 9; d.hp = 1; d.doors = ["fight"];
  await w.sb.loadAdvGame(); w.sb.aSetTab("dungeon");
  await w.sb.aDunGo(0); w.sb.aDunSkip();
  eq("血 1 打第 9 層：倒下、結算、本週紀錄", [w.get().AS.dun.run.active, w.get().aMsg.includes("倒下"), w.get().AS.dun.rec.weekBest], [false, true, 8]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
