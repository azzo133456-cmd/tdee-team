// 記帳本前端測試：node test/ledger.client.test.mjs
// 把 public/app_ledger.js 放進 vm，用假的頁面和接真正檢查規則的假伺服器跑。
import fs from "fs";
import vm from "vm";
import * as L from "../ledger_logic.js";

const code = fs.readFileSync(new URL("../public/app_ledger.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
};

function makeWorld({ user = "肉", today = "2026-11-15", rows = [], parse = null } = {}) {
  const els = {}, el = (id) => els[id] || (els[id] = { id, value: "", textContent: "", innerHTML: "", style: {}, classList: { toggle() {} } });
  const db = { rows: rows.map((r, i) => ({ id: i + 1, note: "", account: "現金", ...r })), budget: 0, nextId: 100, fail: null, calls: [] };
  const api = async (path, opts = {}) => {
    db.calls.push(path);
    if (db.fail) throw new Error(db.fail);
    const body = opts.body ? JSON.parse(opts.body) : null, method = opts.method || "GET";
    if (path.startsWith("/api/ledger?month=")) {
      const m = path.slice(-7), r = L.monthRange(m);
      const inRange = db.rows.filter((e) => e.date >= r.from && e.date < r.to).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
      const t = {}; db.rows.filter((e) => e.date >= r.trendFrom && e.date < r.to).forEach((e) => { const k = e.date.slice(0, 7) + e.type; t[k] = t[k] || { month: e.date.slice(0, 7), type: e.type, total: 0 }; t[k].total += e.amount; });
      if (db.hold) await db.hold(m);
      return JSON.parse(JSON.stringify({ entries: inRange, trend: Object.values(t), budget: db.budget, cats: L.CATEGORIES, accounts: L.ACCOUNTS }));
    }
    if (path === "/api/ledger/all") return { entries: db.rows };
    if (path === "/api/ledger/budget") { db.budget = L.cleanBudget(body.budget); return { budget: db.budget }; }
    if (path === "/api/ledger/parse") { if (!parse) throw new Error("AI 服務忙碌"); return JSON.parse(JSON.stringify(parse)); }
    if (path === "/api/ledger" && method === "POST") { const made = body.entries.map((e) => ({ id: db.nextId++, ...L.cleanEntry(e) })); db.rows.push(...made); return { entries: made }; }
    const id = Number(path.split("/").pop());
    if (method === "PUT") { const i = db.rows.findIndex((x) => x.id === id); db.rows[i] = { id, ...L.cleanEntry(body) }; return { entry: db.rows[i] }; }
    if (method === "DELETE") { db.rows = db.rows.filter((x) => x.id !== id); return { ok: true }; }
    throw new Error("unexpected " + path);
  };
  const alerts = [];
  const sb = {
    console, JSON, Math, Date, Promise, Object, Number, String, Array, setTimeout,
    session: { username: user }, api, todayStr: () => today, alert: (m) => alerts.push(m), confirm: () => true,
    localStorage: { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); } },
    document: { getElementById: el, querySelectorAll: () => [], querySelector: (s) => (s.includes("ledger") ? el("navLedger") : null) },
    val: (id) => el(id).value, set: (id, t) => { el(id).textContent = t; }, setv: (id, v) => { el(id).value = v; },
    escapeHtml: (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
  };
  vm.createContext(sb); vm.runInContext(code, sb);
  return { sb, el, db, alerts, led: () => vm.runInContext("LED", sb) };
}
const add = (w, amount, cat, note) => { w.el("ledAmount").value = String(amount); w.sb.ledSetCat(cat); w.el("ledNote").value = note || ""; return w.sb.ledSave(); };

/* ---------- 誰看得到 ---------- */
{
  const w = makeWorld(); w.sb.applyLedgerVisibility();
  const o = makeWorld({ user: "zen" }); o.sb.applyLedgerVisibility();
  eq("只有肉看得到分頁", [w.el("navLedger").style.display, o.el("navLedger").style.display], ["", "none"]);
}

