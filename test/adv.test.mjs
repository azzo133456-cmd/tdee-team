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
  eq("Lv1 空手：攻 8 血 60", A.heroStats(st), { atk: 8, hp: 60, crit: 0, skills: [], potions: 0 });
  st.equip = [5, 5, 4]; st.level = 6;
  eq("裝備 5/5/4、Lv6：攻擊與血量 ×1.2", A.heroStats(st), { atk: Math.round(25 * 1.2), hp: Math.round(164 * 1.2), crit: 0.2, skills: [], potions: 0 });
  eq("第 1 關是森林的大老鼠", [A.monster(1).name, A.monster(1).region, A.monster(1).hp, A.monster(1).atk], ["大老鼠", "迷霧森林", 40, 6]);
  eq("第 10 關是頭目", [A.monster(10).boss, A.monster(10).name], [true, "野豬王"]);
  eq("第 11 關換到洞窟", A.monster(11).region, "幽暗洞窟");
  eq("八個區域打完（第 81 關）進入第 2 輪", A.monster(81).region, "迷霧森林（第 2 輪）");
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
  eq("前進到第 2 關、經驗 7、🦴3＋第一次打倒大老鼠 🦴5", [st.stage, st.xp, r.coins, r.dexNew], [2, 7, 8, true]);
  eq("記進圖鑑", st.dex, { 大老鼠: [1, 0] });
  eq("掉落一件 1 階防具，並記成額度", [r.drop, st.credit], [[1, 1], 1]);
  const b = empty(); b[0] = [1, 1];
  A.applySync(st, { board: b, equip: [0, 0, 0], spent: 0 });
  eq("掉落物放進背包可以存檔，額度用掉", [st.value, st.credit], [1, 0]);
  st.stage = 30;
  const l = A.fight(st, T);
  eq("空手打第 30 關 → 輸，什麼都沒拿", [l.win, st.stage, l.coins, l.drop, st.credit], [false, 30, 0, null, 0]);
  const rich = A.newState(NOW); rich.equip = [10, 10, 10]; rich.coinToday = 38; rich.coinDay = T; rich.stage = 10;
  rich.dex = { 野豬王: [1, 0], 蠍子: [1, 0] };            // 已經打過，不會有圖鑑獎勵
  const bo = A.fight(rich, T, () => 0.5);
  eq("頭目 🦴15，但每日封頂 40 → 只拿 2", [bo.win, bo.coins, bo.capped], [true, 2, true]);
  const nx = A.fight(rich, "2026-10-28", () => 0.5);
  eq("隔天封頂重算", nx.coins, 3);
  const dropTier = (stage) => { const s = A.newState(NOW); s.equip = [10, 10, 10]; s.level = 200; s.stage = stage; return A.fight(s, T, () => 0.5).drop[1]; };
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

/* ---------- 頭目特性 ---------- */
{
  const plain = (s) => ({ hp: Math.round(40 * 1.09 ** (s - 1) * 1.5), atk: Math.round(6 * 1.09 ** (s - 1) * 1.2) });
  const b10 = A.monster(10), p10 = plain(10);
  eq("野豬王：重擊（攻高血少）", [b10.trait, b10.atk > p10.atk, b10.hp < p10.hp], ["heavy", true, true]);
  const b20 = A.monster(20), p20 = plain(20);
  eq("洞窟熊王：厚皮（血多攻低）", [b20.trait, b20.hp > p20.hp, b20.atk < p20.atk], ["tank", true, true]);
  eq("一般怪沒有特性", A.monster(5).trait, null);
  const drain = A.battle({ atk: 5, hp: 200, crit: 0 }, { hp: 100, atk: 10, trait: "drain" });
  eq("吸血：怪打中後回 30%（10 → 回 3）", drain.events.slice(0, 3), [["h", 5, false, 95], ["m", 10, false, 190], ["mh", 3, false, 98]]);
  const armor = A.battle({ atk: 10, hp: 999, crit: 0.5 }, { hp: 1000, atk: 1, trait: "armor" });
  eq("冰甲：普通攻擊 ×0.7、暴擊不受影響", armor.events.filter((e) => e[0] === "h").slice(0, 2).map((e) => e[1]), [7, 20]);
  const rage = A.battle({ atk: 1, hp: 999, crit: 0 }, { hp: 1000, atk: 100, trait: "enrage" });
  eq("狂怒：每回合攻擊 +8%", rage.events.filter((e) => e[0] === "m").slice(0, 3).map((e) => e[1]), [100, 108, 117]);
}

