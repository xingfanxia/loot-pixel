import { pat } from './card3d';
import type { Vault } from './context';
import { PAL, RAMPS } from './palette';
import { line } from './particles';
import { TIERS } from './tiers';
import { TAU } from './util';

function drawCoin(V: Vault, x: number,y: number,ph: number){ const g=V.B.g, f=Math.floor(ph)%4, sw=[1,.6,.18,.6][f], [hi,mid,lo]=V.theme.keys.coin; x=Math.round(x); y=Math.round(y);
  for(let yy=-3;yy<=2;yy++){ const hw=Math.max(0,Math.round(Math.sqrt(9-(yy+.5)*(yy+.5))*sw)); const l=x-hw, w=hw*2+1;
    g.fillStyle=PAL.k; g.fillRect(l-1,y+yy,w+2,1); if (yy===-3||yy===2){ g.fillRect(l,y+yy-(yy<0?1:-1),w,1); }
    g.fillStyle=PAL[yy<=-2?hi:yy>=1?lo:mid]; g.fillRect(l,y+yy,w,1); if (w>=5 && yy>-2 && yy<1){ g.fillStyle=PAL[lo]; g.fillRect(x,y+yy,1,1); g.fillStyle=PAL[hi]; g.fillRect(l,y+yy,1,1); } } }

/** The vault theme's lamps: torch halos, three dithered discs that flicker and flare with torchBoost. */
export function drawTorches(V: Vault, ox: number, oy: number){ const { S, L } = V, g=V.B.g;
  for (const t of L.TORCH){ const fl=1+.15*Math.sin(S.t*13)+S.torchBoost*.6, x=t.x+ox, y=t.y-3+oy; for(const [r,k,l] of [[Math.round(7*fl),'Y',.35],[Math.round(4*fl),'y',.6],[2,'o',.9]] as [number,string,number][]){ g.fillStyle=pat(V,g,k,l); for(let yy=-r;yy<=r;yy++){ const hw=Math.round(Math.sqrt(r*r-yy*yy)); g.fillRect(x-hw,y+yy,hw*2+1,1); } } } }

