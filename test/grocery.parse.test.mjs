// 對話記帳：把 AI 回的東西整理成紀錄。node test/grocery.parse.test.mjs
import { normalize, buildPrompt } from "../grocery_parse.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
};
const T = "2026-10-29";

{
  const r = normalize({ entries: [
    { type: "buy", date: "2026-10-29", amount: 2465, note: "全聯：雞腿8kg、四季豆3包" },
    { type: "meal", date: "2026-10-28", note: "午餐", people: 3 },
    { type: "extra", date: "2026-10-27", amount: 850.4, note: "聚餐" },
    { type: "settle", date: "2026-10-29", amount: 2000, note: "10月申請" },
  ], reply: "好的" }, T);
  eq("四種紀錄都整理好", r.entries, [
    { type: "buy", date: "2026-10-29", note: "全聯：雞腿8kg、四季豆3包", amount: 2465 },
    { type: "meal", date: "2026-10-28", note: "午餐", people: 3 },
    { type: "extra", date: "2026-10-27", note: "聚餐", amount: 850 },
    { type: "settle", date: "2026-10-29", note: "10月申請", amount: 2000 },
  ]);
  eq("回覆保留", r.reply, "好的");
}
{
  const r = normalize({ entries: [{ type: "buy", date: "2026-10-29", amount: 0, note: "蒜泥3罐" }] }, T);
  eq("沒金額的進貨 → 待補", r.entries[0], { type: "buy", date: "2026-10-29", note: "蒜泥3罐", amount: 0, pending: true });
  eq("沒金額也沒品項 → 不記", normalize({ entries: [{ type: "buy", amount: 0, note: "" }] }, T).entries, []);
  eq("補給沒金額 → 不記", normalize({ entries: [{ type: "settle", amount: 0, note: "申請" }] }, T).entries, []);
}
{
  const meal = (e) => normalize({ entries: [e] }, T, 2).entries[0];
  eq("煮餐沒講人數 → 用預設", meal({ type: "meal", date: T, note: "晚餐" }).people, 2);
  eq("煮餐沒備註 → 一餐", meal({ type: "meal", date: T }).note, "一餐");
  eq("人數上限 50", meal({ type: "meal", date: T, people: 999 }).people, 50);
  eq("未來的日期 → 改成今天", meal({ type: "meal", date: "2026-11-05" }).date, T);
  eq("太久以前（60 天外）→ 改成今天", meal({ type: "meal", date: "2026-01-01" }).date, T);
  eq("日期格式不對 → 今天", meal({ type: "meal", date: "昨天" }).date, T);
}
{
  eq("不認得的類型丟掉", normalize({ entries: [{ type: "salary", amount: 9 }, null, "x"] }, T).entries, []);
  eq("AI 直接回陣列也接受", normalize([{ type: "meal", date: T, note: "午餐" }], T).entries.length, 1);
  eq("亂七八糟的回應 → 空", normalize("hello", T).entries, []);
  eq("負的金額當 0", normalize({ entries: [{ type: "extra", amount: -50, note: "x" }] }, T).entries[0].amount, 0);
  eq("一次最多 20 筆", normalize({ entries: Array(30).fill({ type: "meal", date: T }) }, T).entries.length, 20);
}
{
  const p = buildPrompt("昨天午餐自己煮", T, 3);
  eq("提示裡有今天與星期", p.includes("今天是 2026-10-29（週四）"), true);
  eq("提示裡有兩週的日期對照", p.includes("2026-10-16(週五)"), true);
  eq("煮餐預設人數帶進去", p.includes("煮餐沒講人數就填 3"), true);
  eq("使用者的話在最後", p.endsWith("使用者說：昨天午餐自己煮"), true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
