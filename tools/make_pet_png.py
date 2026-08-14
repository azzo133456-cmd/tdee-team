"""把寵物插圖的 jpg 去背成 512x512 透明 PNG。

流程：rembg 去背 → 只保留最大的連通區塊（丟掉對話框、愛心、碎片等裝飾）
     → 依角色外框裁切 → 等比縮放並置中到 512x512，四邊留約 9% 空白。

對話框多半會被判成獨立區塊而自動丟掉；若它跟角色黏在一起（例如翅膀碰到框邊），
用 --erase 指定原圖上的矩形先塗掉，比例座標 0~1，可重複：
     python tools/make_pet_png.py BIRD2
     python tools/make_pet_png.py BIRD2 --erase 4:0.55,0.0,1.0,0.45
     （4 = 第幾張圖，接著是 x1,y1,x2,y2）
"""
import sys
import io
import os
import argparse

import numpy as np
from PIL import Image
from scipy import ndimage
from rembg import remove, new_session

# birefnet-general 對細長物件（權杖、自拍棒、鬍鬚）明顯優於預設的 u2net：
# 實測 UNI1 第 4 張的權杖，u2net 只抓到 40%、birefnet 抓到 67%。
DEFAULT_MODEL = "birefnet-general"
_SESSION = {}


def session(name: str):
    if name not in _SESSION:
        _SESSION[name] = new_session(name)
    return _SESSION[name]

CANVAS = 512
MARGIN = 0.09          # 四邊留白比例
ALPHA_MIN = 24         # 低於此值視為透明
SPECKLE = 0.004        # 面積小於主體這個比例的碎塊一律丟掉


def cutout(path: str, keep_ratio: float, erase=(), model: str = DEFAULT_MODEL):
    src = Image.open(path).convert("RGB")
    if erase:
        # 在去背前把指定矩形塗成白色，讓 rembg 直接把它當背景
        px = src.load()
        w, h = src.size
        for (x1, y1, x2, y2) in erase:
            for y in range(int(y1 * h), min(h, int(y2 * h))):
                for x in range(int(x1 * w), min(w, int(x2 * w))):
                    px[x, y] = (255, 255, 255)
    out = remove(src, session=session(model))   # rembg 回傳 RGBA
    rgba = np.array(out.convert("RGBA"))
    alpha = rgba[:, :, 3]

    mask = alpha > ALPHA_MIN
    if not mask.any():
        raise SystemExit(f"{path}: 去背後整張都是透明的")

    lab, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    biggest = sizes[main - 1]

    # 主體一定留；其餘區塊只有夠大才留（例如角色的圍巾被切開），碎塊與對話框丟掉
    keep = {main}
    for i, s in enumerate(sizes, start=1):
        if i != main and s >= biggest * keep_ratio:
            keep.add(i)
    dropped = n - len(keep)

    sel = np.isin(lab, list(keep))
    rgba[:, :, 3] = np.where(sel, alpha, 0)
    return Image.fromarray(rgba), n, dropped


def fit_canvas(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        raise SystemExit("裁切後沒有內容")
    im = im.crop(bbox)
    inner = int(CANVAS * (1 - 2 * MARGIN))
    scale = min(inner / im.width, inner / im.height)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(im, ((CANVAS - im.width) // 2, (CANVAS - im.height) // 2), im)
    return canvas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", help="public/pets 下的資料夾名，例如 BIRD2")
    ap.add_argument("--keep-ratio", type=float, default=0.95,
                    help="次要區塊面積達主體的多少比例才保留（預設 0.95，等於只留最大塊）")
    ap.add_argument("--erase", action="append", default=[],
                    help="去背前塗白的矩形，格式 idx:x1,y1,x2,y2（比例 0~1），可重複")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"rembg 模型（預設 {DEFAULT_MODEL}）")
    args = ap.parse_args()

    erases = {}
    for spec in args.erase:
        idx, _, box = spec.partition(":")
        erases.setdefault(int(idx), []).append(tuple(float(v) for v in box.split(",")))

    base = os.path.join(os.path.dirname(__file__), "..", "public", "pets", args.folder)
    base = os.path.normpath(base)
    if not os.path.isdir(base):
        raise SystemExit(f"找不到資料夾：{base}")

    for i in range(5):
        jpg = os.path.join(base, f"{i}.jpg")
        if not os.path.exists(jpg):
            print(f"  {i}.jpg 不存在，略過")
            continue
        im, n, dropped = cutout(jpg, args.keep_ratio, erases.get(i, ()), args.model)
        im = fit_canvas(im)
        # 量化成調色盤（保留透明），檔案從 ~170KB 降到 ~40KB，肉眼幾乎無差
        im = im.quantize(colors=255, method=Image.FASTOCTREE)
        png = os.path.join(base, f"{i}.png")
        im.save(png, "PNG", optimize=True)
        kb = os.path.getsize(png) / 1024
        print(f"  {i}.png  {im.size[0]}x{im.size[1]}  {kb:6.1f} KB   區塊 {n} 個，丟掉 {dropped}")


if __name__ == "__main__":
    main()
