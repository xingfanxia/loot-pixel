import { PAL } from './palette';
import type { Ctx2D } from './util';

/** 3x5 bitmap glyphs, row-major, '#' = ink. */
const F3: Record<string, string> = {"A":".#.#.#####.##.#","B":"##.#.###.#.###.","C":".###..#..#...##","D":"##.#.##.##.###.","E":"####..##.#..###","F":"####..##.#..#..","G":".###..#.##.#.##","H":"#.##.#####.##.#","I":"###.#..#..#.###","J":"..#..#..##.#.#.","K":"#.##.###.#.##.#","L":"#..#..#..#..###","M":"#.########.##.#","N":"##.#.##.##.##.#","O":".#.#.##.##.#.#.","P":"##.#.###.#..#..","Q":".#.#.##.###..##","R":"##.#.###.#.##.#","S":".###...#...###.","T":"###.#..#..#..#.","U":"#.##.##.##.####","V":"#.##.##.##.#.#.","W":"#.##.########.#","X":"#.##.#.#.#.##.#","Y":"#.##.#.#..#..#.","Z":"###..#.#.#..###","0":"####.##.##.####","1":".#.##..#..#.###","2":"##...#.#.#..###","3":"##...#.#...###.","4":"#.##.####..#..#","5":"####..##...###.","6":".###..####.####","7":"###..#.#..#..#.","8":"####.#####.####","9":"####.####..###.","!":".#..#..#.....#.","?":"##...#.#.....#.","+":"....#.###.#....",".":".............#.",":":"....#.....#....","-":"......###......"," ":"...............","x":"...#.#.#.#.#...","'":".#..#..........","/":"..#..#.#.#..#..",">":"#...#...#.#.#.."};

type ColFn = (row: number, n: number) => string | CanvasPattern;

export const textW = (str: string, s: number) => str.length * 4 * s - s;

function glyphs(g: Ctx2D, str: string, x: number, y: number, s: number, colFn: ColFn) {
  for (let n = 0; n < str.length; n++) { const gl = F3[str[n]] || F3['?'];
    for (let i = 0; i < 15; i++) if (gl[i] === '#') { g.fillStyle = colFn(Math.floor(i/3), n); g.fillRect(x+n*4*s+(i%3)*s, y+Math.floor(i/3)*s, s, s); } }
}

export function drawText(g: Ctx2D, str: string, x: number, y: number, s: number, col: string, outline?: string) {
  x = Math.round(x); y = Math.round(y);
  if (outline) { const o = () => PAL[outline]; for (const [ox,oy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[1,-1],[-1,1],[0,2],[1,2]]) glyphs(g,str,x+ox,y+oy,s,o); }
  const c = PAL[col] || col; glyphs(g, str, x, y, s, () => c);
}

export function drawRampText(g: Ctx2D, str: string, x: number, y: number, s: number, rampFn: (row: number, n: number) => string) {
  x = Math.round(x); y = Math.round(y); const k = () => PAL.k;
  for (const [ox,oy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[1,-1],[-1,1]]) glyphs(g,str,x+ox*Math.max(1,s>>1),y+oy*Math.max(1,s>>1),s,k);
  glyphs(g,str,x+1,y+Math.max(2,s),s,k); glyphs(g,str,x,y,s,(row,n) => PAL[rampFn(row,n)]);
}
