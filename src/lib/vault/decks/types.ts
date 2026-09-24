import type { TierId } from '../tiers';

/** What sits in a card's art window. */
export type CardArt =
  /** 16x16 char-grid sprite from sprites.ts, EPX-upscaled to 32x32 on the card */
  | { kind: 'sprite'; sprite: string }
  /** pre-quantized PNGs: `src` fills the art window, `icon` fills a bag slot */
  | { kind: 'image'; src: string; icon: string };

export interface DeckCard {
  /** unique within the deck; the bag records ownership by this id */
  id: string;
  /** index into Deck.slots */
  slot: number;
  tier: TierId;
  /** 1-based index within (slot, tier) */
  n: number;
  /** nameplate text (3x5 font, must fit the art width) */
  name: string;
  /** variant title: in the card's title bar when the layout has one, else under the altar after the reveal */
  title?: string;
  /** why this card fits its slot (shown in the collection); optional */
  note?: string;
  /** spoken after the tier name in the live region, e.g. "Albert Zhang, Sun Emperor" */
  label: string;
  art: CardArt;
}

/** One collectible identity (a person, an item); the bag has one square per slot. */
export interface DeckSlot { id: string; short: string; fullName: string; role?: string }

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Card geometry. Every card-relative constant in the engine (frame, studs, chains, padlock,
 * cracks, glow ring, shatter, stamp, nameplate, bars, gems, lift-off, scene sizing) derives
 * from this; see geometry.ts.
 */
export interface CardLayout {
  name: string;
  card: { w: number; h: number };
  /** art window inside the card */
  art: Rect;
  /** bag icon size (square); bag slots are sized from it */
  icon: number;
  /** smallest size the bag may draw an icon at before it wraps onto two rows (default: half the icon) */
  minIcon?: number;
  /** stat bar labels under the nameplate, one bar each */
  bars: string[];
  /** text rows of the title bar above the art (0 or absent: no title bar; the variant title goes under the altar) */
  titleRows?: number;
}

/** A 1-bit mask ('#' = on) drawn on the card back with the gold ramp and a bevel. */
export interface Emblem { rows: string[] }

export interface DeckTier { tier: TierId; odds: number }

/** Genshin-style pity (odds.ts): LEGENDARY chance +`step` per pull from pull `soft`, certain at pull `hard`; EPIC or better at least every `epic` pulls. */
export interface PityRule { soft: number; step: number; hard: number; epic: number }

export interface Deck {
  id: string;
  title: string;
  /** tiers this deck draws, low to high, with their odds */
  tiers: DeckTier[];
  slots: DeckSlot[];
  cards: DeckCard[];
  layout: CardLayout;
  /** localStorage key of this deck's bag */
  bagKey: string;
  /** replaces the "?" diamond on the card back */
  emblem?: Emblem;
  /** pity counters kept in the bag; without it every draw comes straight from the odds */
  pity?: PityRule;
}
