#!/usr/bin/env node
/**
 * Derives the 1-bit Compute Labs mark used on the cl-team card back
 * (reference: scratch/media/team/refs/cl-logo-icon.png): a ring around an outer diamond whose
 * lower-left edge breaks just below the left vertex (the spiral step), a closed middle diamond
 * and a solid centre diamond. Diamonds are Manhattan-distance bands so the diagonals are clean
 * 2px pixel-art staircases. Prints the rows; paste them into src/lib/vault/decks/cl-mark.ts.
 *
 *   node scripts/verify/cl-mark-mask.mjs [size=37]
 */
const N = Number(process.argv[2] || 37), c = (N - 1) / 2, s = N / 37;
const ring = [15.9 * s, 18.05 * s], outer = [12 * s, 13 * s], middle = [6 * s, 7 * s], core = 2 * s, gap = [1, 2];
const rows = [];
for (let y = 0; y < N; y++) {
  let row = '';
  for (let x = 0; x < N; x++) {
    const dx = x - c, dy = y - c, r = Math.hypot(dx, dy), d = Math.abs(dx) + Math.abs(dy);
    let on = r >= ring[0] && r <= ring[1];
    if (d >= outer[0] && d <= outer[1] && !(dx < 0 && dy >= gap[0] && dy <= gap[1])) on = true;
    if (d >= middle[0] && d <= middle[1]) on = true;
    if (d <= core) on = true;
    row += on ? '#' : '.';
  }
  rows.push(row);
}
console.log(rows.map(r => `  '${r}',`).join('\n'));