/* ---------- 記一筆、月結算 ---------- */
{
  const w = makeWorld();
  await w.sb.renderLedger();
  eq("打開：這個月、今天、預設帳戶", [w.el("ledMonthLabel").textContent, w.el("ledDate").value, w.el("ledAccount").value], ["2026 年 11 月", "2026-11-15", "現金"]);
  eq("分類按鈕畫出來，預設第一個", [(w.el("ledCats").innerHTML.match(/ledSetCat/g) || []).length, w.led().cat], [12, "餐飲"]);
  eq("空的提示", w.el("ledList").innerHTML.includes("還沒有紀錄"), true);
  await add(w, 120, "餐飲", "便當");
  w.el("ledAccount").value = "信用卡"; await add(w, 80, "交通", "<b>捷運</b>");
  w.sb.ledSetType("income");
  eq("切到收入：分類換成收入的", [w.led().cat, (w.el("ledCats").innerHTML.match(/ledSetCat/g) || []).length], ["薪資", 6]);
  await add(w, 45000, "薪資", "");
  const sum = w.el("ledSummary").innerHTML;
  eq("摘要：支出、收入、結餘", ["$200", "$45,000", "$44,800"].every((x) => sum.includes(x)), true);
  eq("存完表單清空", [w.el("ledAmount").value, w.el("ledNote").value], ["", ""]);
  eq("記住上次的帳戶", w.sb.localStorage.getItem("ledgerAccount"), "信用卡");
  const list = w.el("ledList").innerHTML;
  eq("明細：依日分組、星期、收入是 +、支出是 -", [list.includes("11/15（日）"), list.includes("+$45,000"), list.includes("-$120")], [true, true, true]);
  eq("備註會跳脫，不會變成 HTML", list.includes("&lt;b&gt;捷運"), true);
  eq("沒備註顯示分類", list.includes("<b>薪資</b>"), true);
  eq("分類佔比（只算支出）", w.el("ledCatBox").innerHTML.includes("餐飲") && w.el("ledCatBox").innerHTML.includes("60%") && !w.el("ledCatBox").innerHTML.includes("薪資"), true);
  eq("帳戶統計", w.el("ledCatBox").innerHTML.includes("信用卡 $80"), true);
  w.sb.ledSetType("expense");
  w.el("ledAmount").value = ""; await w.sb.ledSave();
  eq("沒金額不能存", [w.alerts.at(-1), w.db.rows.length], ["請輸入金額", 3]);
}

/* ---------- 修改、刪除、跨月 ---------- */
{
  const w = makeWorld({ rows: [{ type: "expense", amount: 100, date: "2026-11-10", category: "餐飲", note: "午餐" }, { type: "expense", amount: 50, date: "2026-10-05", category: "交通" }] });
  await w.sb.renderLedger();
  eq("只顯示這個月的", w.led().entries.length, 1);
  w.sb.ledEdit(1);
  eq("點一筆：帶回表單、切成修改模式", [w.el("ledAmount").value, w.el("ledNote").value, w.el("ledFormTitle").textContent, w.el("ledEditBtns").style.display], [100, "午餐", "✏️ 修改這筆", ""]);
  w.el("ledAmount").value = "130"; await w.sb.ledSave();
  eq("改完：同一筆、回到新增模式", [w.db.rows.length, w.db.rows.find((x) => x.id === 1).amount, w.led().editId, w.el("ledFormTitle").textContent], [2, 130, null, "＋ 記一筆"]);
  await w.sb.ledMonth(-1);
  eq("切到上個月", [w.el("ledMonthLabel").textContent, w.led().entries.map((e) => e.amount)], ["2026 年 10 月", [50]]);
  w.el("ledDate").value = "2026-11-20"; await add(w, 9, "其他", "");
  eq("記到別的月份 → 跳到那個月，才看得到", w.el("ledMonthLabel").textContent, "2026 年 11 月");
  w.sb.ledEdit(1); await w.sb.ledDelete();
  eq("刪除", [w.db.rows.some((x) => x.id === 1), w.led().editId], [false, null]);
  await w.sb.ledMonth(-11); await w.sb.ledMonth(-1);
  eq("跨年切月份", w.el("ledMonthLabel").textContent, "2025 年 11 月");
  w.sb.ledMonth(12);
}

/* ---------- 預算 ---------- */
{
  const w = makeWorld({ rows: [{ type: "expense", amount: 16000, date: "2026-11-02", category: "居住" }] });
  await w.sb.renderLedger();
  eq("沒設預算不顯示", w.el("ledSummary").innerHTML.includes("預算"), false);
  w.el("ledBudget").value = "30000"; await w.sb.ledSaveBudget();
  const s = w.el("ledSummary").innerHTML;
  eq("還剩多少、接下來每天能花（11/15 起還有 16 天）", [s.includes("還剩 $14,000"), s.includes("接下來 16 天"), s.includes("每天可以花 $875")], [true, true, true]);
  w.el("ledBudget").value = "10000"; await w.sb.ledSaveBudget();
  eq("超支", [w.el("ledSummary").innerHTML.includes("超支 $6,000"), w.el("ledSummary").innerHTML.includes("每天可以花")], [true, false]);
  w.el("ledBudget").value = "30000"; await w.sb.ledSaveBudget();
  await w.sb.ledMonth(-1);
  eq("過去的月份不顯示每天能花", w.el("ledSummary").innerHTML.includes("每天可以花"), false);
  eq("還剩幾天的計算", [w.sb.ledDaysLeft("2026-11", "2026-11-30"), w.sb.ledDaysLeft("2026-02", "2026-02-01"), w.sb.ledDaysLeft("2026-10", "2026-11-01")], [1, 28, 0]);
}

