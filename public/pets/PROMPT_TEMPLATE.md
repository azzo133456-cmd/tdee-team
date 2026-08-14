# 寵物插圖生成提示詞範本

給 ChatGPT / Midjourney 等生圖工具用。目的是讓**五個階段的畫風與角色長相一致**，
並且產出的圖**好去背**——這兩件事都得在生圖階段就處理好，事後補救很難。

---

## 為什麼要照這個格式寫

實際處理過 BIRD1、BIRD2、UNI1、UNI2、TIGER1、TIGER2、cat7 之後歸納的：

| 踩過的坑 | 提示詞裡要寫什麼 |
|---|---|
| BIRD2 有對話框，跟翅膀連在一起拆不開，得手動框選座標 | **明確禁止對話框與文字** |
| UNI1 的權杖太細，去背模型只抓到 40%，成品被切成殘段 | 避免過細的道具，或讓它**與身體重疊**而非懸空 |
| UNI2 第 4 張連啤酒罐、洋芋片一起入鏡，畫面很雜 | **禁止背景物件**，道具只留角色身上的 |
| cat7 原圖只有 131×112，放大到 512 後偏糊 | **明確要求 1024×1024 以上** |
| 有些圖背景有漸層光暈，去背後邊緣殘留 | 要求**純白背景**，不要陰影與光暈 |

---

## 通用範本

把 `{{ }}` 的部分換成你的角色設定。建議用英文（多數生圖工具對英文較準）。

```
A cute {{ANIMAL}} character illustration, children's storybook watercolour style.

CHARACTER (must stay identical across all images):
{{CHARACTER_SHEET}}

SCENE: {{STAGE_DESCRIPTION}}

STYLE: soft watercolour with fine ink linework, warm gentle palette,
       hand-painted storybook feel, consistent lighting from upper left.

STRICT REQUIREMENTS:
- Pure white background, nothing else in the scene
- NO speech bubbles, NO text, NO letters of any language
- NO decorative elements (sparkles, hearts, flowers, confetti, floating objects)
- NO drop shadow, NO glow, NO gradient background
- Single subject, centred, full body visible, ~10% margin on all sides
- Square composition, at least 1024x1024
- Any prop must be touching the character, not floating separately
```

### 道具為什麼一定要「碰到角色」

去背腳本的邏輯是**只保留最大的連通區塊**——碰到角色的東西會跟角色連成一體而留下，
沒碰到的會被當成裝飾物丟掉。所以：

- ✅ 貓趴著的**被子**、鑽進去的**紙箱**、壓著的**筆電** → 留下（像 BIRD1 的雪堆、UNI2 的王座）
- ❌ 旁邊飄的愛心、散落的零食、遠處的家具 → 自動清掉

生活化主題需要道具，這條規則讓你知道**哪些道具會活下來**。想保留的就讓貓碰到它。

## 五階段的 SCENE 寫法

階段要能**一眼看出成長**，但角色特徵不變：

兩條路線，選一條走到底、不要混用：

| 階段 | **幻想路線**（現有多數寵物） | **生活化路線** |
|---|---|---|
| 0 蛋 | 蛋 ＋ 巢，蛋殼帶角色花紋 | 蛋窩在被子／紙箱裡 |
| 1 幼體 | 蜷著或坐著，頭身比大 | 睡在枕頭上 |
| 2 成長期 | 加配件（帽子、背包、圍巾） | 開始搗蛋（鑽紙箱、撲東西）|
| 3 成體 | 主題服裝，站姿或坐姿 | 日常擋路（趴鍵盤、佔位子）|
| 4 進化體 | 皇冠等，**道具貼著身體**，不要細長懸空的權杖 | 徹底放鬆的極致姿態（攤平、佔滿整張床）|

幻想路線靠「裝備」升級，生活化路線靠「態度」升級——後者不需要道具堆疊，
反而比較好去背，也比較貼近真實寵物。

---

## 範例：花花（新照片版）

代號建議 `hana9`（`hana2`–`hana8` 已使用）。

**CHARACTER_SHEET：**

```
A round, chubby Scottish Fold cat with small folded-down ears.
Silver-grey mackerel tabby: dark charcoal stripes on the head, back and tail,
soft cream-white muzzle, chest and belly with faint spotted markings.
Large round eyes in olive green with dark rims.
Small pink nose with a dark outline, and a white blaze running up the bridge.
Plump cheeks, short thick legs, calm slightly sleepy expression.
```

