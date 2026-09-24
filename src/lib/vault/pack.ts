import { saveBag, showCard } from './bag';
import { drawFront } from './card-front';
import type { Pack, PackCard, PackResult, Vault } from './context';
import { afterCollect, bagPity, countDraws, drawRecord, leave, paint, pickRarity, resetCard, rollCard, setCard, withFake } from './flow';
import { advance } from './odds';
import { ring, shatter, sparks } from './particles';
import { TIERS } from './tiers';

/**
 * The 10-pull. In pack mode the altar holds a sealed pack instead of a card. Holding it charges
 * like a card, and the tease climbs to the best card's (visible) tier, so the charge tells how good
 * the pack is. The burst deals the ten cards one at a time, lowest tier first: each lower card
 * dissolves in, flips at once, stays for a beat by tier and flies to the bag on its own; the best
 * card comes last with the full single-draw reveal (fake upgrade and wall break included).
 * "Skip to best" files the lower cards straight into the bag. Once the last card lands the
 * results screen gets every card's rendered face (hooks.onPackDone); closePack() goes on.
 */

export const PACK_SIZE = 10;
/** the tier a pack always contains at least one card of (or better), when the deck has it */
const FLOOR = 2;

export const newPack = (): Pack => ({ cards: [], i: -1, skip: false, results: [], rolls: [] });

/** A pack is dealing one of its lower cards (not the sealed pack, not the best card, not done). */
export const dealing = (V: Vault) => { const P = V.S.pack; return !!P && P.i >= 0 && P.i < P.cards.length - 1; };

/** A tier at or above `min`, by the deck's odds among those tiers. */
function pickAtLeast(V: Vault, min: number) {
  const ts = V.deck.tiers.filter(t => t.tier >= min), sum = ts.reduce((a, t) => a + t.odds, 0); let u = Math.random() * sum;
  for (const t of ts) { u -= t.odds; if (u <= 0) return t.tier; } return ts[ts.length - 1].tier;
}

/**
 * Rolls the ten cards in order, lowest first; only the best may be a fake. A deck with pity (odds.ts) rolls
 * them through its counters, which already put an EPIC or better in every ten; one without gets at least
 * one RARE or better unless a tier is forced.
 */
export function rollPack(V: Vault) {
  const { S, env: { APP } } = V, P = S.pack!; let pity = bagPity(V);
  const rolls = Array.from({ length: PACK_SIZE }, () => { const x = rollCard(V, pickRarity(V, pity)); pity = advance(pity, x.r); return x; });
  if (!V.deck.pity && S.force < 0 && !APP.forceCard && V.ladder.some(t => t >= FLOOR) && rolls.every(x => x.r < FLOOR)) rolls[PACK_SIZE - 1] = rollCard(V, pickAtLeast(V, FLOOR));
  P.rolls = rolls.map(x => x.r); rolls.sort((a, b) => a.r - b.r);
  P.cards = rolls.map((x, k) => withFake(V, x.spec, x.r, k === PACK_SIZE - 1));
  setCard(V, P.cards[PACK_SIZE - 1]);
}

/** The charged pack bursts (instead of a card's reveal): its back shatters in the best card's colour and the first card is dealt. */
export function openPack(V: Vault) {
  const { S, B, A, bag, env } = V, R = TIERS[S.vr];
  // the pack's draws count toward pity and the draw record once it is open (its cards are all filed from here on)
  countDraws(V, S.pack!.rolls); saveBag(bag.key, bag.bag);
  S.backOn = false; S.auto = false; shatter(V, B.backC);
  S.flash = .7; S.flashKey = 'w'; S.trauma = Math.min(1, S.trauma + .5); S.zoom.v = -1.1 * env.MOTION; S.torchBoost = 1;
  sparks(V, 110, R.l, 60, 260, 1.1); sparks(V, 50, 'w', 90, 320, .5); ring(V, R.l, 340, 3, 0); ring(V, 'w', 250, 1, .06); A.roar();
  deal(V, 0);
}

/** Summons pack card i onto the altar; step() bursts it as soon as it has dissolved in. */
export function deal(V: Vault, i: number) {
  const { S, env } = V, P = S.pack!, last = i === P.cards.length - 1;
  resetCard(V); P.i = i; S.chains = [false, false, false, false]; S.lockOn = false; S.summonChime = true;
  setCard(V, P.cards[i]);
  env.els.again.classList.toggle('show', !last && !P.skip);
  env.els.hit.setAttribute('aria-label', `Card ${i + 1} of ${P.cards.length}.`);
  env.hooks.onPack?.({ at: i + 1, total: P.cards.length });
}

/** Records pack card k in the bag without revealing it (skip). */
function file(V: Vault, k: number) {
  const { bag, deck } = V, P = V.S.pack!, c = P.cards[k].spec, owned = bag.bag.owned, isNew = !owned[c.id];
  owned[c.id] = (owned[c.id] || 0) + 1; showCard(bag, deck, c.idx); bag.flash[c.slot] = .5;
  P.results[k] = { id: c.id, tier: c.tier, title: c.title ?? c.name, isNew, count: owned[c.id] };
}

/** "Skip to best": the lower cards not yet dealt go straight into the bag, the card on the altar leaves, and the best card is next. */
export function skipPack(V: Vault) {
  const { S, bag, A, env } = V, P = S.pack; if (!P || P.skip || !dealing(V)) return;
  P.skip = true; A.init(); A.whoosh();
  for (let k = P.i + 1; k < P.cards.length - 1; k++) file(V, k);
  saveBag(bag.key, bag.bag); env.els.again.classList.remove('show');
  if (S.phase === 'revealed') leave(V);
}

/** The best card landed: render every card's face for the results screen and wait for closePack(). */
export function packDone(V: Vault) {
  const { S, B, env } = V, P = S.pack!; P.i = P.cards.length; env.hooks.onPack?.(null);
  const order = P.cards.map((_, k) => k).sort((a, b) => P.cards[b].r - P.cards[a].r || b - a);
  const cards: PackResult[] = order.map(k => { const pc: PackCard = P.cards[k];
    S.spec = pc.spec; S.face = pc.spec; S.r = S.vr = pc.r; S.glitch = 0; S.popT0 = -9; paint(V, pc.r); S.bars = S.barTarget.slice();
    drawFront(V, S.rt); return { ...P.results[k], face: B.frontC.toDataURL(), w: V.geo.w, h: V.geo.h }; });
  env.els.live.textContent = `Pack opened: ${cards.filter(c => c.isNew).length} new cards.`;
  // the record (and its luck) updates only now, so it cannot give away the best card before it is dealt
  const record = drawRecord(V); env.hooks.onRecord?.(record);
  if (env.hooks.onPackDone) env.hooks.onPackDone(cards, record); else closePack(V, false);
}

/** Leaves the results: the next card or pack comes up (auto-charged when `again`), after the full-set celebration if the pack completed the bag. */
export function closePack(V: Vault, again: boolean) {
  const P = V.S.pack; if (!P || P.i < P.cards.length) return;
  V.S.pack = null; V.S.autoNext = again; afterCollect(V);
}
