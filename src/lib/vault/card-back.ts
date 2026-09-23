import { drawChains } from './chains';
import type { Vault } from './context';
import { drawCracks } from './cracks';
import type { Emblem } from './decks/types';
import { drawText } from './font';
import { bay, PAL } from './palette';
import type { Ctx2D } from './util';

/** Static card back: navy crosshatch, gold frames, corner studs, then the "?" diamond or the deck emblem. */
export function buildBackBase(V: Vault){
  const x=V.B.backG, G=V.geo, CWd=G.w, CHd=G.h; x.clearRect(0,0,CWd,CHd);
  x.fillStyle=PAL[1]; x.fillRect(1,1,CWd-2,CHd-2);
  for(let yy=2;yy<CHd-2;yy++) for(let xx=2;xx<CWd-2;xx++){ const a=((xx+yy)%8===0)||((xx-yy+800)%8===0); if (a){ x.fillStyle=PAL[2]; x.fillRect(xx,yy,1,1); } else if (bay(xx,yy)< (yy/CHd)*.35){ x.fillStyle=PAL[0]; x.fillRect(xx,yy,1,1); } }
  x.fillStyle=PAL.k; x.fillRect(2,0,CWd-4,1); x.fillRect(2,CHd-1,CWd-4,1); x.fillRect(0,2,1,CHd-4); x.fillRect(CWd-1,2,1,CHd-4); x.fillRect(1,1,1,1); x.fillRect(CWd-2,1,1,1); x.fillRect(1,CHd-2,1,1); x.fillRect(CWd-2,CHd-2,1,1);
  x.fillStyle=PAL.c; x.fillRect(2,1,CWd-4,1); x.fillRect(1,2,1,CHd-4); x.fillStyle=PAL[4]; x.fillRect(2,CHd-2,CWd-4,1); x.fillRect(CWd-2,2,1,CHd-4);
  const frame=(a: number,col: string,sh: string)=>{ x.fillStyle=PAL[col]; x.fillRect(a,a,CWd-2*a,1); x.fillRect(a,a,1,CHd-2*a); x.fillStyle=PAL[sh]; x.fillRect(a,CHd-1-a,CWd-2*a,1); x.fillRect(CWd-1-a,a,1,CHd-2*a); };
  frame(4,'o','Y'); frame(5,'y','R'); frame(7,'Y','d');
  for (const [a,b] of [[4,4],[CWd-9,4],[4,CHd-9],[CWd-9,CHd-9]]){ x.fillStyle=PAL.k; x.fillRect(a,b,5,5); x.fillStyle=PAL.y; x.fillRect(a+1,b+1,3,3); x.fillStyle=PAL.o; x.fillRect(a+1,b+1,1,1); x.fillStyle=PAL.Y; x.fillRect(a+3,b+3,1,1); x.fillStyle=PAL.r; x.fillRect(a+2,b+2,1,1); }
  const cx=G.backCx, cy=G.backCy, R=G.emblemR;
  if (V.deck.emblem) drawEmblem(x, V.deck.emblem, cx, cy);
  else {
    for(let yy=-R;yy<=R;yy++) for(let xx=-R;xx<=R;xx++){ const d=Math.abs(xx)+Math.abs(yy); if (d>R) continue; let col;
      if (d===R) col='k'; else if (d>=R-2) col = (xx<0||yy<0) ? (d===R-1?'o':'y') : (d===R-1?'Y':'y'); else if (d===R-3) col='k'; else col = bay(xx+40,yy+40) < (1-d/(R-3))*.8 ? '5' : '3';
      x.fillStyle=PAL[col]; x.fillRect(cx+xx,cy+yy,1,1); }
    drawText(x,'?',cx-5+1,cy-10+2,4,'k'); drawText(x,'?',cx-5,cy-10,4,'y'); x.fillStyle=PAL.o; x.fillRect(cx-5,cy-10,4,2); x.fillRect(cx-1,cy+6,4,1); x.fillStyle=PAL.Y; x.fillRect(cx+3,cy-4,4,2);
  }
  for (const [sx,sy] of G.glints){ x.fillStyle=PAL.y; x.fillRect(sx,sy-1,1,3); x.fillRect(sx-1,sy,3,1); x.fillStyle=PAL.o; x.fillRect(sx,sy,1,1); }
  V.K.backBase=x.getImageData(0,0,CWd,CHd);
}

