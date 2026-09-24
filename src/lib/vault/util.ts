export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const ri = (a: number, b: number) => Math.floor(rnd(a, b + 1));

/** Seeded PRNG so layouts, cracks and art backgrounds are reproducible per seed. */
export function mulberry(a: number) {
  return function () {
    a |= 0; a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export type Ctx2D = CanvasRenderingContext2D;

/** Offscreen canvas with smoothing off; `read` keeps it in CPU memory for per-frame getImageData (no GPU readback stall). */
export function mk(w: number, h: number, read = false): [HTMLCanvasElement, Ctx2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', read ? { willReadFrequently: true } : undefined)!; x.imageSmoothingEnabled = false;
  return [c, x];
}
