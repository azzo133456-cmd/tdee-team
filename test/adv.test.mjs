// 合成冒險規則測試：node test/adv.test.mjs
import * as A from "../adv_logic.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
};
const T = "2026-10-27", NOW = Date.UTC(2026, 9, 27, 4);
const empty = () => Array(A.CELLS).fill(null);

/* ---------- 資料 ---------- */
{
  eq("棋盤 6×5", A.CELLS, 30);
  eq("三條鏈對應三個裝備欄位", A.DATA.chains.map((c) => c.slot), ["武器", "防具", "飾品"]);
  eq("每條鏈 10 階", A.DATA.chains.every((c) => c.items.length === A.MAX_TIER), true);
  eq("數值表 11 格（含沒裝備）且越高階越強", ["atk", "hp", "crit"].every((k) => A.DATA.gear[k].length === 11 && A.DATA.gear[k].every((v, i, a) => i === 0 || v > a[i - 1])), true);
  // Emoji 13 以後的字元在 Windows 10 會變方框
  const bad = [];
  const ok12 = new Set([0x1fa70, 0x1fa71, 0x1fa72, 0x1fa73, 0x1fa78, 0x1fa79, 0x1fa7a, 0x1fa80, 0x1fa81, 0x1fa82, 0x1fa90, 0x1fa91, 0x1fa92, 0x1fa93, 0x1fa94, 0x1fa95]);
  for (const ch of JSON.stringify(A.DATA)) { const c = ch.codePointAt(0); if (c >= 0x1fa70 && c <= 0x1faff && !ok12.has(c)) bad.push(ch); }
  eq("沒有 Emoji 13 以後的字元", bad, []);
}

/* ---------- 新存檔與舊存檔轉換 ---------- */
{
  const st = A.newState(NOW);
  eq("新存檔：30 能量、第 1 關、Lv1、沒裝備", [st.energy, st.stage, st.level, st.equip], [30, 1, 1, [0, 0, 0]]);
  const old = { energy: 12, board: [[0, 3], [3, 5], null, [9, 9], "x"], granted: { [T]: ["logged"] }, regenAt: 5 };
  const m = A.migrateFromMerge(old, NOW);
  eq("合成小屋的棋盤退成能量（3 階 4 點 + 5 階 16 點，不合法的不算）", [m.refund, m.st.energy], [20, 32]);
  eq("已領過的健康能量沿用（不會再發一次）", m.st.granted, { [T]: ["logged"] });
  eq("能量退回最多到上限", A.migrateFromMerge({ energy: 140, board: [[0, 7], [0, 7]] }, NOW).st.energy, A.ENERGY_MAX);
  eq("沒有舊存檔 → 新存檔", A.migrateFromMerge(undefined, NOW).refund, 0);
}

/* ---------- 健康能量與回復 ---------- */
{
  const st = A.newState(NOW); st.energy = 0;
  const g = A.grantHealth(st, [{ date: T, logged: 1, kcal_hit: 1, protein_hit: 1 }, { date: A.prevDay(T), kcal_hit: 1 }], T);
  eq("今天兩項 + 昨天熱量達標 → 30（今天的熱量隔天才發）", [st.energy, g.length], [30, 3]);
  A.grantHealth(st, [{ date: T, logged: 1, protein_hit: 1 }], T);
  eq("同一項不會發兩次", st.energy, 30);
  const r = A.newState(NOW); r.energy = 5; r.regenAt = NOW;
  A.regen(r, NOW + 35 * 60 * 1000);
  eq("35 分鐘回 3 點", r.energy, 8);
}

