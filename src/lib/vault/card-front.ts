import { rankOf, type Vault } from './context';
import { drawCracks } from './cracks';
import { drawText, textW } from './font';
import { bay, LIGHTEN, PAL } from './palette';
import { TIERS } from './tiers';
import { mulberry, ri, TAU } from './util';

export const CYCLE=['y','o','w','o','y','Y'];

/** Rarity backdrop behind the art: dithered radial glow in the tier colours, floor strip, star seeds. */
export function buildArtBg(V: Vault, vr: number){
  const { S, geo: G } = V, R=TIERS[vr], x=V.B.artG, rng=mulberry(S.spec!.seed), aw=G.art.w, ah=G.art.h, image=S.spec!.art.kind==='image';
  for(let yy=0;yy<ah;yy++) for(let xx=0;xx<aw;xx++){ const t=yy/(ah-1); const dx=(xx-aw/2)/(aw/2), dy=(yy-G.bgCy)/G.bgRy, rad=Math.sqrt(dx*dx+dy*dy); const b=bay(xx,yy);
    x.fillStyle = b < (1-rad)*.55 ? PAL[R.x] : b < t*.9 ? PAL[0] : PAL[1]; if ((1-rad)*.8>b+.5) x.fillStyle=PAL[R.d]; x.fillRect(xx,yy,1,1); }
  if (!image){ for(let xx=0;xx<aw;xx++){ x.fillStyle=PAL[0]; x.fillRect(xx,G.floorY+(xx%3===0?1:0),1,5); } x.fillStyle=PAL[1]; x.fillRect(0,G.floorY,aw,1); }
  S.artStars=[]; for(let i=0;i<16;i++) S.artStars.push([Math.floor(rng()*aw), Math.floor(rng()*G.starsH), rng()*TAU]);
}

/** Card face for the visible tier: frame (colour-cycling on top tiers), art, sparkles, nameplate, bars, gems. */
export function drawFront(V: Vault, t: number){
  const { S, geo: G, B } = V, x=B.frontG, CWd=G.w, CHd=G.h, a=G.art, vr=S.vr, R=TIERS[vr]; x.clearRect(0,0,CWd,CHd);
  x.fillStyle=PAL.k; x.fillRect(2,0,CWd-4,CHd); x.fillRect(0,2,CWd,CHd-4); x.fillRect(1,1,CWd-2,CHd-2);
  const rimL = R.cycleRim ? CYCLE[Math.floor(t*12)%CYCLE.length] : R.l;
  x.fillStyle=PAL[R.l]; x.fillRect(1,1,CWd-2,CHd-2); x.fillStyle=PAL.w; x.fillRect(2,1,CWd-4,1); x.fillRect(1,2,1,CHd-4); x.fillStyle=PAL[LIGHTEN[R.l]||'w']; x.fillRect(2,2,CWd-4,1); x.fillRect(2,2,1,CHd-4);
  x.fillStyle=PAL[R.d]; x.fillRect(2,CHd-2,CWd-4,1); x.fillRect(CWd-2,2,1,CHd-4); x.fillRect(3,CHd-3,CWd-5,1); x.fillRect(CWd-3,3,1,CHd-5);
  if (R.cycleRim){ for(let i=0;i<(CWd+CHd)*2;i+=4){ const col=CYCLE[(Math.floor(t*14)+Math.floor(i/4))%CYCLE.length]; x.fillStyle=PAL[col]; let px,py; const P=i%(2*(CWd+CHd));
      if (P<CWd){ px=P; py=1; } else if (P<CWd+CHd){ px=CWd-2; py=P-CWd; } else if (P<2*CWd+CHd){ px=CWd-1-(P-CWd-CHd); py=CHd-2; } else { px=1; py=CHd-1-(P-2*CWd-CHd); } x.fillRect(px,py,2,2); } }
  x.fillStyle=PAL.k; x.fillRect(4,4,CWd-8,CHd-8); x.fillStyle=PAL[0]; x.fillRect(5,5,CWd-10,CHd-10);
  for (const [sx,sy] of [[2,2],[CWd-6,2],[2,CHd-6],[CWd-6,CHd-6]]){ x.fillStyle=PAL.k; x.fillRect(sx,sy,4,4); x.fillStyle=PAL[rimL]; x.fillRect(sx+1,sy+1,2,2); x.fillStyle=PAL.w; x.fillRect(sx+1,sy+1,1,1); }
  drawArt(V, t);
  if (R.sparkle>0){ for(let i=0;i<R.sparkle+1;i++){ const cyc=Math.floor(t*1.4+i*.37), ph=(t*1.4+i*.37)%1, px=a.x+2+((i*37+cyc*13)%(a.w-6)), py=a.y+2+((i*23+cyc*7)%(a.h-11)); const big=ph>.3&&ph<.7;
      x.fillStyle=PAL.w; x.fillRect(px,py,1,1); if (big){ x.fillStyle=PAL[R.l]; x.fillRect(px-1,py,1,1); x.fillRect(px+1,py,1,1); x.fillRect(px,py-1,1,1); x.fillRect(px,py+1,1,1); if (ph>.45&&ph<.55){ x.fillRect(px-2,py,1,1); x.fillRect(px+2,py,1,1); x.fillRect(px,py-2,1,1); x.fillRect(px,py+2,1,1); } } } }
  x.fillStyle=PAL[R.l]; x.fillRect(a.x-1,a.y+a.h+1,a.w+2,1);
  // nameplate
  const py=G.plateY; x.fillStyle=PAL[1]; x.fillRect(a.x,py,a.w,10); x.fillStyle=PAL[2]; x.fillRect(a.x,py,a.w,1); x.fillStyle=PAL.k; x.fillRect(a.x,py+9,a.w,1);
  const nm=S.spec!.name; drawText(x,nm,Math.round(G.hw-textW(nm,1)/2),py+2,1,'c','k');
  // bars
  G.bars.forEach((lb,k)=>{ const y=G.barY0+k*6; drawText(x,lb,a.x+1,y,1,'4'); const bw=G.barW, bx=G.barX; x.fillStyle=PAL.k; x.fillRect(bx-1,y,bw+2,5); x.fillStyle=PAL[1]; x.fillRect(bx,y+1,bw,3);
    const f=Math.round(bw*(S.bars[k]||0)); for(let j=0;j<f;j++){ x.fillStyle=PAL[j%4===3?R.d:R.l]; x.fillRect(bx+j,y+1,1,3); } if (f>0){ x.fillStyle=PAL.w; x.fillRect(bx,y+1,f,1); if (S.barFlash[k]>0){ x.fillStyle=PAL.w; x.fillRect(bx+f-2,y,3,5); } } });
  // gems: one per ladder step reached
  const rk=rankOf(V,vr), gw=(rk+1)*6-2; for(let i=0;i<=rk;i++){ const gx=Math.round(G.hw-gw/2)+i*6, gy=G.gemY; x.fillStyle=PAL.k; x.fillRect(gx+1,gy-1,2,6); x.fillRect(gx,gy,4,4); x.fillStyle=PAL[R.l]; x.fillRect(gx+1,gy,2,4); x.fillRect(gx,gy+1,4,2); x.fillStyle=PAL.w; x.fillRect(gx+1,gy,1,1); }
  if (S.phase==='upgrading') drawCracks(x, V.K.frontCracks, TIERS[S.r].l);
  if (S.glitch>0){ const { tmpC, tmpG, frontC } = B; tmpG.clearRect(0,0,CWd,CHd); tmpG.drawImage(frontC,0,0); x.clearRect(0,0,CWd,CHd);
    for(let yy=0;yy<CHd;yy++){ const dx=Math.random()<S.glitch*.45?ri(-5,5):0; x.drawImage(tmpC,0,yy,CWd,1,dx,yy,CWd,1); }
    for(let k=0;k<Math.floor(S.glitch*8);k++){ x.fillStyle=PAL[['m','t','y','v','w'][ri(0,4)]]; x.fillRect(ri(0,CWd-14),ri(0,CHd-1),ri(4,24),1); } }
}

