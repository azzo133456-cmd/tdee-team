# TDEE 個人追蹤

雲端版 TDEE 工具：一人一組帳號密碼、資料完全獨立互不可見，記錄體重、熱量、營養素，
14 天體重斜率反推真實 TDEE，含食物熱量計算機、目標建議、運動紀錄與每週運動建議。
支援早上／晚上各記一次體重，並計算「當日淨熱量＝攝取−運動消耗」。

### 食物資料來源（三合一）
1. **台灣 FDA 食品營養成分資料庫**：2,181 筆中文食材，已轉成 `public/foods_tw.js` 隨 app 打包（離線即時）。
   來源 https://data.gov.tw/dataset/8543
2. **常見品項概估**：手動整理的台式餐點/飲料（滷肉飯、珍奶等 FDA 沒有的現成餐點）。
3. **USDA FoodData Central**：app 內按「線上查 USDA」即時查 60 萬+ 品項（英文）。
   透過後端 `/api/foodsearch` 代理。可選設定環境變數 `USDA_API_KEY`（免費，未設則用 `DEMO_KEY`，有流量限制）。
   申請：https://fdc.nal.usda.gov/api-key-signup.html

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
5. 打開那個網址 → 第一次用按「註冊」建立帳號密碼，之後用「登入」。
   每個帳號的資料完全獨立，朋友各自註冊自己的帳號即可，彼此看不到對方資料。

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
- 每人一組帳號密碼，密碼以 scrypt 加鹽雜湊保存，資料各自獨立、互不可見。
- 登入後會拿到一組 token 存在瀏覽器；忘記密碼目前無法自助復原。
- 此為朋友間自用的輕量設計，未加 HTTPS 以外的進階防護，請勿存放高敏感資料。
