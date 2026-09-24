import type { Vault } from '../../context';
import { bay, RAMPU, U32 } from '../../palette';
import { TIERS } from '../../tiers';
import { clamp, mulberry, TAU } from '../../util';

/**
 * The cyber theme's void: a night city in the tier's ramp. Dithered sky that brightens toward
 * the horizon, a striped sun behind the card (a scan ring on EPIC+, bright bands on LEGENDARY),
 * a far skyline and a near one with lit windows; antenna beacons and a few stars twinkle.
 */
export function paintCyberVoid(V: Vault, r: number) {
  const { L, S, U } = V, { W, HY, CX, CY } = L, T = TIERS[r], rp = RAMPU[T.ramp], VOID32 = U.VOID32;
  const rng = mulberry(S.seed * 13 + 5), sx = CX, sy = CY - 6, R0 = Math.round(clamp(Math.min(W, HY) * .22, 18, 42));
  const stars: [number, number, number][] = []; U.VOIDSTARS = stars;
  // two skylines: roof height per column (far is lower and paler, near is taller and black)
  const far = new Int16Array(W), near = new Int16Array(W), nearId = new Int16Array(W), ant = new Int16Array(W).fill(HY), lit = new Map<number, number>();
  for (let x = 0, id = 0; x < W; id++) { const w = 5 + Math.floor(rng() * 10), h = Math.round(HY * (.18 + rng() * .3)); for (let k = 0; k < w && x < W; k++, x++) far[x] = HY - h; }
  for (let x = 0, id = 0; x < W; id++) { const w = 8 + Math.floor(rng() * 14), h = Math.round(HY * (.08 + rng() * (Math.abs(x - CX) < 40 ? .16 : .34)));
    const ax = rng() < .35 ? x + Math.floor(w / 2) : -1;
    for (let k = 0; k < w && x < W; k++, x++) { near[x] = HY - h; nearId[x] = id; }
    lit.set(id, rng());
    if (ax >= 0 && ax < W) { ant[ax] = HY - h - 3 - Math.floor(rng() * 6); stars.push([ax, ant[ax], rng() * TAU]); } }
  const winKeys = ['y', 'o', 'e', 'q', 'i'];
  for (let y = 0; y < HY; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, b = bay(x, y), dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy);
    if (y >= ant[x] && y < near[x]) { VOID32[i] = U32.k; continue; } // antenna
    if (y >= near[x]) { // near buildings: black, window grid, some lit
      const lx = x % 3, ly = (y - near[x]) % 4, on = lx === 1 && ly === 2 && y > near[x] + 2 && y < HY - 2 && rng() < lit.get(nearId[x])! * .7;
      VOID32[i] = on ? U32[winKeys[Math.floor(rng() * winKeys.length)]] : y === near[x] ? rp[1] : U32.k;
      if (on && rng() < .04) stars.push([x, y, rng() * TAU]);
      continue; }
    if (y >= far[x]) { const win = (x % 2 === 0) && ((y - far[x]) % 3 === 1) && rng() < .12; VOID32[i] = win ? rp[3] : y === far[x] ? rp[2] : rp[1]; continue; }
    if (d < R0) { // sun: bright crown, bands cut out of its lower half, widening toward the bottom
      const low = dy / R0, band = low > -.1 && ((Math.floor(dy) % 5 + 5) % 5) < Math.round(1 + low * 2.4);
      if (band && !(T.voidSpiral && (Math.floor(dy) % 5 + 5) % 5 === 0)) { VOID32[i] = rp[2]; continue; }
      const l = d > R0 - 1.2 ? 6 : clamp(Math.floor(6.4 - (low + 1) * 1.6 + b * 1.1), 3, 6); VOID32[i] = rp[l]; continue; }
    // sky: dark at the top, glowing toward the horizon and around the sun
    let v = Math.pow(y / HY, 1.6) * .75 + Math.max(0, 1 - (d - R0) / (R0 * 1.4)) ** 2 * .6;
    if (T.voidHalo && Math.abs(d - R0 * 1.45) < 1 && dy < R0 * .3) v += .6;
    const l = clamp(Math.floor(v * 4.2 + b - .5), 0, 4); VOID32[i] = rp[l];
    if (l <= 1 && rng() < .006) { VOID32[i] = U32[rng() < .5 ? 'w' : '4']; stars.push([x, y, rng() * TAU]); }
  }
}
