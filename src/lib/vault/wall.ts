import type { Vault } from './context';
import { bay, RAMPU, U32 } from './palette';
import { dustAt } from './particles';
import { TIERS } from './tiers';
import { clamp, mulberry, rnd, TAU } from './util';

/** The vault theme's void behind the wall for tier r: a portal disc in the tier ramp, clouds, ridges, stars. */
export function paintVaultVoid(V: Vault, r: number){
  const { L, S, U } = V, { W, HY, CX, CY } = L, T=TIERS[r], VOID32=U.VOID32;
  const rp=RAMPU[T.ramp], rng=mulberry(S.seed*13+5), ox=CX, oy=CY-6, R0=Math.round(clamp(Math.min(W,HY)*.2,18,40)), big=Math.max(W,HY);
  const stars: [number,number,number][]=[]; U.VOIDSTARS=stars; const gs=18, gw=Math.ceil(W/gs)+3, gh=Math.ceil(HY/gs)+3, grid=new Float32Array(gw*gh); for(let i=0;i<grid.length;i++) grid[i]=rng();
  const vn=(x: number,y: number)=>{ const gx=x/gs, gy=y/gs, x0=Math.floor(gx), y0=Math.floor(gy), fx=gx-x0, fy=gy-y0, sx=fx*fx*(3-2*fx), sy=fy*fy*(3-2*fy);
    const a=grid[y0*gw+x0], b=grid[y0*gw+x0+1], c=grid[(y0+1)*gw+x0], d=grid[(y0+1)*gw+x0+1]; return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy; };
  const ridge=new Float32Array(W), ridge2=new Float32Array(W); for(let x=0;x<W;x++){ ridge[x]=HY-6-(vn(x*.6+300,5)*.7+vn(x*1.7+80,9)*.3)*Math.min(34,HY*.28); ridge2[x]=HY-3-(vn(x*.9+900,40)*.6+vn(x*2.6,70)*.4)*Math.min(18,HY*.15); }
  for(let y=0;y<HY;y++) for(let x=0;x<W;x++){ const dx=x-ox, dy=y-oy, d=Math.hypot(dx,dy), b=bay(x,y); let col;
    if (y>=ridge2[x]){ VOID32[y*W+x] = y<ridge2[x]+1 ? rp[2] : U32.k; continue; }
    if (y>=ridge[x]){ VOID32[y*W+x] = y<ridge[x]+1 ? rp[3] : (b<.25 ? rp[1] : U32['0']); continue; }
    if (d<R0){ const sh=(dx+dy*.8)/R0; let l=Math.floor(5.6-(sh+1)*1.7+b*1.3); if (d>R0-1.2) l=6; col=rp[clamp(l,2,6)];
      if (T.voidSpiral && ((Math.floor(d)+Math.floor(Math.atan2(dy,dx)*6))%9===0) && d<R0-3) col=U32.o; }
    else { let v=vn(x,y)*.55+vn(x*2.3+40,y*2.3+20)*.3; v=v*.75+Math.max(0,1-d/(big*.75))*.5-.08+Math.pow(y/HY,1.8)*.55; const halo=Math.max(0,1-(d-R0)/(R0*1.1)); v+=halo*halo*.55;
      if (T.voidHalo && Math.abs(d-R0*1.55)<1.1 && Math.abs(dy)<R0*.5) v+=.5;
      const l=clamp(Math.floor(v*4.4+b-.5),0,5); col=rp[l];
      if (l<=1 && rng()<.014){ const k=rng()<.3?'w':rng()<.6?'c':'4'; col=U32[k]; stars.push([x,y,rng()*TAU]); } }
    VOID32[y*W+x]=col; }
}

