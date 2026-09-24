/**
 * Scenario scripts for characterise.mjs. Each drives the paused engine through window.APP and
 * the page helpers (__h.frames / __h.until / __h.tier / __h.cards) and snaps at fixed frames,
 * so two runs with the same seed must produce identical canvases.
 */

/** enter -> hold -> hitstop -> reveal (no fake) -> wall break -> collect -> next enter */
const reveal = tier => ({
  name: `reveal-${tier}`,
  async run({ ev, snap }) {
    await ev(`APP.forceFake = false; APP.force(__h.tier('${tier}')); true`);
    await ev('__h.frames(30)'); await snap('enter-30');
    await ev('__h.frames(40)'); await snap('idle', true);
    await ev('APP.beginHold(); __h.frames(40)'); await snap('charge-40');
    await ev('__h.frames(40)'); await snap('charge-80');
    await ev(`__h.until('hitstop', 300)`); await snap('hitstop-0');
    await ev('__h.frames(3)'); await snap('hitstop-3');
    await ev(`__h.until('revealed', 120); APP.endHold(); true`); await snap('reveal-0');
    await ev('__h.frames(15)'); await snap('reveal-0.25');
    await ev('__h.frames(45)'); await snap('reveal-1.0');
    await ev('__h.frames(60)'); await snap('reveal-2.0', true);
    await ev('__h.frames(60)'); await snap('reveal-3.0');
    await ev('__h.frames(120)'); await snap('reveal-5.0');
    await ev('APP.leave(); __h.frames(20)'); await snap('collect-20');
    await ev(`__h.until('entering', 120); __h.frames(30)`); await snap('next-enter-30');
  },
});

/** A forced fake: reveals one tier low, glitches, upgrades to the real tier. */
const fake = card => ({
  name: 'fake-upgrade',
  async run({ ev, snap }) {
    await ev(`APP.forceFake = true; APP.forceCard = ${JSON.stringify(card)}; __h.frames(70); APP.beginHold(); true`);
    await ev(`__h.until('hitstop', 300); __h.until('revealed', 120); APP.endHold(); __h.frames(30)`); await snap('fake-reveal-0.5');
    await ev(`__h.until('upgrading', 300); __h.frames(45)`); await snap('upgrading-45');
    await ev(`__h.until('hitstop', 200); __h.until('revealed', 120); __h.frames(30)`); await snap('final-0.5', true);
    await ev('__h.frames(120)'); await snap('final-2.5');
  },
});

/** Collect one card per slot (cycling tiers), watch FULL SET, then empty the bag. */
const fullset = tiers => ({
  name: 'fullset',
  async run({ ev, snap }) {
    const cards = await ev('__h.cards()');
    const slots = [...new Set(cards.map(c => c.slot))];
    for (let i = 0; i < slots.length; i++) {
      const mine = cards.filter(c => c.slot === slots[i]);
      const want = tiers[i % tiers.length], pick = mine.find(c => c.tier === want) || mine[0];
      await ev(`__h.until('idle', 400); APP.forceFake = false; APP.forceCard = ${JSON.stringify(pick.id)}; APP.beginHold(); true`);
      await ev(`__h.until('revealed', 400); APP.endHold(); __h.frames(120)`);
      if (i === 2) await snap('bag-3-revealed', true);
      await ev(`APP.leave(); __h.until('collecting', 10); __h.frames(50)`);
      if (i === 2) await snap('bag-3-arrived');
    }
    await ev('__h.frames(54)'); await snap('fullset-0.5', true);
    await ev('__h.frames(90)'); await snap('fullset-2.0');
    await ev(`__h.until('entering', 400); __h.frames(70)`); await snap('after-fullset-idle');
    // let React hide the button and the HUD observer re-fit the layout before stepping on
    await ev(`document.getElementById('reset').click(); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`, true);
    await ev('__h.frames(10)'); await snap('empty-bag', true);
  },
});

/** A 10-pull: sealed pack, charge, burst, the lower cards dealt, the best card's full reveal, the results screen. */
const pack = {
  name: 'pack',
  async run({ ev, snap }) {
    const settle = `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`;
    await ev(`APP.forceFake = false; document.querySelector('[aria-label="Cards per draw"] button:last-of-type').click(); ${settle}`, true);
    await ev('__h.frames(80)'); await snap('sealed', true);
    await ev('APP.beginHold(); __h.frames(70)'); await snap('charge-70');
    await ev(`__h.until('hitstop', 300); __h.until('entering', 120); __h.frames(6)`); await snap('burst');
    await ev(`__h.until('revealed', 200); __h.frames(24)`); await snap('card-1', true);
    await ev(`__h.until('collecting', 300); __h.frames(14)`); await snap('card-1-flight');
    await ev(`(() => { const P = APP.S.pack; for (let i = 0; i < 6000 && P.i < P.cards.length - 1; i++) __h.frames(1); return P.i; })()`);
    await ev(`__h.until('revealed', 300); __h.frames(150)`); await snap('best-2.5', true);
    await ev(`APP.leave(); __h.until('collecting', 5); __h.frames(60); ${settle}`, true);
    await new Promise(r => setTimeout(r, 1600)); // the results deal in on CSS time
    await snap('results', true);
    await ev(`document.querySelector('.pull-again').click(); ${settle}`, true);
    await ev(`__h.frames(100)`); await snap('next-pack-charging', true);
  },
};

/** Skip to best: the lower cards go straight into the bag after the first one. */
const packSkip = {
  name: 'pack-skip',
  async run({ ev, snap }) {
    await ev(`APP.forceFake = false; APP.pack(true); __h.frames(80); APP.beginHold(); __h.until('hitstop', 300); __h.until('revealed', 300); __h.frames(10); true`);
    await ev(`document.getElementById('again').click(); __h.frames(40)`); await snap('skipped', true);
    await ev(`__h.until('revealed', 300); __h.frames(60)`); await snap('best-1.0', true);
  },
};

export const SCENARIOS = {
  classic: [
    ...['COMMON', 'RARE', 'EPIC', 'LEGENDARY'].map(reveal),
    fake('SUN CROWN'),
    fullset(['']),
    pack, packSkip,
  ],
  'cl-team': [
    ...['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'].map(reveal),
    fake('albert-legendary-1'),
    fullset(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']),
    pack, packSkip,
  ],
};
