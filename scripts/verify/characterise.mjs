#!/usr/bin/env node
/**
 * Deterministic characterisation of the vault engine.
 *
 * Launches the installed Chrome headless over the DevTools protocol (no npm deps), seeds
 * Math.random, replaces setTimeout with a virtual clock, pauses the rAF loop (window.APP.paused)
 * and drives the engine frame by frame through window.APP (force / beginHold / endHold / leave /
 * step). At fixed moments it records the logical #screen canvas (PNG + pixel hash) and layout /
 * state metrics. With --baseline it compares against an earlier run: metrics must match exactly
 * and every canvas hash must match; mismatches get a pixel-diff count and a diff PNG.
 *
 *   node scripts/verify/characterise.mjs --url http://localhost:3000 --deck classic [--theme cyber] \
 *        --out scratch/data/characterise/after [--baseline scratch/data/characterise/before]
 *        [--viewports desktop,wide,phone,small,tiny] [--only reveal-RARE,fullset] [--audio] [--chrome PATH]
 *
 * --audio keeps Web Audio enabled (not deterministic: ChipAudio throttles on audio time), so
 * use it to catch runtime errors, not for pixel comparison.
 * Exit code 1 on page errors or on any baseline mismatch.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SCENARIOS } from './scenarios.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const URL0 = args.url || 'http://localhost:3000';
const DECK = args.deck || 'classic';
const THEME = args.theme || null;
const OUT = resolve(args.out || `scratch/data/characterise/${DECK}-${Date.now()}`);
const BASE = args.baseline ? resolve(args.baseline) : null;
const AUDIO = !!args.audio;
const SEED = Number(args.seed || 1234);
const VIEWPORTS = { desktop: { width: 1280, height: 800 }, wide: { width: 1280, height: 900 }, phone: { width: 390, height: 844 }, small: { width: 360, height: 740 }, tiny: { width: 320, height: 568 } };
const vps = String(args.viewports || 'desktop,phone').split(',');
const only = args.only ? String(args.only).split(',') : null;
const CHROME = args.chrome || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* ---------------- tiny CDP client ---------------- */
async function launch() {
  const dir = mkdtempSync(join(tmpdir(), 'vault-cdp-'));
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required', '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) { await new Promise(r => setTimeout(r, 100));
    try { port = Number(readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch {} }
  if (!port) throw new Error('Chrome did not expose a DevTools port');
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(), listeners = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else if (m.method) listeners.forEach(l => l(m)); };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const close = () => { try { ws.close(); } catch {} proc.kill(); setTimeout(() => rmSync(dir, { recursive: true, force: true }), 500); };
  return { send, on: l => listeners.push(l), close };
}

/* Runs before any page script: seeded PRNG, virtual timers, paused loop, optional audio stub. */
const INIT = `(() => {
  let a = ${SEED};
  const rand = () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  Math.random = rand; window.__reseed = s => { a = s; };
  window.APP = { paused: true };
  const rs = window.setTimeout.bind(window), rc = window.clearTimeout.bind(window), q = []; let now = 0, ids = 1e7;
  window.__vt = { on: false, now: () => now, advance(ms) { now += ms; for (;;) { q.sort((x, y) => x.due - y.due || x.id - y.id); if (!q.length || q[0].due > now) break; const e = q.shift(); e.fn(...e.args); } } };
  window.setTimeout = (fn, ms, ...args) => { if (!window.__vt.on || typeof fn !== 'function') return rs(fn, ms, ...args); const id = ids++; q.push({ id, due: now + (ms || 0), fn, args }); return id; };
  window.clearTimeout = id => { const i = q.findIndex(e => e.id === id); if (i >= 0) q.splice(i, 1); else rc(id); };
  ${AUDIO ? '' : 'window.AudioContext = undefined; window.webkitAudioContext = undefined;'}
  try { localStorage.clear(); } catch {}
})();`;

/* Page-side helpers, installed after the engine reports ready. */
const HELPERS = `(() => {
  const DT = 1 / 60, cv = () => document.getElementById('screen');
  const fnv = d => { let h = 0x811c9dc5; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
  window.__h = {
    frames(n) { for (let i = 0; i < n; i++) { APP.step(DT); window.__vt.advance(DT * 1000); } return APP.S.phase; },
    until(phase, max) { for (let i = 0; i < max; i++) { if (APP.S.phase === phase) return i; this.frames(1); } throw new Error('timeout waiting for ' + phase + ' (at ' + APP.S.phase + ')'); },
    tier(name) { if (APP.deck) { const t = APP.deck.tiers.find(t => t.name === name); if (!t) throw new Error('deck has no tier ' + name); return t.id; }
      return { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3 }[name]; },
    cards() { if (APP.deck) return APP.deck.cards.map(c => ({ id: c.id, slot: c.slot, tier: c.tierName }));
      return ['SLIME','POTION','OLD SHIELD','FROST GEM','SKY KEY','RUNE SWORD','DRAGON EGG','SUN CROWN','GOLDEN ORB'].map((id, slot) => ({ id, slot, tier: '' })); },
    snap() {
      const c = cv(), g = c.getContext('2d'), px = new Uint32Array(g.getImageData(0, 0, c.width, c.height).data.buffer);
      const hit = document.getElementById('hit'), again = document.getElementById('again'), st = document.getElementById('stage'), S = APP.S;
      const fx = {}; for (const k in APP.FX) if (k !== 'dust') fx[k] = APP.FX[k].length;
      return { png: c.toDataURL('image/png'), hash: fnv(px), metrics: {
        canvas: [c.width, c.height, c.style.width, c.style.height],
        hit: [hit.style.left, hit.style.top, hit.style.width, hit.style.height], again: [again.style.left, again.style.top, again.classList.contains('show')],
        origin: st.style.transformOrigin, transform: st.style.transform, phase: S.phase, card: S.spec ? S.spec.name : null,
        cx: S.cx, cy: S.cy, live: document.getElementById('live').textContent, aria: hit.getAttribute('aria-label'),
        resetVisible: !document.getElementById('reset').hidden, fx } };
    },
  };
})();`;

