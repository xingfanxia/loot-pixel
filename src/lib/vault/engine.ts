import { ChipAudio } from './audio';
import { loadBag, saveBag } from './bag';
import { POOL, RAR, type PoolCard } from './cards';
import { drawRampText, drawText, textW } from './font';
import { BAYER, bay, LIGHTEN, PAL, RAMPS, RAMPU, U32 } from './palette';
import { buildSprites } from './sprites';
import { clamp, lerp, mk, mulberry, ri, rnd, TAU, type Ctx2D } from './util';

export interface VaultElements {
  stage: HTMLDivElement; screen: HTMLCanvasElement; bloom: HTMLCanvasElement; crt: HTMLDivElement;
  hit: HTMLButtonElement; again: HTMLButtonElement; hud: HTMLDivElement; live: HTMLDivElement;
}
export interface VaultHooks {
  onBagComplete?: (complete: boolean) => void;
  onError?: (message: string) => void;
}
export interface VaultController {
  setForce(r: number): void;
  setSound(on: boolean): void;
  resetBag(): void;
  destroy(): void;
}

/** Debug / test handles, exposed as window.APP like the original single-file build. */
interface DebugHandles { paused?: boolean; noR?: boolean; forceCard?: string; forceFake?: boolean; [k: string]: unknown }
declare global { interface Window { APP?: DebugHandles; __ready?: boolean } }

/**
 * Boots the vault scene on the given DOM nodes. Everything lives in this closure so a
 * React unmount (or StrictMode's double mount) can tear it down cleanly via destroy().
 */
