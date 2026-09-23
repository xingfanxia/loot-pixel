#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["pillow", "numpy"]
# ///
"""Shift a published card's face along the skin ramp, for generator lighting that
put the face in the wrong tone (see art/cl-team/style.md, Post-processed cards).

Floods from the face centre through connected skin-coloured pixels only, so hair,
clothes and props that touch the face through an outline stay untouched.

  scripts/art/shift-face.py co-rare-1 --map H:h,B:H,n:B          # lighten one step
  scripts/art/shift-face.py jermaine-legendary-1 --map c:H,h:H,H:B,B:n   # darken
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SKIN = {"c": "f4efe0", "h": "f5d2b4", "H": "dfa47f", "B": "c98f5a", "n": "a86d45", "p": "ff9aa8"}
RGB = {k: tuple(int(v[i:i + 2], 16) for i in (0, 2, 4)) for k, v in SKIN.items()}
KEY = {v: k for k, v in RGB.items()}


def shift(path: Path, seed: tuple[int, int], mapping: dict[str, str]) -> int:
    im = np.asarray(Image.open(path).convert("RGBA")).copy()
    h, w = im.shape[:2]

    def key(y, x):
        return KEY.get(tuple(int(c) for c in im[y, x, :3])) if im[y, x, 3] else None

    cands = [(abs(y - seed[0]) + abs(x - seed[1]), y, x) for y in range(h) for x in range(w) if key(y, x)]
    if not cands:
        return 0
    _, y0, x0 = min(cands)
    seen = np.zeros((h, w), bool)
    stack, n = [(y0, x0)], 0
    while stack:
        y, x = stack.pop()
        if seen[y, x]:
            continue
        seen[y, x] = True
        k = key(y, x)
        if not k:
            continue
        if k in mapping:
            im[y, x, :3] = RGB[mapping[k]]
            n += 1
        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= yy < h and 0 <= xx < w and not seen[yy, xx]:
                stack.append((yy, xx))
    Image.fromarray(im).save(path, optimize=True)
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cards", nargs="+", help="card ids, e.g. co-rare-1")
    ap.add_argument("--map", required=True, help="from:to skin keys, comma-separated (keys: c h H B n)")
    ap.add_argument("--deck", default="cl-team")
    args = ap.parse_args()
    mapping = dict(pair.split(":") for pair in args.map.split(","))
    for c in args.cards:
        base = ROOT / "public/decks" / args.deck
        a = shift(base / f"{c}.png", (30, 32), mapping)
        i = shift(base / f"{c}-icon.png", (12, 12), mapping)
        print(f"{c}: {a} art px, {i} icon px shifted")


if __name__ == "__main__":
    main()
