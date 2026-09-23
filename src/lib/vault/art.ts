import type { Deck, DeckCard } from './decks/types';
import { drawText, textW } from './font';
import type { CardGeo } from './geometry';
import { PAL } from './palette';
import type { SpriteSheet } from './sprites';
import { TIERS } from './tiers';
import { mk } from './util';

/** Ready-to-blit art for one card: the art-window picture and the bag icon. */
export interface CardAssets { art: HTMLCanvasElement; icon: HTMLCanvasElement }

/**
 * Resolves every card's art before the first draw. Sprite cards reuse the sprite sheet; image
 * cards load their PNGs, and a missing file becomes a palette-only placeholder (silhouette +
 * initials in the tier colours) so a deck is playable before its art exists.
 */
export async function loadDeckArt(deck: Deck, spr: SpriteSheet, geo: CardGeo): Promise<Map<string, CardAssets>> {
  const out = new Map<string, CardAssets>();
  await Promise.all(deck.cards.map(async c => {
    if (c.art.kind === 'sprite') { out.set(c.id, { art: spr.spr32[c.art.sprite], icon: spr.spr16[c.art.sprite] }); return; }
    const ini = initials(deck.slots[c.slot].fullName);
    const [art, icon] = await Promise.all([
      loadImage(c.art.src, geo.art.w, geo.art.h).then(i => i ?? placeholderArt(geo.art.w, geo.art.h, c, ini)),
      loadImage(c.art.icon, geo.icon, geo.icon).then(i => i ?? placeholderIcon(geo.icon, c, ini)),
    ]);
    out.set(c.id, { art, icon });
  }));
  return out;
}

const warned = new Set<string>();
function loadImage(src: string, w: number, h: number): Promise<HTMLCanvasElement | null> {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      if ((img.width !== w || img.height !== h) && !warned.has(`${w}x${h}`)) { warned.add(`${w}x${h}`); console.warn(`[vault] ${src} is ${img.width}x${img.height}, layout expects ${w}x${h}`); }
      const [c, x] = mk(img.width, img.height); x.drawImage(img, 0, 0); res(c);
    };
    img.onerror = () => res(null);
    img.src = src;
  });
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** Fills an on/off mask: black outline around it, tier-light rim on up/left edges, tier-dark body. */
function paintMask(x: CanvasRenderingContext2D, w: number, h: number, on: (i: number, j: number) => boolean, light: string, dark: string) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (on(i, j)) { x.fillStyle = PAL[!on(i, j - 1) || !on(i - 1, j) ? light : dark]; x.fillRect(i, j, 1, 1); }
    else if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) { x.fillStyle = PAL.k; x.fillRect(i, j, 1, 1); }
  }
}

function placeholderArt(w: number, h: number, c: DeckCard, ini: string) {
  const [cv, x] = mk(w, h), T = TIERS[c.tier], cx = (w - 1) / 2, hr = Math.round(w * .2), hy = Math.round(h * .36);
  const body = (i: number, j: number) => ((i - cx) / (w * .44)) ** 2 + ((j - h - 2) / (h * .4)) ** 2 <= 1;
  const on = (i: number, j: number) => i >= 1 && j >= 1 && i < w - 1 && ((i - cx) ** 2 + (j - hy) ** 2 <= hr * hr || body(i, j) || (Math.abs(i - cx) < hr * .5 && j > hy && j < h * .7));
  paintMask(x, w, h, on, T.l, T.d);
  drawText(x, ini, Math.round(w / 2 - textW(ini, 2) / 2), Math.round(h * .78) - 4, 2, 'w', 'k');
  return cv;
}

function placeholderIcon(s: number, c: DeckCard, ini: string) {
  const [cv, x] = mk(s, s), T = TIERS[c.tier], m = (s - 1) / 2, r = s / 2 - 1.5;
  paintMask(x, s, s, (i, j) => (i - m) ** 2 + (j - m) ** 2 <= r * r, T.l, T.d);
  drawText(x, ini, Math.round(s / 2 - textW(ini, 1) / 2), Math.round(s / 2 - 2.5), 1, 'w');
  return cv;
}
