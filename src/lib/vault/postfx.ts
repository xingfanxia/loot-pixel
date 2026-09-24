import type { Vault } from './context';
import { BAYER, PAL } from './palette';
import { line } from './particles';
import { clamp, ri, rnd, TAU } from './util';

/** Wet-floor reflection: dithered, wobbling copy of bright pixels above the horizon onto floor pixels. */
export function reflect(V: Vault, ox: number,oy: number){
  const { L, U, S } = V, g=V.B.g, { W, H, HY, NARROW } = L;
  const hy=HY+oy, sc32=U.scene32; if (hy>=H-2 || !sc32) return;
  const img=g.getImageData(0,0,W,H), d=new Uint32Array(img.data.buffer), T=S.t, span=H-hy;
  for(let y=Math.max(0,hy+1);y<H;y++){ const dist=y-hy, sy=Math.round(hy-1-dist*1.45); if (sy<0) break; const str=(NARROW?.36:.5)*(1-dist/span); if (str<.04) continue;
    const wob=dist>3?Math.round(Math.sin(y*.85+T*2.4)):0, by=(y&3)*4, row=y*W, srow=sy*W, scy=y-oy; if (scy<0||scy>=H) continue;
    for(let x=0;x<W;x++){ if (BAYER[by+(x&3)]>=str) continue; const scx=x-ox; if (scx<0||scx>=W) continue; const si=scy*W+scx; if (U.UNIT[si]<0) continue; const cur=d[row+x]; if (cur!==sc32[si]) continue;
      const xs=x+wob; if (xs<0||xs>=W) continue; const src=d[srow+xs]; const lc=(cur&255)+((cur>>>8)&255)+((cur>>>16)&255), ls=(src&255)+((src>>>8)&255)+((src>>>16)&255); if (ls>lc+140) d[row+x]=src; } }
  g.putImageData(img,0,0);
}

/** Hitstop frames: inverted flash, then a two-tone speed-line silhouette with a zoomed punch-in. */
export function renderImpact(V: Vault, ox: number,oy: number){
  const { S, L, B, env, geo: G } = V, { g, layerC, silC, silG, cv } = B, { W, H, NARROW } = L;
  const e=1-S.hitstop/S.hitstopDur;
  if (e<.22){ g.drawImage(layerC,0,0); g.globalCompositeOperation='difference'; g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.globalCompositeOperation='source-over'; }
  else { const dark=e<.66, [kd,kl]=V.theme.keys.impact, bgc=dark?PAL[kd]:PAL[kl], fg=dark?PAL[kl]:PAL[kd]; g.fillStyle=bgc; g.fillRect(0,0,W,H);
    g.fillStyle=fg; const Rm=Math.hypot(W,H); for(let i=0;i<46;i++){ const a=Math.random()*TAU, r0=rnd(52*G.k,80*G.k), r1=Rm; line(g,S.cx+Math.cos(a)*r0,S.cy+Math.sin(a)*r0,S.cx+Math.cos(a)*r1,S.cy+Math.sin(a)*r1); if (i%3===0) line(g,S.cx+Math.cos(a)*r0+1,S.cy+Math.sin(a)*r0,S.cx+Math.cos(a)*r1+1,S.cy+Math.sin(a)*r1); }
    silG.clearRect(0,0,W,H); silG.drawImage(layerC,0,0); silG.globalCompositeOperation='source-in'; silG.fillStyle=fg; silG.fillRect(0,0,W,H); silG.globalCompositeOperation='source-over';
    g.drawImage(silC,0,0); g.fillStyle=fg; for(let i=0;i<3;i++){ const r=Math.round((60+e*80+i*14)*G.k); for(let a=0;a<TAU;a+=.05){ if (Math.random()<.5) g.fillRect(Math.round(S.cx+Math.cos(a)*r),Math.round(S.cy+Math.sin(a)*r),1,1); } }
    if (!env.reduce && !NARROW){ const hw=Math.ceil(W/2), hh=Math.ceil(H/2), sx=Math.round(clamp(S.cx-W/4,0,W-hw)), sy=Math.round(clamp(S.cy-H/4,0,H-hh)); silG.clearRect(0,0,W,H); silG.drawImage(cv,0,0); g.drawImage(silC,sx,sy,hw,hh,0,0,hw*2,hh*2); } }
  bloomCopy(V); env.els.stage.style.transform=`scale(${S.zoom.x.toFixed(4)})`;
}

/** Chromatic aberration (reveal) and horizontal tearing (upgrade glitch). */
export function postFX(V: Vault){
  const { S, L, B, env } = V, g=B.g, { W, H } = L;
  const k=Math.round(S.ca*3*env.MOTION), gl=S.glitch;
  if (k<1 && gl<.05) return;
  const img=g.getImageData(0,0,W,H), d=img.data, src=new Uint8ClampedArray(d);
  for(let y=0;y<H;y++){ const tear = gl>.05 && Math.random()<gl*.08 ? ri(-6,6) : 0; const row=y*W;
    for(let x=0;x<W;x++){ const o=(row+x)*4; const xr=clamp(x+k+tear,0,W-1), xb=clamp(x-k+tear,0,W-1), xg=clamp(x+tear,0,W-1);
      d[o]=src[(row+xr)*4]; d[o+1]=src[(row+xg)*4+1]; d[o+2]=src[(row+xb)*4+2]; } }
  g.putImageData(img,0,0);
}

/** Half-res copy for the CSS bloom layer. */
export function bloomCopy(V: Vault){ const { bg, bloomC, cv } = V.B; bg.imageSmoothingEnabled=true; bg.clearRect(0,0,bloomC.width,bloomC.height); bg.drawImage(cv,0,0,bloomC.width,bloomC.height); }
