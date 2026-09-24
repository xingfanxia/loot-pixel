#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=10"]
# ///
"""Review sheets for an image deck, nearest-neighbour upscaled.

- `<out>/strip-<slot>.png`: the reference photo and that slot's 15 cards (row 1 common,
  row 2 uncommon, row 3 rare/epic/legendary) at --scale (default 8x), for checking that the
  ladder escalates and the person stays consistent.
- `<out>/contact-sheet.png`: every card of the deck, one row per slot, ref photo first,
  at --sheet-scale (default 3x).

Each card sits on its tier colour with its title underneath. Ref photos are looked up as
scratch/media/team/refs/<ref> from the `ref` field in characters.json (skipped if absent).

  scripts/art/contact-sheet.py --out scratch/media/verify-integrate [--deck cl-team] [--only kevin]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
TIERS = ["common", "uncommon", "rare", "epic", "legendary"]
TIER_BG = {"common": "#4b5268", "uncommon": "#2b7a3d", "rare": "#1f8f8a", "epic": "#6a2fbf", "legendary": "#e0781f"}
SHEET_BG, INK = "#0d0b1e", "#f4efe0"


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", size)
    except OSError:
        return ImageFont.load_default()


def card_tile(deck: str, slot: str, card: dict, s: int, f: ImageFont.ImageFont, label_h: int) -> Image.Image:
    cid = f"{slot}-{card['tier']}-{card['n']}"
    art = Image.open(ROOT / "public" / "decks" / deck / f"{cid}.png").convert("RGBA")
    big = art.resize((art.width * s, art.height * s), Image.NEAREST)
    tile = Image.new("RGBA", (big.width, big.height + label_h), SHEET_BG)
    tile.paste(Image.new("RGBA", big.size, TIER_BG[card["tier"]]), (0, 0))
    tile.alpha_composite(big, (0, 0))
    if label_h:
        ImageDraw.Draw(tile).text((4, big.height + 3), f"{card['tier'][0].upper()}{card['n']} {card['title']}"[: big.width // max(1, f.size * 6 // 10)], fill=INK, font=f)
    return tile


def ref_tile(ref: str | None, w: int, h: int, label_h: int) -> Image.Image:
    tile = Image.new("RGBA", (w, h + label_h), SHEET_BG)
    path = ROOT / "scratch" / "media" / "team" / "refs" / (ref if ref.endswith(".png") else f"{ref}.png") if ref else None
    if path and path.exists():
        # cover-fit, biased to the top, so the face is about as large as on the cards
        tile.alpha_composite(ImageOps.fit(Image.open(path).convert("RGBA"), (w, h), Image.LANCZOS, centering=(0.5, 0.2)), (0, 0))
    return tile


def strip(deck: str, slot: dict, cards: list[dict], s: int, out: Path) -> Path:
    f, label_h, gap = font(max(10, 2 * s)), 3 * s + 6, 2 * s
    rows = [[c for c in cards if c["tier"] == "common"], [c for c in cards if c["tier"] == "uncommon"],
            [c for c in cards if c["tier"] in ("rare", "epic", "legendary")]]
    tiles = [[card_tile(deck, slot["id"], c, s, f, label_h) for c in r] for r in rows]
    tw, th = 64 * s, 72 * s + label_h
    cols = 1 + max(len(r) for r in tiles)
    sheet = Image.new("RGBA", (cols * (tw + gap) + gap, len(rows) * (th + gap) + gap), SHEET_BG)
    sheet.alpha_composite(ref_tile(slot.get("ref"), tw, 72 * s, label_h), (gap, gap))
    ImageDraw.Draw(sheet).text((gap + 4, gap + 72 * s + 3), slot["fullName"], fill=INK, font=f)
    for y, r in enumerate(tiles):
        for x, t in enumerate(r):
            sheet.alpha_composite(t, (gap + (x + 1) * (tw + gap), gap + y * (th + gap)))
    path = out / f"strip-{slot['id']}.png"
    sheet.save(path)
    return path


def contact(deck: str, slots: list[tuple[dict, list[dict]]], s: int, out: Path) -> Path:
    f, label_h, gap = font(max(9, 3 * s)), 4 * s + 4, s
    tw, th = 64 * s, 72 * s + label_h
    cols = 1 + max(len(c) for _, c in slots)
    sheet = Image.new("RGBA", (cols * (tw + gap) + gap, len(slots) * (th + gap) + gap), SHEET_BG)
    for y, (slot, cards) in enumerate(slots):
        oy = gap + y * (th + gap)
        sheet.alpha_composite(ref_tile(slot.get("ref"), tw, 72 * s, label_h), (gap, oy))
        ImageDraw.Draw(sheet).text((gap + 2, oy + 72 * s + 2), slot["short"], fill=INK, font=f)
        for x, c in enumerate(cards):
            sheet.alpha_composite(card_tile(deck, slot["id"], c, s, f, label_h), (gap + (x + 1) * (tw + gap), oy))
    path = out / "contact-sheet.png"
    sheet.save(path)
    return path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--deck", default="cl-team")
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--scale", type=int, default=8)
    ap.add_argument("--sheet-scale", type=int, default=3)
    ap.add_argument("--only", help="comma-separated slot ids (strips only)")
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    art = ROOT / "art" / a.deck
    chars = json.loads((art / "characters.json").read_text())
    if "base" in chars:  # a theme pack of the same team: people come from the base pack
        chars["slots"] = json.loads((ROOT / "art" / chars["base"] / "characters.json").read_text())["slots"]
    order = {t: i for i, t in enumerate(TIERS)}
    slots = []
    for s in chars["slots"]:
        cards = json.loads((art / "slots" / f"{s['id']}.json").read_text())["cards"]
        slots.append((s, sorted(cards, key=lambda c: (order[c["tier"]], c["n"]))))
    only = set(a.only.split(",")) if a.only else None
    for s, cards in slots:
        if not only or s["id"] in only:
            print(strip(a.deck, s, cards, a.scale, a.out))
    if not only:
        print(contact(a.deck, slots, a.sheet_scale, a.out))


if __name__ == "__main__":
    main()