/* ---------- 技能 ---------- */
{
  const hits = (skills, mon = { hp: 9999, atk: 10 }, hero = { atk: 10, hp: 9999, crit: 0 }) => A.battle({ ...hero, skills }, mon).events;
  eq("連擊：第 3 下多打一下", hits(["combo"]).slice(0, 7).map((e) => e[0]).join(""), "hmhmhhm");
  const lee = hits(["leech"], { hp: 9999, atk: 10 }, { atk: 20, hp: 100, crit: 0 });
  eq("吸血：受傷後打怪回 25%", lee.slice(0, 4), [["h", 20, false, 9979], ["m", 10, false, 90], ["h", 20, false, 9959], ["hh", 5, false, 95]]);
  eq("護盾：第 4 下被擋掉", hits(["guard"]).filter((e) => e[0] === "m").slice(0, 5).map((e) => e[1]), [10, 10, 10, 0, 10]);
  eq("狂暴：暴擊 ×3", hits(["fury"], undefined, { atk: 10, hp: 9999, crit: 0.5 }).filter((e) => e[0] === "h").slice(0, 2).map((e) => e[1]), [10, 30]);
  eq("堅韌：受到傷害 −20%", hits(["tough"])[1][1], 8);
  eq("獵王：只對頭目與閃光怪 +35%", [hits(["slayer"], { hp: 999, atk: 1, boss: true })[0][1], hits(["slayer"], { hp: 999, atk: 1, shiny: true })[0][1], hits(["slayer"])[0][1]], [14, 14, 10]);
  const st = A.newState(NOW);
  eq("Lv1 沒有技能欄、Lv5 一格、Lv25 三格", [A.skillSlots(1), A.skillSlots(5), A.skillSlots(25), A.skillSlots(99)], [0, 1, 3, 4]);
  let err = ""; try { A.setSkills(st, ["combo"]); } catch (e) { err = e.message; }
  eq("技能欄不夠 → 不行", err, "目前只有 0 個技能欄");
  st.level = 12;
  A.setSkills(st, ["combo", "guard"]);
  eq("Lv12 可以裝兩個", A.heroStats(st).skills, ["combo", "guard"]);
  err = ""; try { A.setSkills(st, ["combo", "combo"]); } catch (e) { err = e.message; }
  eq("同一個技能不能裝兩次", err, "技能資料不正確");
  err = ""; try { A.setSkills(st, ["fly"]); } catch (e) { err = e.message; }
  eq("不存在的技能", err, "技能資料不正確");
}

/* ---------- 閃光怪與圖鑑 ---------- */
{
  const m = A.monster(5), s = A.monster(5, true);
  eq("閃光怪比較強", [s.shiny, s.hp > m.hp, s.atk > m.atk], [true, true, true]);
  eq("頭目不會是閃光", A.monster(10, true).shiny, false);
  const st = A.newState(NOW); st.equip = [10, 10, 10]; st.level = 50; st.stage = 5; st.shiny = true;
  const r = A.fight(st, T, () => 0.05);
  eq("打倒閃光怪：🦴8 + 第一次 5 + 第一次閃光 10、掉落高一階", [r.coins, r.dexNew, r.dexShinyNew, r.drop[1], st.dex["野狼"]], [23, true, true, 2, [1, 1]]);
  eq("下一關會不會閃光，打贏時就決定（亂數 0.05 < 12% → 會）", st.shiny, true);
  A.fight(st, T, () => 0.5);
  eq("亂數 0.5 → 下一關不閃光", st.shiny, false);
  eq("圖鑑共 48 種怪（名字不重複）", [A.DEX_LIST.length, new Set(A.DEX_LIST.map((x) => x.name)).size], [48, 48]);
}

