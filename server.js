import express from "express";
import pg from "pg";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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

/* ---------- AI 食物照片辨識（Gemini 代理） ---------- */
app.post("/api/analyze", auth, async (req, res) => {
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
app.post("/api/estimate", auth, async (req, res) => {
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
app.post("/api/label", auth, async (req, res) => {
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
app.post("/api/coach", auth, async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: "未設定 AI 金鑰" });
    const b = req.body || {};
    const mode = ["daily", "report", "remain"].includes(b.mode) ? b.mode : "daily";
    const goalName = { cut: "減脂", maintain: "維持", bulk: "增肌" }[b.goal] || "維持";
    const j = (o) => JSON.stringify(o || {});
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
    } else if (mode === "report") {
      prompt =
        "你是營養師兼教練。這是使用者近 " + (b.days || 7) + " 天的飲食/運動摘要：" +
        "平均攝取/天=" + j(b.avg) + "，每日目標=" + j(b.target) +
        "，平均運動消耗/天=" + (b.avgBurn || 0) + " kcal，平均淨熱量/天=" + (b.avgNet || 0) + " kcal" +
        (b.weightDelta != null ? "，期間體重變化=" + b.weightDelta + " kg" : "") +
        "，目標類型=" + goalName + "。" +
        "請做一段精簡『教練點評』：先講趨勢與做得好的地方，再指出最該調整的 1–2 點，最後給下週一個可執行的小目標。" +
        "口語、鼓勵、具體（可引用數字），繁體中文。只回傳 JSON：" +
        '{"summary":"2-4句總評","actions":["下週可做的具體小目標1","小目標2"]}。';
    } else {
      prompt =
        "你是營養師兼教練。使用者今天到目前的攝取=" + j(b.today) + "，每日目標=" + j(b.target) +
        "，今天運動消耗=" + (b.burn || 0) + " kcal，目標類型=" + goalName + "。" +
        "請給今天剩餘時間的飲食建議：還缺/超出多少熱量與蛋白質，下一餐可以怎麼吃。" +
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
    const actions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 4).map((s) => String(s).slice(0, 80)) : [];
    res.json({ ok: true, summary: String(parsed.summary || "").slice(0, 400), actions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

/* ---------- 營養標示『批次』辨識：一次多張，回傳陣列 ---------- */
app.post("/api/labels", auth, async (req, res) => {
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
    await pool.query(
      `INSERT INTO shared_foods(name,kcal,protein,fat,carb,grams,kind,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (name) DO UPDATE SET
         kcal=EXCLUDED.kcal, protein=EXCLUDED.protein, fat=EXCLUDED.fat,
         carb=EXCLUDED.carb, grams=EXCLUDED.grams, kind=EXCLUDED.kind, created_by=EXCLUDED.created_by`,
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
    res.json({ profile: req.user.profile, favorites: req.user.favorites || [], records: recs.rows, exercises: exs.rows, recipes: rcp.rows, meals: mls.rows, sharedFoods: shf.rows });
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
