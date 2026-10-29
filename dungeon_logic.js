/* ---------- 合成冒險：深淵地城（肉鴿）----------
   每一場：寵物帶著冒險裡的能力（裝備、等級、技能）進場，一層一層往下走。
   每層選一扇門（戰鬥／菁英／事件／營火／商人，每 5 層一個頭目），打贏從三個祝福挑一個，
   血量整場延續，歸零就結束。免費、不限次數，所以獎勵壓低：結束時給少量金幣（每天封頂），
   💎 碎晶只能在這一場裡用。
   每週挑戰：大家同一個種子 → 同一層看到的門、怪、祝福選項都一樣，比誰走得深。
   全部由伺服器算（純函式，test/dungeon.test.mjs 直接測）；亂數用種子，同一層的內容固定。 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(join(here, "public", "adv_data.json"), "utf8"));

export const GOLD_DAILY_CAP = 100;
// 怪物強度：每層乘上固定倍率（複利），祝福是一層一個線性疊，所以再強的寵物遲早會卡住
let HP0 = 2.2, HPG = 1.08, ATK0 = 0.07, ATKG = 1.07, EXP = 1;   // 模擬：Lv1 空手約 8 層、Lv15 約 14 層、Lv40 滿裝約 29 層
export function _tune(o) { ({ HP0 = HP0, HPG = HPG, ATK0 = ATK0, ATKG = ATKG, EXP = EXP } = o); }   // 只給測試調參數用
export const MAX_ROUNDS = 40;

/* ── 祝福：可以重複拿，效果疊加 ── */
export const BLESS = [
  { id: "sharp", e: "🗡️", name: "鋒利", desc: "攻擊 +15%" },
  { id: "strong", e: "💪", name: "強壯", desc: "血量上限 +20%（也會補回這麼多血）" },
  { id: "eye", e: "👁️", name: "銳眼", desc: "暴擊率 +8%" },
  { id: "fang", e: "🦷", name: "吸血牙", desc: "每次攻擊回復傷害的 10%" },
  { id: "thorn", e: "🌵", name: "荊棘", desc: "被打時反彈 20% 傷害" },
  { id: "first", e: "⚡", name: "先手", desc: "每場第一下必定暴擊" },
  { id: "heart", e: "🌀", name: "連擊之心", desc: "每第 4 次攻擊多打一下" },
  { id: "wall", e: "🧱", name: "鐵壁", desc: "受到的傷害 −12%" },
  { id: "regen", e: "💚", name: "再生", desc: "每場戰鬥打贏回 8% 血" },
  { id: "exec", e: "🪓", name: "處刑", desc: "怪物血量低於 25% 時傷害 ×1.5" },
  { id: "rage", e: "😤", name: "狂戰士", desc: "自己血量低於 40% 時攻擊 +40%" },
  { id: "charm", e: "🧿", name: "護身符", desc: "每場第一次被打完全不痛" },
  { id: "greed", e: "💎", name: "貪婪", desc: "打贏拿到的碎晶 +50%" },
  { id: "undying", e: "👼", name: "不屈", desc: "（稀有）一次致命傷改成留 1 血", rare: true },
  { id: "critdmg", e: "💥", name: "暴擊專家", desc: "（稀有）暴擊傷害再 +100%", rare: true },
  { id: "giant", e: "🗿", name: "巨人", desc: "（稀有）血量上限 +50%（也會補回這麼多血）", rare: true },
];
const COMMON = BLESS.filter((b) => !b.rare).map((b) => b.id), RARE = BLESS.filter((b) => b.rare).map((b) => b.id);
export const blessOf = (id) => BLESS.find((b) => b.id === id);

