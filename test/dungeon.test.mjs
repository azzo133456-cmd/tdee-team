// 深淵地城（肉鴿）規則測試：node test/dungeon.test.mjs
import * as A from "../adv_logic.js";
import * as D from "../dungeon_logic.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}` + (ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`));
};
const T = "2026-10-29", NOW = Date.UTC(2026, 9, 29, 4);
const run = (st, body) => A.runAction(st, body, T);
const fresh = (lvl = 1, equip = [0, 0, 0]) => { const st = A.newState(NOW); st.level = lvl; st.equip = equip; return st; };

/* ---------- 基本 ---------- */
{
  eq("週一當一週的開始（10/29 週四 → 10/26）", [D.weekKey("2026-10-29"), D.weekKey("2026-10-26"), D.weekKey("2026-11-01")], ["2026-10-26", "2026-10-26", "2026-10-26"]);
  eq("祝福 16 種、稀有 3 種", [D.BLESS.length, D.BLESS.filter((b) => b.rare).length], [16, 3]);
  const ok12 = new Set([0x1fa70, 0x1fa71, 0x1fa72, 0x1fa73, 0x1fa78, 0x1fa79, 0x1fa7a, 0x1fa80, 0x1fa81, 0x1fa82, 0x1fa90, 0x1fa91, 0x1fa92, 0x1fa93, 0x1fa94, 0x1fa95]);
  const bad = [...JSON.stringify(D.BLESS)].filter((ch) => { const c = ch.codePointAt(0); return c >= 0x1fa70 && c <= 0x1faff && !ok12.has(c); });
  eq("祝福沒有 Emoji 13 以後的字元", bad, []);
}

/* ---------- 開場、門 ---------- */
{
  const st = fresh(5, [3, 3, 2]);
  const r = run(st, { action: "dun_start", mode: "normal" });
  eq("開場：第 1 層、滿血、選門", [st.dun.floor, st.dun.hp === D.dunHero(st.dun).maxHp, st.dun.phase], [1, true, "choose"]);
  eq("能力是冒險的快照（裝備、等級都帶進來）", st.dun.base.atk, A.heroStats(st).atk);
  eq("還沒結束不能再開一場", run(st, { action: "dun_start" }).error, "上一場還沒結束");
  eq("前兩層沒有菁英", st.dun.doors.includes("elite"), false);
  eq("每層至少一扇是戰鬥", st.dun.doors.some((t) => t === "fight" || t === "elite"), true);
  const d = { seed: 1, floor: 5 }; eq("第 5 層只有頭目", D.makeDoors(d), ["boss"]);
  let campOk = true; for (let s = 0; s < 200; s++) { if (!D.makeDoors({ seed: s, floor: 9 }).includes("camp")) campOk = false; }
  eq("頭目前一層一定有營火", campOk, true);
  eq("現在不是選祝福的時候", run(st, { action: "dun_bless", i: 0 }).error, "現在不能做這個");
}

/* ---------- 每週挑戰：大家同一張地圖 ---------- */
{
  const a = fresh(1), b = fresh(30, [8, 8, 8]);
  run(a, { action: "dun_start", mode: "weekly" }); run(b, { action: "dun_start", mode: "weekly" });
  eq("同一週：第 1 層的門一樣", a.dun.doors, b.dun.doors);
  const c = fresh(1); run(c, { action: "dun_start", mode: "normal" });
  const e = fresh(1); run(e, { action: "dun_start", mode: "normal" });
  eq("一般模式每場不一樣（種子不同）", c.dun.seed !== e.dun.seed, true);
  const m1 = D.dunMonster(a.dun, "fight"), m2 = D.dunMonster(b.dun, "fight");
  eq("同一層同一隻怪（強度跟著各自的寵物）", [m1.name === m2.name, m2.hp > m1.hp], [true, true]);
}

