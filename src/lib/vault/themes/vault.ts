import { buildVaultBack } from '../card-back';
import { vaultArtBg, vaultChrome, vaultFrame } from '../card-front';
import { buildVaultScene } from '../scene';
import { PADLOCK } from '../sprites';
import { paintVaultVoid } from '../wall';
import { drawTorches } from '../world';
import type { Theme } from './types';

/** The original look: a torch-lit stone vault, a portal behind the wall, gold-trimmed cards. */
export const vault: Theme = {
  id: 'vault', label: 'Vault',
  ramps: { base: 'stone', lamps: ['warm', 'warm'] },
  // torch flicker (the random term keeps the single-file build's Math.random order)
  lampLevel: (V, i) => .78+.14*Math.sin(V.S.t*13+i*2)+.07*Math.sin(V.S.t*31+i)+(Math.random()-.5)*.05,
  buildScene: buildVaultScene,
  paintVoid: paintVaultVoid,
  drawLamps: drawTorches,
  flames: true,
  keys: { coin: ['o', 'y', 'Y'], summon: ['c', 'o', 'y'], chain: ['S', 's', 'D'], edge: ['Y', 'y'], impact: ['k', 'w'] },
  lock: PADLOCK,
  buildBack: buildVaultBack,
  face: { artBg: vaultArtBg, frame: vaultFrame, chrome: vaultChrome },
  hud: { hold: 'HOLD TO OPEN', auto: 'HERE IT COMES' },
  audio: { ambient: 'drone', crackle: 'fire' },
};