/**
 * A 1-bit mask in the gold ramp: a dark dithered disc behind it, a black outline, then each lit
 * pixel bevelled (edges facing up/left catch the light, edges facing down/right fall into shadow).
 */
function drawEmblem(x: Ctx2D, e: Emblem, cx: number, cy: number){
  const n=e.rows.length, m=e.rows[0].length, x0=cx-(m>>1), y0=cy-(n>>1), R=Math.min(m,n)/2;
  const on=(i: number,j: number)=>j>=0&&j<n&&i>=0&&i<m&&e.rows[j][i]==='#';
  for(let j=0;j<n;j++) for(let i=0;i<m;i++){ const d=Math.hypot(i-(m-1)/2,j-(n-1)/2); if (d>R-1.5) continue;
    x.fillStyle=PAL[bay(i,j)<(1-d/R)*.7?'2':'1']; x.fillRect(x0+i,y0+j,1,1); }
  for(let j=-1;j<=n;j++) for(let i=-1;i<=m;i++){ if (on(i,j)) continue; let near=false; for(let b=-1;b<=1&&!near;b++) for(let a=-1;a<=1;a++) if (on(i+a,j+b)){ near=true; break; }
    if (near){ x.fillStyle=PAL.k; x.fillRect(x0+i,y0+j,1,1); } }
  for(let j=0;j<n;j++) for(let i=0;i<m;i++){ if (!on(i,j)) continue;
    const col=!on(i,j-1)||!on(i-1,j) ? 'o' : !on(i,j+1)||!on(i+1,j) ? 'Y' : 'y'; x.fillStyle=PAL[col]; x.fillRect(x0+i,y0+j,1,1); }
}

/** Animated back: base image, sweeping shine band, one twinkling glint, cracks, chains. */
export function drawBack(V: Vault, t: number){
  const { backG } = V.B, G=V.geo, CWd=G.w, CHd=G.h, base=V.K.backBase!;
  const img=new ImageData(new Uint8ClampedArray(base.data), CWd, CHd), d=img.data, band=((t*42)%180)-50;
  for(let yy=2;yy<CHd-2;yy++){ const bx=Math.round(band-yy*.6); for(let xx=bx;xx<bx+4;xx++){ if(xx<2||xx>=CWd-2) continue; const o=(yy*CWd+xx)*4; const k=xx===bx||xx===bx+3?40:80; d[o]=Math.min(255,d[o]+k); d[o+1]=Math.min(255,d[o+1]+k); d[o+2]=Math.min(255,d[o+2]+k*.8); } }
  backG.putImageData(img,0,0);
  const gl=Math.floor(t*1.5)%4, [gx,gy]=G.glints[gl], ph=(t*1.5)%1; if (ph<.4){ const s=ph<.13?1:ph<.26?2:1; backG.fillStyle=PAL.w; backG.fillRect(gx-s,gy,2*s+1,1); backG.fillRect(gx,gy-s,1,2*s+1); }
  drawCracks(backG, V.K.backCracks, V.S.teaseKey);
  drawChains(V, backG);
}

/** Summon-in dissolve: pixels appear bottom-up through a Bayer threshold with a white leading edge. */
export function dissolve(V: Vault, src: HTMLCanvasElement, p: number){ const { dissC, dissG } = V.B, CWd=V.geo.w, CHd=V.geo.h, img=src.getContext('2d')!.getImageData(0,0,CWd,CHd), d=img.data;
  for(let y=0;y<CHd;y++) for(let x=0;x<CWd;x++){ const o=(y*CWd+x)*4; if (!d[o+3]) continue; const th=bay(x,y)*.3+(1-y/CHd)*.7; if (th>p) d[o+3]=0; else if (th>p-.07){ d[o]=255; d[o+1]=255; d[o+2]=255; } }
  dissG.putImageData(img,0,0); return dissC; }
