// 休閒四款的規則測試：node test/arcade.test.mjs
// 把 public/app_arcade.js 放進 vm 執行，只測上半部的純邏輯（ARC.*）與伺服器發幣規則。
import fs from "fs";
import vm from "vm";
import { ARCADE, arcadeCoins, validArcadeScore, settleArcade } from "../arcade_rules.js";

const src = fs.readFileSync(new URL("../public/app_arcade.js", import.meta.url), "utf8");
const sb = { console, Math, JSON, document: { getElementById: () => null } };
vm.createContext(sb);
vm.runInContext(src + "\nglobalThis.__ARC=ARC;", sb);
const ARC = sb.__ARC;

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
};
const seeded = (s) => () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
const ms = (fn) => { const t = Date.now(); fn(); return Date.now() - t; };

/* ---------- 方塊爆破 ---------- */
{
  const N = ARC.BN, g = Array(N * N).fill(0);
  const bar4 = [[0, 0], [0, 1], [0, 2], [0, 3]];
  eq("空盤放得下", ARC.blastFits(g, bar4, 0, 0), true);
  eq("超出右邊放不下", ARC.blastFits(g, bar4, 0, 5), false);
  const g2 = g.slice(); g2[2] = 1;
  eq("壓到東西放不下", ARC.blastFits(g2, bar4, 0, 0), false);
  // 排滿第 0 列：先放 4 格，再放 4 格
  let r = ARC.blastPlace(g, bar4, 0, 0, 1);
  eq("沒滿不會消", r.lines, 0);
  eq("得分＝格數", r.gained, 4);
  r = ARC.blastPlace(r.grid, bar4, 0, 4, 2);
  eq("排滿一列 → 消 1 條", r.rows, [0]);
  eq("那一列清空", r.grid.slice(0, N).every((x) => x === 0), true);
  eq("得分 4 格＋10", r.gained, 14);
  // 同時排滿一列和一行（十字），交叉格只清一次、算 2 條
  const cross = Array(N * N).fill(0);
  for (let j = 1; j < N; j++) cross[3 * N + j] = 1;   // 第 3 列缺第 0 格
  for (let i = 0; i < N; i++) if (i !== 3) cross[i * N] = 1;   // 第 0 行缺第 3 格
  r = ARC.blastPlace(cross, [[0, 0]], 3, 0, 4);
  eq("一格同時補滿一列一行 → 2 條", [r.rows, r.cols], [[3], [0]]);
  eq("一次消 2 條的得分（1＋10×2²）", r.gained, 41);
  eq("消完盤面全空", r.grid.every((x) => x === 0), true);
  // 無處可放 → 結束
  const full = Array(N * N).fill(1); full[0] = 0;
  eq("只剩一格、三塊都大於一格 → 結束", ARC.blastOver(full, [{ sh: bar4 }, { sh: [[0, 0], [1, 0]] }, null]), true);
  eq("有一塊是單格 → 還沒結束", ARC.blastOver(full, [{ sh: bar4 }, { sh: [[0, 0]] }, null]), false);
  eq("所有形狀都在 3×3～1×4 之內", ARC.SHAPES.every((s) => s.every(([a, b]) => a >= 0 && b >= 0 && a < 4 && b < 4)), true);
  const deal = ARC.blastDeal(seeded(1));
  eq("一次發 3 塊", deal.length, 3);
}

/* ---------- 倒水分類 ---------- */
{
  const ts = [[0, 1, 1], [1], []];
  eq("倒在同色上面可以", ARC.waterCanPour(ts, 0, 1), true);
  eq("倒進空杯可以", ARC.waterCanPour(ts, 0, 2), true);
  eq("顏色不同不行", ARC.waterCanPour([[0], [1]], 0, 1), false);
  eq("滿杯不行", ARC.waterCanPour([[0], [0, 0, 0, 0]], 0, 1), false);
  const out = ARC.waterPour(ts, 0, 1);
  eq("頂端同色的兩格一起倒過去", out, [[0], [1, 1, 1], []]);
  eq("原本的不會被改到", ts, [[0, 1, 1], [1], []]);
  eq("只倒得進剩下的空間", ARC.waterPour([[2, 2, 2], [2, 2, 2]], 0, 1), [[2, 2], [2, 2, 2, 2]]);
  eq("全部單色就算過關", ARC.waterSolved([[0, 0, 0, 0], [], [1, 1, 1, 1]]), true);
  eq("有混色不算", ARC.waterSolved([[0, 0, 0, 1], [1, 1, 1, 0]]), false);
  eq("沒裝滿不算", ARC.waterSolved([[0, 0], [0, 0]]), false);
  const r = seeded(9);
  let allOk = true, worst = 0;
  for (const colors of [3, 4, 5, 6, 7, 8]) for (let k = 0; k < 4; k++) {
    let t; const took = ms(() => { t = ARC.waterGen(colors, r); });
    worst = Math.max(worst, took);
    const counts = {}; t.flat().forEach((c) => (counts[c] = (counts[c] || 0) + 1));
    if (!Object.values(counts).every((n) => n === ARC.WCAP)) allOk = false;
    if (ARC.waterSolved(t) || !ARC.waterSolvable(t)) allOk = false;
  }
  eq("出的題目每色剛好 4 格、一開始沒解開、而且一定解得開（3～8 色各 4 題）", allOk, true);
  console.log(`      （出一題最久 ${worst} ms）`);
  eq("出題夠快，不會卡畫面（< 1.5 秒）", worst < 1500, true);
}

