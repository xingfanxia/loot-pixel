import type { Layout, Vault } from './context';
import { seedDust } from './particles';
import { clamp, mk } from './util';

export const initialLayout = (): Layout => ({ SC: 3, W: 400, H: 260, TS: 4, NARROW: false, CX: 200, CY: 110, HY: 180, PTOP: 160, PBASE: 186,
  GMIN: 190, GMAX: 250, TOP: 0, HUDTOP: 250, SLOT: 18, BAGY: 4, BAGCOLS: 9, BAGH: 18, TORCH: [], CAPY: 189, STALE: false });

const GAP=2;
/** Height of the collection bar under each bag slot: decks with several cards per slot show x/n there. */
export const barH=(V: Vault)=>V.deck.cards.length>V.deck.slots.length?3:0;
/**
 * Bag grid for the viewport: one row of icon-sized slots on wide screens. On narrow ones the row
 * shrinks to fit (icons halve until they fit a slot, as drawBag does); when that would draw them
 * below the layout's minIcon and two icon-sized rows fit, the bag wraps onto two rows instead.
 */
function bagGrid(V: Vault, W: number, narrow: boolean){ const { icon, minIcon } = V.geo, n=V.deck.slots.length, room=W-6, fits=(cols: number)=>cols*(icon+GAP)-GAP<=room;
  if (!narrow) return { SLOT: icon, COLS: n };
  const slot=Math.max(icon>>1, Math.min(icon, Math.floor(room/n)-2)); let drawn=icon; while (drawn>slot && drawn>1) drawn>>=1;
  if (drawn<minIcon && fits(Math.ceil(n/2))) return { SLOT: icon, COLS: Math.ceil(n/2) };
  return { SLOT: slot, COLS: n }; }

/**
 * Integer pixel scale from the window, then the scene stacked around the card: title above,
 * card at CY, altar under it, floor to the HUD. Rebuilds the scene and positions the DOM overlays.
 */
