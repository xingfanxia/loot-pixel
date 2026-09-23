import { dissolve, drawBack } from './card-back';
import { drawFront } from './card-front';
import { drawCard3D, pat } from './card3d';
import { tens, type Vault } from './context';
import { drawHud } from './hud';
import { lightPass } from './lighting';
import { PAL, RAMPS } from './palette';
import { line } from './particles';
import { bloomCopy, postFX, reflect, renderImpact } from './postfx';
import { TIERS } from './tiers';
import { clamp } from './util';
import { drawWorld } from './world';

/** One frame: lit scene, world particles, the card, flying particles, reflection, HUD, flash, post FX. */
export function render(V: Vault){
  const { S, L, B, env } = V, g=B.g, MOTION=env.MOTION;
  const tr=S.trauma*S.trauma*MOTION, ox=Math.round((Math.sin(S.t*37)*.6+Math.sin(S.t*61)*.4)*7*tr), oy=Math.round((Math.sin(S.t*43+1)*.6+Math.sin(S.t*71)*.4)*7*tr);
  const c=tens(V), bob=(S.phase==='idle'||S.phase==='revealed')?Math.round(Math.sin(S.t*2.2)*2*(1-c)*MOTION):0;
  const jx=Math.round((Math.random()-.5)*c*c*4*MOTION), jy=Math.round((Math.random()-.5)*c*c*2*MOTION), lift=-Math.round(5*c*MOTION);
  S.cx=L.CX+Math.round(S.pos.x); S.cy=L.CY+Math.round(S.pos.y)+bob+lift;
  g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation='source-over';
  lightPass(V,ox,oy);
  drawWorld(V,ox,oy,c);
  drawCardLayer(V,ox,oy,jx,jy);
  if (S.phase==='hitstop'){ renderImpact(V,ox,oy); return; }
  g.drawImage(B.layerC,0,0);
  drawFlying(V,ox,oy);
  if(!env.APP.noR) reflect(V,ox,oy);
  drawHud(V,ox,oy);
  // letterbox
  if (S.box>.02){ const bh=Math.round(S.box*L.H*.1); g.fillStyle=PAL.k; g.fillRect(0,0,L.W,bh); g.fillRect(0,L.H-bh,L.W,bh); }
  // flash
  if (S.flash>.03){ g.fillStyle = S.flash>.85 ? PAL[S.flashKey] : pat(V,g,S.flashKey, S.flash); g.fillRect(0,0,L.W,L.H); }
  postFX(V); bloomCopy(V);
  env.els.stage.style.transform = Math.abs(S.zoom.x-1)>.0005 ? `scale(${S.zoom.x.toFixed(4)})` : '';
}

/** The card (face or back, summon dissolve, tension glow ring) into layerC via the 3D projector. */
function drawCardLayer(V: Vault, ox: number, oy: number, jx: number, jy: number){
  const { S, B, geo: G } = V, { layerG } = B, CWd=G.w, CHd=G.h;
  const showFront = S.phase==='revealed'||S.phase==='upgrading'||S.phase==='collecting'||(S.phase==='hitstop'&&S.upgrading);
  layerG.clearRect(0,0,V.L.W,V.L.H);
  if (S.hidden) return;
  if (showFront) drawFront(V,S.rt); else drawBack(V,S.rt);
  let sc=1+S.pulse, ry=S.tilt.y+S.spin.a; const rx=S.tilt.x;
  if (S.phase==='collecting'){ sc=S.colScale; ry+=S.colSpin; }
  const sqx=1+S.sq.x, sqy=1-S.sq.x*.6;
  const shine = showFront ? TIERS[S.vr].foil : .35;
  if (S.glow>.05){ const w=Math.round(CWd*sc*Math.max(.15,Math.abs(Math.cos(ry)))), h=Math.round(CHd*sc); const x=S.cx-Math.round(w/2)+ox+jx, y=S.cy-Math.round(h/2)+oy+jy;
    const ring=(o: number,col: string)=>{ layerG.fillStyle=PAL[col]; layerG.fillRect(x-o,y-o,w+2*o,1); layerG.fillRect(x-o,y+h+o-1,w+2*o,1); layerG.fillRect(x-o,y-o,1,h+2*o); layerG.fillRect(x+w+o-1,y-o,1,h+2*o); };
    const tk=S.teaseKey, rp=RAMPS[TIERS[S.tease].ramp]; ring(1,tk); if (S.glow>.35) ring(2,rp[4]); if (S.glow>.7 && Math.floor(S.rt*16)%2) ring(3,rp[3]); }
  const face=showFront?B.frontC:(S.phase==='entering'?dissolve(V,B.backC,clamp((S.summon-.15)/.75,0,1.08)):B.backC);
  drawCard3D(V, layerG, face, null, S.cx+ox+jx, S.cy+oy+jy+Math.round((1-sqy)*CHd*.5), ry, rx, sc*(sqx+sqy)/2, shine);
}

