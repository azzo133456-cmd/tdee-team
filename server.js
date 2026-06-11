import express from "express";
import pg from "pg";
import crypto from "crypto";
import webpush from "web-push";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// VAPID（可用環境變數覆蓋；預設後備供個人/好友用）
const VAPID_PUBLIC = process.env.VAPID_PUBLIC || "BAK-aviDC-bVVVdhF97BpF7mRA4YFvOp2okXmsABmvFw7-Iwxa7mQe5VZVsWFOBRrm_J6TKOJ0yDH3OM7zpuQGs";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || "0nre8o9aIi2AWjH_0wFuKALy8U-V8j6ZUD4GcFvQuNs";
try { webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:tdee@example.com", VAPID_PUBLIC, VAPID_PRIVATE); } catch (e) { console.error("VAPID 設定失敗", e.message); }

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

// Railway 會自動注入 DATABASE_URL（加了 Postgres 外掛之後）
if (!process.env.DATABASE_URL) {
  console.error("❌ 錯誤: 找不到環境變數 DATABASE_URL。");
  console.error("如果您是在 Railway 部署，請確保您已經在專案中新增了 PostgreSQL 資料庫。");
  console.error("如果您是在本機測試，請先設定 DATABASE_URL 環境變數。");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      token TEXT,
      profile JSONB DEFAULT '{}'::jsonb,
      favorites JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS favorites JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS fx TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS racer TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS skin TEXT;
    CREATE TABLE IF NOT EXISTS records (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      weight REAL, kcal INT, protein REAL, fat REAL, carb REAL,
      UNIQUE(user_id, date)
    );
    ALTER TABLE records ADD COLUMN IF NOT EXISTS weight_pm REAL;
    ALTER TABLE records ADD COLUMN IF NOT EXISTS water_ml INT;
    ALTER TABLE records ADD COLUMN IF NOT EXISTS body_fat REAL;
    ALTER TABLE records ADD COLUMN IF NOT EXISTS poop INT;
    CREATE TABLE IF NOT EXISTS meals (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      meal TEXT NOT NULL,
      name TEXT NOT NULL,
      kcal INT, protein REAL, fat REAL, carb REAL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE meals ADD COLUMN IF NOT EXISTS photo TEXT;
    CREATE TABLE IF NOT EXISTS exercises (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      name TEXT NOT NULL,
      minutes REAL,
      kcal INT
    );
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'cardio';
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS sets INT;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS reps INT;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS weight REAL;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS volume REAL;
    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS muscle TEXT;
    CREATE TABLE IF NOT EXISTS recipes (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      items JSONB DEFAULT '[]'::jsonb,
      kcal INT, protein REAL, fat REAL, carb REAL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS plates (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      items JSONB DEFAULT '[]'::jsonb,
      kcal INT,
      thumb TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS shared_foods (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      kcal REAL, protein REAL, fat REAL, carb REAL,
      grams REAL DEFAULT 100,
      kind TEXT DEFAULT 'food',
      created_by INT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS barcodes (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kcal REAL, protein REAL, fat REAL, carb REAL,
      source TEXT DEFAULT 'user',
      created_by INT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS weekly_reviews (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      week_start DATE NOT NULL,
      summary TEXT,
      actions JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, week_start)
    );
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      metric TEXT NOT NULL DEFAULT 'discipline',
      period TEXT NOT NULL DEFAULT 'week',
      created_by INT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE groups ADD COLUMN IF NOT EXISTS season_start DATE DEFAULT CURRENT_DATE;
    ALTER TABLE groups ADD COLUMN IF NOT EXISTS round_no INT DEFAULT 1;
    ALTER TABLE groups ADD COLUMN IF NOT EXISTS stakes TEXT;
    CREATE TABLE IF NOT EXISTS group_seasons (
      id SERIAL PRIMARY KEY,
      group_id INT REFERENCES groups(id) ON DELETE CASCADE,
      round_no INT NOT NULL,
      start_date DATE, end_date DATE,
      winner TEXT, results JSONB DEFAULT '[]',
      settled_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(group_id, round_no)
    );
    ALTER TABLE group_seasons ADD COLUMN IF NOT EXISTS boss BOOLEAN DEFAULT false;
    CREATE TABLE IF NOT EXISTS group_messages (
      id SERIAL PRIMARY KEY,
      group_id INT REFERENCES groups(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS group_members (
      group_id INT REFERENCES groups(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(group_id, user_id)
    );
    -- 隱私安全的每日統計（成員自己計算後上傳；排行榜只用 flag/計數，體重只用來算個人%、不外傳絕對值）
    CREATE TABLE IF NOT EXISTS daily_stats (
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      logged INT DEFAULT 0, kcal_hit INT DEFAULT 0, protein_hit INT DEFAULT 0,
      exercised INT DEFAULT 0, water_hit INT DEFAULT 0,
      ex_count INT DEFAULT 0, volume REAL DEFAULT 0, weight REAL,
      water_pct REAL, protein_pct REAL,
      UNIQUE(user_id, date)
    );
    ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS water_pct REAL;
    ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS protein_pct REAL;
    ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS poop INT;
    ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS body_fat REAL;
    CREATE TABLE IF NOT EXISTS push_subs (
      endpoint TEXT PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      sub JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS pets (
      user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      species TEXT NOT NULL DEFAULT 'cat',
      name TEXT,
      equipped TEXT,
      dex JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE pets ADD COLUMN IF NOT EXISTS coins_spent INT DEFAULT 0;
    ALTER TABLE pets ADD COLUMN IF NOT EXISTS owned JSONB DEFAULT '[]'::jsonb;
  `);
  console.log("DB ready");
}

const app = express();
app.use(express.json({ limit: "8mb" }));
app.use(express.static(join(__dirname, "public")));

/* ---------- 密碼雜湊 ---------- */
function hashPw(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}
function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

/* ---------- 驗證中介層 ---------- */
async function auth(req, res, next) {
  try {
    const token = req.headers["x-token"];
    if (!token) return res.status(401).json({ error: "未登入" });
    const u = await pool.query("SELECT * FROM users WHERE token=$1", [token]);
    if (u.rowCount === 0) return res.status(401).json({ error: "登入已失效，請重新登入" });
    req.user = u.rows[0];
    next();
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
}

/* ---------- 註冊 / 登入 ---------- */
app.post("/api/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (username.length < 2 || password.length < 4)
      return res.status(400).json({ error: "帳號至少 2 字、密碼至少 4 字" });
    const exists = await pool.query("SELECT 1 FROM users WHERE username=$1", [username]);
    if (exists.rowCount > 0) return res.status(409).json({ error: "這個帳號已被註冊" });
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPw(password, salt);
    const token = newToken();
    const u = await pool.query(
      "INSERT INTO users(username,salt,hash,token) VALUES($1,$2,$3,$4) RETURNING id,username,profile",
      [username, salt, hash, token]
    );
    res.json({ token, userId: u.rows[0].id, username, profile: u.rows[0].profile });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const u = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
    if (u.rowCount === 0) return res.status(401).json({ error: "帳號或密碼錯誤" });
    const user = u.rows[0];
    const hash = hashPw(password, user.salt);
    const ok =
      hash.length === user.hash.length &&
      crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.hash));
    if (!ok) return res.status(401).json({ error: "帳號或密碼錯誤" });
    const token = newToken();
    await pool.query("UPDATE users SET token=$1 WHERE id=$2", [token, user.id]);
    res.json({ token, userId: user.id, username: user.username, profile: user.profile });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 變更暱稱 ---------- */
app.put("/api/username", auth, async (req, res) => {
  try {
    const newName = String(req.body.username || "").trim().slice(0, 20);
    if (newName.length < 1) return res.status(400).json({ error: "暱稱不可空白" });
    const oldName = req.user.username;
    if (newName === oldName) return res.json({ ok: true, username: newName });
    const dup = await pool.query("SELECT 1 FROM users WHERE username=$1 AND id<>$2", [newName, req.user.id]);
    if (dup.rowCount) return res.status(409).json({ error: "這個暱稱已被使用" });
    await pool.query("UPDATE users SET username=$1 WHERE id=$2", [newName, req.user.id]);
    // 競賽戰績沿用舊暱稱字串，改名後一併搬移，讓過往冠軍/前三名積分不流失
    await pool.query("UPDATE group_seasons SET winner=$1 WHERE winner=$2", [newName, oldName]);
    const sea = await pool.query("SELECT id,results FROM group_seasons WHERE results::text LIKE $1", ["%" + oldName + "%"]);
    for (const s of sea.rows) {
      if (!Array.isArray(s.results)) continue;
      let changed = false;
      const r = s.results.map((row) => { if (row && row.name === oldName) { changed = true; return { ...row, name: newName }; } return row; });
      if (changed) await pool.query("UPDATE group_seasons SET results=$1 WHERE id=$2", [JSON.stringify(r), s.id]);
    }
    res.json({ ok: true, username: newName });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});

/* ---------- 個人資料 ---------- */
app.put("/api/profile", auth, async (req, res) => {
  try {
    // 合併而非整包覆寫，保留 profile.push 等不在表單欄位裡的設定（否則改基本資料會清掉推播偏好）
    await pool.query("UPDATE users SET profile = COALESCE(profile,'{}'::jsonb) || $1::jsonb WHERE id=$2", [JSON.stringify(req.body || {}), req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 每日紀錄 ---------- */
app.post("/api/record", auth, async (req, res) => {
  try {
    // weight = 早上體重（主要，用於趨勢/反推），weight_pm = 晚上體重
    const { date, weight, weight_pm, body_fat, kcal, protein, fat, carb } = req.body;
    if (!date) return res.status(400).json({ error: "需要日期" });
    await pool.query(
      `INSERT INTO records(user_id,date,weight,weight_pm,body_fat,kcal,protein,fat,carb)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id,date) DO UPDATE SET
         weight=COALESCE(EXCLUDED.weight, records.weight),
         weight_pm=COALESCE(EXCLUDED.weight_pm, records.weight_pm),
         body_fat=COALESCE(EXCLUDED.body_fat, records.body_fat),
         kcal=EXCLUDED.kcal, protein=EXCLUDED.protein,
         fat=EXCLUDED.fat, carb=EXCLUDED.carb`,
      [req.user.id, date, weight ?? null, weight_pm ?? null, body_fat ?? null, kcal ?? null, protein ?? null, fat ?? null, carb ?? null]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.delete("/api/record/:rid", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM records WHERE id=$1 AND user_id=$2", [req.params.rid, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 運動紀錄 ---------- */
app.post("/api/exercise", auth, async (req, res) => {
  try {
    const { date, name, minutes, kcal, kind, sets, reps, weight, volume, muscle } = req.body;
    if (!date || !name) return res.status(400).json({ error: "需要日期與運動項目" });
    await pool.query(
      "INSERT INTO exercises(user_id,date,name,minutes,kcal,kind,sets,reps,weight,volume,muscle) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [req.user.id, date, name, minutes ?? null, kcal ?? null, kind || "cardio", sets ?? null, reps ?? null, weight ?? null, volume ?? null, muscle ?? null]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.delete("/api/exercise/:eid", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM exercises WHERE id=$1 AND user_id=$2", [req.params.eid, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.put("/api/exercise/:eid", auth, async (req, res) => {
  try {
    const { minutes, kcal, sets, reps, weight, volume } = req.body;
    const r = await pool.query(
      `UPDATE exercises SET
         minutes=COALESCE($1,minutes), kcal=COALESCE($2,kcal),
         sets=COALESCE($3,sets), reps=COALESCE($4,reps),
         weight=COALESCE($5,weight), volume=COALESCE($6,volume)
       WHERE id=$7 AND user_id=$8`,
      [minutes ?? null, kcal ?? null, sets ?? null, reps ?? null, weight ?? null, volume ?? null, req.params.eid, req.user.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "找不到紀錄" });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 我的最愛 ---------- */
app.put("/api/favorites", auth, async (req, res) => {
  try {
    const favs = Array.isArray(req.body) ? req.body : [];
    await pool.query("UPDATE users SET favorites=$1 WHERE id=$2", [JSON.stringify(favs), req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 餐別飲食（批次） ---------- */
app.post("/api/meal", auth, async (req, res) => {
  try {
    let { date, meal, items, photo } = req.body;
    if (!date || !meal) return res.status(400).json({ error: "需要日期與餐別" });
    if (!Array.isArray(items)) items = [];
    // 允許只拍照、不輸入食物
    if (items.length === 0) {
      if (!photo) return res.status(400).json({ error: "需要內容或照片" });
      items = [{ name: "📷 照片紀錄", kcal: null, protein: null, fat: null, carb: null }];
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      // 照片只存在該批第一筆，避免重複占空間
      const ph = i === 0 ? (photo ?? null) : null;
      await pool.query(
        "INSERT INTO meals(user_id,date,meal,name,kcal,protein,fat,carb,photo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [req.user.id, date, meal, it.name || "食物", it.kcal ?? null, it.protein ?? null, it.fat ?? null, it.carb ?? null, ph]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.delete("/api/meal/:mid/photo", auth, async (req, res) => {
  try {
    const r = await pool.query("SELECT name FROM meals WHERE id=$1 AND user_id=$2", [req.params.mid, req.user.id]);
    if (r.rowCount === 0) return res.json({ ok: true });
    if (r.rows[0].name === "📷 照片紀錄") {
      await pool.query("DELETE FROM meals WHERE id=$1 AND user_id=$2", [req.params.mid, req.user.id]);
    } else {
      await pool.query("UPDATE meals SET photo=NULL WHERE id=$1 AND user_id=$2", [req.params.mid, req.user.id]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.delete("/api/meal/:mid", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM meals WHERE id=$1 AND user_id=$2", [req.params.mid, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.put("/api/meal/:mid", auth, async (req, res) => {
  try {
    const { name, kcal, protein, fat, carb } = req.body;
    const r = await pool.query(
      `UPDATE meals SET
         name=COALESCE($1,name), kcal=COALESCE($2,kcal), protein=COALESCE($3,protein),
         fat=COALESCE($4,fat), carb=COALESCE($5,carb)
       WHERE id=$6 AND user_id=$7`,
      [name ?? null, kcal ?? null, protein ?? null, fat ?? null, carb ?? null, req.params.mid, req.user.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "找不到紀錄" });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 飲水（設定當日總量） ---------- */
app.post("/api/water", auth, async (req, res) => {
  try {
    const { date, water_ml } = req.body;
    if (!date) return res.status(400).json({ error: "需要日期" });
    await pool.query(
      `INSERT INTO records(user_id,date,water_ml) VALUES($1,$2,$3)
       ON CONFLICT (user_id,date) DO UPDATE SET water_ml=EXCLUDED.water_ml`,
      [req.user.id, date, water_ml ?? 0]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

// 嗯嗯（排便）紀錄：每天次數
app.post("/api/poop", auth, async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: "需要日期" });
    const poop = Math.max(0, Math.min(20, parseInt(req.body.poop, 10) || 0));
    await pool.query(
      `INSERT INTO records(user_id,date,poop) VALUES($1,$2,$3)
       ON CONFLICT (user_id,date) DO UPDATE SET poop=EXCLUDED.poop`,
      [req.user.id, date, poop]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});

/* ---------- 食譜 ---------- */
app.post("/api/recipe", auth, async (req, res) => {
  try {
    const { name, items, kcal, protein, fat, carb } = req.body;
    if (!name || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "需要食譜名稱與內容" });
    await pool.query(
      "INSERT INTO recipes(user_id,name,items,kcal,protein,fat,carb) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [req.user.id, name, JSON.stringify(items), kcal ?? null, protein ?? null, fat ?? null, carb ?? null]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.delete("/api/recipe/:rid", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM recipes WHERE id=$1 AND user_id=$2", [req.params.rid, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 我的餐盤（可拍照存的快速餐點，僅個人、不公開分享） ---------- */
app.post("/api/plate", auth, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 40);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!name || !items.length) return res.status(400).json({ error: "需要餐盤名稱與內容" });
    let thumb = String(req.body.thumb || "");
    if (thumb && (!/^data:image\/[a-zA-Z]+;base64,/.test(thumb) || thumb.length > 60000)) thumb = ""; // 縮圖過大就不存
    const cap = await pool.query("SELECT COUNT(*)::int n FROM plates WHERE user_id=$1", [req.user.id]);
    if (cap.rows[0].n >= 24) return res.status(400).json({ error: "餐盤已達上限(24)，請先刪除一些" });
    await pool.query(
      "INSERT INTO plates(user_id,name,items,kcal,thumb) VALUES($1,$2,$3,$4,$5)",
      [req.user.id, name, JSON.stringify(items), req.body.kcal ?? null, thumb || null]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});
app.delete("/api/plate/:pid", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM plates WHERE id=$1 AND user_id=$2", [req.params.pid, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "伺服器錯誤" }); }
});

/* ---------- 條碼查詢（Open Food Facts 代理） ---------- */
app.get("/api/barcode", auth, async (req, res) => {
  try {
    const code = String(req.query.code || "").replace(/[^0-9]/g, "");
    if (!code) return res.status(400).json({ error: "缺少條碼" });
    // 1) 先查自建條碼庫（含先前手填／標籤辨識／OFF 快取），秒回
    const local = await pool.query("SELECT name,kcal,protein,fat,carb FROM barcodes WHERE code=$1", [code]);
    if (local.rows[0]) {
      const b = local.rows[0];
      return res.json({ found: true, code, n: b.name, k: b.kcal ?? 0, p: b.protein ?? 0, f: b.fat ?? 0, c: b.carb ?? 0, src: "db" });
    }
    // 2) 查不到才打 Open Food Facts
    const r = await fetch(
      "https://world.openfoodfacts.org/api/v2/product/" + code +
        ".json?fields=product_name,product_name_zh,brands,nutriments",
      { headers: { "User-Agent": "TDEE-Tracker/1.0 (personal use)" } }
    );
    if (!r.ok) return res.status(502).json({ error: "查詢失敗" });
    const data = await r.json();
    if (data.status !== 1 || !data.product) return res.json({ found: false, code });
    const p = data.product, nu = p.nutriments || {};
    const name =
      p.product_name_zh || p.product_name ||
      (p.brands ? p.brands.split(",")[0] : "") || ("商品 " + code);
    const k = Math.round((nu["energy-kcal_100g"] ?? 0) * 10) / 10;
    const pr = Math.round((nu["proteins_100g"] ?? 0) * 10) / 10;
    const f = Math.round((nu["fat_100g"] ?? 0) * 10) / 10;
    const c = Math.round((nu["carbohydrates_100g"] ?? 0) * 10) / 10;
    // 3) OFF 有完整數值就順手存回自建庫，下次秒回、也離線可用
    if (k > 0) {
      pool.query(
        `INSERT INTO barcodes(code,name,kcal,protein,fat,carb,source,created_by)
         VALUES($1,$2,$3,$4,$5,$6,'off',$7) ON CONFLICT (code) DO NOTHING`,
        [code, name, k, pr, f, c, req.user.id]
      ).catch(() => {});
    }
    res.json({ found: true, code, n: name, k, p: pr, f, c, src: "off" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 條碼建檔：標籤辨識／手填後存回，下次秒帶（共享） ---------- */
app.post("/api/barcode", auth, async (req, res) => {
  try {
    const b = req.body || {};
    const code = String(b.code || "").replace(/[^0-9]/g, "");
    const name = String(b.name || "").trim();
    if (!code || !name) return res.status(400).json({ error: "缺少條碼或名稱" });
    const num = (v) => Math.round((Number(v) || 0) * 10) / 10;
    await pool.query(
      `INSERT INTO barcodes(code,name,kcal,protein,fat,carb,source,created_by)
       VALUES($1,$2,$3,$4,$5,$6,'user',$7)
       ON CONFLICT (code) DO UPDATE SET
         name=EXCLUDED.name, kcal=EXCLUDED.kcal, protein=EXCLUDED.protein,
         fat=EXCLUDED.fat, carb=EXCLUDED.carb, source='user'`,
      [code, name, num(b.kcal), num(b.protein), num(b.fat), num(b.carb), req.user.id]
    );
    res.json({ ok: true, code });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- Gemini 共用呼叫：多模型備援 + 503/429 退避重試 ---------- */
// flash-lite 通常較不壅塞，作為前段備援；再退到其他版本
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function geminiVision(key, prompt, mime, imgB64, temperature) {
  return geminiParts(key, [{ text: prompt }, { inline_data: { mime_type: mime, data: imgB64 } }], temperature);
}
function geminiText(key, prompt, temperature) {
  return geminiParts(key, [{ text: prompt }], temperature);
}
async function geminiParts(key, parts, temperature) {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature, responseMimeType: "application/json" },
  });
  let lastErr = { status: 502, text: "未知錯誤" };
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const ctrl = AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined;
        const r = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key,
          { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: ctrl }
        );
        if (r.ok) return { data: await r.json(), model };
        const text = await r.text();
        lastErr = { status: r.status, text };
        console.error("Gemini fail", model, r.status, text.slice(0, 160));
        // 503/429 = 過載/限流：退避(含抖動)後重試；其餘錯誤直接換下一個模型
        if (r.status === 503 || r.status === 429) { await sleep(600 * (attempt + 1) + Math.random() * 400); continue; }
        break;
      } catch (err) {
        // 連線中斷/逾時：視為可重試
        lastErr = { status: 503, text: String(err && err.message || err) };
        console.error("Gemini network", model, lastErr.text);
        await sleep(600 * (attempt + 1) + Math.random() * 400);
      }
    }
  }
  return { error: lastErr };
}

// AI 請求限流：三層把關，避免觸發 Gemini 上游(共用金鑰約 15/分)的限流。
//  (1) 每使用者每分鐘 6 次  (2) 同一使用者兩次間隔至少 4 秒  (3) 全站每分鐘 12 次(留安全邊際)
const aiHits = new Map();      // userId -> [timestamps]
const aiLast = new Map();      // userId -> last ts
const aiBusy = new Map();      // userId -> 進行中請求開始時間（in-flight 鎖，防連點/多分頁重送）
let aiGlobal = [];             // 全站時間戳
const AI_USER_MAX = 6, AI_USER_GAP = 4000, AI_GLOBAL_MAX = 12, AI_WIN = 60000;
const AI_BUSY_TTL = 45000;     // 保險：卡住的鎖最久 45 秒自動失效
function aiLimit(req, res, next) {
  const now = Date.now();
  // 背景自動呼叫(每週覆盤)只標記，不參與「連點鎖」，避免害到使用者的手動操作。
  // 注意：bg 仍照常受下面的回數/間隔/全站上限把關，所以就算偽造此標頭也無法繞過限流。
  const bg = req.headers["x-ai-bg"] === "1";
  // 防連點：同一使用者上一個 AI 請求還沒回來，就擋掉重送
  if (!bg) {
    const busyAt = aiBusy.get(req.user.id);
    if (busyAt && now - busyAt < AI_BUSY_TTL) {
      return res.status(429).json({ error: "AI 正在處理你上一個請求，請稍候再操作。" });
    }
  }
  // 全站
  aiGlobal = aiGlobal.filter((t) => now - t < AI_WIN);
  if (aiGlobal.length >= AI_GLOBAL_MAX) {
    const wait = Math.ceil((AI_WIN - (now - aiGlobal[0])) / 1000);
    return res.status(429).json({ error: `AI 服務目前較忙，請 ${wait} 秒後再試。` });
  }
  // 同使用者間隔
  const last = aiLast.get(req.user.id) || 0;
  if (now - last < AI_USER_GAP) {
    const wait = Math.ceil((AI_USER_GAP - (now - last)) / 1000);
    return res.status(429).json({ error: `操作太快，請 ${wait} 秒後再試一次。` });
  }
  // 每使用者每分鐘
  const arr = (aiHits.get(req.user.id) || []).filter((t) => now - t < AI_WIN);
  if (arr.length >= AI_USER_MAX) {
    const wait = Math.ceil((AI_WIN - (now - arr[0])) / 1000);
    return res.status(429).json({ error: `AI 請求太頻繁，請 ${wait} 秒後再試（每分鐘上限 ${AI_USER_MAX} 次）。` });
  }
  arr.push(now); aiHits.set(req.user.id, arr); aiLast.set(req.user.id, now); aiGlobal.push(now);
  if (aiHits.size > 500) { for (const [k, v] of aiHits) if (!v.some((t) => now - t < AI_WIN)) { aiHits.delete(k); aiLast.delete(k); aiBusy.delete(k); } }
  if (bg) { next(); return; }   // 背景呼叫不上連點鎖
  // 上鎖，回應結束（成功或斷線）即釋放
  const uid = req.user.id;
  aiBusy.set(uid, now);
  const release = () => aiBusy.delete(uid);
  res.on("finish", release); res.on("close", release);
  next();
}

/* ---------- AI 食物照片辨識（Gemini 代理） ---------- */
app.post("/api/analyze", auth, aiLimit, async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: "未設定 AI 辨識金鑰" });
    let img = String(req.body.image || "");
    if (!img) return res.status(400).json({ error: "缺少照片" });
    // 接受 data URL 或純 base64
    let mime = "image/jpeg";
    const m = img.match(/^data:(image\/[a-zA-Z]+);base64,(.*)$/);
    if (m) { mime = m[1]; img = m[2]; }

    const hint = String(req.body.hint || "").trim().slice(0, 200);
    const prompt =
      "你是營養師。看這張食物照片，把畫面中的每一道菜／品項分別列出（例如烤雞腿、炒冬粉各算一筆，不要全部加總成一筆）。" +
      "每筆估計其重量與營養。並從菜色內容判斷這比較像哪一餐 meal（只能是『早餐/午餐/晚餐/點心』其一；判斷不出填空字串）。" +
      "只回傳 JSON 物件，不要任何說明文字、不要 markdown 圍欄。格式：" +
      '{"meal":"早餐/午餐/晚餐/點心或空字串","items":[{"name":"中文品名","grams":該品項重量克數,"kcal":熱量,"protein":蛋白質克,"fat":脂肪克,"carb":碳水克}, ...]}。' +
      "name 可帶簡短說明（如「烤雞腿(醬燒)」）。若只有單一品項 items 就只含一筆。" +
      "數字一律為阿拉伯數字（不含單位），無法判斷就用合理概估。" +
      (hint ? "使用者提供的補充提示（請優先採信並據此修正辨識）：「" + hint + "」。" : "");

    const g = await geminiVision(key, prompt, mime, img, 0.2);
    if (g.error) {
      const msg = g.error.status === 503 || g.error.status === 429
        ? "AI 服務目前流量壅塞，請稍候幾秒再試一次"
        : "辨識服務錯誤(" + g.error.status + ")";
      return res.status(502).json({ error: msg });
    }
    const data = g.data;
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = extractJson(txt);
    if (!parsed) return res.status(502).json({ error: "無法解析辨識結果" });
    const num = (v) => (Number.isFinite(+v) ? Math.round(+v * 10) / 10 : 0);
    const rawItems = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : [parsed]);
    const meal = Array.isArray(parsed) ? "" : String(parsed.meal || "").slice(0, 4);
    const items = rawItems.filter((p) => p && (p.name || p.kcal)).map((p) => ({
      name: String(p.name || "辨識食物").slice(0, 40),
      grams: Math.max(1, Math.round(num(p.grams) || 100)),
      kcal: Math.round(num(p.kcal)),
      protein: num(p.protein),
      fat: num(p.fat),
      carb: num(p.carb),
    }));
    if (items.length === 0) return res.status(502).json({ error: "無法辨識內容" });
    res.json({ ok: true, items, meal });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- AI 文字估熱量（Gemini 代理） ---------- */
app.post("/api/estimate", auth, aiLimit, async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: "未設定 AI 辨識金鑰" });
    const text = String(req.body.text || "").trim().slice(0, 300);
    if (!text) return res.status(400).json({ error: "請輸入描述" });
    const prompt =
      "你是營養師。使用者用一句話描述吃了什麼，請估計其營養。把不同品項分別列出。" +
      "若描述有提到重量（如 250g）就用該重量；沒提到就用合理常見份量。" +
      "另外，從描述判斷這餐屬於哪一餐別 meal（只能是『早餐/午餐/晚餐/點心』其一；判斷不出填空字串）。" +
      "只回傳 JSON 物件，不要任何說明文字、不要 markdown 圍欄。格式：" +
      '{"meal":"早餐/午餐/晚餐/點心或空字串","items":[{"name":"中文品名","grams":重量克數,"kcal":熱量,"protein":蛋白質克,"fat":脂肪克,"carb":碳水克}, ...]}。' +
      "數字一律阿拉伯數字（不含單位）。使用者描述：「" + text + "」";
    const g = await geminiText(key, prompt, 0.2);
    if (g.error) {
      const msg = g.error.status === 503 || g.error.status === 429
        ? "AI 服務目前流量壅塞，請稍候幾秒再試一次"
        : "辨識服務錯誤(" + g.error.status + ")";
      return res.status(502).json({ error: msg });
    }
    const txt = g.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = extractJson(txt);
    if (!parsed) return res.status(502).json({ error: "無法解析估算結果" });
    const num = (v) => (Number.isFinite(+v) ? Math.round(+v * 10) / 10 : 0);
    // 相容：可能回物件{meal,items}或舊版純陣列
    const rawItems = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : [parsed]);
    const meal = Array.isArray(parsed) ? "" : String(parsed.meal || "").slice(0, 4);
    const items = rawItems.filter((p) => p && (p.name || p.kcal)).map((p) => ({
      name: String(p.name || "估算食物").slice(0, 40),
      grams: Math.max(1, Math.round(num(p.grams) || 100)),
      kcal: Math.round(num(p.kcal)),
      protein: num(p.protein), fat: num(p.fat), carb: num(p.carb),
    }));
    if (items.length === 0) return res.status(502).json({ error: "無法估算內容" });
    res.json({ ok: true, items, meal });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 營養標示 OCR（Gemini 代理，回傳每100g） ---------- */
app.post("/api/label", auth, aiLimit, async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: "未設定 AI 辨識金鑰" });
    let img = String(req.body.image || "");
    if (!img) return res.status(400).json({ error: "缺少照片" });
    let mime = "image/jpeg";
    const m = img.match(/^data:(image\/[a-zA-Z]+);base64,(.*)$/);
    if (m) { mime = m[1]; img = m[2]; }

    const prompt =
      "這是一張食品包裝的『營養標示』。請讀出表格數值，全部換算成『每 100 公克』的數值。" +
      "若標示只有『每份』與『每包』，請用每份數值除以每份公克數再乘 100 換算成每 100 公克。" +
      "另外請判斷『一份的公克數』(serving，看標示『每一份量 X 公克』；若是飲料用毫升數近似；讀不到填 0)。" +
      "只回傳 JSON，不要說明文字、不要 markdown 圍欄。格式：" +
      '{"name":"商品名稱(看得到就填,看不到填空字串)","serving":一份公克數,"kcal":每100g熱量,"protein":每100g蛋白質克,"fat":每100g脂肪克,"carb":每100g碳水克}。' +
      "數字一律阿拉伯數字、不含單位；讀不到的欄位填 0。";

    const g = await geminiVision(key, prompt, mime, img, 0.1);
    if (g.error) {
      const msg = g.error.status === 503 || g.error.status === 429
        ? "AI 服務目前流量壅塞，請稍候幾秒再試一次"
        : "辨識服務錯誤(" + g.error.status + ")";
      return res.status(502).json({ error: msg });
    }
    const data = g.data;
    const cand = data?.candidates?.[0];
    const txt = cand?.content?.parts?.[0]?.text || "";
    if (!txt) {
      const reason = cand?.finishReason || data?.promptFeedback?.blockReason || "無回應";
      console.error("Gemini label empty", JSON.stringify(data).slice(0, 300));
      return res.status(502).json({ error: "辨識無結果（" + reason + "），請拍清楚一點再試" });
    }
    let parsed;
    try { parsed = JSON.parse(txt); }
    catch {
      const j = txt.match(/\{[\s\S]*\}/);
      if (!j) return res.status(502).json({ error: "無法解析標示：" + txt.slice(0, 120) });
      parsed = JSON.parse(j[0]);
    }
    const num = (v) => (Number.isFinite(+v) ? Math.round(+v * 10) / 10 : 0);
    res.json({
      ok: true,
      name: String(parsed.name || "").slice(0, 40),
      serving: Math.max(0, Math.round(num(parsed.serving))),
      kcal: Math.round(num(parsed.kcal)),
      protein: num(parsed.protein),
      fat: num(parsed.fat),
      carb: num(parsed.carb),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 抽取 Gemini 回傳的 JSON（容錯：去圍欄、抓首個 {}/[]） ---------- */
function extractJson(txt) {
  if (!txt) return null;
  try { return JSON.parse(txt); } catch {}
  const j = txt.match(/\[[\s\S]*\]/) || txt.match(/\{[\s\S]*\}/);
  if (!j) return null;
  try { return JSON.parse(j[0]); } catch { return null; }
}
function geminiErrMsg(status) {
  return status === 503 || status === 429
    ? "AI 服務目前流量壅塞，請稍候幾秒再試一次"
    : "AI 服務錯誤(" + status + ")";
}

/* ---------- AI 教練：每日建議 / 週報點評 / 剩餘額度推薦 ---------- */
app.post("/api/coach", auth, aiLimit, async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: "未設定 AI 金鑰" });
    const b = req.body || {};
    const mode = ["daily", "report", "remain", "shopping"].includes(b.mode) ? b.mode : "daily";
    const goalName = { cut: "減脂", maintain: "維持", bulk: "增肌" }[b.goal] || "維持";
    const j = (o) => JSON.stringify(o || {});
    // 減重計畫脈絡（前端 planContext）→ 轉成給 AI 的白話描述，讓建議對準進度而非泛泛營養
    const p = b.plan || {};
    const planLine = (() => {
      if (!p || !p.tdee) return "";
      const parts = [];
      parts.push("使用者的 TDEE＝" + p.tdee + " kcal（來源：" + (p.tdeeSource || "未知") +
        "，" + (p.tdeeIsReal ? "已是依實際體重/攝取反推的『實測值』" : "目前資料僅 " + (p.dataDays || 0) + " 天、尚不足，仍是公式估算，請提醒這只是暫定、滿約7天會更準") + "）");
      if (p.weight != null) parts.push("目前體重 " + p.weight + " kg" + (p.targetWeight != null ? "、目標 " + p.targetWeight + " kg" : ""));
      if (p.bfNow != null) parts.push("體脂 " + p.bfNow + "%" + (p.bfDelta != null ? "（近期變化 " + (p.bfDelta > 0 ? "+" : "") + p.bfDelta + "%）" : ""));
      if (p.goal === "cut" && p.weeklyObservedKg != null && p.weeklyObservedKg > -0.1 && p.bfDelta != null && p.bfDelta <= -0.3)
        parts.push("注意：體重幾乎沒動但體脂在降，屬於增肌減脂(recomposition)，是好結果、不要誤判為停滯");
      if (p.goal === "cut") {
        if (p.dailyDeficitTarget) parts.push("計畫每日熱量赤字約 " + p.dailyDeficitTarget + " kcal（每週應減約 " + (p.weeklyTargetKg ?? "?") + " kg）");
        if (p.weeklyObservedKg != null) parts.push("實際觀察到每週體重變化 " + p.weeklyObservedKg + " kg" + (p.weeklyObservedKg < 0 ? "（下降中，方向正確）" : p.weeklyObservedKg > 0 ? "（上升中，與減重目標相反）" : "（持平）"));
        if (p.etaText) parts.push("依目前速度預計達標：" + p.etaText);
      }
      return "【減重計畫脈絡】" + parts.join("；") + "。";
    })();
    let prompt;
    if (mode === "remain") {
      // 剩餘額度 → 推薦具體品項（以台灣超商/手搖/常見食物為主）
      prompt =
        "你是營養師兼台灣飲食教練。使用者今天還剩下這些可吃額度（剩餘=目標−已攝取）：" + j(b.remain) +
        "。目標類型：" + goalName + "。" +
        (Array.isArray(b.prefs) && b.prefs.length ? "他常吃：" + b.prefs.slice(0, 12).join("、") + "。" : "") +
        "請推薦 3 個具體、台灣方便取得（超商即食、手搖、自助餐、便當、高蛋白食品等）、且能補足剩餘額度（特別是還缺的蛋白質）的選擇。" +
        "每項給實際份量與營養估計。只回傳 JSON，不要說明文字、不要 markdown：" +
        '{"items":[{"name":"品項(含份量)","kcal":熱量,"protein":蛋白質克,"fat":脂肪克,"carb":碳水克,"reason":"一句為何推薦(20字內)"}]}。' +
        "數字一律阿拉伯數字、不含單位。若剩餘熱量已很少或為負，items 可給低卡高蛋白選項並在 reason 提醒已接近上限。";
    } else if (mode === "shopping") {
      // 一週採購清單：依目標、平均缺口、常吃品項，產出可在台灣超市/超商買到的清單
      prompt =
        "你是營養師兼台灣採購助手。" + planLine +
        "使用者每日營養目標=" + j(b.target) + "，最近平均每日攝取=" + j(b.avg) +
        "（可看出蛋白質或其他常不足之處）。" +
        (Array.isArray(b.prefs) && b.prefs.length ? "他常吃：" + b.prefs.slice(0, 12).join("、") + "。" : "") +
        "請產生一份『一週採購清單』，幫他更容易達成目標（特別補足常缺的蛋白質、增加高纖蔬菜、控制精緻澱粉）。" +
        "品項要在台灣超市/超商/量販買得到，標出大概數量，並分類。只回傳 JSON、不要說明或 markdown：" +
        '{"groups":[{"cat":"分類(如 高蛋白/蔬菜/主食/其他)","items":[{"name":"品項","qty":"建議數量","reason":"一句用途(15字內)"}]}]}。';
    } else if (mode === "report") {
      prompt =
        "你是專屬減重教練。" + planLine +
        "這是使用者近 " + (b.days || 7) + " 天摘要：平均攝取/天=" + j(b.avg) + "，每日目標=" + j(b.target) +
        "，平均運動消耗/天=" + (b.avgBurn || 0) + " kcal，平均淨熱量/天=" + (b.avgNet || 0) + " kcal" +
        (b.weightDelta != null ? "，期間體重變化=" + b.weightDelta + " kg" : "") + "。" +
        "請以『減重進度』為核心做教練點評：(1) 體重趨勢與每週速度，是否符合計畫的目標速度；" +
        "(2) 熱量赤字夠不夠、蛋白質是否足量（保肌）；(3) 最該調整的 1–2 點；(4) 下週一個可執行小目標。" +
        "若 TDEE 還是公式估算（資料不足），請明講『再多記幾天就能算出你真正的 TDEE、屆時目標會更準』，不要過度解讀短期體重波動。" +
        "口語、鼓勵、具體可引用數字，繁體中文。只回傳 JSON：" +
        '{"summary":"2-4句總評","actions":["下週可做的具體小目標1","小目標2"]}。';
    } else {
      prompt =
        "你是專屬減重教練。" + planLine +
        "使用者今天到目前的攝取=" + j(b.today) + "，每日目標=" + j(b.target) +
        "，今天運動消耗=" + (b.burn || 0) + " kcal。" +
        "請針對他的減重計畫給今天剩餘時間的建議：對照目標還能吃多少熱量、蛋白質還缺多少（要吃夠以保留肌肉）、下一餐怎麼安排才不會破壞當天的熱量赤字。" +
        "若 TDEE 仍是公式估算（資料不足）就順帶鼓勵他持續記錄、滿幾天後目標會更精準。" +
        "口語、簡短、具體（可引用數字、給台灣常見食物例子），繁體中文。只回傳 JSON：" +
        '{"summary":"2-3句建議","actions":["可做的具體建議1","建議2"]}。';
    }
    const g = await geminiText(key, prompt, 0.4);
    if (g.error) return res.status(502).json({ error: geminiErrMsg(g.error.status) });
    const txt = g.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = extractJson(txt);
    if (!parsed) return res.status(502).json({ error: "無法解析 AI 回應" });
    const num = (v) => (Number.isFinite(+v) ? Math.round(+v * 10) / 10 : 0);
    if (mode === "remain") {
      const arr = Array.isArray(parsed.items) ? parsed.items : [];
      const items = arr.filter((p) => p && p.name).slice(0, 4).map((p) => ({
        name: String(p.name).slice(0, 40),
        kcal: Math.round(num(p.kcal)), protein: num(p.protein), fat: num(p.fat), carb: num(p.carb),
        reason: String(p.reason || "").slice(0, 40),
      }));
      if (!items.length) return res.status(502).json({ error: "AI 沒有給出建議" });
      return res.json({ ok: true, items });
    }
    if (mode === "shopping") {
      const gs = Array.isArray(parsed.groups) ? parsed.groups : [];
      const groups = gs.filter((x) => x && Array.isArray(x.items)).slice(0, 6).map((x) => ({
        cat: String(x.cat || "其他").slice(0, 16),
        items: x.items.filter((it) => it && it.name).slice(0, 10).map((it) => ({
          name: String(it.name).slice(0, 30), qty: String(it.qty || "").slice(0, 20), reason: String(it.reason || "").slice(0, 24),
        })),
      })).filter((x) => x.items.length);
      if (!groups.length) return res.status(502).json({ error: "AI 沒有給出清單" });
      return res.json({ ok: true, groups });
    }
    const actions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 4).map((s) => String(s).slice(0, 80)) : [];
    res.json({ ok: true, summary: String(parsed.summary || "").slice(0, 400), actions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 每週覆盤：儲存一週的教練點評（每使用者每週一筆） ---------- */
app.post("/api/review", auth, async (req, res) => {
  try {
    const ws = String(req.body.week_start || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ws)) return res.status(400).json({ error: "週起日格式錯誤" });
    const summary = String(req.body.summary || "").slice(0, 600);
    const actions = Array.isArray(req.body.actions) ? req.body.actions.slice(0, 5).map((s) => String(s).slice(0, 120)) : [];
    await pool.query(
      `INSERT INTO weekly_reviews(user_id, week_start, summary, actions)
       VALUES($1,$2,$3,$4)
       ON CONFLICT (user_id, week_start) DO UPDATE SET summary=EXCLUDED.summary, actions=EXCLUDED.actions, created_at=now()`,
      [req.user.id, ws, summary, JSON.stringify(actions)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 推播通知（PWA） ---------- */
app.get("/api/push/key", (req, res) => res.json({ key: VAPID_PUBLIC }));
app.post("/api/push/subscribe", auth, async (req, res) => {
  try {
    const sub = req.body.sub;
    if (!sub || !sub.endpoint) return res.status(400).json({ error: "缺少訂閱" });
    await pool.query(
      `INSERT INTO push_subs(endpoint,user_id,sub) VALUES($1,$2,$3)
       ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, sub=EXCLUDED.sub`,
      [sub.endpoint, req.user.id, JSON.stringify(sub)]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});
app.post("/api/push/unsubscribe", auth, async (req, res) => {
  try { if (req.body.endpoint) await pool.query("DELETE FROM push_subs WHERE endpoint=$1 AND user_id=$2", [req.body.endpoint, req.user.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: "伺服器錯誤" }); }
});
// 提醒偏好存進 profile.push
app.post("/api/push/prefs", auth, async (req, res) => {
  try {
    const p = req.body || {};
    const prefs = { water: !!p.water, log: !!p.log, comp: !!p.comp };
    await pool.query("UPDATE users SET profile = jsonb_set(COALESCE(profile,'{}'::jsonb),'{push}',$1::jsonb) WHERE id=$2", [JSON.stringify(prefs), req.user.id]);
    res.json({ ok: true, prefs });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});
// 測試推播（讓使用者按一下確認有收到）
app.post("/api/push/test", auth, async (req, res) => {
  try { await sendToUser(req.user.id, "🔔 測試通知", "推播設定成功！之後會在這裡提醒你喝水/記錄/競賽。"); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: "伺服器錯誤" }); }
});
async function sendToUser(userId, title, body) {
  const subs = await pool.query("SELECT endpoint, sub FROM push_subs WHERE user_id=$1", [userId]);
  const payload = JSON.stringify({ title, body });
  for (const row of subs.rows) {
    try { await webpush.sendNotification(row.sub, payload); }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await pool.query("DELETE FROM push_subs WHERE endpoint=$1", [row.endpoint]); }
  }
}
// 排程：每分鐘檢查台灣時間，到點就發提醒（記憶體去重，避免同一分鐘重發）
const sentGuard = new Set(); let guardDate = "";
async function reminderTick() {
  try {
    const now = new Date(Date.now() + TW_OFFSET);
    const hm = String(now.getUTCHours()).padStart(2, "0") + ":" + String(now.getUTCMinutes()).padStart(2, "0");
    const dateStr = now.toISOString().slice(0, 10);
    if (dateStr !== guardDate) { sentGuard.clear(); guardDate = dateStr; }
    const WATER = ["10:00", "14:00", "18:00", "20:30"], LOG = "21:00", COMP = "20:00";
    const isWater = WATER.includes(hm), isLog = hm === LOG, isComp = hm === COMP;
    if (!isWater && !isLog && !isComp) return;
    // 取有訂閱且有開啟對應提醒的使用者
    const us = await pool.query(
      `SELECT DISTINCT u.id, u.profile->'push' AS push FROM users u JOIN push_subs ps ON ps.user_id=u.id`);
    for (const u of us.rows) {
      const pf = u.push || {};
      if (isWater && pf.water) {
        const k = u.id + ":water:" + hm; if (!sentGuard.has(k)) { sentGuard.add(k); sendToUser(u.id, "💧 喝水時間", "記得補水，達成今天的飲水目標！"); }
      }
      if (isLog && pf.log) {
        const k = u.id + ":log:" + dateStr; if (!sentGuard.has(k)) {
          const m = await pool.query("SELECT 1 FROM meals WHERE user_id=$1 AND date=$2 LIMIT 1", [u.id, dateStr]);
          if (!m.rows[0]) { sentGuard.add(k); sendToUser(u.id, "📝 今天還沒記錄", "花 30 秒記一下今天吃了什麼，保持連續打卡！"); }
        }
      }
      if (isComp && pf.comp) {
        const k = u.id + ":comp:" + dateStr; if (!sentGuard.has(k)) {
          const g = await pool.query(
            `SELECT 1 FROM groups gr JOIN group_members gm ON gm.group_id=gr.id
             WHERE gm.user_id=$1 AND (gr.season_start + (CASE gr.period WHEN 'day' THEN 1 WHEN 'month' THEN 30 ELSE 7 END) - 1) = $2::date LIMIT 1`,
            [u.id, dateStr]);
          if (g.rows[0]) { sentGuard.add(k); sendToUser(u.id, "🏆 競賽今天結算", "衝刺最後機會！看看你這輪的名次。"); }
        }
      }
    }
  } catch (e) { console.error("reminderTick", e.message); }
}
setInterval(reminderTick, 60000);

/* ---------- 自訂頭像（積分獎勵；小圖存 base64） ---------- */
app.post("/api/avatar", auth, async (req, res) => {
  try {
    let img = String(req.body.image || "");
    if (img && !/^data:image\/[a-zA-Z]+;base64,/.test(img)) return res.status(400).json({ error: "圖片格式錯誤" });
    if (img.length > 90000) return res.status(413).json({ error: "圖片太大，請換小一點的" });
    await pool.query("UPDATE users SET avatar=$1 WHERE id=$2", [img || null, req.user.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});

/* ---------- 名稱特效 + 賽道角色（積分解鎖，存使用者選擇，讓所有競賽都套用） ---------- */
app.post("/api/cosmetic", auth, async (req, res) => {
  try {
    // fx：fx0~fx15；racer：單一表情符號或空字串（空＝預設旗子）。null=不更動該欄
    const fx = req.body.fx === undefined ? undefined : (req.body.fx === null ? null : String(req.body.fx).slice(0, 8));
    const racer = req.body.racer === undefined ? undefined : (req.body.racer === null ? null : String(req.body.racer).slice(0, 8));
    const skin = req.body.skin === undefined ? undefined : (req.body.skin === null ? null : String(req.body.skin).slice(0, 12));
    if (fx !== undefined) await pool.query("UPDATE users SET fx=$1 WHERE id=$2", [fx || null, req.user.id]);
    if (racer !== undefined) await pool.query("UPDATE users SET racer=$1 WHERE id=$2", [racer || null, req.user.id]);
    if (skin !== undefined) await pool.query("UPDATE users SET skin=$1 WHERE id=$2", [skin || null, req.user.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});

/* ---------- 寵物 API（成長由 daily_stats 權威推算，不碰 AI） ---------- */
async function trophyCount(username) {
  const r = await pool.query("SELECT COUNT(*)::int AS n FROM group_seasons WHERE winner=$1", [username]);
  return (r.rows[0] && r.rows[0].n) || 0;
}
async function computePet(userId) {
  const [petR, statR, uR] = await Promise.all([
    pool.query("SELECT * FROM pets WHERE user_id=$1", [userId]),
    pool.query("SELECT date::text,logged,kcal_hit,protein_hit,exercised,water_hit,poop FROM daily_stats WHERE user_id=$1", [userId]),
    pool.query("SELECT username FROM users WHERE id=$1", [userId]),
  ]);
  const trophies = uR.rows.length ? await trophyCount(uR.rows[0].username) : 0;
  return { state: petStateFromRows(petR.rows[0] || null, statR.rows, trophies), row: petR.rows[0] || null };
}
app.get("/api/pet", auth, async (req, res) => {
  try {
    const { state, row } = await computePet(req.user.id);
    // 回寫圖鑑（達到新階段時持久化）
    if (row && JSON.stringify(row.dex || []) !== JSON.stringify(state.dex)) {
      await pool.query("UPDATE pets SET dex=$1 WHERE user_id=$2", [JSON.stringify(state.dex), req.user.id]);
    }
    res.json({ pet: state, species: PET_SPECIES, stageNames: PET_STAGE_NAMES, stageExp: PET_STAGE_EXP, shop: PET_SHOP });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});
app.post("/api/pet/buy", auth, async (req, res) => {
  try {
    const item = String(req.body.item || "");
    const price = PET_SHOP_PRICE[item];
    if (!price) return res.status(400).json({ error: "商店沒有這個飾品" });
    const { state, row } = await computePet(req.user.id);
    if (!row) return res.status(400).json({ error: "還沒領養寵物" });
    if (state.owned.includes(item) || state.unlocked.includes(item)) return res.status(400).json({ error: "已經有這個飾品了" });
    if (state.coins < price) return res.status(400).json({ error: `骨頭幣不夠（需要 ${price}，你有 ${state.coins}）` });
    const owned = state.owned.concat([item]);
    await pool.query("UPDATE pets SET owned=$1, coins_spent=COALESCE(coins_spent,0)+$2 WHERE user_id=$3",
      [JSON.stringify(owned), price, req.user.id]);
    const { state: ns } = await computePet(req.user.id);
    res.json({ pet: ns });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});
app.post("/api/pet/choose", auth, async (req, res) => {
  try {
    const species = String(req.body.species || "").trim();
    if (!(species in PET_SPECIES)) return res.status(400).json({ error: "沒有這種寵物" });
    const name = req.body.name === undefined ? null : String(req.body.name || "").trim().slice(0, 16) || null;
    await pool.query(
      `INSERT INTO pets(user_id,species,name) VALUES($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET species=$2, name=COALESCE($3,pets.name)`,
      [req.user.id, species, name]
    );
    const { state } = await computePet(req.user.id);
    res.json({ pet: state });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});
app.put("/api/pet", auth, async (req, res) => {
  try {
    const exists = await pool.query("SELECT 1 FROM pets WHERE user_id=$1", [req.user.id]);
    if (!exists.rowCount) return res.status(400).json({ error: "還沒領養寵物" });
    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim().slice(0, 16) || null;
      await pool.query("UPDATE pets SET name=$1 WHERE user_id=$2", [name, req.user.id]);
    }
    if (req.body.equipped !== undefined) {
      // 只能戴已解鎖的飾品（伺服器再驗一次）
      const { state } = await computePet(req.user.id);
      const want = String(req.body.equipped || "");
      const eq = want && state.equippable.includes(want) ? want : null;
      await pool.query("UPDATE pets SET equipped=$1 WHERE user_id=$2", [eq, req.user.id]);
    }
    const { state } = await computePet(req.user.id);
    res.json({ pet: state });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});

/* ---------- 群組競賽（不暴露彼此體重，只比分數/相對%） ---------- */
const isoD = (d) => { const o = d.getTimezoneOffset(); return new Date(d - o * 60000).toISOString().slice(0, 10); };
// 一律以台灣時間(UTC+8)判斷「今天」，避免伺服器 UTC 造成競賽/打卡差一天
const TW_OFFSET = 8 * 3600 * 1000;
// 「一天」的分界改成凌晨 4 點（夜貓族友善）：00:00–03:59 仍算前一天，每日賽結算時間＝隔天 04:00。
const DAY_CUTOFF_MS = 4 * 3600 * 1000;
const twToday = () => new Date(Date.now() + TW_OFFSET - DAY_CUTOFF_MS).toISOString().slice(0, 10);
const roundLen = (period) => (period === "day" ? 1 : period === "month" ? 30 : 7);
// 每座冠軍積分：每日15 / 每週100 / 每月500
const periodPoints = (period) => (period === "day" ? 15 : period === "month" ? 500 : 100);
// 前三名積分 [冠, 亞, 季]：亞=50%、季=30%（四捨五入）
const placePoints = (period) => { const p = periodPoints(period); return [p, Math.round(p * 0.5), Math.round(p * 0.3)]; };
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return isoD(d); };

/* ---------- 養寵物（純規則計算，不碰 AI；成長＝所有健康行為，持久夥伴） ---------- */
const PET_SPECIES = {
  cat:    { label: "貓", stages: ["🥚", "🐱", "🐈", "😺", "🦁"] },
  dog:    { label: "狗", stages: ["🥚", "🐶", "🐕", "🦮", "🐺"] },
  dragon: { label: "龍", stages: ["🥚", "🐣", "🦎", "🐉", "🐲"] },
  sprout: { label: "芽芽", stages: ["🌰", "🌱", "🌿", "🪴", "🌳"] },
  chick:  { label: "小雞", stages: ["🥚", "🐤", "🐥", "🐔", "🦅"] },
};
const PET_STAGE_NAMES = ["蛋", "幼體", "成長期", "成體", "進化體"];
const PET_STAGE_EXP = [0, 50, 200, 600, 1500];
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
// 從 daily_stats 算累積 EXP（伺服器端權威計算，防作弊）；每項行為給分，連續達標另有加成
function petExpFromRows(rows) {
  let exp = 0;
  const loggedDates = rows.filter((r) => r.logged).map((r) => r.date).sort();
  rows.forEach((r) => {
    if (r.logged) exp += 10;
    if (r.kcal_hit) exp += 8;
    if (r.protein_hit) exp += 5;
    if (r.exercised) exp += 5;
    if (r.water_hit) exp += 4;
    if ((r.poop || 0) > 0) exp += 3;
  });
  let prev = null, run = 0;
  for (const d of loggedDates) {                          // 連續達標：越長餵得越多（每日上限 +20）
    if (prev && addDays(prev, 1) === d) { run++; exp += Math.min(run * 2, 20); } else run = 0;
    prev = d;
  }
  return { exp, lastLogged: loggedDates.length ? loggedDates[loggedDates.length - 1] : null };
}
const petStageIdx = (exp) => { let i = 0; for (let k = 0; k < PET_STAGE_EXP.length; k++) if (exp >= PET_STAGE_EXP[k]) i = k; return i; };
// 🦴 骨頭幣：每日記錄/達標賺幣，奪牌加碼。花幣不影響競賽積分（兩條線分開）。
function petCoinsFromRows(rows, trophies) {
  let c = 0;
  rows.forEach((r) => {
    if (r.logged) c += 5;
    if (r.kcal_hit) c += 3;
    if (r.exercised) c += 3;
    if (r.water_hit) c += 2;
    if (r.protein_hit) c += 2;
    if ((r.poop || 0) > 0) c += 1;
  });
  return c + (trophies || 0) * 50;     // 每座獎盃 +50 幣
}
// 飾品商店（用骨頭幣買；與「達標/獎盃免費解鎖」的飾品不重複）
const PET_SHOP = [
  { it: "🧢", name: "鴨舌帽", price: 40 },
  { it: "🍭", name: "棒棒糖", price: 50 },
  { it: "🎈", name: "氣球", price: 60 },
  { it: "🕶️", name: "墨鏡", price: 80 },
  { it: "🎒", name: "小背包", price: 110 },
  { it: "🎓", name: "學士帽", price: 150 },
  { it: "🪄", name: "魔法棒", price: 220 },
  { it: "💎", name: "鑽石飾", price: 300 },
];
const PET_SHOP_PRICE = Object.fromEntries(PET_SHOP.map((s) => [s.it, s.price]));
// 把 pet 資料列 + 統計 + 獎盃數 → 完整寵物狀態（輕度衰減：掉心情＋少量EXP，但不退階）
function petStateFromRows(petRow, rows, trophies) {
  const species = (petRow && petRow.species) || "cat";
  const sp = PET_SPECIES[species] || PET_SPECIES.cat;
  const { exp: rawExp, lastLogged } = petExpFromRows(rows);
  const today = twToday();
  const daysSince = lastLogged ? Math.max(0, daysBetween(lastLogged, today)) : 0;
  const stageIdx = petStageIdx(rawExp);                   // 階段由原始EXP決定→永不退階
  const penalty = Math.max(0, daysSince - 1) * 4;         // 輕衰減：漏記第2天起每天 -4 EXP
  const exp = Math.max(PET_STAGE_EXP[stageIdx], rawExp - penalty);  // 地板＝目前階段門檻
  const mood = Math.max(15, Math.min(100, 100 - daysSince * 15));
  const moodLabel = mood >= 70 ? "開心" : mood >= 40 ? "普通" : "想睡";
  const moodFace = mood >= 70 ? "😀" : mood >= 40 ? "🙂" : "😴";
  const nextExp = stageIdx < PET_STAGE_EXP.length - 1 ? PET_STAGE_EXP[stageIdx + 1] : null;
  // 解鎖的裝飾品：EXP 里程碑 + 競賽獎盃
  const unlocked = [];
  if (rawExp >= 200) unlocked.push("🧣");
  if (rawExp >= 600) unlocked.push("🎀");
  if (rawExp >= 1500) unlocked.push("✨");
  if (trophies >= 1) unlocked.push("🎩");
  if (trophies >= 3) unlocked.push("👑");
  if (trophies >= 5) unlocked.push("🌟");
  // 🦴 骨頭幣：賺到的總額 − 已花費 ＝ 餘額；商店買到的飾品收進 owned
  const earnedCoins = petCoinsFromRows(rows, trophies);
  const spent = (petRow && petRow.coins_spent) || 0;
  const coins = Math.max(0, earnedCoins - spent);
  const owned = Array.isArray(petRow && petRow.owned) ? petRow.owned.slice() : [];
  const equippable = unlocked.concat(owned.filter((o) => !unlocked.includes(o)));  // 免費解鎖 ∪ 已購買
  let equipped = petRow && petRow.equipped;
  if (equipped && !equippable.includes(equipped)) equipped = null;   // 還沒解鎖/未購買的不給戴
  // 圖鑑：本物種達到的最高階段（合併舊紀錄）
  const dex = Array.isArray(petRow && petRow.dex) ? petRow.dex.slice() : [];
  const di = dex.findIndex((d) => d && d.species === species);
  if (di < 0) dex.push({ species, maxStage: stageIdx });
  else if ((dex[di].maxStage || 0) < stageIdx) dex[di].maxStage = stageIdx;
  return {
    chosen: !!petRow, species, speciesLabel: sp.label, name: (petRow && petRow.name) || sp.label,
    emoji: sp.stages[stageIdx], stageIdx, stageName: PET_STAGE_NAMES[stageIdx],
    exp, rawExp, nextExp, mood, moodLabel, moodFace, daysSince, lastLogged,
    equipped: equipped || "", unlocked, owned, equippable, coins, dex, trophies,
  };
}

// 在 [since, until] 窗內計分
function scoreMember(rows, metric, since, until) {
  const today = twToday();
  const win = rows.filter((r) => r.date >= since && r.date <= until);
  if (metric === "exercise") {
    const cnt = win.reduce((a, r) => a + (r.ex_count || 0), 0);
    const vol = win.reduce((a, r) => a + (+r.volume || 0), 0);
    return { score: cnt, detail: cnt + " 次" + (vol ? " · " + Math.round(vol).toLocaleString() + "kg" : "") };
  }
  if (metric === "weightpct") {
    // 基準＝視窗開始前最後一次體重(沒有就用視窗內第一筆)；現值＝視窗內最後一次體重
    const all = rows.filter((r) => r.weight != null && r.date <= until).sort((a, b) => (a.date < b.date ? -1 : 1));
    const inWin = all.filter((r) => r.date >= since);
    const pre = all.filter((r) => r.date < since);
    const current = inWin.length ? inWin[inWin.length - 1] : (all.length ? all[all.length - 1] : null);
    const baseline = pre.length ? pre[pre.length - 1] : (inWin.length ? inWin[0] : null);
    if (!current || !baseline) return { score: 0, detail: "尚無體重", sortAsc: true };
    if (current.date === baseline.date) return { score: 0, detail: "待下次量測", sortAsc: true };
    const pct = +(((+current.weight - +baseline.weight) / +baseline.weight) * 100).toFixed(1);
    return { score: pct, detail: (pct > 0 ? "+" : "") + pct + "%", sortAsc: true };
  }
  if (metric === "bodyfat") {
    // 體脂變化%（下降越多越前面），基準同 weightpct 算法
    const all = rows.filter((r) => r.body_fat != null && r.date <= until).sort((a, b) => (a.date < b.date ? -1 : 1));
    const inWin = all.filter((r) => r.date >= since);
    const pre = all.filter((r) => r.date < since);
    const current = inWin.length ? inWin[inWin.length - 1] : (all.length ? all[all.length - 1] : null);
    const baseline = pre.length ? pre[pre.length - 1] : (inWin.length ? inWin[0] : null);
    if (!current || !baseline) return { score: 0, detail: "尚無體脂", sortAsc: true };
    if (current.date === baseline.date) return { score: 0, detail: "待下次量測", sortAsc: true };
    const d = +(+current.body_fat - +baseline.body_fat).toFixed(1);
    return { score: d, detail: (d > 0 ? "+" : "") + d + "%", sortAsc: true };
  }
  if (metric === "volume") {
    const vol = win.reduce((a, r) => a + (+r.volume || 0), 0);
    return { score: Math.round(vol), detail: Math.round(vol).toLocaleString() + " kg" };
  }
  if (metric === "kcaldays") {
    const cnt = win.reduce((a, r) => a + (r.kcal_hit || 0), 0);
    return { score: cnt, detail: cnt + " 天達標" };
  }
  const streakOf = () => {
    const set = new Set(rows.filter((r) => r.logged).map((r) => r.date));
    const end = until < today ? until : today;       // 賽季窗的尾端（過去輪用 until，本輪用今天）
    let s = 0; const d = new Date(end + "T00:00:00");
    if (!set.has(isoD(d))) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 400; i++) { const ds = isoD(d); if (ds < since) break; if (set.has(ds)) { s++; d.setDate(d.getDate() - 1); } else break; }
    return s;
  };
  if (metric === "streak") { const s = streakOf(); return { score: s, detail: s + " 天" }; }
  if (metric === "protein") {
    const ps = win.filter((r) => r.protein_pct != null);
    if (!ps.length) return { score: 0, detail: "尚無紀錄" };
    const avg = ps.reduce((a, r) => a + (+r.protein_pct || 0), 0) / ps.length;
    return { score: Math.round(avg), detail: Math.round(avg) + "%（平均達成率）" };
  }
  if (metric === "water") {
    // 平均每日喝水達成率（已喝ML ÷ 該喝ML）；只計有記錄的天
    const ws = win.filter((r) => r.water_pct != null);
    if (!ws.length) return { score: 0, detail: "尚無紀錄" };
    const avg = ws.reduce((a, r) => a + (+r.water_pct || 0), 0) / ws.length;
    return { score: Math.round(avg), detail: Math.round(avg) + "%（平均達成率）" };
  }
  const disc = win.reduce((a, r) => a + (r.logged || 0) + (r.kcal_hit || 0) + (r.protein_hit || 0) + (r.exercised || 0) + (r.water_hit || 0), 0);
  if (metric === "all") {
    const exc = win.reduce((a, r) => a + (r.ex_count || 0), 0);
    const total = disc + streakOf() + exc;
    return { score: total, detail: total + " 分（自律" + disc + "·連" + streakOf() + "·動" + exc + "）" };
  }
  if (metric === "poop") {
    const cnt = win.reduce((a, r) => a + Math.max(0, +r.poop || 0), 0);
    const days = win.filter((r) => (+r.poop || 0) > 0).length;
    return { score: cnt, detail: cnt + " 次" + (days ? "（" + days + " 天）" : "") };
  }
  if (metric === "team") return { score: disc, detail: disc + " 分" }; // 合作：個人貢獻，前端加總
  // discipline（自律分）
  return { score: disc, detail: disc + " 分" };
}
// 名稱特效階級（與前端 FX_TIERS 對齊）：[最低分, cls]
const FX_MINS = [[0,"fx0"],[50,"fx1"],[120,"fx2"],[220,"fx3"],[280,"fx4"],[350,"fx5"],[500,"fx6"],[700,"fx7"],[950,"fx8"],[1100,"fx9"],[1300,"fx10"],[1600,"fx11"],[2000,"fx12"],[2800,"fx13"],[3500,"fx14"],[5000,"fx15"]];
function clsForPoints(pts) { let c = "fx0"; for (const [m, cls] of FX_MINS) if (pts >= m) c = cls; return c; }
// 造型有效值集合（解鎖門檻由前端把關；後端只驗證是已知的造型，不用每組積分當門檻）
const FX_MIN_MAP = Object.fromEntries(FX_MINS.map(([m, cls]) => [cls, m]));
const RACER_MINS = { "🏁": 0, "🐢": 30, "🐹": 70, "🐱": 110, "🐇": 160, "🐧": 230, "🐕": 320, "🐨": 420, "🐖": 540, "🦊": 680, "🐼": 850, "🐐": 1050, "🦌": 1300, "🐅": 1600, "🦁": 2000, "🐎": 2500, "🦅": 3200, "🐬": 4000, "🦄": 5000, "🐉": 6500, "🚀": 8000 };
function memberPoints(rows, trophyCount) {
  const act = rows.reduce((a, r) => a + (r.logged || 0) + (r.kcal_hit || 0) + (r.protein_hit || 0) + (r.exercised || 0) + (r.water_hit || 0), 0);
  return act + (trophyCount || 0) * 100;
}
// 魔王輪：以群組id+輪次決定（約每 4 輪一次），奪冠可得雙倍獎盃。前後端一致、可預測。
function isBossRound(groupId, roundNo) { return (((groupId * 7 + roundNo * 13) % 4) === 0); }
function genCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = "";
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
// 上傳自己近期每日統計（成員自算 flag，體重僅供算個人%、不外傳）
app.post("/api/dailystats", auth, async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 400) : [];
    for (const r of rows) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date || ""))) continue;
      const b = (v) => (v ? 1 : 0);
      await pool.query(
        `INSERT INTO daily_stats(user_id,date,logged,kcal_hit,protein_hit,exercised,water_hit,ex_count,volume,weight,water_pct,protein_pct,poop,body_fat)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (user_id,date) DO UPDATE SET
           logged=EXCLUDED.logged,kcal_hit=EXCLUDED.kcal_hit,protein_hit=EXCLUDED.protein_hit,
           exercised=EXCLUDED.exercised,water_hit=EXCLUDED.water_hit,ex_count=EXCLUDED.ex_count,
           volume=EXCLUDED.volume,weight=EXCLUDED.weight,water_pct=EXCLUDED.water_pct,protein_pct=EXCLUDED.protein_pct,poop=EXCLUDED.poop,body_fat=EXCLUDED.body_fat`,
        [req.user.id, r.date, b(r.logged), b(r.kcal_hit), b(r.protein_hit), b(r.exercised), b(r.water_hit),
         Math.max(0, Math.round(+r.ex_count || 0)), Math.max(0, +r.volume || 0), r.weight != null ? +r.weight : null,
         r.water_pct != null ? Math.max(0, Math.min(300, +r.water_pct)) : null,
         r.protein_pct != null ? Math.max(0, Math.min(300, +r.protein_pct)) : null,
         r.poop != null ? Math.max(0, Math.min(20, Math.round(+r.poop))) : null,
         r.body_fat != null ? +r.body_fat : null]
      );
    }
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});
// 建立群組
app.post("/api/group", auth, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 40) || "減重小隊";
    const metric = ["discipline", "streak", "weightpct", "bodyfat", "exercise", "volume", "kcaldays", "all", "protein", "water", "poop", "team"].includes(req.body.metric) ? req.body.metric : "discipline";
    const period = ["day", "week", "month"].includes(req.body.period) ? req.body.period : "week";
    let code, ok = false;
    for (let i = 0; i < 5 && !ok; i++) { code = genCode(); const e = await pool.query("SELECT 1 FROM groups WHERE code=$1", [code]); if (!e.rows[0]) ok = true; }
    const stakes = String(req.body.stakes || "").trim().slice(0, 120) || null;
    const g = await pool.query("INSERT INTO groups(name,code,metric,period,created_by,season_start,round_no,stakes) VALUES($1,$2,$3,$4,$5,$7,1,$6) RETURNING id", [name, code, metric, period, req.user.id, stakes, twToday()]);
    await pool.query("INSERT INTO group_members(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [g.rows[0].id, req.user.id]);
    res.json({ ok: true, id: g.rows[0].id, code });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});
// 用邀請碼加入
app.post("/api/group/join", auth, async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const g = await pool.query("SELECT id FROM groups WHERE code=$1", [code]);
    if (!g.rows[0]) return res.status(404).json({ error: "找不到這個邀請碼" });
    await pool.query("INSERT INTO group_members(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [g.rows[0].id, req.user.id]);
    res.json({ ok: true, id: g.rows[0].id });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});
// 離開群組（建立者離開＝解散）
app.post("/api/group/:id/leave", auth, async (req, res) => {
  try {
    const gid = +req.params.id;
    const g = await pool.query("SELECT created_by FROM groups WHERE id=$1", [gid]);
    if (g.rows[0] && g.rows[0].created_by === req.user.id) await pool.query("DELETE FROM groups WHERE id=$1", [gid]);
    else await pool.query("DELETE FROM group_members WHERE group_id=$1 AND user_id=$2", [gid, req.user.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});
// 我的群組 + 排行榜（只回暱稱與分數，不含體重/攝取細節）
app.get("/api/groups", auth, async (req, res) => {
  try {
    const mine = await pool.query(
      `SELECT g.* FROM groups g JOIN group_members m ON m.group_id=g.id WHERE m.user_id=$1 ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    const today = twToday();
    const out = [];
    for (const g of mine.rows) {
      const mem = await pool.query(
        `SELECT u.id,u.username,u.avatar,u.fx,u.racer,u.skin FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=$1`, [g.id]);
      const avatarByName = {}, fxByName = {}, racerByName = {}, skinByName = {};
      mem.rows.forEach((u) => { if (u.avatar) avatarByName[u.username] = u.avatar; if (u.fx) fxByName[u.username] = u.fx; if (u.racer) racerByName[u.username] = u.racer; if (u.skin) skinByName[u.username] = u.skin; });
      // 一次抓齊所有成員統計（避免 N+1）
      const rowsByUser = {};
      mem.rows.forEach((u) => { rowsByUser[u.id] = []; });
      const ids = mem.rows.map((u) => u.id);
      const petByUid = {};
      if (ids.length) {
        const st = await pool.query("SELECT user_id,date::text,logged,kcal_hit,protein_hit,exercised,water_hit,ex_count,volume,weight,water_pct,protein_pct,poop,body_fat FROM daily_stats WHERE user_id = ANY($1) ORDER BY date", [ids]);
        st.rows.forEach((r) => { (rowsByUser[r.user_id] = rowsByUser[r.user_id] || []).push(r); });
        const pr = await pool.query("SELECT * FROM pets WHERE user_id = ANY($1)", [ids]);
        pr.rows.forEach((p) => { petByUid[p.user_id] = p; });
      }
      const len = roundLen(g.period);
      const asc = g.metric === "weightpct" || g.metric === "bodyfat";   // 變化%越低(降越多)越前面
      const buildBoard = (since, until) => {
        const b = mem.rows.map((u) => { const r = scoreMember(rowsByUser[u.id], g.metric, since, until); return { name: u.username, me: u.id === req.user.id, score: r.score, detail: r.detail }; });
        b.sort((a, b2) => asc ? a.score - b2.score : b2.score - a.score);
        return b;
      };
      // === 賽季結算：把已結束的輪次寫入 group_seasons，並把 season_start 推進到含今天的輪 ===
      let seasonStart = (g.season_start instanceof Date ? isoD(g.season_start) : String(g.season_start)).slice(0, 10);
      let roundNo = g.round_no || 1;
      let guard = 0;
      while (guard++ < 24) {
        const end = addDays(seasonStart, len - 1);
        if (today <= end) break;                      // 本輪還沒結束
        const finalBoard = buildBoard(seasonStart, end);
        const winner = finalBoard.length && (finalBoard[0].score !== 0 || g.metric === "weightpct") ? finalBoard[0].name : null;
        await pool.query(
          `INSERT INTO group_seasons(group_id,round_no,start_date,end_date,winner,results,boss) VALUES($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (group_id,round_no) DO NOTHING`,
          [g.id, roundNo, seasonStart, end, winner, JSON.stringify(finalBoard.slice(0, 10)), isBossRound(g.id, roundNo)]
        );
        seasonStart = addDays(end, 1);
        roundNo += 1;
      }
      if (seasonStart !== (g.season_start instanceof Date ? isoD(g.season_start) : String(g.season_start).slice(0, 10)) || roundNo !== (g.round_no || 1)) {
        await pool.query("UPDATE groups SET season_start=$1, round_no=$2 WHERE id=$3", [seasonStart, roundNo, g.id]);
      }
      // 本輪排行
      const seasonEnd = addDays(seasonStart, len - 1);
      const board = buildBoard(seasonStart, seasonEnd);
      // 團隊合作：總分與目標
      let team = null;
      if (g.metric === "team") team = { total: board.reduce((a, m) => a + (m.score || 0), 0), goal: board.length * len * 5 };
      // 戰績：歷屆冠軍 + 獎盃統計
      const seasons = await pool.query("SELECT round_no,start_date::text,end_date::text,winner,boss FROM group_seasons WHERE group_id=$1 ORDER BY round_no DESC LIMIT 8", [g.id]);
      const trophies = {}, trophyPts = {};
      const place = placePoints(g.period);   // [冠,亞,季] 積分（依週期）
      // 依每輪 results 的前三名給分（修正：不只冠軍，前三名都有分；魔王輪雙倍）。舊資料若無 results 則只給冠軍。
      const allSeasons = await pool.query("SELECT winner,boss,results FROM group_seasons WHERE group_id=$1 AND winner IS NOT NULL", [g.id]);
      allSeasons.rows.forEach((s) => {
        const mult = s.boss ? 2 : 1;
        trophies[s.winner] = (trophies[s.winner] || 0) + 1;                         // 🏆 座數＝冠軍次數
        let podium = Array.isArray(s.results) ? s.results : [];
        if (!podium.length && s.winner) podium = [{ name: s.winner }];
        podium.slice(0, 3).forEach((row, idx) => {
          const nm = row && row.name; if (!nm) return;
          trophyPts[nm] = (trophyPts[nm] || 0) + place[idx] * mult;
        });
      });
      const uidByName = {}; mem.rows.forEach((u) => { uidByName[u.username] = u.id; });
      board.forEach((m) => {
        m.trophies = trophies[m.name] || 0;
        m.trophyPts = trophyPts[m.name] || 0;
        // auto 特效用「自律分(不含本組獎盃)」計算，確保同一人在每個組看到的預設特效一致
        const actPts = memberPoints(rowsByUser[uidByName[m.name]] || [], 0);
        // 名稱特效：優先用本人選的造型（解鎖門檻由前端把關），否則用自律分對應特效
        const picked = fxByName[m.name];
        m.fx = (picked && picked in FX_MIN_MAP) ? picked : clsForPoints(actPts);
        // 賽道角色：本人選的動物 / 頭像，否則預設旗子
        const pr = racerByName[m.name];
        m.racer = (pr && (pr in RACER_MINS || pr === "avatar")) ? pr : "🏁";
        if (skinByName[m.name]) m.skin = skinByName[m.name];   // 各自的賽道皮膚（給所有人看）
        if (avatarByName[m.name]) m.avatar = avatarByName[m.name];
        // 寵物（給所有人看）：只送顯示用的最小資訊，不洩漏體重/詳細數據
        const uid = uidByName[m.name];
        if (petByUid[uid]) {
          const ps = petStateFromRows(petByUid[uid], rowsByUser[uid] || [], trophies[m.name] || 0);
          m.pet = { emoji: ps.emoji, hat: ps.equipped, stage: ps.stageName, mood: ps.moodFace };
        }
      });
      // 留言／加油（最近 20 則，最舊在前），不洩漏體重
      const msgs = await pool.query(
        `SELECT m.body, m.created_at, u.username FROM group_messages m JOIN users u ON u.id=m.user_id
         WHERE m.group_id=$1 ORDER BY m.id DESC LIMIT 20`, [g.id]);
      out.push({
        id: g.id, name: g.name, code: g.code, metric: g.metric, period: g.period,
        isOwner: g.created_by === req.user.id, stakes: g.stakes || "",
        roundNo, seasonStart, seasonEnd, members: board, team,
        boss: isBossRound(g.id, roundNo),   // 本輪是否為魔王輪（奪冠雙倍獎盃）
        messages: msgs.rows.reverse().map((m) => ({ name: m.username, body: m.body, me: m.username === req.user.username })),
        history: seasons.rows.map((s) => ({ round: s.round_no, start: s.start_date, end: s.end_date, winner: s.winner, boss: s.boss })),
      });
    }
    res.json({ groups: out });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});

/* ---------- 競賽留言／加油（只存文字，不涉及體重） ---------- */
app.post("/api/group/:id/message", auth, async (req, res) => {
  try {
    const gid = +req.params.id;
    const body = String(req.body.body || "").trim().slice(0, 120);
    if (!body) return res.status(400).json({ error: "請輸入內容" });
    const mem = await pool.query("SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2", [gid, req.user.id]);
    if (!mem.rowCount) return res.status(403).json({ error: "你不在這個競賽中" });
    await pool.query("INSERT INTO group_messages(group_id,user_id,body) VALUES($1,$2,$3)", [gid, req.user.id, body]);
    // 只保留每組最新 50 則
    await pool.query(
      `DELETE FROM group_messages WHERE group_id=$1 AND id NOT IN
       (SELECT id FROM group_messages WHERE group_id=$1 ORDER BY id DESC LIMIT 50)`, [gid]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
});

/* ---------- 營養標示『批次』辨識：一次多張，回傳陣列 ---------- */
app.post("/api/labels", auth, aiLimit, async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: "未設定 AI 金鑰" });
    const imgs = Array.isArray(req.body.images) ? req.body.images.slice(0, 6) : [];
    if (!imgs.length) return res.status(400).json({ error: "缺少照片" });
    const parts = [{
      text:
        "下面有多張食品包裝的『營養標示』照片（每張可能是不同商品）。" +
        "請逐張讀出數值，全部換算成『每 100 公克』。若只有每份/每包，用每份除以每份公克數×100。" +
        "並判斷每張的『一份公克數』(serving；飲料用毫升近似；讀不到填 0)。" +
        "依照片順序回傳 JSON 陣列，每張一筆，不要說明文字、不要 markdown：" +
        '[{"name":"商品名(讀不到填空字串)","serving":一份公克數,"kcal":每100g熱量,"protein":每100g蛋白,"fat":每100g脂肪,"carb":每100g碳水}, ...]。' +
        "數字一律阿拉伯數字、不含單位；讀不到填 0。",
    }];
    for (const raw of imgs) {
      let img = String(raw || ""); let mime = "image/jpeg";
      const m = img.match(/^data:(image\/[a-zA-Z]+);base64,(.*)$/);
      if (m) { mime = m[1]; img = m[2]; }
      if (img) parts.push({ inline_data: { mime_type: mime, data: img } });
    }
    const g = await geminiParts(key, parts, 0.1);
    if (g.error) return res.status(502).json({ error: geminiErrMsg(g.error.status) });
    const txt = g.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = extractJson(txt);
    if (!parsed) return res.status(502).json({ error: "無法解析標示" });
    const num = (v) => (Number.isFinite(+v) ? Math.round(+v * 10) / 10 : 0);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const items = arr.map((p) => ({
      name: String(p.name || "").slice(0, 40),
      serving: Math.max(0, Math.round(num(p.serving))),
      kcal: Math.round(num(p.kcal)), protein: num(p.protein), fat: num(p.fat), carb: num(p.carb),
    })).filter((p) => p.kcal > 0 || p.name);
    if (!items.length) return res.status(502).json({ error: "辨識無結果，請拍清楚一點" });
    res.json({ ok: true, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 共享食物庫（自訂食物/食譜，全體共用，每100g） ---------- */
app.post("/api/sharedfood", auth, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: "需要名稱" });
    const num = (v) => (Number.isFinite(+v) ? +v : 0);
    const kcal = num(req.body.kcal);
    if (kcal <= 0) return res.json({ ok: true }); // 沒熱量就不收
    const grams = Math.max(1, num(req.body.grams) || 100);
    const kind = req.body.kind === "recipe" ? "recipe" : "food";
    // 改名：把自己建立的舊品項改成新名稱（新名稱不可已存在）
    const oldName = String(req.body.oldName || "").trim().slice(0, 60);
    if (oldName && oldName !== name) {
      const own = await pool.query("SELECT 1 FROM shared_foods WHERE name=$1 AND created_by=$2", [oldName, req.user.id]);
      if (!own.rowCount) return res.status(403).json({ error: "只能修改自己建立的品項" });
      const taken = await pool.query("SELECT 1 FROM shared_foods WHERE name=$1", [name]);
      if (taken.rowCount) return res.status(409).json({ error: "已有同名品項，請換個名稱" });
      await pool.query(
        "UPDATE shared_foods SET name=$1,kcal=$2,protein=$3,fat=$4,carb=$5,grams=$6,kind=$7 WHERE name=$8 AND created_by=$9",
        [name, kcal, num(req.body.protein), num(req.body.fat), num(req.body.carb), grams, kind, oldName, req.user.id]
      );
      return res.json({ ok: true });
    }
    await pool.query(
      `INSERT INTO shared_foods(name,kcal,protein,fat,carb,grams,kind,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (name) DO UPDATE SET
         kcal=EXCLUDED.kcal, protein=EXCLUDED.protein, fat=EXCLUDED.fat,
         carb=EXCLUDED.carb, grams=EXCLUDED.grams, kind=EXCLUDED.kind
       WHERE shared_foods.created_by = EXCLUDED.created_by`,
      [name, kcal, num(req.body.protein), num(req.body.fat), num(req.body.carb), grams, kind, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.delete("/api/sharedfood", auth, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "需要名稱" });
    const r = await pool.query("DELETE FROM shared_foods WHERE name=$1 AND created_by=$2", [name, req.user.id]);
    if (r.rowCount === 0) return res.status(403).json({ error: "只能刪除自己建立的品項" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 取得自己的所有資料 ---------- */
app.get("/api/me/all", auth, async (req, res) => {
  try {
    const recs = await pool.query("SELECT * FROM records WHERE user_id=$1 ORDER BY date", [req.user.id]);
    const exs = await pool.query("SELECT * FROM exercises WHERE user_id=$1 ORDER BY date DESC, id DESC", [req.user.id]);
    const rcp = await pool.query("SELECT * FROM recipes WHERE user_id=$1 ORDER BY created_at DESC", [req.user.id]);
    const mls = await pool.query("SELECT * FROM meals WHERE user_id=$1 ORDER BY id", [req.user.id]);
    const shf = await pool.query("SELECT name,kcal,protein,fat,carb,grams,kind,created_by FROM shared_foods ORDER BY name");
    const rvw = await pool.query("SELECT week_start, summary, actions FROM weekly_reviews WHERE user_id=$1 ORDER BY week_start DESC", [req.user.id]);
    const plt = await pool.query("SELECT id,name,items,kcal,thumb FROM plates WHERE user_id=$1 ORDER BY created_at DESC", [req.user.id]);
    res.json({ profile: req.user.profile, favorites: req.user.favorites || [], records: recs.rows, exercises: exs.rows, recipes: rcp.rows, meals: mls.rows, sharedFoods: shf.rows, reviews: rvw.rows, plates: plt.rows, avatar: req.user.avatar || null, fx: req.user.fx || null, racer: req.user.racer || null, skin: req.user.skin || null });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(PORT, () => console.log("Listening on " + PORT)))
  .catch((e) => {
    console.error("DB init failed", e);
    process.exit(1);
  });
