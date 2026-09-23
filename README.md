# Loot Pixel: the vault

A pixel-art loot-card opener. Hold the card on the altar to crack its chains; the
rarity (Common → Rare → Epic → Legendary) escalates light, sound, particles and a
wall breakdown. Collect all nine cards to fill the bag.

Next.js (App Router) port of a single-file canvas toy. Every in-canvas pixel comes
from a fixed 26-colour palette with Bayer-dithered lighting; audio is synthesized
chip voices via Web Audio.

## Layout

| Path | Role |
|---|---|
| `src/components/Vault.tsx` | Client component: DOM shell + HUD (rarity picker, sound, empty bag) |
| `src/lib/vault/engine.ts` | Scene, lighting, card, particles, flow, render loop — `createVault()` returns a controller with `destroy()` |
| `src/lib/vault/{palette,font,sprites,cards,audio,bag,util}.ts` | Palette + ramps, 3x5 bitmap font, EPX sprites, rarity/pool data, chip audio, localStorage bag |

The engine is imported dynamically inside `useEffect`, so it never runs during SSR.
`window.APP` exposes debug handles (`force(r)`, `beginHold()`, `step(dt)`, `paused`, `forceCard`, `forceFake`).

## Develop

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build
```

Deployed on Vercel (Git integration, `framework: nextjs` pinned in `vercel.json`).
