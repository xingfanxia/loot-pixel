import type { Vault } from './context';
import { BAYER, PAL } from './palette';
import { clamp, mk, type Ctx2D } from './util';

/** Cached 4x4 Bayer pattern of `col` at coverage `level` (0..1): palette-only transparency. */
export function pat(V: Vault, ctx: Ctx2D, col: string, level: number){ const B=V.B; level=clamp(Math.round(level*16),0,16); const key=col+'|'+level+'|'+(ctx===B.g?'m':ctx===B.t1G?'t':'o'); let p=B.patCache.get(key); if (p) return p;
  const [c,x]=mk(4,4); x.fillStyle=PAL[col]||col; for(let i=0;i<16;i++) if (BAYER[i]<level/16) x.fillRect(i%4,Math.floor(i/4),1,1); p=ctx.createPattern(c,'repeat')!; B.patCache.set(key,p); return p; }

const FOC=240;

/**
 * Pseudo-3D card: column strips give the Y rotation (with the theme's edge colour when side-on), dithered
 * shade + foil band go on source-atop, then rows give the X tilt while blitting onto ctx.
 */
export function drawCard3D(V: Vault, ctx: Ctx2D, face: HTMLCanvasElement, back: HTMLCanvasElement|null, cx: number, cy: number, ry: number, rx: number, sc: number, shine: number){
  const { t1C, t1G } = V.B, { w: CWd, h: CHd, t1w: T1W, t1h: T1H } = V.geo;
  t1G.clearRect(0,0,T1W,T1H);
  const cr=Math.cos(ry), sr=Math.sin(ry), ox=T1W/2, oy=T1H/2, mirror=cr<0, src=(mirror&&back)?back:face;
  const xe: number[]=new Array(CWd+1), he: number[]=new Array(CWd+1), ze: number[]=new Array(CWd+1);
  for(let u=0;u<=CWd;u++){ const xx=(u-CWd/2)*sc, X=xx*cr, Z=xx*sr, p=FOC/(FOC+Z); xe[u]=X*p; he[u]=CHd*sc*p; ze[u]=p; }
  for(let u=0;u<CWd;u++){ const a=xe[u], b=xe[u+1], L=Math.round(Math.min(a,b)), Rr=Math.round(Math.max(a,b)), w=Rr-L; if (w<=0) continue; const h=Math.round((he[u]+he[u+1])/2);
    t1G.drawImage(src, mirror?CWd-1-u:u, 0, 1, CHd, ox+L, Math.round(oy-h/2), w, h); }
  // edge thickness
  if (Math.abs(sr)>.12){ const near = ze[0]>ze[CWd] ? 0 : CWd; const ex=Math.round(xe[near]), eh=Math.round(he[near]), ew=Math.max(1,Math.round(3*Math.abs(sr)*sc)); const dir = xe[near] < xe[near===0?CWd:0] ? -1 : 1;
    const [edge, edgeHi]=V.theme.keys.edge, x0 = dir<0 ? ox+ex-ew : ox+ex; t1G.fillStyle=PAL[edge]; t1G.fillRect(x0, Math.round(oy-eh/2)+1, ew, eh-2); t1G.fillStyle=PAL[edgeHi]; t1G.fillRect(x0, Math.round(oy-eh/2)+1, ew, 1); t1G.fillStyle=PAL.k; t1G.fillRect(dir<0?x0:x0+ew-1, Math.round(oy-eh/2)+1, 1, eh-2); }
  // shading + foil glint
  t1G.globalCompositeOperation='source-atop';
  const shade=(1-Math.abs(cr))*.6 + Math.abs(rx)*.25; if (shade>.09){ t1G.fillStyle=pat(V,t1G,'k',shade); t1G.fillRect(0,0,T1W,T1H); }
  if (shine>0){ const bx=Math.round(ox + (-ry*1.6 + rx*.8)*40 + Math.sin(V.S.rt*.9)*10); t1G.fillStyle=pat(V,t1G,'w',.3*shine); for(let yy=0;yy<T1H;yy++){ const xx=bx - Math.round((yy-oy)*.45); t1G.fillRect(xx,yy,5,1); } t1G.fillStyle=pat(V,t1G,'w',.6*shine); for(let yy=0;yy<T1H;yy++){ const xx=bx+1 - Math.round((yy-oy)*.45); t1G.fillRect(xx,yy,2,1); } }
  t1G.globalCompositeOperation='source-over';
  // rows (X tilt)
  const crx=Math.cos(rx), srx=Math.sin(rx), top=Math.max(0,Math.floor(oy-CHd*sc*.75)), bot=Math.min(T1H,Math.ceil(oy+CHd*sc*.75));
  for(let v=top; v<bot; v++){ const y=v-oy, Y=y*crx, Z=y*srx, p=FOC/(FOC+Z), dy=cy+Y*p, y2=(v+1-oy), p2=FOC/(FOC+y2*srx), dy2=cy+y2*crx*p2;
    const r0=Math.round(dy), r1=Math.max(r0+1,Math.round(dy2)); const rw=Math.round(T1W*p); ctx.drawImage(t1C,0,v,T1W,1,Math.round(cx-rw/2),r0,rw,r1-r0); }
}
