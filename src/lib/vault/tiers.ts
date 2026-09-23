/**
 * The rarity ladder. Every reveal effect reads its strength from this table, so a tier only
 * gets an effect when its row turns it on, and each row escalates on the one before it.
 * A deck picks which of these tiers it uses (see decks/types.ts); the numbers for COMMON,
 * RARE, EPIC and LEGENDARY are the original four-tier values (formulas kept as written so
 * the classic deck stays bit-identical), UNCOMMON sits between COMMON and RARE.
 * One inherited exception to the escalation: LEGENDARY's resting god-ray strength (.46) is a
 * touch below EPIC's (.5), as in the original build; raising it would change classic reveals.
 */
export type TierId = 0 | 1 | 2 | 3 | 4;
export type TierName = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface TierAudio {
  /** reveal jingle (MIDI, null = rest), note length and start delay after the boom */
  mel: (number | null)[]; step: number; delay: number;
  bass: (number | null)[] | null;
  /** extra noise crunches inside the boom */
  crunch: number;
  /** high arpeggio after the jingle (note count, start time), or null */
  twinkle: { n: number; at: number } | null;
  /** base note of the tease arpeggio when a charge teases up to this tier */
  tease: number;
  /** wall-break rumble length (s) */
  rumble: number;
}

export interface Tier {
  id: TierId; name: string; key: TierName; short: string;
  /** light / dark / extra-dark palette keys, light ramp, title letter ramp */
  l: string; d: string; x: string; ramp: string; title: string[];
  /** reveal spark count, god-ray strength, full spins, art sparkles, stat-bar range */
  spark: number; rays: number; spin: number; sparkle: number; bars: [number, number];
  hitstop: number; coins: number; glow: number;
  /** reveal screen shake, foil glint on the face */
  trauma: number; foil: number;
  /** lightning bolts on reveal, extra shock rings (0..2), confetti burst */
  bolts: number; rings: number; confetti: { n: number; keys: string[] } | null;
  /** slow-motion seconds, sky beam, aftershock sparks (0 = no aftershock), aftershock confetti+coins */
  slowmo: number; beam: number; after: number; afterBurst: boolean;
  /** ambient bolts per second while revealed, coins on a spin, sparks when a stat bar lands */
  zap: number; fidgetCoins: number; barSparks: number;
  /** letterbox while charging, colour-cycling rim */
  letterbox: boolean; cycleRim: boolean;
  /** wall-break reach (fraction of the wall, Infinity = all), portal halo ring, portal spiral */
  reach: number; voidHalo: boolean; voidSpiral: boolean;
  /** chance a draw of this tier first shows the deck's tier below, then upgrades */
  fake: number;
  /** sparks and bolts when a charge teases up to this tier */
  tease: { sparks: number; bolts: number };
  audio: TierAudio;
}