/* In-page pixel diff between two PNG data URLs. */
const DIFF = `async (a, b) => {
  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [A, B] = await Promise.all([load(a), load(b)]);
  if (A.width !== B.width || A.height !== B.height) return { diff: -1, size: [A.width, A.height, B.width, B.height] };
  const c = document.createElement('canvas'); c.width = A.width; c.height = A.height; const g = c.getContext('2d');
  g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, c.width, c.height); g.clearRect(0, 0, c.width, c.height); g.drawImage(B, 0, 0);
  const db = g.getImageData(0, 0, c.width, c.height), out = g.createImageData(c.width, c.height); let n = 0;
  for (let i = 0; i < da.data.length; i += 4) { const same = da.data[i] === db.data[i] && da.data[i+1] === db.data[i+1] && da.data[i+2] === db.data[i+2];
    if (!same) n++; out.data[i] = same ? da.data[i] >> 2 : 255; out.data[i+1] = same ? da.data[i+1] >> 2 : 0; out.data[i+2] = same ? da.data[i+2] >> 2 : 0; out.data[i+3] = 255; }
  g.putImageData(out, 0, 0); return { diff: n, total: da.data.length / 4, png: c.toDataURL('image/png') };
}`;

async function main() {
  const cdp = await launch();
  const errors = [];
  cdp.on(m => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  });
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT });
  const ev = async (expr, awaitPromise = false) => { const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };

  const manifest = { url: URL0, deck: DECK, theme: THEME, seed: SEED, audio: AUDIO, when: new Date().toISOString(), snaps: {} };
  mkdirSync(OUT, { recursive: true });
  for (const vp of vps) {
    const size = VIEWPORTS[vp];
    await cdp.send('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 1, mobile: false });
    for (const sc of SCENARIOS[DECK] || SCENARIOS.classic) {
      if (only && !only.includes(sc.name)) continue;
      const dir = join(OUT, vp, sc.name); mkdirSync(dir, { recursive: true });
      const sep = URL0.includes('?') ? '&' : '?';
      await cdp.send('Page.navigate', { url: `${URL0}${sep}deck=${DECK}${THEME ? `&theme=${THEME}` : ''}` });
      for (let i = 0; i < 200; i++) { await new Promise(r => setTimeout(r, 50)); if (await ev('!!window.__ready && !!window.APP && !!window.APP.step').catch(() => false)) break; }
      await ev('document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))', true);
      await ev(HELPERS);
      // Fresh PRNG stream, then re-run layout so the dust field is seeded from it too.
      await ev(`window.__reseed(${SEED}); window.__vt.on = true; window.dispatchEvent(new Event('resize')); true`);
      const shots = [];
      const snap = async (label, page = false) => {
        const s = await ev('__h.snap()');
        writeFileSync(join(dir, `${label}.png`), Buffer.from(s.png.split(',')[1], 'base64'));
        if (page) { const p = await cdp.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(dir, `${label}.page.png`), Buffer.from(p.data, 'base64')); }
        shots.push({ label, hash: s.hash, metrics: s.metrics });
      };
      const t0 = Date.now();
      try { await sc.run({ ev, snap }); }
      catch (e) { errors.push(`${vp}/${sc.name}: ${e.message}`); }
      manifest.snaps[`${vp}/${sc.name}`] = shots;
      const err = await ev(`document.getElementById('err').textContent`).catch(() => '');
      if (err) errors.push(`${vp}/${sc.name}: #err ${err}`);
      console.log(`${vp}/${sc.name}: ${shots.length} snaps in ${Date.now() - t0}ms`);
    }
  }
  manifest.errors = errors;
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));

  let bad = errors.length;
  if (errors.length) console.log('PAGE ERRORS:\n  ' + errors.join('\n  '));
  if (BASE) {
    const base = JSON.parse(readFileSync(join(BASE, 'manifest.json'), 'utf8'));
    let same = 0, diffs = 0;
    for (const key of Object.keys(base.snaps)) {
      if (!manifest.snaps[key]) continue;
      for (const b of base.snaps[key]) {
        const a = manifest.snaps[key].find(s => s.label === b.label);
        if (!a) { console.log(`MISSING ${key}/${b.label}`); bad++; continue; }
        const mA = JSON.stringify(a.metrics), mB = JSON.stringify(b.metrics);
        if (mA !== mB) { bad++; console.log(`METRICS ${key}/${b.label}\n  base ${mB}\n  now  ${mA}`); }
        if (a.hash === b.hash) { same++; continue; }
        diffs++; bad++;
        const [vp, sc] = key.split('/'), pa = join(OUT, vp, sc, `${b.label}.png`), pb = join(BASE, vp, sc, `${b.label}.png`);
        const url = p => 'data:image/png;base64,' + readFileSync(p).toString('base64');
        const r = existsSync(pb) ? await ev(`(${DIFF})(${JSON.stringify(url(pb))}, ${JSON.stringify(url(pa))})`, true) : { diff: -2 };
        if (r.png) writeFileSync(join(OUT, vp, sc, `${b.label}.diff.png`), Buffer.from(r.png.split(',')[1], 'base64'));
        console.log(`PIXELS ${key}/${b.label}: ${r.diff} px differ${r.total ? ` of ${r.total}` : ''}`);
      }
    }
    console.log(`baseline compare: ${same} identical canvases, ${diffs} differing`);
  }
  cdp.close();
  console.log(`wrote ${OUT}`);
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(2); });