/* ---------- 每日任務與寶箱 ---------- */
{
  const ids = A.questIds(T);
  eq("每天三個任務：健康／花能量／挑戰或訓練", [ids[0][0], ids[1][0], "ft".includes(ids[2][0])], ["h", "s", true]);
  eq("同一天每次都一樣", A.questIds(T), ids);
  const st = A.newState(NOW); st.energy = 150; st.level = 1;
  let err = ""; try { A.openChest(st, T); } catch (e) { err = e.message; }
  eq("任務沒做完不能開", err, "三個任務都完成才能開寶箱");
  // 做任務：健康 3 項、花 25 能量、挑戰 3 次、訓練 1 次（不管抽到哪個都夠）
  A.grantHealth(st, [{ date: T, logged: 1, protein_hit: 1, water_hit: 1 }], T);
  const b = empty(); for (let i = 0; i < 25; i++) b[i] = [0, 1];
  A.applySync(st, { board: b, equip: [0, 0, 0], spent: 25 }, T);
  A.fight(st, T, () => 0.5); A.fight(st, T, () => 0.5); A.fight(st, T, () => 0.5);
  A.train(st, T);
  const q = A.quests(st, T);
  eq("三個任務都完成", q.map((x) => x.done), [true, true, true]);
  eq("進度不會超過目標", q.every((x) => x.cur === x.n), true);
  const c = A.openChest(st, T, () => 0.5);
  eq("第一天開寶箱：3 階裝備、🦴6、連續 1 天", [c.drop, c.coins, c.streak], [[1, 3], 6, 1]);
  err = ""; try { A.openChest(st, T); } catch (e) { err = e.message; }
  eq("一天只能開一次", err, "今天的寶箱已經開過了");
  eq("寶箱的裝備有算進額度", st.credit >= 4, true);
  eq("明天還沒開時顯示連續 2 天", A.nextStreak(st, "2026-10-28"), 2);
  eq("斷一天 → 從 1 開始", A.nextStreak(st, "2026-10-29"), 1);
  eq("寶箱等級：第 1～2 天 3 階、第 3 天 4 階、第 7 天以後 6 階", [1, 2, 3, 5, 7, 30].map(A.chestTier), [3, 3, 4, 5, 6, 6]);
  const tmr = "2026-10-28";
  eq("隔天任務進度歸零", A.quests(st, tmr).some((x) => x.cur > 0 && x.id[0] !== "h"), false);
}

/* ---------- 新區域的頭目特性 ---------- */
{
  eq("第 51 關是沙漠、第 60 關沙漠魔神、第 80 關天龍", [A.monster(51).region, A.monster(60).name, A.monster(80).name], ["沙漠遺跡", "沙漠魔神", "天龍"]);
  const ev = A.battle({ atk: 1, hp: 999, crit: 0 }, { hp: 999, atk: 1, trait: "evade" });
  eq("閃避：每第 3 次攻擊被躲開", ev.events.filter((e) => e[0][0] === "h").slice(0, 6).map((e) => e[0]).join(","), "h,h,hx,h,h,hx");
  const rg = A.battle({ atk: 10, hp: 999, crit: 0 }, { hp: 100, atk: 1, trait: "regen" });
  eq("再生：每回合回 6%", rg.events.slice(0, 3), [["h", 10, false, 90], ["m", 1, false, 998], ["mh", 6, false, 96]]);
  const db = A.battle({ atk: 1, hp: 999, crit: 0 }, { hp: 999, atk: 5, trait: "double" });
  eq("連打：每第 3 回合打兩下", db.events.slice(0, 9).map((e) => e[0]).join(""), "hmhmhmmhm");
}

