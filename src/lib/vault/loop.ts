import type { Vault } from './context';
import { release } from './flow';
import { flushLayout } from './layout';
import { render } from './render';
import { step, ui } from './sim';
import { TIERS } from './tiers';
import { lerp, rnd } from './util';
import { wallStep } from './wall';

/** Advances the vault by rdt real seconds (slow motion scales the sim, not the timers) and renders. */
export function tick(V: Vault, rdt: number){
  const { S, A, env } = V;
  S.rt+=rdt;
  if (S.phase==='hitstop'){ S.hitstop-=rdt; if (S.hitstop<=0){ release(V); } render(V); return; }
  if (S.slowmo>0){ S.slowmo-=rdt; S.ts=lerp(S.ts,.2,1-Math.exp(-25*rdt)); } else S.ts=lerp(S.ts,1,1-Math.exp(-3.5*rdt));
  S.flash*=Math.exp(-7*rdt);
  if (A.ctx && A.on){ S.crk-=rdt; if (S.crk<=0){ S.crk=rnd(.05,.4)*(1-.5*S.torchBoost/1.5); A.crackle(Math.random()<.5?-.55:.55); } }
  step(V, rdt*S.ts, rdt); wallStep(V, rdt); flushLayout(V); ui(V, rdt);
  const boxT=(S.slowmo>0||S.phase==='upgrading'||(S.phase==='idle'&&S.charge>.8&&S.vr>=0&&TIERS[S.vr].letterbox))&&!env.reduce?1:0; S.box=lerp(S.box,boxT,1-Math.exp(-(boxT?9:3)*rdt));
  render(V);
}

/** requestAnimationFrame loop; window.APP.paused freezes it so tests can drive tick() directly. */
export function startLoop(V: Vault){
  const { env } = V; let last=performance.now(), raf=0;
  const frame=(now: number)=>{
    if (env.signal.aborted) return;
    if (env.APP.paused){ last=now; raf=requestAnimationFrame(frame); return; }
    const raw=Math.max(0,(now-last)/1000), rdt=Math.min(1/30,raw); last=now;
    try{ tick(V, rdt); }catch(e){ console.error(e); env.hooks.onError?.(e instanceof Error?e.message:String(e)); return; }
    raf=requestAnimationFrame(frame);
  };
  raf=requestAnimationFrame(frame);
  return ()=>cancelAnimationFrame(raf);
}
