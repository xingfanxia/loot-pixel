import type { Deck } from './decks/types';
import type { TierId } from './tiers';

/**
 * Genshin-style pity for decks that declare `pity` (decks/types.ts). The bag keeps two counters:
 * pulls since the last LEGENDARY and since the last EPIC or better. From pull `soft` on, the
 * LEGENDARY chance rises by `step` per pull and pull `hard` is always LEGENDARY; pull `epic` is at
 * least EPIC. Any `epic` consecutive pulls therefore hold an EPIC or better, so every 10-pull does.
 * Decks without `pity` draw straight from their odds.
 */
export interface Pity { legend: number; epic: number }
export const noPity = (): Pity => ({ legend: 0, epic: 0 });

const LEGENDARY: TierId = 4, EPIC: TierId = 3;

/** Chance that the next pull is LEGENDARY. */
export function legendChance(deck: Deck, pity: Pity) {
  const rule = deck.pity!, base = deck.tiers.find(t => t.tier === LEGENDARY)?.odds ?? 0, n = pity.legend + 1;
  return n >= rule.hard ? 1 : Math.min(1, base + Math.max(0, n - rule.soft + 1) * rule.step);
}

/** The tier for one uniform draw u in [0, 1): LEGENDARY by its pity chance, else EPIC when due, else the other tiers by their odds. */
export function pityTier(deck: Deck, pity: Pity, u: number): TierId {
  const pl = legendChance(deck, pity); if (u < pl) return LEGENDARY;
  if (pity.epic + 1 >= deck.pity!.epic) return EPIC;
  const rest = deck.tiers.filter(t => t.tier !== LEGENDARY), sum = rest.reduce((a, t) => a + t.odds, 0);
  let v = (u - pl) / (1 - pl) * sum; for (const t of rest) { v -= t.odds; if (v < 0) return t.tier; }
  return rest[rest.length - 1].tier;
}

/** The counters after a pull of tier r. */
export const advance = (p: Pity, r: number): Pity => ({ legend: r === LEGENDARY ? 0 : p.legend + 1, epic: r >= EPIC ? 0 : p.epic + 1 });
