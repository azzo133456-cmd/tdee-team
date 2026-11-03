// 啟動測試：node test/boot.test.mjs
// 真的跑 server.js，但資料庫指到連不上的位址。正常情況會一路執行到「連資料庫」才失敗；
// 如果程式本身有問題（例如路由用到還沒宣告的變數），在那之前就會當掉 —— 其他測試都沒有啟動 server，抓不到這種錯。
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const cwd = fileURLToPath(new URL("..", import.meta.url));
const r = spawnSync(process.execPath, ["server.js"], {
  cwd, encoding: "utf8", timeout: 60000,
  env: { ...process.env, DATABASE_URL: "postgres://x:x@127.0.0.1:1/x", PORT: "0" },
});
const out = (r.stdout || "") + (r.stderr || "");
const crashed = /^(ReferenceError|TypeError|SyntaxError|RangeError)\b/m.test(out) || /Cannot find (module|package)/.test(out);
const reachedDb = /ECONNREFUSED|connect|資料庫/i.test(out);
const ok = !crashed && reachedDb;
console.log(`${ok ? "PASS" : "FAIL"}  server.js 程式本身能跑到連資料庫那一步`);
if (!ok) console.log(out.slice(0, 1500));
console.log(`\n${ok ? 1 : 0} passed, ${ok ? 0 : 1} failed`);
process.exitCode = ok ? 0 : 1;
