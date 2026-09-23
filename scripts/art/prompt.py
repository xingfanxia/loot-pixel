#!/usr/bin/env python3
"""Print the GPT Image prompt for one cl-team card (stdlib only).

  scripts/art/prompt.py <slot> <tier> <n>

Joins the locked style paragraph from art/cl-team/style.md, the person's
likeness line from art/cl-team/source/style-likeness.json, the tier look from
art/cl-team/characters.json and the card from art/cl-team/slots/<slot>.json.
Image 1 of the call is the draft from draft.py, image 2 the reference photo.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DECK = ROOT / "art/cl-team"

ACCENTS = {
    "common": "Accent colours: silver-greys #c4ccd9 #8791a6 #4b5268 and plain browns #8a5a3c #4f2f22; no glow.",
    "uncommon": "Accent colours: greens #6fd46a #2b7a3d #b6f28a over practical browns and greys.",
    "rare": "Accent colours: teals #47d6c1 #1f8f8a #bff7f0, a faint teal glow on the signature item only.",
    "epic": "Accent colours: violet #b86bff, deep violet #6a2fbf, magenta #ff6bd6, dramatic violet magic behind and beside the figure.",
    "legendary": "Accent colours: gold #ffcf4a, amber #e0781f, pale gold #fff3b0 and white, a radiant golden rim aura around the silhouette.",
}


def style_paragraph() -> str:
    text = (DECK / "style.md").read_text()
    m = re.search(r"<!-- STYLE:BEGIN -->\s*(.*?)\s*<!-- STYLE:END -->", text, re.S)
    if not m:
        sys.exit("locked style paragraph markers not found in art/cl-team/style.md")
    return " ".join(m.group(1).split())


def build(slot: str, tier: str, n: int) -> str:
    chars = json.loads((DECK / "characters.json").read_text())
    person = next(s for s in chars["slots"] if s["id"] == slot)
    like = json.loads((DECK / "source/style-likeness.json").read_text())["slots"][slot]
    card = next(c for c in json.loads((DECK / f"slots/{slot}.json").read_text())["cards"]
                if c["tier"] == tier and c["n"] == n)
    look = chars["tiers"][tier]["look"]
    return (
        f"{style_paragraph()} "
        f"Subject: {person['short'].title()}, {like['likeness']}, exactly as in image 2. "
        f"Skin: {like['skin']}. "
        f"Tier {tier.upper()}: {look}. "
        f"Card: {card['title']}, {card['concept'].rstrip('.')}. "
        f"{ACCENTS[tier]}"
    )


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    print(build(sys.argv[1], sys.argv[2], int(sys.argv[3])))