/** Everything behind the card: lit dust, altar shadow, coins, void stars, fallen wall, links, summoning ring, lamps, sucks, theme extras. */
export function drawWorld(V: Vault, ox: number, oy: number, c: number){
  const { S, L, FX, U, geo: G, spr, theme } = V, g=V.B.g, { CX, PTOP, TORCH } = L, [chain, chainHi]=theme.keys.chain, [ring, ringDot, orbit]=theme.keys.summon;
  // dust motes (lit)
  for (const p of FX.dust){ const x=Math.round(p.x)+ox, y=Math.round(p.y)+oy, d=Math.hypot(p.x-S.cx,p.y-S.cy); const lit=S.cardI*2200/(2200+d*d) + (Math.min(...TORCH.map(t=>Math.hypot(p.x-t.x,p.y-t.y)))<30?.6:0); if (lit<.25) continue; g.fillStyle=PAL[lit>.9?(RAMPS[S.lightKey]||RAMPS.s)[6]:lit>.5?(RAMPS[S.lightKey]||RAMPS.s)[5]:'5']; g.fillRect(x,y,1,1); }
  // shadow on altar
  if (!S.hidden && S.phase!=='collecting'){ const air=S.phase==='entering'?S.summon:1; const sw=Math.round(G.shadowW*air*(1-c*.25)*Math.max(.3,Math.abs(Math.cos(S.spin.a)))); if (sw>2){ g.fillStyle=pat(V,g,'k',.7); g.fillRect(CX-Math.round(sw/2)+ox, PTOP+1+oy, sw, 2); g.fillStyle=pat(V,g,'k',.35); g.fillRect(CX-Math.round(sw/2)-3+ox, PTOP+3+oy, sw+6, 1); } }
  // floor stuff: coins
  for(const p of FX.coins){ const t=p.age/p.life; if (t>.85 && (Math.floor(p.age*20)&1)) continue; g.fillStyle=pat(V,g,'k',.6); g.fillRect(Math.round(p.x)-2+ox, Math.round(p.gy)+1+oy, 5, 1); drawCoin(V, p.x+ox, p.gy-p.h+oy-1, p.rest?(Math.floor(p.x*7)%3===0?1:0):p.ph); }
  // void stars twinkle through the broken wall
  if (S.wall.active){ for (const [x,y,ph] of U.VOIDSTARS){ const u=U.UNIT[y*L.W+x]; if (u<0||U.UST[u]!==2) continue; const tw=Math.sin(S.t*2.6+ph); if (tw<.55) continue; const X=x+ox, Y=y+oy; g.fillStyle=PAL.w; g.fillRect(X,Y,1,1);
      if (tw>.93){ g.fillStyle=PAL[(RAMPS[TIERS[S.wall.r].ramp])[5]]; g.fillRect(X-1,Y,1,1); g.fillRect(X+1,Y,1,1); g.fillRect(X,Y-1,1,1); g.fillRect(X,Y+1,1,1); } } }
  // falling bricks + dust
  const { brC, brG } = V.B;
  for(const p of FX.bricks){ const t=p.age/p.life; if (t>.88&&(Math.floor(p.age*20)&1)) continue; const X=Math.round(p.x)+ox, Y=Math.round(p.y)+oy, a=Math.round(p.rot*4)/4;
    if (p.rest || a===0){ g.drawImage(U.snapC,p.sx,p.sy,p.w,p.h,X-Math.floor(p.w/2),Y-Math.floor(p.h/2),p.w,p.h); if (p.rest){ g.fillStyle=PAL.k; g.fillRect(X-Math.floor(p.w/2),Y+Math.ceil(p.h/2),p.w,1); } }
    else { brG.setTransform(1,0,0,1,0,0); brG.clearRect(0,0,20,20); brG.translate(10,10); brG.rotate(a); brG.drawImage(U.snapC,p.sx,p.sy,p.w,p.h,-p.w/2,-p.h/2,p.w,p.h); g.drawImage(brC,X-10,Y-10); } }
  for(const p of FX.dustp){ const t=p.age/p.life; if (t>.6 && (Math.floor(p.age*24)&1)) continue; g.fillStyle=PAL[t<.4?'4':'5']; g.fillRect(Math.round(p.x)+ox,Math.round(p.y)+oy,t<.3?2:1,t<.3?2:1); }
  // broken chain links + padlock
  { const hotC=RAMPS[TIERS[S.tease].ramp][4];
    for(const p of FX.links){ const t=p.age/p.life; if (t>.85&&(Math.floor(p.age*20)&1)) continue; const x=Math.round(p.x)+ox, y=Math.round(p.y)+oy;
      if (p.lock){ g.fillStyle=pat(V,g,'k',.6); g.fillRect(x-5,Math.round(p.g)+1+oy,11,1); g.drawImage(!p.rest&&Math.floor(p.age*12)%2?spr.lockMirror:spr.lock, x-5, y-12); continue; }
      const hot=p.age<.6, col=hot?hotC:chain, hi=hot?'w':chainHi;
      if (p.odd){ g.fillStyle=PAL.k; g.fillRect(x,y+1,2,1); g.fillStyle=PAL[col]; g.fillRect(x,y,2,1); g.fillStyle=PAL[hi]; g.fillRect(x,y,1,1); }
      else { g.fillStyle=PAL.k; g.fillRect(x,y,3,3); g.fillStyle=PAL[col]; g.fillRect(x-1,y-1,3,1); g.fillRect(x-1,y+1,3,1); g.fillRect(x-1,y,1,1); g.fillRect(x+1,y,1,1); g.fillStyle=PAL[hi]; g.fillRect(x-1,y-1,1,1); } } }
  // summoning circle
  if (S.phase==='entering' && S.summon<1){ const sp=S.summon, fade=sp<.8?1:(1-sp)/.2, rx=Math.round(30*Math.min(1,sp*2.4)), ry=Math.max(1,Math.round(rx*.2)), cyc=PTOP-1+oy, arc=TAU*Math.min(1,sp*1.8);
    if (rx>2) for(let a=0;a<arc;a+=.6/rx){ if (Math.random()>fade) continue; const aa=a+S.t*1.6; g.fillStyle=PAL[(Math.floor(a*6)%5===0)?ringDot:ring]; g.fillRect(Math.round(CX+Math.cos(aa)*rx)+ox, Math.round(cyc+Math.sin(aa)*ry), 1, 1); }
    for(let k=0;k<8;k++){ const aa=k/8*TAU-S.t*2.2, rr=rx*.7; if (sp>.2+k*.05 && Math.random()<fade){ g.fillStyle=PAL[orbit]; g.fillRect(Math.round(CX+Math.cos(aa)*rr)+ox-1, Math.round(cyc+Math.sin(aa)*rr*.2), 2, 1); } } }
  // lamps + flames
  theme.drawLamps(V, ox, oy);
  for(const p of FX.flames){ const t=p.age/p.life, x=Math.round(p.x)+ox, y=Math.round(p.y)+oy;
    if (p.ember){ g.fillStyle=PAL[t<.5?'y':t<.8?'Y':'r']; g.fillRect(x,y,1,1); continue; }
    const k=t<.15?'w':t<.3?'o':t<.5?'y':t<.7?'Y':t<.85?'r':'R'; g.fillStyle=PAL[k]; const s=p.big?(t<.5?4:2):(t<.3?3:t<.6?2:1); g.fillRect(x-(s>>1),y-(s>>1),s,s); }
  // sucks
  for(const p of FX.sucks){ g.fillStyle=PAL[p.k]; line(g,p.px!+ox,p.py!+oy,p.x+ox,p.y+oy); }
  theme.drawWorld?.(V, ox, oy);
}
