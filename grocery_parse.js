/* ---------- 買菜月結：對話記帳 ----------
   zen 在月結頁的對話欄打一句話（「今天全聯買雞腿8kg 2465」「昨天午餐自己煮3人」），
   AI 把它拆成幾筆紀錄，前端直接加進月結。這裡放「給 AI 的指示」和「把 AI 回的東西整理成安全的紀錄」，
   後者是純函式，test/grocery.parse.test.mjs 直接測，不用真的打 AI。 */

export const TYPES = ["buy", "meal", "extra", "settle"];
const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function buildPrompt(text, today, defaultPeople) {
  const wd = WEEK[new Date(today + "T00:00:00Z").getUTCDay()];
  // 附上最近兩週的日期對照，「上週三」「前天」這類說法 AI 比較不會算錯
  const cal = [];
  for (let i = 0; i <= 13; i++) { const d = addDays(today, -i); cal.push(`${d}(週${WEEK[new Date(d + "T00:00:00Z").getUTCDay()]})`); }
  return (
    "你是記帳小幫手，幫使用者把一句話整理成「買菜月結」的紀錄。紀錄有四種：\n" +
    "- buy 進貨：買菜、買食材、買調味料（要金額；品項寫在 note，例如「雞腿8kg、四季豆3包」，有店名就加在前面「全聯：…」）\n" +
    "- meal 煮餐：自己煮了一餐（不需要金額；note 寫早餐／午餐／晚餐／一餐；people 是幾人份）\n" +
    "- extra 外食：在外面吃、叫外送、聚餐（要金額；note 寫簡短說明）\n" +
    "- settle 申請補給：向公司申請、領到的伙食補給現金（要金額）\n" +
    `今天是 ${today}（週${wd}）。最近兩週的日期：${cal.join("、")}。\n` +
    "「今天、昨天、前天、週一、上週三」都要換成上面的實際日期；沒講日期就是今天。" +
    "一句話可能有好幾筆（例如「週一到週三午餐都自己煮」是三筆煮餐），要拆開。" +
    `煮餐沒講人數就填 ${defaultPeople}。金額一律新台幣整數；講「兩千四」「2.4k」要換成 2400。` +
    "沒講金額的進貨／外食／補給，amount 填 0（之後再補）。跟記帳無關的話就回空陣列。\n" +
    "只回傳 JSON，不要說明文字、不要 markdown 圍欄。格式：" +
    '{"entries":[{"type":"buy|meal|extra|settle","date":"YYYY-MM-DD","amount":整數,"note":"說明","people":整數}],"reply":"一句簡短的中文回覆"}\n' +
    "使用者說：" + String(text).slice(0, 500)
  );
}

/* 把 AI 回的東西整理成可以直接存的紀錄：型別不對、日期不合理、金額怪的都修掉或丟掉。
   日期只接受今天往前 60 天內（記帳是補記過去，不會記未來）。 */
export function normalize(parsed, today, defaultPeople = 2) {
  const list = parsed && Array.isArray(parsed.entries) ? parsed.entries : Array.isArray(parsed) ? parsed : [];
  const oldest = addDays(today, -60);
  const out = [];
  for (const e of list.slice(0, 20)) {
    if (!e || !TYPES.includes(e.type)) continue;
    let date = /^\d{4}-\d{2}-\d{2}$/.test(String(e.date || "")) ? String(e.date) : today;
    if (date > today || date < oldest) date = today;
    const amount = Math.max(0, Math.min(200000, Math.round(+e.amount || 0)));
    const note = String(e.note || "").trim().slice(0, e.type === "meal" ? 120 : 300);
    if (e.type === "meal") {
      const people = Math.max(1, Math.min(50, Math.round(+e.people || defaultPeople)));
      out.push({ type: "meal", date, note: note || "一餐", people });
    } else {
      if (!amount && !note) continue;                     // 什麼都沒有的進貨／外食不記
      if (e.type === "settle" && !amount) continue;        // 補給一定要有金額
      const r = { type: e.type, date, note, amount };
      if (!amount) r.pending = true;                       // 先記下來、金額之後補
      out.push(r);
    }
  }
  return { entries: out, reply: String((parsed && parsed.reply) || "").slice(0, 200) };
}