/* ---------- 藥水 ---------- */
{
  const b = A.battle({ atk: 1, hp: 100, crit: 0, potions: 2 }, { hp: 999, atk: 30 });
  const used = b.events.filter((e) => e[0] === "hp");
  eq("血掉到 35% 以下自動喝，回 40%（帶 2 瓶就喝 2 瓶）", [b.potionsUsed, used[0]], [2, ["hp", 40, false, 50]]);
  const st = A.newState(NOW); st.potions = 2; st.stage = 3;
  A.fight(st, T, () => 0.5);
  eq("戰鬥後扣掉喝掉的藥水", st.potions, 2 - A.battle(A.heroStats({ ...A.newState(NOW), potions: 2 }), A.monster(3)).potionsUsed);
}

/* ---------- 金幣、探索 ---------- */
{
  const st = A.newState(NOW); st.equip = [10, 10, 10]; st.level = 30; st.dex = { 大老鼠: [1, 0], 蝙蝠: [1, 0] };
  const r = A.fight(st, T, () => 0.5);
  eq("打贏給金幣 5+關卡", [r.gold, st.gold], [6, 6]);
  st.stage = 10; const boss = A.fight(st, T, () => 0.5);
  eq("頭目金幣 ×3", boss.gold, 45);
  let err = ""; try { A.explore(st, 11, T); } catch (e) { err = e.message; }
  eq("不能探索還沒打過的關", err, "只能探索已經打過的關卡");
  st.energy = 10; const g0 = st.gold, c0 = st.coinToday;
  const ex = A.explore(st, 2, T, () => 0.1);
  eq("探索：花 3 能量、亂數 0.1 < 20% → 閃光怪", [st.energy, ex.mon.shiny, ex.win], [7, true, true]);
  eq("探索：經驗與金幣減半、不給打怪骨頭幣，但第一次閃光有圖鑑獎勵", [ex.gold, st.gold - g0, ex.coins, st.coinToday - c0, ex.dexShinyNew], [4, 4, 10, 0, true]);
  eq("閃光必掉裝備", !!ex.drop, true);
  const ex2 = A.explore(st, 2, T, () => 0.5);
  eq("沒閃光、亂數 0.5 → 不掉東西", [ex2.mon.shiny, ex2.drop], [false, null]);
  st.energy = 2; err = ""; try { A.explore(st, 2, T); } catch (e) { err = e.message; }
  eq("能量不夠不能探索", err.includes("能量不夠"), true);
  eq("探索也算進「挑戰或探索」任務", st.daily.fights, 4);
}

