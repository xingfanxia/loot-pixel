# cl-team-cyber portrait style

The cyber theme's card pack: the ten cl-team people as cyberpunk characters of the compute
world. It is played in the `cyber` theme (`docs/themes.md`), with its own bag and collection.

Everything below is inherited from `art/cl-team/style.md` unless this file says otherwise:
sizes (64x72 art, 24px icon, 1024x1152 generation), the draft → generate → quantize
pipeline, the quantizer defaults, per-person likeness inputs (`art/cl-team/source/style-likeness.json`)
and the pitfalls. People, bios and reference photos come from `art/cl-team/characters.json`
(`"base": "cl-team"` in this pack's `characters.json`).

## Differences from cl-team

- **Palette:** art may also use the neon colours `e` #2ee6ff, `E` #12689e, `q` #ff3d8b and `Q` #8e1f63
  (`"palette": "art+neon"`). Pass `--neon` to `quantize.py`; `check-deck-art.mjs` reads the setting.
- **Tier looks and accents** are in this pack's `characters.json`. From COMMON to LEGENDARY they run
  street-level worker → operator → elite specialist → chrome-augmented legend → ascended form. The tier
  colours match cl-team (silver, green, teal, violet, gold), so the engine frames still fit.
- **Faces stay human and uncovered.** Visors, AR glasses and masks are pushed up onto the forehead or
  hang at the neck. A person who wears glasses keeps glasses of the same shape. Implants sit on the
  temple, jaw line or hands, never across the eyes. Neon light touches only the costume and the background.
- **Quantizer:** `--skin-lift 0.06` for fair skin (faceTones `cB`); dark skin (`Bb`) stays at 0.0.

## Pipeline (per card)

As in `art/cl-team/style.md`, with the pack passed through:

```bash
P=cl-team-cyber; S=kevin; T=epic; N=1; REF=kevin-schubert
W=scratch/media/cards-cyber/$S; mkdir -p $W
BOX=$(jq -r ".slots.$S.headBox" art/cl-team/source/style-likeness.json)
scripts/art/draft.py scratch/media/team/refs/$REF.png $W/draft.png --head $BOX --art 64x72 --block 16 --head-frac 0.6
~/.claude/skills/gpt-image/generate.py "$(scripts/art/prompt.py $S $T $N --pack $P)" \
  --edit $W/draft.png --edit scratch/media/team/refs/$REF.png \
  --variant sunburst --format png --size 1024x1152 --output $W --name $S-$T-$N
scripts/art/quantize.py $W/$S-$T-$N.png --neon \
  --art-out public/decks/$P/$S-$T-$N.png --icon-out public/decks/$P/$S-$T-$N-icon.png \
  --src-out art/$P/source/$S-$T-$N.webp \
  --art 64x72 --icon 24 --head-frac 0.6 --tier $T --skin-lift 0.06 \
  --preview $W/$S-$T-$N-prev.png --ref scratch/media/team/refs/$REF.png
# dark skin (faceTones Bb): --skin-lift 0.0 instead of 0.06
```

The one quantizer setting that differs from cl-team is `--skin-lift 0.06` for fair skin (cl-team
default 0.03); see the notes below.

## Style paragraph

`scripts/art/prompt.py --pack cl-team-cyber` reads the text between the markers.

<!-- STYLE:BEGIN -->
Chunky low-resolution retro 16-bit cyberpunk character portrait in strict pixel art.
Image 1 is the pixel canvas: a grid of exactly 64 columns by 72 rows of square
16x16-pixel blocks that fixes the framing. Image 2 is a photo of the real person
and defines the likeness. Repaint image 1 in full colour as the character
described below, keeping its framing, head size, head position and pose, and
keeping its exact block grid: the finished image is still exactly 64 blocks wide
and 72 blocks tall, every block one flat solid colour, aligned to the grid, no
block smaller than 16x16 pixels, no anti-aliasing, no blur, no gradients, no
dithering noise. Limited flat palette: near-black #07060f, white #ffffff, cream
#f4efe0, pink #ff9aa8, tan #c98f5a, brown #8a5a3c, dark brown #4f2f22, greys
#c4ccd9 #8791a6 #4b5268, navy darks #0d0b1e #1a1640 #2b2461, neon cyan #2ee6ff,
deep cyan #12689e, hot pink #ff3d8b, deep magenta #8e1f63, plus the tier accent
colours named below. Tight head-and-shoulders bust, head large and centred,
shoulders running off the bottom edge, strong readable silhouette with a clean
one-block near-black outline. The head is exactly as large as in image 1, the
head with hair at least half the image width, the same face scale on every
tier; costume, tech and props never shrink it. The face looks at the viewer,
turned at most slightly (a head tilt from the photo is fine), so both eyes
sit well inside the face: between the outer corner of each eye and the hair there is
a clear band of skin at least three blocks wide, and hair never falls across the eyes
or cheeks. The face is an
unmistakable, flattering likeness of the person in image 2: keep their exact face
shape and proportions, hairline and hairstyle, glasses or beard if they have them,
eyebrows, eye shape, nose, mouth, signature expression, skin tone and hair colour;
eyes, brows and mouth drawn with clear dark blocks so they read at small size; eyes
keep their natural colour with a white block on each side of the dark iris, and
glowing eyes are shown only as one tiny bright catch-light; heroic and cool, never a
caricature. The face stays human and uncovered: no visor, mask or goggles over the
eyes (push them up onto the forehead or down to the neck), implants only on the
temple, jaw line or hands. The face is the focal point: evenly lit from the front by
neutral warm light, no coloured light or neon glow on the skin, and skin uses only the
flat tones listed for the subject, painted like classic pixel art: one large flat lit
area with a few small shadow shapes (beside the nose, under the cheekbones and jaw, in
the eye sockets), never a half-shadowed face; neon and dramatic lighting touch only the
costume and the background; gold, chrome or neon costume never tints the skin
gold, orange or tan, and there are no peach or orange midtone patches under the
eyes or across the cheeks. Background: one perfectly flat solid pure blue #0000FF, no
shadow, no floor, no vignette, no border, no text, no letters; at least a third of the
background stays plain blue. Neon, hologram and data effects are few, bold and compact,
sit behind the shoulders or high above the head, and never cover the face; a band of
plain blue at least three blocks wide separates any aura, halo or glow from the hair,
so the hair outline stays exactly as in image 2. The costume is unmistakably near-future
cyberpunk techwear on every tier (high collars, zips, straps, cables, ports, panel
lines, chrome hardware), never robes, medieval armour or fantasy jewellery, and
every card carries at least one small neon cyan #2ee6ff or hot pink #ff3d8b light
on the costume or a gadget. Tech is real compute hardware (GPU chips and boards,
heat-sink fins, fibre cables, server-rack panels, circuit traces), not gems or
runes. Holograms and interface panels are a few large simple opaque shapes: a
solid dark navy #1a1640 fill with a bright neon outline and two or three plain
bars or one simple icon, never translucent or tinted by the blue background,
never small letter-like glyphs or readable text.
<!-- STYLE:END -->

## Notes from the style check

Checked on 2026-09-24 with three throwaway concepts (xingfan legendary "GPU OVERLORD", nancy common
"NIGHT MARKET CODER", kevin epic "CHROME ARBITER"), 4 rounds and 12 generations. The accepted samples
are in `scratch/media/style-cyber/final/` (generator output `*-gen.png`, art, icon, webp, preview,
`board.png` = photo | art 8x | icon 8x); every round and the quantizer comparisons are beside it.

- **What the paragraph gained over the first draft.** (1) Costume is named as near-future
  techwear with real compute hardware (GPU chips, heat-sink fins, fibre cables, rack panels,
  circuit traces), never robes, fantasy armour, gems or runes. Without that, the legendary halo
  came out as a jewelled fantasy crown; with it, a ring of GPU chips and fans with cyan traces.
  (2) Holograms are opaque shapes with a solid dark navy fill and a neon outline. Translucent
  violet panels blend with the blue key, and the quantizer's background fill eats them into
  magenta noise. (3) Gold, chrome or neon costume never tints the skin, and there are no orange
  midtone patches under the eyes. (4) At least three blocks of skin between each eye and the hair.
- **Use `--skin-lift 0.06` (fair skin).** The cyber generations shade faces more realistically
  than the fantasy pack's, with peach and orange midtones on cheeks, jaw and under the eyes. At the
  cl-team 0.03 they turn into tan blotches (Kevin looked stubbly, Xingfan half-shadowed). At 0.06
  those areas become the `h`/`H` midtones and the eyes and mouth stay dark. At 0.08 the face breaks
  into speckles. Do not use `--face rim` or the old `cpBbd` skin keys: rim cleans the face but
  flattens it, and the old keys look bland. Dark skin stays at 0.0.
- **`--tol` stays 0.12.** With opaque navy panel fills, 0.06 barely changed anything. Where
  the generator still draws translucent panels, they come out as outlines, which is fine.
- **Nancy's far eye (image left) is weak in every roll**, 4 of 4 here and also in the locked
  cl-team nancy-common-1. The generator draws about 12px blocks (about 86 columns), puts that eye
  one block from the hair, and at 64 columns the eye merges into the hair. The three-block rule did
  not move it. Her card still reads (parting, long straight hair, oval face, soft smile), but pick
  the roll where that eye shows best. It is a limit of the downsample, not something to fix with
  `--dark-bias` or `--sample` (both tried, no gain).
- **Kevin epic varies from roll to roll.** One roll had a clean calm face, another heavy lower-face
  shading. Roll again rather than rescue a card in post.
- **Common tier reads as modern street techwear**, not fantasy: hoodie, strap, earpiece, and a
  laptop with a cyan LED. The earpiece's LED is one or two cells and usually drops out; the
  laptop LED survives. The neon room carries the rest of the theme at this tier.
- The generator ignores the 16px block size here as well (grid period 11-16px), as in cl-team.


## Cards quantized off the defaults

Re-quantizing these from `source/*.webp` needs the listed setting to reproduce the published PNG.

| Card | Setting |
|---|---|
| jermaine-epic-1, jermaine-epic-2 | `--zoom 1.0` (not the epic 1.1): the generator already drew his head at full size, and the 1.1 crop made the face too big and cut the chrome costume into noise |
