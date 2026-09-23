import type { Deck } from './decks/types';

/** The collection bag, persisted per browser and per deck: copies owned by card id. */
export interface Bag { owned: Record<string, number>; complete: boolean }

export function loadBag(key: string): Bag {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); if (v && v.owned) return v; } catch {}
  return { owned: {}, complete: false };
}

export function saveBag(key: string, bag: Bag) {
  try { localStorage.setItem(key, JSON.stringify(bag)); } catch {}
}

/**
 * What the bag row shows. Ownership is recorded at the reveal, but a card only appears in its
 * slot when it lands there, so `shown` lags `bag.owned` by one flight.
 */
export interface BagState {
  key: string; bag: Bag;
  /** deck card indices visible in the bag */
  shown: Set<number>;
  /** per slot: index of the best shown card (highest tier, then lowest n), or -1 */
  best: number[];
  /** per slot: white flash timer */
  flash: number[];
}

export function openBag(deck: Deck): BagState {
  const bag = loadBag(deck.bagKey), st: BagState = { key: deck.bagKey, bag, shown: new Set(), best: deck.slots.map(() => -1), flash: deck.slots.map(() => -1) };
  deck.cards.forEach((c, i) => { if (bag.owned[c.id]) showCard(st, deck, i); });
  return st;
}

export function showCard(st: BagState, deck: Deck, i: number) {
  st.shown.add(i); const c = deck.cards[i], b = st.best[c.slot];
  if (b < 0 || c.tier > deck.cards[b].tier || (c.tier === deck.cards[b].tier && i < b)) st.best[c.slot] = i;
}

export const shownSlots = (st: BagState) => st.best.filter(b => b >= 0).length;

export function emptyBag(st: BagState) {
  st.bag = { owned: {}, complete: false }; saveBag(st.key, st.bag); st.shown.clear(); st.best.fill(-1);
}
