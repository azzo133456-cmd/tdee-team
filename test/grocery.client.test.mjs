// 買菜月結（zen）前端測試：node test/grocery.client.test.mjs
// 把 public/app.js 裡「買菜月結」那一段放進 vm，用假的 DOM 跑：
// 記飲食時順便記煮餐、進貨先記後補金額、收據辨識帶進表單、輸入框真的有被清空。
import fs from "fs";
import vm from "vm";

const src = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const a = src.indexOf("/* ---------- 買菜月結"), b = src.indexOf("/* ---------- 我的最愛");
if (a < 0 || b < 0) throw new Error("找不到買菜月結那一段");
const code = src.slice(a, b);

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
};

function makeWorld({ user = "zen", grocery = { buys: [], meals: [] }, receipt = null, confirmAns = true, parse = null } = {}) {
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, value: "", textContent: "", innerHTML: "", checked: false, style: {}, classList: { toggle() {} } });
  const puts = [], parseCalls = [];
  const sb = {
    console, JSON, Math, Date, Promise,
    session: { username: user }, store: { grocery },
    localStorage: { _m: { grocery_seeded_v1: "1" }, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); } },
    document: { getElementById: (id) => el(id), querySelectorAll: () => [], querySelector: () => null },
    alert: (m) => { sb.alerts.push(m); }, alerts: [], confirm: () => confirmAns,
    todayStr: () => "2026-10-27",
    compressImg: async () => "data:image/jpeg;base64,xx",
    api: async (path, opts) => {
      if (path === "/api/grocery") { puts.push(JSON.parse(opts.body)); return { ok: true }; }
      if (path === "/api/grocery/parse") { parseCalls.push(JSON.parse(opts.body)); if (!parse) throw new Error("AI 服務錯誤"); return JSON.parse(JSON.stringify(parse)); }
      if (path === "/api/receipt") { if (!receipt) throw new Error("辨識服務錯誤"); return receipt; }
      throw new Error("unexpected " + path);
    },
  };
  sb.escapeHtml = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  sb.val = (id) => el(id).value;
  sb.set = (id, t) => { el(id).textContent = t; };
  sb.setv = (id, v) => { el(id).value = v; };
  vm.createContext(sb);
  vm.runInContext(code, sb);
  return { sb, els, el, puts, parseCalls, g: () => sb.store.grocery };
}

/* ---------- 記飲食時順便記煮餐 ---------- */
{
  const w = makeWorld();
  w.el("cookChk").checked = true; w.el("cookPeople").value = "3";
  w.sb.logCookedMeal("2026-10-27", "午餐");
  eq("記一餐：日期、餐別、人數", w.g().meals.map((x) => [x.date, x.note, x.people]), [["2026-10-27", "午餐", 3]]);
  eq("有存到伺服器", w.puts.length, 1);
  eq("平日會提示公司補給", w.el("cookMsg").textContent.includes("公司補給 +$300"), true);
  w.sb.logCookedMeal("2026-10-27", "午餐");
  eq("同一天同一餐不重複記", w.g().meals.length, 1);
  w.el("cookPeople").value = "2";
  w.sb.logCookedMeal("2026-10-27", "午餐");
  eq("人數改了就更新那一筆", [w.g().meals.length, w.g().meals[0].people], [1, 2]);
  w.sb.logCookedMeal("2026-10-27", "晚餐");
  eq("同一天的晚餐是另一餐", w.g().meals.length, 2);
  w.sb.logCookedMeal("2026-10-25", "午餐");
  eq("週末不提補給", w.el("cookMsg").textContent.includes("公司補給"), false);
  w.sb.saveCookPref();
  eq("勾選狀態與人數記在這台裝置", JSON.parse(w.sb.localStorage.getItem("cookPref")), { on: true, people: 2 });
}
{
  const w = makeWorld();
  w.sb.localStorage.setItem("cookPref", JSON.stringify({ on: true, people: 4 }));
  w.sb.applyGroceryVisibility();
  eq("zen：顯示煮餐勾選、帶入上次的設定", [w.el("cookRow").style.display, w.el("cookChk").checked, w.el("cookPeople").value], ["", true, 4]);
  const o = makeWorld({ user: "amy" });
  o.sb.applyGroceryVisibility();
  eq("其他人看不到", o.el("cookRow").style.display, "none");
}