/* ---------- 祝福效果 ---------- */
{
  const d = { base: { atk: 100, hp: 1000, crit: 0, skills: [] }, bless: {}, forge: 0 };
  const h0 = D.dunHero(d);
  d.bless = { sharp: 2, strong: 1, eye: 1, giant: 1 };
  const h1 = D.dunHero(d);
  eq("鋒利×2 攻擊 +30%、強壯＋巨人 血量 ×1.2×1.5、銳眼 +8%", [h1.atk, h1.maxHp, h1.crit], [130, 1800, 0.08]);
  const fight = (bless, mon, hp) => D.dunBattle({ base: { atk: 10, hp: 100, crit: 0, skills: [] }, bless, hp: hp || 100, undyingLeft: bless.undying || 0 }, mon);
  eq("先手：第一下必暴擊", fight({ first: 1 }, { hp: 999, atk: 1 }).events[0], ["h", 20, true, 979]);
  eq("暴擊專家：暴擊 ×3", fight({ first: 1, critdmg: 1 }, { hp: 999, atk: 1 }).events[0][1], 30);
  eq("荊棘：被打反彈 20%", fight({ thorn: 1 }, { hp: 999, atk: 50 }).events.slice(1, 3), [["m", 50, false, 50], ["r", 10, false, 979]]);
  eq("護身符：第一次被打不痛", fight({ charm: 1 }, { hp: 999, atk: 50 }).events[1], ["m", 0, true, 100]);
  const u = fight({ undying: 1 }, { hp: 999, atk: 150 });
  eq("不屈：致命傷留 1 血一次", [u.events[1], u.events[2]], [["m", 150, false, 0], ["u", 1, false, 1]]);
  eq("處刑：怪物血低於 25% 傷害 ×1.5", fight({ exec: 1 }, { hp: 35, atk: 1 }).events.filter((e) => e[0] === "h").map((e) => e[1]), [10, 10, 10, 15]);
  eq("狂戰士：自己血低於 40% 攻擊 +40%", fight({ rage: 1 }, { hp: 999, atk: 1 }, 30).events[0][1], 14);
  eq("血量從目前的血開始", fight({}, { hp: 999, atk: 10 }, 35).events[1][3], 25);
  eq("鐵壁：受到的傷害 ×0.88", fight({ wall: 1 }, { hp: 999, atk: 100 }).events[1][1], 88);
}

/* ---------- 一層一層走 ---------- */
{
  const st = fresh(20, [7, 7, 6]); run(st, { action: "dun_start", mode: "normal" });
  const d = st.dun; d.doors = ["fight", "camp", "shop"];
  const r = run(st, { action: "dun_go", i: 0 });
  eq("打贏：拿碎晶、進入選祝福、三個不重複", [r.win, d.gems, d.phase, d.offer.length, new Set(d.offer).size], [true, 10, "bless", 3, 3]);
  const pick = d.offer[0];
  run(st, { action: "dun_bless", i: 0 });
  eq("選了祝福 → 下一層", [d.bless[pick], d.floor, d.phase], [1, 2, "choose"]);
  d.doors = ["camp"]; d.hp = 10;
  run(st, { action: "dun_go", i: 0 });
  const max = D.dunHero(d).maxHp, cr = run(st, { action: "dun_camp", opt: 0 });
  eq("營火休息：回 35% 血", [d.hp, d.floor], [10 + Math.round(max * 0.35), 3]);
  d.doors = ["camp"]; run(st, { action: "dun_go", i: 0 });
  const a0 = D.dunHero(d).atk; run(st, { action: "dun_camp", opt: 1 });
  eq("營火鍛鍊：攻擊 +8%", D.dunHero(d).atk, Math.round(d.base.atk * (1 + 0.15 * (d.bless.sharp || 0)) * 1.08));
  d.doors = ["shop"]; d.gems = 100; run(st, { action: "dun_go", i: 0 });
  eq("商人：三樣東西", d.shop.map((x) => x.kind), ["bless", "bless", "heal"]);
  const b1 = run(st, { action: "dun_buy", i: 0 });
  eq("買祝福：扣 45 碎晶", [d.gems, d.shop[0].sold, !!b1.msg], [55, true, true]);
  eq("同一樣不能買兩次", run(st, { action: "dun_buy", i: 0 }).error, "沒有這個商品");
  eq("碎晶不夠", run(st, { action: "dun_buy", i: 1 }).error, "碎晶不夠");
  run(st, { action: "dun_leave" });
  eq("離開商人 → 下一層", [d.floor, d.phase], [5, "choose"]);
  d.phase = "event"; d.event = "altar"; const hp0 = d.hp;
  const ev = run(st, { action: "dun_event", opt: 0 });
  eq("祭壇：扣 20% 血換一個稀有祝福", [d.hp < hp0 || ev.msg.includes("巨人"), Object.keys(d.bless).some((k) => D.blessOf(k).rare)], [true, true]);
  const q = run(st, { action: "dun_quit" });
  eq("撤退：打過 5 層 → 金幣 3×5", [q.summary.cleared, q.summary.gold, st.gold, d.active], [5, 15, 15, false]);
  eq("最佳紀錄", st.dunStats.best, 5);
  eq("結束後不能再走", run(st, { action: "dun_go", i: 0 }).error, "現在沒有在地城裡");
}

