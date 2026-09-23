#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=10", "numpy>=1.26"]
# ///
"""Quantize a GPT Image pixel-art portrait into loot-pixel card art.

generator PNG -> key out the flat blue background -> map the frame onto the
art grid (`--fit frame`: the draft from draft.py fixed the composition; `--fit
bust` re-finds crown and head instead) -> per-cell vote in OKLab (thin dark
features weighted up, flat cells by mean, optional restrained Bayer dither)
-> nearest PAL colour, skin-band pixels restricted to the skin ramp -> face
re-shading (peach midtones to cream, tan kept on the face contour) -> drop
low-contrast stray pixels -> 1px `k` outline -> art PNG + face-crop icon PNG +
~512px webp source copy. Defaults are the locked cl-team settings
(art/cl-team/style.md).

Every opaque output pixel is exactly one PAL colour (parsed from
src/lib/vault/palette.ts) and alpha is 0 or 255; the script asserts both.

Example:
  scripts/art/quantize.py gen.png --art-out public/decks/cl-team/nancy-common-1.png \
      --icon-out public/decks/cl-team/nancy-common-1-icon.png \
      --src-out art/cl-team/source/nancy-common-1.webp --art 64x72 --icon 24
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PALETTE_TS = ROOT / "src/lib/vault/palette.ts"
BAYER4 = (np.array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]).reshape(4, 4) + 0.5) / 16


# On costume-heavy tiers the generator draws the face about 10% smaller than
# the draft asks for (face ~0.44 of the width vs ~0.50 on common cards);
# cropping the frame about its top centre brings it back. Drawing a bigger
# head in the draft did not help.
TIER_ZOOM = {"rare": 1.1, "epic": 1.1, "legendary": 1.1}


# ---------------------------------------------------------------- palette ---

def load_palette(path: Path = PALETTE_TS) -> tuple[list[str], np.ndarray]:
    text = path.read_text()
    block = re.search(r"export const PAL[^{]*\{(.*?)\};", text, re.S)
    if not block:
        sys.exit(f"PAL not found in {path}")
    pairs = re.findall(r"['\"]?(\w)['\"]?\s*:\s*'#([0-9a-fA-F]{6})'", block.group(1))
    keys = [k for k, _ in pairs]
    rgb = np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)] for _, h in pairs], np.uint8)
    for need in ("k", "g", "G", "l"):
        assert need in keys, f"palette is missing required key {need!r}"
    return keys, rgb


SKIN_PAIRS = ("cB", "Bb", "bd", "cp", "co", "wc")


def load_ramp_pairs(keys: list[str], path: Path = PALETTE_TS) -> set[tuple[int, int]]:
    """Palette index pairs that may be dithered: neighbours in palette.ts RAMPS + skin ramps."""
    block = re.search(r"export const RAMPS[^{]*\{(.*?)\};", path.read_text(), re.S)
    pairs: set[tuple[int, int]] = set()
    ramps = re.findall(r"\[([^\]]*)\]", block.group(1)) if block else []
    for r in ramps:
        seq = re.findall(r"'(\w)'", r)
        for a, b in zip(seq, seq[1:]):
            if a != b:
                pairs.add((keys.index(a), keys.index(b)))
    for a, b in SKIN_PAIRS:
        pairs.add((keys.index(a), keys.index(b)))
    return pairs | {(b, a) for a, b in pairs}


def srgb_to_oklab(rgb: np.ndarray) -> np.ndarray:
    c = rgb.astype(np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    lms = np.cbrt(lin @ m1.T)
    return lms @ m2.T


# Skin handling. PAL carries skin midtones (h light peach, H peach, n mid brown)
# between cream c, tan B and brown b/d. Before those existed, plain nearest-colour
# split peach skin into cream / pink / pale-gold / white blotches. Pixels in the skin and
# brown-hair hue band are matched only against --skin-keys (cream, pink, tan,
# brown, dark brown), lifted slightly so fair midtones land on cream rather
# than tan, and pink is kept for genuinely rosy pixels (blush, lips).
SKIN = {"keys": None, "l_weight": 1.0, "lift": 0.04, "pink": -1}


def skin_mask(lab: np.ndarray) -> np.ndarray:
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    chroma = np.hypot(a, b)
    hue = np.degrees(np.arctan2(b, a))
    return (L > 0.35) & (L < 0.97) & (chroma > 0.012) & (chroma < 0.13) & (hue > 15) & (hue < 90)


def rosy(lab: np.ndarray) -> np.ndarray:
    """Blush / lip pixels: red leaning (a > b). Tan and peach skin with the
    same redness leans yellow (b > a) and must not turn pink."""
    return (lab[..., 1] > 0.035) & (lab[..., 1] > lab[..., 2])


def _argmin(flat, pal_lab, allowed, lw=1.0):
    wv = np.array([lw, 1.0, 1.0])
    d = (((flat[:, None, :] - pal_lab[None, :, :]) * wv) ** 2).sum(-1)
    d[:, ~allowed] = np.inf
    return d.argmin(1)


def nearest(lab: np.ndarray, pal_lab: np.ndarray, allowed: np.ndarray) -> np.ndarray:
    """Index of the nearest allowed palette colour for each OKLab row."""
    flat = lab.reshape(-1, 3)
    out = _argmin(flat, pal_lab, allowed)
    if SKIN["keys"] is not None:
        m = skin_mask(flat)
        if m.any():
            sk = flat[m] + np.array([SKIN["lift"], 0.0, 0.0])
            res = _argmin(sk, pal_lab, allowed & SKIN["keys"], SKIN["l_weight"])
            if SKIN["pink"] >= 0:
                # pink only for genuinely rosy pixels (blush, lips), never plain midtones
                no_p = allowed & SKIN["keys"]
                no_p[SKIN["pink"]] = False
                plain = ~rosy(sk)
                if plain.any():
                    res[plain] = _argmin(sk[plain], pal_lab, no_p, SKIN["l_weight"])
            out[m] = res
    return out.reshape(lab.shape[:-1])


# ------------------------------------------------------------- background ---

def key_background(rgb: np.ndarray, key: str, tol: float, fringe: float) -> np.ndarray:
    """Opaque mask: False where the flat key-colour background is (plus its anti-aliased ring)."""
    h, w, _ = rgb.shape
    lab = srgb_to_oklab(rgb)
    if key == "auto":
        border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
        bg = np.median(border, 0)
    else:
        bg = srgb_to_oklab(np.array([[int(key.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]], np.uint8))[0]
    dist = np.sqrt(((lab - bg) ** 2).sum(-1))
    # the key is a pure chroma blue no subject colour comes near, so every
    # close pixel is background, including pockets enclosed by halos or arms
    bgmask = dist < tol
    # one ring of anti-aliased fringe that is still close to the key colour
    ring = np.zeros_like(bgmask)
    ring[1:] |= bgmask[:-1]; ring[:-1] |= bgmask[1:]
    ring[:, 1:] |= bgmask[:, :-1]; ring[:, :-1] |= bgmask[:, 1:]
    bgmask |= ring & (dist < fringe)
    return ~bgmask


# ------------------------------------------------------------------- grid ---

def detect_grid(rgb: np.ndarray, expect: float) -> tuple[float, float, float, float]:
    """Find the generator's drawn block size and phase from edge periodicity.

    Returns (period, phase_x, phase_y, score); score ~1 means edges fall on a
    regular grid, ~0 means no grid (the caller then samples continuously)."""
    g = rgb.astype(np.float64).sum(-1)
    ex = np.abs(np.diff(g, axis=1)).sum(0)  # edge strength between column i and i+1
    ey = np.abs(np.diff(g, axis=0)).sum(1)
    best = (expect, 0.0, 0.0, 0.0)
    for p in np.arange(expect * 0.7, expect * 1.35, 0.25):
        sc = []
        phases = []
        for e in (ex, ey):
            n = len(e)
            idx = np.arange(n)
            # phase histogram of edge energy modulo p
            bins = max(4, int(round(p)))
            ph = ((idx + 0.5) % p) / p * bins
            hist = np.bincount(ph.astype(int) % bins, weights=e, minlength=bins)
            k = hist.argmax()
            sc.append(hist[k] / (hist.sum() + 1e-9) * bins / 4)  # 1/4 of energy in one bin -> 1
            phases.append(((k + 0.5) / bins * p + 0.5) % p)  # boundary x position mod p
        s = min(sc)
        if s > best[3]:
            best = (float(p), phases[0], phases[1], float(s))
    return best


# --------------------------------------------------------------- sampling ---

def best_mix(m, pal_lab, allowed, pairs, max_pair=0.32):
    """Nearest colour, or the two-colour ramp mix (a, b, t) that best explains m."""
    if SKIN["keys"] is not None and skin_mask(m[None])[0]:
        allowed = allowed & SKIN["keys"]
    d = np.sqrt(((pal_lab - m) ** 2).sum(-1))
    d[~allowed] = np.inf
    order = np.argsort(d)[:6]
    a0 = order[0]
    best = (a0, a0, 0.0, d[a0])
    for i in range(len(order)):
        for j in range(i + 1, len(order)):
            a, b = order[i], order[j]
            if (a, b) not in pairs:
                continue
            ab = pal_lab[b] - pal_lab[a]
            L = np.sqrt((ab ** 2).sum())
            if L > max_pair or L < 1e-6:
                continue
            t = float(np.clip(((m - pal_lab[a]) @ ab) / (L * L), 0, 1))
            res = np.sqrt(((m - (pal_lab[a] + t * ab)) ** 2).sum())
            if res < best[3] - 0.01:
                best = (a, b, t, res)
    return best


def sample_cells(rgb, opaque, x0, y0, cell, gw, gh, pal_lab, allowed, mode, dither, pairs=frozenset(),
                 dark_bias=2.0, flat=0.004):
    """Sample a gw x gh grid whose cell (0,0) starts at (x0,y0) in source px.

    mode:   most common palette colour in the cell centre (keeps crisp features)
    mean:   OKLab mean of the cell, nearest colour
    hybrid: mode on detailed cells, mean on flat ones (variance < `flat`)
    With `dither`, flat cells whose mean sits between two close ramp colours get
    a restrained 4x4 Bayer mix of the two (only for 0.25 <= t <= 0.75)."""
    h, w, _ = rgb.shape
    if mode == "lanczos":
        box = (x0, y0, x0 + gw * cell, y0 + gh * cell)
        small = np.asarray(Image.fromarray(rgb).resize((gw, gh), Image.LANCZOS, box=box))
        cover = np.asarray(Image.fromarray(opaque.astype(np.uint8) * 255).resize((gw, gh), Image.BOX, box=box))
        out = nearest(srgb_to_oklab(small), pal_lab, allowed).astype(np.int32)
        out[cover < 128] = -1
        return out
    lab = srgb_to_oklab(rgb)
    pidx = nearest(lab, pal_lab, allowed)
    out = np.full((gh, gw), -1, np.int32)
    for j in range(gh):
        for i in range(gw):
            ax, ay = x0 + i * cell, y0 + j * cell
            inset = cell * 0.2
            xa, xb = int(round(ax + inset)), int(round(ax + cell - inset))
            ya, yb = int(round(ay + inset)), int(round(ay + cell - inset))
            xb, yb = max(xb, xa + 1), max(yb, ya + 1)
            if xb <= 0 or yb <= 0 or xa >= w or ya >= h:
                continue
            xa, ya, xb, yb = max(xa, 0), max(ya, 0), min(xb, w), min(yb, h)
            op = opaque[ya:yb, xa:xb]
            if op.mean() < 0.5:
                continue
            px = lab[ya:yb, xa:xb][op]
            is_flat = px.var(0).sum() < flat
            if mode == "mode" or (mode == "hybrid" and not is_flat):
                vals = pidx[ya:yb, xa:xb][op]
                # features (eyes, brows, mouth lines, outlines) are darker than
                # their cell: weight them up so thin dark strokes survive
                wts = np.where(px[:, 0] < px[:, 0].mean() - 0.15, dark_bias, 1.0)
                out[j, i] = np.bincount(vals, weights=wts, minlength=len(pal_lab)).argmax()
                continue
            m = px.mean(0)
            a, b, t, _ = best_mix(m, pal_lab, allowed, pairs)
            if dither and is_flat and a != b and 0.25 <= t <= 0.75:
                out[j, i] = b if t > BAYER4[j & 3, i & 3] else a
            else:
                out[j, i] = nearest(m[None], pal_lab, allowed)[0]
    return out


def fit_box(opaque, gw, gh, pad, grid, center_x=None, zoom=1.0, crown=None):
    """Choose (x0, y0, cell) so the crown sits `pad` cells below the top and
    the bust reaches the bottom; snaps to the drawn grid when one was found."""
    h, w = opaque.shape
    rows = np.where(opaque.any(1))[0]
    if len(rows) == 0:
        sys.exit("no subject left after keying the background")
    crown = rows[0] if crown is None else crown
    period, px, py, score = grid
    cell = w / gw / zoom
    if score > 0.6 and abs(period - cell) / cell < 0.2:
        cell = period
    # the crop must reach the bottom of the frame so the shoulders run off it
    if (h - crown) < (gh - pad) * cell:
        cell = (h - crown) / (gh - pad)
    head = opaque[crown:crown + int(0.35 * (h - crown))]
    cols = np.where(head.any(0))[0]
    cx = center_x if center_x is not None else (cols[0] + cols[-1] + 1) / 2
    x0 = cx - gw * cell / 2
    y0 = crown - pad * cell
    if score > 0.6 and abs(period - cell) / cell < 0.02:
        x0 = px + round((x0 - px) / cell) * cell
        y0 = py + round((y0 - py) / cell) * cell
    return x0, y0, cell



# -------------------------------------------------------------- face skin ---

def cell_stats(rgb, opaque, x0, y0, cell, gw, gh):
    """Per-cell median OKLab and skin-band fraction of the opaque source pixels."""
    h, w, _ = rgb.shape
    lab = srgb_to_oklab(rgb)
    sk = skin_mask(lab)
    med = np.full((gh, gw, 3), np.nan)
    frac = np.zeros((gh, gw))
    for j in range(gh):
        for i in range(gw):
            xa, xb = int(round(x0 + i * cell + cell * 0.2)), int(round(x0 + (i + 1) * cell - cell * 0.2))
            ya, yb = int(round(y0 + j * cell + cell * 0.2)), int(round(y0 + (j + 1) * cell - cell * 0.2))
            xa, ya, xb, yb = max(xa, 0), max(ya, 0), min(max(xb, xa + 1), w), min(max(yb, ya + 1), h)
            if xa >= xb or ya >= yb:
                continue
            op = opaque[ya:yb, xa:xb]
            if op.mean() < 0.5:
                continue
            med[j, i] = np.median(lab[ya:yb, xa:xb][op], 0)
            frac[j, i] = sk[ya:yb, xa:xb][op].mean()
    return med, frac


def face_skin(art, med, frac, keys, pal_lab, tones, zone, seed, mode, small_max=6):
    """Re-shade the face the way a pixel artist would.

    Written before PAL had skin midtones (default is now --face off): the
    generator's peach midtone landed on tan and a fair face read as blotchy stubble, and big generator shadow areas read as
    a half-shadowed face. `tones` is the subject's lit and shadow key (cB for
    fair skin, Bb for dark skin). Starting from the face centre, flood through
    skin-band cells no darker than the shadow tone inside the head zone. They
    all become the lit tone, except (mode 'rim') a one-cell shadow-tone edge
    where a non-lit cell leaves the face, which keeps the jaw, cheek and
    hairline contour. Small shadow shapes (at most `small_max` cells: nose
    side, nostril, eye socket), darker cells (brows, eyes, mouth, stubble)
    and rosy cells (blush, lips) keep the colour the vote gave them."""
    c, B, pk = keys.index(tones[0]), keys.index(tones[1]), keys.index("p")
    lit_min = pal_lab[c, 0] - 0.4 * (pal_lab[c, 0] - pal_lab[B, 0])
    mid_min = pal_lab[B, 0] - 0.035
    gh, gw = art.shape
    zx0, zy0, zx1, zy1 = zone
    L = med[..., 0]
    ok = (frac > 0.6) & (L >= mid_min) & ~np.isnan(L)
    zmask = np.zeros_like(ok)
    zmask[max(zy0, 0):min(zy1, gh), max(zx0, 0):min(zx1, gw)] = True
    ok &= zmask
    ys, xs = np.nonzero(ok)
    if len(ys) == 0:
        return art
    k0 = np.argmin((ys - seed[0]) ** 2 + (xs - seed[1]) ** 2)
    comp = np.zeros_like(ok)
    stack = [(ys[k0], xs[k0])]
    while stack:
        y, x = stack.pop()
        if comp[y, x]:
            continue
        comp[y, x] = True
        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= yy < gh and 0 <= xx < gw and ok[yy, xx] and not comp[yy, xx]:
                stack.append((yy, xx))
    # connected non-lit shapes inside the face: small ones (nose side, nostril,
    # dimple, eye socket) are deliberate modelling and keep their tan
    shade = comp & (L < lit_min)
    small = np.zeros_like(shade)
    seen = np.zeros_like(shade)
    for y0, x0 in zip(*np.nonzero(shade)):
        if seen[y0, x0]:
            continue
        blob, stack = [], [(y0, x0)]
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            blob.append((y, x))
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy < gh and 0 <= xx < gw and shade[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    stack.append((yy, xx))
        if len(blob) <= small_max:
            for y, x in blob:
                small[y, x] = True
    out = art.copy()
    for y, x in zip(*np.nonzero(comp)):
        if small[y, x]:
            continue
        if art[y, x] not in (c, B, pk):
            continue  # a feature stroke the dark-biased vote kept (eye, brow, lip line)
        if rosy(med[y, x]):
            continue  # blush / lips
        if L[y, x] >= lit_min or mode == "flat":
            out[y, x] = c
            continue
        leaves = any(not (0 <= yy < gh and 0 <= xx < gw) or not comp[yy, xx]
                     for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)))
        out[y, x] = B if leaves else c
    return out



# -------------------------------------------------------------- cleanups ---

def remove_strays(idx, pal_lab, thresh):
    """Replace isolated pixels that barely differ from their surroundings.

    High-contrast singletons (pupils, catch-lights) are kept on purpose."""
    h, w = idx.shape
    out = idx.copy()
    for y in range(h):
        for x in range(w):
            c = idx[y, x]
            nb = [idx[yy, xx] for yy in (y - 1, y, y + 1) for xx in (x - 1, x, x + 1)
                  if (yy, xx) != (y, x) and 0 <= yy < h and 0 <= xx < w]
            if c in nb:
                continue
            vals, counts = np.unique(nb, return_counts=True)
            dom = vals[counts.argmax()]
            if c < 0:  # a transparent hole inside the figure
                if dom >= 0 and counts.max() >= 6:
                    out[y, x] = dom
                continue
            if dom < 0:  # a floating opaque speck
                if counts.max() >= 6:
                    out[y, x] = -1
                continue
            if np.sqrt(((pal_lab[c] - pal_lab[dom]) ** 2).sum()) < thresh:
                out[y, x] = dom
    return out


def outline(idx, k):
    """1px outer `k` outline on the 4-connected silhouette."""
    op = idx >= 0
    ring = np.zeros_like(op)
    ring[1:] |= op[:-1]; ring[:-1] |= op[1:]
    ring[:, 1:] |= op[:, :-1]; ring[:, :-1] |= op[:, 1:]
    out = idx.copy()
    out[ring & ~op] = k
    # also darken the existing silhouette edge that already touches the frame border? no:
    # shoulders simply run off the frame edge.
    return out


def to_image(idx, pal_rgb):
    h, w = idx.shape
    arr = np.zeros((h, w, 4), np.uint8)
    op = idx >= 0
    arr[op, :3] = pal_rgb[idx[op]]
    arr[op, 3] = 255
    return Image.fromarray(arr, "RGBA")


def assert_contract(img: Image.Image, pal_rgb: np.ndarray, size: tuple[int, int]):
    a = np.asarray(img)
    assert img.mode == "RGBA" and img.size == size, (img.mode, img.size, size)
    alpha = a[..., 3]
    assert set(np.unique(alpha)) <= {0, 255}, "alpha must be 0 or 255"
    op = a[alpha == 255][:, :3]
    pal = {tuple(c) for c in pal_rgb}
    bad = {tuple(c) for c in op} - pal
    assert not bad, f"non-palette colours: {sorted(bad)[:5]}"


# ---------------------------------------------------------------- preview ---

def preview(path, art, icon, ref, scale, bg):
    a = art.resize((art.width * scale, art.height * scale), Image.NEAREST)
    ic = icon.resize((icon.width * scale, icon.height * scale), Image.NEAREST)
    tiles = []
    if ref:
        r = Image.open(ref).convert("RGBA")
        r = r.resize((int(r.width * a.height / r.height), a.height), Image.LANCZOS)
        tiles.append(r)
    tiles += [a, ic]
    W = sum(t.width for t in tiles) + 16 * (len(tiles) + 1)
    H = a.height + 32
    canvas = Image.new("RGBA", (W, H), bg + (255,))
    x = 16
    for t in tiles:
        canvas.alpha_composite(t, (x, 16))
        x += t.width + 16
    canvas.convert("RGB").save(path)


# ------------------------------------------------------------------- main ---

def parse_size(s):
    w, h = s.lower().split("x")
    return int(w), int(h)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("--art-out", required=True)
    ap.add_argument("--icon-out", required=True)
    ap.add_argument("--src-out", help="~512px webp copy of the generator output")
    ap.add_argument("--art", default="64x72", help="art grid WxH")
    ap.add_argument("--icon", type=int, default=24, help="icon side")
    ap.add_argument("--pad", type=int, default=2, help="transparent rows above the crown (outline included)")
    ap.add_argument("--key", default="auto", help="background colour #rrggbb or auto (border median)")
    ap.add_argument("--tol", type=float, default=0.12, help="OKLab distance for the background flood fill")
    ap.add_argument("--fringe", type=float, default=0.25, help="OKLab distance for the anti-alias ring")
    ap.add_argument("--sample", choices=["mode", "mean", "hybrid", "lanczos"], default="hybrid",
                    help="mode: most common palette colour per cell; mean: OKLab mean; hybrid: mode on detail, mean on flat cells")
    ap.add_argument("--dither", action="store_true", help="restrained Bayer dither between two ramp colours on flat areas (mean/hybrid)")
    ap.add_argument("--skin-keys", default="chHpBnbd", help="palette keys allowed for skin/brown-hair pixels ('' disables)")
    ap.add_argument("--skin-lift", type=float, default=0.03, help="OKLab L added to skin pixels before matching (+ favours cream over tan)")
    ap.add_argument("--l-weight", type=float, default=1.0, help="lightness weight when matching skin pixels (<1 favours hue)")
    ap.add_argument("--dark-bias", type=float, default=2.5, help="vote weight of pixels darker than their cell (keeps eyes/brows/lines)")
    ap.add_argument("--stray", type=float, default=0.12, help="OKLab contrast below which singletons are merged")
    ap.add_argument("--exclude", default="", help="palette keys never used, e.g. 'uU' to keep keyed blue out")
    ap.add_argument("--fit", choices=["frame", "bust"], default="frame",
                    help="frame: the generator followed the draft grid, map the whole frame; bust: find crown/head and refit")
    ap.add_argument("--head-frac", type=float, default=0.6, help="head width / art width used by draft.py; sets the default icon box")
    ap.add_argument("--draft-pad", type=int, default=3, help="crown row used by draft.py; sets the default icon box")
    ap.add_argument("--zoom", type=float,
                    help="crop tighter than the full frame (>1 enlarges the bust; frame fit crops about the top centre); default from --tier")
    ap.add_argument("--tier", choices=list(TIER_ZOOM) + ["common", "uncommon"],
                    help="card tier; rare and up get a 1.1 frame zoom (see TIER_ZOOM)")
    ap.add_argument("--crown-y", type=int, help="override the crown row in source px (e.g. to ignore a tall halo)")
    ap.add_argument("--center-x", type=float, help="override head centre x in source px")
    ap.add_argument("--icon-box", help="override face crop x,y,side in art px")
    ap.add_argument("--face", choices=["rim", "flat", "off"], default="off",
                    help="face re-shading of the peach midtone (see face_skin): rim keeps a tan contour, flat none, off = plain matching")
    ap.add_argument("--face-tones", default="cB",
                    help="lit and shadow skin keys of the subject (style-likeness.json faceTones): cB fair, Bb dark")
    ap.add_argument("--preview", help="write an 8x nearest-neighbour preview PNG here")
    ap.add_argument("--ref", help="reference photo shown in the preview")
    ap.add_argument("--preview-bg", default="#2b2461")
    args = ap.parse_args()

    keys, pal_rgb = load_palette()
    if args.skin_keys:
        SKIN["keys"] = np.array([k in args.skin_keys for k in keys])
        SKIN["l_weight"] = args.l_weight
        SKIN["lift"] = args.skin_lift
        SKIN["pink"] = keys.index("p") if "p" in args.skin_keys else -1
    pal_lab = srgb_to_oklab(pal_rgb)
    allowed = np.array([k not in args.exclude for k in keys])
    kidx = keys.index("k")
    pairs = load_ramp_pairs(keys)
    gw, gh = parse_size(args.art)

    src = Image.open(args.input).convert("RGB")
    rgb = np.asarray(src)
    opaque = key_background(rgb, args.key, args.tol, args.fringe)
    grid = detect_grid(rgb, rgb.shape[1] / gw)
    if args.fit == "frame":
        # the draft fixed the composition: the whole frame is the art grid
        # --zoom > 1 crops the frame about its top centre: the generator
        # draws the head smaller than the draft, zoom brings it back
        zoom = args.zoom if args.zoom is not None else TIER_ZOOM.get(args.tier, 1.0)
        print(f"zoom {zoom:.2f}")
        args.zoom = zoom
        cell = min(rgb.shape[1] / gw, rgb.shape[0] / gh) / zoom
        x0, y0 = (rgb.shape[1] - gw * cell) / 2, 0.0
        args.head_frac *= args.zoom  # draft geometry in zoomed art px
        args.draft_pad = int(round(args.draft_pad * args.zoom))
    else:
        x0, y0, cell = fit_box(opaque, gw, gh, args.pad, grid, args.center_x, args.zoom or 1.0, args.crown_y)
    print(f"grid period={grid[0]:.2f} score={grid[3]:.2f}  crop x0={x0:.1f} y0={y0:.1f} cell={cell:.2f}")

    art = sample_cells(rgb, opaque, x0, y0, cell, gw, gh, pal_lab, allowed, args.sample, args.dither, pairs, args.dark_bias)
    hw = args.head_frac * gw
    seed = (int(args.draft_pad + 0.55 * hw), gw // 2)  # face centre in art px (draft geometry)
    if args.face != "off":
        med, frac = cell_stats(rgb, opaque, x0, y0, cell, gw, gh)
        zone = (int(gw / 2 - hw / 2), args.draft_pad, int(round(gw / 2 + hw / 2)), int(args.draft_pad + 1.7 * hw))
        art = face_skin(art, med, frac, keys, pal_lab, args.face_tones, zone, seed, args.face)
    art[0:max(args.pad - 1, 0)] = -1  # keep the head-room clear for the outline
    art = remove_strays(art, pal_lab, args.stray)
    art = outline(art, kidx)
    art_img = to_image(art, pal_rgb)
    assert_contract(art_img, pal_rgb, (gw, gh))

    # icon: resample the same face region of the source at icon resolution
    if args.icon_box:
        bx, by, bs = (int(v) for v in args.icon_box.split(","))
    else:
        # draft.py puts the head (incl. hair) at head_frac of the width with the
        # crown `draft_pad` rows down; the face square skips the top of the hair
        bs = int(round(args.head_frac * gw))
        bx, by = int(round(gw / 2 - bs / 2)), args.draft_pad + int(round(0.08 * bs))
    n = args.icon
    icell = bs * cell / (n - 2)  # leave 1px for the outline on each side
    ix0 = x0 + bx * cell - icell
    iy0 = y0 + by * cell - icell
    ic = sample_cells(rgb, opaque, ix0, iy0, icell, n, n, pal_lab, allowed, args.sample, False, pairs, args.dark_bias)
    if args.face != "off":
        med, frac = cell_stats(rgb, opaque, ix0, iy0, icell, n, n)
        f = (n - 2) / bs  # art px -> icon px
        iseed = (int(round((seed[0] - by) * f + 1)), int(round((seed[1] - bx) * f + 1)))
        ic = face_skin(ic, med, frac, keys, pal_lab, args.face_tones, (0, 0, n, n), iseed, args.face)
    ic = remove_strays(ic, pal_lab, args.stray)
    ic = outline(ic, kidx)
    icon_img = to_image(ic, pal_rgb)
    assert_contract(icon_img, pal_rgb, (n, n))

    for p in (args.art_out, args.icon_out):
        Path(p).parent.mkdir(parents=True, exist_ok=True)
    art_img.save(args.art_out, optimize=True)
    icon_img.save(args.icon_out, optimize=True)
    if args.src_out:
        Path(args.src_out).parent.mkdir(parents=True, exist_ok=True)
        s = 512 / max(src.size)
        src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS).save(args.src_out, quality=90)
    if args.preview:
        bg = tuple(int(args.preview_bg.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
        preview(args.preview, art_img, icon_img, args.ref, 8, bg)
    print(f"ok art {gw}x{gh} -> {args.art_out}; icon {n} -> {args.icon_out} (face box {bx},{by},{bs})")


if __name__ == "__main__":
    main()
