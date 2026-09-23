#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=10", "numpy>=1.26"]
# ///
"""Build the pixel-grid composition draft passed to GPT Image as a 2nd --edit.

The reference photo is cropped to a tight bust (the head-with-hair box fills
`--head-frac` of the width, crown `--pad` cells below the top), box-downsampled
to the art grid, its white studio background replaced by the flat key blue, and
upscaled nearest-neighbour by `--block`. The generator then repaints it in
costume on that exact grid, which fixes framing and block size; the original
photo, passed as the first --edit, carries the fine likeness.

  scripts/art/draft.py ref.png out.png --head 95,22,205 --art 52x57 --block 16
"""

from __future__ import annotations

import argparse

import numpy as np
from PIL import Image


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ref")
    ap.add_argument("out")
    ap.add_argument("--head", required=True, help="left,top,right of the head incl. hair, in ref px")
    ap.add_argument("--art", default="64x72")
    ap.add_argument("--block", type=int, default=16)
    ap.add_argument("--head-frac", type=float, default=0.6)
    ap.add_argument("--pad", type=int, default=3)
    ap.add_argument("--key", default="#ffffff", help="colour for the keyed studio background and the padding (white keeps the photo as is)")
    ap.add_argument("--white", type=int, default=256, help="grey level treated as studio background (256 = off; posterized faces leak into a white key)")
    args = ap.parse_args()

    gw, gh = (int(v) for v in args.art.lower().split("x"))
    L, T, R = (float(v) for v in args.head.split(","))
    im = Image.open(args.ref).convert("RGBA")
    bgc = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bgc.alpha_composite(im)
    rgb = np.asarray(bgc.convert("RGB")).astype(np.int32)

    # flood-fill the near-white studio background from the border -> key colour
    light = rgb.min(-1) >= args.white
    bg = np.zeros_like(light)
    bg[0] = light[0]; bg[-1] = light[-1]; bg[:, 0] |= light[:, 0]; bg[:, -1] |= light[:, -1]
    while True:
        g = bg.copy()
        g[1:] |= bg[:-1]; g[:-1] |= bg[1:]; g[:, 1:] |= bg[:, :-1]; g[:, :-1] |= bg[:, 1:]
        g &= light
        if (g == bg).all():
            break
        bg = g
    key = [int(args.key.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    rgb[bg] = key
    src = Image.fromarray(rgb.astype(np.uint8), "RGB")

    fw = (R - L) / args.head_frac
    cell = fw / gw
    x0 = (L + R) / 2 - fw / 2
    y0 = T - args.pad * cell
    box = (x0, y0, x0 + fw, y0 + gh * cell)
    # pad the canvas: key colour above and at the sides, bottom rows repeated
    M = int(max(0, -x0, -y0, x0 + fw - src.width, y0 + gh * cell - src.height)) + 2
    big = np.zeros((rgb.shape[0] + 2 * M, rgb.shape[1] + 2 * M, 3), np.int32)
    big[:] = key
    big[M:M + rgb.shape[0], M:M + rgb.shape[1]] = rgb
    big[M + rgb.shape[0]:, M:M + rgb.shape[1]] = rgb[-1]
    src = Image.fromarray(big.astype(np.uint8), "RGB")
    shifted = tuple(v + M for v in box)
    arr = np.asarray(src.resize((gw, gh), Image.BOX, box=shifted))
    Image.fromarray(arr).resize((gw * args.block, gh * args.block), Image.NEAREST).save(args.out)
    print(f"draft {gw}x{gh} x{args.block} crop={tuple(round(v, 1) for v in box)} -> {args.out}")


if __name__ == "__main__":
    main()
