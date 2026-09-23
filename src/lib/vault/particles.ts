import { tens, type Vault } from './context';
import { rnd, TAU, type Ctx2D } from './util';

interface Body { x: number; y: number; vx: number; vy: number; age: number; life: number }
export interface Brick extends Body { sx: number; sy: number; w: number; h: number; rot: number; vr: number; g: number; rest: boolean }
export interface Link extends Body { g: number; rest: boolean; odd?: number; lock?: boolean }
export interface Spark extends Body { k: string; big: boolean; g: number; px?: number; py?: number }
export interface Tile extends Body { sx: number; sy: number; w: number; h: number; rot: number; vr: number; g: number }
export interface Confetto extends Body { k: string; ph: number; g: number; land?: boolean }
export interface Suck { x: number; y: number; v: number; k: string; px?: number; py?: number; d?: number }
export interface Mote { x: number; y: number; vy: number; age: number; life: number; k: string }
export interface Bolt { pts: [number,number][]; k: string; age: number; life: number }
export interface Ring { r: number; v: number; w: number; k: string; age: number; life: number }
export interface Flame extends Body { big?: boolean; ember?: boolean }
export interface Coin { x: number; h: number; gy: number; vx: number; vh: number; ph: number; rest: boolean; age: number; life: number }
export interface Dust { x: number; y: number; vx: number; vy: number; ph: number }

/** Every live particle, by kind. `g` fields are the floor row each body lands on. */
export interface FxStore { bricks: Brick[]; dustp: Body[]; links: Link[]; sparks: Spark[]; tiles: Tile[]; confetti: Confetto[]; sucks: Suck[];
  motes: Mote[]; bolts: Bolt[]; rings: Ring[]; flames: Flame[]; coins: Coin[]; dust: Dust[] }
export const createFx = (): FxStore => ({ bricks: [], dustp: [], links: [], sparks: [], tiles: [], confetti: [], sucks: [], motes: [], bolts: [], rings: [], flames: [], coins: [], dust: [] });

/** Particle count scaled down for reduced motion. */
export const Q=(V: Vault, n: number)=>Math.round(n*(V.env.reduce?.4:1));
/** A random floor row in front of the altar. */
export const gy=(V: Vault)=>rnd(Math.max(V.L.GMIN, V.L.PBASE+2), V.L.GMAX);

export function sparks(V: Vault, n: number,key: string,smin: number,smax: number,life: number,x0?: number,y0?: number,floorless?: boolean){ const S=V.S; n=Q(V,n); for(let i=0;i<n;i++){ const a=Math.random()*TAU, s=rnd(smin,smax);
  V.FX.sparks.push({x:x0??S.cx, y:y0??S.cy, vx:Math.cos(a)*s, vy:Math.sin(a)*s-30, age:0, life:life*rnd(.5,1.2), k:Math.random()<.3?'w':key, big:Math.random()<.3, g:floorless?1e9:gy(V)}); } }
export function ring(V: Vault, key: string,speed: number,w: number,delay?: number){ V.FX.rings.push({r:12,v:speed,w,k:key,age:-(delay||0),life:.85}); }
export function confetti(V: Vault, n: number,keys: string[],rain: boolean){ const S=V.S, W=V.L.W; for(let i=0;i<Q(V,n);i++){ const a=-Math.PI/2+rnd(-1.4,1.4), s=rnd(70,230);
  V.FX.confetti.push(rain?{x:rnd(0,W),y:rnd(-160,-4),vx:rnd(-10,10),vy:rnd(0,40),k:keys[i%keys.length],age:0,life:rnd(3.5,6),ph:rnd(0,TAU),g:gy(V)}:{x:S.cx+rnd(-12,12),y:S.cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,k:keys[i%keys.length],age:0,life:rnd(3,4.5),ph:rnd(0,TAU),g:gy(V)}); } }
export function coins(V: Vault, n: number){ const S=V.S; for(let i=0;i<Q(V,n);i++){ const gg=gy(V); V.FX.coins.push({x:S.cx+rnd(-8,8), h:gg-S.cy, gy:gg, vx:rnd(-150,150), vh:rnd(90,260), ph:rnd(0,4), rest:false, age:0, life:rnd(6,9)}); } }
/** Breaks the card image into 8px tiles that fly outward. */
export function shatter(V: Vault, fromCanvas: HTMLCanvasElement){ const { S, B } = V, CWd=V.geo.w, CHd=V.geo.h; B.tileSrcG.clearRect(0,0,CWd,CHd); B.tileSrcG.drawImage(fromCanvas,0,0);
  const ox=Math.round(S.cx-CWd/2), oy=Math.round(S.cy-CHd/2);
  for(let ty=0;ty<CHd;ty+=8) for(let tx=0;tx<CWd;tx+=8){ const cx=tx+4-CWd/2, cy=ty+4-CHd/2, a=Math.atan2(cy,cx)+rnd(-.4,.4), s=rnd(80,220);
    V.FX.tiles.push({sx:tx,sy:ty,w:Math.min(8,CWd-tx),h:Math.min(8,CHd-ty),x:ox+tx+4,y:oy+ty+4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-70,rot:0,vr:rnd(-14,14),age:0,life:rnd(1.1,1.9),g:gy(V)}); } }