/** Art window: backdrop + twinkling stars, a halo, then the sprite (bobbing) or the portrait, popping in on reveal. */
function drawArt(V: Vault, t: number){
  const { S, geo: G, B } = V, x=B.frontG, a=G.art, R=TIERS[S.vr], card=S.face ?? S.spec!, assets=V.art.get(card.id)!;
  x.fillStyle=PAL[R.d]; x.fillRect(a.x-1,a.y-1,a.w+2,a.h+2); x.drawImage(B.artC,a.x,a.y);
  for (const [sx,sy,ph] of S.artStars){ const tw=Math.sin(t*3+ph); if (tw>.2){ x.fillStyle=tw>.8?PAL.w:PAL[4]; x.fillRect(a.x+sx,a.y+sy,1,1); if (tw>.93){ x.fillStyle=PAL[R.l]; x.fillRect(a.x-1+sx,a.y+sy,1,1); x.fillRect(a.x+1+sx,a.y+sy,1,1); x.fillRect(a.x+sx,a.y-1+sy,1,1); x.fillRect(a.x+sx,a.y+1+sy,1,1); } } }
  const sprite=card.art.kind==='sprite', ss=G.spriteSz, bob=Math.round(Math.sin(t*3.2)*1.4), hx=G.artCx, hy=sprite?G.spriteCy+2:G.artCy;
  const gr=Math.round(9*(sprite?ss/32:1)+Math.sin(t*4)*1.5); for(let yy=-gr;yy<=gr;yy++) for(let xx=-gr*1.4;xx<=gr*1.4;xx++){ const d=Math.sqrt((xx/1.4)**2+yy*yy)/gr; if (d<1 && bay(xx+64,yy+64)<(1-d)*.7){ x.fillStyle=PAL[d<.4?R.l:R.d]; x.fillRect(hx+Math.round(xx),hy+yy,1,1); } }
  const pt=S.rt-S.popT0, ps=pt<.42?1+.75*Math.pow(1-pt/.42,2):1;
  if (sprite){
    const sw=Math.round(ss*.75), sw2=Math.round(ss*15/16); x.fillStyle=PAL.k; x.fillRect(hx-sw/2,G.shadowY,sw,2); x.fillStyle=PAL[1]; x.fillRect(hx-sw2/2,G.shadowY+1,sw2,1);
    const sz=Math.round(ss*ps); x.drawImage(assets.art,Math.round(hx-sz/2),Math.round(G.spriteCy-sz/2)+bob,sz,sz);
  } else {
    const img=assets.art, w=Math.round(img.width*ps), h=Math.round(img.height*ps);
    x.save(); x.beginPath(); x.rect(a.x,a.y,a.w,a.h); x.clip(); x.drawImage(img,Math.round(hx-w/2),Math.round(a.y+a.h/2-h/2),w,h); x.restore();
  }
}
