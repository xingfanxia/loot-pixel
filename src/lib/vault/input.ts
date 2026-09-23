import type { Vault } from './context';
import { assignCard, fidget, leave } from './flow';
import { applyLayout, refitToHud } from './layout';
import { render } from './render';
import { clamp } from './util';

/** Press on the card: start charging (or spin a revealed card). */
export function beginHold(V: Vault){ const { S, A, env } = V; A.init(); if (S.phase==='revealed'){ fidget(V); return; } if (S.phase!=='idle'||S.auto) return; if (S.r<0) assignCard(V); S.holding=true; S.downAt=performance.now(); S.sq.v=-2.8*env.MOTION; A.press(); env.buzz(6); }
/** Release: a quick tap auto-completes the charge; a let-go mid-charge springs back. */
export function endHold(V: Vault){ const { S, env } = V; if(!S.holding) return; S.holding=false; if (S.phase!=='idle') return; if (performance.now()-S.downAt<240 && S.charge<.35) S.auto=true; else if (S.charge<1) S.sq.v+=2.8*env.MOTION; }

/** Pointer, keyboard and resize listeners; all removed by the vault's abort signal. */
export function bindInput(V: Vault){
  const { els, signal } = V.env, { hit, again } = els, on={signal};
  hit.addEventListener('pointerdown', e=>{ if(e.button>0) return; hit.setPointerCapture?.(e.pointerId); beginHold(V); }, on);
  window.addEventListener('pointerup', ()=>endHold(V), on); window.addEventListener('pointercancel', ()=>endHold(V), on);
  window.addEventListener('pointermove', e=>{ const { S, L, geo: G } = V, cx=L.CX*L.SC, cy=L.CY*L.SC; S.ptr.nx=clamp((e.clientX-cx)/(G.w*L.SC*.9),-1,1); S.ptr.ny=clamp((e.clientY-cy)/(G.h*L.SC*.9),-1,1); S.ptr.last=S.t; }, on);
  hit.addEventListener('contextmenu', e=>e.preventDefault(), on);
  window.addEventListener('keydown', e=>{ const tg=e.target as Element|null; if (tg?.closest?.('button') && tg!==hit) return; if (e.code==='Space'||e.code==='Enter'){ e.preventDefault(); if(e.repeat) return; if (V.S.phase==='revealed'){ V.A.init(); leave(V); } else beginHold(V); } }, on);
  window.addEventListener('keyup', e=>{ if (e.code==='Space'||e.code==='Enter') endHold(V); }, on);
  again.addEventListener('click', ()=>{ V.A.init(); leave(V); hit.focus({preventScroll:true}); }, on);
  window.addEventListener('resize', ()=>applyLayout(V), on);
  // the HUD can wrap onto a second row (e.g. when "Empty bag" appears on a phone): re-fit the scene above it,
  // deferred while a reveal / wall break is running (a mid-celebration rebuild would pop the broken wall away),
  // and redraw at once since observers run after this frame's rAF (the resized canvas would flash blank)
  if (typeof ResizeObserver!=='undefined'){ const ro=new ResizeObserver(()=>{ if (refitToHud(V)) render(V); });
    ro.observe(els.hud); signal.addEventListener('abort', ()=>ro.disconnect()); }
}
