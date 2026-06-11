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

## 啟用
圖放好後，到 `public/app.js` 的 `PET_ART_KEYS` 取消對應行的註解，例如：
```js
const PET_ART_KEYS = new Set([
  "cat:silvertabby",
]);
```
（或直接告訴我，我幫你開啟＋更新版本。）
