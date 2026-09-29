// 5x7 pixel font with proportional spacing. Strings are rendered once and cached.

const G: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '###|.#.|.#.|.#.|.#.|.#.|###',
  J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '.#.|##.|.#.|.#.|.#.|.#.|###',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '####.|....#|....#|.###.|....#|....#|####.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '.###.|#....|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|..#..|..#..|..#..',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|....#|.###.',
  '.': '.|.|.|.|.|.|#',
  ',': '..|..|..|..|..|.#|#.',
  '!': '#|#|#|#|#|.|#',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  "'": '#|#|.|.|.|.|.',
  '"': '#.#|#.#|...|...|...|...|...',
  '-': '....|....|....|####|....|....|....',
  ':': '.|.|#|.|.|#|.',
  '/': '....#|...#.|...#.|..#..|.#...|.#...|#....',
  '(': '.#|#.|#.|#.|#.|#.|.#',
  ')': '#.|.#|.#|.#|.#|.#|#.',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#',
  '%': '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##',
  '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....',
  '<': '...#|..#.|.#..|#...|.#..|..#.|...#',
  '>': '#...|.#..|..#.|...#|..#.|.#..|#...',
  '=': '....|....|####|....|####|....|....',
  '#': '.#.#.|#####|.#.#.|.#.#.|.#.#.|#####|.#.#.',
};

interface Glyph {
  w: number;
  rows: string[];
}
const glyphs = new Map<string, Glyph>();
for (const [ch, s] of Object.entries(G)) {
  const rows = s.split('|');
  glyphs.set(ch, { w: rows[0].length, rows });
}

export const FONT_H = 7;

export function textWidth(text: string, scale = 1): number {
  let w = 0;
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') w += 3;
    else w += (glyphs.get(ch)?.w ?? 3) + 1;
  }
  return Math.max(0, w - 1) * scale;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Render a string to a cached canvas. `shadow` adds a 1px dark drop shadow. */
export function textCanvas(text: string, color: string, shadow?: string): HTMLCanvasElement {
  const key = `${text}|${color}|${shadow ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const up = text.toUpperCase();
  const w = textWidth(up) + (shadow ? 1 : 0);
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = FONT_H + (shadow ? 1 : 0);
  const g = c.getContext('2d')!;
  const draw = (ox: number, oy: number, col: string) => {
    g.fillStyle = col;
    let x = ox;
    for (const ch of up) {
      if (ch === ' ') {
        x += 3;
        continue;
      }
      const gl = glyphs.get(ch);
      if (!gl) {
        x += 4;
        continue;
      }
      for (let r = 0; r < gl.rows.length; r++) {
        const row = gl.rows[r];
        for (let q = 0; q < row.length; q++) if (row[q] === '#') g.fillRect(x + q, oy + r, 1, 1);
      }
      x += gl.w + 1;
    }
  };
  if (shadow) draw(1, 1, shadow);
  draw(0, 0, color);
  cache.set(key, c);
  return c;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, opts: { shadow?: string; scale?: number; align?: 'left' | 'center' | 'right' } = {}) {
  const c = textCanvas(text, color, opts.shadow);
  const s = opts.scale ?? 1;
  let dx = x;
  if (opts.align === 'center') dx = x - Math.floor((c.width * s) / 2);
  else if (opts.align === 'right') dx = x - c.width * s;
  ctx.drawImage(c, Math.round(dx), Math.round(y), c.width * s, c.height * s);
}
