/* ---------- 記帳本（目前只開放「肉」，跟 zen 的買菜月結無關） ----------
   這裡放純規則：分類、帳戶、資料檢查、打一句話記帳的提示與整理。路由在 ledger_routes.js。
   分類和帳戶由 GET /api/ledger 傳給前端，兩邊只有這一份。金額一律新台幣整數。 */
export const CATEGORIES = {
  expense: [
    ["餐飲", "🍱"], ["交通", "🚌"], ["日用品", "🛒"], ["居住", "🏠"], ["水電通訊", "📱"], ["服飾美容", "👕"],
    ["娛樂", "🎮"], ["醫療", "💊"], ["學習", "📚"], ["人情", "🎁"], ["旅遊", "🧳"], ["其他", "📦"],
  ],
  income: [["薪資", "💼"], ["獎金", "🎉"], ["投資", "📈"], ["紅包", "🧧"], ["退款", "💵"], ["其他收入", "💰"]],
};
export const ACCOUNTS = ["現金", "信用卡", "銀行", "行動支付"];
export const MAX_AMOUNT = 100000000;
const FALLBACK = { expense: "其他", income: "其他收入" };

export const isLedgerUser = (username) => String(username || "").trim() === "肉";

export function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;     // 擋掉 2026-02-30 這種不存在的日子
}
function addDays(s, n) {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const hasCat = (type, c) => CATEGORIES[type].some(([n]) => n === c);

/* 檢查使用者送來的一筆，回傳乾淨的資料；不對就丟錯，呼叫端回 400。 */
export function cleanEntry(b) {
  const e = b || {};
  if (e.type !== "expense" && e.type !== "income") throw new Error("請選支出或收入");
  const amount = Number(e.amount);
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("金額要是大於 0 的整數");
  if (amount > MAX_AMOUNT) throw new Error("金額太大了");
  if (!validDate(e.date)) throw new Error("日期不正確");
  if (!hasCat(e.type, e.category)) throw new Error("請選分類");
  if (!ACCOUNTS.includes(e.account)) throw new Error("請選帳戶");
  return { type: e.type, amount, date: e.date, category: e.category, account: e.account, note: String(e.note || "").trim().slice(0, 200) };
}
export function cleanBudget(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > MAX_AMOUNT) throw new Error("預算要是 0 以上的整數（0 代表不設）");
  return n;
}

/* 這個月的日期範圍，以及「到這個月為止的 6 個月」的開始日。 */
export function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) throw new Error("月份不正確");
  const [y, m] = month.split("-").map(Number);
  const iso = (yy, mm) => new Date(Date.UTC(yy, mm - 1, 1)).toISOString().slice(0, 10);
  return { from: iso(y, m), to: iso(y, m + 1), trendFrom: iso(y, m - 5) };
}

/* ── 打一句話記帳 ── */
export function buildPrompt(text, today, account) {
  const WEEK = ["日", "一", "二", "三", "四", "五", "六"], wk = (d) => WEEK[new Date(d + "T00:00:00Z").getUTCDay()];
  const cal = [];
  for (let i = 0; i <= 13; i++) { const d = addDays(today, -i); cal.push(`${d}(週${wk(d)})`); }
  return (
    "你是記帳小幫手，把使用者的一句話整理成記帳紀錄。\n" +
    `支出分類只能用：${CATEGORIES.expense.map(([n]) => n).join("、")}。收入分類只能用：${CATEGORIES.income.map(([n]) => n).join("、")}。\n` +
    `帳戶只能用：${ACCOUNTS.join("、")}；沒講就填「${account}」。\n` +
    `今天是 ${today}（週${wk(today)}）。最近兩週的日期：${cal.join("、")}。「昨天、週三」要換成實際日期，沒講日期就是今天。\n` +
    "一句話可能有好幾筆，要拆開。金額一律新台幣整數，「兩千四」「2.4k」要換成 2400。" +
    "沒講金額的不要記，放進 missing 用一句話說明。跟記帳無關就回空陣列。\n" +
    "只回傳 JSON，不要說明文字、不要 markdown 圍欄。格式：" +
    '{"entries":[{"type":"expense或income","date":"YYYY-MM-DD","amount":整數,"category":"分類","account":"帳戶","note":"簡短說明"}],"missing":"沒講金額的項目，沒有就空字串"}\n' +
    "使用者說：" + String(text).slice(0, 500)
  );
}
/* 整理 AI 回的東西：分類不認得歸「其他」、日期不合理改今天（只收今天往前一年內）、金額不對的整筆不記。 */
export function normalizeParsed(parsed, today, account) {
  const list = parsed && Array.isArray(parsed.entries) ? parsed.entries : [];
  const oldest = addDays(today, -366), entries = [];
  for (const e of list.slice(0, 20)) {
    if (!e || (e.type !== "expense" && e.type !== "income")) continue;
    const amount = Math.round(Number(e.amount));
    if (!(amount > 0 && amount <= MAX_AMOUNT)) continue;
    const date = validDate(e.date) && e.date <= today && e.date >= oldest ? e.date : today;
    entries.push({
      type: e.type, amount, date,
      category: hasCat(e.type, e.category) ? e.category : FALLBACK[e.type],
      account: ACCOUNTS.includes(e.account) ? e.account : account,
      note: String(e.note || "").trim().slice(0, 200),
    });
  }
  return { entries, missing: String((parsed && parsed.missing) || "").slice(0, 200) };
}