export function createVault(els: VaultElements, hooks: VaultHooks = {}): VaultController {
const abort=new AbortController(), timers=new Set<ReturnType<typeof setTimeout>>();
const later=(ms: number,f: ()=>void)=>{ const id=setTimeout(()=>{ timers.delete(id); if (!abort.signal.aborted) f(); },ms); timers.add(id); };
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches, MOTION=reduce?.3:1;
const APP: DebugHandles = window.APP ?? {};
const SPRITES=buildSprites(), A=new ChipAudio();
const buzz=(p: number|number[])=>{ try{ if(!reduce && A.ctx && navigator.vibrate) navigator.vibrate(p); }catch{} };

const cv=els.screen, g=cv.getContext('2d',{willReadFrequently:true})!, bloomC=els.bloom, bg=bloomC.getContext('2d')!, stage=els.stage;
const CWd=64, CHd=90, T1W=132, T1H=160;
const [brC,brG]=mk(20,20), [dissC,dissG]=mk(CWd,CHd), [backC,backG]=mk(CWd,CHd), [frontC,frontG]=mk(CWd,CHd), [tmpC,tmpG]=mk(CWd,CHd), [artC,artG]=mk(52,45), [t1C,t1G]=mk(T1W,T1H), [tileSrcC,tileSrcG]=mk(CWd,CHd), [rotC,rotG]=mk(16,16);
let layerC!: HTMLCanvasElement, layerG!: Ctx2D, silC!: HTMLCanvasElement, silG!: Ctx2D;
let NARROW=false, BAGY=4, SC=3, W=400, H=260, TS=4, CX=200, CY=110, HY=180, PTOP=160, PBASE=186, GMIN=190, GMAX=250, TOP=0, HUDTOP=250, SLOT=18, TORCH: {x:number,y:number}[]=[];
const patCache=new Map<string,CanvasPattern>();
function pat(ctx: Ctx2D,col: string,level: number){ level=clamp(Math.round(level*16),0,16); const key=col+'|'+level+'|'+(ctx===g?'m':ctx===t1G?'t':'o'); let p=patCache.get(key); if (p) return p;
  const [c,x]=mk(4,4); x.fillStyle=PAL[col]||col; for(let i=0;i<16;i++) if (BAYER[i]<level/16) x.fillRect(i%4,Math.floor(i/4),1,1); p=ctx.createPattern(c,'repeat')!; patCache.set(key,p); return p; }

/* ================= scene: bricks, tiles and altar as lit units ================= */
let UB0X!: Int16Array, UB0Y!: Int16Array, UST!: Uint8Array, UDEL!: Float32Array, URST!: Float32Array, WALLU: number[]=[], VOID32!: Uint32Array, VOIDSTARS: [number,number,number][]=[], snapC!: HTMLCanvasElement, snapG!: Ctx2D;
let UNIT!: Int32Array, OFF!: Int8Array, PIXA!: Float32Array, NU=0, UX!: Float32Array, UY!: Float32Array, UALB!: Float32Array, UHASH!: Float32Array, ULVL!: Int8Array, URAMP!: Uint8Array, sceneImg!: ImageData, scene32!: Uint32Array, sceneC!: HTMLCanvasElement, sceneG!: Ctx2D;
function buildScene(){
  const N=W*H, rng=mulberry(77); UNIT=new Int32Array(N).fill(-1); OFF=new Int8Array(N); PIXA=new Float32Array(N).fill(-1);
  const ux: number[]=[], uy: number[]=[], ua: number[]=[], uh: number[]=[], uw: number[]=[], bx0: number[]=[], by0: number[]=[]; const add=(cx: number,cy: number,a: number,wall?: number,x0?: number,y0?: number)=>{ ux.push(cx); uy.push(cy); ua.push(a); uh.push(rng()); uw.push(wall?1:0); bx0.push(x0||0); by0.push(y0||0); return ux.length-1; };
  // wall bricks
  const BW=14, BH=7, bmap=new Map<number,number>();
  for(let y=0;y<HY;y++){ const row=Math.floor(y/BH), off=(row%2)*7, ly=y%BH;
    for(let x=0;x<W;x++){ const bx=Math.floor((x+off)/BW), lx=(x+off)%BW, key=row*100000+bx; let u=bmap.get(key);
      if (u===undefined){ const cy=row*BH+BH/2, ao=clamp((HY-cy)/20,0,1); u=add(bx*BW-off+BW/2, cy, (.66+rng()*.26)*(.6+.4*ao)*(rng()<.06?.75:1), 1, bx*BW-off, row*BH); bmap.set(key,u); }
      const i=y*W+x; UNIT[i]=u;
      if (ly===BH-1 || lx===BW-1) OFF[i]=-2; else if (ly===0) OFF[i]=1; else if (ly===BH-2 || lx===BW-2) OFF[i]=-1; else if (lx===0 && ly<3) OFF[i]=1; else if (rng()<.012) OFF[i]=-1; } }
  for(let x=0;x<W;x++){ OFF[(HY-1)*W+x]=-4; if (HY-2>=0 && (x%3)) OFF[(HY-2)*W+x]=Math.min(OFF[(HY-2)*W+x],-1); }
  // floor: staggered flagstones, rows grow toward the viewer
  let y0=HY, h=3, k=0;
  while(y0<H){ const hi=Math.max(3,Math.round(h)), cw=Math.max(8,Math.round(hi*3.1)), offx=(k%2)*Math.round(cw/2), tmap=new Map<number,number>(), far=clamp((y0-HY)/60,0,1);
    for(let y=y0;y<Math.min(H,y0+hi);y++){ const ly=y-y0; for(let x=0;x<W;x++){ const q=x-CX+offx+cw*1000, col=Math.floor(q/cw), lx=q%cw; let u=tmap.get(col);
      if (u===undefined){ u=add(col*cw-cw*1000+CX-offx+cw/2, y0+hi/2, (.6+rng()*.2)*(.5+.5*far)); tmap.set(col,u); }
      const i=y*W+x; UNIT[i]=u; if (ly===hi-1 || lx===0) OFF[i]=-2; else if (ly===0) OFF[i]=1; else if (lx===cw-1) OFF[i]=-1; } }
    y0+=hi; h*=1.24; k++; }
  // altar: per-pixel albedo with bevels (lit per pixel, banded, no dither)
  const slab=(x0: number,x1: number,y0: number,y1: number,a: number)=>{ for(let y=y0-1;y<=y1+1;y++) for(let x=x0-1;x<=x1+1;x++){ if (x<0||x>=W||y<0||y>=H) continue; const i=y*W+x; UNIT[i]=-1;
      if (x===x0-1||x===x1+1||y===y0-1||y===y1+1){ PIXA[i]=0; continue; } let b=a; if (y===y0) b+=.3; else if (y===y1) b-=.25; if (x===x0) b+=.12; else if (x===x1) b-=.2; PIXA[i]=b; } };
  slab(CX-20,CX+20,PTOP+6,PBASE-5,.64); for(let y=PTOP+9;y<PBASE-6;y+=5) for(let x=CX-18;x<=CX+18;x++) PIXA[y*W+x]-=.14;
  for(let x=CX-16;x<=CX+16;x+=8) for(let y=PTOP+7;y<PBASE-5;y++) PIXA[y*W+x]-=.08;
  slab(CX-27,CX+27,PBASE-4,PBASE,.7); slab(CX-30,CX+30,PTOP,PTOP+5,.84);
  for(let x=CX-26;x<=CX+26;x+=6) PIXA[(PTOP+2)*W+x]+=.12;
  // sconces
  for (const t of TORCH){ for(let y=t.y;y<t.y+11;y++) for(let x=t.x-3;x<=t.x+3;x++){ if (x<0||x>=W||y<0||y>=H) continue; const dx=Math.abs(x-t.x), dy=y-t.y; let b=-1;
      if (dy<3){ b= dy===0?.95:dx===3?.3:.7; } else if (dy<6 && dx<=1) b=dx===1?.4:.6; else if (dy<9 && dx<=2-(dy-6>1?1:0)) b=.45; else if (dy>=9 && dx===0) b=.35;
      if (b>=0){ const i=y*W+x; UNIT[i]=-1; PIXA[i]=b; } } }
  NU=ux.length; UX=Float32Array.from(ux); UY=Float32Array.from(uy); UALB=Float32Array.from(ua); UHASH=Float32Array.from(uh); ULVL=new Int8Array(NU); URAMP=new Uint8Array(NU);
  UB0X=Int16Array.from(bx0); UB0Y=Int16Array.from(by0); UST=new Uint8Array(NU); UDEL=new Float32Array(NU).fill(Infinity); URST=new Float32Array(NU); WALLU=[]; for(let u=0;u<NU;u++) if (uw[u]) WALLU.push(u);
  VOID32=new Uint32Array(W*H); VOIDSTARS=[]; [snapC,snapG]=mk(W,H); if (S.wall){ S.wall.active=false; S.wall.rebuild=false; }
  [sceneC, sceneG]=mk(W,H); sceneImg=sceneG.createImageData(W,H); scene32=new Uint32Array(sceneImg.data.buffer);
}
const tone=(v: number)=>{ const l=Math.floor(6.35*(1-Math.exp(-1.3*v))); return l<0?0:l>6?6:l; };

/* ================= cards ================= */
let backBase!: ImageData;
function buildBackBase(){
  const x=backG; x.clearRect(0,0,CWd,CHd);
  x.fillStyle=PAL[1]; x.fillRect(1,1,CWd-2,CHd-2);
  for(let yy=2;yy<CHd-2;yy++) for(let xx=2;xx<CWd-2;xx++){ const a=((xx+yy)%8===0)||((xx-yy+800)%8===0); if (a){ x.fillStyle=PAL[2]; x.fillRect(xx,yy,1,1); } else if (bay(xx,yy)< (yy/CHd)*.35){ x.fillStyle=PAL[0]; x.fillRect(xx,yy,1,1); } }
  x.fillStyle=PAL.k; x.fillRect(2,0,CWd-4,1); x.fillRect(2,CHd-1,CWd-4,1); x.fillRect(0,2,1,CHd-4); x.fillRect(CWd-1,2,1,CHd-4); x.fillRect(1,1,1,1); x.fillRect(CWd-2,1,1,1); x.fillRect(1,CHd-2,1,1); x.fillRect(CWd-2,CHd-2,1,1);
  x.fillStyle=PAL.c; x.fillRect(2,1,CWd-4,1); x.fillRect(1,2,1,CHd-4); x.fillStyle=PAL[4]; x.fillRect(2,CHd-2,CWd-4,1); x.fillRect(CWd-2,2,1,CHd-4);
  const frame=(a: number,col: string,sh: string)=>{ x.fillStyle=PAL[col]; x.fillRect(a,a,CWd-2*a,1); x.fillRect(a,a,1,CHd-2*a); x.fillStyle=PAL[sh]; x.fillRect(a,CHd-1-a,CWd-2*a,1); x.fillRect(CWd-1-a,a,1,CHd-2*a); };
  frame(4,'o','Y'); frame(5,'y','R'); frame(7,'Y','d');
  for (const [a,b] of [[4,4],[CWd-9,4],[4,CHd-9],[CWd-9,CHd-9]]){ x.fillStyle=PAL.k; x.fillRect(a,b,5,5); x.fillStyle=PAL.y; x.fillRect(a+1,b+1,3,3); x.fillStyle=PAL.o; x.fillRect(a+1,b+1,1,1); x.fillStyle=PAL.Y; x.fillRect(a+3,b+3,1,1); x.fillStyle=PAL.r; x.fillRect(a+2,b+2,1,1); }
  const cx=32, cy=44, R=19;
  for(let yy=-R;yy<=R;yy++) for(let xx=-R;xx<=R;xx++){ const d=Math.abs(xx)+Math.abs(yy); if (d>R) continue; let col;
    if (d===R) col='k'; else if (d>=R-2) col = (xx<0||yy<0) ? (d===R-1?'o':'y') : (d===R-1?'Y':'y'); else if (d===R-3) col='k'; else col = bay(xx+40,yy+40) < (1-d/(R-3))*.8 ? '5' : '3';
    x.fillStyle=PAL[col]; x.fillRect(cx+xx,cy+yy,1,1); }
  drawText(x,'?',cx-5+1,cy-10+2,4,'k'); drawText(x,'?',cx-5,cy-10,4,'y'); x.fillStyle=PAL.o; x.fillRect(cx-5,cy-10,4,2); x.fillRect(cx-1,cy+6,4,1); x.fillStyle=PAL.Y; x.fillRect(cx+3,cy-4,4,2);
  for (const [sx,sy] of [[32,14],[32,74],[14,44],[50,44]]){ x.fillStyle=PAL.y; x.fillRect(sx,sy-1,1,3); x.fillRect(sx-1,sy,3,1); x.fillStyle=PAL.o; x.fillRect(sx,sy,1,1); }
  backBase=x.getImageData(0,0,CWd,CHd);
}
interface CrackTier { paths: [number,number][][]; shown: boolean; prog: number }
function genCracks(seed: number, cx: number, cy: number): CrackTier[]{
  const rng=mulberry(seed), tiers: [number,number][][][]=[[],[],[],[]];
  function walk(x: number,y: number,a: number,len: number,tier: number,depth: number){ const pts: [number,number][]=[]; for(let i=0;i<len;i++){ a+=(rng()-.5)*.75; x+=Math.cos(a); y+=Math.sin(a); const px=Math.round(x), py=Math.round(y); if (px<2||py<2||px>CWd-3||py>CHd-3) break; pts.push([px,py]);
      if (depth<1 && rng()<.04) walk(x,y,a+(rng()<.5?-1:1)*(.6+rng()*.6),Math.floor(len*.4),Math.min(3,tier+1),depth+1); } tiers[tier].push(pts); }
  for(let i=0;i<7;i++){ const a=i/7*TAU+rng()*.5; walk(cx+Math.cos(a)*3,cy+Math.sin(a)*3,a,16+Math.floor(rng()*20),i%4,0); }
  return tiers.map(ps=>({paths:ps, shown:false, prog:0}));
}
let backCracks=genCracks(1,32,44), frontCracks=genCracks(2,32,28);
function drawCracks(x: Ctx2D, cracks: CrackTier[], col: string){ const all: [number,number][]=[]; cracks.forEach(t=>{ if(!t.shown) return; t.paths.forEach(p=>{ const n=Math.floor(p.length*Math.min(1,t.prog)); for(let i=0;i<n;i++) all.push(p[i]); }); });
  x.fillStyle=PAL[col]; for (const [px,py] of all){ x.fillRect(px+1,py,1,1); x.fillRect(px,py+1,1,1); }
  x.fillStyle=PAL.w; for (const [px,py] of all) x.fillRect(px,py,1,1); }
function buildArtBg(vr: number){
  const R=RAR[vr], x=artG, rng=mulberry(S.spec!.seed);
  for(let yy=0;yy<45;yy++) for(let xx=0;xx<52;xx++){ const t=yy/44; const dx=(xx-26)/26, dy=(yy-24)/22, rad=Math.sqrt(dx*dx+dy*dy); const b=bay(xx,yy);
    x.fillStyle = b < (1-rad)*.55 ? PAL[R.x] : b < t*.9 ? PAL[0] : PAL[1]; if ((1-rad)*.8>b+.5) x.fillStyle=PAL[R.d]; x.fillRect(xx,yy,1,1); }
  for(let xx=0;xx<52;xx++){ x.fillStyle=PAL[0]; x.fillRect(xx,40+(xx%3===0?1:0),1,5); } x.fillStyle=PAL[1]; x.fillRect(0,40,52,1);
  S.artStars=[]; for(let i=0;i<16;i++) S.artStars.push([Math.floor(rng()*52), Math.floor(rng()*34), rng()*TAU]);
}
const CYCLE=['y','o','w','o','y','Y'];
function drawFront(t: number){
  const x=frontG, vr=S.vr, R=RAR[vr]; x.clearRect(0,0,CWd,CHd);
  x.fillStyle=PAL.k; x.fillRect(2,0,CWd-4,CHd); x.fillRect(0,2,CWd,CHd-4); x.fillRect(1,1,CWd-2,CHd-2);
  const rimL = vr===3 ? CYCLE[Math.floor(t*12)%CYCLE.length] : R.l;
  x.fillStyle=PAL[R.l]; x.fillRect(1,1,CWd-2,CHd-2); x.fillStyle=PAL.w; x.fillRect(2,1,CWd-4,1); x.fillRect(1,2,1,CHd-4); x.fillStyle=PAL[LIGHTEN[R.l]||'w']; x.fillRect(2,2,CWd-4,1); x.fillRect(2,2,1,CHd-4);
  x.fillStyle=PAL[R.d]; x.fillRect(2,CHd-2,CWd-4,1); x.fillRect(CWd-2,2,1,CHd-4); x.fillRect(3,CHd-3,CWd-5,1); x.fillRect(CWd-3,3,1,CHd-5);
  if (vr===3){ for(let i=0;i<(CWd+CHd)*2;i+=4){ const col=CYCLE[(Math.floor(t*14)+Math.floor(i/4))%CYCLE.length]; x.fillStyle=PAL[col]; let px,py; const P=i%(2*(CWd+CHd));
      if (P<CWd){ px=P; py=1; } else if (P<CWd+CHd){ px=CWd-2; py=P-CWd; } else if (P<2*CWd+CHd){ px=CWd-1-(P-CWd-CHd); py=CHd-2; } else { px=1; py=CHd-1-(P-2*CWd-CHd); } x.fillRect(px,py,2,2); } }
  x.fillStyle=PAL.k; x.fillRect(4,4,CWd-8,CHd-8); x.fillStyle=PAL[0]; x.fillRect(5,5,CWd-10,CHd-10);
  for (const [a,b] of [[2,2],[CWd-6,2],[2,CHd-6],[CWd-6,CHd-6]]){ x.fillStyle=PAL.k; x.fillRect(a,b,4,4); x.fillStyle=PAL[rimL]; x.fillRect(a+1,b+1,2,2); x.fillStyle=PAL.w; x.fillRect(a+1,b+1,1,1); }
  // art
  x.fillStyle=PAL[R.d]; x.fillRect(5,5,54,47); x.drawImage(artC,6,6);
  for (const [sx,sy,ph] of S.artStars){ const tw=Math.sin(t*3+ph); if (tw>.2){ x.fillStyle=tw>.8?PAL.w:PAL[4]; x.fillRect(6+sx,6+sy,1,1); if (tw>.93){ x.fillStyle=PAL[R.l]; x.fillRect(5+sx,6+sy,1,1); x.fillRect(7+sx,6+sy,1,1); x.fillRect(6+sx,5+sy,1,1); x.fillRect(6+sx,7+sy,1,1); } } }
  const bob=Math.round(Math.sin(t*3.2)*1.4);
  const gr=Math.round(9+Math.sin(t*4)*1.5); for(let yy=-gr;yy<=gr;yy++) for(let xx=-gr*1.4;xx<=gr*1.4;xx++){ const d=Math.sqrt((xx/1.4)**2+yy*yy)/gr; if (d<1 && bay(xx+64,yy+64)<(1-d)*.7){ x.fillStyle=PAL[d<.4?R.l:R.d]; x.fillRect(32+Math.round(xx),28+yy,1,1); } }
  x.fillStyle=PAL.k; x.fillRect(20,45,24,2); x.fillStyle=PAL[1]; x.fillRect(17,46,30,1);
  const pt=S.rt-S.popT0, ps=pt<.42?1+.75*Math.pow(1-pt/.42,2):1, sz=Math.round(32*ps); x.drawImage(SPRITES.spr32[S.spec!.spr],Math.round(32-sz/2),Math.round(26-sz/2)+bob,sz,sz);
  if (vr>=1){ for(let i=0;i<R.sparkle+1;i++){ const cyc=Math.floor(t*1.4+i*.37), ph=(t*1.4+i*.37)%1, px=8+((i*37+cyc*13)%46), py=8+((i*23+cyc*7)%34); const big=ph>.3&&ph<.7;
      x.fillStyle=PAL.w; x.fillRect(px,py,1,1); if (big){ x.fillStyle=PAL[R.l]; x.fillRect(px-1,py,1,1); x.fillRect(px+1,py,1,1); x.fillRect(px,py-1,1,1); x.fillRect(px,py+1,1,1); if (ph>.45&&ph<.55){ x.fillRect(px-2,py,1,1); x.fillRect(px+2,py,1,1); x.fillRect(px,py-2,1,1); x.fillRect(px,py+2,1,1); } } } }
  x.fillStyle=PAL[R.l]; x.fillRect(5,52,54,1);
  // nameplate
  x.fillStyle=PAL[1]; x.fillRect(6,54,52,10); x.fillStyle=PAL[2]; x.fillRect(6,54,52,1); x.fillStyle=PAL.k; x.fillRect(6,63,52,1);
  const nm=S.spec!.name; drawText(x,nm,Math.round(32-textW(nm,1)/2),56,1,'c','k');
  // bars
  ['ATK','DEF','MAG'].forEach((lb,k)=>{ const y=66+k*6; drawText(x,lb,7,y,1,'4'); const bw=36, bx=21; x.fillStyle=PAL.k; x.fillRect(bx-1,y,bw+2,5); x.fillStyle=PAL[1]; x.fillRect(bx,y+1,bw,3);
    const f=Math.round(bw*(S.bars[k]||0)); for(let j=0;j<f;j++){ x.fillStyle=PAL[j%4===3?R.d:R.l]; x.fillRect(bx+j,y+1,1,3); } if (f>0){ x.fillStyle=PAL.w; x.fillRect(bx,y+1,f,1); if (S.barFlash[k]>0){ x.fillStyle=PAL.w; x.fillRect(bx+f-2,y,3,5); } } });
  // gems
  const gw=(vr+1)*6-2; for(let i=0;i<=vr;i++){ const gx=Math.round(32-gw/2)+i*6, gy=83; x.fillStyle=PAL.k; x.fillRect(gx+1,gy-1,2,6); x.fillRect(gx,gy,4,4); x.fillStyle=PAL[R.l]; x.fillRect(gx+1,gy,2,4); x.fillRect(gx,gy+1,4,2); x.fillStyle=PAL.w; x.fillRect(gx+1,gy,1,1); }
  if (S.phase==='upgrading') drawCracks(x, frontCracks, RAR[S.r].l);
  if (S.glitch>0){ tmpG.clearRect(0,0,CWd,CHd); tmpG.drawImage(frontC,0,0); x.clearRect(0,0,CWd,CHd);
    for(let yy=0;yy<CHd;yy++){ const dx=Math.random()<S.glitch*.45?ri(-5,5):0; x.drawImage(tmpC,0,yy,CWd,1,dx,yy,CWd,1); }
    for(let k=0;k<Math.floor(S.glitch*8);k++){ x.fillStyle=PAL[['m','t','y','v','w'][ri(0,4)]]; x.fillRect(ri(0,50),ri(0,CHd-1),ri(4,24),1); } }
}
function drawBack(t: number){
  const img=new ImageData(new Uint8ClampedArray(backBase.data), CWd, CHd), d=img.data, band=((t*42)%180)-50;
  for(let yy=2;yy<CHd-2;yy++){ const bx=Math.round(band-yy*.6); for(let xx=bx;xx<bx+4;xx++){ if(xx<2||xx>=CWd-2) continue; const o=(yy*CWd+xx)*4; const k=xx===bx||xx===bx+3?40:80; d[o]=Math.min(255,d[o]+k); d[o+1]=Math.min(255,d[o+1]+k); d[o+2]=Math.min(255,d[o+2]+k*.8); } }
  backG.putImageData(img,0,0);
  const gl=Math.floor(t*1.5)%4, [gx,gy]=[[32,14],[32,74],[14,44],[50,44]][gl], ph=(t*1.5)%1; if (ph<.4){ const s=ph<.13?1:ph<.26?2:1; backG.fillStyle=PAL.w; backG.fillRect(gx-s,gy,2*s+1,1); backG.fillRect(gx,gy-s,1,2*s+1); }
  drawCracks(backG, backCracks, S.teaseKey);
  drawChains(backG);
}

/* ================= wall breakdown ================= */
function genVoid(r: number){
  const rp=RAMPU[RAR[r].ramp], rng=mulberry(S.seed*13+5), ox=CX, oy=CY-6, R0=Math.round(clamp(Math.min(W,HY)*.2,18,40)), big=Math.max(W,HY);
  VOIDSTARS=[]; const gs=18, gw=Math.ceil(W/gs)+3, gh=Math.ceil(HY/gs)+3, grid=new Float32Array(gw*gh); for(let i=0;i<grid.length;i++) grid[i]=rng();
  const vn=(x: number,y: number)=>{ const gx=x/gs, gy=y/gs, x0=Math.floor(gx), y0=Math.floor(gy), fx=gx-x0, fy=gy-y0, sx=fx*fx*(3-2*fx), sy=fy*fy*(3-2*fy);
    const a=grid[y0*gw+x0], b=grid[y0*gw+x0+1], c=grid[(y0+1)*gw+x0], d=grid[(y0+1)*gw+x0+1]; return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy; };
  const ridge=new Float32Array(W), ridge2=new Float32Array(W); for(let x=0;x<W;x++){ ridge[x]=HY-6-(vn(x*.6+300,5)*.7+vn(x*1.7+80,9)*.3)*Math.min(34,HY*.28); ridge2[x]=HY-3-(vn(x*.9+900,40)*.6+vn(x*2.6,70)*.4)*Math.min(18,HY*.15); }
  for(let y=0;y<HY;y++) for(let x=0;x<W;x++){ const dx=x-ox, dy=y-oy, d=Math.hypot(dx,dy), b=bay(x,y); let col;
    if (y>=ridge2[x]){ VOID32[y*W+x] = y<ridge2[x]+1 ? rp[2] : U32.k; continue; }
    if (y>=ridge[x]){ VOID32[y*W+x] = y<ridge[x]+1 ? rp[3] : (b<.25 ? rp[1] : U32['0']); continue; }
    if (d<R0){ const sh=(dx+dy*.8)/R0; let l=Math.floor(5.6-(sh+1)*1.7+b*1.3); if (d>R0-1.2) l=6; col=rp[clamp(l,2,6)];
      if (r===3 && ((Math.floor(d)+Math.floor(Math.atan2(dy,dx)*6))%9===0) && d<R0-3) col=U32.o; }
    else { let v=vn(x,y)*.55+vn(x*2.3+40,y*2.3+20)*.3; v=v*.75+Math.max(0,1-d/(big*.75))*.5-.08+Math.pow(y/HY,1.8)*.55; const halo=Math.max(0,1-(d-R0)/(R0*1.1)); v+=halo*halo*.55;
      if (r>=2 && Math.abs(d-R0*1.55)<1.1 && Math.abs(dy)<R0*.5) v+=.5;
      const l=clamp(Math.floor(v*4.4+b-.5),0,5); col=rp[l];
      if (l<=1 && rng()<.014){ const k=rng()<.3?'w':rng()<.6?'c':'4'; col=U32[k]; VOIDSTARS.push([x,y,rng()*TAU]); } }
    VOID32[y*W+x]=col; }
}
function startWallBreak(r: number){
  const B=S.wall; genVoid(r); B.active=true; B.rebuild=false; B.t=0; B.r=r; snapG.clearRect(0,0,W,H); snapG.drawImage(sceneC,0,0);
  const reach = r===3 ? 1e9 : [.42,.56,.76][r]*Math.max(W,HY);
  for (const u of WALLU){ const prot=TORCH.some(t=>Math.hypot(UX[u]-t.x, UY[u]-(t.y+4))<11 || (Math.abs(UX[u]-t.x)<8 && UY[u]>t.y)); const d=Math.hypot(UX[u]-CX,(UY[u]-CY)*1.1);
    UDEL[u] = (!prot && d<=reach) ? .25 + d/(NARROW?150:230) + Math.random()*.18 : Infinity; }
  A.rumble(r); S.trauma=Math.min(1,S.trauma+.35); S.zoom.v+=.5*MOTION; buzz([30,20,60]);
}
function brickGround(x: number){ const lo=Math.min(GMAX-1, HY+2), hi=Math.max(lo+1, Math.min(GMAX, HY+(GMAX-HY)*.55)); return Math.abs(x-CX)<34 ? rnd(Math.min(GMAX-1,PBASE+1), Math.min(GMAX, PBASE+9)) : rnd(lo, hi); }
function dustAt(x: number,y: number,n: number,up: boolean){ for(let i=0;i<n;i++) FX.dustp.push({x:x+rnd(-3,3), y:y+rnd(-2,2), vx:rnd(-18,18), vy:-rnd(up?10:2,up?40:14), age:0, life:rnd(.4,1)}); }
function detach(u: number){
  const x0=UB0X[u], y0=UB0Y[u], sx=Math.max(0,x0), sy=Math.max(0,y0), sw=Math.min(x0+14,W)-sx, sh=Math.min(y0+7,HY)-sy; if (sw<=0||sh<=0) return;
  const cx=sx+sw/2, cy=sy+sh/2, dx=cx-CX, dy=cy-S.cy, d=Math.hypot(dx,dy)||1;
  if (FX.bricks.length < (NARROW?220:400) && !(cy<HY*.3 && Math.random()<.45)) FX.bricks.push({sx,sy,w:sw,h:sh,x:cx,y:cy,vx:dx/d*rnd(15,70)+rnd(-20,20), vy:-rnd(0,60)*(dy<0?.4:1), rot:0, vr:rnd(-6,6), g:brickGround(cx), age:0, life:rnd(3.5,5.5), rest:false});
  if (Math.random()<.5) dustAt(cx,cy,2,false);
}
function wallStep(rdt: number){
  const B=S.wall; if (!B.active) return;
  if (!B.rebuild){ B.t+=rdt; let pending=0;
    for (const u of WALLU){ const del=UDEL[u]; if (del===Infinity) continue; const st=UST[u];
      if (st===0 && B.t>=del-.14) UST[u]=1; else if (st===1 && B.t>=del){ UST[u]=2; detach(u); } if (UST[u]<2) pending++; }
    if (pending>0) S.trauma=Math.max(S.trauma,.24*MOTION); }
  else { B.rt+=rdt; let left=0;
    for (const u of WALLU){ if (!UST[u]) continue; if (B.rt>=URST[u]){ UST[u]=0; UDEL[u]=Infinity; if (Math.random()<.3) dustAt(UX[u],UY[u],1,true); if (Math.random()<.05) A.blip(); } else left++; }
    if (!left){ B.active=false; B.rebuild=false; } }
}
function wallRebuild(){
  const B=S.wall; if (!B.active) return; B.rebuild=true; B.rt=0; const md=Math.max(W,HY)*.8;
  for (const u of WALLU){ UDEL[u]=Infinity; if (UST[u]){ const d=Math.hypot(UX[u]-CX,UY[u]-CY); URST[u]=.08+(1-Math.min(1,d/md))*.7+Math.random()*.1; } }
  FX.bricks.forEach(b=>{ b.life=Math.min(b.life,b.age+rnd(.15,.5)); }); A.rebuild();
}

/* ================= chains + padlock ================= */
const LOCKC=SPRITES.lock, LOCKM=SPRITES.lockMirror, LOCKW=SPRITES.lockWhite;
const SEG=[[[6,9],[32,45]],[[58,9],[32,45]],[[32,45],[58,81]],[[32,45],[6,81]]];
const CHAIN_LINKS=SEG.map(([[x0,y0],[x1,y1]])=>{ const L=Math.hypot(x1-x0,y1-y0), n=Math.floor(L/3.3), out: [number,number,number][]=[]; for(let j=0;j<=n;j++){ const u=j/n, px=x0+(x1-x0)*u, py=y0+(y1-y0)*u; if (Math.hypot(px-32,py-45)<8) continue; out.push([Math.round(px),Math.round(py),j%2]); } return out; });
function chainCols(c: number): [string,string,string]{ const rp=RAMPS[RAR[Math.max(0,S.tease)].ramp]; return c>.25 ? [rp[4], c>.62?'w':rp[5], rp[3]] : ['S','s','D']; }
function drawChains(x: Ctx2D){
  const c=S.phase==='idle'?S.charge:0, [base,hi,lo]=chainCols(c);
  for(let si=0;si<4;si++){ if(!S.chains[si]) continue; const [[x0,y0],[x1,y1]]=SEG[si], nx=-(y1-y0), ny=x1-x0, nl=Math.hypot(nx,ny);
    for (const [lx,ly,odd] of CHAIN_LINKS[si]){ let jx=lx, jy=ly; if (c>.25 && Math.random()<c*.55){ const o=ri(-1,1); jx+=Math.round(nx/nl*o); jy+=Math.round(ny/nl*o); }
      if (!odd){ x.fillStyle=PAL.k; x.fillRect(jx,jy,3,3); x.fillStyle=PAL[base]; x.fillRect(jx-1,jy-1,3,1); x.fillRect(jx-1,jy+1,3,1); x.fillRect(jx-1,jy,1,1); x.fillRect(jx+1,jy,1,1); x.fillStyle=PAL[hi]; x.fillRect(jx-1,jy-1,1,1); }
      else { x.fillStyle=PAL.k; x.fillRect(jx,jy+1,2,1); x.fillStyle=PAL[lo]; x.fillRect(jx,jy,2,1); x.fillStyle=PAL[hi]; x.fillRect(jx,jy,1,1); } } }
  if (S.lockOn){ const sh=c>.2&&Math.random()<c?ri(-1,1):0, flash=c>.8&&Math.floor(S.rt*14)%2; x.drawImage(flash?LOCKW:LOCKC, 27+sh, 38+(c>.5?ri(-1,0):0)); }
}
function snapChain(i: number){ if (!S.chains[i]) return; S.chains[i]=false; const ox=S.cx-32, oy=S.cy-45, [[x0,y0],[x1,y1]]=SEG[i], outx=(x0+x1)/2-32, outy=(y0+y1)/2-45, ol=Math.hypot(outx,outy)||1;
  for (const [lx,ly,odd] of CHAIN_LINKS[i]) FX.links.push({x:ox+lx, y:oy+ly, vx:outx/ol*rnd(40,150)+rnd(-30,30), vy:outy/ol*rnd(20,80)-rnd(60,160), g:gy(), age:0, life:rnd(3,5), odd, rest:false});
  sparks(20, S.teaseKey, 40, 170, .4, ox+32+Math.round(outx*.25), oy+45+Math.round(outy*.25), true); A.snap(); S.trauma=Math.min(1,S.trauma+.22); S.sq.v-=1.5*MOTION; buzz(20); }
function dissolve(src: HTMLCanvasElement, p: number){ const img=src.getContext('2d')!.getImageData(0,0,CWd,CHd), d=img.data;
  for(let y=0;y<CHd;y++) for(let x=0;x<CWd;x++){ const o=(y*CWd+x)*4; if (!d[o+3]) continue; const th=bay(x,y)*.3+(1-y/CHd)*.7; if (th>p) d[o+3]=0; else if (th>p-.07){ d[o]=255; d[o+1]=255; d[o+2]=255; } }
  dissG.putImageData(img,0,0); return dissC; }

/* ================= pseudo-3D card ================= */
const FOC=240;
function drawCard3D(ctx: Ctx2D, face: HTMLCanvasElement, back: HTMLCanvasElement|null, cx: number, cy: number, ry: number, rx: number, sc: number, shine: number){
  t1G.clearRect(0,0,T1W,T1H);
  const cr=Math.cos(ry), sr=Math.sin(ry), ox=T1W/2, oy=T1H/2, mirror=cr<0, src=(mirror&&back)?back:face;
  const xe: number[]=new Array(CWd+1), he: number[]=new Array(CWd+1), ze: number[]=new Array(CWd+1);
  for(let u=0;u<=CWd;u++){ const xx=(u-CWd/2)*sc, X=xx*cr, Z=xx*sr, p=FOC/(FOC+Z); xe[u]=X*p; he[u]=CHd*sc*p; ze[u]=p; }
  for(let u=0;u<CWd;u++){ const a=xe[u], b=xe[u+1], L=Math.round(Math.min(a,b)), Rr=Math.round(Math.max(a,b)), w=Rr-L; if (w<=0) continue; const h=Math.round((he[u]+he[u+1])/2);
    t1G.drawImage(src, mirror?CWd-1-u:u, 0, 1, CHd, ox+L, Math.round(oy-h/2), w, h); }
  // edge thickness
  if (Math.abs(sr)>.12){ const near = ze[0]>ze[CWd] ? 0 : CWd; const ex=Math.round(xe[near]), eh=Math.round(he[near]), ew=Math.max(1,Math.round(3*Math.abs(sr)*sc)); const dir = xe[near] < xe[near===0?CWd:0] ? -1 : 1;
    const x0 = dir<0 ? ox+ex-ew : ox+ex; t1G.fillStyle=PAL.Y; t1G.fillRect(x0, Math.round(oy-eh/2)+1, ew, eh-2); t1G.fillStyle=PAL.y; t1G.fillRect(x0, Math.round(oy-eh/2)+1, ew, 1); t1G.fillStyle=PAL.k; t1G.fillRect(dir<0?x0:x0+ew-1, Math.round(oy-eh/2)+1, 1, eh-2); }
  // shading + foil glint
  t1G.globalCompositeOperation='source-atop';
  const shade=(1-Math.abs(cr))*.6 + Math.abs(rx)*.25; if (shade>.09){ t1G.fillStyle=pat(t1G,'k',shade); t1G.fillRect(0,0,T1W,T1H); }
  if (shine>0){ const bx=Math.round(ox + (-ry*1.6 + rx*.8)*40 + Math.sin(S.rt*.9)*10); t1G.fillStyle=pat(t1G,'w',.3*shine); for(let yy=0;yy<T1H;yy++){ const xx=bx - Math.round((yy-oy)*.45); t1G.fillRect(xx,yy,5,1); } t1G.fillStyle=pat(t1G,'w',.6*shine); for(let yy=0;yy<T1H;yy++){ const xx=bx+1 - Math.round((yy-oy)*.45); t1G.fillRect(xx,yy,2,1); } }
  t1G.globalCompositeOperation='source-over';
  // rows (X tilt)
  const crx=Math.cos(rx), srx=Math.sin(rx), top=Math.max(0,Math.floor(oy-CHd*sc*.75)), bot=Math.min(T1H,Math.ceil(oy+CHd*sc*.75));
    for(let v=top; v<bot; v++){ const y=v-oy, Y=y*crx, Z=y*srx, p=FOC/(FOC+Z), dy=cy+Y*p, y2=(v+1-oy), p2=FOC/(FOC+y2*srx), dy2=cy+y2*crx*p2;
    const r0=Math.round(dy), r1=Math.max(r0+1,Math.round(dy2)); const rw=Math.round(T1W*p); ctx.drawImage(t1C,0,v,T1W,1,Math.round(cx-rw/2),r0,rw,r1-r0); }
}

/* ================= state ================= */
type Phase='entering'|'idle'|'hitstop'|'revealed'|'upgrading'|'collecting';
interface Spec extends PoolCard { seed: number; idx: number }
interface Title { text: string; t0: number; ramp: string[]|null; quake: number }
interface Stamp { text: string; key: string; t0: number }
interface Collect { t: number; tx: number; ty: number; s1: number; dir: number; done: boolean; i: number }
const S={ phase:'entering' as Phase, t:0, rt:0, ts:1, slowmo:0, charge:0, holding:false, auto:false, downAt:0, reached:[0,0,0,0], tease:0, teaseKey:'s', beat:0,
  r:-1, vr:-1, spec:null as Spec|null, fake:false, upgrading:false, up:0, force:-1, seed:1, backOn:true,
  pos:{x:0,y:0,vy:0}, landed:false, sq:{x:0,v:0}, spin:{a:0,from:0,to:0,t:1,dur:1}, pulse:0, tilt:{x:0,y:0}, ptr:{nx:0,ny:0,last:-9},
  trauma:0, flash:0, flashKey:'w', rays:0, raysT:0, rayAng:0, glow:0, box:0, zoom:{x:1,v:0}, amb:.3, cardI:.5, cardIT:.5, lightKey:'s', beam:0, torchBoost:0,
  hitstop:0, hitstopDur:1, after:-1, stat:{done:true}, bars:[0,0,0], barT:[0,0,0], barFlash:[0,0,0], barDone:[1,1,1], title:null as Title|null, stamp:null as Stamp|null, glitch:0, hidden:false, col:null as Collect|null, pending:null as {i:number,isNew:boolean}|null,
  zapAcc:0, suckAcc:0, sparkAcc:0, flameAcc:0, ca:0, chains:[true,true,true,true], lockOn:true, wall:{active:false, rebuild:false, t:0, rt:0, r:0}, summon:0, summonChime:false, popT0:-9, crk:0, artStars:[] as [number,number,number][], barTarget:[0,0,0], colSpin:0, cx:0, cy:0, colScale:1 };
const tens=()=>S.phase==='idle'?S.charge:S.phase==='upgrading'?S.up:0;

/* ================= bag ================= */
let BAG=loadBag();
let slotShown=POOL.map(c=>!!BAG.owned[c.name]), slotFlash=POOL.map(()=>-1);
const shownCount=()=>slotShown.filter(Boolean).length;
hooks.onBagComplete?.(BAG.complete);
function slotRect(i: number){ const gap=2, total=9*(SLOT+gap)-gap, x0=NARROW?Math.round((W-total)/2):4; return {x:x0+i*(SLOT+gap), y:BAGY, w:SLOT, h:SLOT}; }

/* ================= particles ================= */
interface Body { x: number; y: number; vx: number; vy: number; age: number; life: number }
interface Brick extends Body { sx: number; sy: number; w: number; h: number; rot: number; vr: number; g: number; rest: boolean }
interface Link extends Body { g: number; rest: boolean; odd?: number; lock?: boolean }
interface Spark extends Body { k: string; big: boolean; g: number; px?: number; py?: number }
interface Tile extends Body { sx: number; sy: number; w: number; h: number; rot: number; vr: number; g: number }
interface Confetto extends Body { k: string; ph: number; g: number; land?: boolean }
interface Suck { x: number; y: number; v: number; k: string; px?: number; py?: number; d?: number }
interface Mote { x: number; y: number; vy: number; age: number; life: number; k: string }
interface Bolt { pts: [number,number][]; k: string; age: number; life: number }
interface Ring { r: number; v: number; w: number; k: string; age: number; life: number }
interface Flame extends Body { big?: boolean; ember?: boolean }
interface Coin { x: number; h: number; gy: number; vx: number; vh: number; ph: number; rest: boolean; age: number; life: number }
interface Dust { x: number; y: number; vx: number; vy: number; ph: number }
const FX={bricks:[] as Brick[], dustp:[] as Body[], links:[] as Link[], sparks:[] as Spark[], tiles:[] as Tile[], confetti:[] as Confetto[], sucks:[] as Suck[], motes:[] as Mote[], bolts:[] as Bolt[], rings:[] as Ring[], flames:[] as Flame[], coins:[] as Coin[], dust:[] as Dust[]};
const Q=(n: number)=>Math.round(n*(reduce?.4:1));
const gy=()=>rnd(Math.max(GMIN, PBASE+2), GMAX);
function sparks(n: number,key: string,smin: number,smax: number,life: number,x0?: number,y0?: number,floorless?: boolean){ n=Q(n); for(let i=0;i<n;i++){ const a=Math.random()*TAU, s=rnd(smin,smax);
  FX.sparks.push({x:x0??S.cx, y:y0??S.cy, vx:Math.cos(a)*s, vy:Math.sin(a)*s-30, age:0, life:life*rnd(.5,1.2), k:Math.random()<.3?'w':key, big:Math.random()<.3, g:floorless?1e9:gy()}); } }
function ring(key: string,speed: number,w: number,delay?: number){ FX.rings.push({r:12,v:speed,w,k:key,age:-(delay||0),life:.85}); }
function confetti(n: number,keys: string[],rain: boolean){ for(let i=0;i<Q(n);i++){ const a=-Math.PI/2+rnd(-1.4,1.4), s=rnd(70,230);
  FX.confetti.push(rain?{x:rnd(0,W),y:rnd(-160,-4),vx:rnd(-10,10),vy:rnd(0,40),k:keys[i%keys.length],age:0,life:rnd(3.5,6),ph:rnd(0,TAU),g:gy()}:{x:S.cx+rnd(-12,12),y:S.cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,k:keys[i%keys.length],age:0,life:rnd(3,4.5),ph:rnd(0,TAU),g:gy()}); } }
function coins(n: number){ for(let i=0;i<Q(n);i++){ const gg=gy(); FX.coins.push({x:S.cx+rnd(-8,8), h:gg-S.cy, gy:gg, vx:rnd(-150,150), vh:rnd(90,260), ph:rnd(0,4), rest:false, age:0, life:rnd(6,9)}); } }
function shatter(fromCanvas: HTMLCanvasElement){ tileSrcG.clearRect(0,0,CWd,CHd); tileSrcG.drawImage(fromCanvas,0,0);
  const ox=Math.round(S.cx-CWd/2), oy=Math.round(S.cy-CHd/2);
  for(let ty=0;ty<CHd;ty+=8) for(let tx=0;tx<CWd;tx+=8){ const cx=tx+4-CWd/2, cy=ty+4-CHd/2, a=Math.atan2(cy,cx)+rnd(-.4,.4), s=rnd(80,220);
    FX.tiles.push({sx:tx,sy:ty,w:Math.min(8,CWd-tx),h:Math.min(8,CHd-ty),x:ox+tx+4,y:oy+ty+4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-70,rot:0,vr:rnd(-14,14),age:0,life:rnd(1.1,1.9),g:gy()}); } }
function bolt(key: string){ const a=Math.random()*TAU, sx=S.cx+Math.cos(a)*34, sy=S.cy+Math.sin(a)*46, len=rnd(24,70), b=a+rnd(-.5,.5);
  let pts: [number,number][]=[[sx,sy],[sx+Math.cos(b)*len, sy+Math.sin(b)*len]], disp=len*.45;
  for(let k=0;k<4;k++){ const np: [number,number][]=[pts[0]]; for(let i=0;i<pts.length-1;i++){ const [ax,ay]=pts[i],[bx,by]=pts[i+1]; const dx=bx-ax, dy=by-ay, L=Math.hypot(dx,dy)||1, off=(Math.random()-.5)*disp; np.push([(ax+bx)/2-dy/L*off,(ay+by)/2+dx/L*off],pts[i+1]); } pts=np; disp*=.55; }
  FX.bolts.push({pts:pts.map(p=>[Math.round(p[0]),Math.round(p[1])]), k:key, age:0, life:rnd(.06,.15)}); A.zap(); }
function line(x: Ctx2D,x0: number,y0: number,x1: number,y1: number){ x0=Math.round(x0); y0=Math.round(y0); x1=Math.round(x1); y1=Math.round(y1); const dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1; let e=dx+dy, n=0;
  while(n++<600){ x.fillRect(x0,y0,1,1); if(x0===x1&&y0===y1) break; const e2=2*e; if(e2>=dy){ e+=dy; x0+=sx; } if(e2<=dx){ e+=dx; y0+=sy; } } }
function seedDust(){ FX.dust=[]; for(let i=0;i<Math.round(W*H/900);i++) FX.dust.push({x:rnd(0,W), y:rnd(0,HY), vx:rnd(-3,3), vy:rnd(-2,2), ph:rnd(0,TAU)}); }

/* ================= layout ================= */
const hit=els.hit, again=els.again, live=els.live;
function layout(){
  const iw=innerWidth, ih=innerHeight;
  SC=Math.max(2, Math.floor(Math.min(iw/128, ih/228)));
  W=Math.ceil(iw/SC); H=Math.ceil(ih/SC);
  for (const c of [cv]){ c.width=W; c.height=H; c.style.width=W*SC+'px'; c.style.height=H*SC+'px'; }
  bloomC.width=Math.ceil(W/2); bloomC.height=Math.ceil(H/2); bloomC.style.width=W*SC+'px'; bloomC.style.height=H*SC+'px';
  g.imageSmoothingEnabled=false;
  [layerC,layerG]=mk(W,H); [silC,silG]=mk(W,H);
  TS=W>=300?4:3; NARROW=W<300; SLOT=NARROW?Math.max(8,Math.min(16,Math.floor((W-6)/9)-2)):16;
  TOP=Math.ceil((parseFloat(getComputedStyle(document.documentElement).paddingTop)||0)/SC);
  HUDTOP=Math.floor(els.hud.getBoundingClientRect().top/SC);
  const titleTop=NARROW?TOP+8:TOP+4+SLOT+8, CY0=titleTop+5*TS+10+45, need=CY0+45+7+26+18+(NARROW?SLOT+10:0), extra=Math.max(0,HUDTOP-4-need);
  CX=Math.round(W/2); CY=Math.round(CY0+extra*.42);
  PTOP=CY+45+8; PBASE=PTOP+26; HY=PTOP+13; GMIN=HY+4; BAGY=NARROW?HUDTOP-SLOT-6:TOP+4; GMAX=Math.max(GMIN+6,(NARROW?BAGY-3:HUDTOP-4));
  const tdx=Math.round(clamp(W*.36,46,150)); TORCH=[{x:CX-tdx,y:CY-6},{x:CX+tdx,y:CY-6}];
  buildScene(); seedDust();
  hit.style.left=(CX-CWd/2)*SC+'px'; hit.style.top=(CY-CHd/2)*SC+'px'; hit.style.width=CWd*SC+'px'; hit.style.height=CHd*SC+'px';
  again.style.left=CX*SC+'px'; again.style.top=Math.min((PBASE+8)*SC, (NARROW?BAGY-4:HUDTOP-14)*SC-44)+'px';
  els.crt.style.backgroundImage=`repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0 ${SC-1}px, rgba(0,0,0,.16) ${SC-1}px ${SC}px), radial-gradient(ellipse 75% 70% at 50% 50%, transparent 60%, rgba(0,0,0,.5) 100%)`;
  stage.style.transformOrigin=`${CX*SC}px ${CY*SC}px`;
}

/* ================= flow ================= */
function pickRarity(){ if (S.force>=0) return S.force; let u=Math.random(); for(let i=0;i<4;i++){ u-=RAR[i].odds; if(u<=0) return i; } return 0; }
function assignCard(){
  S.r=pickRarity(); let opts=POOL.filter(c=>c.r===S.r); if (APP.forceCard){ opts=POOL.filter(c=>c.name===APP.forceCard); S.r=opts[0].r; }
  const c=opts[ri(0,opts.length-1)]; S.spec=Object.assign({seed:ri(1,1e9), idx:POOL.indexOf(c)}, c);
  S.fake = APP.forceFake!==undefined ? (APP.forceFake && S.r>=2) : (S.r===3 && Math.random()<.45) || (S.r===2 && Math.random()<.3);
  S.vr=S.fake?S.r-1:S.r; paint(S.vr);
}
function paint(vr: number){ buildArtBg(vr); const [a,b]=RAR[vr].bars; S.barTarget=[rnd(a,b),rnd(a,b),rnd(a,b)]; S.bars=[0,0,0]; S.barFlash=[0,0,0]; }
function teaseUp(l: number){ S.tease=l; S.teaseKey=RAR[l].l; S.lightKey=RAR[l].ramp; S.pulse=.12*MOTION; S.trauma=Math.min(1,S.trauma+.4); A.tease(l); buzz(25); S.cardI+=.8;
  sparks(34+l*14, RAR[l].l, 40, 150, .5, S.cx, S.cy, true); ring(RAR[l].l, 280, 2, 0); for(let i=0;i<1+l;i++) bolt(RAR[l].l); }
function burst(){
  if (S.vr<0 || !S.spec){ assignCard(); }
  S.phase='hitstop'; S.hitstopDur=S.hitstop=RAR[S.vr].hitstop*(reduce?.5:1); S.sq.x=.2; S.sq.v=0; S.zoom.x=1+.07*MOTION; S.zoom.v=0;
  if (!S.upgrading){ S.charge=1; if (S.lockOn){ S.lockOn=false; S.chains=[false,false,false,false]; FX.links.push({lock:true, x:S.cx, y:S.cy+7, vx:rnd(-70,70), vy:-rnd(170,230), g:gy(), age:0, life:6, rest:false}); } }
  A.chargeStop(); A.boom(S.vr); buzz([45,25,110]);
}
function release(){
  const r=S.vr, R=RAR[r], up=S.upgrading, final=!S.fake||up, gen=S.seed;
  S.phase='revealed'; S.glitch=0; S.backOn=false; S.auto=false; S.popT0=S.rt; S.lightKey=R.ramp;
  if (up){ drawFront(S.rt); shatter(frontC); frontCracks.forEach(t=>{t.shown=false; t.prog=0;}); paint(r); } else shatter(backC);
  S.spin={a:0, from:0, to:(reduce?0:R.spin)*TAU, t:0, dur:.5+.32*R.spin};
  S.sq.v=-5; S.trauma=Math.min(1,.62+r*.13); S.flash=1; S.flashKey=R.l; S.rays=reduce?R.rays:1.3; S.raysT=R.rays; S.zoom.v=-1.3*MOTION; S.ca=reduce?0:1;
  S.cardI=2.6; S.cardIT=R.glow; S.torchBoost=1.2; S.beam=r>=2?1.4:0; A.roar();
  S.slowmo=reduce?0:[0,0,.3,.72][r]; if (S.slowmo) A.muffle(S.slowmo+.3); S.after=r>=1?.32:-1;
  sparks(R.spark*(up?1.4:1), R.l, 60, 260, 1.3); sparks(R.spark*.4, 'w', 110, 340, .5);
  for (const t of TORCH) for(let i=0;i<Q(26);i++) FX.flames.push({x:t.x+rnd(-2,2), y:t.y-2, vx:(t.x-S.cx)*rnd(.6,1.6)+rnd(-30,30), vy:-rnd(40,140), age:0, life:rnd(.3,.8), big:true});
  ring(R.l, 360, 3, 0); ring('w', 270, 1, .05); if (r>=2) ring(R.d, 220, 2, .14); if (r===3){ ring('Y', 170, 3, .26); ring('o', 120, 1, .4); }
  if (r>=1) for(let i=0;i<2+r*2;i++) bolt(R.l);
  if (r>=2) confetti(r===3?170:90, r===3?['y','o','Y','w','r']:['v','m','V','w','t'], false);
  if (R.coins) later(90, ()=>{ if (S.seed===gen) coins(R.coins); });
  S.title={text:R.name, t0:S.rt, ramp:R.title, quake:0};
  [...R.name].forEach((_,i)=> later(60+i*55+170, ()=>{ if(S.seed!==gen) return; A.letter(i,R.name.length); if(i===R.name.length-1){ S.trauma=Math.min(1,S.trauma+.35); S.zoom.v+=.6*MOTION; buzz(25); } }));
  for(let i=0;i<=r;i++) later(650+i*110, ()=>{ if(S.seed===gen) A.pip(i); });
  S.barT=[S.rt+.75, S.rt+1.05, S.rt+1.35]; S.barDone=[0,0,0];
  live.textContent=`${R.name}: ${S.spec!.name}`; hit.setAttribute('aria-label', `${R.name} ${S.spec!.name}. Tap to spin it.`);
  S.upgrading=false;
  if (final){ S.fake=false; commit(gen); later(1150, ()=>{ if (S.phase==='revealed' && S.seed===gen) startWallBreak(S.vr); }); later(1000, ()=>{ if (S.phase==='revealed' && S.seed===gen) again.classList.add('show'); }); }
  else later(2200, ()=>{ if (S.phase==='revealed' && S.seed===gen) startUpgrade(); });
}
function commit(gen: number){ const nm=S.spec!.name, isNew=!BAG.owned[nm]; BAG.owned[nm]=(BAG.owned[nm]||0)+1; saveBag(BAG); const cnt=BAG.owned[nm]; S.pending={i:S.spec!.idx, isNew};
  later(1900, ()=>{ if (S.phase!=='revealed'||S.seed!==gen) return; S.stamp={text:isNew?'NEW!':'x'+cnt, key:isNew?'y':'4', t0:S.rt}; A.stamp(isNew); S.trauma=Math.min(1,S.trauma+.25); S.pulse=.08*MOTION; buzz(25); sparks(26, isNew?'o':'4', 30, 130, .5, S.cx+30, S.cy-44, true); }); }
function startUpgrade(){ S.phase='upgrading'; S.up=0; S.upgrading=true; S.reached=[0,0,0,0]; S.beat=0; S.teaseKey=RAR[S.r].l; S.lightKey=RAR[S.r].ramp; S.raysT=0; S.beam=0; again.classList.remove('show');
  if (S.title) S.title.quake=1; A.glitch(); A.chargeStart(); S.trauma=Math.min(1,S.trauma+.5); S.flash=.5; S.flashKey='m'; S.ca=.8; buzz([20,40,20]); }
function aftershock(){ const k=RAR[S.vr].l; S.trauma=Math.min(1,S.trauma+.45); S.zoom.v+=.9*MOTION; ring(k,300,2,0); sparks(40+S.vr*20,k,40,170,.7); A.after(); buzz(35); S.cardI+=1; S.ca=Math.max(S.ca,.5); if (S.vr===3){ confetti(70,['y','o','w','Y'],false); coins(20); } }
function fidget(){ S.spin={a:0,from:0,to:TAU,t:0,dur:.5}; S.sq.v=-3; sparks(46, RAR[S.vr].l, 30, 160, .6, S.cx, S.cy); ring(RAR[S.vr].l, 220, 1, 0); A.fidget(); buzz(15); S.cardI+=.6; if (S.vr>=2) coins(3); }
function leave(){ if (S.phase!=='revealed'||S.fake) return; const i=S.pending?S.pending.i:0, sl=slotRect(i);
  S.col={t:0, tx:sl.x+sl.w/2-CX, ty:sl.y+sl.h/2-CY, s1:sl.h/CHd, dir:Math.random()<.5?-1:1, done:false, i};
  S.phase='collecting'; again.classList.remove('show'); S.title=null; S.stamp=null; S.raysT=0; S.beam=0; S.cardIT=.5; A.whoosh(); buzz(8); }
function arrive(){ const i=S.col!.i, sl=slotRect(i); S.hidden=true; slotShown[i]=true; slotFlash[i]=.5; A.collect(); buzz(20); S.trauma=Math.min(1,S.trauma+.15);
  sparks(34, RAR[POOL[i].r].l, 20, 130, .45, sl.x+sl.w/2, sl.y+sl.h/2, true); S.pending=null;
  if (!BAG.complete && shownCount()===POOL.length) later(380, celebrate); else later(240, startEnter); }
function celebrate(){ BAG.complete=true; saveBag(BAG); hooks.onBagComplete?.(true); S.vr=3; S.lightKey='y';
  S.title={text:'FULL SET!', t0:S.rt, ramp:null, quake:0}; slotFlash=slotFlash.map((_,k)=>.5+k*.07);
  confetti(260,['y','o','t','v','w','Y','m'],true); coins(50); S.trauma=Math.min(1,S.trauma+.6); S.flash=.8; S.flashKey='y'; S.rays=1; S.raysT=0; S.cardI=3; S.cardIT=.3; S.torchBoost=1.5; A.fanfare(); buzz([60,40,60,40,160]);
  live.textContent='Full set collected'; later(3200, ()=>{ S.title=null; startEnter(); }); }
function startEnter(){
  S.phase='entering'; S.landed=false; S.auto=false; S.holding=false; A.chargeStop(); S.pos.x=0; S.pos.y=0; S.pos.vy=0; S.summon=0; S.summonChime=false; S.chains=[true,true,true,true]; S.lockOn=true; S.charge=0; S.reached=[0,0,0,0]; S.tease=0; S.teaseKey='s'; S.lightKey='s';
  S.r=-1; S.vr=-1; S.spec=null; S.fake=false; S.upgrading=false; S.up=0; S.hidden=false; S.after=-1; S.title=null; S.stamp=null; S.glitch=0; S.backOn=true; S.cardIT=.5; S.beam=0;
  S.spin={a:0,from:0,to:0,t:1,dur:1}; S.seed++; backCracks=genCracks(S.seed*31,32,44); frontCracks=genCracks(S.seed*31+7,32,28);
  wallRebuild();
  FX.coins.forEach(c=>{ c.life=Math.min(c.life,c.age+rnd(.2,.8)); }); FX.links.forEach(c=>{ c.life=Math.min(c.life,c.age+rnd(.2,.8)); });
  hit.setAttribute('aria-label','Loot card. Press and hold to open.');
}

/* ================= input ================= */
function beginHold(){ A.init(); if (S.phase==='revealed'){ fidget(); return; } if (S.phase!=='idle'||S.auto) return; if (S.r<0) assignCard(); S.holding=true; S.downAt=performance.now(); S.sq.v=-2.8*MOTION; A.press(); buzz(6); }
function endHold(){ if(!S.holding) return; S.holding=false; if (S.phase!=='idle') return; if (performance.now()-S.downAt<240 && S.charge<.35) S.auto=true; else if (S.charge<1) S.sq.v+=2.8*MOTION; }
const on={signal:abort.signal};
hit.addEventListener('pointerdown', e=>{ if(e.button>0) return; hit.setPointerCapture?.(e.pointerId); beginHold(); }, on);
window.addEventListener('pointerup', endHold, on); window.addEventListener('pointercancel', endHold, on);
window.addEventListener('pointermove', e=>{ const cx=CX*SC, cy=CY*SC; S.ptr.nx=clamp((e.clientX-cx)/(CWd*SC*.9),-1,1); S.ptr.ny=clamp((e.clientY-cy)/(CHd*SC*.9),-1,1); S.ptr.last=S.t; }, on);
hit.addEventListener('contextmenu', e=>e.preventDefault(), on);
window.addEventListener('keydown', e=>{ const tg=e.target as Element|null; if (tg?.closest?.('button') && tg!==hit) return; if (e.code==='Space'||e.code==='Enter'){ e.preventDefault(); if(e.repeat) return; if (S.phase==='revealed'){ A.init(); leave(); } else beginHold(); } }, on);
window.addEventListener('keyup', e=>{ if (e.code==='Space'||e.code==='Enter') endHold(); }, on);
again.addEventListener('click', ()=>{ A.init(); leave(); hit.focus({preventScroll:true}); }, on);
window.addEventListener('resize', layout, on);

/* ================= simulation ================= */
const CHARGE_T=1.6, CRACK_AT=[.14,.3,.47,.64], TEASE_AT=[.38,.62,.85];
function spring(s: {x:number,v:number},target: number,k: number,c: number,dt: number){ const n=4,h=dt/n; for(let i=0;i<n;i++){ s.v+=(-k*(s.x-target)-c*s.v)*h; s.x+=s.v*h; } }
function tension(c: number, rdt: number, want: boolean, cracks: CrackTier[]){
  if (cracks===backCracks && c>.2 && Math.random()<rdt*c*9) A.clink();
  for(let i=0;i<4;i++) if(!S.reached[i] && c>=CRACK_AT[i]){ S.reached[i]=1; cracks[i].shown=true; if (cracks===backCracks) snapChain(i); A.crack(i); S.trauma=Math.min(1,S.trauma+.25); S.pulse+=.05*MOTION; S.cardI+=.35; sparks(14,S.teaseKey,30,110,.35,S.cx,S.cy,true); buzz(10); }
  cracks.forEach(t=>{ if(t.shown) t.prog=Math.min(1,t.prog+rdt*6); });
  if (want && c>.03){ S.beat-=rdt; if (S.beat<=0){ S.beat=lerp(.62,.15,c); A.heart(c); S.pulse+=(.03+.05*c)*MOTION; S.cardI+=.15+.3*c; buzz(Math.round(6+14*c)); } }
  if (c>.42){ S.zapAcc+=rdt*Math.pow((c-.42)/.58,1.5)*12*(reduce?.3:1); while(S.zapAcc>1){ S.zapAcc--; bolt(Math.random()<.3?'w':S.teaseKey); } }
  S.trauma=Math.max(S.trauma,.4*c*c); S.glow=c; S.cardIT=.5+1.3*c*c; S.amb=lerp(.3,.12,c);
  if (c>.03){ S.suckAcc+=rdt*(18+180*c*c)*(reduce?.4:1); while(S.suckAcc>1){ S.suckAcc--; const a=rnd(0,TAU), d=rnd(55,130); FX.sucks.push({x:S.cx+Math.cos(a)*d, y:S.cy+Math.sin(a)*d*.8, v:rnd(20,50), k:Math.random()<.35?'w':S.teaseKey}); } }
}
function step(dt: number, rdt: number){
  S.t+=dt;
  if (S.phase==='idle'){
    const want=S.holding||S.auto; if (want && (S.r<0||!S.spec)) assignCard(); if (want){ if(!A.charging) A.chargeStart(); S.charge=Math.min(1,S.charge+rdt/CHARGE_T); } else S.charge=Math.max(0,S.charge-rdt*1.3);
    const c=S.charge; A.chargeUpdate(c,S.rt); if(!want && c<=0) A.chargeStop();
    for(let i=0;i<3;i++) if (S.tease<i+1 && S.vr>=i+1 && c>=TEASE_AT[i]) teaseUp(i+1);
    tension(c, rdt, want, backCracks); if (S.auto && c<=0) S.auto=false;
    if (c>=1) burst();
  } else if (S.phase==='upgrading'){
    S.up=Math.min(1,S.up+rdt/1.5); A.chargeUpdate(S.up,S.rt); S.glitch=.2+S.up*.8; tension(S.up, rdt, true, frontCracks);
    if (S.up>=1){ S.vr=S.r; burst(); }
  } else { S.glow=Math.max(0,S.glow-dt*3); S.amb=lerp(S.amb, S.phase==='revealed'?.34:.3, 1-Math.exp(-2*dt)); }
  if (S.phase==='revealed'){
    if (S.after>0){ S.after-=dt; if (S.after<=0) aftershock(); }
    if (S.vr>=2){ S.zapAcc+=dt*(S.vr===3?1.6:.8)*(reduce?.3:1); while(S.zapAcc>1){ S.zapAcc--; bolt(RAR[S.vr].l); } }
    if (S.vr>=1){ S.sparkAcc+=dt*RAR[S.vr].sparkle*(reduce?.4:1); while(S.sparkAcc>1){ S.sparkAcc--; const a=rnd(0,TAU); FX.motes.push({x:S.cx+Math.cos(a)*rnd(36,54), y:S.cy+Math.sin(a)*rnd(48,62), vy:-rnd(4,12), age:0, life:rnd(.8,1.6), k:Math.random()<.5?'w':RAR[S.vr].l}); } }
    S.cardIT = RAR[S.vr].glow*(1+.12*Math.sin(S.rt*2.4));
  }
  if (S.phase==='entering'){ S.summon=Math.min(1,S.summon+rdt/(reduce?.4:.95)); const sp=S.summon;
    S.cardIT=.5+.9*Math.sin(sp*Math.PI); S.beam=Math.max(S.beam,.75*Math.sin(Math.min(1,sp*1.3)*Math.PI));
    if (Math.random()<rdt*70*(1-sp)){ const a=rnd(0,TAU); FX.motes.push({x:CX+Math.cos(a)*rnd(10,28), y:PTOP-1+Math.sin(a)*4, vy:-rnd(25,70), age:0, life:rnd(.4,.9), k:Math.random()<.5?'w':'4'}); }
    if (!S.summonChime && sp>.2){ S.summonChime=true; A.summon(); }
    if (sp>=1){ S.phase='idle'; S.sq.v=5; S.trauma=Math.min(1,S.trauma+.22); ring('4',220,1,0); sparks(22,'c',20,100,.4,CX,CY,true); A.land(); buzz(12); } }
  if (S.phase==='collecting'){ const C=S.col!; C.t=Math.min(1,C.t+rdt/.7); const t=C.t, e=t<.2?-.08*Math.sin(t/.2*Math.PI):Math.pow((t-.2)/.8,2), u=Math.max(0,e);
    S.pos.x=2*(1-u)*u*C.dir*50 + u*u*C.tx; S.pos.y=2*(1-u)*u*(-60) + u*u*C.ty + (e<0?-e*50:0); S.colScale=Math.max(.08,lerp(1,C.s1,u)*(e<0?1+e:1)); S.colSpin=C.dir*u*TAU*1.5;
    if (t>=1 && !C.done){ C.done=true; arrive(); } }
  // springs & timers
  spring(S.sq,0,260,12,dt); spring(S.zoom,1,90,10,dt); S.pulse*=Math.exp(-9*dt);
  if (S.spin.t<1){ S.spin.t=Math.min(1,S.spin.t+dt/S.spin.dur); const e=1-Math.pow(1-S.spin.t,3); S.spin.a=lerp(S.spin.from,S.spin.to,e); }
  const live=S.t-S.ptr.last<2.5, c=tens(), damp=1-c*.8;
  const over=live && Math.abs(S.ptr.nx)<.95 && Math.abs(S.ptr.ny)<.95; const tx=(over?-S.ptr.ny*.34:0)*damp*MOTION, ty=(over?S.ptr.nx*.46:0)*damp*MOTION;
  const k=1-Math.exp(-9*dt); S.tilt.x=lerp(S.tilt.x,tx,k); S.tilt.y=lerp(S.tilt.y,ty,k);
  S.trauma=Math.max(0,S.trauma-dt*1.6); S.rays=lerp(S.rays,S.raysT,1-Math.exp(-1.6*dt)); S.rayAng+=dt*(.22+S.rays*.35);
  S.cardI=lerp(S.cardI,S.cardIT,1-Math.exp(-(S.cardI>S.cardIT?3.4:8)*dt)); S.beam*=Math.exp(-.9*dt); S.torchBoost*=Math.exp(-2*dt); S.ca*=Math.exp(-4*rdt);
  for (let i=0;i<3;i++){ if (S.barFlash[i]>0) S.barFlash[i]-=rdt; }
  // torches
  S.flameAcc+=dt*(26+40*S.torchBoost)*(reduce?.5:1);
  while(S.flameAcc>1){ S.flameAcc--; for (const t of TORCH){ const lean=(S.cx-t.x)*.9*c; FX.flames.push({x:t.x+rnd(-1.5,1.5), y:t.y-1, vx:lean*rnd(.6,1.2)+rnd(-5,5), vy:-rnd(18,40)*(1+S.torchBoost), age:0, life:rnd(.3,.6)*(1+S.torchBoost*.4)}); } }
  for (const t of TORCH){ if (Math.random()<dt*2.5) FX.flames.push({x:t.x, y:t.y-4, vx:rnd(-8,8)+(S.cx-t.x)*.6*c, vy:-rnd(30,60), age:0, life:rnd(1,2), ember:true}); }
  // particles
  const dr=(f: number)=>Math.exp(-f*dt);
  for(const p of FX.sparks){ p.age+=dt; const d=dr(2.2); p.vx*=d; p.vy=p.vy*d+220*dt; p.px=p.x; p.py=p.y; p.x+=p.vx*dt; p.y+=p.vy*dt; if (p.y>p.g && p.vy>0){ p.y=p.g; p.vy*=-.45; p.vx*=.7; } }
  for(const p of FX.tiles){ p.age+=dt; p.vx*=dr(.8); p.vy+=460*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt; if (p.y>p.g && p.vy>0){ p.y=p.g; p.vy*=-.35; p.vx*=.6; p.vr*=.5; } }
  for(const p of FX.confetti){ p.age+=dt; if (p.land) continue; const d=dr(3); p.vx=p.vx*d+Math.sin(p.ph)*22*dt; p.vy=p.vy*d+130*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.ph+=dt*10; if (p.y>=p.g){ p.y=p.g; p.land=true; p.life=p.age+rnd(1.5,3.5); } }
  for(const p of FX.coins){ p.age+=dt; if (p.rest) continue; p.vh-=520*dt; p.h+=p.vh*dt; p.x+=p.vx*dt; p.vx*=dr(.6); p.ph+=dt*(10+Math.abs(p.vh)*.04); if (p.h<=0){ p.h=0; if (Math.abs(p.vh)>40){ A.clink(); p.vh*=-.42; p.vx*=.6; } else { p.rest=true; p.vh=0; } } }
  for(const p of FX.bricks){ p.age+=dt; if (p.rest) continue; p.vy+=560*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=dr(.5); p.rot+=p.vr*dt;
    if (p.y+p.h/2>p.g && p.vy>0){ p.y=p.g-p.h/2; const hard=p.vy;
      if (hard>120 && p.w>=10 && FX.bricks.length<(NARROW?280:500)){ const hw=Math.floor(p.w/2); FX.bricks.push({sx:p.sx+hw,sy:p.sy,w:p.w-hw,h:p.h,x:p.x+hw/2,y:p.y,vx:p.vx+rnd(15,45),vy:-hard*.3,rot:p.rot,vr:rnd(-8,8),g:p.g+rnd(-1,2),age:p.age,life:p.life,rest:false}); p.w=hw; p.x-=hw/2; p.vx-=rnd(15,45); }
      if (hard>45){ p.vy*=-.3; p.vx*=.5; p.vr*=.5; A.thud(); dustAt(p.x,p.y+p.h/2,hard>120?4:2,true); if (hard>150) S.trauma=Math.min(1,S.trauma+.03); }
      else { p.rest=true; p.vy=0; p.vr=0; p.rot=Math.round(p.rot/(Math.PI/2))*(Math.PI/2); } } }
  for(const p of FX.dustp){ p.age+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=dr(2); p.vy*=dr(1.5); }
  for(const p of FX.links){ p.age+=dt; if (p.rest) continue; p.vy+=(p.lock?540:440)*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=dr(.7); if (p.y>p.g && p.vy>0){ p.y=p.g; if (Math.abs(p.vy)>45){ p.vy*=-(p.lock?.3:.38); p.vx*=.6; if (p.lock) A.clunk(); else A.clink(); } else p.rest=true; } }
  for(const p of FX.sucks){ const dx=S.cx-p.x, dy=S.cy-p.y, d=Math.hypot(dx,dy)||1; p.px=p.x; p.py=p.y; p.v+=(120+520*tens())*dt; const m=Math.min(d,p.v*dt); p.x+=dx/d*m; p.y+=dy/d*m; p.d=d; }
  for(const p of FX.motes){ p.age+=dt; p.y+=p.vy*dt; }
  for(const p of FX.flames){ p.age+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=dr(1.5); if (!p.ember) p.vy*=dr(.5); else { p.vx+=Math.sin(p.age*5)*6*dt; } }
  for(const p of FX.bolts) p.age+=dt;
  for(const p of FX.rings){ p.age+=dt; if(p.age>0){ p.r+=p.v*dt; p.v*=dr(2.6); } }
  for(const p of FX.dust){ const dx=S.cx-p.x, dy=S.cy-p.y, d=Math.hypot(dx,dy)||1, pull=c*c*120; p.vx+=(dx/d*pull + Math.sin(S.t*.5+p.ph)*1.5)*dt; p.vy+=(dy/d*pull + Math.cos(S.t*.4+p.ph)*1.2)*dt; p.vx*=dr(1.2); p.vy*=dr(1.2); p.x+=p.vx*dt; p.y+=p.vy*dt; if (d<10 || p.x<0||p.x>W||p.y<0||p.y>HY){ p.x=rnd(0,W); p.y=rnd(0,HY); p.vx=0; p.vy=0; } }
  FX.sparks=FX.sparks.filter(p=>p.age<p.life); FX.tiles=FX.tiles.filter(p=>p.age<p.life); FX.confetti=FX.confetti.filter(p=>p.age<p.life); FX.sucks=FX.sucks.filter(p=>p.d===undefined||p.d>8);
  FX.motes=FX.motes.filter(p=>p.age<p.life); FX.bolts=FX.bolts.filter(p=>p.age<p.life); FX.rings=FX.rings.filter(p=>p.age<p.life); FX.flames=FX.flames.filter(p=>p.age<p.life); FX.coins=FX.coins.filter(p=>p.age<p.life); FX.links=FX.links.filter(p=>p.age<p.life); FX.bricks=FX.bricks.filter(p=>p.age<p.life); FX.dustp=FX.dustp.filter(p=>p.age<p.life);
  if (FX.sparks.length>1500) FX.sparks.splice(0,FX.sparks.length-1500);
}
function ui(rdt: number){
  if (S.phase==='revealed'){ for(let k=0;k<3;k++){ if (S.barDone[k]) continue; const e=S.rt-S.barT[k]; if (e<0) continue; const p=Math.min(1,e/.32); const v=S.barTarget[k]*(1-Math.pow(1-p,3));
      if (Math.round(v*36)!==Math.round(S.bars[k]*36)) A.bar(p,k); S.bars[k]=v;
      if (p>=1){ S.barDone[k]=1; S.barFlash[k]=.18; A.barEnd(k); S.pulse+=.03*MOTION; sparks(10+S.vr*4, RAR[S.vr].l, 20, 80, .4, Math.round(S.cx-32+21+36*S.bars[k]), Math.round(S.cy-45+68+k*6), true); buzz(10); } } }
  slotFlash=slotFlash.map(v=>Math.max(-1,v-rdt));
}

/* ================= lighting pass (per brick / tile, per pixel on the altar) ================= */
function lightPass(ox: number,oy: number){
  const cx=S.cx, cy=S.cy, cI=S.cardI, cR2=(30+24*Math.min(cI,2.2))**2, amb=S.amb, c=tens();
  const cRamp=RAMPU[S.lightKey]||RAMPU.s, SEL=[RAMPU.stone, RAMPU.warm, cRamp];
  const T=TORCH.map((t,i)=>({x:t.x, y:t.y-3, I:(.78+.14*Math.sin(S.t*13+i*2)+.07*Math.sin(S.t*31+i)+(Math.random()-.5)*.05)*(1+S.torchBoost)*(1-.45*c), R2:(26+12*S.torchBoost)**2}));
  const rays=Math.min(1,S.rays), nR=12, beam=S.beam, bw=15+8*Math.min(beam,1), rayRamp=S.vr>=0?RAMPU[RAR[S.vr].ramp]:cRamp;
  const light=(x: number,y: number): [number,number,boolean]=>{ const fy=y>=HY?1.7:1, dyc=(y-cy)*fy, dxc=x-cx; let lc=cI*cR2/(cR2+dxc*dxc+dyc*dyc);
    let lw=0; for (const t of T){ const a=x-t.x, b=(y-t.y)*fy; lw+=t.I*t.R2/(t.R2+a*a+b*b); }
    let inBeam=false; if (beam>.03 && y<cy && Math.abs(dxc)<bw){ lc+=beam*(1-Math.abs(dxc)/bw)*1.1; inBeam=true; } return [lc,lw,inBeam]; };
  for(let u=0;u<NU;u++){ if (UST[u]===2) continue; const x=UX[u], y=UY[u]; const [lc,lw,inBeam]=light(x,y); const L=amb+lw+lc; let lvl=tone(UALB[u]*L);
    const h=UHASH[u]; let sel = (inBeam || lc/L > .2+.5*h) ? 2 : (lw/L > .26+.44*h ? 1 : 0);
    if (rays>.02){ const a=Math.atan2(y-cy,x-cx)+S.rayAng, per=TAU/nR, sec=((a%per)+per)%per; if (sec<.17){ const d=Math.hypot(x-cx,y-cy), iv=rays*(1-d/(Math.max(W,H)*.9)); if (iv>.15+h*.3){ lvl+= iv>.55?2:1; sel=3; } } }
    ULVL[u]=lvl>6?6:lvl; URAMP[u]=sel; }
  const rings=FX.rings.filter(r=>r.age>0).map(r=>[r.r, Math.max(1,Math.round(r.w*(1-r.age/r.life))), U32[r.k]]);
  const K=U32.k;
  for(let y=0;y<H;y++){ const row=y*W; for(let x=0;x<W;x++){ const i=row+x, u=UNIT[i]; let col;
      if (u>=0){ const st=UST[u]; if (st===2) col=VOID32[i]; else { let l=ULVL[u]+OFF[i]+(st===1?2:0); if (l<0) l=0; else if (l>6) l=6; const sel=st===1?3:URAMP[u]; col=(sel===3?rayRamp:SEL[sel])[l]; } }
      else { const a=PIXA[i]; if (a<=0) col=K; else { const [lc,lw]=light(x,y), L=amb+lw+lc; const l=tone(a*L), b2=BAYER[((y+2)&3)*4+((x+1)&3)]; col=(lc/L>.2+.5*b2?cRamp:lw/L>.3+.4*b2?RAMPU.warm:RAMPU.stone)[l]; } }
      if (rings.length){ const dd=Math.sqrt((x-cx)*(x-cx)+(y-cy)*(y-cy)); for(let q=0;q<rings.length;q++) if (Math.abs(dd-rings[q][0])<rings[q][1]){ col=rings[q][2]; break; } }
      scene32[i]=col; } }
  sceneG.putImageData(sceneImg,0,0);
  g.fillStyle=PAL.k; g.fillRect(0,0,W,H); g.drawImage(sceneC,ox,oy);
}

/* ================= render ================= */
function drawCoin(x: number,y: number,ph: number){ const f=Math.floor(ph)%4, sw=[1,.6,.18,.6][f]; x=Math.round(x); y=Math.round(y);
  for(let yy=-3;yy<=2;yy++){ const hw=Math.max(0,Math.round(Math.sqrt(9-(yy+.5)*(yy+.5))*sw)); const l=x-hw, w=hw*2+1;
    g.fillStyle=PAL.k; g.fillRect(l-1,y+yy,w+2,1); if (yy===-3||yy===2){ g.fillRect(l,y+yy-(yy<0?1:-1),w,1); }
    g.fillStyle=PAL[yy<=-2?'o':yy>=1?'Y':'y']; g.fillRect(l,y+yy,w,1); if (w>=5 && yy>-2 && yy<1){ g.fillStyle=PAL.Y; g.fillRect(x,y+yy,1,1); g.fillStyle=PAL.o; g.fillRect(l,y+yy,1,1); } } }
function render(){
  const tr=S.trauma*S.trauma*MOTION, ox=Math.round((Math.sin(S.t*37)*.6+Math.sin(S.t*61)*.4)*7*tr), oy=Math.round((Math.sin(S.t*43+1)*.6+Math.sin(S.t*71)*.4)*7*tr);
  const c=tens(), bob=(S.phase==='idle'||S.phase==='revealed')?Math.round(Math.sin(S.t*2.2)*2*(1-c)*MOTION):0;
  const jx=Math.round((Math.random()-.5)*c*c*4*MOTION), jy=Math.round((Math.random()-.5)*c*c*2*MOTION), lift=-Math.round(5*c*MOTION);
  S.cx=CX+Math.round(S.pos.x); S.cy=CY+Math.round(S.pos.y)+bob+lift;
  g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation='source-over';
  lightPass(ox,oy);
  // dust motes (lit)
  for (const p of FX.dust){ const x=Math.round(p.x)+ox, y=Math.round(p.y)+oy, d=Math.hypot(p.x-S.cx,p.y-S.cy); const lit=S.cardI*2200/(2200+d*d) + (Math.min(...TORCH.map(t=>Math.hypot(p.x-t.x,p.y-t.y)))<30?.6:0); if (lit<.25) continue; g.fillStyle=PAL[lit>.9?(RAMPS[S.lightKey]||RAMPS.s)[6]:lit>.5?(RAMPS[S.lightKey]||RAMPS.s)[5]:'5']; g.fillRect(x,y,1,1); }
  // shadow on altar
  if (!S.hidden && S.phase!=='collecting'){ const air=S.phase==='entering'?S.summon:1; const sw=Math.round(46*air*(1-c*.25)*Math.max(.3,Math.abs(Math.cos(S.spin.a)))); if (sw>2){ g.fillStyle=pat(g,'k',.7); g.fillRect(CX-Math.round(sw/2)+ox, PTOP+1+oy, sw, 2); g.fillStyle=pat(g,'k',.35); g.fillRect(CX-Math.round(sw/2)-3+ox, PTOP+3+oy, sw+6, 1); } }
  // floor stuff: coins, tiles, confetti on floor
  for(const p of FX.coins){ const t=p.age/p.life; if (t>.85 && (Math.floor(p.age*20)&1)) continue; g.fillStyle=pat(g,'k',.6); g.fillRect(Math.round(p.x)-2+ox, Math.round(p.gy)+1+oy, 5, 1); drawCoin(p.x+ox, p.gy-p.h+oy-1, p.rest?(Math.floor(p.x*7)%3===0?1:0):p.ph); }
  // void stars twinkle through the broken wall
  if (S.wall.active){ for (const [x,y,ph] of VOIDSTARS){ const u=UNIT[y*W+x]; if (u<0||UST[u]!==2) continue; const tw=Math.sin(S.t*2.6+ph); if (tw<.55) continue; const X=x+ox, Y=y+oy; g.fillStyle=PAL.w; g.fillRect(X,Y,1,1);
      if (tw>.93){ g.fillStyle=PAL[(RAMPS[RAR[S.wall.r].ramp])[5]]; g.fillRect(X-1,Y,1,1); g.fillRect(X+1,Y,1,1); g.fillRect(X,Y-1,1,1); g.fillRect(X,Y+1,1,1); } } }
  // falling bricks + dust
  for(const p of FX.bricks){ const t=p.age/p.life; if (t>.88&&(Math.floor(p.age*20)&1)) continue; const X=Math.round(p.x)+ox, Y=Math.round(p.y)+oy, a=Math.round(p.rot*4)/4;
    if (p.rest || a===0){ g.drawImage(snapC,p.sx,p.sy,p.w,p.h,X-Math.floor(p.w/2),Y-Math.floor(p.h/2),p.w,p.h); if (p.rest){ g.fillStyle=PAL.k; g.fillRect(X-Math.floor(p.w/2),Y+Math.ceil(p.h/2),p.w,1); } }
    else { brG.setTransform(1,0,0,1,0,0); brG.clearRect(0,0,20,20); brG.translate(10,10); brG.rotate(a); brG.drawImage(snapC,p.sx,p.sy,p.w,p.h,-p.w/2,-p.h/2,p.w,p.h); g.drawImage(brC,X-10,Y-10); } }
  for(const p of FX.dustp){ const t=p.age/p.life; if (t>.6 && (Math.floor(p.age*24)&1)) continue; g.fillStyle=PAL[t<.4?'4':'5']; g.fillRect(Math.round(p.x)+ox,Math.round(p.y)+oy,t<.3?2:1,t<.3?2:1); }
  // broken chain links + padlock
  { const hotC=RAMPS[RAR[Math.max(0,S.tease)].ramp][4];
    for(const p of FX.links){ const t=p.age/p.life; if (t>.85&&(Math.floor(p.age*20)&1)) continue; const x=Math.round(p.x)+ox, y=Math.round(p.y)+oy;
      if (p.lock){ g.fillStyle=pat(g,'k',.6); g.fillRect(x-5,Math.round(p.g)+1+oy,11,1); g.drawImage(!p.rest&&Math.floor(p.age*12)%2?LOCKM:LOCKC, x-5, y-12); continue; }
      const hot=p.age<.6, col=hot?hotC:'S', hi=hot?'w':'s';
      if (p.odd){ g.fillStyle=PAL.k; g.fillRect(x,y+1,2,1); g.fillStyle=PAL[col]; g.fillRect(x,y,2,1); g.fillStyle=PAL[hi]; g.fillRect(x,y,1,1); }
      else { g.fillStyle=PAL.k; g.fillRect(x,y,3,3); g.fillStyle=PAL[col]; g.fillRect(x-1,y-1,3,1); g.fillRect(x-1,y+1,3,1); g.fillRect(x-1,y,1,1); g.fillRect(x+1,y,1,1); g.fillStyle=PAL[hi]; g.fillRect(x-1,y-1,1,1); } } }
  // summoning circle
  if (S.phase==='entering' && S.summon<1){ const sp=S.summon, fade=sp<.8?1:(1-sp)/.2, rx=Math.round(30*Math.min(1,sp*2.4)), ry=Math.max(1,Math.round(rx*.2)), cyc=PTOP-1+oy, arc=TAU*Math.min(1,sp*1.8);
    if (rx>2) for(let a=0;a<arc;a+=.6/rx){ if (Math.random()>fade) continue; const aa=a+S.t*1.6; g.fillStyle=PAL[(Math.floor(a*6)%5===0)?'o':'c']; g.fillRect(Math.round(CX+Math.cos(aa)*rx)+ox, Math.round(cyc+Math.sin(aa)*ry), 1, 1); }
    for(let k=0;k<8;k++){ const aa=k/8*TAU-S.t*2.2, rr=rx*.7; if (sp>.2+k*.05 && Math.random()<fade){ g.fillStyle=PAL.y; g.fillRect(Math.round(CX+Math.cos(aa)*rr)+ox-1, Math.round(cyc+Math.sin(aa)*rr*.2), 2, 1); } } }
  // torch halos + flames
  for (const t of TORCH){ const fl=1+.15*Math.sin(S.t*13)+S.torchBoost*.6, x=t.x+ox, y=t.y-3+oy; for(const [r,k,l] of [[Math.round(7*fl),'Y',.35],[Math.round(4*fl),'y',.6],[2,'o',.9]] as [number,string,number][]){ g.fillStyle=pat(g,k,l); for(let yy=-r;yy<=r;yy++){ const hw=Math.round(Math.sqrt(r*r-yy*yy)); g.fillRect(x-hw,y+yy,hw*2+1,1); } } }
  for(const p of FX.flames){ const t=p.age/p.life, x=Math.round(p.x)+ox, y=Math.round(p.y)+oy;
    if (p.ember){ g.fillStyle=PAL[t<.5?'y':t<.8?'Y':'r']; g.fillRect(x,y,1,1); continue; }
    const k=t<.15?'w':t<.3?'o':t<.5?'y':t<.7?'Y':t<.85?'r':'R'; g.fillStyle=PAL[k]; const s=p.big?(t<.5?4:2):(t<.3?3:t<.6?2:1); g.fillRect(x-(s>>1),y-(s>>1),s,s); }
  // sucks
  for(const p of FX.sucks){ g.fillStyle=PAL[p.k]; line(g,p.px!+ox,p.py!+oy,p.x+ox,p.y+oy); }
  // card
  const showFront = S.phase==='revealed'||S.phase==='upgrading'||S.phase==='collecting'||(S.phase==='hitstop'&&S.upgrading);
  layerG.clearRect(0,0,W,H);
  if (!S.hidden){
    if (showFront) drawFront(S.rt); else drawBack(S.rt);
    let sc=1+S.pulse, ry=S.tilt.y+S.spin.a, rx=S.tilt.x;
    if (S.phase==='collecting'){ sc=S.colScale; ry+=S.colSpin; }
    const sqx=1+S.sq.x, sqy=1-S.sq.x*.6;
    const shine = showFront ? (S.vr>=1?.9:.5) : .35;
    if (S.glow>.05){ const gw=Math.round(1+5*S.glow), w=Math.round(CWd*sc*Math.max(.15,Math.abs(Math.cos(ry)))), h=Math.round(CHd*sc); const x=S.cx-Math.round(w/2)+ox+jx, y=S.cy-Math.round(h/2)+oy+jy;
      const ring=(o: number,col: string)=>{ layerG.fillStyle=PAL[col]; layerG.fillRect(x-o,y-o,w+2*o,1); layerG.fillRect(x-o,y+h+o-1,w+2*o,1); layerG.fillRect(x-o,y-o,1,h+2*o); layerG.fillRect(x+w+o-1,y-o,1,h+2*o); };
      const tk=S.teaseKey, rp=RAMPS[RAR[Math.max(0,S.tease)].ramp]; ring(1,tk); if (S.glow>.35) ring(2,rp[4]); if (S.glow>.7 && Math.floor(S.rt*16)%2) ring(3,rp[3]); }
    drawCard3D(layerG, showFront?frontC:(S.phase==='entering'?dissolve(backC,clamp((S.summon-.15)/.75,0,1.08)):backC), showFront?null:(S.backOn?null:null), S.cx+ox+jx, S.cy+oy+jy+Math.round((1-sqy)*CHd*.5), ry, rx, sc*(sqx+sqy)/2, shine);
  }
  if (S.phase==='hitstop'){ renderImpact(ox,oy); return; }
  g.drawImage(layerC,0,0);
  // tiles (rotated nearest-neighbour)
  for(const p of FX.tiles){ const t=p.age/p.life; if (t>.7 && (Math.floor(p.age*30)&1)) continue; rotG.clearRect(0,0,16,16); rotG.save(); rotG.translate(8,8); rotG.rotate(Math.round(p.rot*4)/4); rotG.drawImage(tileSrcC,p.sx,p.sy,p.w,p.h,-p.w/2,-p.h/2,p.w,p.h); rotG.restore(); g.drawImage(rotC,Math.round(p.x)-8+ox,Math.round(p.y)-8+oy); }
  // bolts
  for(const b of FX.bolts){ if (Math.random()<.25) continue; g.fillStyle=PAL[b.k]; for(let i=0;i<b.pts.length-1;i++){ const [x0,y0]=b.pts[i],[x1,y1]=b.pts[i+1]; line(g,x0+ox+1,y0+oy,x1+ox+1,y1+oy); line(g,x0+ox,y0+oy+1,x1+ox,y1+oy+1); }
    g.fillStyle=PAL.w; for(let i=0;i<b.pts.length-1;i++){ const [x0,y0]=b.pts[i],[x1,y1]=b.pts[i+1]; line(g,x0+ox,y0+oy,x1+ox,y1+oy); } }
  // sparks
  const dk=RAR[Math.max(0,S.vr)].d;
  for(const p of FX.sparks){ const t=p.age/p.life; const k=t>.6&&(Math.floor(p.age*24)&1)?dk:p.k; g.fillStyle=PAL[k]; const s=p.big&&t<.5?2:1; g.fillRect(Math.round(p.x)+ox,Math.round(p.y)+oy,s,s);
    if (t<.45 && p.px!==undefined){ g.fillStyle=PAL[dk]; line(g,p.px+ox,p.py!+oy,p.x+ox,p.y+oy); g.fillStyle=PAL[k]; g.fillRect(Math.round(p.x)+ox,Math.round(p.y)+oy,s,s); } }
  for(const p of FX.confetti){ const t=p.age/p.life; if (t>.8&&(Math.floor(p.age*20)&1)) continue; g.fillStyle=PAL[p.k]; const hor=p.land?true:Math.sin(p.ph)>0; g.fillRect(Math.round(p.x)+ox,Math.round(p.y)+oy-(hor?0:1),hor?2:1,hor?1:2); }
  for(const p of FX.motes){ const t=p.age/p.life, s=t<.3||t>.7?0:1, x=Math.round(p.x)+ox, y=Math.round(p.y)+oy; g.fillStyle=PAL.w; g.fillRect(x,y,1,1); if (s){ g.fillStyle=PAL[p.k]; g.fillRect(x-1,y,1,1); g.fillRect(x+1,y,1,1); g.fillRect(x,y-1,1,1); g.fillRect(x,y+1,1,1); } }
  if(!APP.noR) reflect(ox,oy);
  // title
  if (S.title){ const T=S.title, str=T.text, tw=textW(str,TS), x0=Math.round(CX-tw/2), yBase=Math.round(CY-CHd/2-5*TS-10); const shine=((S.rt*1.1)%2.2)*(str.length+6)/1.6-3;
    for(let i=0;i<str.length;i++){ const e=S.rt-T.t0-.06-i*.055; if (e<0) continue; let dy; if (e<.18){ const p=e/.18; dy=-Math.round((1-p*p)*34); } else if (e<.32){ dy=Math.round(Math.sin((e-.18)/.14*Math.PI)*-4); } else dy=Math.round(Math.sin(S.rt*4+i*.7)*1.3);
      const qx=T.quake?ri(-2,2):0, qy=T.quake?ri(-1,1):0; const lit=Math.abs(i-shine)<1.2;
      const tr=T.ramp, rf=tr ? (row: number)=> lit&&row<3 ? (row===0?'w':'o') : tr[row] : (row: number)=> row===0 ? CYCLE[(Math.floor(S.rt*10)+i)%CYCLE.length] : ['o','y','Y','R'][row-1];
      drawRampText(g,str[i],x0+i*4*TS+qx+ox,yBase+dy+qy+oy,TS,rf); } }
  // stamp
  if (S.stamp){ const e=S.rt-S.stamp.t0, fin=W>=300?2:1, s=e<.05?fin+3:e<.1?fin+2:e<.16?fin+1:fin, str=S.stamp.text, tw=textW(str,s), bx=Math.round(S.cx+CWd/2-tw/2-4)+ox, by=Math.round(S.cy-CHd/2-6)+oy;
    g.fillStyle=PAL.k; g.fillRect(bx-4,by-4,tw+8,5*s+8); g.fillStyle=PAL[S.stamp.key]; g.fillRect(bx-3,by-3,tw+6,5*s+6); g.fillStyle=PAL.w; g.fillRect(bx-3,by-3,tw+6,1); g.fillStyle=PAL[S.stamp.key==='y'?'Y':'5']; g.fillRect(bx-3,by+5*s+2,tw+6,1); drawText(g,str,bx,by,s,'k'); }
  // hint
  if (S.phase==='idle' && S.charge<.05 && Math.floor(S.rt*2)%2===0){ const str=S.auto?'HERE IT COMES':'HOLD TO OPEN'; drawText(g,str,Math.round(CX-textW(str,1)/2),PBASE+8,1,'c','k'); }
  // bag
  for(let i=0;i<POOL.length;i++){ const r=slotRect(i), fl=slotFlash[i]>0&&(Math.floor(slotFlash[i]*20)&1), R=RAR[POOL[i].r];
    g.fillStyle=PAL.k; g.fillRect(r.x-1,r.y-1,r.w+2,r.h+2); g.fillStyle=PAL[slotShown[i]?R.d:1]; g.fillRect(r.x,r.y,r.w,r.h); g.fillStyle=PAL[slotShown[i]?R.l:2]; g.fillRect(r.x,r.y,r.w,1); g.fillRect(r.x,r.y,1,r.h);
    if (fl){ g.fillStyle=PAL.w; g.fillRect(r.x,r.y,r.w,r.h); } else if (slotShown[i]){ const s=r.w>=16?16:8, o=Math.floor((r.w-s)/2); g.drawImage(SPRITES.spr16[POOL[i].spr],0,0,16,16,r.x+o,r.y+o,s,s); }
    else { g.fillStyle=PAL[0]; g.fillRect(r.x+Math.floor(r.w/2)-1,r.y+Math.floor(r.h/2)-1,2,2); } }
  if (!NARROW){ const last=slotRect(POOL.length-1); drawText(g,`${shownCount()}/${POOL.length}`,last.x+last.w+4,last.y+Math.floor(last.h/2)-2,1,'4','k'); }
  // letterbox
  if (S.box>.02){ const bh=Math.round(S.box*H*.1); g.fillStyle=PAL.k; g.fillRect(0,0,W,bh); g.fillRect(0,H-bh,W,bh); }
  // flash
  if (S.flash>.03){ g.fillStyle = S.flash>.85 ? PAL[S.flashKey] : pat(g,S.flashKey, S.flash); g.fillRect(0,0,W,H); }
  postFX(); bloomCopy();
  stage.style.transform = Math.abs(S.zoom.x-1)>.0005 ? `scale(${S.zoom.x.toFixed(4)})` : '';
}
function reflect(ox: number,oy: number){
  const hy=HY+oy, sc32=scene32; if (hy>=H-2 || !sc32) return;
  const img=g.getImageData(0,0,W,H), d=new Uint32Array(img.data.buffer), T=S.t, span=H-hy;
  for(let y=Math.max(0,hy+1);y<H;y++){ const dist=y-hy, sy=Math.round(hy-1-dist*1.45); if (sy<0) break; const str=(NARROW?.36:.5)*(1-dist/span); if (str<.04) continue;
    const wob=dist>3?Math.round(Math.sin(y*.85+T*2.4)):0, by=(y&3)*4, row=y*W, srow=sy*W, scy=y-oy; if (scy<0||scy>=H) continue;
    for(let x=0;x<W;x++){ if (BAYER[by+(x&3)]>=str) continue; const scx=x-ox; if (scx<0||scx>=W) continue; const si=scy*W+scx; if (UNIT[si]<0) continue; const cur=d[row+x]; if (cur!==sc32[si]) continue;
      const xs=x+wob; if (xs<0||xs>=W) continue; const src=d[srow+xs]; const lc=(cur&255)+((cur>>>8)&255)+((cur>>>16)&255), ls=(src&255)+((src>>>8)&255)+((src>>>16)&255); if (ls>lc+140) d[row+x]=src; } }
  g.putImageData(img,0,0);
}
function renderImpact(ox: number,oy: number){
  const e=1-S.hitstop/S.hitstopDur;
  if (e<.22){ g.drawImage(layerC,0,0); g.globalCompositeOperation='difference'; g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.globalCompositeOperation='source-over'; }
  else { const dark=e<.66, bgc=dark?PAL.k:PAL.w, fg=dark?PAL.w:PAL.k; g.fillStyle=bgc; g.fillRect(0,0,W,H);
    g.fillStyle=fg; const Rm=Math.hypot(W,H); for(let i=0;i<46;i++){ const a=Math.random()*TAU, r0=rnd(52,80), r1=Rm; line(g,S.cx+Math.cos(a)*r0,S.cy+Math.sin(a)*r0,S.cx+Math.cos(a)*r1,S.cy+Math.sin(a)*r1); if (i%3===0) line(g,S.cx+Math.cos(a)*r0+1,S.cy+Math.sin(a)*r0,S.cx+Math.cos(a)*r1+1,S.cy+Math.sin(a)*r1); }
    silG.clearRect(0,0,W,H); silG.drawImage(layerC,0,0); silG.globalCompositeOperation='source-in'; silG.fillStyle=fg; silG.fillRect(0,0,W,H); silG.globalCompositeOperation='source-over';
    g.drawImage(silC,0,0); g.fillStyle=fg; for(let i=0;i<3;i++){ const r=Math.round(60+e*80+i*14); for(let a=0;a<TAU;a+=.05){ if (Math.random()<.5) g.fillRect(Math.round(S.cx+Math.cos(a)*r),Math.round(S.cy+Math.sin(a)*r),1,1); } }
    if (!reduce && !NARROW){ const hw=Math.ceil(W/2), hh=Math.ceil(H/2), sx=Math.round(clamp(S.cx-W/4,0,W-hw)), sy=Math.round(clamp(S.cy-H/4,0,H-hh)); silG.clearRect(0,0,W,H); silG.drawImage(cv,0,0); g.drawImage(silC,sx,sy,hw,hh,0,0,hw*2,hh*2); } }
  bloomCopy(); stage.style.transform=`scale(${S.zoom.x.toFixed(4)})`;
}
function postFX(){
  const k=Math.round(S.ca*3*MOTION), gl=S.glitch;
  if (k<1 && gl<.05) return;
  const img=g.getImageData(0,0,W,H), d=img.data, src=new Uint8ClampedArray(d);
  for(let y=0;y<H;y++){ const tear = gl>.05 && Math.random()<gl*.08 ? ri(-6,6) : 0; const row=y*W;
    for(let x=0;x<W;x++){ const o=(row+x)*4; const xr=clamp(x+k+tear,0,W-1), xb=clamp(x-k+tear,0,W-1), xg=clamp(x+tear,0,W-1);
      d[o]=src[(row+xr)*4]; d[o+1]=src[(row+xg)*4+1]; d[o+2]=src[(row+xb)*4+2]; } }
  g.putImageData(img,0,0);
}
function bloomCopy(){ bg.imageSmoothingEnabled=true; bg.clearRect(0,0,bloomC.width,bloomC.height); bg.drawImage(cv,0,0,bloomC.width,bloomC.height); }

/* ================= loop ================= */
let last=performance.now();
function tick(rdt: number){
  S.rt+=rdt;
  if (S.phase==='hitstop'){ S.hitstop-=rdt; if (S.hitstop<=0){ release(); } render(); return; }
  if (S.slowmo>0){ S.slowmo-=rdt; S.ts=lerp(S.ts,.2,1-Math.exp(-25*rdt)); } else S.ts=lerp(S.ts,1,1-Math.exp(-3.5*rdt));
  S.flash*=Math.exp(-7*rdt);
  if (A.ctx && A.on){ S.crk-=rdt; if (S.crk<=0){ S.crk=rnd(.05,.4)*(1-.5*S.torchBoost/1.5); A.crackle(Math.random()<.5?-.55:.55); } }
  step(rdt*S.ts, rdt); wallStep(rdt); ui(rdt);
  const boxT=(S.slowmo>0||S.phase==='upgrading'||(S.phase==='idle'&&S.charge>.8&&S.vr>=2))&&!reduce?1:0; S.box=lerp(S.box,boxT,1-Math.exp(-(boxT?9:3)*rdt));
  render();
}
let raf=0;
function frame(now: number){
  if (abort.signal.aborted) return;
  if (APP.paused){ last=now; raf=requestAnimationFrame(frame); return; }
  const raw=Math.max(0,(now-last)/1000), rdt=Math.min(1/30,raw); last=now;
  try{ tick(rdt); }catch(e){ console.error(e); hooks.onError?.(e instanceof Error?e.message:String(e)); return; }
  raf=requestAnimationFrame(frame);
}
buildBackBase(); layout(); startEnter();
document.fonts?.ready.then(()=>{ if (!abort.signal.aborted) layout(); });
raf=requestAnimationFrame(frame);
Object.assign(APP,{ S, force:(r: number)=>{S.force=r;}, step:(d: number)=>tick(d), render, beginHold, endHold, leave, FX });
window.APP=APP; window.__ready=true;

return {
  setForce(r: number){ A.init(); S.force=r; A.blip(); if (S.phase==='idle' && S.charge===0 && !S.holding) S.r=-1; },
  setSound(v: boolean){ A.init(); A.setOn(v); },
  resetBag(){ A.init(); BAG={owned:{},complete:false}; saveBag(BAG); slotShown=POOL.map(()=>false); hooks.onBagComplete?.(false); A.blip(); },
  destroy(){ abort.abort(); cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers.clear(); A.close(); stage.style.transform='';
    if (window.APP===APP){ delete window.APP; delete window.__ready; } },
};
}