**五階段的 SCENE（生活化路線：從被窩幼貓到攤平大爺）**

| 階段 | 中文 | SCENE |
|---|---|---|
| 0 | 被窩裡的蛋 | a speckled cream egg with faint grey tabby stripes, nestled in a crumpled checkered blanket |
| 1 | 枕頭幼貓 | the kitten curled up fast asleep on a soft pillow, tiny and round, tail wrapped around itself |
| 2 | 紙箱佔領 | the cat squeezed into a small cardboard box, only head and front paws poking out, pleased with itself |
| 3 | 鍵盤路障 | the cat sprawled across an open laptop keyboard, refusing to move, half-lidded eyes |
| 4 | 攤平大爺 | the cat lying flat on its back on a thick blanket, belly up, all four paws in the air, utterly relaxed |

> 沒有斗篷、皇冠、權杖。第 4 階段的「最終形態」改用**四腳朝天攤平**——
> 就是你拍的那張照片的姿勢，也是貓能達到的最高境界。
>
> 每個階段的道具（被子、枕頭、紙箱、筆電、毛毯）貓都直接接觸到，所以去背後會保留；
> 這剛好也讓五張圖有一致的「家裡」感，而不是懸空的角色。

---

### 花花：可直接複製的完整提示詞

五段各自獨立，貼哪一段就生哪一張。角色設定與風格要求每段都重複一次——
這是刻意的，生圖工具不會記得上一張，重複貼才能維持一致。

<details>
<summary><b>Stage 0 — 被窩裡的蛋</b></summary>

```
A cute egg illustration, children's storybook watercolour style.

SUBJECT: a plump speckled cream-coloured egg, its shell faintly patterned with
silver-grey mackerel tabby stripes and one small dark paw print. The egg is
nestled into a crumpled soft checkered blanket in sage green and cream.

STYLE: soft watercolour with fine ink linework, warm gentle palette,
hand-painted storybook feel, consistent lighting from upper left.

STRICT REQUIREMENTS:
- Pure white background, nothing else in the scene
- NO speech bubbles, NO text, NO letters of any language
- NO decorative elements (sparkles, hearts, flowers, confetti, floating objects)
- NO drop shadow, NO glow, NO gradient background
- Single subject, centred, ~10% margin on all sides
- The blanket must touch the egg, not float separately
- Square composition, at least 1024x1024
```
</details>

<details>
<summary><b>Stage 1 — 枕頭幼貓</b></summary>

```
A cute kitten character illustration, children's storybook watercolour style.

CHARACTER: a round, chubby Scottish Fold kitten with small folded-down ears.
Silver-grey mackerel tabby: dark charcoal stripes on the head, back and tail,
soft cream-white muzzle, chest and belly with faint spotted markings.
Large round eyes in olive green with dark rims. Small pink nose with a dark
outline, and a white blaze running up the bridge. Plump cheeks, short thick
legs, calm slightly sleepy expression. Kitten proportions: very small body,
oversized head.

SCENE: the kitten curled up fast asleep on a soft cream pillow, tail wrapped
around itself, eyes closed.

STYLE: soft watercolour with fine ink linework, warm gentle palette,
hand-painted storybook feel, consistent lighting from upper left.

STRICT REQUIREMENTS:
- Pure white background, nothing else in the scene
- NO speech bubbles, NO text, NO letters of any language
- NO decorative elements (sparkles, hearts, flowers, confetti, floating objects)
- NO drop shadow, NO glow, NO gradient background
- Single subject, centred, full body visible, ~10% margin on all sides
- The pillow must touch the kitten, not float separately
- Square composition, at least 1024x1024
```
</details>

<details>
<summary><b>Stage 2 — 紙箱佔領</b></summary>

