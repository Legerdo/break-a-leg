// Procedural 16x16 tile painters. Everything draws on integer pixels.
import { TILE } from '../game/config';
import { PAL } from './sprites';

type Ctx = CanvasRenderingContext2D;

export const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

const px = (g: Ctx, x: number, y: number, c: string, w = 1, h = 1) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

export const FACADE = '#24150f';
export const FACADE_D = '#190e0a';

/** Front face of the stage below the deck line. */
export function facade(g: Ctx, x: number, y: number, tx: number, ty: number) {
  px(g, x, y, FACADE, TILE, TILE);
  // vertical boards
  px(g, x + ((tx & 1) ? 7 : 3), y, FACADE_D, 1, TILE);
  if (hash(tx, ty) % 5 === 0) px(g, x + 11, y + 6, '#3a2418', 1, 1);
  if (ty % 2 === 0) px(g, x, y + 15, FACADE_D, TILE, 1);
}

/** Plank top of the stage deck (air above). */
export function deckTop(g: Ctx, x: number, y: number, tx: number, ty: number) {
  facade(g, x, y, tx, ty);
  px(g, x, y, PAL.P, TILE, 1);
  px(g, x, y + 1, PAL.p, TILE, 3);
  px(g, x, y + 4, PAL.O, TILE, 1);
  px(g, x, y + 5, PAL.w, TILE, 1);
  // staggered plank ends
  const seam = (hash(tx, ty) & 1) ? 5 : 12;
  px(g, x + seam, y + 1, PAL.O, 1, 3);
  // grain
  const h = hash(tx * 3, ty);
  px(g, x + (h % 13), y + 2, PAL.O, 2, 1);
  if (h & 8) px(g, x + ((h >> 4) % 12) + 2, y + 3, '#b57c45', 3, 1);
  px(g, x + 2, y + 2, '#8d5f35', 1, 1);
}

export function tapeX(g: Ctx, x: number, y: number) {
  // bright spike-tape X on the plank face
  const c = PAL.Y;
  for (let i = 0; i < 6; i++) {
    px(g, x + 4 + i, y + i, c);
    px(g, x + 5 + i, y + i, c);
    px(g, x + 11 - i, y + i, c);
    px(g, x + 10 - i, y + i, c);
  }
  px(g, x + 7, y + 2, '#fff7c8', 2, 2);
}

/** Seamed panel: trapdoors and stage lifts look exactly alike. */
export function panel(g: Ctx, x: number, y: number, w: number, taped: number[], tx0: number, ty: number) {
  for (let i = 0; i < w; i++) {
    const cx = x + i * TILE;
    px(g, cx, y, PAL.P, TILE, 1);
    px(g, cx, y + 1, PAL.p, TILE, 3);
    px(g, cx, y + 4, PAL.O, TILE, 1);
    px(g, cx, y + 5, PAL.k, TILE, 1);
    const h = hash((tx0 + i) * 3, ty);
    px(g, cx + (h % 13), y + 2, PAL.O, 2, 1);
    if (i > 0) px(g, cx, y + 1, PAL.O, 1, 4);
  }
  const W = w * TILE;
  // dark cut lines at the panel ends, with a bevel so they read at a glance
  px(g, x, y, PAL.k, 1, 6);
  px(g, x + 1, y + 1, PAL.P, 1, 4);
  px(g, x + W - 1, y, PAL.k, 1, 6);
  px(g, x + W - 2, y + 1, PAL.o, 1, 4);
  // hinges
  px(g, x + 2, y + 1, PAL.S, 2, 1);
  px(g, x + 2, y + 3, PAL.S, 2, 1);
  px(g, x + 2, y + 2, PAL.g, 1, 1);
  // ring pull
  const rx = x + Math.floor(W / 2) - 2;
  px(g, rx, y + 3, PAL.g, 4, 1);
  px(g, rx, y + 2, PAL.S, 1, 1);
  px(g, rx + 3, y + 2, PAL.S, 1, 1);
  px(g, rx + 1, y + 1, PAL.S, 2, 1);
  for (const t of taped) tapeX(g, x + (t - tx0) * TILE, y);
}

