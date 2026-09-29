import { ROWS } from './config';
import type { EntDef, LevelDef } from './types';

// Tile codes stored in the grid.
export const Tl = {
  AIR: 0,
  DECK: 1,
  WALL: 2,
  CRATE: 3,
  CAT: 4, // one-way catwalk
  SP_U: 5,
  SP_D: 6,
  SP_L: 7,
  SP_R: 8,
  TRAP: 9, // closed trapdoor panel (solid until opened)
} as const;

export type TileCode = (typeof Tl)[keyof typeof Tl];

export function isSolidTile(t: number): boolean {
  return t === Tl.DECK || t === Tl.WALL || t === Tl.CRATE || t === Tl.TRAP;
}
export function isSpike(t: number): boolean {
  return t >= Tl.SP_U && t <= Tl.SP_R;
}

export interface PlacedEnt {
  def: EntDef;
  ox: number; // segment x offset in tiles (add to every x in def)
  seg: number;
}

export interface Group {
  kind: 'trap' | 'lift';
  x: number; // first column
  y: number; // row
  w: number; // columns
  taped: number[]; // columns with X tape
}

export interface BuiltLevel {
  def: LevelDef;
  w: number;
  h: number;
  tiles: Uint8Array;
  tape: Set<number>; // cell index -> X tape drawn on a solid (non-trap) tile
  groups: Group[];
  ents: PlacedEnt[];
  segs: { name: string; x: number; w: number }[];
}

const CHAR_TILE: Record<string, number> = {
  '.': Tl.AIR,
  '#': Tl.DECK,
  x: Tl.DECK, // painter's tape on a solid deck tile
  W: Tl.WALL,
  C: Tl.CRATE,
  '=': Tl.CAT,
  '^': Tl.SP_U,
  v: Tl.SP_D,
  '<': Tl.SP_L,
  '>': Tl.SP_R,
  T: Tl.TRAP,
  X: Tl.TRAP,
  L: Tl.AIR, // lifts are dynamic solids
  M: Tl.AIR,
};

export function buildLevel(def: LevelDef): BuiltLevel {
  let w = 0;
  const segs: BuiltLevel['segs'] = [];
  for (const s of def.segments) {
    if (s.map.length !== ROWS) throw new Error(`${def.id}/${s.name}: expected ${ROWS} rows, got ${s.map.length}`);
    const sw = s.map[0].length;
    for (const row of s.map) {
      if (row.length !== sw) throw new Error(`${def.id}/${s.name}: ragged row "${row}" (${row.length} vs ${sw})`);
    }
    segs.push({ name: s.name, x: w, w: sw });
    w += sw;
  }
  const h = ROWS;
  const tiles = new Uint8Array(w * h);
  const tape = new Set<number>();
  const liftCells: boolean[] = new Array(w * h).fill(false);
  const tapedCells = new Set<number>();
  const ents: PlacedEnt[] = [];

  def.segments.forEach((s, si) => {
    const ox = segs[si].x;
    for (let y = 0; y < h; y++) {
      const row = s.map[y];
      for (let lx = 0; lx < row.length; lx++) {
        const ch = row[lx];
        const code = CHAR_TILE[ch];
        if (code === undefined) throw new Error(`${def.id}/${s.name}: unknown tile '${ch}' at ${lx},${y}`);
        const i = y * w + ox + lx;
        tiles[i] = code;
        if (ch === 'x') tape.add(i);
        if (ch === 'X' || ch === 'M') tapedCells.add(i);
        if (ch === 'L' || ch === 'M') liftCells[i] = true;
      }
    }
    for (const e of s.ents ?? []) {
      ents.push({ def: e, ox, seg: si });
    }
  });

  // Group contiguous trapdoor / lift cells per row.
  const groups: Group[] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const i = y * w + x;
      const kind = tiles[i] === Tl.TRAP ? 'trap' : liftCells[i] ? 'lift' : null;
      if (!kind) {
        x++;
        continue;
      }
      const g: Group = { kind, x, y, w: 0, taped: [] };
      while (x < w) {
        const j = y * w + x;
        const k2 = tiles[j] === Tl.TRAP ? 'trap' : liftCells[j] ? 'lift' : null;
        if (k2 !== kind) break;
        if (tapedCells.has(j)) g.taped.push(x);
        g.w++;
        x++;
      }
      groups.push(g);
    }
  }

  return { def, w, h, tiles, tape, groups, ents, segs };
}

export function segX(level: BuiltLevel, name: string): number {
  const s = level.segs.find((q) => q.name === name);
  if (!s) throw new Error(`no segment ${name}`);
  return s.x;
}
