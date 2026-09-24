# Themes: how the vault's look plugs into the engine

A **theme** is the look and sound around the cards. That covers the lit room, the void behind
the wall, the lamps, the card back, the card face chrome, the colours of engine-drawn bits, the
HUD strings, the ambient audio and the DOM styling. Themes are independent of **decks**, which are
what is on the cards (`docs/decks.md`), so every deck plays in every theme.

| Theme | Look |
|---|---|
| `vault` (default) | The original single-file build: a torch-lit stone vault, a portal behind the wall, gold-trimmed cards. Pixel-identical to the pre-theme engine. |
| `cyber` | A compute hall: server-rack wall with blinking LEDs, a perspective neon grid floor, a two-fan graphics card for the altar (the fans spin up as you charge), a cyan tube on the left and a pink one on the right, a rainy night city with a striped sun behind the wall, circuit-board card backs with gold edge fingers, chamfered HUD frames, portraits rim-lit cyan/pink, segmented power bars, rank LEDs, a VT323 terminal font in the DOM. |

## Theme card packs

A deck can have a separate **card pack** for a theme: same slots, its own cards, art and bag, so
each theme has its own collection. `cl-team` has one for `cyber`: `cl-team-cyber`, the same ten
people drawn as cyberpunk characters of the compute world. Its art is in `art/cl-team-cyber/`
(`style.md`, `characters.json` with `"base": "cl-team"`, `slots/`) and `public/decks/cl-team-cyber/`.
Packs are registered per deck in `DECKS[...].themes` (`src/lib/vault/decks/index.ts`).
`resolveDeck(id, sources, theme)` returns the pack when there is one, otherwise the deck itself.
`classic` has no packs, so its cards and bag are the same in every theme.

## Selecting a theme

- The switch in the top-right corner (`#top` in `src/components/Vault.tsx`) lists `THEMES`.
- `?theme=<id>` wins. Otherwise the viewer's last choice is used (localStorage `loot-pixel-theme`),
  otherwise `DEFAULT_THEME`. All three live in `src/lib/vault/themes/index.ts`.
- An inline script in `src/app/layout.tsx` sets `data-vault-theme` on `<html>` before first
  paint, so DOM styles don't flash the default theme.
- Switching destroys the engine and creates a new one in the new theme, with the theme's card pack
  if the deck has one. Bags are stored per deck and pack, so nothing is lost. The rarity pick and
  the sound setting carry over. A card mid-reveal restarts as a fresh draw.

## The contract (`src/lib/vault/themes/types.ts`)

| Field | What it owns | `vault` implementation |
|---|---|---|
| `ramps` | RAMPS keys for lit structures and for each lamp's light. The lighting pass colours a surface with the ramp of the lamp that lights it most. | `stone`, `warm`/`warm` |
| `lampLevel(V, i)` | Lamp brightness before charge/reveal boosts | torch flicker |
| `buildScene(V)` | Wall units (detachable), floor units, per-pixel altar and lamp fixtures, built with `sceneBuilder()` from `scene.ts` | `buildVaultScene` |
| `paintVoid(V, r)` | The void for tier `r` into `U.VOID32`, twinkle points in `U.VOIDSTARS` | `paintVaultVoid` (wall.ts) |
| `emissive?(V)` | Glowing pixels written into the lit scene every frame. They reflect on the floor and are cut into falling wall pieces. | none |
| `drawLamps`, `drawWorld?` | Lamp glow behind the card, and any extra layer behind it | `drawTorches` (world.ts) |
| `flames` | Lamps shed flame particles | `true` |
| `keys` | Palette keys for coins, summon ring, cold chain links, card edge, hitstop frames | the original colours |
| `lock` | Padlock sprite rows | `PADLOCK` (sprites.ts) |
| `buildBack(V)` | Static card back into `B.backG`, then `V.K.backBase`. Chains, cracks and the shine band are shared. | `buildVaultBack` (card-back.ts) |
| `face.artBg / frame / chrome` | Art backdrop, frame under the art, everything after the art. The art, its sparkles, the face cracks and the upgrade glitch are shared. | `vaultArtBg` / `vaultFrame` / `vaultChrome` (card-front.ts) |
| `face.portrait? / overArt?` | A restyled (cached) copy of the card art, and an overlay on the art window | none |
| `hud` | Idle hint, auto-charge hint, optional colour ghosts on the tier title | `HOLD TO OPEN` |
| `audio` | Ambient bed (`drone`/`hum`) and lamp ticks (`fire`/`data`). Every other sound is shared. | `drone`, `fire` |

Rules:

- **Stay in the palette.** Every canvas pixel is a `PAL` colour. Themes may use the neon keys
  `e E q Q` and the ramps `steel cyan pink`. These are added in `palette.ts` outside the art literal,
  so card art and the quantiser never see them. A new theme colour goes in the same way.
- **Wall units must be detachable.** Pass each wall unit's top-left and size to `add()`
  (up to 30x30: falling pieces rotate in a 32px buffer).
- **Don't call `Math.random` in theme code** except where `vault` inherits it. The characterise
  runs seed it, and any extra draw shifts every later frame. `cyber` uses `hash()`.
- A theme's per-vault state (for example `cyber`'s LED and fan tables) lives in a module-level
  `WeakMap<Vault, …>` built in `buildScene`. It is not stored on `Vault`.

## Adding a theme

1. `src/lib/vault/themes/<id>/index.ts` exporting a `Theme`. Spread `vault` and replace only what
   differs, for example `{ ...vault, id, label, ramps, keys }` for a recolour.
2. Register it in `THEMES` in `themes/index.ts`. The switch and `?theme=` pick it up.
3. DOM styles: `src/app/themes/<id>.css` scoped to `:root[data-vault-theme="<id>"]`, overriding
   the CSS variables in `globals.css`. Import it in `src/app/layout.tsx`.

## Verifying

```bash
pnpm build && pnpm start -p 3100 &
node scripts/verify/characterise.mjs --url http://localhost:3100 --deck cl-team --theme <id> --viewports wide,phone --out scratch/data/characterise/<id>
node scripts/verify/characterise.mjs --url http://localhost:3100 --deck classic \
  --out scratch/data/characterise/now --baseline scratch/data/characterise/baseline   # vault stays pixel-identical
```

Judge a theme on the `*.page.png` screenshots. Run it once with `--audio` to exercise the ambient bed
and lamp ticks. Engine changes for a theme must keep the `vault` baseline identical.
