import type { Vault } from './context';
import type { CardGeo } from './geometry';
import { PAL, RAMPS } from './palette';
import { gy, sparks } from './particles';
import { TIERS } from './tiers';
import { ri, rnd, type Ctx2D } from './util';

/** Link positions along the four corner-to-hub chain paths (skipping the padlock). [x, y, odd] */
export function chainLinks(G: CardGeo): [number,number,number][][]{
  return G.chains.map(path=>{ const out: [number,number,number][]=[]; let k=0;
    for(let s=0;s<path.length-1;s++){ const [x0,y0]=path[s], [x1,y1]=path[s+1], L=Math.hypot(x1-x0,y1-y0), n=Math.floor(L/3.3);
      for(let j=s?1:0;j<=n;j++,k++){ const u=j/n, px=x0+(x1-x0)*u, py=y0+(y1-y0)*u; if (Math.hypot(px-G.hubX,py-G.hubY)<8) continue; out.push([Math.round(px),Math.round(py),k%2]); } }
    return out; });
}
/** A chain's two ends. */
const ends=(G: CardGeo, i: number)=>{ const p=G.chains[i]; return [p[0], p[p.length-1]]; };

function chainCols(V: Vault, c: number): [string,string,string]{ const rp=RAMPS[TIERS[V.S.tease].ramp]; return c>.25 ? [rp[4], c>.62?'w':rp[5], rp[3]] : V.theme.keys.chain; }

/** Chains and padlock over the card back; links rattle and heat to the teased tier as the charge rises. */
export function drawChains(V: Vault, x: Ctx2D){
  const { S, geo: G } = V, LINKS=V.K.chainLinks;
  const c=S.phase==='idle'?S.charge:0, [base,hi,lo]=chainCols(V, c);
  for(let si=0;si<4;si++){ if(!S.chains[si]) continue; const [[x0,y0],[x1,y1]]=ends(G,si), nx=-(y1-y0), ny=x1-x0, nl=Math.hypot(nx,ny);
    for (const [lx,ly,odd] of LINKS[si]){ let jx=lx, jy=ly; if (c>.25 && Math.random()<c*.55){ const o=ri(-1,1); jx+=Math.round(nx/nl*o); jy+=Math.round(ny/nl*o); }
      if (!odd){ x.fillStyle=PAL.k; x.fillRect(jx,jy,3,3); x.fillStyle=PAL[base]; x.fillRect(jx-1,jy-1,3,1); x.fillRect(jx-1,jy+1,3,1); x.fillRect(jx-1,jy,1,1); x.fillRect(jx+1,jy,1,1); x.fillStyle=PAL[hi]; x.fillRect(jx-1,jy-1,1,1); }
      else { x.fillStyle=PAL.k; x.fillRect(jx,jy+1,2,1); x.fillStyle=PAL[lo]; x.fillRect(jx,jy,2,1); x.fillStyle=PAL[hi]; x.fillRect(jx,jy,1,1); } } }
  if (S.lockOn){ const sh=c>.2&&Math.random()<c?ri(-1,1):0, flash=c>.8&&Math.floor(S.rt*14)%2; x.drawImage(flash?V.spr.lockWhite:V.spr.lock, G.lockX+sh, G.lockY+(c>.5?ri(-1,0):0)); }
}

/** Breaks chain i: its links fly off as bodies, with sparks, a snap and a kick. */
export function snapChain(V: Vault, i: number){ const { S, geo: G, env } = V; if (!S.chains[i]) return; S.chains[i]=false;
  const ox=S.cx-G.hw, oy=S.cy-G.hh, [[x0,y0],[x1,y1]]=ends(G,i), outx=(x0+x1)/2-G.hw, outy=(y0+y1)/2-G.hh, ol=Math.hypot(outx,outy)||1;
  for (const [lx,ly,odd] of V.K.chainLinks[i]) V.FX.links.push({x:ox+lx, y:oy+ly, vx:outx/ol*rnd(40,150)+rnd(-30,30), vy:outy/ol*rnd(20,80)-rnd(60,160), g:gy(V), age:0, life:rnd(3,5), odd, rest:false});
  sparks(V, 20, S.teaseKey, 40, 170, .4, ox+G.hw+Math.round(outx*.25), oy+G.hh+Math.round(outy*.25), true); V.A.snap(); S.trauma=Math.min(1,S.trauma+.22); S.sq.v-=1.5*env.MOTION; env.buzz(20); }
