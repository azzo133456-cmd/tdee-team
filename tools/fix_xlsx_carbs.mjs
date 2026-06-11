import fs from "fs";
const file = "public/foods_xlsx.js";
let txt = fs.readFileSync(file, "utf8");
globalThis.window = {};
(0, eval)(txt.replace(/window\./g, "globalThis.window."));
const o = globalThis.window.FOODS_XLSX;
const drink = /可樂|汽水|七喜|雪碧|紅茶|綠茶|奶茶|咖啡|果汁|檸檬|飲|拿鐵|多多|養樂多|冰沙|思樂冰/;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fixes = [];
for (const name in o) {
  const a = o[name];
  if (!Array.isArray(a) || a.length < 4) continue;
  const [k, p, f, c, ...rest] = a.map(Number);
  const macro = 4 * p + 9 * f + 4 * c;
  const diff = macro - k;
  if (diff < -40 && Math.abs(diff) > k * 0.18) {
    let nc = null;
    if (p > 0 || f > 0) nc = Math.round((k - 4 * p - 9 * f) / 4 * 10) / 10; // 只缺碳水→反推
    else if (drink.test(name)) nc = Math.round(k / 4 * 10) / 10;            // 飲料→全碳水
    if (nc != null && nc > 0) {
      const newArr = [k, p, f, nc, ...rest].map((x) => (Number.isFinite(x) ? x : 0));
      const re = new RegExp("(\"" + esc(name) + "\"\\s*:\\s*\\[)([^\\]]*)(\\])");
      if (re.test(txt)) { txt = txt.replace(re, "$1" + newArr.join(",") + "$3"); fixes.push({ name, from: c, to: nc, k, p, f }); }
    }
  }
}
fs.writeFileSync(file, txt);
console.log("已修正", fixes.length, "筆（反推缺漏碳水）：");
for (const x of fixes) console.log(`  ${x.name}: 碳水 ${x.from} → ${x.to}  (熱${x.k}/蛋${x.p}/脂${x.f})`);
