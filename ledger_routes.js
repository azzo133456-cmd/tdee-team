/* ---------- 記帳本的路由 ----------
   每一筆資料都綁 user_id，再加上只開放給「肉」的檢查（ledgerOnly）。
   做成函式傳入相依的東西，測試才能換成假的資料庫，不用連正式資料庫。 */
import * as L from "./ledger_logic.js";

const COLS = "id,date::text AS date,type,category,account,amount,note";
const validId = (s) => { const n = Number(s); return Number.isInteger(n) && n >= 1 && n <= 2147483647 ? n : null; };

export function registerLedger(app, { pool, auth, aiLimit, askAi, today }) {
  const ledgerOnly = (req, res, next) => (L.isLedgerUser(req.user.username) ? next() : res.status(403).json({ error: "沒有開放這個功能" }));
  const guard = (fn) => async (req, res) => {
    try { await fn(req, res); }
    catch (e) { console.error(e); res.status(500).json({ error: "伺服器錯誤" }); }
  };
  const bad = (res, e) => res.status(400).json({ error: e.message });

  // 一個月的明細＋到這個月為止 6 個月的收支趨勢
  app.get("/api/ledger", auth, ledgerOnly, guard(async (req, res) => {
    let r;
    try { r = L.monthRange(req.query.month); } catch (e) { return bad(res, e); }
    const entries = await pool.query(
      `SELECT ${COLS} FROM ledger WHERE user_id=$1 AND date>=$2 AND date<$3 ORDER BY date DESC, id DESC`,
      [req.user.id, r.from, r.to]);
    const trend = await pool.query(
      "SELECT to_char(date,'YYYY-MM') AS month,type,SUM(amount)::bigint AS total FROM ledger WHERE user_id=$1 AND date>=$2 AND date<$3 GROUP BY 1,2",
      [req.user.id, r.trendFrom, r.to]);
    res.json({
      entries: entries.rows, trend: trend.rows.map((x) => ({ month: x.month, type: x.type, total: Number(x.total) })),
      budget: (req.user.ledger_cfg && req.user.ledger_cfg.budget) || 0, cats: L.CATEGORIES, accounts: L.ACCOUNTS,
    });
  }));
  app.get("/api/ledger/all", auth, ledgerOnly, guard(async (req, res) => {
    const r = await pool.query(`SELECT ${COLS} FROM ledger WHERE user_id=$1 ORDER BY date DESC, id DESC`, [req.user.id]);
    res.json({ entries: r.rows });
  }));
  // 新增一筆或多筆（一次 INSERT，要嘛全部成功、要嘛全部失敗）
  app.post("/api/ledger", auth, ledgerOnly, guard(async (req, res) => {
    let list;
    try {
      const raw = Array.isArray(req.body.entries) ? req.body.entries : [];
      if (!raw.length || raw.length > 20) throw new Error("一次要記 1～20 筆");
      list = raw.map(L.cleanEntry);
    } catch (e) { return bad(res, e); }
    const params = [], rows = list.map((e) => {
      params.push(req.user.id, e.date, e.type, e.category, e.account, e.amount, e.note);
      const k = params.length;
      return `($${k - 6},$${k - 5},$${k - 4},$${k - 3},$${k - 2},$${k - 1},$${k})`;
    });
    const r = await pool.query(`INSERT INTO ledger(user_id,date,type,category,account,amount,note) VALUES ${rows.join(",")} RETURNING ${COLS}`, params);
    res.json({ entries: r.rows });
  }));
  // 預算要排在 /:id 前面，不然 "budget" 會被當成 id
  app.put("/api/ledger/budget", auth, ledgerOnly, guard(async (req, res) => {
    let budget;
    try { budget = L.cleanBudget(req.body.budget); } catch (e) { return bad(res, e); }
    await pool.query("UPDATE users SET ledger_cfg=jsonb_set(COALESCE(ledger_cfg,'{}'::jsonb),'{budget}',$1::jsonb) WHERE id=$2", [JSON.stringify(budget), req.user.id]);
    res.json({ budget });
  }));
  app.put("/api/ledger/:id", auth, ledgerOnly, guard(async (req, res) => {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ error: "紀錄不正確" });
    let e;
    try { e = L.cleanEntry(req.body); } catch (err) { return bad(res, err); }
    const r = await pool.query(
      `UPDATE ledger SET date=$1,type=$2,category=$3,account=$4,amount=$5,note=$6 WHERE id=$7 AND user_id=$8 RETURNING ${COLS}`,
      [e.date, e.type, e.category, e.account, e.amount, e.note, id, req.user.id]);
    if (!r.rowCount) return res.status(404).json({ error: "找不到這筆紀錄" });
    res.json({ entry: r.rows[0] });
  }));
  app.delete("/api/ledger/:id", auth, ledgerOnly, guard(async (req, res) => {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ error: "紀錄不正確" });
    await pool.query("DELETE FROM ledger WHERE id=$1 AND user_id=$2", [id, req.user.id]);
    res.json({ ok: true });
  }));
  // 打一句話 → AI 拆成紀錄（這裡不存，前端拿到後用上面的 POST 存）
  app.post("/api/ledger/parse", auth, ledgerOnly, aiLimit, guard(async (req, res) => {
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).json({ error: "請輸入內容" });
    const account = L.ACCOUNTS.includes(req.body.account) ? req.body.account : L.ACCOUNTS[0], day = today();
    const a = await askAi(L.buildPrompt(text, day, account));
    if (a.error) return res.status(a.status || 502).json({ error: a.error });
    res.json(L.normalizeParsed(a.parsed, day, account));
  }));
}
