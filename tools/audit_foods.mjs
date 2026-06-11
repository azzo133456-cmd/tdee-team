// 食物資料稽核：揪出「熱量 vs 三大營養素」對不上的條目，以及跨檔重複。
// 用法：node tools/audit_foods.mjs
import fs from "fs";
const dir = "public";
globalThis.window = {};
for (const f of fs.readdirSync(dir).filter((f) => /^foods_.*\.js$/.test(f))) {
  try { (0, eval)(fs.readFileSync(`${dir}/${f}`, "utf8").replace(/window\./g, "globalThis.window.")); }
  catch (e) { console.log("skip", f, e.message); }
}
const packs = Object.keys(globalThis.window).filter((k) => /^FOODS/.test(k));
let total = 0; const suspect = [], seen = {}, dups = [];
for (const pk of packs) {
  const o = globalThis.window[pk];
  if (pk === "FOODS_5050" || !o || typeof o !== "object") continue;
  for (const name in o) {
    if (seen[name]) dups.push({ name, packs: [seen[name], pk] }); else seen[name] = pk;
    const a = o[name];
    if (!Array.isArray(a) || a.length < 4) continue;
    const [k, p, f, c] = a.map(Number);
    if ([k, p, f, c].some((x) => isNaN(x))) continue;
    total++;
    const macro = 4 * p + 9 * f + 4 * c, diff = macro - k;
    // 跳過「正常落差」：高纖(海苔/乾貨,算出>標示) 與 酒精(標示>算出,酒精另含熱量)
    const fiberish = /苔|海帶|乾|干$|菇|藻/.test(name);
    const alcohol = /酒|啤|威士忌|高粱|清酒|紹興/.test(name);
    if (Math.abs(diff) > 40 && Math.abs(diff) > k * 0.18 && !(diff > 0 && fiberish) && !(diff < 0 && alcohol))
      suspect.push({ pk, name, k, macro: Math.round(macro), diff: Math.round(diff), p, f, c });
  }
}
console.log(`檢查 ${total} 筆；可疑 ${suspect.length} 筆；跨檔重複 ${dups.length} 筆\n`);
suspect.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
for (const s of suspect) console.log(`  [${s.pk}] ${s.name}  標示${s.k} vs 算出${s.macro} (差${s.diff > 0 ? "+" : ""}${s.diff})  P${s.p}/F${s.f}/C${s.c}`);
if (dups.length) { console.log("\n跨檔重複："); for (const d of dups) console.log(`  ${d.name}  (${d.packs.join(" / ")})`); }
