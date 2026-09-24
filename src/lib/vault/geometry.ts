import type { CardLayout, Emblem, Rect } from './decks/types';

/**
 * Card-relative geometry derived once from a deck's layout. For the classic 64x90 item layout
 * every value equals the constant the single-file build hard-coded (noted in the comments).
 */
export interface CardGeo {
  w: number; h: number;
  /** integer half sizes (32, 45): chain hub, padlock, scene stacking (odd sizes round down so scene rows stay integral) */
  hw: number; hh: number;
  art: Rect;
  /** art centre used by the halo and the face cracks (32, 28) */
  artCx: number; artCy: number;
  /** sprite kind: drawn size (32), centre height (26) and the floor shadow row under it (45) */
  spriteSz: number; spriteCy: number; shadowY: number;
  /** art background: radial centre row + radius (24, 22), floor strip row (40), star rows (34) */
  bgCy: number; bgRy: number; floorY: number; starsH: number;
  /** title bar above the art: top row, height and chars per line (0 height when the layout has none) */
  titleY: number; titleH: number; titleChars: number; titleRows: number;
  /** nameplate top (54), first bar row (66), bar x + width (21, 36), gem row (83) */
  plateY: number; barY0: number; barX: number; barW: number; gemY: number; bars: string[];
  /** back: emblem centre (32, 44), diamond radius (19), twinkle points */
  backCx: number; backCy: number; emblemR: number; glints: [number, number][];
  /** chain segments corner -> hub, padlock top-left (27, 38) */
  chains: [[number, number], [number, number]][]; lockX: number; lockY: number;
  /** 3D scratch buffer (132x160), altar shadow width (46), radius scale for card-sized effects (1) */
  t1w: number; t1h: number; shadowW: number; k: number;
  icon: number; minIcon: number;
}

export function cardGeo(l: CardLayout, emblem?: Emblem): CardGeo {
  const { w, h } = l.card, a = l.art, hw = Math.floor(w / 2), hh = Math.floor(h / 2);
  const backCx = Math.floor(w / 2), backCy = Math.floor(h / 2) - 1, emblemR = Math.floor(w * .3);
  const plateY = a.y + a.h + 3, barX = a.x + 15, floorY = a.h - 5;
  // a sprite stands on the art window's floor strip, at the largest whole multiple of its 32px art that fits
  const spriteSz = Math.max(16, 32 * Math.floor(Math.min(a.w, floorY - 4) / 32));
  // side twinkles sit just outside an emblem, or on the diamond's rim for the "?" back
  const side = emblem ? Math.ceil(emblem.rows[0].length / 2) + 3 : emblemR - 1;
  return {
    w, h, hw, hh, art: a,
    artCx: a.x + a.w / 2, artCy: a.y + Math.floor(a.h / 2),
    spriteSz, spriteCy: a.y + floorY - 4 - spriteSz / 2, shadowY: a.y + floorY - 1,
    bgCy: Math.round(a.h * 24 / 45), bgRy: Math.floor(a.h / 2), floorY, starsH: a.h - 11,
    titleY: 6, titleH: titleBarH(l.titleRows), titleChars: Math.floor((a.w + 1) / 4), titleRows: l.titleRows ?? 0,
    plateY, barY0: plateY + 12, barX, barW: a.x + a.w - barX - 1, gemY: h - 7, bars: l.bars,
    backCx, backCy, emblemR,
    glints: [[backCx, backCy - (emblemR + 11)], [backCx, backCy + (emblemR + 11)], [backCx - side, backCy], [backCx + side, backCy]],
    chains: [[[6, 9], [hw, hh]], [[w - 6, 9], [hw, hh]], [[hw, hh], [w - 6, h - 9]], [[hw, hh], [6, h - 9]]],
    lockX: hw - 5, lockY: hh - 7,
    t1w: w * 2 + 4, t1h: Math.round(h * 16 / 9), shadowW: Math.round(w * .72), k: Math.hypot(w, h) / Math.hypot(64, 90),
    icon: l.icon, minIcon: l.minIcon ?? l.icon >> 1,
  };
}

/** Title bar height for `rows` lines of the 3x5 font: 2px padding, 6px per line, 1px border. */
const titleBarH = (rows = 0) => rows > 0 ? rows * 6 + 3 : 0;

/**
 * A card sized to fit its art window plus nameplate, stat bars and gems (64x90 for 52x45 + 3 bars),
 * with an optional title bar of `titleRows` lines above the art.
 */
export function fitLayout(name: string, art: { w: number; h: number }, icon: number, bars: string[], titleRows = 0): CardLayout {
  const x = 6, tb = titleBarH(titleRows), y = 6 + (tb ? tb + 2 : 0);
  return { name, art: { x, y, w: art.w, h: art.h }, icon, bars, titleRows,
    card: { w: art.w + 2 * x, h: y + art.h + 3 + 12 + 6 * bars.length + 6 } };
}
