import { pat } from '../../card3d';
import { tens, type Vault } from '../../context';
import { bay, PAL, RAMPU, U32 } from '../../palette';
import { sceneBuilder } from '../../scene';
import { TIERS } from '../../tiers';
import { clamp, mulberry, TAU } from '../../util';

/**
 * The cyber theme's room: a server hall. The wall is rack units (they fall when a reveal breaks
 * it), the floor a perspective grid whose seams glow in the nearest lamp's colour, the altar a
 * two-fan graphics card, and the lamps two neon tubes (cyan left, pink right). Everything that
 * glows is written into the lit scene each frame (emissive), so it also shows in the wet floor.
 */

/** Deterministic hash in [0, 1) for blink and flicker patterns (no Math.random, so runs repeat). */
export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** Neon tube flicker: now and then a tube drops out for a frame or two. */
export const flicker = (t: number, i: number) => hash(Math.floor(t * 14) * 7 + i * 131) < .035 ? .3 : 1;

interface Led { i: number; u: number; k: string; rate: number; ph: number }
interface Fan { r: number; px: [number, number, number, number][] }
interface Room { leds: Led[]; seams: Int32Array; seamW: Float32Array; fans: Fan[]; strip: [number, number, number]; fingers: number[]; fanA: number; lastT: number }
const rooms = new WeakMap<Vault, Room>();

/** Lamp colours, left then right: tube edge, tube core, halo dark, halo light. */
export const LAMP_KEYS = [['e', 'i', 'E', 'e'], ['q', 'p', 'Q', 'q']];
/** The RGB chase on the GPU strip, fan rings and the legendary card rim. */
export const RGB = ['r', 'Y', 'y', 'l', 'g', 't', 'e', 'u', 'v', 'm', 'q'];

