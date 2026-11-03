// 記帳本規則與路由測試：node test/ledger.test.mjs
// 路由用真的 Express 跑、資料庫換成假的，重點是權限、每筆都綁自己的 user_id、壞資料進不去。
import express from "express";
import * as L from "../ledger_logic.js";
import { registerLedger } from "../ledger_routes.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
};
const throws = (f) => { try { f(); return ""; } catch (e) { return e.message; } };
const T = "2026-11-03";
const good = { type: "expense", amount: 120, date: T, category: "餐飲", account: "現金", note: " 便當 " };

/* ---------- 規則 ---------- */
{
  eq("只有「肉」", [L.isLedgerUser("肉"), L.isLedgerUser(" 肉 "), L.isLedgerUser("zen"), L.isLedgerUser(null)], [true, true, false, false]);
  eq("乾淨的一筆，備註去空白", L.cleanEntry(good), { ...good, note: "便當" });
  eq("收入不能用支出的分類", throws(() => L.cleanEntry({ ...good, type: "income" })), "請選分類");
  for (const [name, bad, msg] of [
    ["金額 0", { amount: 0 }, "金額要是大於 0 的整數"], ["負的金額", { amount: -5 }, "金額要是大於 0 的整數"],
    ["小數", { amount: 1.5 }, "金額要是大於 0 的整數"], ["太大", { amount: 100000001 }, "金額太大了"],
    ["不存在的日子", { date: "2026-02-30" }, "日期不正確"], ["亂打的帳戶", { account: "地下錢莊" }, "請選帳戶"],
    ["亂打的類型", { type: "x" }, "請選支出或收入"],
  ]) eq(name, throws(() => L.cleanEntry({ ...good, ...bad })), msg);
  eq("備註最多 200 字", L.cleanEntry({ ...good, note: "字".repeat(300) }).note.length, 200);
  eq("月份範圍（含跨年）", L.monthRange("2026-01"), { from: "2026-01-01", to: "2026-02-01", trendFrom: "2025-08-01" });
  eq("12 月的結束是隔年 1 月", L.monthRange("2026-12").to, "2027-01-01");
  eq("月份格式不對", throws(() => L.monthRange("2026-13")), "月份不正確");
  const emoji = JSON.stringify(L.CATEGORIES);
  eq("分類沒有 Emoji 13 以後的字元", [...emoji].filter((c) => { const x = c.codePointAt(0); return x >= 0x1fa70 && x <= 0x1faff; }), []);
  const n = L.normalizeParsed({ entries: [
    { type: "expense", date: "2026-11-02", amount: 120.4, category: "餐飲", account: "信用卡", note: "午餐" },
    { type: "expense", date: "2027-01-01", amount: 30, category: "亂寫", account: "亂寫" },
    { type: "income", date: "2020-01-01", amount: 45000, category: "亂寫" },
    { type: "expense", amount: 0, category: "餐飲" }, { type: "轉帳", amount: 5 }, null,
  ], missing: "咖啡沒講金額" }, T, "銀行");
  eq("AI 回的東西整理過：不認得的歸其他、未來和太舊改今天、沒金額不記", n.entries.map((e) => [e.date, e.amount, e.category, e.account]),
    [["2026-11-02", 120, "餐飲", "信用卡"], [T, 30, "其他", "銀行"], [T, 45000, "其他收入", "銀行"]]);
  eq("沒金額的項目會說", n.missing, "咖啡沒講金額");
  eq("亂七八糟的回應 → 空", L.normalizeParsed("hello", T, "現金").entries, []);
  const p = L.buildPrompt("午餐 120", T, "信用卡");
  eq("提示有日期、預設帳戶、使用者的話", [p.includes("今天是 2026-11-03（週二）"), p.includes("沒講就填「信用卡」"), p.endsWith("使用者說：午餐 120")], [true, true, true]);
}

/* ---------- 路由 ---------- */
const queries = [];
const pool = { query: async (sql, params) => {
  queries.push({ sql, params });
  if (/^INSERT/.test(sql)) { const n = (sql.match(/\(\$/g) || []).length; return { rowCount: n, rows: Array.from({ length: n }, (_, i) => ({ id: i + 1 })) }; }
  if (/^UPDATE ledger/.test(sql)) return params[6] === 999 ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{ id: params[6] }] };
  if (/to_char/.test(sql)) return { rows: [{ month: "2026-11", type: "expense", total: "150" }] };
  return { rowCount: 1, rows: [] };
} };
const app = express(); app.use(express.json());
const auth = (req, res, next) => { req.user = req.headers["x-user"] === "zen" ? { id: 2, username: "zen" } : { id: 7, username: "肉", ledger_cfg: { budget: 30000 } }; next(); };
let aiResult = { parsed: { entries: [{ type: "expense", amount: 80, category: "交通", note: "捷運" }] } };
registerLedger(app, { pool, auth, aiLimit: (q, s, n) => n(), today: () => T, askAi: async () => aiResult });
const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (method, path, body, user) => {
  const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(user ? { "x-user": user } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json() };
};