/* ---------- 死掉、金幣封頂、每週紀錄 ---------- */
{
  const st = fresh(1); run(st, { action: "dun_start", mode: "weekly" });
  const d = st.dun; d.floor = 12; d.hp = 1; d.doors = ["fight"];
  const r = run(st, { action: "dun_go", i: 0 });
  eq("血只剩 1 打第 12 層 → 死掉、結束", [r.win, r.over, d.active, r.summary.how], [false, true, false, "dead"]);
  eq("每週紀錄：打過 11 層", st.dunStats.week, { key: "2026-10-26", best: 11 });
  eq("金幣 3×11 = 33", r.summary.gold, 33);
  for (let k = 0; k < 3; k++) { run(st, { action: "dun_start", mode: "normal" }); st.dun.floor = 20; run(st, { action: "dun_quit" }); }
  eq("地城金幣每天封頂 100", [st.dunStats.goldToday, st.dun.last.capped], [100, true]);
  const pub = A.publicState(st, T, NOW).dun;
  eq("給前端：紀錄", [pub.rec.best, pub.rec.weekBest, pub.rec.goldToday], [19, 11, 100]);
  const rows = [
    { user_id: 1, username: "zen", games: { adv: st } },
    { user_id: 2, username: "amy", games: { adv: { dunStats: { best: 25, week: { key: "2026-10-19", best: 30 } } } } },
    { user_id: 3, username: "bob", games: { adv: { dunStats: { best: 8, week: { key: "2026-10-26", best: 14 } } } } },
  ];
  const b = D.dunBoard(rows, 1, T);
  eq("本週排行：只算這週", b.week.map((x) => [x.name, x.week]), [["bob", 14], ["zen", 11]]);
  eq("歷史排行", b.all.map((x) => [x.name, x.best]), [["amy", 25], ["zen", 19], ["bob", 8]]);
}

/* ---------- 平衡：簡單的玩法，看能走多深 ---------- */
{
  // 有戰鬥就打（血少於 40% 先找營火休息），祝福挑第一個，商人有錢就買第一樣，事件選第一個
  const play = (lvl, equip, seedN) => {
    const st = fresh(lvl, equip); st.level = lvl; run(st, { action: "dun_start", mode: "normal" });
    const d = st.dun; d.seed = seedN; d.doors = D.makeDoors(d);
    for (let step = 0; step < 400 && d.active; step++) {
      const H = D.dunHero(d);
      if (d.phase === "choose") {
        const low = d.hp < H.maxHp * 0.4;
        let i = d.doors.indexOf(low ? "camp" : "fight"); if (i < 0) i = d.doors.findIndex((t) => t !== "elite" || !low); if (i < 0) i = 0;
        run(st, { action: "dun_go", i });
      } else if (d.phase === "bless") run(st, { action: "dun_bless", i: 0 });
      else if (d.phase === "camp") run(st, { action: "dun_camp", opt: d.hp < H.maxHp * 0.6 ? 0 : 1 });
      else if (d.phase === "shop") { if (d.gems >= 45 && !d.shop[0].sold) run(st, { action: "dun_buy", i: 0 }); else run(st, { action: "dun_leave" }); }
      else if (d.phase === "event") { const r = run(st, { action: "dun_event", opt: 0 }); if (r && r.error) run(st, { action: "dun_event", opt: 1 }); }
    }
    if (d.active) run(st, { action: "dun_quit" });   // 步數用完還活著也要記分
    return st.dunStats.best || 0;
  };
  const avg = (f) => { let s = 0; for (let k = 0; k < 40; k++) s += f(k); return s / 40; };
  const weak = avg((k) => play(1, [0, 0, 0], 1000 + k)), mid = avg((k) => play(15, [6, 6, 5], 2000 + k)), strong = avg((k) => play(40, [10, 10, 10], 3000 + k));
  console.log(`      （平均走到：Lv1 空手 ${weak.toFixed(1)} 層、Lv15 中等裝備 ${mid.toFixed(1)} 層、Lv40 滿裝 ${strong.toFixed(1)} 層）`);
  eq("新手也能走幾層（≥ 3）", weak >= 3, true);
  eq("越強走越深，但不會無限（滿裝 < 60 層）", weak <= mid && mid <= strong && strong < 60, true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
