import { snapChain } from './chains';
import { rankOf, tens, type Vault } from './context';
import type { CrackTier } from './cracks';
import { aftershock, arrive, assignCard, burst, teaseUp } from './flow';
import { bolt, ring, sparks, stepParticles } from './particles';
import { TEASE_AT, TIERS } from './tiers';
import { lerp, rnd, TAU } from './util';

const CHARGE_T=1.6, CRACK_AT=[.14,.3,.47,.64];

function spring(s: {x:number,v:number},target: number,k: number,c: number,dt: number){ const n=4,h=dt/n; for(let i=0;i<n;i++){ s.v+=(-k*(s.x-target)-c*s.v)*h; s.x+=s.v*h; } }

/** Everything that rises with charge c: cracks + chain snaps, heartbeat, zaps, glow, inward-sucked motes. */
function tension(V: Vault, c: number, rdt: number, want: boolean, cracks: CrackTier[]){
  const { S, A, FX, env } = V, { MOTION, reduce } = env, back=cracks===V.K.backCracks;
  if (back && c>.2 && Math.random()<rdt*c*9) A.clink();
  for(let i=0;i<4;i++) if(!S.reached[i] && c>=CRACK_AT[i]){ S.reached[i]=1; cracks[i].shown=true; if (back) snapChain(V,i); A.crack(i); S.trauma=Math.min(1,S.trauma+.25); S.pulse+=.05*MOTION; S.cardI+=.35; sparks(V,14,S.teaseKey,30,110,.35,S.cx,S.cy,true); env.buzz(10); }
  cracks.forEach(t=>{ if(t.shown) t.prog=Math.min(1,t.prog+rdt*6); });
  if (want && c>.03){ S.beat-=rdt; if (S.beat<=0){ S.beat=lerp(.62,.15,c); A.heart(c); S.pulse+=(.03+.05*c)*MOTION; S.cardI+=.15+.3*c; env.buzz(Math.round(6+14*c)); } }
  if (c>.42){ S.zapAcc+=rdt*Math.pow((c-.42)/.58,1.5)*12*(reduce?.3:1); while(S.zapAcc>1){ S.zapAcc--; bolt(V, Math.random()<.3?'w':S.teaseKey); } }
  S.trauma=Math.max(S.trauma,.4*c*c); S.glow=c; S.cardIT=.5+1.3*c*c; S.amb=lerp(.3,.12,c);
  if (c>.03){ const k=V.geo.k; S.suckAcc+=rdt*(18+180*c*c)*(reduce?.4:1); while(S.suckAcc>1){ S.suckAcc--; const a=rnd(0,TAU), d=rnd(55*k,130*k); FX.sucks.push({x:S.cx+Math.cos(a)*d, y:S.cy+Math.sin(a)*d*.8, v:rnd(20,50), k:Math.random()<.35?'w':S.teaseKey}); } }
}