for (const [m, p, b] of [["GET", "/api/ledger?month=2026-11"], ["GET", "/api/ledger/all"], ["POST", "/api/ledger", { entries: [good] }], ["PUT", "/api/ledger/1", good], ["DELETE", "/api/ledger/1"], ["PUT", "/api/ledger/budget", { budget: 1 }], ["POST", "/api/ledger/parse", { text: "x" }]]) {
  queries.length = 0;
  const r = await call(m, p, b, "zen");
  eq(`其他人被擋：${m} ${p}`, [r.status, queries.length], [403, 0]);
}
{
  queries.length = 0;
  const g = await call("GET", "/api/ledger?month=2026-11");
  eq("讀明細：範圍與自己的 id", queries[0].params, [7, "2026-11-01", "2026-12-01"]);
  eq("回傳預算、分類、帳戶、數字化的趨勢", [g.json.budget, g.json.accounts.length, g.json.trend[0].total], [30000, 4, 150]);
  eq("月份亂打 → 400", (await call("GET", "/api/ledger?month=abc")).status, 400);
  queries.length = 0;
  const a = await call("POST", "/api/ledger", { entries: [good, { ...good, amount: 30 }] });
  eq("新增兩筆是同一個 INSERT（要嘛全成功、要嘛全失敗）", [a.status, queries.length, a.json.entries.length], [200, 1, 2]);
  eq("參數順序正確，綁自己的 id", queries[0].params.slice(0, 7), [7, T, "expense", "餐飲", "現金", 120, "便當"]);
  eq("佔位符連續", queries[0].sql.includes("($8,$9,$10,$11,$12,$13,$14)"), true);
  queries.length = 0;
  eq("有一筆壞的整批不存", [(await call("POST", "/api/ledger", { entries: [good, { ...good, amount: -1 }] })).status, queries.length], [400, 0]);
  eq("空的不存", (await call("POST", "/api/ledger", { entries: [] })).status, 400);
  eq("超過 20 筆不存", (await call("POST", "/api/ledger", { entries: Array(21).fill(good) })).status, 400);
  queries.length = 0;
  await call("PUT", "/api/ledger/5", good);
  eq("修改限定自己的紀錄", [/WHERE id=\$7 AND user_id=\$8/.test(queries[0].sql), queries[0].params.slice(6)], [true, [5, 7]]);
  eq("找不到 → 404", (await call("PUT", "/api/ledger/999", good)).status, 404);
  eq("id 亂打 → 400，不碰資料庫", (await call("PUT", "/api/ledger/abc", good)).status, 400);
  queries.length = 0;
  await call("DELETE", "/api/ledger/5");
  eq("刪除限定自己的紀錄", [/user_id=\$2/.test(queries[0].sql), queries[0].params], [true, [5, 7]]);
  eq("刪除 id 太大 → 400", (await call("DELETE", "/api/ledger/99999999999")).status, 400);
  queries.length = 0;
  const b = await call("PUT", "/api/ledger/budget", { budget: 25000 });
  eq("預算走自己的路由，不會被當成 id", [b.json.budget, queries[0].params], [25000, ["25000", 7]]);
  eq("負的預算不行", (await call("PUT", "/api/ledger/budget", { budget: -1 })).status, 400);
  const pr = await call("POST", "/api/ledger/parse", { text: "捷運 80", account: "銀行" });
  eq("打一句話：整理好，沒講帳戶用傳來的", pr.json.entries[0], { type: "expense", amount: 80, date: T, category: "交通", account: "銀行", note: "捷運" });
  eq("空白不送 AI", (await call("POST", "/api/ledger/parse", { text: "  " })).status, 400);
  aiResult = { error: "AI 服務忙碌", status: 502 };
  eq("AI 失敗回錯誤訊息", (await call("POST", "/api/ledger/parse", { text: "x" })).json.error, "AI 服務忙碌");
  pool.query = async () => { throw new Error("db down"); };
  const errLog = console.error; console.error = () => {};
  eq("資料庫壞掉回 500，不會卡住", (await call("GET", "/api/ledger/all")).status, 500);
  console.error = errLog;
}
server.close();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
