import { CYCLE } from './card-front';
import type { Vault } from './context';
import { drawRampText, drawText, textW } from './font';
import { barH, slotRect } from './layout';
import { PAL } from './palette';
import { TIERS } from './tiers';
import { ri } from './util';

/** In-canvas HUD: tier title, NEW!/xN stamp, variant caption, hold hint, bag row + counter. */
export function drawHud(V: Vault, ox: number, oy: number){
  const { S, L, geo: G } = V, g=V.B.g, { CX, CY, TS, W, PBASE } = L;
  // title
  if (S.title){ const T=S.title, str=T.text, tw=textW(str,TS), x0=Math.round(CX-tw/2), yBase=Math.round(CY-G.h/2-5*TS-10); const shine=((S.rt*1.1)%2.2)*(str.length+6)/1.6-3;
    for(let i=0;i<str.length;i++){ const e=S.rt-T.t0-.06-i*.055; if (e<0) continue; let dy; if (e<.18){ const p=e/.18; dy=-Math.round((1-p*p)*34); } else if (e<.32){ dy=Math.round(Math.sin((e-.18)/.14*Math.PI)*-4); } else dy=Math.round(Math.sin(S.rt*4+i*.7)*1.3);
      const qx=T.quake?ri(-2,2):0, qy=T.quake?ri(-1,1):0; const lit=Math.abs(i-shine)<1.2;
      const tr=T.ramp, rf=tr ? (row: number)=> lit&&row<3 ? (row===0?'w':'o') : tr[row] : (row: number)=> row===0 ? CYCLE[(Math.floor(S.rt*10)+i)%CYCLE.length] : ['o','y','Y','R'][row-1];
      const split=V.theme.hud.splitTitle; if (split){ const o=Math.max(1,TS>>1)+1; drawText(g,str[i],x0+i*4*TS+qx+ox-o,yBase+dy+qy+oy,TS,split[0]); drawText(g,str[i],x0+i*4*TS+qx+ox+o,yBase+dy+qy+oy,TS,split[1]); }
      drawRampText(g,str[i],x0+i*4*TS+qx+ox,yBase+dy+qy+oy,TS,rf); } }
  // stamp
  if (S.stamp){ const e=S.rt-S.stamp.t0, fin=W>=300?2:1, s=e<.05?fin+3:e<.1?fin+2:e<.16?fin+1:fin, str=S.stamp.text, tw=textW(str,s), bx=Math.round(S.cx+G.w/2-tw/2-4)+ox, by=Math.round(S.cy-G.h/2-6)+oy;
    g.fillStyle=PAL.k; g.fillRect(bx-4,by-4,tw+8,5*s+8); g.fillStyle=PAL[S.stamp.key]; g.fillRect(bx-3,by-3,tw+6,5*s+6); g.fillStyle=PAL.w; g.fillRect(bx-3,by-3,tw+6,1); g.fillStyle=PAL[S.stamp.key==='y'?'Y':'5']; g.fillRect(bx-3,by+5*s+2,tw+6,1); drawText(g,str,bx,by,s,'k'); }
  // variant caption under the altar, typed in once the title has landed
  if (S.caption){ const e=S.rt-S.caption.t0-.9; if (e>0){ const str=S.caption.text.slice(0,Math.ceil(e*40)); drawText(g,str,Math.round(CX-textW(S.caption.text,1)/2)+ox,L.CAPY+oy,1,S.caption.key,'k'); } }
  // hint
  if (S.phase==='idle' && S.charge<.05 && Math.floor(S.rt*2)%2===0){ const str=S.auto?V.theme.hud.auto:V.theme.hud.hold+(S.pack?' x10':''); drawText(g,str,Math.round(CX-textW(str,1)/2),PBASE+8,1,'c','k'); }
  if (S.pack) drawPack(V, ox, oy);
  drawBag(V);
}

/**
 * A pack's HUD: an "x10" badge on the sealed pack, and a strip of ten pips under the altar that fill
 * with each dealt card's tier colour (the card on the altar blinks, cards still to come stay dark).
 */