/* ---------- 城鎮：賣、釀藥、買、強化 ---------- */
{
  const st = A.newState(NOW);
  const b = empty(); b[0] = [0, 3]; b[1] = [1, 1]; b[2] = [1, 1]; b[3] = [2, 2];
  A.applySync(st, { board: b, equip: [0, 0, 0], spent: 7 });   // 價值 4+1+1+2 = 8，花 7 點（允許到 14）
  const b2 = b.slice(); b2[0] = null;
  let err = ""; try { A.applySync(st, { board: b, equip: [0, 0, 0], spent: 0, action: "sell", item: [0, 3] }); } catch (e) { err = e.message; }
  eq("說要賣、但背包沒拿掉 → 拒收", err.includes("對不起來"), true);
  A.applySync(st, { board: b2, equip: [0, 0, 0], spent: 0, action: "sell", item: [0, 3] });
  const s = A.runAction(st, { action: "sell", item: [0, 3] }, T);
  eq("賣 3 階 → 金幣 3×4 = 12", [s.gold, st.gold, st.value], [12, 12, 4]);
  const b3 = b2.slice(); b3[1] = b3[2] = b3[3] = null;
  A.applySync(st, { board: b3, equip: [0, 0, 0], spent: 0, action: "brew", items: [[1, 1], [1, 1], [2, 2]] });
  const br = A.runAction(st, { action: "brew", items: [[1, 1], [1, 1], [2, 2]] }, T);
  eq("3 件 1～2 階 → 釀一瓶藥", [br.potions, st.value], [1, 0]);
  eq("3 階不能拿去釀", A.runAction(st, { action: "brew", items: [[1, 1], [1, 1], [2, 3]] }, T).error, "釀藥要 3 件 1～2 階的東西");
  eq("金幣不夠不能買", A.runAction(st, { action: "buy" }, T).error, "金幣不夠（要 40）");
  st.gold = 200;
  A.runAction(st, { action: "buy" }, T); A.runAction(st, { action: "buy" }, T);
  eq("買兩瓶：金幣 −80、藥水 3", [st.gold, st.potions], [120, 3]);
  eq("最多帶 3 瓶", A.runAction(st, { action: "buy" }, T).error, "藥水最多帶 3 瓶");
  st.gold = 500;
  const e1 = A.runAction(st, { action: "enhance", slot: 0 }, T), e2 = A.runAction(st, { action: "enhance", slot: 0 }, T);
  eq("強化武器兩次：30＋120 金幣", [e1.cost, e2.cost, st.enh, st.gold], [30, 120, [2, 0, 0], 350]);
  st.gold = 99999; st.enh = [0, 0, 0];
  const base = A.heroStats(st);
  A.enhance(st, 0); A.enhance(st, 1); A.enhance(st, 2);
  const up = A.heroStats(st);
  eq("強化：攻擊 +5%、血量 +5%、暴擊 +1%", [up.atk, up.hp, up.crit], [Math.round(base.atk * 1.05), Math.round(base.hp * 1.05), base.crit + 0.01]);
  st.enh = [10, 0, 0];
  eq("強化最多 10 級", A.runAction(st, { action: "enhance", slot: 0 }, T).error, "已經強化到頂了");
  const ch = A.newState(NOW);
  A.grantHealth(ch, [{ date: T, logged: 1, protein_hit: 1, water_hit: 1 }], T);
  const bb = empty(); for (let i = 0; i < 25; i++) bb[i] = [0, 1];
  ch.energy = 150; A.applySync(ch, { board: bb, equip: [0, 0, 0], spent: 25 }, T);
  for (let i = 0; i < 3; i++) A.fight(ch, T, () => 0.5);
  A.train(ch, T);
  eq("寶箱也給金幣（20×連續天數）", A.openChest(ch, T, () => 0.5).gold, 20);
}

/* ---------- 柏青哥 A：遊樂場 ---------- */
{
  const seeded = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const st = A.newState(NOW);
  eq("金幣不夠不能打", A.runAction(st, { action: "pachi" }, T).error, "金幣不夠（要 20）");
  st.gold = 1000;
  const r = A.pachiPlay(st, T, seeded(1));
  const balls = r.events.filter((e) => e[0] === "ball"), spins = r.events.filter((e) => e[0] === "spin");
  eq("一輪 10 顆、扣 20 金幣", [balls.length, r.cost], [10, 20]);
  eq("每顆入賞（沒滿）都會轉一次", spins.length, balls.filter((e) => e[1] === 2).length);
  eq("中獎＝三格一樣；聽牌＝前兩格一樣但沒中", spins.every((e) => (e[3] ? e[1][0] === e[1][1] && e[1][1] === e[1][2] : !(e[1][0] === e[1][1] && e[1][1] === e[1][2])) && e[2] === (!e[3] && e[1][0] === e[1][1])), true);
  eq("金幣帳對得起來", st.gold, 1000 - 20 + r.gold);
  // 長期期望值：打很多輪，回收率要落在 70%～95%（長期一定是輸，但不會輸太快）
  const sim = A.newState(NOW); sim.gold = 1e9; let spent = 0, back = 0, wins = 0, kakuWins = 0, rand = seeded(42);
  for (let day = 0; day < 3000; day++) {
    const today = "d" + day;
    for (let k = 0; k < 20; k++) {
      const before = sim.gold;
      const x = A.pachiPlay(sim, today, rand);
      spent += x.cost; back += x.gold + x.items.reduce((a, it) => a + A.sellPrice(it[1]), 0);
      wins += x.wins;
      kakuWins += x.events.filter((e) => e[0] === "spin" && e[3] && e[6] >= 0 && e[5]).length;
    }
  }
  const rtp = back / spent;
  console.log(`      （遊樂場模擬 600,000 輪：回收率 ${(rtp * 100).toFixed(1)}%，平均每 ${(spent / 2 / wins).toFixed(0)} 顆珠子中一次大當）`);
  eq("回收率 70%～95%", rtp > 0.7 && rtp < 0.95, true);
  st.pachi.balls = 195;
  eq("不限每天顆數（195 顆之後還能打）", A.runAction(st, { action: "pachi" }, T).error, undefined);
  eq("隔天重算", !!A.runAction(st, { action: "pachi" }, "2026-10-28").events, true);
  // 確變：奇數大當後下 5 轉中獎率 1/3
  const k = A.newState(NOW); k.gold = 100; k.pachi = { day: T, balls: 0, kaku: 5 };
  let seq = [0.1, 0.9, 0.2, 0.9, 0.3];   // 第一顆入賞 → 之後的亂數
  const rk = A.pachiPlay(k, T, () => (seq.length ? seq.shift() : 0.99));
  const s0 = rk.events.find((e) => e[0] === "spin");
  eq("確變中：亂數 0.2 < 1/3 → 中", s0[3], true);
}