/* ---------- 同步與總價值檢查 ---------- */
{
  const st = A.newState(NOW);
  const b = empty(); b[0] = [0, 1]; b[1] = [0, 1];
  A.applySync(st, { board: b, equip: [0, 0, 0], spent: 2 });
  eq("產生兩件：扣 2 能量、價值 2", [st.energy, st.value], [28, 2]);
  const b2 = empty(); b2[1] = [0, 2];
  A.applySync(st, { board: b2, equip: [0, 0, 0], spent: 0 });
  eq("合成不改變價值", st.value, 2);
  A.applySync(st, { board: empty(), equip: [2, 0, 0], spent: 0 });
  eq("穿上裝備，價值算在裝備上", [st.equip, st.value], [[2, 0, 0], 2]);
  let err = "";
  try { A.applySync(st, { board: empty(), equip: [9, 0, 0], spent: 1 }); } catch (e) { err = e.message; }
  eq("憑空變出 9 階 → 拒收", err.includes("對不起來"), true);
  eq("拒收時什麼都沒改", [st.energy, st.equip], [28, [2, 0, 0]]);
  const b3 = empty(); b3[0] = [1, 2];
  A.applySync(st, { board: b3, equip: [2, 0, 0], spent: 1 });
  eq("花 1 點直接掉 2 階（15% 機率）是允許的", st.value, 4);
  err = ""; try { A.applySync(st, { board: Array(29).fill(null), equip: [0, 0, 0], spent: 0 }); } catch (e) { err = e.message; }
  eq("棋盤格數不對 → 拒收", err, "棋盤資料不正確");
  err = ""; try { A.applySync(st, { board: empty(), equip: [11, 0, 0], spent: 0 }); } catch (e) { err = e.message; }
  eq("超過 10 階 → 拒收", err, "裝備資料不正確");
  const poor = A.newState(NOW); poor.energy = 1;
  const b4 = empty(); b4[0] = [0, 1]; b4[1] = [0, 1];
  err = ""; try { A.applySync(poor, { board: b4, equip: [0, 0, 0], spent: 2 }); } catch (e) { err = e.message; }
  eq("能量只有 1 卻說花了 2 → 只能換 1～2 點價值，這裡剛好 2 → 允許", [err, poor.energy], ["", 0]);
}

/* ---------- 角色與怪物 ---------- */
{
  const st = A.newState(NOW);
  eq("Lv1 空手：攻 8 血 60", A.heroStats(st), { atk: 8, hp: 60, crit: 0 });
  st.equip = [5, 5, 4]; st.level = 6;
  eq("裝備 5/5/4、Lv6：攻擊與血量 ×1.2", A.heroStats(st), { atk: Math.round(25 * 1.2), hp: Math.round(164 * 1.2), crit: 0.2 });
  eq("第 1 關是森林的大老鼠", [A.monster(1).name, A.monster(1).region, A.monster(1).hp, A.monster(1).atk], ["大老鼠", "迷霧森林", 40, 6]);
  eq("第 10 關是頭目", [A.monster(10).boss, A.monster(10).name], [true, "野豬王"]);
  eq("第 11 關換到洞窟", A.monster(11).region, "幽暗洞窟");
  eq("第 51 關進入第 2 輪", A.monster(51).region, "迷霧森林（第 2 輪）");
  eq("怪物越後面越強", [2, 9, 20, 49, 80].every((s) => A.monster(s).hp > A.monster(s - 1).hp || A.monster(s - 1).boss), true);
}

/* ---------- 戰鬥 ---------- */
{
  const b = A.battle({ atk: 10, hp: 30, crit: 0 }, { hp: 25, atk: 12 });
  eq("寵物先攻，3 下打倒（怪物打了 2 下）", [b.win, b.events.length, b.events.map((e) => e[0]).join("")], [true, 5, "hmhmh"]);
  eq("血量不會變負", b.events.at(-1)[3], 0);
  const lose = A.battle({ atk: 1, hp: 10, crit: 0 }, { hp: 100, atk: 6 });
  eq("打不過 → 輸", [lose.win, lose.events.at(-1)], [false, ["m", 6, false, 0]]);
  const c = A.battle({ atk: 10, hp: 999, crit: 0.5 }, { hp: 1000, atk: 1 });
  eq("暴擊 50% → 每兩下爆一次（傷害 ×2）", c.events.filter((e) => e[0] === "h").slice(0, 4).map((e) => e[1]), [10, 20, 10, 20]);
  const stall = A.battle({ atk: 1, hp: 9999, crit: 0 }, { hp: 9999, atk: 1 });
  eq("打 40 回合沒結果 → 算輸", [stall.win, stall.events.length], [false, 80]);
  const h = { atk: 7, hp: 50, crit: 0.1 }, m = { hp: 60, atk: 9 };
  eq("同樣的條件結果永遠一樣", JSON.stringify(A.battle(h, m)) === JSON.stringify(A.battle(h, m)), true);
}

