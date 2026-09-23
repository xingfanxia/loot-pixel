import { saveBag, showCard, shownSlots } from './bag';
import { buildArtBg, drawFront } from './card-front';
import { rankOf, type Vault } from './context';
import { genCracks } from './cracks';
import { slotRect } from './layout';
import { bolt, coins, confetti, gy, Q, ring, shatter, sparks } from './particles';
import { TIERS } from './tiers';
import { ri, rnd, TAU } from './util';
import { startWallBreak, wallRebuild } from './wall';

/**
 * The draw state machine: entering -> idle (hold to charge) -> hitstop -> revealed
 * [-> upgrading -> hitstop -> revealed when the draw was a fake] -> collecting -> entering.
 */

function pickRarity(V: Vault){ const S=V.S; if (S.force>=0) return S.force; let u=Math.random(); for (const t of V.deck.tiers){ u-=t.odds; if(u<=0) return t.tier; } return V.ladder[0]; }

/** Rolls tier + card for the next reveal; a fake shows the deck's tier below first (with a card of that tier from the same slot when there is one). */
export function assignCard(V: Vault){
  const { S, env: { APP } } = V, cards=V.deck.cards;
  S.r=pickRarity(V); let opts=cards.filter(c=>c.tier===S.r); if (APP.forceCard){ opts=cards.filter(c=>c.id===APP.forceCard); S.r=opts[0].tier; }
  const c=opts[ri(0,opts.length-1)]; S.spec=Object.assign({seed:ri(1,1e9), idx:cards.indexOf(c)}, c);
  const T=TIERS[S.r], rk=rankOf(V,S.r);
  S.fake = rk>0 && (APP.forceFake!==undefined ? (!!APP.forceFake && T.fake>0) : (T.fake>0 && Math.random()<T.fake));
  S.vr=S.fake?V.ladder[rk-1]:S.r; S.face=S.spec;
  if (S.fake){ const alt=cards.filter(k=>k.slot===c.slot && k.tier===S.vr); if (alt.length) S.face=alt[ri(0,alt.length-1)]; }
  paint(V, S.vr);
}
function paint(V: Vault, vr: number){ const S=V.S; buildArtBg(V, vr); const [a,b]=TIERS[vr].bars; S.barTarget=V.geo.bars.map(()=>rnd(a,b)); S.bars=S.bars.map(()=>0); S.barFlash=S.barFlash.map(()=>0); }

/** The charge reached the next ladder step: the back heats to that tier's colour. */
export function teaseUp(V: Vault, l: number){ const { S, env } = V, T=TIERS[l];
  S.tease=T.id; S.teaseKey=T.l; S.lightKey=T.ramp; S.pulse=.12*env.MOTION; S.trauma=Math.min(1,S.trauma+.4); V.A.tease(T.audio.tease); env.buzz(25); S.cardI+=.8;
  sparks(V, T.tease.sparks, T.l, 40, 150, .5, S.cx, S.cy, true); ring(V, T.l, 280, 2, 0); for(let i=0;i<T.tease.bolts;i++) bolt(V, T.l); }

/** Charge complete (or upgrade glitch done): freeze-frame impact, chains and padlock blow off. */
export function burst(V: Vault){ const { S, env } = V;
  if (S.vr<0 || !S.spec){ assignCard(V); }
  S.phase='hitstop'; S.hitstopDur=S.hitstop=TIERS[S.vr].hitstop*(env.reduce?.5:1); S.sq.x=.2; S.sq.v=0; S.zoom.x=1+.07*env.MOTION; S.zoom.v=0;
  if (!S.upgrading){ S.charge=1; if (S.lockOn){ S.lockOn=false; S.chains=[false,false,false,false]; V.FX.links.push({lock:true, x:S.cx, y:S.cy+7, vx:rnd(-70,70), vy:-rnd(170,230), g:gy(V), age:0, life:6, rest:false}); } }
  V.A.chargeStop(); V.A.boom(TIERS[S.vr].audio); env.buzz([45,25,110]);
}

const BAR_AT=[.75,1.05,1.35];

