/** 35 fixed colours (h/H/n are skin midtones for portrait decks). Every pixel on the canvas is one of these. */
export const PAL: Record<string, string> = { k:'#07060f', w:'#ffffff', c:'#f4efe0', g:'#6fd46a', G:'#2b7a3d', l:'#b6f28a', r:'#e8434f', R:'#8c1f3a', p:'#ff9aa8',
  b:'#8a5a3c', B:'#c98f5a', d:'#4f2f22', s:'#c4ccd9', S:'#8791a6', D:'#4b5268', t:'#47d6c1', T:'#1f8f8a', i:'#bff7f0',
  v:'#b86bff', V:'#6a2fbf', m:'#ff6bd6', y:'#ffcf4a', Y:'#e0781f', o:'#fff3b0', u:'#4f8fff', U:'#22408c',
  0:'#0d0b1e', 1:'#1a1640', 2:'#2b2461', 3:'#3d3a8c', 4:'#a9a3c9', 5:'#6a6394',
  h:'#f5d2b4', H:'#dfa47f', n:'#a86d45' };

/** Palette as little-endian ABGR words for direct ImageData writes. */
export const U32: Record<string, number> = {};
for (const k in PAL) { const h = PAL[k]; const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16); U32[k] = (255<<24|b<<16|g<<8|r)>>>0; }

export const BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v => (v + .5) / 16);
export const bay = (x: number, y: number) => BAYER[(y&3)*4+(x&3)];

/** 7-step light ramps, dark → bright. */
export const RAMPS: Record<string, string[]> = { stone:['k','0','1','2','3','5','4'], warm:['k','0','d','d','b','Y','o'], s:['k','0','1','D','S','s','w'], t:['k','0','U','T','t','i','w'], v:['k','0','2','V','v','m','w'], y:['k','0','d','Y','y','o','w'], g:['k','0','1','G','g','l','w'] };
export const RAMPU: Record<string, number[]> = {}; for (const k in RAMPS) RAMPU[k] = RAMPS[k].map(c => U32[c]);

export const LIGHTEN: Record<string, string> = {g:'l',G:'g',l:'w',r:'p',R:'r',p:'w',b:'B',B:'o',d:'b',s:'w',S:'s',D:'S',t:'i',T:'t',i:'w',v:'m',V:'v',m:'w',y:'o',Y:'y',o:'w',u:'i',U:'u',c:'w'};
export const DARKEN: Record<string, string> = {w:'c',c:'4',l:'g',g:'G',G:'G',r:'R',R:'R',p:'r',B:'b',b:'d',d:'d',s:'S',S:'D',D:'D',i:'t',t:'T',T:'T',m:'v',v:'V',V:'V',o:'y',y:'Y',Y:'R',u:'U',U:'U'};
