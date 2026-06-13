// 一次性補骨頭幣腳本：把指定使用者的 pets.coins_bonus 加上指定數量。
// 餘額 = 行為賺取 + coins_bonus − coins_spent，所以加 coins_bonus 等同直接補幣。
//
// 用法（在能連到資料庫的環境執行，需有 DATABASE_URL）：
//   node tools/grant_coins.mjs <使用者名稱> [數量(預設180)]
// Railway 範例：
//   railway run node tools/grant_coins.mjs 肉 180
//
// 180 = 三次單抽(GACHA_COST 60 × 3)。改數量就改第二個參數。
import pg from "pg";
const { Pool } = pg;

const username = process.argv[2];
const amount = parseInt(process.argv[3] || "180", 10);

if (!username || !Number.isFinite(amount)) {
  console.error("用法: node tools/grant_coins.mjs <使用者名稱> [數量(預設180)]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("❌ 找不到 DATABASE_URL。請在能連到資料庫的環境執行（如 `railway run ...`）。");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

try {
  const u = await pool.query("SELECT id, username FROM users WHERE username=$1", [username]);
  if (!u.rowCount) { console.error("❌ 找不到使用者：", username); process.exit(1); }
  const uid = u.rows[0].id;

  const before = await pool.query("SELECT coins_bonus FROM pets WHERE user_id=$1", [uid]);
  if (!before.rowCount) { console.error("❌ 該使用者還沒領養寵物（沒有 pets 紀錄），無法補幣。"); process.exit(1); }

  const r = await pool.query(
    "UPDATE pets SET coins_bonus = COALESCE(coins_bonus,0) + $1 WHERE user_id=$2 RETURNING coins_bonus",
    [amount, uid]
  );
  console.log(`✅ 已補 ${amount} 幣給「${username}」（user_id=${uid}）：coins_bonus ${before.rows[0].coins_bonus || 0} → ${r.rows[0].coins_bonus}`);
} catch (e) {
  console.error("執行失敗：", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
