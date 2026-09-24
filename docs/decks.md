# Decks — how card content plugs into the vault engine

The engine (`src/lib/vault/`) knows nothing about *what* is on a card. A **deck**
supplies the collectibles, their art, the card-back emblem and the bag layout.
Adding a new set of characters = a new deck module + its art; no engine edits.
How the room, card back and card frame look is the **theme**'s job (`docs/themes.md`); a deck
plays in every theme.

## Data model

- Rarity tiers are the standard ladder `0` COMMON (silver) · `1` UNCOMMON (green) ·
  `2` RARE (teal) · `3` EPIC (violet) · `4` LEGENDARY (gold). Every reveal effect
  escalates with tier and never appears below its tier. The one exception is inherited from
  the original build: LEGENDARY's resting god-ray strength (.46) sits just below EPIC's (.5),
  kept so `classic` stays pixel-identical.
- A deck declares which tiers it uses and their draw odds. `classic` uses
  COMMON/RARE/EPIC/LEGENDARY with the original odds (.50/.28/.15/.07), so it plays
  exactly like the single-file build; `cl-team` uses all five (.42/.28/.17/.09/.04).
- Effect strengths live in one tier table, `src/lib/vault/tiers.ts` (colours, sparks,
  rays, spins, bolts, rings, confetti, coins, slow-mo, beam, aftershock, wall reach,
  letterbox, jingle/bass/twinkle, tease note, fake chance). Things counted along the
  deck's own ladder (gems, pips, tease steps) use the tier's position in that deck, so
  a RARE shows 2 gems in `classic` and 3 in `cl-team`.
- A fake draw first reveals the deck's tier below, then glitches and upgrades. Image
  decks show a card of the lower tier from the same slot during the fake, so the real
  art is not spoiled.
- A deck has **slots**, one per collectible identity (a person, an item). The bag
  shows one square per slot.
- Each slot has any number of **cards per tier**. A draw picks a tier by odds, then
  a random card of that tier. A 10-pull (`src/lib/vault/pack.ts`) rolls ten draws the same
  way; when none is RARE or better (and no rarity is forced), the last is re-rolled among the
  deck's RARE-and-up tiers by their odds. Only the pack's best card can be a fake. `cl-team` gives every person 5/4/3/2/1 cards from
  COMMON to LEGENDARY (15 per person, 150 total).
- The bag records ownership per **card id** (`<slot>-<tier>-<n>`). A slot counts
  as collected once any of its cards is owned; the slot shows the icon of its best
  owned card with that tier's colours. "FULL SET!" fires when every slot is
  collected. The HUD counter shows owned cards / total cards.
- Bag storage is per deck (`loot-pixel-bag-<deck>-v1`; the classic deck keeps the
  original key `loot-pixel-bag-v2`).

## Card art kinds

| Kind | Used by | Source |
|---|---|---|
| `sprite` | `classic` deck | 16x16 char-grid sprites in code, EPX-upscaled at runtime |
| `image` | `cl-team` deck | pre-quantized PNGs in `public/decks/<deck>/` |

## Image art contract (`image` kind)

Every opaque pixel must be **exactly one of the 35 `PAL` colours**
(`src/lib/vault/palette.ts`); alpha is 0 or 255 only. Transparent pixels let the
engine's rarity background show through.

| File | Size | Content |
|---|---|---|
| `public/decks/<deck>/<slot>-<tier>-<n>.png` | the deck's `layout.art` size | head-and-shoulders bust, horizontally centred, crown a few px below the top, shoulders run off the bottom edge; 1px `k` (#07060f) outline on the silhouette |
| `public/decks/<deck>/<slot>-<tier>-<n>-icon.png` | the deck's `layout.icon` size (default 16x16; bag slots grow to fit) | face crop for the bag slot, same palette rules |
| `art/<deck>/source/<slot>-<tier>-<n>.webp` | ~512px | generator output kept for re-quantising |

`<tier>` is `common | uncommon | rare | epic | legendary`; `<n>` counts from 1 within the tier.

## Card layouts

A deck declares its card geometry (`layout`): card size, art window, and how many
stat bars sit under the nameplate. Everything card-relative in the engine (frame,
chains, padlock, cracks, glow, shatter, stamp, lift-off, scene sizing) derives
from it, so a deck can use a bigger card when its art needs more pixels.

| Layout | Card | Above the art | Art window | Below the art |
|---|---|---|---|---|
| `item` (classic) | 64x90 | nothing | 52x45 at (6,6), 32x32 sprite centred | nameplate + ATK/DEF/MAG bars |
| `portrait` (cl-team) | 76x122 | 2-line title bar (`titleRows: 2`) | 64x72 at (6,23), image fills the window | nameplate (short name) + one PWR bar |

`fitLayout()` in `src/lib/vault/geometry.ts` sizes a card to its art window plus nameplate,
bars and gems; `cardGeo()` derives every card-relative constant from the layout. The
cl-team numbers are in `CL_TEAM_SIZE` (`src/lib/vault/decks/cl-team.ts`), matching
`art/cl-team/style.md` (64x72 art, 24px icon): change them there and nothing else.
Bag slots are the icon size on wide screens and shrink to fit one row on phones; a layout's
`minIcon` (default half the icon) is the smallest an icon may be drawn, and below it the bag
wraps onto two icon-sized rows instead (cl-team sets it to 24, so its ten icons stay 24px).