/** One simulation step: dt is slow-motion time, rdt real time. */
export function step(V: Vault, dt: number, rdt: number){
  const { S, A, FX, L, env, geo: G } = V, { MOTION, reduce } = env;
  S.t+=dt;
  if (S.phase==='idle'){
    const want=S.holding||S.auto; if (want && (S.r<0||!S.spec)) assignCard(V); if (want){ if(!A.charging) A.chargeStart(); S.charge=Math.min(1,S.charge+rdt/CHARGE_T); } else S.charge=Math.max(0,S.charge-rdt*1.3);
    const c=S.charge; A.chargeUpdate(c,S.rt); if(!want && c<=0) A.chargeStop();
    const steps=V.ladder.length-1, at=TEASE_AT[steps]??[], rk=rankOf(V,S.vr);
    for(let i=0;i<steps;i++) if (S.teaseStep<i+1 && rk>=i+1 && c>=at[i]){ S.teaseStep=i+1; teaseUp(V, V.ladder[i+1]); }
    tension(V, c, rdt, want, V.K.backCracks); if (S.auto && c<=0) S.auto=false;
    if (c>=1) burst(V);
  } else if (S.phase==='upgrading'){
    S.up=Math.min(1,S.up+rdt/1.5); A.chargeUpdate(S.up,S.rt); S.glitch=.2+S.up*.8; tension(V, S.up, rdt, true, V.K.frontCracks);
    if (S.up>=1){ S.vr=S.r; burst(V); }
  } else { S.glow=Math.max(0,S.glow-dt*3); S.amb=lerp(S.amb, S.phase==='revealed'?.34:.3, 1-Math.exp(-2*dt)); }
  if (S.phase==='revealed'){ const R=TIERS[S.vr];
    if (S.after>0){ S.after-=dt; if (S.after<=0) aftershock(V); }
    if (R.zap>0){ S.zapAcc+=dt*R.zap*(reduce?.3:1); while(S.zapAcc>1){ S.zapAcc--; bolt(V, R.l); } }
    if (R.sparkle>0){ S.sparkAcc+=dt*R.sparkle*(reduce?.4:1); while(S.sparkAcc>1){ S.sparkAcc--; const a=rnd(0,TAU); FX.motes.push({x:S.cx+Math.cos(a)*rnd(G.hw+4,G.hw+22), y:S.cy+Math.sin(a)*rnd(G.hh+3,G.hh+17), vy:-rnd(4,12), age:0, life:rnd(.8,1.6), k:Math.random()<.5?'w':R.l}); } }
    S.cardIT = R.glow*(1+.12*Math.sin(S.rt*2.4));
  }
  if (S.phase==='entering'){ const deal=!!S.pack&&S.pack.i>=0; S.summon=Math.min(1,S.summon+rdt/(deal?.3:reduce?.4:.95)); const sp=S.summon;
    S.cardIT=.5+.9*Math.sin(sp*Math.PI); S.beam=Math.max(S.beam,.75*Math.sin(Math.min(1,sp*1.3)*Math.PI));
    if (Math.random()<rdt*70*(1-sp)){ const a=rnd(0,TAU); FX.motes.push({x:L.CX+Math.cos(a)*rnd(10,28), y:L.PTOP-1+Math.sin(a)*4, vy:-rnd(25,70), age:0, life:rnd(.4,.9), k:Math.random()<.5?'w':'4'}); }
    if (!S.summonChime && sp>.2){ S.summonChime=true; A.summon(); }
    // a pack's card flips as soon as it is in; a fresh card or pack lands and waits for a hold (or charges itself after "Open another pack")
    if (sp>=1 && deal) burst(V);
    else if (sp>=1){ S.phase='idle'; if (S.autoNext){ S.autoNext=false; S.auto=true; } S.sq.v=5; S.trauma=Math.min(1,S.trauma+.22); ring(V,'4',220,1,0); sparks(V,22,'c',20,100,.4,L.CX,L.CY,true); A.land(); env.buzz(12); } }
  if (S.phase==='collecting'){ const C=S.col!; C.t=Math.min(1,C.t+rdt/C.dur); const t=C.t, e=t<.2?-.08*Math.sin(t/.2*Math.PI):Math.pow((t-.2)/.8,2), u=Math.max(0,e);
    S.pos.x=2*(1-u)*u*C.dir*50 + u*u*C.tx; S.pos.y=2*(1-u)*u*(-60) + u*u*C.ty + (e<0?-e*50:0); S.colScale=Math.max(.08,lerp(1,C.s1,u)*(e<0?1+e:1)); S.colSpin=C.dir*u*TAU*1.5;
    if (t>=1 && !C.done){ C.done=true; arrive(V); } }
  // springs & timers
  spring(S.sq,0,260,12,dt); spring(S.zoom,1,90,10,dt); S.pulse*=Math.exp(-9*dt);
  if (S.spin.t<1){ S.spin.t=Math.min(1,S.spin.t+dt/S.spin.dur); const e=1-Math.pow(1-S.spin.t,3); S.spin.a=lerp(S.spin.from,S.spin.to,e); }
  const live=S.t-S.ptr.last<2.5, c=tens(V), damp=1-c*.8;
  const over=live && Math.abs(S.ptr.nx)<.95 && Math.abs(S.ptr.ny)<.95; const tx=(over?-S.ptr.ny*.34:0)*damp*MOTION, ty=(over?S.ptr.nx*.46:0)*damp*MOTION;
  const k=1-Math.exp(-9*dt); S.tilt.x=lerp(S.tilt.x,tx,k); S.tilt.y=lerp(S.tilt.y,ty,k);
  S.trauma=Math.max(0,S.trauma-dt*1.6); S.rays=lerp(S.rays,S.raysT,1-Math.exp(-1.6*dt)); S.rayAng+=dt*(.22+S.rays*.35);
  S.cardI=lerp(S.cardI,S.cardIT,1-Math.exp(-(S.cardI>S.cardIT?3.4:8)*dt)); S.beam*=Math.exp(-.9*dt); S.torchBoost*=Math.exp(-2*dt); S.ca*=Math.exp(-4*rdt);
  for (let i=0;i<S.barFlash.length;i++){ if (S.barFlash[i]>0) S.barFlash[i]-=rdt; }
  // torches
  if (V.theme.flames){ S.flameAcc+=dt*(26+40*S.torchBoost)*(reduce?.5:1);
  while(S.flameAcc>1){ S.flameAcc--; for (const t of L.TORCH){ const lean=(S.cx-t.x)*.9*c; FX.flames.push({x:t.x+rnd(-1.5,1.5), y:t.y-1, vx:lean*rnd(.6,1.2)+rnd(-5,5), vy:-rnd(18,40)*(1+S.torchBoost), age:0, life:rnd(.3,.6)*(1+S.torchBoost*.4)}); } }
  for (const t of L.TORCH){ if (Math.random()<dt*2.5) FX.flames.push({x:t.x, y:t.y-4, vx:rnd(-8,8)+(S.cx-t.x)*.6*c, vy:-rnd(30,60), age:0, life:rnd(1,2), ember:true}); } }
  stepParticles(V, dt, c);
}

/** Stat bars fill one after another after a reveal, ticking and sparking as they land. */
export function ui(V: Vault, rdt: number){
  const { S, A, env, geo: G, bag } = V;
  if (S.phase==='revealed'){ const R=TIERS[S.vr]; for(let k=0;k<G.bars.length;k++){ if (S.barDone[k]) continue; const e=S.rt-S.barT[k]; if (e<0) continue; const p=Math.min(1,e/.32); const v=S.barTarget[k]*(1-Math.pow(1-p,3));
      if (Math.round(v*G.barW)!==Math.round(S.bars[k]*G.barW)) A.bar(p,k); S.bars[k]=v;
      if (p>=1){ S.barDone[k]=1; S.barFlash[k]=.18; A.barEnd(k); S.pulse+=.03*env.MOTION; sparks(V, R.barSparks, R.l, 20, 80, .4, Math.round(S.cx-G.hw+G.barX+G.barW*S.bars[k]), Math.round(S.cy-G.hh+(G.barY0+2)+k*6), true); env.buzz(10); } } }
  bag.flash=bag.flash.map(v=>Math.max(-1,v-rdt));
}
