import { PAL, LIGHTEN, DARKEN } from './palette';

/** 16x16 item sprites; each char is a palette key, "." is transparent. */
const SPR: Record<string, string[]> = {
slime:["................","................","................","................","......kkkk......","....kkllggkk....","...kllggggggk...","..klgggggggggk..","..kggggggggggk..",".kggkwggggkwgGk.",".kggkkggggkkgGk.",".kgggggkkgggGGk.",".kGggggggggggGk.","..kGGggggggGGk..","...kkkkkkkkkk...","................"],
potion:["................","......kkkk......","......kBBk......","......kbbk......",".....kkkkkk.....","......kiik......","......kiik......",".....kiiiik.....","....kiwrrrrk....","...kiwrrrrrrk...","..kirrrrrrrrRk..","..kirrprrrrrRk..","..kirrrrrrrrRk..","..kRrrrrrrrRRk..","...kRRRRRRRRk...","....kkkkkkkk...."],
shield:["................",".kkkkkkkkkkkkkk.",".kSssssssssssSk.",".ksBbBbBbBbBbsk.",".ksBbBbBbBbBbsk.",".ksBbBbBbBbBbsk.",".ksSSSSSSSSSSsk.",".ksBbBbsSBbBbsk.",".ksBbBbSDBbBbsk.","..ksBbBbBbBbsk..","..ksBbBbBbBbsk..","...ksBbBbBbsk...","....ksBbBbsk....",".....ksBbsk.....","......kssk......",".......kk......."],
gem:["................",".......kk.......","......kitk......",".....kiittk.....","....kiwittTk....","...kiwiitttTk...","...kiiiittTTk...","..kiiiitttTTTk..","..kiiitttTTTTk..","...kiitttTTTk...","...kittttTTTk...","....kitttTTk....",".....kttTTk.....","......ktTk......",".......kk.......","................"],
key:["................",".....kkkkk......","....kuuuuuk.....","...kuukkkuuk....","...kuk...kuk....","...kuk...kuk....","...kuukkkuuk....","....kuuiuuk.....",".....kkuukk.....","......kuuk......","......kuuk......","......kuukkk....","......kuuuuk....","......kuukkk....","......kuuuk.....","......kkkkk....."],
sword:[".......kk.......","......kwik......","......kwvk......","......kwmk......","......kwvk......","......kwmk......","......kwvk......","......kwmk......","......kwvk......","..kkkkkkkkkkkk..","..kmVVVyyVVVmk..","..kkkkkkkkkkkk..","......kbBk......","......kBbk......",".....kvyyvk.....","......kkkk......"],
egg:["................","......kkkk......",".....kmvvvk.....","....kmwvvvvk....","....kwvVvvvk....","...kmvvvvvVvk...","...kvvVvvvvvk...","..kmvvvvvVvvvk..","..kvvvVvvvvvVk..","..kvvvvvvVvvVk..","..kvVvvvvvvvVk..","..kVvvvVvvvVVk..","...kVvvvvvVVk...","...kVVvvvVVVk...","....kkVVVVkk....","......kkkk......"],
crown:["................","................","................","..k....kk....k..",".kok..koyk..kok.",".kyk..kyyk..kyk.",".kyyk.kyyk.kyyk.",".kyyykyyyykyyyk.",".kyyyyyyyyyyyyk.",".kkkkkkkkkkkkkk.",".koyyrryyuuyyok.",".kyyyrryyuuyyYk.",".kYyyyyyyyyyYYk.",".kkkkkkkkkkkkkk.","................","................"],
orb:["................",".....kkkkkk.....","...kkoowyyykk...","..kowwoyyyyyYk..",".koowoyyyyyyYYk.",".koyoyyyyyyyYYk.","kooyyyyyyyyyYYYk","koyyyyyyyyyyYYYk","kyyyyyyyyyyYYYYk","kyyyyyyyyyYYYYYk",".kyyyyyyyYYYYYk.",".kYyyyyyYYYYYYk.","..kYYyyYYYYYYk..","...kkYYYYYYkk...",".....kkkkkk.....","................"],
};
type Grid = string[][];