/* ---------- 柏青哥 B：寶箱轉盤、確變時間 ---------- */
{
  const mk = () => {
    const ch = A.newState(NOW); ch.energy = 150;
    A.grantHealth(ch, [{ date: T, logged: 1, protein_hit: 1, water_hit: 1 }], T);
    const bb = empty(); for (let i = 0; i < 25; i++) bb[i] = [0, 1];
    A.applySync(ch, { board: bb, equip: [0, 0, 0], spent: 25 }, T);
    for (let i = 0; i < 3; i++) A.fight(ch, T, () => 0.5);
    A.train(ch, T);
    return ch;
  };
  const r777 = A.openChest(mk(), T, () => 0.01);
  eq("寶箱 777：升兩階、金幣 ×3", [r777.reels, r777.up, r777.drop[1], r777.gold], [[7, 7, 7], 2, 5, 60]);
  const r1 = A.openChest(mk(), T, () => 0.1);
  eq("聽牌成功：三格一樣、升一階", [r1.reels[0] === r1.reels[1] && r1.reels[1] === r1.reels[2], r1.up, r1.drop[1]], [true, 1, 4]);
  const r0 = A.openChest(mk(), T, () => 0.6);
  eq("沒中：照原本階數", [r0.up, r0.drop[1], r0.reels[0] === r0.reels[1] && r0.reels[1] === r0.reels[2]], [0, 3, false]);

  const st = A.newState(NOW); st.equip = [10, 10, 10]; st.level = 30; st.dex = { 大老鼠: [1, 0], 蝙蝠: [1, 0], 毒蛇: [1, 0], 毒蜘蛛: [1, 0], 野狼: [1, 0] };
  const a = A.fight(st, T, () => 0.05);                // 0.05 < 8% → 突入確變
  eq("打贏後突入確變時間（剩 3 關）", [a.rushStart, st.rush], [true, 3]);
  st.shiny = false;                                    // 上一場也抽到閃光了，這裡先排除
  const b = A.fight(st, T, () => 0.5);
  eq("確變中：掉落高一階、金幣 ×2、剩 2 關", [b.rush, b.drop[1], b.gold, st.rush], [true, 2, 2 * (5 + 2), 2]);
  A.fight(st, T, () => 0.5); A.fight(st, T, () => 0.5);
  eq("3 關後結束", st.rush, 0);
}

