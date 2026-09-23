# cl-team portrait style (locked)

The contract every cl-team card image follows. The engine side of the image
contract (palette, alpha, file names) is in `docs/decks.md`.

## Sizes

| What | Size |
|---|---|
| Card art (`<slot>-<tier>-<n>.png`) | **64 x 72** |
| Bag icon (`<slot>-<tier>-<n>-icon.png`) | **24 x 24** |
| Draft grid block | 16 px |
| Generator size (`--size`) | **1024x1152** (64·16 x 72·16) |
| Source copy (`art/cl-team/source/<slot>-<tier>-<n>.webp`) | 512 px long edge |

Why these: at 52x57 and 56x62 the faces lose the eye/mouth structure that
carries likeness (about 3.5/5 at 8x next to the photo); 60x66 is borderline;
64x72 is the smallest size where Xingfan, Nancy and Kevin all read as
themselves. With the face re-shading and frame zoom below, Kevin's rare and
epic cards also reach 4/5 (they were 3/5 before). A 16px icon is a blob and
20px is marginal; 24px is the smallest face crop that stays recognisable.

## Pipeline (per card)

```bash
S=kevin; T=epic; N=1; REF=kevin-schubert          # slot, tier, n, ref photo basename
W=scratch/media/cards/$S; mkdir -p $W
BOX=$(jq -r ".slots.$S.headBox" art/cl-team/source/style-likeness.json)
TONES=$(jq -r ".slots.$S.faceTones" art/cl-team/source/style-likeness.json)

# 1. composition draft: tight bust on the exact 64x72 grid of 16px blocks
scripts/art/draft.py scratch/media/team/refs/$REF.png $W/draft.png \
  --head $BOX --art 64x72 --block 16 --head-frac 0.6

# 2. generate: image 1 = draft (framing + grid), image 2 = photo (likeness)
~/.claude/skills/gpt-image/generate.py "$(scripts/art/prompt.py $S $T $N)" \
  --edit $W/draft.png --edit scratch/media/team/refs/$REF.png \
  --variant sunburst --format png --size 1024x1152 --output $W --name $S-$T-$N

# 3. quantize into the deck (asserts palette + alpha), preview for the likeness check
scripts/art/quantize.py $W/$S-$T-$N.png \
  --art-out public/decks/cl-team/$S-$T-$N.png \
  --icon-out public/decks/cl-team/$S-$T-$N-icon.png \
  --src-out art/cl-team/source/$S-$T-$N.webp \
  --art 64x72 --icon 24 --head-frac 0.6 --tier $T --face-tones $TONES \
  --preview $W/$S-$T-$N-prev.png --ref scratch/media/team/refs/$REF.png
```

Look at every `-prev.png` (photo | art 8x | icon 8x) before accepting a card.
Quantizer defaults are the locked settings: `--fit frame --sample hybrid
--dark-bias 2.5 --skin-keys chHpBnbd --skin-lift 0.03 --l-weight 1.0 --pad 2
--stray 0.12 --head-frac 0.6 --draft-pad 3 --face off`, no dither. Pass
`--tier $T` (sets the zoom); for dark skin (`faceTones` `Bb` in
`source/style-likeness.json`) pass `--skin-lift 0.0`. The skin midtones `h`, `H`, `n`
in PAL give faces real light/shadow planes; the older `--face rim` re-shading
(flatten the face to lit + rim tones) was the workaround for a palette without them
and is no longer used. `--face-tones` only matters with `--face rim|flat`.

- `--tier` rare, epic and legendary crop the generator frame by 1.1 about
  its top centre (`TIER_ZOOM`; common and uncommon stay at 1.0, `--zoom`
  overrides). On costume-heavy tiers the generator draws Kevin's face about
  0.44 of the width against 0.50 on his common card. A bigger head in the
  draft (`--head-frac 0.66`) did not help (0.45-0.46 and a blander face);
  zooming by measured face width does not work either, because narrow faces
  framed by hair (Nancy, 0.33) are not shrunk.
- `--face rim` re-shades the face after the vote (`face_skin`): from the face
  centre it floods through skin cells no darker than the subject's shadow
  tone; they all become the lit tone except a one-cell shadow-tone rim where
  they leave the face (jaw, cheek, hairline contour). Small shadow shapes
  (at most 6 cells: nose side, nostril, eye socket), feature strokes the
  vote kept (eyes, brows, lips, stubble) and rosy cells stay as they are.
  This is what turns a blotchy or half-shadowed face into a clean lit face
  with a readable contour. Rosy means red-leaning (OKLab a > b and a >
  0.035): peach and tan midtones are just as red but lean yellow, and a
  plain redness threshold turned them into pink speckles.

