import type { Vault } from '../context';

/**
 * A theme is the vault's look and sound, independent of the deck (what is on the cards): the lit
 * room, the void behind the wall, lamps, card back and card face chrome, world-particle colours,
 * HUD strings and ambient audio. Every deck plays in every theme. `vault` (themes/vault.ts) is
 * the original torch-lit dungeon; a new theme can spread it and replace only what differs.
 * docs/themes.md has the contract and how to add one.
 */
export interface Theme {
  /** `?theme=<id>`, the stored choice and `data-vault-theme` on <html> (DOM styles key off it) */
  id: string;
  /** name on the theme switch */
  label: string;

  /** RAMPS keys: lit structures, and the light each lamp casts (left lamp, right lamp) */
  ramps: { base: string; lamps: [string, string] };
  /** lamp brightness before charge / reveal boosts, called once per lamp per frame in lamp order */
  lampLevel(V: Vault, i: number): number;
  /** builds V.U for the current layout: wall units (detachable), floor units, per-pixel altar and lamp fixtures */
  buildScene(V: Vault): void;
  /** paints the void behind the wall for tier r into U.VOID32 and lists its twinkling points in U.VOIDSTARS */
  paintVoid(V: Vault, r: number): void;
  /** optional: emissive pixels written straight into the lit scene (U.scene32) each frame, so they reflect on the floor */
  emissive?(V: Vault): void;
  /** lamp glow behind the card each frame (vault: torch halos) */
  drawLamps(V: Vault, ox: number, oy: number): void;
  /** optional: anything else behind the card, drawn after the world particles (vault: none) */
  drawWorld?(V: Vault, ox: number, oy: number): void;
  /** lamps shed flame particles (and flare with them on a reveal) */
  flames: boolean;

  /** palette keys of engine-drawn bits */
  keys: {
    /** coin face light / body / shade */
    coin: [string, string, string];
    /** summoning ring, its accent dots, the inner orbiting marks */
    summon: [string, string, string];
    /** cold chain link body / highlight / shadow */
    chain: [string, string, string];
    /** card edge when seen side-on: body / top highlight */
    edge: [string, string];
    /** hitstop silhouette frames: dark / light */
    impact: [string, string];
  };
  /** padlock sprite rows (palette keys, '.' transparent) */
  lock: string[];

  /** static card back into B.backG, then V.K.backBase = its pixels (chains, cracks and the shine band are drawn over it) */
  buildBack(V: Vault): void;
  face: {
    /** art-window backdrop for visible tier vr into B.artG (also seeds S.artStars) */
    artBg(V: Vault, vr: number): void;
    /** card frame under the art (runs first on a cleared B.frontG) */
    frame(V: Vault, t: number): void;
    /** optional: a restyled copy of a card's art (cached by the theme); default is the art as is */
    portrait?(V: Vault, art: HTMLCanvasElement): HTMLCanvasElement;
    /** optional: drawn over the art window after the art and its sparkles */
    overArt?(V: Vault, t: number): void;
    /** everything after the art: title bar, nameplate, stat bars, gems */
    chrome(V: Vault, t: number): void;
  };

  hud: {
    /** hint under the altar while idle, and while a tap auto-charges */
    hold: string; auto: string;
    /** tier title gets offset colour ghosts (chromatic split) */
    splitTitle?: [string, string];
  };
  audio: {
    /** background bed: 'drone' (low triangle chord) or 'hum' (mains hum + detuned pad) */
    ambient: 'drone' | 'hum';
    /** the random ticks from the lamps: 'fire' crackle or 'data' chirps */
    crackle: 'fire' | 'data';
  };
}
