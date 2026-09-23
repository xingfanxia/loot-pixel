export interface Rarity {
  name: string;
  /** light / dark / extra-dark palette keys */
  l: string; d: string; x: string;
  ramp: string;
  title: string[];
  spark: number; rays: number; spin: number; sparkle: number;
  odds: number;
  bars: [number, number];
  hitstop: number; coins: number; glow: number;
}

export const RAR: Rarity[] = [
  {name:'COMMON',    l:'s', d:'S', x:'D', ramp:'s', title:['w','c','s','S','D'], spark:50,  rays:0,   spin:0, sparkle:0,  odds:.50, bars:[.15,.45], hitstop:.1,  coins:0,  glow:.45},
  {name:'RARE',      l:'t', d:'T', x:'U', ramp:'t', title:['w','i','t','T','U'], spark:90,  rays:.38, spin:1, sparkle:2,  odds:.28, bars:[.35,.65], hitstop:.14, coins:8,  glow:.7},
  {name:'EPIC',      l:'v', d:'V', x:'V', ramp:'v', title:['w','m','v','V','V'], spark:140, rays:.5,  spin:2, sparkle:5,  odds:.15, bars:[.55,.85], hitstop:.2,  coins:22, glow:.8},
  {name:'LEGENDARY', l:'y', d:'Y', x:'R', ramp:'y', title:['w','o','y','Y','R'], spark:210, rays:.46, spin:3, sparkle:10, odds:.07, bars:[.8,1],    hitstop:.3,  coins:60, glow:1.02},
];

export interface PoolCard { r: number; name: string; spr: string }

export const POOL: PoolCard[] = [
  {r:0, name:'SLIME', spr:'slime'}, {r:0, name:'POTION', spr:'potion'}, {r:0, name:'OLD SHIELD', spr:'shield'},
  {r:1, name:'FROST GEM', spr:'gem'}, {r:1, name:'SKY KEY', spr:'key'},
  {r:2, name:'RUNE SWORD', spr:'sword'}, {r:2, name:'DRAGON EGG', spr:'egg'},
  {r:3, name:'SUN CROWN', spr:'crown'}, {r:3, name:'GOLDEN ORB', spr:'orb'},
];

/** Labels for the "next card" picker; -1 is a weighted random draw. */
export const FORCE_OPTIONS = [
  { value: -1, label: 'Random' },
  { value: 0, label: 'Common' },
  { value: 1, label: 'Rare' },
  { value: 2, label: 'Epic' },
  { value: 3, label: 'Legend' },
] as const;
