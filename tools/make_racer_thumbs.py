"""為 public/racers/ 下的每張賽道圖產生『賽道用小圖』<key>_sm.png。
做法：高品質 Lanczos 縮到 ~44px（約 2x 顯示尺寸，retina 也清楚）後做 UnsharpMask 銳化。
原圖不動；賽道改用 _sm 版（前端 onerror 會自動退回原圖）。圖更新後重跑這支即可。
"""
import os, glob
from PIL import Image, ImageFilter

base = os.path.join(os.path.dirname(__file__), "..", "public", "racers")
SIZE = 44  # 約 2x 的顯示尺寸（賽道顯示約 20~22px）

for f in sorted(glob.glob(os.path.join(base, "*.png"))):
    name = os.path.basename(f)
    key, ext = os.path.splitext(name)
    if key.endswith("_sm"):
        continue
    im = Image.open(f).convert("RGBA")
    # 等比縮放，長邊到 SIZE，置中貼到透明方形畫布
    im.thumbnail((SIZE, SIZE), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2), im)
    # 輕度銳化，補回縮小流失的邊緣
    canvas = canvas.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=2))
    out = os.path.join(base, key + "_sm.png")
    canvas.save(out)
    print("generated", os.path.basename(out), canvas.size)
