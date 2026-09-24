import { loadDeckArt } from './art';
import { ChipAudio } from './audio';
import { emptyBag, openBag } from './bag';
import { chainLinks } from './chains';
import { createState, type Buffers, type DebugHandles, type Env, type Vault, type VaultElements, type VaultHooks } from './context';
import { genCracks } from './cracks';
import type { Deck } from './decks/types';
import { leave, startEnter } from './flow';
import { cardGeo } from './geometry';
import { beginHold, bindInput, endHold } from './input';
import { applyLayout, initialLayout } from './layout';
import { startLoop, tick } from './loop';
import { createFx } from './particles';
import { render } from './render';
import { emptyUnits } from './scene';
import { buildSprites } from './sprites';
import type { Theme } from './themes/types';
import { TIERS } from './tiers';
import { mk } from './util';

export type { VaultElements, VaultHooks } from './context';

export interface VaultController {
  setForce(r: number): void;
  setSound(on: boolean): void;
  resetBag(): void;
  /** copies owned per card id (recorded at each reveal) */
  owned(): Record<string, number>;
  destroy(): void;
}

/**
 * Boots the vault scene for `deck` in `theme` on the given DOM nodes. The deck's art is preloaded
 * first (missing images become placeholders), then the loop starts. destroy() tears everything
 * down, so a React unmount (or StrictMode's double mount, or a theme switch) is clean.
 */
export function createVault(els: VaultElements, deck: Deck, theme: Theme, hooks: VaultHooks = {}): VaultController {
  const abort=new AbortController(), timers=new Set<ReturnType<typeof setTimeout>>();
  const later=(ms: number,f: ()=>void)=>{ const id=setTimeout(()=>{ timers.delete(id); if (!abort.signal.aborted) f(); },ms); timers.add(id); };
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches, APP: DebugHandles = window.APP ?? {}, A=new ChipAudio(theme.audio);
  const env: Env = { els, hooks, APP, signal: abort.signal, reduce, MOTION: reduce?.3:1, later,
    buzz: p=>{ try{ if(!reduce && A.ctx && navigator.vibrate) navigator.vibrate(p); }catch{} } };
  const geo=cardGeo(deck.layout, deck.emblem), { w, h } = geo;
  const V: Vault = { env, L: initialLayout(), S: createState(geo.bars.length), FX: createFx(), U: emptyUnits(), B: buffers(els, geo.w, geo.h, geo.art.w, geo.art.h, geo.t1w, geo.t1h),
    K: { backBase: null, backCracks: genCracks(1,geo.backCx,geo.backCy,w,h), frontCracks: genCracks(2,geo.artCx,geo.artCy,w,h), chainLinks: chainLinks(geo) },
    A, spr: buildSprites(theme.lock), deck, geo, theme, ladder: deck.tiers.map(t=>t.tier), art: new Map(), bag: openBag(deck) };
  hooks.onBagComplete?.(V.bag.bag.complete);
  let stopLoop=()=>{};

  loadDeckArt(deck, V.spr, geo).then(art=>{
    if (abort.signal.aborted) return;
    V.art=art; bindInput(V);
    theme.buildBack(V); applyLayout(V); startEnter(V);
    document.fonts?.ready.then(()=>{ if (!abort.signal.aborted) applyLayout(V); });
    stopLoop=startLoop(V);
    Object.assign(APP,{ S: V.S, FX: V.FX, L: V.L, geo, force:(r: number)=>{V.S.force=r;}, step:(d: number)=>tick(V,d), render:()=>render(V),
      beginHold:()=>beginHold(V), endHold:()=>endHold(V), leave:()=>leave(V),
      theme: theme.id, deck: { id: deck.id, tiers: V.ladder.map(t=>({ id: t, name: TIERS[t].name })), cards: deck.cards.map(c=>({ id: c.id, slot: c.slot, tier: c.tier, tierName: TIERS[c.tier].name, name: c.name })) } });
    window.APP=APP; window.__ready=true;
  }).catch(e=>hooks.onError?.(e instanceof Error?e.message:String(e)));

  return {
    setForce(r: number){ A.init(); V.S.force=r<0||(V.ladder as number[]).includes(r)?r:-1; A.blip(); if (V.S.phase==='idle' && V.S.charge===0 && !V.S.holding) V.S.r=-1; },
    setSound(v: boolean){ A.init(); A.setOn(v); },
    resetBag(){ A.init(); emptyBag(V.bag); hooks.onBagComplete?.(false); A.blip(); },
    owned(){ return { ...V.bag.bag.owned }; },
    destroy(){ abort.abort(); stopLoop(); timers.forEach(clearTimeout); timers.clear(); A.close(); els.stage.style.transform='';
      if (window.APP===APP){ delete window.APP; delete window.__ready; } },
  };
}

function buffers(els: VaultElements, cw: number, ch: number, aw: number, ah: number, t1w: number, t1h: number): Buffers {
  const cv=els.screen, g=cv.getContext('2d',{willReadFrequently:true})!, bloomC=els.bloom, bg=bloomC.getContext('2d')!;
  const [brC,brG]=mk(20,20), [dissC,dissG]=mk(cw,ch), [backC,backG]=mk(cw,ch), [frontC,frontG]=mk(cw,ch), [tmpC,tmpG]=mk(cw,ch), [artC,artG]=mk(aw,ah), [t1C,t1G]=mk(t1w,t1h), [tileSrcC,tileSrcG]=mk(cw,ch), [rotC,rotG]=mk(16,16);
  const [layerC,layerG]=mk(1,1), [silC,silG]=mk(1,1);
  return { cv, g, bloomC, bg, brC, brG, dissC, dissG, backC, backG, frontC, frontG, tmpC, tmpG, artC, artG, t1C, t1G, tileSrcC, tileSrcG, rotC, rotG, layerC, layerG, silC, silG, patCache: new Map() };
}