```
A cute cat character illustration, children's storybook watercolour style.

CHARACTER: a round, chubby Scottish Fold cat with small folded-down ears.
Silver-grey mackerel tabby: dark charcoal stripes on the head, back and tail,
soft cream-white muzzle, chest and belly with faint spotted markings.
Large round eyes in olive green with dark rims. Small pink nose with a dark
outline, and a white blaze running up the bridge. Plump cheeks, short thick
legs, calm slightly sleepy expression.

SCENE: the cat squeezed into a small plain cardboard box that is clearly too
small for it, only its head and front paws poking out over the edge, looking
very pleased with itself.

STYLE: soft watercolour with fine ink linework, warm gentle palette,
hand-painted storybook feel, consistent lighting from upper left.

STRICT REQUIREMENTS:
- Pure white background, nothing else in the scene
- NO speech bubbles, NO text, NO letters of any language
- NO decorative elements (sparkles, hearts, flowers, confetti, floating objects)
- NO drop shadow, NO glow, NO gradient background
- Single subject, centred, ~10% margin on all sides
- Square composition, at least 1024x1024
```
</details>

<details>
<summary><b>Stage 3 — 鍵盤路障</b></summary>

```
A cute cat character illustration, children's storybook watercolour style.

CHARACTER: a round, chubby Scottish Fold cat with small folded-down ears.
Silver-grey mackerel tabby: dark charcoal stripes on the head, back and tail,
soft cream-white muzzle, chest and belly with faint spotted markings.
Large round eyes in olive green with dark rims. Small pink nose with a dark
outline, and a white blaze running up the bridge. Plump cheeks, short thick
legs, calm slightly sleepy expression.

SCENE: the cat sprawled belly-down across the keyboard of an open laptop,
front paws hanging over the edge, half-lidded eyes, completely refusing to
move. The laptop is plain and unbranded with a blank screen.

STYLE: soft watercolour with fine ink linework, warm gentle palette,
hand-painted storybook feel, consistent lighting from upper left.

STRICT REQUIREMENTS:
- Pure white background, nothing else in the scene
- NO speech bubbles, NO text, NO letters or logos of any kind
- NO decorative elements (sparkles, hearts, flowers, confetti, floating objects)
- NO drop shadow, NO glow, NO gradient background
- Single subject, centred, ~10% margin on all sides
- Square composition, at least 1024x1024
```
</details>

<details>
<summary><b>Stage 4 — 攤平大爺（最終形態）</b></summary>

```
A cute cat character illustration, children's storybook watercolour style.

CHARACTER: a round, chubby Scottish Fold cat with small folded-down ears.
Silver-grey mackerel tabby: dark charcoal stripes on the head, back and tail,
soft cream-white muzzle, chest and belly with faint spotted markings.
Large round eyes in olive green with dark rims. Small pink nose with a dark
outline, and a white blaze running up the bridge. Plump cheeks, short thick
legs. Noticeably fatter and fluffier than earlier stages.

SCENE: the cat lying flat on its back on a thick folded blanket, belly fully
exposed, all four paws relaxed in the air, head tilted back, eyes half closed
in total contentment. The pose of a cat that owns the entire house.

STYLE: soft watercolour with fine ink linework, warm gentle palette,
hand-painted storybook feel, consistent lighting from upper left.

STRICT REQUIREMENTS:
- Pure white background, nothing else in the scene
- NO speech bubbles, NO text, NO letters of any language
- NO crown, NO cape, NO costume, NO accessories
- NO decorative elements (sparkles, hearts, flowers, confetti, floating objects)
- NO drop shadow, NO glow, NO gradient background
- Single subject, centred, full body visible, ~10% margin on all sides
- The blanket must touch the cat, not float separately
- Square composition, at least 1024x1024
```
</details>

---

## 拿到圖之後

```bash
python tools/make_pet_png.py hana9
```

然後在 `custom_pets.json` 加一行、`sw.js` 版本 +1、push。

若某張還是有對話框或裝飾物黏在角色上：

```bash
python tools/make_pet_png.py hana9 --erase "4:0.62,0.0,1.0,0.27"
```
（圖號:x1,y1,x2,y2，比例 0~1）

---

## 照片轉插圖的注意事項

把實際照片餵給生圖工具當參考時：

- **挑健康、正常狀態的照片**。例如戴著頸圈、剃毛、生病的樣子會被學進去。
- 挑**光線均勻、正面、看得到完整臉部特徵**的照片，摺耳、花紋、眼睛顏色才抓得準。
- 一次只給一張參考照，五個階段都用同一張，角色才會一致。
