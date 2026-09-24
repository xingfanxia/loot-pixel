import type { ChipAudio } from './audio';
import type { CardAssets } from './art';
import type { BagState } from './bag';
import type { CrackTier } from './cracks';
import type { Deck, DeckCard } from './decks/types';
import type { CardGeo } from './geometry';
import type { FxStore } from './particles';
import type { SceneUnits } from './scene';
import type { SpriteSheet } from './sprites';
import type { TierId } from './tiers';
import type { Ctx2D } from './util';

export interface VaultElements {
  stage: HTMLDivElement; screen: HTMLCanvasElement; bloom: HTMLCanvasElement; crt: HTMLDivElement;
  hit: HTMLButtonElement; again: HTMLButtonElement; hud: HTMLDivElement; live: HTMLDivElement;
  /** optional transparent button laid over the bag row (opens the collection) */
  bag?: HTMLButtonElement;
}
export interface VaultHooks {
  onBagComplete?: (complete: boolean) => void;
  onError?: (message: string) => void;
}

/** Debug / test handles, exposed as window.APP like the original single-file build. */
export interface DebugHandles { paused?: boolean; noR?: boolean; forceCard?: string; forceFake?: boolean; [k: string]: unknown }
declare global { interface Window { APP?: DebugHandles; __ready?: boolean } }

/** Viewport-derived scene layout in logical pixels (recomputed on resize). */
export interface Layout {
  SC: number; W: number; H: number; TS: number; NARROW: boolean;
  CX: number; CY: number; HY: number; PTOP: number; PBASE: number; GMIN: number; GMAX: number;
  TOP: number; HUDTOP: number; SLOT: number; BAGY: number; TORCH: { x: number; y: number }[];
  /** bag slots per row, and the bag's total height (one or two rows) */
  BAGCOLS: number; BAGH: number;
  /** the HUD moved while the scene was busy: re-fit at the next calm tick */
  STALE: boolean;
  /** row of the variant caption: under the altar, above the "Draw another" button */
  CAPY: number;
}

export type Phase = 'entering' | 'idle' | 'hitstop' | 'revealed' | 'upgrading' | 'collecting';
export interface Spec extends DeckCard { seed: number; idx: number }
interface Title { text: string; t0: number; ramp: string[] | null; quake: number }
interface Stamp { text: string; key: string; t0: number }
interface Caption { text: string; key: string; t0: number }
/** Fly-to-bag animation: target offset + scale, slot index `i`, deck card index `card`. */
interface Collect { t: number; tx: number; ty: number; s1: number; dir: number; done: boolean; i: number; card: number }
interface Spring { x: number; v: number }

export function createState(nBars: number) {
  const bars = () => new Array<number>(nBars).fill(0);
  return { phase: 'entering' as Phase, t: 0, rt: 0, ts: 1, slowmo: 0, charge: 0, holding: false, auto: false, downAt: 0, reached: [0, 0, 0, 0],
    /** tier the back currently teases (tier id) and how many ladder steps it has climbed */
    tease: 0 as TierId, teaseStep: 0, teaseKey: 's', beat: 0,
    /** real tier, visible tier (differs during a fake), forced tier (-1 = random) */
    r: -1, vr: -1, spec: null as Spec | null, face: null as DeckCard | null, fake: false, upgrading: false, up: 0, force: -1, seed: 1, backOn: true,
    pos: { x: 0, y: 0, vy: 0 }, landed: false, sq: { x: 0, v: 0 } as Spring, spin: { a: 0, from: 0, to: 0, t: 1, dur: 1 }, pulse: 0, tilt: { x: 0, y: 0 }, ptr: { nx: 0, ny: 0, last: -9 },
    trauma: 0, flash: 0, flashKey: 'w', rays: 0, raysT: 0, rayAng: 0, glow: 0, box: 0, zoom: { x: 1, v: 0 } as Spring, amb: .3, cardI: .5, cardIT: .5, lightKey: 's', beam: 0, torchBoost: 0,
    hitstop: 0, hitstopDur: 1, after: -1, bars: bars(), barT: bars(), barFlash: bars(), barDone: bars().map(() => 1), barTarget: bars(),
    title: null as Title | null, stamp: null as Stamp | null, caption: null as Caption | null, glitch: 0, hidden: false, col: null as Collect | null, pending: null as { i: number; isNew: boolean } | null,
    zapAcc: 0, suckAcc: 0, sparkAcc: 0, flameAcc: 0, ca: 0, chains: [true, true, true, true], lockOn: true, wall: { active: false, rebuild: false, t: 0, rt: 0, r: 0 },
    summon: 0, summonChime: false, popT0: -9, crk: 0, artStars: [] as [number, number, number][], colSpin: 0, cx: 0, cy: 0, colScale: 1 };
}
export type GameState = ReturnType<typeof createState>;

/** Offscreen canvases. Card-sized ones follow the deck layout; W x H ones follow the viewport. */
export interface Buffers {
  cv: HTMLCanvasElement; g: Ctx2D; bloomC: HTMLCanvasElement; bg: Ctx2D;
  brC: HTMLCanvasElement; brG: Ctx2D; dissC: HTMLCanvasElement; dissG: Ctx2D; backC: HTMLCanvasElement; backG: Ctx2D;
  frontC: HTMLCanvasElement; frontG: Ctx2D; tmpC: HTMLCanvasElement; tmpG: Ctx2D; artC: HTMLCanvasElement; artG: Ctx2D;
  t1C: HTMLCanvasElement; t1G: Ctx2D; tileSrcC: HTMLCanvasElement; tileSrcG: Ctx2D; rotC: HTMLCanvasElement; rotG: Ctx2D;
  layerC: HTMLCanvasElement; layerG: Ctx2D; silC: HTMLCanvasElement; silG: Ctx2D;
  patCache: Map<string, CanvasPattern>;
}

/** Card visuals: the static back image, the two crack sets (reseeded per draw) and the chain links. */
export interface CardState { backBase: ImageData | null; backCracks: CrackTier[]; frontCracks: CrackTier[]; chainLinks: [number, number, number][][] }

export interface Env {
  els: VaultElements; hooks: VaultHooks; APP: DebugHandles; signal: AbortSignal;
  reduce: boolean; MOTION: number;
  /** setTimeout that dies with the vault */
  later: (ms: number, f: () => void) => void;
  buzz: (p: number | number[]) => void;
}

/** Everything one running vault owns; every engine module takes this. */
export interface Vault {
  env: Env; L: Layout; S: GameState; FX: FxStore; U: SceneUnits; B: Buffers; K: CardState;
  A: ChipAudio; spr: SpriteSheet;
  deck: Deck; geo: CardGeo;
  /** the deck's tier ids, low to high */
  ladder: TierId[];
  art: Map<string, CardAssets>;
  bag: BagState;
}

/** Position of a tier in the deck's ladder (0 = the deck's lowest tier). */
export const rankOf = (V: Vault, tier: number) => V.ladder.indexOf(tier as TierId);

/** How taut the card is right now: the charge while held, the upgrade glitch while upgrading. */
export const tens = (V: Vault) => V.S.phase === 'idle' ? V.S.charge : V.S.phase === 'upgrading' ? V.S.up : 0;
