import { drawEmblem } from '../../card-back';
import { drawTitleBar } from '../../card-front';
import { pat } from '../../card3d';
import { rankOf, type Vault } from '../../context';
import { drawText, textW } from '../../font';
import { bay, PAL } from '../../palette';
import { TIERS } from '../../tiers';
import { mk, mulberry, TAU, type Ctx2D } from '../../util';
import { hash, RGB } from './scene';

/** Inside a w x h rect inset by `ins` whose corners are cut by `cut` px diagonals. */
const inChamfer = (i: number, j: number, w: number, h: number, ins: number, cut: number) =>
  i >= ins && j >= ins && i < w - ins && j < h - ins && Math.min(i - ins, w - 1 - ins - i) + Math.min(j - ins, h - 1 - ins - j) >= cut;

/** Paints the edge ring of a chamfered rect (pixels inside it with a 4-neighbour outside) through `col(i, j, n)`, n = perimeter step. */
function chamferRing(x: Ctx2D, w: number, h: number, ins: number, cut: number, col: (i: number, j: number) => string | null) {
  const on = (i: number, j: number) => inChamfer(i, j, w, h, ins, cut);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (on(i, j) && (!on(i - 1, j) || !on(i + 1, j) || !on(i, j - 1) || !on(i, j + 1))) { const k = col(i, j); if (k) { x.fillStyle = PAL[k]; x.fillRect(i, j, 1, 1); } }
}

/**
 * Card back as a circuit board: chamfered black outline, dark board, seeded traces with vias
 * running toward the centre, a neon cyan border with pink corner accents, gold contact fingers
 * along the bottom, then the deck emblem (or a "?" chip) in cyan.
 */
export function buildCyberBack(V: Vault) {
  const x = V.B.backG, G = V.geo, w = G.w, h = G.h, rng = mulberry(4242), cx = G.backCx, cy = G.backCy; x.clearRect(0, 0, w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (!inChamfer(i, j, w, h, 0, 4)) continue;
    x.fillStyle = PAL[!inChamfer(i, j, w, h, 1, 4) ? 'k' : bay(i, j) < (j / h) * .4 ? '1' : '0']; x.fillRect(i, j, 1, 1); }
  // traces: 45-degree random walks from the border inward, stopping short of the emblem
  const keep = Math.max(G.emblemR, V.deck.emblem ? V.deck.emblem.rows[0].length / 2 + 3 : 0) + 3, dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  for (let n = 0; n < 26; n++) {
    const side = n % 4, s = rng(); let px = side === 0 ? Math.round(6 + s * (w - 12)) : side === 1 ? w - 7 : side === 2 ? Math.round(6 + s * (w - 12)) : 6, py = side === 0 ? 6 : side === 1 ? Math.round(6 + s * (h - 18)) : side === 2 ? h - 14 : Math.round(6 + s * (h - 18));
    let d = Math.round(Math.atan2(cy - py, cx - px) / (TAU / 8) + 8) % 8, len = 6 + Math.floor(rng() * 22), bright = rng() < .25;
    for (let k = 0; k < len; k++) { if (rng() < .18) d = (d + (rng() < .5 ? 1 : 7)) % 8;
      const nx = px + dirs[d][0], ny = py + dirs[d][1]; if (nx < 6 || ny < 6 || nx > w - 7 || ny > h - 14 || Math.hypot(nx - cx, ny - cy) < keep) break;
      px = nx; py = ny; x.fillStyle = PAL[bright ? 'E' : '2']; x.fillRect(px, py, 1, 1); }
    x.fillStyle = PAL.k; x.fillRect(px - 1, py - 1, 3, 3); x.fillStyle = PAL[bright ? 'e' : 'E']; x.fillRect(px, py, 1, 1); }
  // two small chips with pins
  for (const [ix, iy] of [[8, 9], [w - 17, h - 26]]) { x.fillStyle = PAL.k; x.fillRect(ix, iy, 9, 6); x.fillStyle = PAL.D; x.fillRect(ix + 1, iy + 1, 7, 4); x.fillStyle = PAL['5']; x.fillRect(ix + 1, iy + 1, 7, 1);
    x.fillStyle = PAL.S; for (let k = 0; k < 4; k++) { x.fillRect(ix + 1 + k * 2, iy - 1, 1, 1); x.fillRect(ix + 1 + k * 2, iy + 6, 1, 1); } }
  // border: cyan line, pink accents on the cut corners
  chamferRing(x, w, h, 2, 3, (i, j) => (Math.min(i, w - 1 - i) + Math.min(j, h - 1 - j) < 8 ? 'q' : 'e'));
  chamferRing(x, w, h, 3, 3, () => 'E');
  // gold fingers (the card's edge connector), notched off-centre
  for (let i = 7; i < w - 7; i++) { if ((i - 7) % 3 === 2 || Math.abs(i - Math.round(w * .36)) < 2) continue;
    x.fillStyle = PAL.o; x.fillRect(i, h - 10, 1, 1); x.fillStyle = PAL.y; x.fillRect(i, h - 9, 1, 3); x.fillStyle = PAL.Y; x.fillRect(i, h - 6, 1, 1); }
  // emblem in a soft cyan glow
  const R = keep + 2; for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const d = Math.hypot(i, j) / R; if (d < 1 && bay(i + 40, j + 40) < (1 - d) * .45) { x.fillStyle = PAL[d < .55 ? 'E' : 'U']; x.fillRect(cx + i, cy + j, 1, 1); } }
  if (V.deck.emblem) drawEmblem(x, V.deck.emblem, cx, cy, ['0', '1', 'i', 'e', 'E']);
  else {
    const r = G.emblemR - 3; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = Math.abs(i) + Math.abs(j); if (d > r) continue;
      x.fillStyle = PAL[d === r ? 'k' : d >= r - 2 ? (i < 0 || j < 0 ? 'i' : 'E') : d === r - 3 ? 'k' : (i + j) % 4 === 0 ? '1' : '0']; x.fillRect(cx + i, cy + j, 1, 1); }
    drawText(x, '?', cx - 5 + 1, cy - 10 + 2, 4, 'k'); drawText(x, '?', cx - 5, cy - 10, 4, 'e'); x.fillStyle = PAL.i; x.fillRect(cx - 5, cy - 10, 4, 1);
  }
  for (const [sx, sy] of G.glints) { x.fillStyle = PAL.e; x.fillRect(sx, sy - 1, 1, 3); x.fillRect(sx - 1, sy, 3, 1); x.fillStyle = PAL.w; x.fillRect(sx, sy, 1, 1); }
  V.K.backBase = x.getImageData(0, 0, w, h);
}

