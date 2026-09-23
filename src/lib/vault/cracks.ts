import { PAL } from './palette';
import { mulberry, TAU, type Ctx2D } from './util';

/** One of four crack stages: random-walk paths revealed as the charge passes CRACK_AT[i]. */
export interface CrackTier { paths: [number,number][][]; shown: boolean; prog: number }

/** Seeded crack network radiating from (cx, cy), clipped to a w x h card. */
export function genCracks(seed: number, cx: number, cy: number, w: number, h: number): CrackTier[]{
  const rng=mulberry(seed), tiers: [number,number][][][]=[[],[],[],[]];
  function walk(x: number,y: number,a: number,len: number,tier: number,depth: number){ const pts: [number,number][]=[]; for(let i=0;i<len;i++){ a+=(rng()-.5)*.75; x+=Math.cos(a); y+=Math.sin(a); const px=Math.round(x), py=Math.round(y); if (px<2||py<2||px>w-3||py>h-3) break; pts.push([px,py]);
      if (depth<1 && rng()<.04) walk(x,y,a+(rng()<.5?-1:1)*(.6+rng()*.6),Math.floor(len*.4),Math.min(3,tier+1),depth+1); } tiers[tier].push(pts); }
  for(let i=0;i<7;i++){ const a=i/7*TAU+rng()*.5; walk(cx+Math.cos(a)*3,cy+Math.sin(a)*3,a,16+Math.floor(rng()*20),i%4,0); }
  return tiers.map(ps=>({paths:ps, shown:false, prog:0}));
}

export function drawCracks(x: Ctx2D, cracks: CrackTier[], col: string){ const all: [number,number][]=[]; cracks.forEach(t=>{ if(!t.shown) return; t.paths.forEach(p=>{ const n=Math.floor(p.length*Math.min(1,t.prog)); for(let i=0;i<n;i++) all.push(p[i]); }); });
  x.fillStyle=PAL[col]; for (const [px,py] of all){ x.fillRect(px+1,py,1,1); x.fillRect(px,py+1,1,1); }
  x.fillStyle=PAL.w; for (const [px,py] of all) x.fillRect(px,py,1,1); }