/* ── 有種子的亂數：同一個種子、同一層、同一個用途 → 同樣的結果 ── */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(...xs) {
  let h = 2166136261;
  for (const x of xs) { for (const c of String(x)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h ^= 0x9e3779b9; h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const R = (d, tag) => rng(hash(d.seed, d.floor, tag));

/* 每週的開始（週一，台灣日期） */
export function weekKey(today) {
  const d = new Date(today + "T00:00:00Z"), w = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - w);
  return d.toISOString().slice(0, 10);
}

/* ── 角色：冒險的能力（進場時的快照）× 祝福 ── */
const n = (d, id) => (d.bless && d.bless[id]) || 0;
export function dunHero(d) {
  const b = d.base;
  return {
    atk: Math.round(b.atk * (1 + 0.15 * n(d, "sharp")) * (1 + 0.08 * (d.forge || 0))),
    maxHp: Math.round(b.hp * (1 + 0.2 * n(d, "strong")) * (1 + 0.5 * n(d, "giant"))),
    crit: Math.min(0.95, b.crit + 0.08 * n(d, "eye")),
    skills: b.skills || [],
  };
}

/* ── 怪物：攻擊／血量跟著寵物的同一項等比例長，所以裝備帶來的優勢主要剩暴擊率；每層再複利變強，再強也會卡 ── */
export function dunMonster(d, kind) {
  const f = d.floor, reg = DATA.regions[Math.floor((f - 1) / 5) % DATA.regions.length], r = R(d, "mon");
  const boss = kind === "boss", elite = kind === "elite";
  const [e, name] = boss ? reg.boss : reg.mobs[Math.floor(r() * reg.mobs.length)];
  const trait = boss ? reg.trait : null;
  const sA = Math.max(1, d.base.atk / 8) ** EXP, sH = Math.max(1, d.base.hp / 60) ** EXP;
  let hp = 8 * sA * HP0 * HPG ** (f - 1), atk = 60 * sH * ATK0 * ATKG ** (f - 1);
  if (elite) { hp *= 1.5; atk *= 1.3; }
  if (boss) { hp *= 2.4; atk *= 1.35; }
  if (trait === "heavy") { hp *= 0.8; atk *= 1.4; }
  if (trait === "tank") { hp *= 1.6; atk *= 0.8; }
  return { e, name: (elite ? "菁英・" : "") + name, boss, elite, trait, traitText: trait ? DATA.traits[trait] : "",
    hp: Math.round(hp), atk: Math.max(1, Math.round(atk)), region: reg.name, bg: reg.bg, floor: f };
}

/* ── 戰鬥：跟冒險的戰鬥同一套規則（沒有亂數），加上祝福的效果；血量從目前的血開始 ──
   events 跟冒險一樣：h 打怪、hx 被閃開、m 被打、hh 回血、mh 怪回血，另外 r＝荊棘反彈、u＝不屈撐住 */
export function dunBattle(d, mon) {
  const H = dunHero(d), sk = new Set(H.skills);
  let hh = Math.min(d.hp, H.maxHp), mh = mon.hp, acc = 0, swings = 0, taken = 0, turns = 0, matk = mon.atk;
  const events = [], charm = n(d, "charm");
  const done = (win) => ({ win, events, hp: Math.max(0, hh) });
  const strike = () => {
    swings++;
    if (mon.trait === "evade" && swings % 3 === 0) { events.push(["hx", 0, false, mh]); return; }
    acc += H.crit;
    let dmg = H.atk, crit = false;
    if ((swings === 1 && n(d, "first")) || acc >= 1 - 1e-9) { if (!(swings === 1 && n(d, "first"))) acc -= 1; crit = true; }
    if (n(d, "rage") && hh < H.maxHp * 0.4) dmg *= 1 + 0.4 * n(d, "rage");
    if (crit) dmg *= (sk.has("fury") ? 3 : 2) + n(d, "critdmg");
    if (sk.has("slayer") && (mon.boss || mon.elite)) dmg *= 1.35;
    if (n(d, "exec") && mh < mon.hp * 0.25) dmg *= 1 + 0.5 * n(d, "exec");
    if (mon.trait === "armor" && !crit) dmg *= 0.7;
    dmg = Math.max(1, Math.round(dmg));
    mh = Math.max(0, mh - dmg); events.push(["h", dmg, crit, mh]);
    const heal = Math.min(H.maxHp - hh, Math.round(dmg * ((sk.has("leech") ? 0.25 : 0) + 0.1 * n(d, "fang"))));
    if (heal > 0) { hh += heal; events.push(["hh", heal, false, hh]); }
  };
  const hitMe = () => {
    taken++;
    let dmg = matk * (sk.has("tough") ? 0.8 : 1) * 0.88 ** n(d, "wall");
    const blocked = (sk.has("guard") && taken % 4 === 0) || taken <= charm;
    dmg = blocked ? 0 : Math.max(1, Math.round(dmg));
    hh -= dmg;
    if (hh <= 0 && (d.undyingLeft || 0) > 0) { d.undyingLeft--; hh = 1; events.push(["m", dmg, blocked, 0]); events.push(["u", 1, false, 1]); }
    else { hh = Math.max(0, hh); events.push(["m", dmg, blocked, hh]); }
    if (dmg > 0 && n(d, "thorn") && mh > 0) {
      const back = Math.max(1, Math.round(dmg * 0.2 * n(d, "thorn")));
      mh = Math.max(0, mh - back); events.push(["r", back, false, mh]);
    }
    if (mon.trait === "drain" && dmg > 0 && mh < mon.hp && mh > 0) {
      const heal = Math.min(mon.hp - mh, Math.round(dmg * 0.3)); if (heal > 0) { mh += heal; events.push(["mh", heal, false, mh]); }
    }
  };
  for (let r = 0; r < MAX_ROUNDS; r++) {
    strike(); if (mh <= 0) return done(true);
    if (sk.has("combo") && swings % 3 === 0) { strike(); if (mh <= 0) return done(true); }
    if (n(d, "heart") && swings % 4 === 0) { strike(); if (mh <= 0) return done(true); }
    turns++;
    hitMe(); if (mh <= 0) return done(true); if (hh <= 0) return done(false);
    if (mon.trait === "double" && turns % 3 === 0) { hitMe(); if (mh <= 0) return done(true); if (hh <= 0) return done(false); }
    if (mon.trait === "regen" && mh < mon.hp) { const heal = Math.min(mon.hp - mh, Math.round(mon.hp * 0.06)); if (heal > 0) { mh += heal; events.push(["mh", heal, false, mh]); } }
    if (mon.trait === "enrage") matk *= 1.08;
  }
  return done(false);
}

/* ── 地圖：每層幾扇門 ── */
export function makeDoors(d) {
  const f = d.floor;
  if (f % 5 === 0) return ["boss"];
  const r = R(d, "doors"), k = r() < 0.3 ? 2 : 3, out = [];
  const pick = () => {
    const x = r();
    if (f > 2 && x < 0.15) return "elite";
    if (x < 0.55) return "fight";
    if (x < 0.73) return "event";
    if (x < 0.87) return "camp";
    return "shop";
  };
  for (let i = 0; i < k; i++) out.push(pick());
  if (!out.some((t) => t === "fight" || t === "elite")) out[0] = "fight";        // 至少一扇是戰鬥
  if (f % 5 === 4 && !out.includes("camp")) out[out.length - 1] = "camp";       // 頭目前一層一定有營火（放在別格，不蓋掉戰鬥）
  if (f % 5 === 4 && out[0] === "camp" && !out.slice(1).some((t) => t === "fight" || t === "elite")) out[1] = "fight";
  return out;
}
function blessOffer(d, kind) {
  const r = R(d, "bless" + (d.offerN || 0)), out = [];
  const rareN = kind === "boss" ? 1 : kind === "elite" ? (r() < 0.4 ? 1 : 0) : (r() < 0.1 ? 1 : 0);
  const pool = (ids) => ids.filter((x) => !out.includes(x));
  for (let i = 0; i < 3; i++) { const ids = pool(i < rareN ? RARE : COMMON); out.push(ids[Math.floor(r() * ids.length)]); }
  return out;
}
const EVENTS = {
  altar: { e: "🗿", name: "神秘祭壇", text: "石台上刻著古老的文字：「以血換力」。", opts: ["獻上 20% 血量，換一個稀有祝福", "離開"] },
  chest: { e: "🎁", name: "可疑的寶箱", text: "角落有一個沒上鎖的寶箱……好像在動？", opts: ["打開（可能有碎晶，也可能是寶箱怪）", "離開"] },
  spring: { e: "⛲", name: "治癒之泉", text: "清澈的泉水閃著微光。", opts: ["喝一口：回 30% 血", "裝一瓶：碎晶 +15"] },
  gamble: { e: "🎲", name: "賭徒", text: "「付我 💎20，讓你抽一個祝福，運氣好的話……」", opts: ["付 💎20 抽祝福", "離開"] },
  lost: { e: "🧭", name: "迷路的冒險者", text: "「能分我一點碎晶嗎？我教你一招。」", opts: ["給他 💎15：攻擊 +10%", "離開"] },
};
const EVENT_IDS = Object.keys(EVENTS);
function shopItems(d) {
  const r = R(d, "shop");
  const c = COMMON[Math.floor(r() * COMMON.length)], ra = RARE[Math.floor(r() * RARE.length)];
  return [
    { kind: "bless", id: c, price: 45, sold: false },
    { kind: "bless", id: ra, price: 90, sold: false },
    { kind: "heal", price: 25, sold: false },
  ];
}

/* ── 一場的流程 ── */
export function dunStart(st, mode, hero, today) {
  if (st.dun && st.dun.active) throw new Error("上一場還沒結束");
  const week = weekKey(today);
  const seed = mode === "weekly" ? hash("weekly", week) : hash("run", today, Date.now(), Math.random());
  const d = st.dun = {
    active: true, mode: mode === "weekly" ? "weekly" : "normal", week, seed, floor: 1,
    base: { atk: hero.atk, hp: hero.hp, crit: hero.crit, skills: (hero.skills || []).slice() },
    bless: {}, forge: 0, gems: 0, bosses: 0, undyingLeft: 0, offerN: 0,
    phase: "choose", doors: null, offer: null, event: null, shop: null, last: null,
  };
  d.hp = dunHero(d).maxHp;
  d.doors = makeDoors(d);
  st.dunStats = st.dunStats || {};
  st.dunStats.runs = (st.dunStats.runs || 0) + 1;
  return { kind: "dun_start", dun: d };
}
function needPhase(st, p) {
  const d = st.dun;
  if (!d || !d.active) throw new Error("現在沒有在地城裡");
  if (d.phase !== p) throw new Error("現在不能做這個");
  return d;
}
function nextFloor(d) { d.floor++; d.phase = "choose"; d.doors = makeDoors(d); d.offer = null; d.event = null; d.shop = null; }
function fightRoom(st, d, kind, today) {
  const mon = dunMonster(d, kind), b = dunBattle(d, mon);
  d.hp = b.hp;
  const res = { kind: "dun_fight", mon, win: b.win, events: b.events, heroMax: dunHero(d).maxHp, gems: 0 };
  if (!b.win) { Object.assign(res, endRun(st, today, "dead")); return res; }
  const H = dunHero(d);
  res.gems = Math.round({ fight: 10, elite: 25, boss: 40 }[kind] * (1 + 0.5 * n(d, "greed")));
  d.gems += res.gems;
  if (n(d, "regen")) d.hp = Math.min(H.maxHp, d.hp + Math.round(H.maxHp * 0.08 * n(d, "regen")));
  if (kind === "boss") { d.bosses++; d.hp = Math.min(H.maxHp, d.hp + Math.round(H.maxHp * 0.3)); }
  d.phase = "bless"; d.offer = blessOffer(d, kind); d.offerN++;
  return res;
}
function addBless(d, id) {
  const before = dunHero(d).maxHp;
  d.bless[id] = (d.bless[id] || 0) + 1;
  if (id === "undying") d.undyingLeft = (d.undyingLeft || 0) + 1;
  const after = dunHero(d).maxHp;
  if (after > before) d.hp += after - before;            // 血量上限變高，多的部分也補上
}
export function dunGo(st, i, today) {
  const d = needPhase(st, "choose"), type = d.doors[Math.round(+i)];
  if (!type) throw new Error("沒有這扇門");
  if (type === "fight" || type === "elite" || type === "boss") return fightRoom(st, d, type, today);
  if (type === "camp") { d.phase = "camp"; return { kind: "dun_room", room: "camp" }; }
  if (type === "shop") { d.phase = "shop"; d.shop = shopItems(d); return { kind: "dun_room", room: "shop" }; }
  const r = R(d, "event"); d.phase = "event"; d.event = EVENT_IDS[Math.floor(r() * EVENT_IDS.length)];
  return { kind: "dun_room", room: "event", event: d.event };
}
export function dunBless(st, i) {
  const d = needPhase(st, "bless"), id = d.offer[Math.round(+i)];
  if (!id) throw new Error("沒有這個祝福");
  addBless(d, id); nextFloor(d);
  return { kind: "dun_bless", id };
}
export function dunCamp(st, opt) {
  const d = needPhase(st, "camp"), H = dunHero(d);
  let msg;
  if (+opt === 1) { d.forge = (d.forge || 0) + 1; msg = "🔨 鍛鍊：攻擊 +8%"; }
  else { const heal = Math.min(H.maxHp - d.hp, Math.round(H.maxHp * 0.35)); d.hp += heal; msg = `🔥 休息：回了 ${heal} 血`; }
  nextFloor(d);
  return { kind: "dun_camp", msg };
}
export function dunEvent(st, opt, today) {
  const d = needPhase(st, "event"), ev = d.event, H = dunHero(d), r = R(d, "eventres");
  opt = Math.round(+opt);
  let msg = "你離開了。";
  if (ev === "altar" && opt === 0) {
    const cost = Math.round(H.maxHp * 0.2);
    if (d.hp <= cost) throw new Error("血量不夠獻祭");
    d.hp -= cost; const id = RARE[Math.floor(r() * RARE.length)]; addBless(d, id); msg = `🗿 你獻上了 ${cost} 血，得到「${blessOf(id).name}」！`;
  } else if (ev === "chest" && opt === 0) {
    if (r() < 0.3) { const res = fightRoom(st, d, "elite", today); res.mimic = true; return res; }
    d.gems += 30; msg = "🎁 裡面有 💎30！";
  } else if (ev === "spring") {
    if (opt === 0) { const heal = Math.min(H.maxHp - d.hp, Math.round(H.maxHp * 0.3)); d.hp += heal; msg = `⛲ 回了 ${heal} 血`; }
    else { d.gems += 15; msg = "⛲ 裝了一瓶泉水，💎 +15"; }
  } else if (ev === "gamble" && opt === 0) {
    if (d.gems < 20) throw new Error("碎晶不夠");
    d.gems -= 20; const pool = r() < 0.2 ? RARE : COMMON, id = pool[Math.floor(r() * pool.length)];
    addBless(d, id); msg = `🎲 抽到「${blessOf(id).name}」！`;
  } else if (ev === "lost" && opt === 0) {
    if (d.gems < 15) throw new Error("碎晶不夠");
    d.gems -= 15; d.forge = (d.forge || 0) + 1.25; msg = "🧭 冒險者教你一招：攻擊 +10%";
  }
  nextFloor(d);
  return { kind: "dun_event", msg };
}
export function dunBuy(st, i) {
  const d = needPhase(st, "shop"), it = d.shop[Math.round(+i)];
  if (!it || it.sold) throw new Error("沒有這個商品");
  if (d.gems < it.price) throw new Error("碎晶不夠");
  d.gems -= it.price; it.sold = true;
  if (it.kind === "heal") { const H = dunHero(d); d.hp = Math.min(H.maxHp, d.hp + Math.round(H.maxHp * 0.3)); return { kind: "dun_buy", msg: "🧪 回了 30% 血" }; }
  addBless(d, it.id);
  return { kind: "dun_buy", msg: `買了「${blessOf(it.id).name}」` };
}
export function dunLeave(st) { const d = needPhase(st, "shop"); nextFloor(d); return { kind: "dun_leave" }; }

/* 結束一場（死掉或撤退）：記錄、發金幣（每天封頂）。分數＝打過幾層。 */
export function endRun(st, today, how) {
  const d = st.dun, cleared = d.floor - 1;
  d.active = false; d.phase = "over";
  const s = st.dunStats = st.dunStats || {};
  const wantGold = 3 * cleared + 10 * d.bosses;
  if (s.goldDay !== today) { s.goldDay = today; s.goldToday = 0; }
  const gold = Math.max(0, Math.min(wantGold, GOLD_DAILY_CAP - s.goldToday));
  s.goldToday += gold; st.gold = (st.gold || 0) + gold;
  const newBest = cleared > (s.best || 0);
  if (newBest) s.best = cleared;
  let newWeek = false;
  if (d.mode === "weekly") {
    if (!s.week || s.week.key !== d.week) s.week = { key: d.week, best: 0 };
    if (cleared > s.week.best) { s.week.best = cleared; newWeek = true; }
  }
  d.last = { how, cleared, gold, capped: gold < wantGold, newBest, newWeek, bosses: d.bosses };
  return { over: true, summary: d.last };
}
export function dunQuit(st, today) {
  if (!st.dun || !st.dun.active) throw new Error("現在沒有在地城裡");
  return { kind: "dun_quit", ...endRun(st, today, "quit") };
}

/* 給前端的樣子：整場的狀態＋現在角色能力＋記錄 */
export function dunPublic(st, today) {
  const d = st.dun, s = st.dunStats || {}, wk = weekKey(today);
  const rec = { best: s.best || 0, weekBest: s.week && s.week.key === wk ? s.week.best : 0, week: wk, runs: s.runs || 0,
    goldToday: s.goldDay === today ? s.goldToday : 0, goldCap: GOLD_DAILY_CAP };
  if (!d) return { run: null, rec };
  const run = { active: d.active, mode: d.mode, floor: d.floor, hp: d.hp, hero: dunHero(d), gems: d.gems, bless: d.bless, forge: d.forge,
    undyingLeft: d.undyingLeft, phase: d.phase, doors: d.doors, offer: d.offer, last: d.last, bosses: d.bosses,
    event: d.event ? { id: d.event, ...EVENTS[d.event] } : null, shop: d.shop };
  return { run, rec };
}
export function dunBoard(rows, meId, today) {
  const wk = weekKey(today);
  const list = rows.filter((r) => r.games && r.games.adv && r.games.adv.dunStats).map((r) => {
    const s = r.games.adv.dunStats;
    return { name: r.username, week: s.week && s.week.key === wk ? s.week.best : 0, best: s.best || 0, me: r.user_id === meId };
  });
  return {
    week: list.filter((x) => x.week > 0).sort((a, b) => b.week - a.week || a.name.localeCompare(b.name)),
    all: list.filter((x) => x.best > 0).sort((a, b) => b.best - a.best || a.name.localeCompare(b.name)),
  };
}
