# TDEE 團隊追蹤

多人雲端版 TDEE 工具：和朋友用同一個「群組代碼」記錄體重、熱量、營養素，
14 天體重斜率反推真實 TDEE，含食物熱量計算機、目標建議、群組排行。

## 架構
- 後端：Node + Express（`server.js`）
- 資料庫：PostgreSQL（Railway 外掛自動提供 `DATABASE_URL`）
- 前端：`public/index.html`（與後端同源，免額外設定）

## 部署到 Railway（約 5 分鐘）

1. 把 `tdee-team` 這個資料夾推到一個 GitHub repo（或用 Railway CLI）。
2. 到 [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**，選這個 repo。
3. 在同一個專案裡按 **+ New → Database → Add PostgreSQL**。
   Railway 會自動把 `DATABASE_URL` 注入到你的服務，程式會自己建表，不用手動設定。
4. 等部署完成，點服務的 **Settings → Networking → Generate Domain** 取得網址。
5. 打開那個網址 → 輸入群組代碼（例如 `FIT2026`）和名字即可開始。
   把同一個代碼告訴朋友，大家就會看到彼此的紀錄與排行。

### 用 Railway CLI（替代方案）
```bash
npm i -g @railway/cli
railway login
railway init            # 在 tdee-team 資料夾內
railway add             # 選 PostgreSQL
railway up              # 部署
railway domain          # 產生網址
```

## 本機測試（選用）
需要一個本機 Postgres：
```bash
npm install
$env:DATABASE_URL="postgresql://localhost:5432/tdee"   # PowerShell
npm start
# 開 http://localhost:3000
```

## 安全性說明
群組代碼像「房間名」一樣，知道代碼的人就能加入與檢視，沒有密碼。
適合朋友間使用；不要放入不想被同群組看到的資料。
若日後要加密碼/帳號，可再擴充 `members` 資料表。