/** Solid set walls: cool grey stone blocks, clearly brighter than the backdrop. */
export function wall(g: Ctx, x: number, y: number, tx: number, ty: number, top: boolean, left: boolean, right: boolean, bottom: boolean) {
  px(g, x, y, '#4a4463', TILE, TILE);
  for (let r = 0; r < 2; r++) {
    const off = (r + ty) & 1 ? 8 : 0;
    const by = y + r * 8;
    px(g, x, by + 7, '#2c2740', TILE, 1);
    for (let b = -1; b < 2; b++) {
      const bx = x + off + b * 16;
      const h = hash(tx * 4 + b, ty * 4 + r);
      const x0 = Math.max(x, bx + 1);
      const x1 = Math.min(x + TILE, bx + 15);
      if (x1 > x0) {
        px(g, x0, by, h % 3 === 0 ? '#5a5376' : '#524b6d', x1 - x0, 1);
        if (h % 4 === 1) px(g, x0 + 3, by + 3, '#433d5a', 3, 1);
      }
      if (bx + 15 >= x && bx + 15 < x + TILE) px(g, bx + 15, by, '#2c2740', 1, 7);
    }
  }
  if (top) {
    px(g, x, y, '#a49cc8', TILE, 1);
    px(g, x, y + 1, '#736b96', TILE, 1);
  }
  if (bottom) {
    px(g, x, y + 14, '#2c2740', TILE, 1);
    px(g, x, y + 15, '#0e0b16', TILE, 1);
  }
  if (left) px(g, x, y, '#6a6390', 1, TILE);
  if (right) px(g, x + 15, y, '#1a1626', 1, TILE);
}

export function crate(g: Ctx, x: number, y: number, tx: number, ty: number) {
  px(g, x, y, PAL.k, TILE, TILE);
  px(g, x + 1, y + 1, PAL.O, 14, 14);
  // frame
  px(g, x + 1, y + 1, PAL.p, 14, 2);
  px(g, x + 1, y + 13, PAL.o, 14, 2);
  px(g, x + 1, y + 1, PAL.p, 2, 14);
  px(g, x + 13, y + 1, PAL.o, 2, 14);
  px(g, x + 1, y + 1, PAL.P, 14, 1);
  // diagonal brace
  const flip = hash(tx, ty) & 1;
  for (let i = 0; i < 10; i++) {
    const bx = flip ? x + 3 + i : x + 12 - i;
    px(g, bx, y + 3 + i, PAL.p, 2, 1);
    px(g, bx, y + 4 + i, PAL.o, 1, 1);
  }
  // nails
  px(g, x + 2, y + 2, PAL.s);
  px(g, x + 13, y + 2, PAL.s);
  px(g, x + 2, y + 13, PAL.G);
  px(g, x + 13, y + 13, PAL.G);
}

export function catwalk(g: Ctx, x: number, y: number) {
  px(g, x, y, PAL.S, TILE, 1);
  px(g, x, y + 1, PAL.G, TILE, 2);
  for (let i = 1; i < TILE; i += 3) px(g, x + i, y + 1, PAL.k, 1, 1);
  px(g, x, y + 3, PAL.g, TILE, 1);
  // truss
  for (let i = 0; i < 8; i++) {
    px(g, x + i, y + 4 + Math.floor(i * 0.8), '#3b3b50');
    px(g, x + 15 - i, y + 4 + Math.floor(i * 0.8), '#3b3b50');
  }
  px(g, x, y + 10, '#3b3b50', TILE, 1);
}

// 5x8 spike, pointing up. Rows top->bottom.
const SPIKE = ['..W..', '..S..', '.SSs.', '.SsG.', 'SSsGG', 'SssGG', 'SssGg', 'ksssk'];

export function spikes(g: Ctx, x: number, y: number, dir: 'u' | 'd' | 'l' | 'r', flattened = false) {
  const put = (sx: number, sy: number, c: string) => {
    // (sx, sy) in "up" space within the 16x16 cell
    let dx = sx;
    let dy = sy;
    if (dir === 'd') {
      dx = sx;
      dy = 15 - sy;
    } else if (dir === 'l') {
      dx = sy;
      dy = sx;
    } else if (dir === 'r') {
      dx = 15 - sy;
      dy = sx;
    }
    px(g, x + dx, y + dy, c);
  };
  if (flattened) {
    for (let i = 0; i < 16; i++) {
      put(i, 14, i % 3 === 0 ? PAL.S : PAL.s);
      put(i, 15, PAL.e);
    }
    return;
  }
  for (let s = 0; s < 3; s++) {
    const ox = 1 + s * 5;
    for (let r = 0; r < SPIKE.length; r++) {
      const row = SPIKE[r];
      for (let c = 0; c < 5; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        put(ox + c, 6 + r, PAL[ch]);
      }
    }
  }
  for (let i = 0; i < 16; i++) {
    put(i, 14, PAL.R);
    put(i, 15, PAL.e);
  }
}