/** End of the hitstop: the face shows, and the visible tier's reveal package fires. */
export function release(V: Vault){
  const { S, FX, env, L, B, A } = V, { reduce, MOTION, later, els } = env;
  const r=S.vr, R=TIERS[r], up=S.upgrading, final=!S.fake||up, gen=S.seed;
  S.phase='revealed'; S.glitch=0; S.backOn=false; S.auto=false; S.popT0=S.rt; S.lightKey=R.ramp;
  if (up){ drawFront(V,S.rt); shatter(V,B.frontC); V.K.frontCracks.forEach(t=>{t.shown=false; t.prog=0;}); S.face=S.spec; paint(V,r); } else shatter(V,B.backC);
  S.spin={a:0, from:0, to:(reduce?0:R.spin)*TAU, t:0, dur:.5+.32*R.spin};
  S.sq.v=-5; S.trauma=Math.min(1,R.trauma); S.flash=1; S.flashKey=R.l; S.rays=reduce?R.rays:1.3; S.raysT=R.rays; S.zoom.v=-1.3*MOTION; S.ca=reduce?0:1;
  S.cardI=2.6; S.cardIT=R.glow; S.torchBoost=1.2; S.beam=R.beam; A.roar();
  S.slowmo=reduce?0:R.slowmo; if (S.slowmo) A.muffle(S.slowmo+.3); S.after=R.after>0?.32:-1;
  sparks(V, R.spark*(up?1.4:1), R.l, 60, 260, 1.3); sparks(V, R.spark*.4, 'w', 110, 340, .5);
  for (const t of L.TORCH) for(let i=0;i<Q(V,26);i++) FX.flames.push({x:t.x+rnd(-2,2), y:t.y-2, vx:(t.x-S.cx)*rnd(.6,1.6)+rnd(-30,30), vy:-rnd(40,140), age:0, life:rnd(.3,.8), big:true});
  ring(V, R.l, 360, 3, 0); ring(V, 'w', 270, 1, .05); if (R.rings>=1) ring(V, R.d, 220, 2, .14); if (R.rings>=2){ ring(V, 'Y', 170, 3, .26); ring(V, 'o', 120, 1, .4); }
  for(let i=0;i<R.bolts;i++) bolt(V, R.l);
  if (R.confetti) confetti(V, R.confetti.n, R.confetti.keys, false);
  if (R.coins) later(90, ()=>{ if (S.seed===gen) coins(V, R.coins); });
  S.title={text:R.name, t0:S.rt, ramp:R.title, quake:0};
  [...R.name].forEach((_,i)=> later(60+i*55+170, ()=>{ if(S.seed!==gen) return; A.letter(i,R.name.length); if(i===R.name.length-1){ S.trauma=Math.min(1,S.trauma+.35); S.zoom.v+=.6*MOTION; env.buzz(25); } }));
  for(let i=0;i<=rankOf(V,r);i++) later(650+i*110, ()=>{ if(S.seed===gen) A.pip(i); });
  S.barT=S.barT.map((_,k)=>S.rt+(BAR_AT[k]??.75+.3*k)); S.barDone=S.barDone.map(()=>0);
  const card=S.face ?? S.spec!;
  els.live.textContent=`${R.name}: ${card.label}`; els.hit.setAttribute('aria-label', `${R.name} ${card.label}. Tap to spin it.`);
  S.upgrading=false;
  if (final){ S.fake=false; commit(V,gen); if (S.spec!.title) S.caption={text:S.spec!.title, key:R.l, t0:S.rt};
    later(1150, ()=>{ if (S.phase==='revealed' && S.seed===gen) startWallBreak(V,S.vr); }); later(1000, ()=>{ if (S.phase==='revealed' && S.seed===gen) els.again.classList.add('show'); }); }
  else later(2200, ()=>{ if (S.phase==='revealed' && S.seed===gen) startUpgrade(V); });
}

/** Records the card in the bag and stamps NEW! / xN on the card corner. */
function commit(V: Vault, gen: number){ const { S, env, bag, geo: G } = V, id=S.spec!.id, owned=bag.bag.owned, isNew=!owned[id]; owned[id]=(owned[id]||0)+1; saveBag(bag.key, bag.bag); const cnt=owned[id]; S.pending={i:S.spec!.idx, isNew};
  env.later(1900, ()=>{ if (S.phase!=='revealed'||S.seed!==gen) return; S.stamp={text:isNew?'NEW!':'x'+cnt, key:isNew?'y':'4', t0:S.rt}; V.A.stamp(isNew); S.trauma=Math.min(1,S.trauma+.25); S.pulse=.08*env.MOTION; env.buzz(25); sparks(V, 26, isNew?'o':'4', 30, 130, .5, S.cx+G.hw-2, S.cy-G.hh+1, true); }); }

function startUpgrade(V: Vault){ const { S, env } = V; S.phase='upgrading'; S.up=0; S.upgrading=true; S.reached=[0,0,0,0]; S.beat=0; S.teaseKey=TIERS[S.r].l; S.lightKey=TIERS[S.r].ramp; S.raysT=0; S.beam=0; env.els.again.classList.remove('show');
  if (S.title) S.title.quake=1; V.A.glitch(); V.A.chargeStart(); S.trauma=Math.min(1,S.trauma+.5); S.flash=.5; S.flashKey='m'; S.ca=.8; env.buzz([20,40,20]); }