/** Starts the reveal's wall breakdown: wall units within the tier's reach glow, then fall from the centre out. */
export function startWallBreak(V: Vault, r: number){
  const { S, L, U, env } = V, B=S.wall; V.theme.paintVoid(V, r); B.active=true; B.rebuild=false; B.t=0; B.r=r; U.snapG.clearRect(0,0,L.W,L.H); U.snapG.drawImage(U.sceneC,0,0);
  const reach = TIERS[r].reach*Math.max(L.W,L.HY);
  for (const u of U.WALLU){ const prot=L.TORCH.some(t=>Math.hypot(U.UX[u]-t.x, U.UY[u]-(t.y+4))<11 || (Math.abs(U.UX[u]-t.x)<8 && U.UY[u]>t.y)); const d=Math.hypot(U.UX[u]-L.CX,(U.UY[u]-L.CY)*1.1);
    U.UDEL[u] = (!prot && d<=reach) ? .25 + d/(L.NARROW?150:230) + Math.random()*.18 : Infinity; }
  V.A.rumble(TIERS[r].audio.rumble); S.trauma=Math.min(1,S.trauma+.35); S.zoom.v+=.5*env.MOTION; env.buzz([30,20,60]);
}

function brickGround(V: Vault, x: number){ const { GMAX, HY, CX, PBASE } = V.L, lo=Math.min(GMAX-1, HY+2), hi=Math.max(lo+1, Math.min(GMAX, HY+(GMAX-HY)*.55)); return Math.abs(x-CX)<34 ? rnd(Math.min(GMAX-1,PBASE+1), Math.min(GMAX, PBASE+9)) : rnd(lo, hi); }

/** Turns wall unit u into a falling brick body cut from the scene snapshot. */
function detach(V: Vault, u: number){
  const { U, L, S, FX } = V, x0=U.UB0X[u], y0=U.UB0Y[u], sx=Math.max(0,x0), sy=Math.max(0,y0), sw=Math.min(x0+U.UBW[u],L.W)-sx, sh=Math.min(y0+U.UBH[u],L.HY)-sy; if (sw<=0||sh<=0) return;
  const cx=sx+sw/2, cy=sy+sh/2, dx=cx-L.CX, dy=cy-S.cy, d=Math.hypot(dx,dy)||1;
  if (FX.bricks.length < (L.NARROW?220:400) && !(cy<L.HY*.3 && Math.random()<.45)) FX.bricks.push({sx,sy,w:sw,h:sh,x:cx,y:cy,vx:dx/d*rnd(15,70)+rnd(-20,20), vy:-rnd(0,60)*(dy<0?.4:1), rot:0, vr:rnd(-6,6), g:brickGround(V,cx), age:0, life:rnd(3.5,5.5), rest:false});
  if (Math.random()<.5) dustAt(V,cx,cy,2,false);
}

export function wallStep(V: Vault, rdt: number){
  const { S, U, env } = V, B=S.wall; if (!B.active) return;
  if (!B.rebuild){ B.t+=rdt; let pending=0;
    for (const u of U.WALLU){ const del=U.UDEL[u]; if (del===Infinity) continue; const st=U.UST[u];
      if (st===0 && B.t>=del-.14) U.UST[u]=1; else if (st===1 && B.t>=del){ U.UST[u]=2; detach(V,u); } if (U.UST[u]<2) pending++; }
    if (pending>0) S.trauma=Math.max(S.trauma,.24*env.MOTION); }
  else { B.rt+=rdt; let left=0;
    for (const u of U.WALLU){ if (!U.UST[u]) continue; if (B.rt>=U.URST[u]){ U.UST[u]=0; U.UDEL[u]=Infinity; if (Math.random()<.3) dustAt(V,U.UX[u],U.UY[u],1,true); if (Math.random()<.05) V.A.blip(); } else left++; }
    if (!left){ B.active=false; B.rebuild=false; } }
}

/** Fallen bricks fly back into place, nearest the centre last. */
export function wallRebuild(V: Vault){
  const { S, U, L, FX } = V, B=S.wall; if (!B.active) return; B.rebuild=true; B.rt=0; const md=Math.max(L.W,L.HY)*.8;
  for (const u of U.WALLU){ U.UDEL[u]=Infinity; if (U.UST[u]){ const d=Math.hypot(U.UX[u]-L.CX,U.UY[u]-L.CY); U.URST[u]=.08+(1-Math.min(1,d/md))*.7+Math.random()*.1; } }
  FX.bricks.forEach(b=>{ b.life=Math.min(b.life,b.age+rnd(.15,.5)); }); V.A.rebuild();
}