/* ---------- 貨架三消 ---------- */
{
  const st = [{ f: [0, 0, null], b: [[1, 1, 1]] }, { f: [0, 2, 2], b: [] }, { f: [2, null, null], b: [] }];
  eq("搬到有東西的格子不行", ARC.goodsMove(st, { s: 1, i: 0 }, { s: 0, i: 0 }).ok, false);
  let m = ARC.goodsMove(st, { s: 1, i: 0 }, { s: 0, i: 2 });
  eq("湊滿 3 個一樣 → 消掉", m.cleared, 1);
  eq("後面那層補上來", st[0].f, [1, 1, 1]);
  eq("後排用掉了", st[0].b.length, 0);
  m = ARC.goodsMove(st, { s: 2, i: 0 }, { s: 1, i: 0 });
  eq("消掉的那格貨架沒有後排 → 空出來", [m.cleared, st[1].f], [1, [null, null, null]]);
  eq("手動搬空不會讓後排補上來（空格數不能變少）", (() => {
    const s2 = [{ f: [3, null, null], b: [[4, 4, 4]] }, { f: [null, null, null], b: [] }];
    ARC.goodsMove(s2, { s: 0, i: 0 }, { s: 1, i: 0 });
    return s2[0].f;
  })(), [null, null, null]);
  const r = seeded(4);
  let ok = true, worst = 0;
  for (let level = 1; level <= 10; level++) for (let k = 0; k < 3; k++) {
    let g; const took = ms(() => { g = ARC.goodsGen(level, r); });
    worst = Math.max(worst, took);
    const counts = {}; g.forEach((sh) => { sh.f.forEach((x) => x != null && (counts[x] = (counts[x] || 0) + 1)); sh.b.flat().forEach((x) => (counts[x] = (counts[x] || 0) + 1)); });
    if (!Object.values(counts).every((n) => n % 3 === 0)) ok = false;
    if (!g.every((sh) => sh.b.every((l) => l.length === 3))) ok = false;
    if (g.some((sh) => sh.f[0] != null && sh.f.every((x) => x === sh.f[0]))) ok = false;
    if (g.flatMap((sh) => sh.f).filter((x) => x == null).length < 3) ok = false;
    if (!ARC.goodsSolvable(g)) ok = false;
  }
  eq("第 1～10 層：每種 3 的倍數、後排一層 3 個、一開始沒有現成的三連、至少 3 個空位、一定解得開", ok, true);
  console.log(`      （出一題最久 ${worst} ms）`);
  eq("出題夠快（< 1.5 秒）", worst < 1500, true);
  eq("第一層很簡單：沒有後排", ARC.goodsGen(1, seeded(2)).every((sh) => !sh.b.length), true);
}

