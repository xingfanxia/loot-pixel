# Decks — how card content plugs into the vault engine

The engine (`src/lib/vault/`) knows nothing about *what* is on a card. A **deck**
supplies the collectibles, their art, the card-back emblem and the bag layout.
Adding a new set of characters = a new deck module + its art; no engine edits.

## Data model

- A deck has **slots** — one per collectible identity (a person, an item). The bag
  shows one square per slot.
- Each slot has **1–4 cards**, one per rarity it exists at (`0` COMMON … `3`
  LEGENDARY). A draw picks a rarity by odds, then a random card of that rarity.
- The bag records ownership per **card id**. A slot counts as collected once any
  of its cards is owned; the slot shows the icon of its best owned rarity. "FULL
  SET!" fires when every slot is collected. The HUD counter shows owned cards /
  total cards.
- Bag storage is per deck (`loot-pixel-bag-<deck>-v1`; the classic deck keeps the
  original key `loot-pixel-bag-v2`).

## Card art kinds

| Kind | Used by | Source |
|---|---|---|
| `sprite` | `classic` deck | 16x16 char-grid sprites in code, EPX-upscaled at runtime |
| `image` | `cl-team` deck | pre-quantized PNGs in `public/decks/<deck>/` |

## Image art contract (`image` kind)

Every opaque pixel must be **exactly one of the 26 `PAL` colours**
(`src/lib/vault/palette.ts`); alpha is 0 or 255 only. Transparent pixels let the
engine's rarity background show through.

| File | Size | Content |
|---|---|---|
| `public/decks/<deck>/<slot>-<rarity>.png` | the deck's `layout.art` size | head-and-shoulders bust, horizontally centred, crown a few px below the top, shoulders run off the bottom edge; 1px `k` (#07060f) outline on the silhouette |
| `public/decks/<deck>/<slot>-<rarity>-icon.png` | the deck's `layout.icon` size (default 16x16; bag slots grow to fit) | face crop for the bag slot, same palette rules |
| `art/<deck>/source/<slot>-<rarity>.webp` | ~512px | generator output kept for re-quantising |

`<rarity>` is `common | rare | epic | legendary`.

## Card layouts

A deck declares its card geometry (`layout`): card size, art window, and how many
stat bars sit under the nameplate. Everything card-relative in the engine (frame,
chains, padlock, cracks, glow, shatter, stamp, lift-off, scene sizing) derives
from it, so a deck can use a bigger card when its art needs more pixels.

| Layout | Card | Art window | Below the art |
|---|---|---|---|
| `item` (classic) | 64x90 | 52x45 at (6,6), 32x32 sprite centred | nameplate + ATK/DEF/MAG bars |
| `portrait` (cl-team) | sized to the art (see `art/cl-team/style.md`) | image fills the window | nameplate (short name) + one PWR bar |

The variant title (e.g. `SUN EMPEROR`) is drawn under the altar after a reveal;
the live region announces `RARITY: Full Name, Variant title`.

## Card back

A deck may provide a back emblem (a 1-bit mask rendered with the gold ramp and
bevel). `cl-team` uses the Compute Labs mark (ring + nested diamonds). Chains and
padlock are engine-drawn for every deck.

## Pipeline for an `image` deck

1. Describe slots and variants in `art/<deck>/characters.json`.
2. Generate each variant with GPT Image 2.5 (`gpt-image` skill), reference photo
   via `--edit`, using the locked style paragraph in `art/<deck>/style.md`.
3. Quantise with `scripts/art/quantize.py` → `public/decks/<deck>/`.
4. Declare the deck in `src/lib/vault/decks/` and register it.

Select a deck with `?deck=<id>`; the default is `cl-team`.
