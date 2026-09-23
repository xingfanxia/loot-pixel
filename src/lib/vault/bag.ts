/** The collection bag, persisted per browser. */
export interface Bag { owned: Record<string, number>; complete: boolean }

const STORE = 'loot-pixel-bag-v2';

export function loadBag(): Bag {
  try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && v.owned) return v; } catch {}
  return { owned: {}, complete: false };
}

export function saveBag(bag: Bag) {
  try { localStorage.setItem(STORE, JSON.stringify(bag)); } catch {}
}
