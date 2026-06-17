import pg from "pg";
const [,, username, key] = process.argv;
if (!username || !key) { console.error("用法: node tools/give_racer.mjs <username> <racerKey>"); process.exit(1); }
const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!url || /railway\.internal/.test(url)) { console.error("需要可連線的 public DB URL"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const u = (await pool.query("SELECT id FROM users WHERE username=$1", [username])).rows[0];
if (!u) { console.error("找不到使用者", username); process.exit(1); }
// 1) 把賽道小圖加進 pets.racers（已擁有，會出現在選單）
const pr = (await pool.query("SELECT racers FROM pets WHERE user_id=$1", [u.id])).rows[0];
const racers = Array.isArray(pr && pr.racers) ? pr.racers : [];
if (!racers.includes(key)) racers.push(key);
await pool.query("UPDATE pets SET racers=$1::jsonb WHERE user_id=$2", [JSON.stringify(racers), u.id]);
// 2) 直接設為目前使用的賽道角色
await pool.query("UPDATE users SET racer=$1 WHERE id=$2", ["racerart:" + key, u.id]);
console.log(`已給「${username}」賽道小圖 racerart:${key}，且設為使用中。racers=${JSON.stringify(racers)}`);
await pool.end();