/* ---------- 分類篩選、趨勢、CSV ---------- */
{
  const w = makeWorld({ rows: [
    { type: "expense", amount: 100, date: "2026-11-10", category: "餐飲" }, { type: "expense", amount: 50, date: "2026-11-10", category: "交通" },
    { type: "income", amount: 300, date: "2026-11-11", category: "薪資" }, { type: "expense", amount: 70, date: "2026-06-11", category: "交通" },
    { type: "expense", amount: 999, date: "2026-05-30", category: "交通" },
  ] });
  await w.sb.renderLedger();
  w.sb.ledFilter("交通");
  eq("點分類：只看那類、可以取消", [w.el("ledList").innerHTML.includes("-$50"), w.el("ledList").innerHTML.includes("-$100"), w.el("ledList").innerHTML.includes("看全部")], [true, false, true]);
  w.sb.ledFilter("交通");
  eq("再點一次看全部", w.el("ledList").innerHTML.includes("-$100"), true);
  const tr = w.el("ledTrend").innerHTML;
  eq("趨勢 6 個月，6 月算進去、5 月不算", [(tr.match(/ledtrend-col/g) || []).length, tr.includes("6月"), tr.includes("5月"), tr.includes("2026-06 支出 $70"), tr.includes("$999")], [6, true, false, true, false]);
  const csv = w.sb.ledCsv([{ date: T1(), type: "income", category: "薪資", account: "銀行", amount: 5, note: '=SUM(A1),"x"' }]);
  eq("CSV：有 BOM、中文類型、公式被擋、逗號引號跳脫", [csv.charCodeAt(0), csv.split("\r\n")[1]], [0xfeff, `2026-11-01,收入,薪資,銀行,5,"'=SUM(A1),""x"""`]);
}
function T1() { return "2026-11-01"; }

/* ---------- 打一句話 ---------- */
{
  const w = makeWorld({ parse: { entries: [
    { type: "expense", amount: 120, date: "2026-11-15", category: "餐飲", account: "現金", note: "午餐" },
    { type: "expense", amount: 30, date: "2026-11-14", category: "交通", account: "現金", note: "捷運" },
  ], missing: "咖啡沒講金額" } });
  await w.sb.renderLedger();
  w.el("ledChatText").value = "午餐 120、昨天捷運 30、咖啡";
  await w.sb.ledChatSend();
  const log = w.el("ledChatLog").innerHTML;
  eq("一句話記兩筆，顯示結果、沒記到的、復原鈕", [w.db.rows.length, log.includes("11/14 捷運"), log.includes("咖啡沒講金額"), log.includes("ledChatUndo(1)")], [2, true, true, true]);
  eq("畫面更新", w.el("ledSummary").innerHTML.includes("$150"), true);
  await w.sb.ledChatUndo(1);
  eq("復原：兩筆都拿掉", [w.db.rows.length, w.el("ledChatLog").innerHTML.includes("已復原"), w.el("ledSummary").innerHTML.includes("$150")], [0, true, false]);
  const f = makeWorld();
  await f.sb.renderLedger();
  f.el("ledChatText").value = "午餐 120";
  await f.sb.ledChatSend();
  eq("AI 失敗：說沒記到，打的字放回輸入框", [f.el("ledChatLog").innerHTML.includes("沒有記到"), f.el("ledChatText").value, f.db.rows.length], [true, "午餐 120", 0]);
  const n = makeWorld({ parse: { entries: [], missing: "" } });
  await n.sb.renderLedger(); n.el("ledChatText").value = "你好"; await n.sb.ledChatSend();
  eq("跟記帳無關：不記", [n.db.rows.length, n.el("ledChatLog").innerHTML.includes("不是記帳")], [0, true]);
}

/* ---------- 網路問題 ---------- */
{
  const w = makeWorld();
  await w.sb.renderLedger();
  w.db.fail = "網路斷了";
  await add(w, 120, "餐飲", "便當");
  eq("存失敗：跳訊息、打的內容留著", [w.alerts.at(-1), w.el("ledAmount").value, w.el("ledNote").value, w.led().saving], ["網路斷了", "120", "便當", false]);
  await w.sb.ledMonth(-1);
  eq("更新失敗：有提示，舊資料還在", w.el("ledSummary").innerHTML.includes("更新失敗") && w.el("ledSummary").innerHTML.includes("ledsum"), true);
  const o = makeWorld(); o.db.fail = "網路斷了";
  await o.sb.renderLedger();
  eq("第一次就載入失敗：有提示", o.el("ledSummary").innerHTML.includes("載入失敗"), true);
  o.db.fail = null; await o.sb.renderLedger();
  eq("再進來會恢復", o.el("ledSummary").innerHTML.includes("ledsum"), true);
  // 快速切月份：慢回來的舊請求不能蓋掉新的
  const r = makeWorld({ rows: [{ type: "expense", amount: 1, date: "2026-10-01", category: "其他" }, { type: "expense", amount: 2, date: "2026-09-01", category: "其他" }] });
  await r.sb.renderLedger();
  let release; r.db.hold = (m) => (m === "2026-10" ? new Promise((ok) => { release = ok; }) : null);
  const slow = r.sb.ledMonth(-1);
  await new Promise((x) => setImmediate(x));
  r.db.hold = null;
  await r.sb.ledMonth(-1);
  release(); await slow;
  eq("慢回來的舊月份被丟掉", [r.el("ledMonthLabel").textContent, r.led().entries.map((e) => e.amount)], ["2026 年 9 月", [2]]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
