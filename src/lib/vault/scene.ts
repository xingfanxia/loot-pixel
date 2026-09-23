import type { Vault } from './context';
import { clamp, mk, mulberry, type Ctx2D } from './util';

/**
 * The vault as lit units: every wall brick and floor flagstone is one unit (one albedo, lit as a
 * whole, pixel offsets for mortar and bevels); the altar and sconces are lit per pixel (PIXA).
 * Wall units also carry the wall-breakdown state (UST 0 intact, 1 glowing, 2 fallen).
 */
export interface SceneUnits {
  UNIT: Int32Array; OFF: Int8Array; PIXA: Float32Array; NU: number;
  UX: Float32Array; UY: Float32Array; UALB: Float32Array; UHASH: Float32Array; ULVL: Int8Array; URAMP: Uint8Array;
  UB0X: Int16Array; UB0Y: Int16Array; UST: Uint8Array; UDEL: Float32Array; URST: Float32Array; WALLU: number[];
  VOID32: Uint32Array; VOIDSTARS: [number, number, number][];
  snapC: HTMLCanvasElement; snapG: Ctx2D; sceneC: HTMLCanvasElement; sceneG: Ctx2D; sceneImg: ImageData; scene32: Uint32Array;
}

export function emptyUnits(): SceneUnits {
  const [snapC, snapG] = mk(1, 1), [sceneC, sceneG] = mk(1, 1), sceneImg = sceneG.createImageData(1, 1);
  return { UNIT: new Int32Array(0), OFF: new Int8Array(0), PIXA: new Float32Array(0), NU: 0, UX: new Float32Array(0), UY: new Float32Array(0), UALB: new Float32Array(0),
    UHASH: new Float32Array(0), ULVL: new Int8Array(0), URAMP: new Uint8Array(0), UB0X: new Int16Array(0), UB0Y: new Int16Array(0), UST: new Uint8Array(0),
    UDEL: new Float32Array(0), URST: new Float32Array(0), WALLU: [], VOID32: new Uint32Array(0), VOIDSTARS: [], snapC, snapG, sceneC, sceneG, sceneImg, scene32: new Uint32Array(sceneImg.data.buffer) };
}

export function buildScene(V: Vault) {
  const { W, H, HY, CX, PTOP, PBASE, TORCH } = V.L;
  const N=W*H, rng=mulberry(77), UNIT=new Int32Array(N).fill(-1), OFF=new Int8Array(N), PIXA=new Float32Array(N).fill(-1);
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
  const NU=ux.length, WALLU: number[]=[]; for(let u=0;u<NU;u++) if (uw[u]) WALLU.push(u);
  const [snapC,snapG]=mk(W,H), [sceneC,sceneG]=mk(W,H), sceneImg=sceneG.createImageData(W,H);
  V.U={ UNIT, OFF, PIXA, NU, UX:Float32Array.from(ux), UY:Float32Array.from(uy), UALB:Float32Array.from(ua), UHASH:Float32Array.from(uh), ULVL:new Int8Array(NU), URAMP:new Uint8Array(NU),
    UB0X:Int16Array.from(bx0), UB0Y:Int16Array.from(by0), UST:new Uint8Array(NU), UDEL:new Float32Array(NU).fill(Infinity), URST:new Float32Array(NU), WALLU,
    VOID32:new Uint32Array(W*H), VOIDSTARS:[], snapC, snapG, sceneC, sceneG, sceneImg, scene32:new Uint32Array(sceneImg.data.buffer) };
  V.S.wall.active=false; V.S.wall.rebuild=false;
}

export const tone=(v: number)=>{ const l=Math.floor(6.35*(1-Math.exp(-1.3*v))); return l<0?0:l>6?6:l; };