export function buildCyberScene(V: Vault) {
  const { W, H, HY, CX, PTOP, PBASE, TORCH } = V.L;
  const rng = mulberry(91), { UNIT, OFF, PIXA, add, finish } = sceneBuilder(V, rng);
  const leds: Led[] = [], seams: number[] = [], seamW: number[] = [];
  // wall: 24px racks with 3px posts, stacked with 1U-3U servers (vents, drive bays or blank)
  const RW = 27;
  for (let cx0 = ((CX - 13) % RW) - RW; cx0 < W; cx0 += RW) {
    let y = 0;
    while (y < HY) {
      const hh = Math.min([4, 4, 6, 6, 8, 10][Math.floor(rng() * 6)], HY - y), ao = clamp((HY - (y + hh / 2)) / 20, 0, 1), kind = rng();
      const u = add(cx0 + RW / 2, y + hh / 2, (.5 + rng() * .28) * (.6 + .4 * ao), 1, cx0, y, RW, hh);
      for (let yy = y; yy < y + hh; yy++) for (let xx = Math.max(0, cx0); xx < Math.min(W, cx0 + RW); xx++) {
        const i = yy * W + xx, lx = xx - cx0, ly = yy - y; UNIT[i] = u; let o = 0;
        if (lx >= RW - 3) o = lx === RW - 3 ? -1 : -3;
        else if (ly === hh - 1) o = -2; else if (ly === 0) o = 1; else if (lx === 0) o = 1; else if (lx === RW - 4) o = -1;
        else if (kind < .45 && lx >= 3 && lx < RW - 10 && lx % 2 === 0) o = -1;
        else if (kind >= .45 && kind < .8 && (lx - 2) % 5 === 0) o = -1;
        OFF[i] = o; }
      const led = (lx: number, ly: number, k: string, rate: number) => { const x = cx0 + lx, yy = y + ly; if (x >= 0 && x < W && yy < HY) leds.push({ i: yy * W + x, u, k, rate, ph: rng() * 100 }); };
      if (hh >= 4) {
        if (kind < .45) { led(RW - 7, 1, 'g', 0); led(RW - 9, 1, rng() < .5 ? 'e' : 'y', 6 + rng() * 10); }
        else if (kind < .8) { for (let b = 0; b < 4; b++) led(4 + b * 5, hh - 2, rng() < .7 ? 'g' : 'e', rng() < .6 ? 3 + rng() * 12 : 0); }
        else led(RW - 7, 1, rng() < .08 ? 'r' : 'e', rng() < .5 ? 0 : 1 + rng() * 2);
      }
      y += hh;
    }
  }
  for (let x = 0; x < W; x++) { OFF[(HY - 1) * W + x] = -4; }
  // floor: perspective grid converging on a point above the horizon; seams glow
  const VY = HY - Math.max(40, Math.round((H - HY) * .9)), C = 12, depth = (y: number) => (y - VY) / (HY - VY);
  let y0 = HY, h = 3;
  while (y0 < H) {
    const hi = Math.max(3, Math.round(h)), tmap = new Map<number, number>(), far = clamp((y0 - HY) / 60, 0, 1);
    for (let y = y0; y < Math.min(H, y0 + hi); y++) { const ly = y - y0, cw = C * depth(y);
      for (let x = 0; x < W; x++) { const q = (x - CX) / cw + .5, col = Math.floor(q); let u = tmap.get(col);
        if (u === undefined) { u = add(CX + col * C * depth(y0 + hi / 2), y0 + hi / 2, (.4 + rng() * .1) * (.5 + .5 * far)); tmap.set(col, u); }
        const i = y * W + x; UNIT[i] = u;
        if (ly === hi - 1 || Math.floor((x + 1 - CX) / cw + .5) !== col) { OFF[i] = -2; seams.push(i); seamW.push(clamp(.3 + .7 * (y - HY) / Math.max(1, H - HY), 0, 1)); }
        else if (ly === 0) OFF[i] = 1; } }
    y0 += hi; h *= 1.24;
  }
  // altar: a graphics card on its side, shroud plate on top, two fans, heatsink fins, a plinth with gold fingers
  const slab = (x0: number, x1: number, y0: number, y1: number, a: number) => { for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) { if (x < 0 || x >= W || y < 0 || y >= H) continue; const i = y * W + x; UNIT[i] = -1;
      if (x === x0 - 1 || x === x1 + 1 || y === y0 - 1 || y === y1 + 1) { PIXA[i] = 0; continue; } let b = a; if (y === y0) b += .3; else if (y === y1) b -= .25; if (x === x0) b += .12; else if (x === x1) b -= .2; PIXA[i] = b; } };
  const bodyT = PTOP + 6, bodyB = PBASE - 5;
  slab(CX - 26, CX + 26, bodyT, bodyB, .5); slab(CX - 29, CX + 29, PBASE - 4, PBASE, .62); slab(CX - 31, CX + 31, PTOP, PTOP + 5, .78);
  for (let x = CX - 4; x <= CX + 4; x += 2) for (let y = bodyT + 1; y < bodyB; y++) PIXA[y * W + x] -= .16;
  const fr = Math.max(4, Math.floor((bodyB - bodyT) / 2) - 1), fy = Math.round((bodyT + bodyB) / 2), fans: Fan[] = [];
  for (const cx of [CX - 14, CX + 14]) { const px: Fan['px'] = [];
    for (let dy = -fr - 1; dy <= fr + 1; dy++) for (let dx = -fr - 1; dx <= fr + 1; dx++) { const d = Math.hypot(dx, dy), i = (fy + dy) * W + cx + dx;
      if (d < fr + 1.2) { PIXA[i] = d < fr ? .2 : 0; px.push([i, dx, dy, d]); } }
    fans.push({ r: fr, px }); }
  const fingers: number[] = []; for (let x = CX - 25; x <= CX + 25; x++) if ((x - CX + 25) % 3 !== 2 && Math.abs(x - CX + 9) > 1) fingers.push(x);
  // lamps: neon tubes in metal caps (the glass is drawn by drawNeon)
  for (const t of TORCH) {
    for (const [ya, yb] of [[t.y - 12, t.y - 11], [t.y + 6, t.y + 7]]) for (let y = ya; y <= yb; y++) for (let x = t.x - 2; x <= t.x + 2; x++) { if (x < 0 || x >= W || y < 0) continue; const i = y * W + x; UNIT[i] = -1; PIXA[i] = y === ya ? .9 : .55; }
    for (let y = t.y - 10; y <= t.y + 5; y++) for (let x = t.x - 1; x <= t.x + 1; x++) { if (x < 0 || x >= W || y < 0) continue; const i = y * W + x; UNIT[i] = -1; PIXA[i] = .05; }
  }
  finish();
  rooms.set(V, { leds, seams: Int32Array.from(seams), seamW: Float32Array.from(seamW), fans, strip: [CX - 27, CX + 27, PTOP + 3], fingers, fanA: 0, lastT: V.S.t });
}