export function applyLayout(V: Vault){
  const { els } = V.env, { w: CW, h: CH, hh } = V.geo, B = V.B, L = V.L;
  const iw=innerWidth, ih=innerHeight;
  L.SC=Math.max(2, Math.floor(Math.min(iw/(CW*2), ih/(CH+138))));
  const SC=L.SC; L.W=Math.ceil(iw/SC); L.H=Math.ceil(ih/SC); const W=L.W, H=L.H;
  for (const c of [B.cv]){ c.width=W; c.height=H; c.style.width=W*SC+'px'; c.style.height=H*SC+'px'; }
  B.bloomC.width=Math.ceil(W/2); B.bloomC.height=Math.ceil(H/2); B.bloomC.style.width=W*SC+'px'; B.bloomC.style.height=H*SC+'px';
  B.g.imageSmoothingEnabled=false;
  [B.layerC,B.layerG]=mk(W,H); [B.silC,B.silG]=mk(W,H);
  L.TS=W>=300?4:3; L.NARROW=W<300; const grid=bagGrid(V, W, L.NARROW), rows=Math.ceil(V.deck.slots.length/grid.COLS);
  L.SLOT=grid.SLOT; L.BAGCOLS=grid.COLS; L.BAGH=rows*(grid.SLOT+GAP+barH(V))-GAP; L.STALE=false;
  const NARROW=L.NARROW, SLOT=L.SLOT, BAGH=L.BAGH;
  L.TOP=Math.ceil((parseFloat(getComputedStyle(document.documentElement).paddingTop)||0)/SC);
  L.HUDTOP=Math.floor(els.hud.getBoundingClientRect().top/SC);
  const titleTop=NARROW?L.TOP+8:L.TOP+4+SLOT+8, CY0=titleTop+5*L.TS+10+hh, need=CY0+hh+7+26+18+(NARROW?BAGH+10:0), extra=Math.max(0,L.HUDTOP-4-need);
  L.CX=Math.round(W/2); L.CY=Math.round(CY0+extra*.42);
  L.PTOP=L.CY+hh+8; L.PBASE=L.PTOP+26; L.HY=L.PTOP+13; L.GMIN=L.HY+4; L.BAGY=NARROW?L.HUDTOP-BAGH-6:L.TOP+4; L.GMAX=Math.max(L.GMIN+6,(NARROW?L.BAGY-3:L.HUDTOP-4));
  const tdx=Math.round(clamp(W*.36,46,150)); L.TORCH=[{x:L.CX-tdx,y:L.CY-6},{x:L.CX+tdx,y:L.CY-6}];
  V.theme.buildScene(V); seedDust(V);
  const { hit, again } = els, CX=L.CX, CY=L.CY;
  hit.style.left=(CX-CW/2)*SC+'px'; hit.style.top=(CY-CH/2)*SC+'px'; hit.style.width=CW*SC+'px'; hit.style.height=CH*SC+'px';
  const caption=V.deck.cards.some(c=>c.title)&&!V.geo.titleH?4:0; // room for the variant title under the altar (decks without a title bar)
  const againTop=Math.min((L.PBASE+8+caption)*SC, (NARROW?L.BAGY-4:L.HUDTOP-14)*SC-44); L.CAPY=Math.min(L.PBASE+3, Math.floor(againTop/SC)-8);
  again.style.left=CX*SC+'px'; again.style.top=againTop+'px';
  // the bag row (plus the counter beside it on wide screens) is one button that opens the collection
  if (els.bag){ const rs=V.deck.slots.map((_,i)=>slotRect(V,i)), x0=Math.min(...rs.map(r=>r.x))-2, x1=Math.max(...rs.map(r=>r.x+r.w))+(NARROW?2:30);
    els.bag.style.left=x0*SC+'px'; els.bag.style.top=(L.BAGY-2)*SC+'px'; els.bag.style.width=(x1-x0)*SC+'px'; els.bag.style.height=(L.BAGH+4)*SC+'px'; }
  els.crt.style.backgroundImage=`repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0 ${SC-1}px, rgba(0,0,0,.16) ${SC-1}px ${SC}px), radial-gradient(ellipse 75% 70% at 50% 50%, transparent 60%, rgba(0,0,0,.5) 100%)`;
  els.stage.style.transformOrigin=`${CX*SC}px ${CY*SC}px`;
}

/** Screen rect of bag slot i (rows of BAGCOLS, each row centred on narrow screens). */
export function slotRect(V: Vault, i: number){ const { SLOT, NARROW, W, BAGY, BAGCOLS } = V.L, n=V.deck.slots.length, row=Math.floor(i/BAGCOLS), inRow=Math.min(BAGCOLS, n-row*BAGCOLS),
    total=inRow*(SLOT+GAP)-GAP, x0=NARROW?Math.round((W-total)/2):4;
  return {x:x0+(i-row*BAGCOLS)*(SLOT+GAP), y:BAGY+row*(SLOT+GAP+barH(V)), w:SLOT, h:SLOT}; }

/** Re-fits the scene to a moved HUD: at once while the scene is calm, else flagged for flushLayout(). */
export function refitToHud(V: Vault){ if (Math.floor(V.env.els.hud.getBoundingClientRect().top/V.L.SC)===V.L.HUDTOP) return false;
  if (calm(V)){ applyLayout(V); return true; } V.L.STALE=true; return false; }
/** Applies a deferred re-fit once the wall is whole and no card is mid-reveal (called every tick). */
export function flushLayout(V: Vault){ if (V.L.STALE && calm(V)) applyLayout(V); }
// a re-fit rebuilds the scene (wall, snapshot bricks are cut from), so never during a reveal, a wall break/rebuild or a charge
const calm=(V: Vault)=>{ const S=V.S; return !S.wall.active && !S.holding && !S.auto && (S.phase==='idle'||S.phase==='entering'); };