/** Second hit shortly after a reveal (tiers with `after`). */
export function aftershock(V: Vault){ const { S, env } = V, R=TIERS[S.vr], k=R.l; S.trauma=Math.min(1,S.trauma+.45); S.zoom.v+=.9*env.MOTION; ring(V,k,300,2,0); sparks(V,R.after,k,40,170,.7); V.A.after(); env.buzz(35); S.cardI+=1; S.ca=Math.max(S.ca,.5);
  if (R.afterBurst){ confetti(V,70,['y','o','w','Y'],false); coins(V,20); } }

/** Tap on a revealed card: it spins once. */
export function fidget(V: Vault){ const { S, env } = V, R=TIERS[S.vr]; S.spin={a:0,from:0,to:TAU,t:0,dur:.5}; S.sq.v=-3; sparks(V, 46, R.l, 30, 160, .6, S.cx, S.cy); ring(V, R.l, 220, 1, 0); V.A.fidget(); env.buzz(15); S.cardI+=.6; if (R.fidgetCoins) coins(V, R.fidgetCoins); }

/** "Draw another": the card flies into its bag slot. */
export function leave(V: Vault){ const { S, L, env } = V; if (S.phase!=='revealed'||S.fake) return; const ci=S.pending?S.pending.i:0, slot=V.deck.cards[ci].slot, sl=slotRect(V,slot);
  S.col={t:0, tx:sl.x+sl.w/2-L.CX, ty:sl.y+sl.h/2-L.CY, s1:sl.h/V.geo.h, dir:Math.random()<.5?-1:1, done:false, i:slot, card:ci};
  S.phase='collecting'; env.els.again.classList.remove('show'); S.title=null; S.stamp=null; S.caption=null; S.raysT=0; S.beam=0; S.cardIT=.5; V.A.whoosh(); env.buzz(8); }

export function arrive(V: Vault){ const { S, env, bag, deck } = V, C=S.col!, i=C.i, sl=slotRect(V,i); S.hidden=true; showCard(bag, deck, C.card); bag.flash[i]=.5; V.A.collect(); env.buzz(20); S.trauma=Math.min(1,S.trauma+.15);
  sparks(V, 34, TIERS[deck.cards[C.card].tier].l, 20, 130, .45, sl.x+sl.w/2, sl.y+sl.h/2, true); S.pending=null;
  if (!bag.bag.complete && shownSlots(bag)===deck.slots.length) env.later(380, ()=>celebrate(V)); else env.later(240, ()=>startEnter(V)); }

function celebrate(V: Vault){ const { S, env, bag } = V; bag.bag.complete=true; saveBag(bag.key, bag.bag); env.hooks.onBagComplete?.(true); S.vr=V.ladder[V.ladder.length-1]; S.lightKey='y';
  S.title={text:'FULL SET!', t0:S.rt, ramp:null, quake:0}; bag.flash=bag.flash.map((_,k)=>.5+k*.07);
  confetti(V,260,['y','o','t','v','w','Y','m'],true); coins(V,50); S.trauma=Math.min(1,S.trauma+.6); S.flash=.8; S.flashKey='y'; S.rays=1; S.raysT=0; S.cardI=3; S.cardIT=.3; S.torchBoost=1.5; V.A.fanfare(); env.buzz([60,40,60,40,160]);
  env.els.live.textContent='Full set collected'; env.later(3200, ()=>{ S.title=null; startEnter(V); }); }

/** Resets for the next card: a fresh back summoned onto the altar, the wall rebuilt. */
export function startEnter(V: Vault){ const { S, K, geo: G, FX } = V, base=TIERS[V.ladder[0]];
  S.phase='entering'; S.landed=false; S.auto=false; S.holding=false; V.A.chargeStop(); S.pos.x=0; S.pos.y=0; S.pos.vy=0; S.summon=0; S.summonChime=false; S.chains=[true,true,true,true]; S.lockOn=true; S.charge=0; S.reached=[0,0,0,0];
  S.tease=base.id; S.teaseStep=0; S.teaseKey=base.l; S.lightKey=base.ramp;
  S.r=-1; S.vr=-1; S.spec=null; S.face=null; S.fake=false; S.upgrading=false; S.up=0; S.hidden=false; S.after=-1; S.title=null; S.stamp=null; S.caption=null; S.glitch=0; S.backOn=true; S.cardIT=.5; S.beam=0;
  S.spin={a:0,from:0,to:0,t:1,dur:1}; S.seed++; K.backCracks=genCracks(S.seed*31,G.backCx,G.backCy,G.w,G.h); K.frontCracks=genCracks(S.seed*31+7,G.artCx,G.artCy,G.w,G.h);
  wallRebuild(V);
  FX.coins.forEach(c=>{ c.life=Math.min(c.life,c.age+rnd(.2,.8)); }); FX.links.forEach(c=>{ c.life=Math.min(c.life,c.age+rnd(.2,.8)); });
  V.env.els.hit.setAttribute('aria-label','Loot card. Press and hold to open.');
}
