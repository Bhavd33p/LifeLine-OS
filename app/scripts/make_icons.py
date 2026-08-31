"""Generates the app icons.

Drawn rather than hand-exported so the set can be regenerated at any size and
stays in step with the app's palette. Run: python3 scripts/make_icons.py
"""
from PIL import Image, ImageDraw
import pathlib

S = 1024                      # drawn large, downsampled for clean edges
BG = (24, 24, 27)             # zinc-900, the app's dark surface
RAIL = (63, 63, 70)           # zinc-700
DONE = (5, 150, 105)          # emerald-600, the "done" colour in the app
NOW = (244, 244, 245)         # zinc-100
LATER = (161, 161, 170)       # zinc-400, light enough to hold up on the dark ground

# A day as the app draws it: a rail with blocks hanging off it. Kept inside the
# middle ~72% so a maskable/rounded crop never clips it.
RAIL_X = 252
BARS = [
    (330, 232, 858, 382, DONE),
    (330, 437, 742, 587, NOW),
    (330, 642, 812, 792, LATER),
]


def draw(size: int) -> Image.Image:
    img = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(img)

    d.rounded_rectangle([RAIL_X - 10, 238, RAIL_X + 10, 786], radius=10, fill=RAIL)

    for x0, y0, x1, y1, colour in BARS:
        d.rounded_rectangle([x0, y0, x1, y1], radius=40, fill=colour)
        cy = (y0 + y1) // 2
        # A dot on the rail per block, ringed in the background colour so the
        # rail appears to pass behind it.
        d.ellipse([RAIL_X - 50, cy - 50, RAIL_X + 50, cy + 50], fill=BG)
        d.ellipse([RAIL_X - 34, cy - 34, RAIL_X + 34, cy + 34], fill=colour)

    return img.resize((size, size), Image.LANCZOS)


out = pathlib.Path(__file__).resolve().parent.parent / "public" / "icons"
out.mkdir(parents=True, exist_ok=True)
for size in (180, 192, 512, 1024):
    draw(size).save(out / f"icon-{size}.png")
    print("wrote", out / f"icon-{size}.png")