Locked samples (generator output `*-gen.png`, art, icon, webp, preview) are in
`scratch/media/style-lock/final/` (git-ignored, regenerate with the pipeline):
xingfan legendary-1, nancy common-1, kevin common-1 / rare-1 / epic-1, with
`board.png` (photo | art 8x | icon 8x). All are quantized with the settings
above. kevin epic-1 was generated with the final paragraph; kevin common-1,
rare-1 and xingfan legendary-1 with it minus the "face looks at the viewer"
sentence; nancy common-1 is the earlier round-5 generation (two re-rolls with
the new paragraph turned her head so the far eye touched the hair).
The previous lock is in `scratch/media/style-lock/final-r6/`.

## Locked style paragraph

`scripts/art/prompt.py` reads the text between the markers; edit it only here.

<!-- STYLE:BEGIN -->
Chunky low-resolution retro 16-bit JRPG character portrait in strict pixel art.
Image 1 is the pixel canvas: a grid of exactly 64 columns by 72 rows of square
16x16-pixel blocks that fixes the framing. Image 2 is a photo of the real person
and defines the likeness. Repaint image 1 in full colour as the character
described below, keeping its framing, head size, head position and pose, and
keeping its exact block grid: the finished image is still exactly 64 blocks wide
and 72 blocks tall, every block one flat solid colour, aligned to the grid, no
block smaller than 16x16 pixels, no anti-aliasing, no blur, no gradients, no
dithering noise. Limited flat palette: near-black #07060f, white #ffffff, cream
#f4efe0, pink #ff9aa8, tan #c98f5a, brown #8a5a3c, dark brown #4f2f22, greys
#c4ccd9 #8791a6 #4b5268, navy darks #0d0b1e #1a1640 #2b2461, plus the tier accent
colours named below. Tight head-and-shoulders bust, head large and centred,
shoulders running off the bottom edge, strong readable silhouette with a clean
one-block near-black outline. The head is exactly as large as in image 1, the
head with hair at least half the image width, the same face scale on every
tier; costume and props never shrink it. The face looks at the viewer,
turned at most slightly (a head tilt from the photo is fine), so both eyes
sit well inside the face with skin between each eye and the hair. The face is an unmistakable, flattering likeness
of the person in image 2: keep their exact face shape and proportions, hairline
and hairstyle, glasses or beard if they have them, eyebrows, eye shape, nose,
mouth, signature expression, skin tone and hair colour; eyes, brows and mouth
drawn with clear dark blocks so they read at small size; eyes keep their
natural colour with a white block on each side of the dark iris, and glowing
eyes are shown only as one tiny bright catch-light; heroic and dignified,
never a caricature. The face is the
focal point: evenly lit from the front by neutral warm light, no coloured
light or glow on the skin, and skin uses only the flat tones listed for the
subject, painted like classic pixel art: one large flat lit area with a few
small shadow shapes (beside the nose, under the cheekbones and jaw, in the eye
sockets), never a half-shadowed face; dramatic lighting touches only the
costume and the background. Background: one perfectly flat solid
pure blue #0000FF, no shadow, no floor, no vignette, no border, no text, no
letters; at least a third of the background stays plain blue. Magic effects are
few, bold and compact, sit behind the shoulders or high above the head, and
never cover the face; a band of plain blue at least three blocks wide separates
any aura, halo or glow from the hair, so the hair outline stays exactly as in
image 2. Runes and sigils are a few large simple glowing shapes, never small
letter-like glyphs.
<!-- STYLE:END -->

## Prompt template

`scripts/art/prompt.py <slot> <tier> <n>` prints:

```
<locked style paragraph>
Subject: <Short>, <likeness>, exactly as in image 2.         # source/style-likeness.json
Skin: <skin ramp>.                                           # source/style-likeness.json
Tier <TIER>: <tier look>.                                    # characters.json tiers
Card: <TITLE>, <concept>.                                    # slots/<slot>.json
Accent colours: <tier accent hexes>.                         # prompt.py ACCENTS
```

Tier looks escalate: common silver/grey cloth with no effects; uncommon green
accents and at most a small familiar; rare teal accents, one signature item, a
faint glow; epic violet/magenta magic and dramatic light; legendary gold/white
regalia, halo/crown/wings or cosmic elements, radiant gold aura.

## Pitfalls (seen during the lock)