/* ---------- 羊了個羊 ---------- */
{
  const tiles = [{ id: 1, t: 0, x: 0, y: 0, z: 0 }, { id: 2, t: 1, x: 1, y: 1, z: 1 }, { id: 3, t: 2, x: 4, y: 0, z: 0 }];
  eq("上層有重疊 → 被壓住", ARC.tileCovered(tiles, tiles[0]), true);
  eq("上層沒重疊 → 沒被壓", ARC.tileCovered(tiles, tiles[2]), false);
  eq("最上層的不會被壓", ARC.tileCovered(tiles, tiles[1]), false);
  const st = { tiles: [{ id: 1, t: 0, x: 0, y: 0, z: 0 }, { id: 2, t: 1, x: 2, y: 0, z: 0 }, { id: 3, t: 0, x: 4, y: 0, z: 0 }, { id: 4, t: 0, x: 6, y: 0, z: 0 }], tray: [] };
  ARC.tilePick(st, 1); ARC.tilePick(st, 2); ARC.tilePick(st, 3);
  eq("同種類排在一起", st.tray, [0, 0, 1]);
  const r = ARC.tilePick(st, 4);
  eq("湊滿 3 張 → 消掉", [r.matched, st.tray], [true, [1]]);
  eq("被壓住的點不到", ARC.tilePick({ tiles: [{ id: 1, t: 0, x: 0, y: 0, z: 0 }, { id: 2, t: 1, x: 0, y: 0, z: 1 }], tray: [] }, 1).ok, false);
  const lose = { tiles: [{ id: 9, t: 6, x: 0, y: 0, z: 0 }], tray: [0, 0, 1, 1, 2, 2] };
  eq("第 7 格放進去沒湊成 → 輸", ARC.tilePick(lose, 9).lose, true);
  const win = { tiles: [{ id: 9, t: 2, x: 0, y: 0, z: 0 }], tray: [2, 2] };
  eq("最後一張湊成 → 過關", ARC.tilePick(win, 9).win, true);
  let ok = true;
  for (let level = 1; level <= 15; level++) {
    const { types, copies } = ARC.tileLevelSpec(level);
    const g = ARC.tileGen(level, seeded(level));
    const counts = {}; g.forEach((t) => (counts[t.t] = (counts[t.t] || 0) + 1));
    if (g.length !== types * 3 * copies) ok = false;                    // 一張都不能掉
    if (!Object.values(counts).every((n) => n % 3 === 0)) ok = false;
    if (!g.every((t) => t.x >= 0 && t.y >= 0 && t.x + 2 <= ARC.TILE_W && t.y + 2 <= ARC.TILE_H)) ok = false;
    if (new Set(g.map((t) => `${t.x},${t.y},${t.z}`)).size !== g.length) ok = false;   // 不會疊在同一個位置
  }
  eq("第 1～15 關：牌數正確、每種 3 的倍數、都在盤面內、不重疊在同一點", ok, true);
  eq("第一關只有一層，全部看得到", ARC.tileGen(1, seeded(1)).every((t) => t.z === 0), true);
  const s3 = { tiles: ARC.tileGen(5, seeded(3)), tray: [] };
  const before = s3.tiles.map((t) => t.t).sort().join();
  ARC.tileShuffle(s3, seeded(8));
  eq("洗牌後每種的數量不變", s3.tiles.map((t) => t.t).sort().join(), before);
}

/* ---------- 發幣規則 ---------- */
{
  eq("四款都在", Object.keys(ARCADE), ["blast", "goods", "tile", "water"]);
  eq("每款 8～30 🦴", Object.values(ARCADE).every((g) => g.tiers.every(([, c]) => c >= 8 && c <= 30)), true);
  eq("門檻由高到低排（不然會先吃到低的）", Object.values(ARCADE).every((g) => g.tiers.every((t, i) => i === 0 || g.tiers[i - 1][0] > t[0])), true);
  eq("方塊爆破 0 分也有參加獎 8", arcadeCoins("blast", 0), 8);
  eq("方塊爆破 950 分 → 24", arcadeCoins("blast", 950), 24);
  eq("倒水過 8 關 → 30", arcadeCoins("water", 8), 30);
  eq("負分不合理", validArcadeScore("blast", -1), false);
  eq("小數不合理", validArcadeScore("tile", 2.5), false);
  eq("超過上限不合理", validArcadeScore("tile", 501), false);
  eq("不存在的遊戲", validArcadeScore("spin", 1), false);
  const T = "2026-10-27";
  let r = settleArcade("blast", 600, undefined, T);
  eq("今天第一次 → 發幣", [r.coins, r.already, r.rec], [18, false, { date: T, best: 600, coins: 18 }]);
  r = settleArcade("blast", 1600, r.rec, T);
  eq("同一天再玩 → 不發，但最佳成績會更新", [r.coins, r.already, r.rec.best, r.rec.coins], [0, true, 1600, 18]);
  r = settleArcade("blast", 100, { date: "2026-10-26", best: 9999, coins: 30 }, T);
  eq("隔天重新算", [r.coins, r.rec.best], [8, 100]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