export const TIERS: readonly Tier[] = [
  { id: 0, name: 'COMMON', key: 'common', short: 'Common', l: 's', d: 'S', x: 'D', ramp: 's', title: ['w','c','s','S','D'],
    spark: 50, rays: 0, spin: 0, sparkle: 0, bars: [.15, .45], hitstop: .1, coins: 0, glow: .45,
    trauma: .62+0*.13, foil: .5, bolts: 0, rings: 0, confetti: null,
    slowmo: 0, beam: 0, after: 0, afterBurst: false, zap: 0, fidgetCoins: 0, barSparks: 10+0*4,
    letterbox: false, cycleRim: false, reach: .42, voidHalo: false, voidSpiral: false, fake: 0,
    tease: { sparks: 34, bolts: 1 },
    audio: { mel: [72,76,79,84], step: .065, delay: .14, bass: null, crunch: 8+0*4, twinkle: null, tease: 69, rumble: 1.6+0*.5 } },
  { id: 1, name: 'UNCOMMON', key: 'uncommon', short: 'Uncommon', l: 'g', d: 'G', x: 'G', ramp: 'g', title: ['w','l','g','G','G'],
    spark: 70, rays: .22, spin: 0, sparkle: 1, bars: [.25, .55], hitstop: .12, coins: 3, glow: .58,
    trauma: .62+.5*.13, foil: .7, bolts: 2, rings: 0, confetti: null,
    slowmo: 0, beam: 0, after: 0, afterBurst: false, zap: 0, fidgetCoins: 0, barSparks: 10+.5*4,
    letterbox: false, cycleRim: false, reach: .49, voidHalo: false, voidSpiral: false, fake: 0,
    tease: { sparks: 34+.5*14, bolts: 1 },
    audio: { mel: [72,76,79,84,null,88], step: .065, delay: .14, bass: null, crunch: 10, twinkle: null, tease: 69, rumble: 1.6+.5*.5 } },
  { id: 2, name: 'RARE', key: 'rare', short: 'Rare', l: 't', d: 'T', x: 'U', ramp: 't', title: ['w','i','t','T','U'],
    spark: 90, rays: .38, spin: 1, sparkle: 2, bars: [.35, .65], hitstop: .14, coins: 8, glow: .7,
    trauma: .62+1*.13, foil: .9, bolts: 2+1*2, rings: 0, confetti: null,
    slowmo: 0, beam: 0, after: 40+1*20, afterBurst: false, zap: 0, fidgetCoins: 0, barSparks: 10+1*4,
    letterbox: false, cycleRim: false, reach: .56, voidHalo: false, voidSpiral: false, fake: 0,
    tease: { sparks: 34+1*14, bolts: 1+1 },
    audio: { mel: [67,72,76,79,84,88], step: .065, delay: .14, bass: [48,null,55], crunch: 8+1*4, twinkle: null, tease: 72, rumble: 1.6+1*.5 } },
  { id: 3, name: 'EPIC', key: 'epic', short: 'Epic', l: 'v', d: 'V', x: 'V', ramp: 'v', title: ['w','m','v','V','V'],
    spark: 140, rays: .5, spin: 2, sparkle: 5, bars: [.55, .85], hitstop: .2, coins: 22, glow: .8,
    trauma: .62+2*.13, foil: .9, bolts: 2+2*2, rings: 1, confetti: { n: 90, keys: ['v','m','V','w','t'] },
    slowmo: .3, beam: 1.4, after: 40+2*20, afterBurst: false, zap: .8, fidgetCoins: 3, barSparks: 10+2*4,
    letterbox: true, cycleRim: false, reach: .76, voidHalo: true, voidSpiral: false, fake: .3,
    tease: { sparks: 34+2*14, bolts: 1+2 },
    audio: { mel: [69,73,76,81,null,83,85,88,null,93], step: .065, delay: .14, bass: [45,null,52,null,57,null,52], crunch: 8+2*4, twinkle: null, tease: 76, rumble: 1.6+2*.5 } },
  { id: 4, name: 'LEGENDARY', key: 'legendary', short: 'Legend', l: 'y', d: 'Y', x: 'R', ramp: 'y', title: ['w','o','y','Y','R'],
    spark: 210, rays: .46, spin: 3, sparkle: 10, bars: [.8, 1], hitstop: .3, coins: 60, glow: 1.02,
    trauma: .62+3*.13, foil: .9, bolts: 2+3*2, rings: 2, confetti: { n: 170, keys: ['y','o','Y','w','r'] },
    slowmo: .72, beam: 1.4, after: 40+3*20, afterBurst: true, zap: 1.6, fidgetCoins: 3, barSparks: 10+3*4,
    letterbox: true, cycleRim: true, reach: Infinity, voidHalo: true, voidSpiral: true, fake: .45,
    tease: { sparks: 34+3*14, bolts: 1+3 },
    audio: { mel: [76,79,84,null,86,88,null,91,null,null,88,91,96,null,100], step: .08, delay: .3,
      bass: [48,null,55,null,60,null,55,null,48,null,43,null,48], crunch: 8+3*4, twinkle: { n: 20, at: 1.4 }, tease: 79, rumble: 1.6+3*.5 } },
];

export const tierByKey = (key: string): Tier | undefined => TIERS.find(t => t.key === key);

/** Charge levels at which the back teases up one step, by number of steps above the base tier. */
export const TEASE_AT: Record<number, number[]> = { 1: [.6], 2: [.45, .8], 3: [.38, .62, .85], 4: [.3, .5, .68, .86] };
