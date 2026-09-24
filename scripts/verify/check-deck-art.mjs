#!/usr/bin/env node
/**
 * Asserts an image deck's art contract (docs/decks.md) with no npm deps:
 * - every slot in art/<deck>/characters.json has a slot file whose per-tier card counts match
 *   the characters.json tier counts, with unique n = 1..count per tier and a title;
 * - every card has public/decks/<deck>/<id>.png at the layout art size and <id>-icon.png at the
 *   icon size, plus art/<deck>/source/<id>.webp;
 * - every opaque pixel is exactly one PAL colour (parsed from src/lib/vault/palette.ts; plus the
 *   neon colours for a pack with "palette": "art+neon") and
 *   alpha is only 0 or 255;
 * - no PNG in public/decks/<deck>/ is left over from a card the slot files no longer list.
 *
 *   node scripts/verify/check-deck-art.mjs [--deck cl-team] [--art 64x72] [--icon 24]
 *
 * Sizes default to CL_TEAM_SIZE in src/lib/vault/decks/cl-team.ts. Exit 1 on any failure.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const DECK = args.deck || 'cl-team';
const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

function deckSize() {
  const src = readFileSync(join(ROOT, 'src/lib/vault/decks/cl-team.ts'), 'utf8');
  const m = src.match(/CL_TEAM_SIZE\s*=\s*\{\s*art:\s*\{\s*w:\s*(\d+),\s*h:\s*(\d+)\s*\},\s*icon:\s*(\d+)/);
  if (!m) throw new Error('cannot read CL_TEAM_SIZE from decks/cl-team.ts; pass --art WxH --icon N');
  return { w: +m[1], h: +m[2], icon: +m[3] };
}
const def = args.art && args.icon ? null : deckSize();
const [ART_W, ART_H] = args.art ? String(args.art).split('x').map(Number) : [def.w, def.h];
const ICON = args.icon ? Number(args.icon) : def.icon;

/** The art palette (the PAL literal); packs with "palette": "art+neon" also get the theme neon colours (Object.assign(PAL, ...)). */
function palette(neon) {
  const ts = readFileSync(join(ROOT, 'src/lib/vault/palette.ts'), 'utf8');
  const text = ts.match(/export const PAL[^;]+;/)[0] + (neon ? ts.match(/Object\.assign\(PAL,[^;]+;/)[0] : '');
  return new Set([...text.matchAll(/#([0-9a-f]{6})/gi)].map(m => parseInt(m[1], 16)));
}

/** Decodes an 8-bit non-interlaced RGBA PNG (what scripts/art/quantize.py writes). */
function readPng(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, depth = 0, type = 0, lace = 0; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), kind = buf.toString('latin1', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; lace = data[12]; }
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || type !== 6 || lace) throw new Error(`unsupported PNG (depth ${depth}, colour type ${type}, interlace ${lace}); expected 8-bit RGBA`);
  const raw = inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[row + x - bpp] : 0, b = y ? px[row + x - stride] : 0, c = x >= bpp && y ? px[row + x - stride - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[row + x] = v & 255;
    }
  }
  return { w, h, px };
}

function checkImage(path, w, h, problems) {
  if (!existsSync(path)) { problems.push(`missing ${path.slice(ROOT.length + 1)}`); return null; }
  let img;
  try { img = readPng(path); } catch (e) { problems.push(`${path.slice(ROOT.length + 1)}: ${e.message}`); return null; }
  const rel = path.slice(ROOT.length + 1);
  if (img.w !== w || img.h !== h) problems.push(`${rel}: ${img.w}x${img.h}, want ${w}x${h}`);
  let badA = 0, badC = 0, opaque = 0;
  for (let i = 0; i < img.px.length; i += 4) {
    const a = img.px[i + 3];
    if (a !== 0 && a !== 255) badA++;
    if (a === 0) continue;
    opaque++;
    if (!PAL.has(img.px[i] << 16 | img.px[i + 1] << 8 | img.px[i + 2])) badC++;
  }
  if (badA) problems.push(`${rel}: ${badA} pixels with alpha other than 0/255`);
  if (badC) problems.push(`${rel}: ${badC} opaque pixels outside PAL`);
  if (!opaque) problems.push(`${rel}: fully transparent`);
  return img;
}

const artDir = join(ROOT, 'art', DECK), pubDir = join(ROOT, 'public', 'decks', DECK);
const chars = JSON.parse(readFileSync(join(artDir, 'characters.json'), 'utf8'));
// a theme pack of the same team lists its people in the base pack
if (chars.base) chars.slots = JSON.parse(readFileSync(join(ROOT, 'art', chars.base, 'characters.json'), 'utf8')).slots;
const PAL = palette(chars.palette === 'art+neon');
const want = TIERS.map(t => chars.tiers?.[t]?.count ?? 0);
const problems = [], ids = new Set();
for (const s of chars.slots) {
  const file = join(artDir, 'slots', `${s.id}.json`);
  if (!existsSync(file)) { problems.push(`missing art/${DECK}/slots/${s.id}.json`); continue; }
  const slot = JSON.parse(readFileSync(file, 'utf8'));
  if (slot.id !== s.id) problems.push(`slots/${s.id}.json: id is ${JSON.stringify(slot.id)}`);
  TIERS.forEach((t, ti) => {
    const ns = slot.cards.filter(c => c.tier === t).map(c => c.n).sort((a, b) => a - b);
    const exp = Array.from({ length: want[ti] }, (_, i) => i + 1);
    if (ns.join() !== exp.join()) problems.push(`slots/${s.id}.json: ${t} n = [${ns}], want [${exp}]`);
  });
  for (const c of slot.cards) {
    if (!TIERS.includes(c.tier)) { problems.push(`slots/${s.id}.json: unknown tier ${c.tier}`); continue; }
    if (typeof c.title !== 'string' || !c.title.trim()) problems.push(`slots/${s.id}.json: ${c.tier}-${c.n} has no title`);
    const id = `${s.id}-${c.tier}-${c.n}`; ids.add(id);
    checkImage(join(pubDir, `${id}.png`), ART_W, ART_H, problems);
    checkImage(join(pubDir, `${id}-icon.png`), ICON, ICON, problems);
    if (!existsSync(join(artDir, 'source', `${id}.webp`))) problems.push(`missing art/${DECK}/source/${id}.webp`);
  }
}
const orphans = existsSync(pubDir) ? readdirSync(pubDir).filter(f => f.endsWith('.png') && !ids.has(f.replace(/(-icon)?\.png$/, ''))) : [];
for (const f of orphans) problems.push(`orphan public/decks/${DECK}/${f} (no card in the slot files)`);

console.log(`${DECK}: ${chars.slots.length} slots, ${ids.size} cards (want ${chars.slots.length * want.reduce((a, b) => a + b, 0)}), art ${ART_W}x${ART_H}, icon ${ICON}, ${PAL.size} PAL colours`);
if (problems.length) { console.log(`FAIL: ${problems.length} problems\n  ` + problems.join('\n  ')); process.exit(1); }
console.log(`OK: ${ids.size * 2} PNGs pass size, PAL-only and alpha 0/255; every card has a source webp; no orphans`);
