import type { Deck } from './decks/types';
import type { TierId } from './tiers';

/**
 * Genshin-style pity for decks that declare `pity` (decks/types.ts). The bag keeps two counters:
 * pulls since the last LEGENDARY and since the last EPIC or better. From pull `soft` on, the
 * LEGENDARY chance rises by `step` per pull and pull `hard` is always LEGENDARY; pull `epic` is at
 * least EPIC. Any `epic` consecutive pulls therefore hold an EPIC or better, so every 10-pull does.
 * Decks without `pity` draw straight from their odds; the bag keeps the counters for them too, for the
 * draw record (DrawStats) and its luck rating.
 */
export interface Pity { legend: number; epic: number }
export const noPity = (): Pity => ({ legend: 0, epic: 0 });

const LEGENDARY: TierId = 4, EPIC: TierId = 3;

/** Chance that the next pull is LEGENDARY (the deck's odds when it has no pity). */
export function legendChance(deck: Deck, pity: Pity) {
  const rule = deck.pity, base = deck.tiers.find(t => t.tier === LEGENDARY)?.odds ?? 0, n = pity.legend + 1;
  if (!rule) return base;
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

/** The bag's draw record: every draw, the draws each LEGENDARY took since the one before, and the EPIC count. */
export interface DrawStats { draws: number; gaps: number[]; epics: number }
export const noStats = (): DrawStats => ({ draws: 0, gaps: [], epics: 0 });

/** Counts draws of tiers `rs` (in roll order) into the counters and the record. */
export function tally(pity: Pity, stats: DrawStats, rs: number[]) {
  let p = pity; const st = { ...stats, gaps: [...stats.gaps] };
  for (const r of rs) { st.draws++; if (r === LEGENDARY) st.gaps.push(p.legend + 1); else if (r === EPIC) st.epics++; p = advance(p, r); }
  return { pity: p, stats: st };
}

/** Average draws per LEGENDARY under the deck's odds and pity. */
export function meanGap(deck: Deck) {
  if (!deck.pity) { const b = legendChance(deck, noPity()); return b > 0 ? 1 / b : Infinity; }
  let alive = 1, mean = 0;
  for (let n = 1; n <= deck.pity.hard; n++) { const c = legendChance(deck, { legend: n - 1, epic: 0 }); mean += n * alive * c; alive *= 1 - c; }
  return mean;
}

/** Chance that a LEGENDARY takes exactly g draws, g = 1.. (index 0 unused); the tail past 1e-12 is dropped. */
export function gapPmf(deck: Deck) {
  const p = [0]; let alive = 1;
  for (let g = 1; alive > 1e-12 && g <= 5000; g++) { const c = legendChance(deck, { legend: g - 1, epic: 0 }); p.push(alive * c); alive *= 1 - c; }
  return p;
}

/**
 * How lucky a draw history is, in standard deviations from what the odds expect (positive = lucky,
 * 0 = average). It compares the draws spent on your Legendaries, plus the current dry streak, with
 * their expected total: the mean gap per Legendary, and for the unfinished streak the mean of a gap
 * capped at that streak (so a short streak is neutral and a long dry one counts against you). Anchoring
 * on the mean, not the median, makes a Legendary at soft pity read as unlucky, as players count it.
 */
export function luck(deck: Deck, gaps: number[], streak: number) {
  const p = gapPmf(deck); let m = 0, m2 = 0, cm = 0, cm2 = 0, tail = 1;
  p.forEach((v, g) => { m += g * v; m2 += g * g * v; if (g >= 1 && g < streak) { cm += g * v; cm2 += g * g * v; tail -= v; } });
  if (streak > 0) { cm += streak * tail; cm2 += streak * streak * tail; }
  const k = gaps.length, spent = gaps.reduce((a, b) => a + b, 0) + streak;
  const variance = k * (m2 - m * m) + Math.max(0, cm2 - cm * cm);
  return variance > 0 ? (k * m + cm - spent) / Math.sqrt(variance) : 0;
}

/** Share of a normal distribution below z, for drawing a luck score on a 0..1 meter. */
export function meterFill(z: number) {
  const t = 1 / (1 + .3275911 * Math.abs(z) / Math.SQRT2), y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-z * z / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Seven words for a luck score (standard deviations from expected), luckiest first. */
export const verdict = (z: number) => z >= 1.65 ? 'Blessed' : z >= .85 ? 'Fortunate' : z >= .3 ? 'Lucky' : z > -.3 ? 'Average' : z > -.85 ? 'Unlucky' : z > -1.65 ? 'Jinxed' : 'Cursed';