/** Particles in front of the card: shatter tiles, bolts, sparks, confetti, motes. */
function drawFlying(V: Vault, ox: number, oy: number){
  const { S, FX, B } = V, g=B.g, { rotC, rotG, tileSrcC } = B;
  for(const p of FX.tiles){ const t=p.age/p.life; if (t>.7 && (Math.floor(p.age*30)&1)) continue; rotG.clearRect(0,0,16,16); rotG.save(); rotG.translate(8,8); rotG.rotate(Math.round(p.rot*4)/4); rotG.drawImage(tileSrcC,p.sx,p.sy,p.w,p.h,-p.w/2,-p.h/2,p.w,p.h); rotG.restore(); g.drawImage(rotC,Math.round(p.x)-8+ox,Math.round(p.y)-8+oy); }
  for(const b of FX.bolts){ if (Math.random()<.25) continue; g.fillStyle=PAL[b.k]; for(let i=0;i<b.pts.length-1;i++){ const [x0,y0]=b.pts[i],[x1,y1]=b.pts[i+1]; line(g,x0+ox+1,y0+oy,x1+ox+1,y1+oy); line(g,x0+ox,y0+oy+1,x1+ox,y1+oy+1); }
    g.fillStyle=PAL.w; for(let i=0;i<b.pts.length-1;i++){ const [x0,y0]=b.pts[i],[x1,y1]=b.pts[i+1]; line(g,x0+ox,y0+oy,x1+ox,y1+oy); } }
  const dk=TIERS[Math.max(0,S.vr)].d;
  for(const p of FX.sparks){ const t=p.age/p.life; const k=t>.6&&(Math.floor(p.age*24)&1)?dk:p.k; g.fillStyle=PAL[k]; const s=p.big&&t<.5?2:1; g.fillRect(Math.round(p.x)+ox,Math.round(p.y)+oy,s,s);
    if (t<.45 && p.px!==undefined){ g.fillStyle=PAL[dk]; line(g,p.px+ox,p.py!+oy,p.x+ox,p.y+oy); g.fillStyle=PAL[k]; g.fillRect(Math.round(p.x)+ox,Math.round(p.y)+oy,s,s); } }
  for(const p of FX.confetti){ const t=p.age/p.life; if (t>.8&&(Math.floor(p.age*20)&1)) continue; g.fillStyle=PAL[p.k]; const hor=p.land?true:Math.sin(p.ph)>0; g.fillRect(Math.round(p.x)+ox,Math.round(p.y)+oy-(hor?0:1),hor?2:1,hor?1:2); }
  for(const p of FX.motes){ const t=p.age/p.life, s=t<.3||t>.7?0:1, x=Math.round(p.x)+ox, y=Math.round(p.y)+oy; g.fillStyle=PAL.w; g.fillRect(x,y,1,1); if (s){ g.fillStyle=PAL[p.k]; g.fillRect(x-1,y,1,1); g.fillRect(x+1,y,1,1); g.fillRect(x,y-1,1,1); g.fillRect(x,y+1,1,1); } }
}
