# 寵物插圖放置說明

把每個物種/品種的階段插圖放進對應資料夾，App 會自動用 `<img>` 呈現（缺圖自動回退內建 SVG，不會破圖）。

## 資料夾命名
```
public/pets/<species>_<breed>/<stage>.png
```
- `<species>`：cat / dog / …（與系統物種代號一致）
- `<breed>`：品種代號（貓：orange/tuxedo/calico/cream/silvertabby；狗：shiba/frenchie/golden/collie/dachshund）
- `<stage>`：0~4（0 蛋→1 幼體→2 成長期→3 成體→4 進化體）

範例（範例貓「銀虎斑・被窩睡眠」）：
```
public/pets/cat_silvertabby/
  ├─ 1.png   被窩幼患
  ├─ 2.png   枕頭霸主
  ├─ 3.png   被窩領主
  ├─ 4.png   棉被神獸
  └─ 0.png   蛋（可省略）
```

## 圖檔規格
| 項目 | 規格 |
|---|---|
| 格式 | PNG（透明背景）；也可 WebP/SVG |
| 尺寸 | 正方形 512×512 px（最少 256） |
| 構圖 | 角色置中、各階段位置/大小一致 |
| 留白 | 四邊各留 ~8–10% |
| 檔案大小 | 每張 < 150KB（建議壓過） |
| 風格 | 4 張同畫風/同光線/同角色 |

⚠️ 角色周圍要去背（枕頭/棉被算角色一部分 OK，但不要整塊背景方塊）。

---

## 新增一隻全新的插圖寵物（自助，不用改程式）

只要 3 步驟，伺服器會自動把它變成新物種、設為**最稀有**（扭蛋最難抽）、並啟用插圖：

**1. 建資料夾放圖**　`public/pets/<代號>/`，放 `0.png`~`4.png`
```
public/pets/hana4/
  ├─ 0.png  ├─ 1.png  ├─ 2.png  ├─ 3.png  └─ 4.png
```
（規格同上面「圖檔規格」；缺哪張就用 emoji 暫代，不會破圖）

**2. 在 `public/pets/custom_pets.json` 加一行**
```json
{
  "hana4": { "label": "花花4" }
}
```
- `label`：**必填**，圖鑑顯示的名字
- `stages`：**選填**，5 個 emoji（缺圖時的暫代），不寫就用預設 🐾
  例：`"hana4": { "label": "花花4", "stages": ["🥚","🐱","🐈","😺","🦁"] }`
- `_` 開頭的 key 會被忽略（可拿來寫註解）

**3. 重新部署**（`git push`）→ 完成 🎉

> 代號規則：英文小寫/數字，跟資料夾名一致（如 `hana4`）。設定一旦生效就**不要再改代號**，否則已抽到的玩家會對不上。

---

## 啟用「貓/狗品種」的插圖（如 cat_silvertabby）
品種插圖是**內建清單**，圖放進 `public/pets/<species>_<breed>/` 後會自動啟用，無需改設定。
目前內建已啟用：`cat:silvertabby`、`bubu`、`jelly`、`money`。
要再開新的品種插圖（非全新物種）才需要找工程師加進 `server.js` 的 `BUILTIN_ART_KEYS`。