const toGrid = (rows: string[]): Grid => rows.map(r => r.split(''));

/** EPX / Scale2x: doubles a sprite while keeping hard pixel edges. */
function epx(grid: Grid): Grid { const n=grid.length, out=[...Array(n*2)].map(()=>Array<string>(n*2).fill('.')); const at=(x: number,y: number)=>(x<0||y<0||x>=n||y>=n)?'.':grid[y][x];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){ const P=grid[y][x], A=at(x,y-1), B=at(x+1,y), C=at(x-1,y), D=at(x,y+1); let p1=P,p2=P,p3=P,p4=P;
    if (C===A && C!==D && A!==B) p1=A; if (A===B && A!==C && B!==D) p2=B; if (D===C && D!==B && C!==A) p3=C; if (B===D && B!==A && D!==C) p4=D;
    out[y*2][x*2]=p1; out[y*2][x*2+1]=p2; out[y*2+1][x*2]=p3; out[y*2+1][x*2+1]=p4; }
  return out; }

/** Top-left edges get the lighter shade, bottom-right edges the darker one. */
function rimLight(grid: Grid): Grid { const n=grid.length, out=grid.map(r=>r.slice()); const solid=(x: number,y: number)=>x>=0&&y>=0&&x<n&&y<n&&grid[y][x]!=='.'&&grid[y][x]!=='k';
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){ const c=grid[y][x]; if (c==='.'||c==='k') continue;
    if (!solid(x-1,y-1) && !solid(x,y-1) && LIGHTEN[c]) out[y][x]=LIGHTEN[c]; else if (!solid(x+1,y+1) && !solid(x,y+1) && DARKEN[c]) out[y][x]=DARKEN[c]; }
  return out; }

function gridCanvas(grid: Grid): HTMLCanvasElement { const h=grid.length, w=grid[0].length, c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d')!;
  grid.forEach((row,y)=>row.forEach((ch,xx)=>{ if (ch!=='.'){ x.fillStyle=PAL[ch]; x.fillRect(xx,y,1,1); } })); return c; }

/** The vault theme's padlock (11x13). */
export const PADLOCK=["...kkkkk...","..ksSSSsk..",".ksk...ksk.",".ksk...ksk.",".ksk...ksk.","kkkkkkkkkkk","kyyoyyyyyYk","kyoyyyyyyYk","kyyyykyyyYk","kyyykkkyyYk","kyyyykyyyYk","kYyyyyyyYYk","kkkkkkkkkkk"];

export interface SpriteSheet {
  /** raw 16x16 sprites (bag slots) */
  spr16: Record<string, HTMLCanvasElement>;
  /** EPX-upscaled, rim-lit 32x32 sprites (card art) */
  spr32: Record<string, HTMLCanvasElement>;
  lock: HTMLCanvasElement; lockMirror: HTMLCanvasElement; lockWhite: HTMLCanvasElement;
}

/** Builds every sprite canvas once (the padlock from the theme's rows); needs a DOM. */
export function buildSprites(lock: string[] = PADLOCK): SpriteSheet {
  const spr16: Record<string, HTMLCanvasElement> = {}, spr32: Record<string, HTMLCanvasElement> = {};
  for (const k in SPR){ spr16[k]=gridCanvas(toGrid(SPR[k])); spr32[k]=gridCanvas(rimLight(epx(toGrid(SPR[k])))); }
  const lockGrid=toGrid(lock);
  return { spr16, spr32,
    lock: gridCanvas(lockGrid),
    lockMirror: gridCanvas(lockGrid.map(r=>r.slice().reverse())),
    lockWhite: gridCanvas(lockGrid.map(r=>r.map(ch=>ch==='.'||ch==='k'?ch:'w'))) };
}
