import type { Theme } from './themes/types';
import type { TierAudio } from './tiers';
import { rnd } from './util';

interface ChargeVoice { o: OscillatorNode; o2: OscillatorNode; g: GainNode; g2: GainNode; ns: AudioBufferSourceNode; nf: BiquadFilterNode; ng: GainNode }
type Wave = OscillatorType | 'p25';

/**
 * Chip voices only (pulse 25%, square, triangle, noise) through a short dungeon echo.
 * The AudioContext is created lazily on the first user gesture via init(). The theme picks
 * the ambient bed and the lamp ticks; every other sound is shared.
 */
export class ChipAudio {
  constructor(private flavour: Theme['audio'] = { ambient: 'drone', crackle: 'fire' }) {}
  ctx: AudioContext | null = null;
  on = true;
  charging = false;
  private ch: ChargeVoice | null = null;
  private lastClink = 0;
  private lastThud = 0;
  private out!: GainNode;
  private lp!: BiquadFilterNode;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private noiseLo!: AudioBuffer;
  private pulse25!: PeriodicWave;
  private amb: GainNode | null = null;

  init(){ if (this.ctx){ if (this.ctx.state==='suspended') this.ctx.resume(); return; }
    try{ const C=window.AudioContext||(window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext; if(!C) return; const c=this.ctx=new C();
      this.out=c.createGain(); this.out.gain.value=this.on?.5:0; this.lp=c.createBiquadFilter(); this.lp.type='lowpass'; this.lp.frequency.value=20000;
      const comp=c.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=5; this.out.connect(this.lp); this.lp.connect(comp); comp.connect(c.destination);
      this.master=c.createGain(); this.master.connect(this.out);
      const dl=c.createDelay(1); dl.delayTime.value=.14; const fb=c.createGain(); fb.gain.value=.33; const dlp=c.createBiquadFilter(); dlp.type='lowpass'; dlp.frequency.value=2600; const wet=c.createGain(); wet.gain.value=.3;
      this.master.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(this.out);
      const len=c.sampleRate, buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0); let v=0; for(let i=0;i<len;i++){ if(i%5===0) v=Math.random()*2-1; d[i]=v; } this.noise=buf;
      const n2=c.createBuffer(1,len,c.sampleRate), d2=n2.getChannelData(0); for(let i=0;i<len;i++){ if(i%36===0) v=Math.random()*2-1; d2[i]=v; } this.noiseLo=n2;
      const real=new Float32Array(32), imag=new Float32Array(32); for(let n=1;n<32;n++) imag[n]=2/(n*Math.PI)*Math.sin(n*Math.PI*.25); this.pulse25=c.createPeriodicWave(real,imag);
      this.ambStart();
    }catch(e){ this.ctx=null; } }
  setOn(v: boolean){ this.on=v; if(this.out) this.out.gain.setTargetAtTime(v?.5:0,this.ctx!.currentTime,.02); }
  now(){ return this.ctx!.currentTime; }
  midi(m: number){ return 440*Math.pow(2,(m-69)/12); }
  osc(t: number,type: Wave,f: number,dur: number,gain: number,fTo?: number){ const c=this.ctx!,o=c.createOscillator(),g=c.createGain(); if(type==='p25') o.setPeriodicWave(this.pulse25); else o.type=type;
    o.frequency.setValueAtTime(f,t); if(fTo) o.frequency.exponentialRampToValueAtTime(fTo,t+dur);
    g.gain.setValueAtTime(gain,t); g.gain.setValueAtTime(gain,t+dur*.7); g.gain.linearRampToValueAtTime(0,t+dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur+.02); }
  nz(t: number,dur: number,gain: number,lo?: boolean,f0?: number,f1?: number){ const c=this.ctx!,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(); s.buffer=lo?this.noiseLo:this.noise; s.loop=true;
    f.type='lowpass'; f.frequency.setValueAtTime(f0||12000,t); if(f1) f.frequency.exponentialRampToValueAtTime(f1,t+dur);
    g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()*.5); s.stop(t+dur+.02); }
  seq(t: number,notes: (number|null)[],step: number,type: Wave,gain: number,len?: number){ notes.forEach((m,i)=>{ if(m!=null) this.osc(t+i*step,type,this.midi(m),(len||step)*.95,gain); }); }
  chargeStart(){ if(!this.ctx||this.charging) return; const c=this.ctx,o=c.createOscillator(),o2=c.createOscillator(),g=c.createGain(),g2=c.createGain();
    o.setPeriodicWave(this.pulse25); o2.type='triangle'; g.gain.value=0; g2.gain.value=0; o.connect(g); o2.connect(g2); g.connect(this.master); g2.connect(this.master); o.start(); o2.start();
    const ns=c.createBufferSource(); ns.buffer=this.noise; ns.loop=true; const nf=c.createBiquadFilter(); nf.type='bandpass'; nf.Q.value=3; const ng=c.createGain(); ng.gain.value=0; ns.connect(nf); nf.connect(ng); ng.connect(this.master); ns.start();
    this.ch={o,o2,g,g2,ns,nf,ng}; this.charging=true; }
  chargeUpdate(v: number,t: number){ if(!this.charging||!this.ch) return; const ch=this.ch, n=this.now();
    const arp=[0,4,7,12,7,4][Math.floor(t*(9+26*v))%6], base=45+Math.floor(v*28);
    ch.o.frequency.setValueAtTime(this.midi(base+arp), n); ch.o2.frequency.setValueAtTime(this.midi(base-12), n);
    ch.g.gain.setTargetAtTime(v>.002?.045+.09*v:0,n,.02); ch.g2.gain.setTargetAtTime(v>.002?.12+.1*v:0,n,.02);
    ch.nf.frequency.setTargetAtTime(400+7000*v*v,n,.04); ch.ng.gain.setTargetAtTime(.18*v*v*v,n,.04); }
  chargeStop(){ if(!this.charging||!this.ch) return; const n=this.now(), ch=this.ch; [ch.g,ch.g2,ch.ng].forEach(x=>{ x.gain.cancelScheduledValues(n); x.gain.setValueAtTime(0,n); }); ch.o.stop(n+.05); ch.o2.stop(n+.05); ch.ns.stop(n+.05); this.charging=false; this.ch=null; }
  heart(v: number){ if(!this.ctx) return; const t=this.now(); this.osc(t,'triangle',150,.1,.55+.3*v,40); this.osc(t+.1,'triangle',115,.12,.45+.3*v,35); }
  crack(i: number){ if(!this.ctx) return; const t=this.now(); this.nz(t,.1,.4); this.osc(t,'square',this.midi(84+i*3),.05,.07); this.osc(t,'triangle',90,.1,.4,45); }
  zap(){ if(!this.ctx) return; const t=this.now(); this.nz(t,.05,.12,false,9000,3000); this.osc(t,'square',rnd(200,900),.03,.03); }
  /** Rising arpeggio from base note b when the charge teases up a tier. */
  tease(b: number){ if(!this.ctx) return; const t=this.now(); this.seq(t,[b,b+4,b+7,b+12,b+16,b+19],.035,'square',.08); this.nz(t,.3,.15,false,9000,2000); }
  /** The reveal boom: noise hit, crunches, then the tier's jingle, bass line and twinkle. */
  boom(a: TierAudio){ if(!this.ctx) return; const t=this.now();
    this.nz(t,1.4,.8,true,7000,120); this.nz(t,.3,.5,false); this.osc(t,'triangle',200,.8,.9,28); this.osc(t,'square',100,.35,.12,30);
    for(let i=0;i<a.crunch;i++) this.nz(t+Math.random()*.35,.05,.15,false,rnd(4000,11000),2000);
    const s=a.step, d=a.delay; this.seq(t+d,a.mel,s,'p25',.11,s*1.3); this.seq(t+d,a.mel.map(m=>m==null?null:m-12),s,'square',.05,s*1.3);
    if (a.bass) this.seq(t+d,a.bass,s,'triangle',.24,s*2);
    if (a.twinkle) for(let i=0;i<a.twinkle.n;i++) this.osc(t+a.twinkle.at+i*.04,'square',this.midi(96+[0,4,7,12][i%4]),.035,.035); }
  roar(){ if(!this.ctx) return; const t=this.now(); this.nz(t,.7,.35,true,600,3000); }
  after(){ if(!this.ctx) return; const t=this.now(); this.nz(t,.6,.45,true,4000,150); this.osc(t,'triangle',130,.4,.7,32); }
  letter(i: number,n: number){ if(!this.ctx) return; const t=this.now(); this.osc(t,'square',this.midi(72+i*2),.04,.06); this.osc(t,'triangle',110,.06,.35,55); if(i===n-1){ this.nz(t,.25,.35,true,3000,250); this.osc(t,'triangle',90,.3,.7,32); } }
  pip(i: number){ if(!this.ctx) return; this.seq(this.now(),[84+i*5,91+i*5],.04,'square',.06); }
  bar(p: number,i: number){ if(!this.ctx) return; this.osc(this.now(),'p25',this.midi(70+i*5+Math.floor(p*14)),.025,.05); }
  barEnd(i: number){ if(!this.ctx) return; this.seq(this.now(),[86+i*3,93+i*3],.04,'square',.06); }
  clink(){ if(!this.ctx) return; const n=this.now(); if (n-this.lastClink<.035) return; this.lastClink=n; const f=rnd(2200,3400); this.osc(n,'square',f,.03,.03); this.osc(n+.025,'square',f*1.33,.05,.025); }
  glitch(){ if(!this.ctx) return; const t=this.now(); for(let i=0;i<14;i++) this.osc(t+i*.028,'square',rnd(80,2200),.028,.07); this.nz(t,.4,.4,false,9000,300); this.osc(t,'square',990,.45,.08,50); }
  stamp(isNew: boolean){ if(!this.ctx) return; const t=this.now(); this.osc(t,'triangle',160,.2,.8,48); this.nz(t,.12,.35); if(isNew) this.seq(t+.05,[88,93,96,100],.045,'square',.08); else this.seq(t+.05,[76,79],.06,'square',.07); }
  collect(){ if(!this.ctx) return; const t=this.now(); this.seq(t,[79,84,88,91],.04,'p25',.09); this.osc(t,'triangle',100,.14,.45,50); }
  whoosh(){ if(!this.ctx) return; const t=this.now(); this.nz(t,.35,.28,false,900,7000); }
  land(){ if(!this.ctx) return; const t=this.now(); this.osc(t,'triangle',140,.16,.7,42); this.nz(t,.12,.3,true,2200,250); }
  press(){ if(!this.ctx) return; this.osc(this.now(),'square',this.midi(60),.04,.06); }
  blip(){ if(!this.ctx) return; this.osc(this.now(),'square',this.midi(90),.03,.05); }
  fidget(){ if(!this.ctx) return; this.seq(this.now(),[79,83,86,91,95],.035,'square',.07); this.nz(this.now(),.25,.15,false,1200,6000); }
  fanfare(){ if(!this.ctx) return; const t=this.now(); const mel=[72,72,76,79,null,76,79,84,null,null,84,86,88,null,91,null,96];
    this.seq(t,mel,.1,'p25',.12,.12); this.seq(t,mel.map(m=>m==null?null:m-5),.1,'square',.05,.12); this.seq(t,[48,null,55,null,60,null,55,null,53,null,60,null,65,null,67,null,72],.1,'triangle',.26,.18); this.nz(t,.7,.45,true,5000,250); }
  ambStart(){ if(this.amb||!this.ctx) return; const c=this.ctx, g=c.createGain(), f=c.createBiquadFilter(), hum=this.flavour.ambient==='hum'; g.gain.value=hum?.03:.045; f.type='lowpass'; f.frequency.value=hum?520:240;
    // drone: low triangle chord; hum: 60Hz mains buzz under a detuned minor pad
    (hum ? [[60,'square'],[120,'triangle'],[110,'sawtooth'],[110.6,'sawtooth'],[164.8,'sawtooth']] as [number,OscillatorType][] : [[55,'triangle'],[55.7,'triangle'],[82.4,'triangle']] as [number,OscillatorType][])
      .forEach(([fr,type])=>{ const o=c.createOscillator(); o.type=type; o.frequency.value=fr; o.connect(f); o.start(); });
    const lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=.11; lg.gain.value=.02; lfo.connect(lg); lg.connect(g.gain); lfo.start(); f.connect(g); g.connect(this.out); this.amb=g; }
  crackle(pan: number){ if(!this.ctx) return; if (this.flavour.crackle==='data'){ this.chirp(pan); return; } const c=this.ctx, t=this.now(), s2=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain(); s2.buffer=this.noise; f.type='highpass'; f.frequency.value=rnd(1800,5200);
    g.gain.setValueAtTime(rnd(.015,.05),t); g.gain.exponentialRampToValueAtTime(.001,t+rnd(.01,.04)); s2.connect(f); f.connect(g);
    if (c.createStereoPanner){ const pn=c.createStereoPanner(); pn.pan.value=pan; g.connect(pn); pn.connect(this.out); } else g.connect(this.out); s2.start(t, Math.random()*.8); s2.stop(t+.06); }
  /** 'data' lamp tick: a faint high blip, sometimes a two-note chirp, panned to a lamp. */
  private chirp(pan: number){ if (Math.random()<.55) return; const c=this.ctx!, t=this.now(), o=c.createOscillator(), g=c.createGain(); o.type='square'; o.frequency.setValueAtTime(rnd(1800,4200),t); if (Math.random()<.3) o.frequency.setValueAtTime(rnd(2400,5200),t+.018);
    g.gain.setValueAtTime(rnd(.006,.018),t); g.gain.exponentialRampToValueAtTime(.0005,t+.04); o.connect(g);
    if (c.createStereoPanner){ const pn=c.createStereoPanner(); pn.pan.value=pan; g.connect(pn); pn.connect(this.out); } else g.connect(this.out); o.start(t); o.stop(t+.05); }
  snap(){ if(!this.ctx) return; const t=this.now(); this.osc(t,'square',2300,.07,.08,700); this.nz(t,.1,.35,false,12000,3000); this.osc(t,'triangle',170,.14,.45,55); this.osc(t+.02,'square',3100,.04,.04); }
  clunk(){ if(!this.ctx) return; const t=this.now(); this.osc(t,'triangle',120,.16,.6,48); this.nz(t,.1,.3,true,2400,300); this.osc(t,'square',900,.03,.03); }
  rumble(d: number){ if(!this.ctx) return; const t=this.now(); this.nz(t,d,.55,true,420,90); this.osc(t,'triangle',48,d,.35,32); this.nz(t+.1,.5,.25,true,1600,200); }
  thud(){ if(!this.ctx) return; const n=this.now(); if (n-this.lastThud<.045) return; this.lastThud=n; this.osc(n,'triangle',rnd(80,120),.12,.4,40); this.nz(n,.08,.22,true,rnd(900,1800),200); }
  rebuild(){ if(!this.ctx) return; const t=this.now(); this.nz(t,.7,.2,true,300,2500); this.seq(t+.1,[48,52,55,60,64,67],.07,'triangle',.18,.09); }
  summon(){ if(!this.ctx) return; const t=this.now(); this.seq(t,[60,67,72,76,79,84,88,91],.05,'p25',.055,.07); this.nz(t,.7,.14,false,500,7000); this.osc(t,'triangle',55,.8,.25,110); }
  muffle(d: number){ if(!this.ctx) return; const t=this.now(), f=this.lp.frequency; f.cancelScheduledValues(t); f.setValueAtTime(f.value,t); f.exponentialRampToValueAtTime(650,t+.04); f.setValueAtTime(650,t+d*.7); f.exponentialRampToValueAtTime(20000,t+d+.25); }

  close(){ if (this.ctx){ this.ctx.close().catch(()=>{}); this.ctx=null; } this.charging=false; this.ch=null; this.amb=null; }
}