/* ---------- 進貨：先記、之後補金額 ---------- */
{
  const w = makeWorld();
  w.el("gBuyDate").value = "2026-10-26"; w.el("gBuyNote").value = "雞腿8kg、四季豆3包";
  w.sb.addGBuy();
  const b = w.g().buys[0];
  eq("沒填金額 → 確認後先記下來（待補）", [w.g().buys.length, b.amount, b.pending, b.note], [1, 0, true, "雞腿8kg、四季豆3包"]);
  eq("加完之後輸入框真的清空了", [w.el("gBuyNote").value, w.el("gBuyAmount").value], ["", ""]);
  eq("待補清單出現這一筆", w.el("gPendingBox").innerHTML.includes("待補金額（1）") && w.el("gPendingBox").innerHTML.includes("雞腿8kg"), true);
  eq("總表提醒還有沒填的", w.el("gSummaryBox").innerHTML.includes("還有 1 筆進貨沒填金額"), true);
  eq("明細顯示「待補」", w.el("gDetailBox").innerHTML.includes("待補"), true);
  w.el("gPend-" + b.id).value = "2465";
  w.sb.fillGBuy(b.id);
  eq("補上金額：不再是待補", [b.amount, b.pending, w.el("gPendingBox").innerHTML], [2465, undefined, ""]);
  eq("總表算進去了", w.el("gSummaryBox").innerHTML.includes("$2,465"), true);
  w.sb.renderGrocery();
  eq("明細金額有 $ 符號", w.el("gDetailBox").innerHTML.includes("$2,465"), true);
  eq("存到伺服器的資料沒有 pending 了", w.puts.at(-1).buys[0].pending, undefined);
  w.sb.addGBuy();
  eq("金額和品項都沒填 → 不能加", [w.g().buys.length, w.sb.alerts.at(-1).includes("至少寫買了什麼")], [1, true]);
  const n = makeWorld({ confirmAns: false });
  n.el("gBuyNote").value = "蒜泥";
  n.sb.addGBuy();
  eq("不想先記就取消", n.g().buys.length, 0);
  const d = makeWorld();
  d.sb.renderGrocery();
  eq("日期預設今天（原本 set() 對輸入框沒作用）", [d.el("gBuyDate").value, d.el("gMealDate").value, d.el("gSetDate").value], ["2026-10-27", "2026-10-27", "2026-10-27"]);
}

/* ---------- 收據／截圖辨識 ---------- */
{
  const w = makeWorld({ receipt: { ok: true, date: "2026-10-25", amount: 1252, items: "蝦仁907g、橄欖油1L", store: "好市多" } });
  const ev = { target: { files: [{}], value: "x" } };
  await w.sb.onReceiptPick(ev);
  eq("讀到的日期、金額、品項帶進表單", [w.el("gBuyDate").value, w.el("gBuyAmount").value, w.el("gBuyNote").value], ["2026-10-25", "1252", "好市多：蝦仁907g、橄欖油1L"]);
  eq("提示確認後再加入", w.el("gReceiptMsg").innerHTML.includes("$1,252"), true);
  eq("選檔欄位清空（同一張可以再選一次）", ev.target.value, "");
  eq("還沒按加入就不會存", w.g().buys.length, 0);
  w.sb.addGBuy();
  eq("按加入才存", w.g().buys.map((x) => [x.date, x.amount]), [["2026-10-25", 1252]]);
  const z = makeWorld({ receipt: { ok: true, date: "", amount: 0, items: "雞蛋", store: "" } });
  await z.sb.onReceiptPick({ target: { files: [{}], value: "" } });
  eq("讀不到金額：品項先帶、提示可以先記", [z.el("gBuyNote").value, z.el("gReceiptMsg").innerHTML.includes("讀不到金額")], ["雞蛋", true]);
  const f = makeWorld();
  await f.sb.onReceiptPick({ target: { files: [{}], value: "" } });
  eq("辨識失敗有訊息", f.el("gReceiptMsg").textContent.includes("辨識失敗"), true);
}

