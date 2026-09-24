#!/usr/bin/env python3
"""Print the GPT Image prompt for one card of a team pack (stdlib only).

  scripts/art/prompt.py <slot> <tier> <n> [--pack cl-team-cyber]

Joins the pack's style paragraph (art/<pack>/style.md), the person's likeness
line (art/cl-team/source/style-likeness.json), the pack's tier look and accent
(art/<pack>/characters.json; cl-team's accents are ACCENTS below) and the card
(art/<pack>/slots/<slot>.json). A pack with "base" takes its people from that
pack's characters.json. Image 1 of the call is the draft from draft.py, image 2
the reference photo.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "art/cl-team"

ACCENTS = {
    "common": "Accent colours: silver-greys #c4ccd9 #8791a6 #4b5268 and plain browns #8a5a3c #4f2f22; no glow.",
    "uncommon": "Accent colours: greens #6fd46a #2b7a3d #b6f28a over practical browns and greys.",
    "rare": "Accent colours: teals #47d6c1 #1f8f8a #bff7f0, a faint teal glow on the signature item only.",
    "epic": "Accent colours: violet #b86bff, deep violet #6a2fbf, magenta #ff6bd6, dramatic violet magic behind and beside the figure.",
    "legendary": "Accent colours: gold #ffcf4a, amber #e0781f, pale gold #fff3b0 and white, a radiant golden rim aura around the silhouette.",
}


def style_paragraph(pack: Path) -> str:
    text = (pack / "style.md").read_text()
    m = re.search(r"<!-- STYLE:BEGIN -->\s*(.*?)\s*<!-- STYLE:END -->", text, re.S)
    if not m:
        sys.exit(f"style paragraph markers not found in {pack / 'style.md'}")
    return " ".join(m.group(1).split())


def build(slot: str, tier: str, n: int, pack_id: str = "cl-team") -> str:
    pack = ROOT / "art" / pack_id
    chars = json.loads((pack / "characters.json").read_text())
    people = json.loads((ROOT / "art" / chars["base"] / "characters.json").read_text())["slots"] if "base" in chars else chars["slots"]
    person = next(s for s in people if s["id"] == slot)
    like = json.loads((BASE / "source/style-likeness.json").read_text())["slots"][slot]
    card = next(c for c in json.loads((pack / f"slots/{slot}.json").read_text())["cards"]
                if c["tier"] == tier and c["n"] == n)
    look = chars["tiers"][tier]["look"]
    accent = chars["tiers"][tier].get("accent", ACCENTS[tier])
    return (
        f"{style_paragraph(pack)} "
        f"Subject: {person['short'].title()}, {like['likeness']}, exactly as in image 2. "
        f"Skin: {like['skin']}. "
        f"Tier {tier.upper()}: {look}. "
        f"Card: {card['title']}, {card['concept'].rstrip('.')}. "
        f"{accent}"
    )


if __name__ == "__main__":
    argv = sys.argv[1:]
    pack = "cl-team"
    if "--pack" in argv:
        i = argv.index("--pack")
        pack = argv[i + 1]
        del argv[i:i + 2]
    if len(argv) != 3:
        sys.exit(__doc__)
    print(build(argv[0], argv[1], int(argv[2]), pack))