/** Glowing bits into the lit scene: rack LEDs (busier while charging), floor seams, GPU strip, fans, gold fingers. */
export function cyberEmissive(V: Vault) {
  const R = rooms.get(V); if (!R) return;
  const { S, U, L } = V, { W, PBASE } = L, sc = U.scene32, t = S.t, c = tens(V), boost = S.torchBoost;
  const busy = 1 + 5 * c + 2 * boost;
  R.leds.forEach((d, n) => { if (U.UST[d.u] === 2) return; const on = d.rate === 0 || hash(Math.floor(t * d.rate * busy + d.ph) * 17 + n) > .45; if (on) sc[d.i] = U32[d.k]; });
  const lamps = [RAMPU.cyan, RAMPU.pink], glow = .45 + .45 * c + .35 * boost;
  for (let n = 0; n < R.seams.length; n++) { const i = R.seams[n], u = U.UNIT[i], x = i % W, y = (i / W) | 0, lv = R.seamW[n] * glow;
    if (lv < .16 || (lv < .3 && bay(x, y) > .5)) continue; sc[i] = lamps[U.ULAMP[u] ?? 0][lv > .85 ? 5 : lv > .6 ? 4 : lv > .35 ? 3 : 2]; }
  // RGB chase while idle, the revealed tier's colour after a reveal
  const shown = S.phase === 'revealed' || S.phase === 'collecting', tier = shown && S.vr >= 0 ? TIERS[S.vr] : null, speed = 8 + 40 * c;
  const rgb = (p: number) => tier ? (Math.floor(p / 3 + t * 6) % 4 === 0 ? tier.d : tier.l) : RGB[((Math.floor(p / 3 + t * speed / 3) % RGB.length) + RGB.length) % RGB.length];
  const [x0, x1, sy] = R.strip; for (let x = x0; x <= x1; x++) if (x >= 0 && x < W) sc[sy * W + x] = U32[rgb(x)];
  // fans spin up with the charge (and flat out on a reveal)
  const dt = Math.max(0, Math.min(.1, t - R.lastT)); R.lastT = t; R.fanA += dt * (3 + 38 * c + 24 * boost);
  for (const f of R.fans) for (const [i, dx, dy, d] of f.px) { const fr = f.r;
    if (d >= fr) { sc[i] = U32[rgb(Math.round((Math.atan2(dy, dx) + Math.PI) / TAU * 24) * 3)]; continue; }
    if (d < 1.6) { sc[i] = U32[d < .8 ? 'S' : 'D']; continue; }
    const a = ((Math.atan2(dy, dx) - R.fanA) % TAU + TAU) % TAU, blade = (a * 7 / TAU) % 1 < .42 + .1 * d / fr;
    sc[i] = U32[blade ? (dy < 0 ? '5' : 'D') : '0']; }
  for (const x of R.fingers) { sc[(PBASE - 3) * W + x] = U32.o; sc[(PBASE - 2) * W + x] = U32.y; sc[(PBASE - 1) * W + x] = U32.Y; }
}

/** Neon tubes and their halos, flaring on a reveal and dropping out now and then. */
export function drawNeon(V: Vault, ox: number, oy: number) {
  const { S, L } = V, g = V.B.g;
  L.TORCH.forEach((tp, i) => { const [edge, core, hd, hl] = LAMP_KEYS[i] ?? LAMP_KEYS[0], f = flicker(S.t, i), b = f * (1 + S.torchBoost * .5), x = tp.x + ox, cy = tp.y - 2 + oy;
    if (f === 1) for (const [rx, ry, k, lv] of [[Math.round(8 * b), Math.round(15 * b), hd, .3], [Math.round(4 * b), Math.round(11 * b), hl, .34]] as [number, number, string, number][]) {
      g.fillStyle = pat(V, g, k, lv); for (let yy = -ry; yy <= ry; yy++) { const hw = Math.round(rx * Math.sqrt(1 - (yy / ry) ** 2)); g.fillRect(x - hw, cy + yy, hw * 2 + 1, 1); } }
    const y0 = tp.y - 10 + oy, h = 16;
    g.fillStyle = PAL[f === 1 ? edge : hd]; g.fillRect(x - 1, y0, 3, h);
    g.fillStyle = PAL[f === 1 ? (S.torchBoost > .4 ? 'w' : core) : edge]; g.fillRect(x, y0, 1, h); });
}

/** Slanted rain over the city once the wall is down (only where the wall has fallen). */
export function drawRain(V: Vault, ox: number, oy: number) {
  const { S, L, U } = V; if (!S.wall.active) return;
  const g = V.B.g, { W, HY } = L, n = Math.round(W * HY / 420);
  for (let j = 0; j < n; j++) { const sp = 110 + 70 * hash(j), fall = hash(j * 7.7) * HY + S.t * sp, y = Math.floor(fall % HY), x = Math.floor((hash(j * 3.1) * W - fall * .25) % W + W) % W;
    for (let k = 0; k < 5; k++) { const yy = y - k, xx = x + (k >> 1); if (yy < 0 || xx >= W) break; const u = U.UNIT[yy * W + xx]; if (u < 0 || U.UST[u] !== 2) continue;
      g.fillStyle = PAL[k === 0 ? 'S' : '5']; g.fillRect(xx + ox, yy + oy, 1, 1); } }
}
