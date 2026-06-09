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

/* ---------- Gemini 共用呼叫：多模型備援 + 503/429 退避重試 ---------- */
// flash-lite 通常較不壅塞，作為前段備援；再退到其他版本
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function geminiVision(key, prompt, mime, imgB64, temperature) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: imgB64 } }] }],
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
      "每筆估計其重量與營養。只回傳 JSON 陣列，不要任何說明文字、不要 markdown 圍欄。格式：" +
      '[{"name":"中文品名","grams":該品項重量克數,"kcal":熱量,"protein":蛋白質克,"fat":脂肪克,"carb":碳水克}, ...]。' +
      "name 可帶簡短說明（如「烤雞腿(醬燒)」）。若只有單一品項就回傳只含一筆的陣列。" +
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
    let parsed;
    try {
      parsed = JSON.parse(txt);
    } catch {
      const j = txt.match(/\[[\s\S]*\]/) || txt.match(/\{[\s\S]*\}/);
      if (!j) return res.status(502).json({ error: "無法解析辨識結果" });
      parsed = JSON.parse(j[0]);
    }
    const num = (v) => (Number.isFinite(+v) ? Math.round(+v * 10) / 10 : 0);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const items = arr.filter((p) => p && (p.name || p.kcal)).map((p) => ({
      name: String(p.name || "辨識食物").slice(0, 40),
      grams: Math.max(1, Math.round(num(p.grams) || 100)),
      kcal: Math.round(num(p.kcal)),
      protein: num(p.protein),
      fat: num(p.fat),
      carb: num(p.carb),
    }));
    if (items.length === 0) return res.status(502).json({ error: "無法辨識內容" });
    res.json({ ok: true, items });
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
      "只回傳 JSON，不要說明文字、不要 markdown 圍欄。格式：" +
      '{"name":"商品名稱(看得到就填,看不到填空字串)","kcal":每100g熱量,"protein":每100g蛋白質克,"fat":每100g脂肪克,"carb":每100g碳水克}。' +
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
