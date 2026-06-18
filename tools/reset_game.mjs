import pg from "pg";
const [,, username, game] = process.argv;
if (!username || !game) { console.error("用法: node tools/reset_game.mjs <username> <gameKey(spin/memory/whack/calorie/quiz)>"); process.exit(1); }
const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const u = (await pool.query("SELECT id FROM users WHERE username=$1", [username])).rows[0];
if (!u) { console.error("找不到使用者", username); process.exit(1); }
const r = (await pool.query("SELECT games FROM pets WHERE user_id=$1", [u.id])).rows[0];
const games = (r && r.games && typeof r.games === "object") ? r.games : {};
delete games[game];
await pool.query("UPDATE pets SET games=$1::jsonb WHERE user_id=$2", [JSON.stringify(games), u.id]);
console.log(`已重置「${username}」的 ${game} 遊戲紀錄，今天可重新挑戰領獎。`);
await pool.end();
