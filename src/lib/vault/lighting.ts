import { tens, type Vault } from './context';
import { BAYER, PAL, RAMPU, U32 } from './palette';
import { tone } from './scene';
import { TIERS } from './tiers';
import { TAU } from './util';

/**
 * Lights the scene into scene32: the card, both torches and the sky beam light each brick /
 * flagstone as a unit and the altar per pixel, quantised to 7 ramp steps; god rays and shock
 * rings paint over the top. Then blits the result to the main canvas with the shake offset.
 */
export function lightPass(V: Vault, ox: number, oy: number){
  const { S, L, U, FX } = V, { W, H, HY, TORCH } = L, g = V.B.g;
  const cx=S.cx, cy=S.cy, cI=S.cardI, cR2=(30+24*Math.min(cI,2.2))**2, amb=S.amb, c=tens(V);
  const cRamp=RAMPU[S.lightKey]||RAMPU.s, SEL=[RAMPU.stone, RAMPU.warm, cRamp];
  const T=TORCH.map((t,i)=>({x:t.x, y:t.y-3, I:(.78+.14*Math.sin(S.t*13+i*2)+.07*Math.sin(S.t*31+i)+(Math.random()-.5)*.05)*(1+S.torchBoost)*(1-.45*c), R2:(26+12*S.torchBoost)**2}));
  const rays=Math.min(1,S.rays), nR=12, beam=S.beam, bw=15+8*Math.min(beam,1), rayRamp=S.vr>=0?RAMPU[TIERS[S.vr].ramp]:cRamp;
  const light=(x: number,y: number): [number,number,boolean]=>{ const fy=y>=HY?1.7:1, dyc=(y-cy)*fy, dxc=x-cx; let lc=cI*cR2/(cR2+dxc*dxc+dyc*dyc);
    let lw=0; for (const t of T){ const a=x-t.x, b=(y-t.y)*fy; lw+=t.I*t.R2/(t.R2+a*a+b*b); }
    let inBeam=false; if (beam>.03 && y<cy && Math.abs(dxc)<bw){ lc+=beam*(1-Math.abs(dxc)/bw)*1.1; inBeam=true; } return [lc,lw,inBeam]; };
  const { UST, UX, UY, UALB, UHASH, ULVL, URAMP, UNIT, OFF, PIXA, VOID32, scene32 } = U;
  for(let u=0;u<U.NU;u++){ if (UST[u]===2) continue; const x=UX[u], y=UY[u]; const [lc,lw,inBeam]=light(x,y); const Lt=amb+lw+lc; let lvl=tone(UALB[u]*Lt);
    const h=UHASH[u]; let sel = (inBeam || lc/Lt > .2+.5*h) ? 2 : (lw/Lt > .26+.44*h ? 1 : 0);
    if (rays>.02){ const a=Math.atan2(y-cy,x-cx)+S.rayAng, per=TAU/nR, sec=((a%per)+per)%per; if (sec<.17){ const d=Math.hypot(x-cx,y-cy), iv=rays*(1-d/(Math.max(W,H)*.9)); if (iv>.15+h*.3){ lvl+= iv>.55?2:1; sel=3; } } }
    ULVL[u]=lvl>6?6:lvl; URAMP[u]=sel; }
  const rings=FX.rings.filter(r=>r.age>0).map(r=>[r.r, Math.max(1,Math.round(r.w*(1-r.age/r.life))), U32[r.k]]);
  const K=U32.k;
  for(let y=0;y<H;y++){ const row=y*W; for(let x=0;x<W;x++){ const i=row+x, u=UNIT[i]; let col;
      if (u>=0){ const st=UST[u]; if (st===2) col=VOID32[i]; else { let l=ULVL[u]+OFF[i]+(st===1?2:0); if (l<0) l=0; else if (l>6) l=6; const sel=st===1?3:URAMP[u]; col=(sel===3?rayRamp:SEL[sel])[l]; } }
      else { const a=PIXA[i]; if (a<=0) col=K; else { const [lc,lw]=light(x,y), Lt=amb+lw+lc; const l=tone(a*Lt), b2=BAYER[((y+2)&3)*4+((x+1)&3)]; col=(lc/Lt>.2+.5*b2?cRamp:lw/Lt>.3+.4*b2?RAMPU.warm:RAMPU.stone)[l]; } }
      if (rings.length){ const dd=Math.sqrt((x-cx)*(x-cx)+(y-cy)*(y-cy)); for(let q=0;q<rings.length;q++) if (Math.abs(dd-rings[q][0])<rings[q][1]){ col=rings[q][2]; break; } }
      scene32[i]=col; } }
  U.sceneG.putImageData(U.sceneImg,0,0);
  g.fillStyle=PAL.k; g.fillRect(0,0,W,H); g.drawImage(U.sceneC,ox,oy);
}