function drawPack(V: Vault, ox: number, oy: number){
  const { S, L, geo: G, theme } = V, g=V.B.g, P=S.pack!, n=P.cards.length||10, [, fill, shade]=theme.keys.coin;
  if (P.i<0 && (S.phase==='idle'||(S.phase==='entering'&&S.summon>.55))){ const s=L.W>=300?2:1, str='x10', tw=textW(str,s), bx=Math.round(S.cx+G.w/2-tw/2-4)+ox, by=Math.round(S.cy-G.h/2-6)+oy;
    g.fillStyle=PAL.k; g.fillRect(bx-4,by-4,tw+8,5*s+8); g.fillStyle=PAL[fill]; g.fillRect(bx-3,by-3,tw+6,5*s+6); g.fillStyle=PAL.w; g.fillRect(bx-3,by-3,tw+6,1); g.fillStyle=PAL[shade]; g.fillRect(bx-3,by+5*s+2,tw+6,1); drawText(g,str,bx,by,s,'k'); }
  if (P.i>=n) return;
  const pw=4, gap=1, w=n*(pw+gap)-gap, x0=Math.round(L.CX-w/2), y0=L.PBASE+2; g.fillStyle=PAL.k; g.fillRect(x0-1,y0-1,w+2,5);
  for (let k=0;k<n;k++){ const x=x0+k*(pw+gap), done=k<P.i||(k===P.i&&S.phase!=='entering'&&S.phase!=='hitstop'), now=k===P.i;
    const T=done?TIERS[now?S.vr:P.cards[k].r]:null; g.fillStyle=PAL[T?T.l:now&&Math.floor(S.rt*6)%2?'w':2]; g.fillRect(x,y0,pw,3); if (T){ g.fillStyle=PAL[T.d]; g.fillRect(x,y0+2,pw,1); } }
}

/** One square per slot: the best collected card's icon on its tier colours (or an empty socket), with a collected/total bar under it. */
function drawBag(V: Vault){
  const { deck, bag, L, geo: G } = V, g=V.B.g, n=deck.slots.length, bh=barH(V), have=deck.slots.map(()=>0), total=deck.slots.map(()=>0);
  deck.cards.forEach((c,i)=>{ total[c.slot]++; if (bag.shown.has(i)) have[c.slot]++; });
  for(let i=0;i<n;i++){ const r=slotRect(V,i), fl=bag.flash[i]>0&&(Math.floor(bag.flash[i]*20)&1), best=bag.best[i], R=best>=0?TIERS[deck.cards[best].tier]:null;
    g.fillStyle=PAL.k; g.fillRect(r.x-1,r.y-1,r.w+2,r.h+2); g.fillStyle=PAL[R?R.d:1]; g.fillRect(r.x,r.y,r.w,r.h); g.fillStyle=PAL[R?R.l:2]; g.fillRect(r.x,r.y,r.w,1); g.fillRect(r.x,r.y,1,r.h);
    if (fl){ g.fillStyle=PAL.w; g.fillRect(r.x,r.y,r.w,r.h); }
    else if (R){ const icon=V.art.get(deck.cards[best].id)!.icon; let s=G.icon; while (s>r.w && s>1) s>>=1; const o=Math.floor((r.w-s)/2); g.drawImage(icon,0,0,icon.width,icon.height,r.x+o,r.y+o,s,s); }
    else { g.fillStyle=PAL[0]; g.fillRect(r.x+Math.floor(r.w/2)-1,r.y+Math.floor(r.h/2)-1,2,2); }
    if (bh){ const f=Math.round(r.w*have[i]/total[i]), by=r.y+r.h+1; g.fillStyle=PAL.k; g.fillRect(r.x-1,by,r.w+2,bh); g.fillStyle=PAL[1]; g.fillRect(r.x,by+1,r.w,bh-2);
      if (f>0){ g.fillStyle=PAL[R?R.l:'4']; g.fillRect(r.x,by+1,f,bh-2); } } }
  if (!L.NARROW){ const last=slotRect(V,n-1); drawText(g,`${bag.shown.size}/${deck.cards.length}`,last.x+last.w+4,last.y+Math.floor(last.h/2)-2,1,'4','k'); }
}