/** Midpoint-displaced lightning from the card's edge. */
export function bolt(V: Vault, key: string){ const S=V.S, G=V.geo, a=Math.random()*TAU, sx=S.cx+Math.cos(a)*(G.hw+2), sy=S.cy+Math.sin(a)*(G.hh+1), len=rnd(24,70), b=a+rnd(-.5,.5);
  let pts: [number,number][]=[[sx,sy],[sx+Math.cos(b)*len, sy+Math.sin(b)*len]], disp=len*.45;
  for(let k=0;k<4;k++){ const np: [number,number][]=[pts[0]]; for(let i=0;i<pts.length-1;i++){ const [ax,ay]=pts[i],[bx,by]=pts[i+1]; const dx=bx-ax, dy=by-ay, L=Math.hypot(dx,dy)||1, off=(Math.random()-.5)*disp; np.push([(ax+bx)/2-dy/L*off,(ay+by)/2+dx/L*off],pts[i+1]); } pts=np; disp*=.55; }
  V.FX.bolts.push({pts:pts.map(p=>[Math.round(p[0]),Math.round(p[1])]), k:key, age:0, life:rnd(.06,.15)}); V.A.zap(); }
/** Bresenham line in the current fillStyle. */
export function line(x: Ctx2D,x0: number,y0: number,x1: number,y1: number){ x0=Math.round(x0); y0=Math.round(y0); x1=Math.round(x1); y1=Math.round(y1); const dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1; let e=dx+dy, n=0;
  while(n++<600){ x.fillRect(x0,y0,1,1); if(x0===x1&&y0===y1) break; const e2=2*e; if(e2>=dy){ e+=dy; x0+=sx; } if(e2<=dx){ e+=dx; y0+=sy; } } }
export function seedDust(V: Vault){ const { W, H, HY } = V.L; V.FX.dust=[]; for(let i=0;i<Math.round(W*H/900);i++) V.FX.dust.push({x:rnd(0,W), y:rnd(0,HY), vx:rnd(-3,3), vy:rnd(-2,2), ph:rnd(0,TAU)}); }
export function dustAt(V: Vault, x: number,y: number,n: number,up: boolean){ for(let i=0;i<n;i++) V.FX.dustp.push({x:x+rnd(-3,3), y:y+rnd(-2,2), vx:rnd(-18,18), vy:-rnd(up?10:2,up?40:14), age:0, life:rnd(.4,1)}); }