- **The generator ignores the requested block size.** Asked for 16px blocks it
  draws 9px (text-only) or ~12.5px (with the draft as image 1) blocks, so the
  output is really ~80 columns. The quantizer therefore samples cells by vote,
  not by exact block; putting the draft first is what brings the grid closest.
- **Without the draft the head is too small**: text-only framing leaves a
  ~12px face in a 52px card and the likeness is lost. Always pass the draft.
  Check the draft first: a wrong `headBox` moves the head off-centre in every
  card. Only xingfan, nancy and kevin boxes are verified.
- **PAL has no mid peach skin tone.** Plain nearest-colour splits peach
  skin into cream/pink/pale-gold/white blotches, so skin-band pixels match
  only `cpBbd`, lifted by 0.04 L, with pink kept for rosy pixels. Even then
  the generator paints its peach midtone or whole shadow sides in tan, which
  reads as stubble or a half-shadowed face; `--face rim` fixes that after the
  vote (see above). Do not raise `--skin-lift` instead: 0.12 washes out eyes
  and mouth. Tried and rejected: a c/B checkerboard for the midtone (noisy at
  8x) and keeping tan along every lit/shadow edge (scratchy lines). One mid
  peach (about `#e8b08a`) in PAL would still add modelling the rim cannot.
- **Glowing eyes.** Card concepts that ask for glowing eyes make the
  generator paint violet irises; the paragraph limits it to a catch-light.
- **Aura touching the hair** reads as wild coloured hair and hides the
  hairline. The paragraph asks for a three-block band of plain blue between
  any aura and the hair.
- **Busy tiers shrink the face.** Epic/legendary concepts with many props make
  the generator draw a smaller head than the draft and fill the background;
  at 64px that turns into noise. Keep card concepts to one or two props and
  re-roll a card whose face is visibly smaller than the common card's.
- **Thin dark strokes vanish** (crescent laughing eyes, brows, lip lines) under
  a plain majority vote. `--dark-bias 2.5` keeps them.
- **Dither is off.** The restrained ramp dither (`--dither`) turns faces into
  checkerboards; use it only for a large smooth effect gradient, never on skin.
- **Enclosed background** (inside a halo ring or between an arm and the body)
  is keyed by colour everywhere, not only from the border; keep the key pure
  `#0000FF` so no subject colour comes near it.
- **Magenta/violet rim light on the face** (epic) gets quantized into pink and
  magenta patches; the style paragraph forbids coloured light on skin.
- **Tall halos/crowns** count as the crown of the silhouette. The draft fixes
  head size, so they simply have to fit the rows above the head; the prompt
  keeps effects compact. The 1.1 zoom keeps the top edge and crops about 5%
  off each side and 9% off the bottom, so wide wings lose their tips.
- The posterized refs are greyscale (atlas-xia has faint colour): skin and hair
  colour come from the likeness/skin lines, which must describe the real person
  plainly and never exaggerate.
- **`--face-tones` must be the slot's `faceTones`** from `source/style-likeness.json`, also in
  one-off redo scripts. co rare 1-3 were once quantized with `Bb` (dark skin) instead of his
  `cB`, which painted a fair face tan on three cards; re-quantizing the same generations with
  `cB` fixed it.

## Post-processed cards

Re-quantizing these from `source/*.webp` with the locked settings does not reproduce the
published PNG; redo the listed step afterwards.

| Card | Step after `quantize.py` |
|---|---|
| co-common-4, co-common-5, jermaine-rare-2, jermaine-rare-3, kevin-common-2, kevin-epic-2 | the background key fails on these webp sources (a violet slab stays opaque); the published alpha mask and outline ring were carried over from the previous quantization. Re-quantize from the full-size generator output with `--tol` raised instead |
| kevin-legendary-1 (art + icon) | kept from the pre-midtone quantization (`--skin-keys cpBbd --skin-lift 0.04 --face rim --face-tones cB`): under the gold light the midtones broke his face into orange/black blotches |
| co-rare-1, co-rare-3, co-common-4 | generator lit the face tan; `scripts/art/shift-face.py <card> --map H:h,B:H,n:B` |
| jermaine-legendary-1 | generator lit the face fair under the gold light; `scripts/art/shift-face.py jermaine-legendary-1 --map c:H,h:H,H:B,B:n` |
| jermaine-uncommon-4 | pale forehead patch; `scripts/art/shift-face.py jermaine-uncommon-4 --map c:H,h:H` |

The earlier hand edits (albert-rare-2/3, albert-epic-1, xingfan-epic-2) were replaced by
the plain midtone quantization, which reads as well or better.
