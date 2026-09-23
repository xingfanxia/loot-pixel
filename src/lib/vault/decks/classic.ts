import type { TierId } from '../tiers';
import type { CardLayout, Deck } from './types';

/** The original single-file build: nine item sprites, four tiers, 64x90 cards. */
export const ITEM_LAYOUT: CardLayout = {
  name: 'item', card: { w: 64, h: 90 }, art: { x: 6, y: 6, w: 52, h: 45 }, icon: 16, bars: ['ATK', 'DEF', 'MAG'],
};

const POOL: [TierId, string, string][] = [
  [0, 'SLIME', 'slime'], [0, 'POTION', 'potion'], [0, 'OLD SHIELD', 'shield'],
  [2, 'FROST GEM', 'gem'], [2, 'SKY KEY', 'key'],
  [3, 'RUNE SWORD', 'sword'], [3, 'DRAGON EGG', 'egg'],
  [4, 'SUN CROWN', 'crown'], [4, 'GOLDEN ORB', 'orb'],
];

export const classic: Deck = {
  id: 'classic',
  title: 'Classic',
  tiers: [{ tier: 0, odds: .50 }, { tier: 2, odds: .28 }, { tier: 3, odds: .15 }, { tier: 4, odds: .07 }],
  slots: POOL.map(([, name]) => ({ id: name.toLowerCase().replace(/ /g, '-'), short: name, fullName: name })),
  // card ids are the names so bags saved by the single-file build keep working
  cards: POOL.map(([tier, name, sprite], slot) => ({ id: name, slot, tier, n: 1, name, label: name, art: { kind: 'sprite', sprite } })),
  layout: ITEM_LAYOUT,
  bagKey: 'loot-pixel-bag-v2',
};