/** Integrates every particle kind one step and drops the dead ones. `c` is the card tension. */
export function stepParticles(V: Vault, dt: number, c: number){
  const { S, FX, A, L } = V, { NARROW, W, HY } = L;
  const dr=(f: number)=>Math.exp(-f*dt);
  for(const p of FX.sparks){ p.age+=dt; const d=dr(2.2); p.vx*=d; p.vy=p.vy*d+220*dt; p.px=p.x; p.py=p.y; p.x+=p.vx*dt; p.y+=p.vy*dt; if (p.y>p.g && p.vy>0){ p.y=p.g; p.vy*=-.45; p.vx*=.7; } }
  for(const p of FX.tiles){ p.age+=dt; p.vx*=dr(.8); p.vy+=460*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt; if (p.y>p.g && p.vy>0){ p.y=p.g; p.vy*=-.35; p.vx*=.6; p.vr*=.5; } }
  for(const p of FX.confetti){ p.age+=dt; if (p.land) continue; const d=dr(3); p.vx=p.vx*d+Math.sin(p.ph)*22*dt; p.vy=p.vy*d+130*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.ph+=dt*10; if (p.y>=p.g){ p.y=p.g; p.land=true; p.life=p.age+rnd(1.5,3.5); } }
  for(const p of FX.coins){ p.age+=dt; if (p.rest) continue; p.vh-=520*dt; p.h+=p.vh*dt; p.x+=p.vx*dt; p.vx*=dr(.6); p.ph+=dt*(10+Math.abs(p.vh)*.04); if (p.h<=0){ p.h=0; if (Math.abs(p.vh)>40){ A.clink(); p.vh*=-.42; p.vx*=.6; } else { p.rest=true; p.vh=0; } } }
  for(const p of FX.bricks){ p.age+=dt; if (p.rest) continue; p.vy+=560*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=dr(.5); p.rot+=p.vr*dt;
    if (p.y+p.h/2>p.g && p.vy>0){ p.y=p.g-p.h/2; const hard=p.vy;
      if (hard>120 && p.w>=10 && FX.bricks.length<(NARROW?280:500)){ const hw=Math.floor(p.w/2); FX.bricks.push({sx:p.sx+hw,sy:p.sy,w:p.w-hw,h:p.h,x:p.x+hw/2,y:p.y,vx:p.vx+rnd(15,45),vy:-hard*.3,rot:p.rot,vr:rnd(-8,8),g:p.g+rnd(-1,2),age:p.age,life:p.life,rest:false}); p.w=hw; p.x-=hw/2; p.vx-=rnd(15,45); }
      if (hard>45){ p.vy*=-.3; p.vx*=.5; p.vr*=.5; A.thud(); dustAt(V,p.x,p.y+p.h/2,hard>120?4:2,true); if (hard>150) S.trauma=Math.min(1,S.trauma+.03); }
      else { p.rest=true; p.vy=0; p.vr=0; p.rot=Math.round(p.rot/(Math.PI/2))*(Math.PI/2); } } }
  for(const p of FX.dustp){ p.age+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=dr(2); p.vy*=dr(1.5); }
  for(const p of FX.links){ p.age+=dt; if (p.rest) continue; p.vy+=(p.lock?540:440)*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=dr(.7); if (p.y>p.g && p.vy>0){ p.y=p.g; if (Math.abs(p.vy)>45){ p.vy*=-(p.lock?.3:.38); p.vx*=.6; if (p.lock) A.clunk(); else A.clink(); } else p.rest=true; } }
  for(const p of FX.sucks){ const dx=S.cx-p.x, dy=S.cy-p.y, d=Math.hypot(dx,dy)||1; p.px=p.x; p.py=p.y; p.v+=(120+520*tens(V))*dt; const m=Math.min(d,p.v*dt); p.x+=dx/d*m; p.y+=dy/d*m; p.d=d; }
  for(const p of FX.motes){ p.age+=dt; p.y+=p.vy*dt; }
  for(const p of FX.flames){ p.age+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=dr(1.5); if (!p.ember) p.vy*=dr(.5); else { p.vx+=Math.sin(p.age*5)*6*dt; } }
  for(const p of FX.bolts) p.age+=dt;
  for(const p of FX.rings){ p.age+=dt; if(p.age>0){ p.r+=p.v*dt; p.v*=dr(2.6); } }
  for(const p of FX.dust){ const dx=S.cx-p.x, dy=S.cy-p.y, d=Math.hypot(dx,dy)||1, pull=c*c*120; p.vx+=(dx/d*pull + Math.sin(S.t*.5+p.ph)*1.5)*dt; p.vy+=(dy/d*pull + Math.cos(S.t*.4+p.ph)*1.2)*dt; p.vx*=dr(1.2); p.vy*=dr(1.2); p.x+=p.vx*dt; p.y+=p.vy*dt; if (d<10 || p.x<0||p.x>W||p.y<0||p.y>HY){ p.x=rnd(0,W); p.y=rnd(0,HY); p.vx=0; p.vy=0; } }
  FX.sparks=FX.sparks.filter(p=>p.age<p.life); FX.tiles=FX.tiles.filter(p=>p.age<p.life); FX.confetti=FX.confetti.filter(p=>p.age<p.life); FX.sucks=FX.sucks.filter(p=>p.d===undefined||p.d>8);
  FX.motes=FX.motes.filter(p=>p.age<p.life); FX.bolts=FX.bolts.filter(p=>p.age<p.life); FX.rings=FX.rings.filter(p=>p.age<p.life); FX.flames=FX.flames.filter(p=>p.age<p.life); FX.coins=FX.coins.filter(p=>p.age<p.life); FX.links=FX.links.filter(p=>p.age<p.life); FX.bricks=FX.bricks.filter(p=>p.age<p.life); FX.dustp=FX.dustp.filter(p=>p.age<p.life);
  if (FX.sparks.length>1500) FX.sparks.splice(0,FX.sparks.length-1500);
}