/** Art backdrop: dark hologram field, a tier-coloured glow behind the head, a perspective grid floor, scanlines. */
export function cyberArtBg(V: Vault, vr: number) {
  const { S, geo: G } = V, R = TIERS[vr], x = V.B.artG, rng = mulberry(S.spec!.seed), aw = G.art.w, ah = G.art.h, hz = Math.round(ah * .62);
  for (let yy = 0; yy < ah; yy++) for (let xx = 0; xx < aw; xx++) {
    const dx = (xx - aw / 2) / (aw / 2), dy = (yy - G.bgCy) / G.bgRy, rad = Math.sqrt(dx * dx + dy * dy), b = bay(xx, yy);
    let k = b < (1 - rad) * .5 ? R.x : (yy & 1) ? '0' : 'k';
    if ((1 - rad) * .7 > b + .5) k = R.d;
    if (yy > hz) { const z = (yy - hz) / (ah - hz), gx = (xx - aw / 2) / (z + .08);
      if (Math.abs(((gx / 9) % 1 + 1) % 1 - .5) > .5 - .06 / (z + .1) || ((Math.sqrt(z) * 7) % 1) < .12) k = z > .45 ? R.d : R.x; }
    x.fillStyle = PAL[k]; x.fillRect(xx, yy, 1, 1); }
  x.fillStyle = PAL[R.d]; x.fillRect(0, hz, aw, 1);
  S.artStars = []; for (let i = 0; i < 16; i++) S.artStars.push([Math.floor(rng() * aw), Math.floor(rng() * G.starsH), rng() * TAU]);
}

const frames = new WeakMap<Vault, Map<number, HTMLCanvasElement>>();

/** Chamfered frame in the tier colours with ruler ticks and corner brackets (cached per tier); LEGENDARY's rim runs an RGB chase. */
export function cyberFrame(V: Vault, t: number) {
  const { geo: G, S } = V, x = V.B.frontG, w = G.w, h = G.h, vr = S.vr, R = TIERS[vr];
  let cache = frames.get(V); if (!cache) frames.set(V, cache = new Map());
  let c = cache.get(vr);
  if (!c) { const [cv, f] = mk(w, h); c = cv; cache.set(vr, c);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (!inChamfer(i, j, w, h, 0, 5)) continue;
      f.fillStyle = PAL[!inChamfer(i, j, w, h, 1, 5) ? 'k' : !inChamfer(i, j, w, h, 4, 3) ? R.d : !inChamfer(i, j, w, h, 5, 3) ? 'k' : '0']; f.fillRect(i, j, 1, 1); }
    chamferRing(f, w, h, 1, 5, (i, j) => (j < h / 2 && i < w / 2 ? 'w' : R.l));
    chamferRing(f, w, h, 3, 3, () => R.x);
    f.fillStyle = PAL[R.l]; for (let j = 12; j < h - 12; j += 6) { f.fillRect(2, j, 1, 1); f.fillRect(w - 3, j, 1, 1); }
    f.fillStyle = PAL.w; for (const [i, j] of [[3, 4], [4, 3], [w - 4, 4], [w - 5, 3], [3, h - 5], [4, h - 4], [w - 4, h - 5], [w - 5, h - 4]]) f.fillRect(i, j, 1, 1); }
  x.drawImage(c, 0, 0);
  if (R.cycleRim) chamferRing(x, w, h, 1, 5, (i, j) => RGB[((Math.floor((i + j) / 3 - t * 12) % RGB.length) + RGB.length) % RGB.length]);
}

