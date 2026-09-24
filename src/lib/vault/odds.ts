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

/**
 * How lucky `k` LEGENDARY in `draws` draws is: the share of players with as many draws who got fewer
 * (ties count half), computed exactly over the pity states. 0.5 is average.
 */
export function luck(deck: Deck, draws: number, k: number) {
  const states = deck.pity ? deck.pity.hard : 1, top = k + 1; // counts 0..k, then "more than k"
  const chance = Array.from({ length: states }, (_, s) => legendChance(deck, { legend: s, epic: 0 }));
  let dp = new Float64Array(states * (top + 1)); dp[0] = 1;
  for (let n = 0; n < draws; n++) { const nx = new Float64Array(dp.length);
    for (let s = 0; s < states; s++) { const c = chance[s], up = Math.min(s + 1, states - 1);
      for (let j = 0; j <= top; j++) { const v = dp[s * (top + 1) + j]; if (!v) continue;
        nx[0 * (top + 1) + Math.min(top, j + 1)] += v * c; nx[up * (top + 1) + j] += v * (1 - c); } }
    dp = nx; }
  let fewer = 0, same = 0;
  for (let s = 0; s < states; s++) for (let j = 0; j <= top; j++) { const v = dp[s * (top + 1) + j]; if (j < k) fewer += v; else if (j === k) same += v; }
  return fewer + same / 2;
}

/**
 * Seven words for a luck share (0..1), luckiest first: Blessed top 5%, Fortunate next 15%, Lucky next 20%,
 * Average the middle 20%, Unlucky, Jinxed and Cursed mirrored below. Without a LEGENDARY the share stays
 * at or under 0.5 (ties count half), so a dry run slides from Average down.
 */
export const verdict = (x: number) => x >= .95 ? 'Blessed' : x >= .8 ? 'Fortunate' : x >= .6 ? 'Lucky' : x >= .4 ? 'Average' : x >= .2 ? 'Unlucky' : x >= .05 ? 'Jinxed' : 'Cursed';
