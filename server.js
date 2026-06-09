import express from "express";
import pg from "pg";
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
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      group_id INT REFERENCES groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      profile JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(group_id, name)
    );
    CREATE TABLE IF NOT EXISTS records (
      id SERIAL PRIMARY KEY,
      member_id INT REFERENCES members(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      weight REAL,
      kcal INT,
      protein REAL,
      fat REAL,
      carb REAL,
      UNIQUE(member_id, date)
    );
  `);
  console.log("DB ready");
}

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

function norm(code) {
  return String(code || "").trim().toUpperCase();
}

// 加入或建立群組 → 回傳 member
app.post("/api/join", async (req, res) => {
  try {
    const code = norm(req.body.code);
    const name = String(req.body.name || "").trim();
    if (!code || !name) return res.status(400).json({ error: "需要群組代碼與名字" });

    let g = await pool.query("SELECT id FROM groups WHERE code=$1", [code]);
    if (g.rowCount === 0)
      g = await pool.query("INSERT INTO groups(code) VALUES($1) RETURNING id", [code]);
    const groupId = g.rows[0].id;

    let m = await pool.query(
      "SELECT * FROM members WHERE group_id=$1 AND name=$2",
      [groupId, name]
    );
    if (m.rowCount === 0)
      m = await pool.query(
        "INSERT INTO members(group_id,name) VALUES($1,$2) RETURNING *",
        [groupId, name]
      );
    const member = m.rows[0];
    res.json({ memberId: member.id, groupId, code, name: member.name, profile: member.profile });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

// 更新個人資料
app.put("/api/member/:id/profile", async (req, res) => {
  try {
    await pool.query("UPDATE members SET profile=$1 WHERE id=$2", [
      req.body || {},
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

// 新增/更新當日紀錄
app.post("/api/member/:id/record", async (req, res) => {
  try {
    const { date, weight, kcal, protein, fat, carb } = req.body;
    if (!date) return res.status(400).json({ error: "需要日期" });
    await pool.query(
      `INSERT INTO records(member_id,date,weight,kcal,protein,fat,carb)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (member_id,date) DO UPDATE SET
         weight=COALESCE(EXCLUDED.weight, records.weight),
         kcal=EXCLUDED.kcal, protein=EXCLUDED.protein,
         fat=EXCLUDED.fat, carb=EXCLUDED.carb`,
      [req.params.id, date, weight ?? null, kcal ?? null, protein ?? null, fat ?? null, carb ?? null]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

app.delete("/api/record/:rid", async (req, res) => {
  try {
    await pool.query("DELETE FROM records WHERE id=$1", [req.params.rid]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

// 取得單一成員的紀錄
app.get("/api/member/:id/records", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM records WHERE member_id=$1 ORDER BY date",
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: "伺服器錯誤" });
  }
});

// 取得整個群組的成員 + 每人紀錄（給排行 / 比較用）
app.get("/api/group/:code/all", async (req, res) => {
  try {
    const code = norm(req.params.code);
    const g = await pool.query("SELECT id FROM groups WHERE code=$1", [code]);
    if (g.rowCount === 0) return res.json({ members: [] });
    const groupId = g.rows[0].id;
    const ms = await pool.query(
      "SELECT id,name,profile FROM members WHERE group_id=$1 ORDER BY created_at",
      [groupId]
    );
    const out = [];
    for (const m of ms.rows) {
      const rs = await pool.query(
        "SELECT * FROM records WHERE member_id=$1 ORDER BY date",
        [m.id]
      );
      out.push({ ...m, records: rs.rows });
    }
    res.json({ members: out });
  } catch (e) {
    console.error(e);
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