/* ---------- 對話記帳 ---------- */
{
  const parsed = { entries: [
    { type: "buy", date: "2026-10-27", note: "全聯：雞腿8kg", amount: 2465 },
    { type: "meal", date: "2026-10-26", note: "午餐", people: 3 },
    { type: "extra", date: "2026-10-27", note: "<b>聚餐</b>", amount: 0, pending: true },
  ], reply: "好" };
  const w = makeWorld({ grocery: { buys: [], meals: [{ id: "old", date: "2026-10-25", note: "晚餐", people: 2 }] }, parse: parsed });
  w.el("gChatText").value = "今天全聯雞腿2465，昨天午餐煮3人，還有聚餐";
  await w.sb.gChatSend();
  const g = w.g();
  eq("一句話拆成三筆、加進對的地方", [g.buys.length, g.meals.length, g.extras.length], [1, 2, 1]);
  eq("送給 AI 的是這句話", w.parseCalls[0].text, "今天全聯雞腿2465，昨天午餐煮3人，還有聚餐");
  eq("沒金額的外食 → 待補", g.extras[0].pending, true);
  eq("有存到伺服器", w.puts.length >= 1, true);
  eq("輸入框清空", w.el("gChatText").value, "");
  const log = w.el("gChatLog").innerHTML;
  eq("對話裡列出記了什麼、有復原鈕", [log.includes("$2,465"), log.includes("10/26 午餐・3 人份"), log.includes("gChatUndo")], [true, true, true]);
  eq("AI 回的文字會跳脫，不會變成 HTML", log.includes("&lt;b&gt;聚餐"), true);
  const batch = vm.runInContext("gChatLog", w.sb).find((m) => m.batch).batch;
  w.sb.gChatUndo(batch);
  eq("復原：這一批全部拿掉，舊的還在", [g.buys.length, g.meals.map((x) => x.id), g.extras.length], [0, ["old"], 0]);
  eq("對話標示已復原", w.el("gChatLog").innerHTML.includes("已復原"), true);
}
{
  const w = makeWorld({ grocery: { buys: [], meals: [{ id: "m1", date: "2026-10-26", note: "午餐", people: 2 }] },
    parse: { entries: [{ type: "meal", date: "2026-10-26", note: "午餐", people: 2 }] } });
  w.el("gChatText").value = "昨天午餐自己煮";
  await w.sb.gChatSend();
  eq("同一天同一餐已經記過 → 略過並告知", [w.g().meals.length, w.el("gChatLog").innerHTML.includes("已經記過")], [1, true]);
  const n = makeWorld({ parse: { entries: [], reply: "今天天氣不錯" } });
  n.el("gChatText").value = "你好";
  await n.sb.gChatSend();
  eq("跟記帳無關 → 不記、回一句話", [n.g().buys.length, n.el("gChatLog").innerHTML.includes("今天天氣不錯")], [0, true]);
  const e = makeWorld({ parse: null });
  e.el("gChatText").value = "買菜 300";
  await e.sb.gChatSend();
  eq("AI 失敗 → 顯示錯誤、什麼都不記", [e.el("gChatLog").innerHTML.includes("⚠️"), e.g().buys.length], [true, 0]);
  const b = makeWorld();
  await b.sb.gChatSend();
  eq("空白不送", b.parseCalls.length, 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