/* ---------- 打怪：經驗、骨頭幣、掉落 ---------- */
{
  const st = A.newState(NOW);
  const r = A.fight(st, T, () => 0.5);
  eq("Lv1 空手打得贏第 1 關", r.win, true);
  eq("前進到第 2 關、經驗 7、🦴3", [st.stage, st.xp, r.coins], [2, 7, 3]);
  eq("掉落一件 1 階防具，並記成額度", [r.drop, st.credit], [[1, 1], 1]);
  const b = empty(); b[0] = [1, 1];
  A.applySync(st, { board: b, equip: [0, 0, 0], spent: 0 });
  eq("掉落物放進背包可以存檔，額度用掉", [st.value, st.credit], [1, 0]);
  st.stage = 30;
  const l = A.fight(st, T);
  eq("空手打第 30 關 → 輸，什麼都沒拿", [l.win, st.stage, l.coins, l.drop, st.credit], [false, 30, 0, null, 0]);
  const rich = A.newState(NOW); rich.equip = [10, 10, 10]; rich.coinToday = 38; rich.coinDay = T; rich.stage = 10;
  const bo = A.fight(rich, T);
  eq("頭目 🦴15，但每日封頂 40 → 只拿 2", [bo.win, bo.coins, bo.capped], [true, 2, true]);
  const nx = A.fight(rich, "2026-10-28");
  eq("隔天封頂重算", nx.coins, 3);
  const dropTier = (stage) => { const s = A.newState(NOW); s.equip = [10, 10, 10]; s.level = 200; s.stage = stage; return A.fight(s, T).drop[1]; };
  eq("越後面掉的越高階（第 1／15／25／79 關，最多 4 階）", [1, 15, 25, 79].map(dropTier), [1, 2, 3, 4]);
}

/* ---------- 升等與訓練 ---------- */
{
  const st = A.newState(NOW);
  eq("Lv1 → 2 要 45 經驗", A.needXp(1), 45);
  eq("一次給很多會連升", [A.addXp(st, 45 + 60 + 10), st.level, st.xp], [2, 3, 10]);
  st.energy = 7; st.stage = 12;
  const r = A.train(st);
  eq("訓練：花 5 能量，經驗 8+關卡數", [st.energy, r.xp], [2, 20]);
  let err = ""; try { A.train(st); } catch (e) { err = e.message; }
  eq("能量不夠不能訓練", err.includes("能量不夠"), true);
}

/* ---------- 平衡：模擬每天 60 能量的玩家 ---------- */
{
  const play = (perDay, days) => {
    const st = A.newState(NOW); let pool = 20; const val = [0, 0, 0];
    for (let d = 0; d < days; d++) {
      pool += perDay;
      for (;;) {
        const i = [0, 1, 2].sort((a, b) => st.equip[a] - st.equip[b])[0], nt = st.equip[i] + 1;
        if (nt > A.MAX_TIER) break;
        const cost = 2 ** (nt - 1) - val[i];
        if (cost <= pool) { pool -= cost; val[i] = 2 ** (nt - 1); st.equip[i] = nt; } else { val[i] += pool; pool = 0; break; }
      }
      if (st.equip.every((t) => t >= A.MAX_TIER)) { st.energy = pool; while (st.energy >= A.TRAIN_COST) A.train(st); pool = st.energy; }
      while (A.fight(st, T).win);
    }
    return st.stage;
  };
  const d1 = play(60, 1), d7 = play(60, 7), d30 = play(60, 30), d90 = play(60, 90);
  console.log(`      （每天 60 能量：第 1 天到第 ${d1} 關、第 7 天 ${d7}、第 30 天 ${d30}、第 90 天 ${d90}）`);
  eq("第一天推得動、但不會一天打完", d1 >= 8 && d1 <= 30, true);
  eq("一個月後還在推進", d30 > d7, true);
  eq("裝備做滿後靠訓練還能繼續往前", d90 > d30, true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