/* ---------- 柏青哥 C：彈珠產生器 ---------- */
{
  const st = A.newState(NOW); st.energy = 2;
  const r = A.runAction(st, { action: "drop", chain: 1 }, T, () => 0.1);   // 六排都往左 → 最左邊的洞
  eq("全部往左 → 最邊邊的洞、3 階、瞄準的種類", [r.path.join(""), r.pocket, r.item], ["000000", 0, [1, 3]]);
  eq("扣 1 能量、記成額度、算進花能量任務", [st.energy, st.credit, st.daily.spent], [1, 4, 1]);
  const m = A.runAction(st, { action: "drop", chain: 0 }, T, (() => { const s = [0.1, 0.9, 0.1, 0.9, 0.1, 0.9]; return () => s.shift(); })());
  eq("左右各半 → 中間的洞、1 階", [m.pocket, m.item], [3, [0, 1]]);
  eq("能量用完不能打", A.runAction(st, { action: "drop", chain: 0 }, T).error, "能量用完了");
  const b = empty(); b[0] = [1, 3]; b[1] = [0, 1];
  A.applySync(st, { board: b, equip: [0, 0, 0], spent: 0 }, T);
  eq("掉出來的東西放進背包，存檔被接受", st.value, 5);
  // 平均每點能量換到的價值：比點產生器（1.15）略高，但要等珠子掉下來
  const ev = [1, 6, 15, 20, 15, 6, 1].reduce((a, w, i) => a + w / 64 * A.tierValue(A.DROP_TIERS[i]), 0);
  eq(`彈珠每點能量平均價值 ${ev.toFixed(2)}（1.15～1.4 之間）`, ev > 1.15 && ev < 1.4, true);
}

/* ---------- 排行榜 ---------- */
{
  const g = (stage, level, dex = {}) => ({ adv: { v: 1, stage, level, dex } });
  const rows = [
    { user_id: 1, username: "zen", games: g(12, 8, { a: 1, b: 1 }) },
    { user_id: 2, username: "amy", games: g(20, 5) },
    { user_id: 3, username: "bob", games: g(12, 9) },
    { user_id: 4, username: "cat", games: { merge: {} } },
  ];
  const lb = A.leaderboard(rows, 1);
  eq("比已打過的關卡，同關比等級；沒玩的不列", lb.map((x) => [x.name, x.cleared, x.level]), [["amy", 19, 5], ["bob", 11, 9], ["zen", 11, 8]]);
  eq("標出自己、算圖鑑數", lb.find((x) => x.me), { name: "zen", cleared: 11, level: 8, dex: 2, me: true });
}

/* ---------- 平衡：模擬每天 60 能量的玩家 ---------- */
{
  // 卡關時試所有技能組合（最多 C(6,4)=15 種），有能贏的就換上 —— 就像玩家換技能打頭目
  const combos = (k) => { const out = []; const rec = (i, cur) => { if (cur.length === k) { out.push(cur.slice()); return; } for (let j = i; j < A.SKILL_IDS.length; j++) { cur.push(A.SKILL_IDS[j]); rec(j + 1, cur); cur.pop(); } }; rec(0, []); return out; };
  const tryWin = (st) => {
    const mon = A.monster(st.stage, st.shiny);
    if (A.battle(A.heroStats(st), mon).win) return true;
    for (const c of combos(A.skillSlots(st.level))) { st.skills = c; if (A.battle(A.heroStats(st), mon).win) return true; }
    return false;
  };
  const play = (perDay, days, useSkills) => {
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
      while ((useSkills ? tryWin(st) : true) && A.fight(st, T, () => 0.5).win);
    }
    return st.stage;
  };
  const run = (u) => [1, 7, 30, 90].map((d) => play(60, d, u));
  const [n1, n7, n30, n90] = run(false), [s1, s7, s30, s90] = run(true);
  console.log(`      （每天 60 能量，不用技能：第 1 天到第 ${n1} 關、第 7 天 ${n7}、第 30 天 ${n30}、第 90 天 ${n90}）`);
  console.log(`      （　　　　　　　會換技能：第 1 天到第 ${s1} 關、第 7 天 ${s7}、第 30 天 ${s30}、第 90 天 ${s90}）`);
  eq("第一天推得動、但不會一天打完", s1 >= 8 && s1 <= 30, true);
  eq("一個月後還在推進", s30 > s7, true);
  eq("裝備做滿後靠訓練還能繼續往前", s90 > s30, true);
  eq("會換技能的走得比較遠", s90 >= n90 && s30 >= n30, true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