A layout with `titleRows` (passed to `fitLayout`) gets a title bar above the art that shows the
visible card's variant title (e.g. `SUN EMPEROR`), word-wrapped into at most that many lines of
16 characters (every cl-team title fits two). Without one, the variant title is drawn under the
altar after a reveal. The live region announces `RARITY: Full Name, Variant title`.

When a deck has more cards than slots, each bag slot gets a collected/total bar under it.
The bag row is also a button (`#bag`, positioned by the engine) that opens the collection
(`src/components/Collection.tsx`): every card grouped by slot and tier, found cards in full with
their `note` (the slot file's `hook`) and copy count, missing ones as the art's silhouette. Slot
`role` comes from `characters.json`.

## Card back

A deck may provide a back emblem (a 1-bit mask the theme renders with a bevel: gold in
`vault`, cyan in `cyber`). `cl-team` uses the Compute Labs mark (ring + nested diamonds), generated by
`scripts/verify/cl-mark-mask.mjs` into `src/lib/vault/decks/cl-mark.ts`. Chains and
padlock are engine-drawn for every deck.

## Pipeline for an `image` deck

1. Describe slots (bio, vibe, ref photo, tier counts) in `art/<deck>/characters.json`, and each
   slot's final card list in `art/<deck>/slots/<slot>.json`
   (`{ id, cards: [{ tier, n, title, concept, hook }] }`). Only `tier`, `n` and `title` reach the
   engine; `concept` and `hook` feed the prompt.
2. Generate each variant with GPT Image 2.5 (`gpt-image` skill), reference photo
   via `--edit`, using the locked style paragraph in `art/<deck>/style.md`
   (cl-team: the full per-card commands are in `art/cl-team/style.md`).
3. Quantise with `scripts/art/quantize.py` → `public/decks/<deck>/` (it asserts the palette and alpha).
4. Declare the deck in `src/lib/vault/decks/` and register it (see below).
   For `cl-team`, `decks/sources.server.ts` reads `characters.json` and `slots/*.json` at
   build time; a missing or malformed slot file falls back to placeholder titles from the
   tier counts, and a missing PNG draws a palette-only silhouette with initials. Both are
   dev fallbacks only: a shipped deck has every file (the check below fails otherwise).
5. Verify (next section), then rebuild: the page is static, so slot-file and art changes
   need `pnpm build` (or a `pnpm dev` reload) before they show.

## Adding a deck

The files to touch, in order. Nothing under `src/lib/vault/` outside `decks/` changes.

1. `src/lib/vault/decks/<id>.ts` exporting the `Deck` (types in `decks/types.ts`):
   - `tiers`: the rarity tiers it uses (ids from `tiers.ts`) with odds summing to 1;
   - `slots` and `cards` (card ids unique; image decks use `<slot>-<tier>-<n>`);
   - `layout`: `fitLayout(name, { w, h } of the art, icon size, bar labels)` from `geometry.ts`,
     plus `minIcon` if the icon must not shrink on phones;
   - `bagKey`: a new `loot-pixel-bag-<id>-v1` (never reuse another deck's);
   - optional `emblem` for the card back (a 1-bit `#` mask; `cl-mark.ts` shows the format).
   A sprite deck is a static object like `classic.ts`. An image deck that reads the art track
   at build time follows `cl-team.ts`: a `build<Id>(source)` function plus a
   `SIZE` constant that the PNGs must match.
2. Image deck only: a loader in `decks/sources.server.ts` (copy `loadClTeam`), and the
   source type added to `DeckSources` in `decks/index.ts`.
3. Register it in `DECKS` in `decks/index.ts` (`build` + `tiers`, plus `themes` for theme card packs, see
   `docs/themes.md`). `?deck=<id>` then selects it
   and the rarity picker shows its tiers; change `DEFAULT_DECK` only to make it the default.
4. Image deck: put the art in `public/decks/<id>/`, and add its scenario list to
   `scripts/verify/scenarios.mjs` (copy the `cl-team` entry; the fake scenario needs one of
   the deck's top-tier card ids).

## Verifying a deck

```bash
node scripts/verify/check-deck-art.mjs --deck cl-team      # every card: art + icon present, sizes, PAL only, alpha 0/255, source webp, no orphans
scripts/art/contact-sheet.py --out scratch/media/review    # per-slot strips (ref photo + 15 cards, 8x) and a contact sheet of the deck
pnpm build && pnpm start -p 3100 &
node scripts/verify/characterise.mjs --url http://localhost:3100 --deck cl-team --viewports wide,phone --out scratch/media/review/cl-team
node scripts/verify/characterise.mjs --url http://localhost:3100 --deck classic \
  --out scratch/data/characterise/now --baseline scratch/data/characterise/baseline   # classic stays pixel-identical
```

`check-deck-art.mjs` reads the art and icon sizes from `CL_TEAM_SIZE` (pass `--art WxH --icon N`
for another deck) and the per-tier counts from `characters.json`. `characterise.mjs` drives every
tier's reveal, a fake upgrade, a full set and an empty bag; `*.page.png` files are full-page
screenshots (HUD, counter, variant title), the rest are the logical canvas. Viewports:
`desktop` 1280x800, `wide` 1280x900, `phone` 390x844, `small` 360x740, `tiny` 320x568.
Judge likeness on the strips, next to the photo; the art contract check says nothing about it.

Select a deck with `?deck=<id>`; the default is `cl-team`.
