import express from "express";
import pg from "pg";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

// Railway 會自動注入 DATABASE_URL（加了 Postgres 外掛之後）
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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS favorites JSONB DEFAULT '[]'::jsonb;
    CREATE TABLE IF NOT EXISTS records (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      weight REAL, kcal INT, protein REAL, fat REAL, carb REAL,
      UNIQUE(user_id, date)
    );
    ALTER TABLE records ADD COLUMN IF NOT EXISTS weight_pm REAL;
    ALTER TABLE records ADD COLUMN IF NOT EXISTS water_ml INT;
    CREATE TABLE IF NOT EXISTS meals (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      meal TEXT NOT NULL,
      name TEXT NOT NULL,
      kcal INT, protein REAL, fat REAL, carb REAL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      name TEXT NOT NULL,
      minutes REAL,
      kcal INT
    );
    CREATE TABLE IF NOT EXISTS recipes (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      items JSONB DEFAULT '[]'::jsonb,
      kcal INT, protein REAL, fat REAL, carb REAL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log("DB ready");
}

const app = express();
app.use(express.json());
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

/* ---------- 個人資料 ---------- */
app.put("/api/profile", auth, async (req, res) => {
  try {
    await pool.query("UPDATE users SET profile=$1 WHERE id=$2", [req.body || {}, req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 每日紀錄 ---------- */
app.post("/api/record", auth, async (req, res) => {
  try {
    // weight = 早上體重（主要，用於趨勢/反推），weight_pm = 晚上體重
    const { date, weight, weight_pm, kcal, protein, fat, carb } = req.body;
    if (!date) return res.status(400).json({ error: "需要日期" });
    await pool.query(
      `INSERT INTO records(user_id,date,weight,weight_pm,kcal,protein,fat,carb)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id,date) DO UPDATE SET
         weight=COALESCE(EXCLUDED.weight, records.weight),
         weight_pm=COALESCE(EXCLUDED.weight_pm, records.weight_pm),
         kcal=EXCLUDED.kcal, protein=EXCLUDED.protein,
         fat=EXCLUDED.fat, carb=EXCLUDED.carb`,
      [req.user.id, date, weight ?? null, weight_pm ?? null, kcal ?? null, protein ?? null, fat ?? null, carb ?? null]
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
    const { date, name, minutes, kcal } = req.body;
    if (!date || !name) return res.status(400).json({ error: "需要日期與運動項目" });
    await pool.query(
      "INSERT INTO exercises(user_id,date,name,minutes,kcal) VALUES($1,$2,$3,$4,$5)",
      [req.user.id, date, name, minutes ?? null, kcal ?? null]
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
    const { date, meal, items } = req.body;
    if (!date || !meal || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "需要日期、餐別與內容" });
    for (const it of items) {
      await pool.query(
        "INSERT INTO meals(user_id,date,meal,name,kcal,protein,fat,carb) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [req.user.id, date, meal, it.name || "食物", it.kcal ?? null, it.protein ?? null, it.fat ?? null, it.carb ?? null]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
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

/* ---------- 條碼查詢（Open Food Facts 代理） ---------- */
app.get("/api/barcode", auth, async (req, res) => {
  try {
    const code = String(req.query.code || "").replace(/[^0-9]/g, "");
    if (!code) return res.status(400).json({ error: "缺少條碼" });
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
    res.json({
      found: true, code,
      n: name,
      k: Math.round((nu["energy-kcal_100g"] ?? 0) * 10) / 10,
      p: Math.round((nu["proteins_100g"] ?? 0) * 10) / 10,
      f: Math.round((nu["fat_100g"] ?? 0) * 10) / 10,
      c: Math.round((nu["carbohydrates_100g"] ?? 0) * 10) / 10,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- USDA 線上食物查詢（代理，隱藏金鑰、避開 CORS） ---------- */
app.get("/api/foodsearch", auth, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ items: [] });
    const key = process.env.USDA_API_KEY || "DEMO_KEY";
    const url =
      "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=" + key +
      "&pageSize=15&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)&query=" +
      encodeURIComponent(q);
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: "USDA 查詢失敗（可能是流量限制）" });
    const data = await r.json();
    const pick = (nutrients, names) => {
      const n = (nutrients || []).find((x) =>
        names.some((nm) => (x.nutrientName || "").toLowerCase().includes(nm))
      );
      return n ? Math.round((n.value || 0) * 10) / 10 : 0;
    };
    const items = (data.foods || []).map((f) => ({
      n: f.description,
      brand: f.brandOwner || f.foodCategory || "",
      k: pick(f.foodNutrients, ["energy"]),
      p: pick(f.foodNutrients, ["protein"]),
      f: pick(f.foodNutrients, ["total lipid", "fat"]),
      c: pick(f.foodNutrients, ["carbohydrate"]),
    })).filter((x) => x.k > 0);
    res.json({ items });
  } catch (e) {
    console.error(e);
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
    res.json({ profile: req.user.profile, favorites: req.user.favorites || [], records: recs.rows, exercises: exs.rows, recipes: rcp.rows, meals: mls.rows });
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
