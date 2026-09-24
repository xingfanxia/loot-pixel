# Loot Pixel: the vault

A pixel-art loot-card opener. Hold the card on the altar to crack its chains; the
rarity (Common → Uncommon → Rare → Epic → Legendary) escalates light, sound, particles
and a wall breakdown. Collect one card of every slot to fill the bag.

**Draw x10** turns the card on the altar into a sealed pack of ten. Its charge teases up to the best
card's tier, then the cards are dealt lowest tier first, each flying to the bag on its own, and the
best card comes last with the full reveal. "Skip to best" files the rest straight into the bag. A
results screen shows all ten faces. Every pack has at least one Rare or better unless a rarity is
forced. The rules are at the top of `src/lib/vault/pack.ts`.

Next.js (App Router) port of a single-file canvas toy. Every in-canvas pixel comes
from a fixed palette with Bayer-dithered lighting; audio is synthesized chip voices via Web Audio.

Card content comes from **decks** (`?deck=<id>`, default `cl-team`: the Compute Labs team,
10 people x 15 cards (5/4/3/2/1 from Common to Legendary) = 150 cards; `?deck=classic` is the
original nine items). The deck contract, how to add a deck and how to verify one are in
[`docs/decks.md`](docs/decks.md); the cl-team art pipeline is [`art/cl-team/style.md`](art/cl-team/style.md).

The look around the cards comes from **themes** (`?theme=<id>` or the switch in the top-right corner:
`vault`, the original torch-lit dungeon, and `cyber`, a neon server hall with a GPU altar). Any deck
plays in any theme; the contract and how to add one are in [`docs/themes.md`](docs/themes.md).

## Layout

| Path | Role |
|---|---|
| `src/components/Vault.tsx` | Client component: DOM shell + HUD (theme switch, sound, x1/x10 draw mode, rarity picker per deck, empty bag) |
| `src/components/PackResults.tsx` | 10-pull results dialog: the ten card faces the engine rendered, best first, NEW / copy counts |
| `src/components/Collection.tsx` | Collection dialog opened from the bag row: every card by slot and tier, found ones in full, missing ones as silhouettes |
| `src/app/page.tsx` | Reads deck sources at build time (`decks/sources.server.ts`) and renders the vault |
| `src/lib/vault/engine.ts` | `createVault(els, deck, theme, hooks)`: builds the `Vault` context, preloads art, boots; returns a controller with `destroy()` |
| `src/lib/vault/context.ts` | Typed state shared by every module: `Layout`, `GameState`, `Buffers`, `CardState`, `Env`, `Vault` |
| `src/lib/vault/tiers.ts` | The five-tier table every effect reads its strength from |
| `src/lib/vault/geometry.ts` | Card geometry derived from a deck layout (`cardGeo`, `fitLayout`) |
| `src/lib/vault/decks/` | Deck types, `classic`, `cl-team`, the Compute Labs mark, registry, server loader |
| `src/lib/vault/themes/` | Theme contract, registry, `vault` (the original look, implemented in the engine modules below) and `cyber/` (scene, void, card) |
| `src/app/themes/<id>.css` | A theme's DOM styles, keyed on `data-vault-theme` on `<html>` |
| `src/lib/vault/{layout,scene,lighting}.ts` | Viewport layout, lit brick/flagstone units, lighting pass |
| `src/lib/vault/{card-back,chains,cracks,card-front,card3d}.ts` | Card back + emblem, chains/padlock, cracks, card face, pseudo-3D projector |
| `src/lib/vault/{flow,sim,wall,particles}.ts` | Draw state machine, per-frame simulation, wall breakdown, particles |
| `src/lib/vault/pack.ts` | The 10-pull: roll with a Rare floor, sealed-pack burst, dealing, skip, results faces |
| `src/lib/vault/{render,world,hud,postfx}.ts` | Frame composition, background layer, in-canvas HUD, reflection/impact/post effects |
| `src/lib/vault/{input,loop,art,bag}.ts` | Input bindings, rAF loop, deck art preload + placeholders, per-deck bag |
| `src/lib/vault/{palette,font,sprites,audio,util}.ts` | Palette + ramps, 3x5 bitmap font, EPX sprites, chip audio, helpers |
| `art/cl-team/` | Art track: `characters.json` (people, tiers), `slots/<slot>.json` (card lists), `style.md` (locked style + pipeline), `source/` (generator copies) |
| `public/decks/cl-team/` | Quantized card art (64x72) and bag icons (24x24) |
| `art/cl-team-cyber/`, `public/decks/cl-team-cyber/` | The cyber theme's card pack of the same people (people from `art/cl-team/`, art may use the neon colours) |
| `scripts/art/` | `draft.py`, `prompt.py`, `quantize.py` (card pipeline), `contact-sheet.py` (review strips) |
| `scripts/verify/` | `check-deck-art.mjs` (art contract), `characterise.mjs` + `scenarios.mjs` (headless engine runs), `cl-mark-mask.mjs` |

The engine is imported dynamically inside `useEffect`, so it never runs during SSR.
`window.APP` exposes debug handles (`force(tierId)`, `beginHold()`, `endHold()`, `leave()`,
`pack(on)`, `closePack(again)`, `step(dt)`, `paused`, `forceCard` (card id), `forceFake`, `S`, `FX`, `L`, `geo`, `deck`, `theme`).

## Develop

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build
```

## Verify

```bash
node scripts/verify/check-deck-art.mjs                   # 150 cards: art + icon, sizes, PAL-only, alpha 0/255
scripts/art/contact-sheet.py --out scratch/media/review  # per-person strips at 8x + contact sheet of all cards
```

`scripts/verify/characterise.mjs` drives the real page in headless Chrome (DevTools
protocol, no npm deps) with a seeded `Math.random`, virtual timers and the loop paused,
steps the engine frame by frame through every tier, a fake upgrade, a full set, an
empty bag and a 10-pull (with and without skip), and records the logical canvas + layout metrics at fixed frames (default viewports
1280x800 and 390x844; `wide` is 1280x900).

```bash
pnpm build && pnpm start -p 3100 &
node scripts/verify/characterise.mjs --url http://localhost:3100 --deck classic \
  --out scratch/data/characterise/now --baseline scratch/data/characterise/baseline
node scripts/verify/characterise.mjs --url http://localhost:3100 --deck cl-team --viewports wide,phone \
  --out scratch/data/characterise/cl-team
```

`--theme <id>` runs a theme other than the default. With `--baseline` every canvas hash and metric must match (diff PNGs are written for
mismatches). The classic deck is pixel-identical to the pre-split engine. `--audio` keeps
Web Audio on to catch runtime errors (not deterministic, so no pixel compare).

Deployed on Vercel (Git integration, `framework: nextjs` pinned in `vercel.json`).