const rims = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/** The art with split neon rim light: silhouette outline facing left glows cyan, facing right glows pink (matches the room's lamps). */
export function cyberPortrait(_V: Vault, art: HTMLCanvasElement) {
  let out = rims.get(art); if (out) return out;
  const w = art.width, h = art.height, src = art.getContext('2d')!.getImageData(0, 0, w, h), d = src.data, [cv, x] = mk(w, h); out = cv; rims.set(art, out);
  const clear = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] === 0;
  const K = [7, 6, 15]; // PAL.k
  const img = new ImageData(new Uint8ClampedArray(d), w, h), o = img.data, cyan = [0x2e, 0xe6, 0xff], pink = [0xff, 0x3d, 0x8b];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const p = (j * w + i) * 4; if (!d[p + 3] || d[p] !== K[0] || d[p + 1] !== K[1] || d[p + 2] !== K[2]) continue;
    const L = clear(i - 1, j), Rr = clear(i + 1, j), T = clear(i, j - 1); if (!L && !Rr && !T) continue;
    const col = L && !Rr ? cyan : Rr && !L ? pink : i < w / 2 ? cyan : pink; o[p] = col[0]; o[p + 1] = col[1]; o[p + 2] = col[2]; }
  x.putImageData(img, 0, 0); return out;
}

/** Over the art: a slow bright scan band, and now and then a one-frame slice glitch. */
export function cyberOverArt(V: Vault, t: number) {
  const x = V.B.frontG, a = V.geo.art;
  const by = a.y + Math.floor(((t * .45) % 1.4) / 1.4 * (a.h + 8)) - 4; x.fillStyle = pat(V, x, 'i', .2);
  for (let y = Math.max(a.y, by); y < Math.min(a.y + a.h, by + 3); y++) x.fillRect(a.x, y, a.w, 1);
  const b = Math.floor(t * 5); if (hash(b * 3.3) < .06) { const sy = a.y + Math.floor(hash(b) * (a.h - 3)), dx = hash(b * 1.7) < .5 ? -2 : 2;
    x.drawImage(V.B.frontC, a.x, sy, a.w, 2, a.x + dx, sy, a.w, 2); }
}

/** After the art: corner brackets, title bar, nameplate with a tier stripe, segmented power bars, a row of rank LEDs. */
export function cyberChrome(V: Vault, t: number) {
  const { S, geo: G } = V, x = V.B.frontG, a = G.art, R = TIERS[S.vr];
  x.fillStyle = PAL[R.l]; for (const [cx, cy, sx, sy] of [[a.x - 1, a.y - 1, 1, 1], [a.x + a.w, a.y - 1, -1, 1], [a.x - 1, a.y + a.h, 1, -1], [a.x + a.w, a.y + a.h, -1, -1]]) {
    x.fillRect(Math.min(cx, cx + sx * 4), cy, 5, 1); x.fillRect(cx, Math.min(cy, cy + sy * 4), 1, 5); }
  if (G.titleH) { drawTitleBar(V, R.l); x.fillStyle = PAL[R.d]; x.fillRect(a.x, G.titleY, 2, G.titleH); x.fillRect(a.x + a.w - 2, G.titleY, 2, G.titleH);
    if (Math.floor(t * 2) % 2) { x.fillStyle = PAL[R.l]; x.fillRect(a.x + a.w - 5, G.titleY + G.titleH - 4, 2, 2); } }
  const py = G.plateY; x.fillStyle = PAL[0]; x.fillRect(a.x, py, a.w, 10); x.fillStyle = PAL[R.d]; x.fillRect(a.x, py + 9, a.w, 1); x.fillStyle = PAL[R.l]; x.fillRect(a.x, py, 2, 10);
  const nm = S.spec!.name; drawText(x, nm, Math.round(G.hw - textW(nm, 1) / 2), py + 2, 1, 'i', 'k');
  G.bars.forEach((lb, k) => { const y = G.barY0 + k * 6; drawText(x, lb, a.x + 1, y, 1, 'S'); const bw = G.barW, bx = G.barX; x.fillStyle = PAL.k; x.fillRect(bx - 1, y, bw + 2, 5);
    const f = Math.round(bw * (S.bars[k] || 0)); for (let j = 0; j < bw; j++) { if (j % 3 === 2) continue; x.fillStyle = PAL[j < f ? (j >= f - 3 ? 'w' : R.l) : '1']; x.fillRect(bx + j, y + 1, 1, 3); }
    if (f > 0 && S.barFlash[k] > 0) { x.fillStyle = PAL.w; x.fillRect(bx + f - 2, y, 3, 5); } });
  const n = V.ladder.length, rk = rankOf(V, S.vr), gw = n * 6 - 2;
  for (let i = 0; i < n; i++) { const gx = Math.round(G.hw - gw / 2) + i * 6, gy = G.gemY, on = i <= rk; x.fillStyle = PAL.k; x.fillRect(gx - 1, gy - 1, 6, 5);
    x.fillStyle = PAL[on ? R.l : '1']; x.fillRect(gx, gy, 4, 3); if (on) { x.fillStyle = PAL.w; x.fillRect(gx, gy, 1, 1); } }
}
