import type { Theme } from '../types';
import { buildCyberBack, cyberArtBg, cyberChrome, cyberFrame, cyberOverArt, cyberPortrait } from './card';
import { buildCyberScene, cyberEmissive, drawNeon, drawRain, flicker } from './scene';
import { paintCyberVoid } from './void';

/** Chip-lock padlock: steel shackle, cyan screen with a keyhole (11x13). */
const LOCK = ["...kkkkk...","..ksSSSsk..",".ksk...ksk.",".ksk...ksk.",".ksk...ksk.","kkkkkkkkkkk","kEEEEEEEEEk","kEeeeeeeeEk","kEeeekeeeEk","kEeekkkeeEk","kEeeekeeeEk","kEEEEEEEEEk","kkkkkkkkkkk"];

/**
 * Compute-hall cyberpunk: a server room lit by a cyan and a pink neon tube, a graphics card for an
 * altar whose fans spin up as you charge, a night city behind the wall, circuit-board card backs,
 * chamfered neon card frames, portraits rim-lit in the lamp colours.
 */
export const cyber: Theme = {
  id: 'cyber', label: 'Cyber',
  ramps: { base: 'steel', lamps: ['cyan', 'pink'] },
  lampLevel: (V, i) => (.84 + .04 * Math.sin(V.S.t * 50 + i)) * flicker(V.S.t, i),
  buildScene: buildCyberScene,
  paintVoid: paintCyberVoid,
  emissive: cyberEmissive,
  drawLamps: drawNeon,
  drawWorld: drawRain,
  flames: false,
  keys: { coin: ['i', 'e', 'E'], summon: ['e', 'q', 'i'], chain: ['D', 'S', '1'], edge: ['E', 'e'], impact: ['k', 'e'] },
  lock: LOCK,
  buildBack: buildCyberBack,
  face: { artBg: cyberArtBg, frame: cyberFrame, portrait: cyberPortrait, overArt: cyberOverArt, chrome: cyberChrome },
  hud: { hold: 'HOLD TO OVERCLOCK', auto: 'SPINNING UP', splitTitle: ['e', 'q'] },
  audio: { ambient: 'hum', crackle: 'data' },
};
