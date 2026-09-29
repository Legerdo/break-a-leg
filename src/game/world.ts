import { BAG, DEATH, DT, PLAYER, TILE, TRAP_SWING, VIEW_H, VIEW_W } from './config';
import { buildLevel, isSolidTile, isSpike, Tl, type BuiltLevel, type Group } from './level';
import type { Action, DecoKind, EntDef, Input, LevelDef, TileRect } from './types';

// ---------------------------------------------------------------------------
// Basic geometry

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const hit = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const approach = (v: number, t: number, d: number) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const tileBox = (r: TileRect, ox: number): Box => ({ x: (r[0] + ox) * TILE, y: r[1] * TILE, w: r[2] * TILE, h: r[3] * TILE });

// Small deterministic RNG so particle bursts are identical run to run.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Events & particles (consumed by the presentation layer)

export type EvType =
  | 'jump'
  | 'land'
  | 'die'
  | 'respawn'
  | 'checkpoint'
  | 'exit'
  | 'bagWobble'
  | 'bagLand'
  | 'bagBurst'
  | 'trapArm'
  | 'trapOpen'
  | 'liftStart'
  | 'liftStop'
  | 'knightOut'
  | 'knightCrush'
  | 'bearRoar'
  | 'spotCatch'
  | 'moverStart'
  | 'bump'
  | 'stuck';

export interface GameEvent {
  type: EvType;
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  g: number;
  front?: boolean;
}

export type DeathCause = 'spikes' | 'bag' | 'cutout' | 'fall' | 'crush' | 'retry';

// ---------------------------------------------------------------------------
// Entities

interface Solid {
  readonly kind: 'mover' | 'lift' | 'bag';
  box(): Box;
  dx: number;
  dy: number;
}

export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  grounded = false;
  coyote = 0;
  buffer = 0;
  face: 1 | -1 = 1;
  jumpHeld = false;
  ground: Solid | null = null;
  carryVx = 0; // momentum inherited from a moving platform while airborne
  // presentation state
  sx = 1;
  sy = 1;
  runT = 0;
  airT = 0;
  landT = 0;
  get cx() {
    return this.x + PLAYER.W / 2;
  }
  box(): Box {
    return { x: this.x, y: this.y, w: PLAYER.W, h: PLAYER.H };
  }
}

export class Mover implements Solid {
  readonly kind = 'mover' as const;
  x: number;
  y: number;
  w: number;
  h: number;
  pts: { x: number; y: number }[];
  idx = 1;
  dir = 1;
  active: boolean;
  done = false;
  waitT = 0;
  dx = 0;
  dy = 0;
  constructor(public def: Extract<EntDef, { t: 'mover' }>, ox: number) {
    this.pts = [[0, 0] as [number, number], ...def.path].map(([a, b]) => ({ x: (def.x + ox + a) * TILE, y: (def.y + b) * TILE }));
    this.x = this.pts[0].x;
    this.y = this.pts[0].y;
    this.w = def.w * TILE;
    this.h = def.h * TILE;
    this.active = def.start === 'always';
  }
  box(): Box {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
  update() {
    this.dx = this.dy = 0;
    if (!this.active || this.done || this.pts.length < 2) return;
    if (this.waitT > 0) {
      this.waitT -= DT;
      return;
    }
    const tgt = this.pts[this.idx];
    const ddx = tgt.x - this.x;
    const ddy = tgt.y - this.y;
    const dist = Math.hypot(ddx, ddy);
    const step = this.def.speed * DT;
    let nx: number;
    let ny: number;
    if (dist <= step) {
      nx = tgt.x;
      ny = tgt.y;
      this.advance();
    } else {
      nx = this.x + (ddx / dist) * step;
      ny = this.y + (ddy / dist) * step;
    }
    this.dx = nx - this.x;
    this.dy = ny - this.y;
    this.x = nx;
    this.y = ny;
  }
  private advance() {
    this.waitT = this.def.wait ?? 0;
    const n = this.pts.length;
    if (this.def.mode === 'loop') this.idx = (this.idx + 1) % n;
    else if (this.def.mode === 'pingpong') {
      if (this.idx + this.dir < 0 || this.idx + this.dir >= n) this.dir = -this.dir;
      this.idx += this.dir;
    } else {
      if (this.idx >= n - 1) this.done = true;
      else this.idx++;
    }
  }
}

export class Lift implements Solid {
  readonly kind = 'lift' as const;
  x: number;
  y: number;
  w: number;
  h = TILE;
  baseY: number;
  topY: number;
  state: 'idle' | 'shake' | 'rise' | 'up' = 'idle';
  t = 0;
  v = 0;
  dx = 0;
  dy = 0;
  constructor(
    public g: Group,
    rise: number,
    public speed: number,
  ) {
    this.x = g.x * TILE;
    this.y = g.y * TILE;
    this.w = g.w * TILE;
    this.baseY = this.y;
    this.topY = this.y - rise * TILE;
  }
  box(): Box {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

export class Trapdoor {
  state: 'closed' | 'armed' | 'open' = 'closed';
  t = 0;
  swing = 0;
  cover: { x: number; y0: number; y1: number }[] = [];
  constructor(
    public g: Group,
    public id: string | undefined,
    public delay: number,
    public byBag: boolean,
  ) {}
}

export class Bag implements Solid {
  readonly kind = 'bag' as const;
  state: 'hang' | 'wobble' | 'fall' | 'land' | 'gone' = 'hang';
  t = 0;
  vy = 0;
  dx = 0;
  dy = 0;
  onSolid: Solid | null = null;
  ropeTop: number;
  constructor(
    public x: number,
    public y: number,
    public id: string | undefined,
    public trig: Box | null,
    public hint: boolean,
    ropeTop: number,
  ) {
    this.ropeTop = ropeTop;
  }
  box(): Box {
    return { x: this.x, y: this.y, w: TILE, h: TILE };
  }
  hitBox(): Box {
    return { x: this.x + 2, y: this.y + 3, w: TILE - 4, h: TILE - 3 };
  }
}

export type CutoutKind = 'knight' | 'cloud' | 'bear';
const CUT_SIZE: Record<CutoutKind, [number, number]> = { knight: [14, 24], cloud: [32, 22], bear: [30, 28] };

export class Cutout {
  x: number;
  y: number;
  w: number;
  h: number;
  x0: number;
  x1: number;
  dir: 1 | -1;
  active: boolean;
  flat = false;
  stun = 0;
  blockT = 0;
  t = 0;
  railY: number;
  moving = false;
  constructor(
    public def: Extract<EntDef, { t: 'cutout' }>,
    ox: number,
  ) {
    const [w, h] = CUT_SIZE[def.kind];
    this.w = w;
    this.h = h;
    this.x0 = (def.rail[0] + ox) * TILE;
    this.x1 = (def.rail[1] + ox) * TILE;
    this.x = clamp((def.x + ox) * TILE + (TILE - w) / 2, this.x0, this.x1 - w);
    if (def.kind === 'cloud') {
      this.railY = (def.y + 1) * TILE;
      this.y = this.railY + (def.hang ?? 0);
    } else {
      this.railY = (def.y + 1) * TILE;
      this.y = this.railY - h;
    }
    this.dir = def.dir ?? 1;
    this.active = def.active ?? true;
  }
  get kind() {
    return this.def.kind;
  }
  box(): Box {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
  hitBox(): Box {
    if (this.kind === 'knight') return { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 2 };
    if (this.kind === 'cloud') return { x: this.x + 3, y: this.y + 2, w: this.w - 6, h: this.h - 2 };
    return { x: this.x + 3, y: this.y + 5, w: this.w - 6, h: this.h - 5 };
  }
}

export class Ghost {
  lit = false;
  drop = 0; // visual only: the lamp tumbles if its floor opens
  vy = 0;
  constructor(
    public x: number, // left px of its tile
    public y: number, // bottom px
    public index: number,
    public id?: string,
  ) {}
  box(): Box {
    return { x: this.x + 2, y: this.y - 30, w: 12, h: 30 };
  }
}

export interface Door {
  x: number;
  y: number;
}
export interface Sign {
  x: number;
  y: number;
  text: string;
}
export interface Cover {
  box: Box;
  reveal?: string;
  shown: boolean;
}
export interface Deco {
  kind: DecoKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
}

export class Spot {
  tx: number;
  t = 0;
  mode: 'fixed' | 'sweep' | 'follow';
  caught = false;
  constructor(
    public sx: number,
    public floorY: number,
    public def: Extract<EntDef, { t: 'spot' }>,
    public ox: number,
  ) {
    this.mode = def.sweep ? 'sweep' : 'fixed';
    this.tx = ((def.target ?? def.x) + ox) * TILE + TILE / 2;
    if (def.sweep) this.tx = (def.sweep[0] + ox) * TILE;
  }
}

interface Trigger {
  box: Box;
  acts: Action[];
  once: boolean;
  cond: 'any' | 'grounded';
  fired: boolean;
}

interface CamZone {
  x0: number;
  x1: number;
  min: number;
  max: number;
}

// ---------------------------------------------------------------------------

export class World {
  readonly level: BuiltLevel;
  readonly pw: number;
  readonly ph: number;
  tiles!: Uint8Array;
  covered = new Set<number>();
  player = new Player();

  traps: Trapdoor[] = [];
  lifts: Lift[] = [];
  movers: Mover[] = [];
  bags: Bag[] = [];
  cutouts: Cutout[] = [];
  ghosts: Ghost[] = [];
  doors: Door[] = [];
  signs: Sign[] = [];
  spots: Spot[] = [];
  triggers: Trigger[] = [];
  covers: Cover[] = [];
  arches: Box[] = [];
  decos: Deco[] = [];
  cams: CamZone[] = [];
  ids = new Map<string, Bag | Trapdoor | Mover | Cutout | Spot>();
  pending: { t: number; act: Action }[] = [];

  cp = -1; // index of active ghost light (-1: level start)
  lit = new Set<number>();
  spawn = { x: 0, y: 0 };

  state: 'play' | 'dying' | 'exit' | 'done' = 'play';
  stateT = 0;
  spawnT = 0;
  deathCause: DeathCause | null = null;
  deaths = 0;
  time = 0;
  frame = 0;
  hitstop = 0;
  shake = 0;
  hintT = -1;
  exitDoor: Door | null = null;

  events: GameEvent[] = [];
  fx: Particle[] = [];
  cam = { x: 0, y: 0 };
  private rand = rng(1234);

  constructor(def: LevelDef) {
    this.level = buildLevel(def);
    this.pw = this.level.w * TILE;
    this.ph = this.level.h * TILE;
    const st = this.level.ents.find((e) => e.def.t === 'start');
    if (!st) throw new Error(`${def.id}: no start`);
    const d = st.def as Extract<EntDef, { t: 'start' }>;
    this.spawn = { x: (d.x + st.ox) * TILE + 3, y: (d.y + 1) * TILE - PLAYER.H };
    this.reset();
    // a ghost light standing at the start is already lit
    const g0 = this.ghosts.find((g) => Math.abs(g.x + 3 - this.spawn.x) < 24);
    if (g0) {
      this.cp = g0.index;
      this.lit.add(g0.index);
      g0.lit = true;
    }
  }

  // -- construction ---------------------------------------------------------

  private reset() {
    this.tiles = this.level.tiles.slice();
    this.covered.clear();
    this.traps = [];
    this.lifts = [];
    this.movers = [];
    this.bags = [];
    this.cutouts = [];
    this.ghosts = [];
    this.doors = [];
    this.signs = [];
    this.spots = [];
    this.triggers = [];
    this.covers = [];
    this.arches = [];
    this.decos = [];
    this.cams = [];
    this.ids.clear();
    this.pending = [];
    this.hintT = -1;

    const L = this.level;
    const trapOpts = new Map<Group, Extract<EntDef, { t: 'trap' }>>();
    const liftOpts = new Map<Group, Extract<EntDef, { t: 'lift' }>>();
    const groupAt = (x: number, y: number) => L.groups.find((g) => g.y === y && x >= g.x && x < g.x + g.w);

    let ghostIdx = 0;
    for (const pe of L.ents) {
      const e = pe.def;
      const ox = pe.ox;
      switch (e.t) {
        case 'start':
          break;
        case 'ghost': {
          const g = new Ghost((e.x + ox) * TILE, (e.y + 1) * TILE, ghostIdx++, e.id);
          g.lit = this.lit.has(g.index);
          this.ghosts.push(g);
          break;
        }
        case 'sign':
          this.signs.push({ x: (e.x + ox) * TILE, y: (e.y + 1) * TILE, text: e.text });
          break;
        case 'door':
          this.doors.push({ x: (e.x + ox) * TILE, y: (e.y + 1) * TILE });
          break;
        case 'bag': {
          const x = (e.x + ox) * TILE;
          const y = e.y * TILE;
          let trig: Box | null = null;
          if (e.trig) trig = tileBox(e.trig, ox);
          else if (e.auto !== false) trig = { x: x - BAG.LEAD, y: y + TILE, w: TILE + BAG.LEAD * 2, h: this.ph - y };
          // rope goes up to the first solid tile above, or off the top of the stage
          let ropeTop = 0;
          for (let ty = e.y - 1; ty >= 0; ty--) {
            if (isSolidTile(this.tiles[ty * L.w + e.x + ox])) {
              ropeTop = (ty + 1) * TILE;
              break;
            }
          }
          const b = new Bag(x, y, e.id, trig, !!e.hint, ropeTop);
          this.bags.push(b);
          if (e.id) this.ids.set(e.id, b);
          break;
        }
        case 'trap': {
          const g = groupAt(e.x + ox, e.y);
          if (!g) throw new Error(`${L.def.id}: trap opts at ${e.x + ox},${e.y} match no trapdoor`);
          trapOpts.set(g, e);
          break;
        }
        case 'lift': {
          const g = groupAt(e.x + ox, e.y);
          if (!g) throw new Error(`${L.def.id}: lift opts at ${e.x + ox},${e.y} match no lift`);
          liftOpts.set(g, e);
          break;
        }
        case 'mover': {
          const m = new Mover(e, ox);
          this.movers.push(m);
          this.ids.set(e.id, m);
          break;
        }
        case 'cutout': {
          const c = new Cutout(e, ox);
          this.cutouts.push(c);
          this.ids.set(e.id, c);
          break;
        }
        case 'arch':
          this.arches.push({ x: (e.x + ox) * TILE, y: e.y * TILE, w: e.w * TILE, h: e.h * TILE });
          break;
        case 'cover':
          this.covers.push({ box: { x: (e.x + ox) * TILE, y: e.y * TILE, w: e.w * TILE, h: e.h * TILE }, reveal: e.reveal, shown: false });
          break;
        case 'spot': {
          const s = new Spot((e.x + ox) * TILE + TILE / 2, ((e.floor ?? 8) + 1) * TILE, e, ox);
          this.spots.push(s);
          if (e.id) this.ids.set(e.id, s);
          break;
        }
        case 'trigger':
          this.triggers.push({ box: tileBox(e.rect, ox), acts: e.acts, once: e.once ?? true, cond: e.cond ?? 'any', fired: false });
          break;
        case 'cam':
          this.cams.push({
            x0: (e.x0 + ox) * TILE,
            x1: (e.x1 + ox) * TILE,
            min: e.min !== undefined ? (e.min + ox) * TILE : -Infinity,
            max: e.max !== undefined ? (e.max + ox) * TILE : Infinity,
          });
          break;
        case 'deco':
          this.decos.push({ kind: e.kind, x: (e.x + ox) * TILE, y: e.y * TILE, w: (e.w ?? 1) * TILE, h: (e.h ?? 1) * TILE, text: e.text });
          break;
      }
    }

    for (const g of L.groups) {
      if (g.kind === 'trap') {
        const o = trapOpts.get(g);
        const td = new Trapdoor(g, o?.id, o?.delay ?? 0, o?.byBag ?? true);
        for (let cx = g.x; cx < g.x + g.w; cx++) {
          let y1 = g.y + 1;
          while (y1 < L.h && !isSolidTile(this.tiles[y1 * L.w + cx])) y1++;
          td.cover.push({ x: cx, y0: g.y + 1, y1 });
        }
        this.traps.push(td);
        if (td.id) this.ids.set(td.id, td);
      } else {
        const o = liftOpts.get(g);
        this.lifts.push(new Lift(g, o?.rise ?? 4, o?.speed ?? 70));
      }
    }

    // player
    const p = new Player();
    const sp = this.cp >= 0 ? this.ghosts[this.cp] : null;
    if (sp) {
      p.x = sp.x + 3;
      p.y = sp.y - PLAYER.H;
    } else {
      p.x = this.spawn.x;
      p.y = this.spawn.y;
    }
    p.grounded = true;
    this.player = p;
    this.snapCamera();
  }

  // -- public API -----------------------------------------------------------

  /** Advance the simulation by one fixed step. */
  step(inp: Input) {
    this.frame++;
    if (this.hitstop > 0) {
      this.hitstop -= DT;
      this.updateFx();
      return;
    }
    if (this.state === 'play') {
      this.time += DT;
      this.spawnT += DT;
    }
    this.runPending();
    if (this.state === 'play') this.updateTriggers();
    this.updateSolids();
    if (this.state === 'play') this.updatePlayer(inp);
    else this.animateIdlePlayer();
    this.updateTraps();
    this.updateBags();
    this.updateCutouts();
    this.updateSpots();
    if (this.state === 'play') {
      this.checkHazards();
      this.checkGhosts();
      this.checkDoors();
    }
    this.updateState();
    this.updateCamera(false);
    this.updateFx();
    if (this.hintT > 0) this.hintT = Math.max(0, this.hintT - DT);
  }

  /** Manual retry (R). */
  retry() {
    if (this.state === 'play') this.kill('retry');
    else if (this.state === 'dying' && this.stateT > 0.15) this.respawn();
  }

  kill(cause: DeathCause) {
    if (this.state !== 'play') return;
    const p = this.player;
    this.state = 'dying';
    this.stateT = cause === 'retry' ? DEATH.HOLD - 0.18 : 0;
    this.deathCause = cause;
    this.deaths++;
    if (cause !== 'retry') {
      this.hitstop = DEATH.HITSTOP;
      this.shake = Math.max(this.shake, 3);
      this.emit('die', p.cx, p.y + PLAYER.H / 2);
      const cols = ['#e8c89a', '#c8905a', '#8a5a34', '#d2474a', '#3a68b8', '#f2ebe0'];
      for (let i = 0; i < 18; i++) {
        const a = this.rand() * Math.PI * 2;
        const s = 40 + this.rand() * 110;
        this.addFx(p.cx, p.y + 7, Math.cos(a) * s, Math.sin(a) * s - 80, 0.5 + this.rand() * 0.5, cols[i % cols.length], 1 + Math.floor(this.rand() * 2), 500, true);
      }
    }
  }

  get groundedPlayer() {
    return this.player.grounded;
  }

  // -- internals: helpers ---------------------------------------------------

  emit(type: EvType, x: number, y: number) {
    this.events.push({ type, x, y });
  }

  addFx(x: number, y: number, vx: number, vy: number, life: number, color: string, size = 1, g = 300, front = false) {
    if (this.fx.length > 400) return;
    this.fx.push({ x, y, vx, vy, life, max: life, color, size, g, front });
  }

  dust(x: number, y: number, n: number, spread = 30, color = '#b8a48a') {
    for (let i = 0; i < n; i++) {
      this.addFx(x + (this.rand() - 0.5) * 6, y - this.rand() * 2, (this.rand() - 0.5) * spread * 2, -10 - this.rand() * 25, 0.25 + this.rand() * 0.3, color, 1, 60);
    }
  }

  tileAt(tx: number, ty: number): number {
    if (tx < 0 || tx >= this.level.w) return Tl.WALL;
    if (ty < 0 || ty >= this.level.h) return Tl.AIR;
    return this.tiles[ty * this.level.w + tx];
  }

  private solidCell(tx: number, ty: number) {
    return isSolidTile(this.tileAt(tx, ty));
  }

  private dynSolids(): Solid[] {
    const out: Solid[] = [];
    for (const m of this.movers) out.push(m);
    for (const l of this.lifts) out.push(l);
    for (const b of this.bags) if (b.state === 'land') out.push(b);
    return out;
  }

  /** True if the box overlaps no solid tile or dynamic solid. */
  boxFree(b: Box, ignore?: Solid | null): boolean {
    const x0 = Math.floor(b.x / TILE);
    const x1 = Math.floor((b.x + b.w - 1e-6) / TILE);
    const y0 = Math.floor(b.y / TILE);
    const y1 = Math.floor((b.y + b.h - 1e-6) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidCell(tx, ty)) return false;
    for (const s of this.dynSolids()) if (s !== ignore && hit(b, s.box())) return false;
    return true;
  }

  private moveX(dx: number) {
    const p = this.player;
    if (dx === 0) return;
    p.x += dx;
    const b = p.box();
    const x0 = Math.floor(b.x / TILE);
    const x1 = Math.floor((b.x + b.w - 1e-6) / TILE);
    const y0 = Math.floor(b.y / TILE);
    const y1 = Math.floor((b.y + b.h - 1e-6) / TILE);
    let blocked = false;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.solidCell(tx, ty)) continue;
        if (dx > 0) p.x = Math.min(p.x, tx * TILE - PLAYER.W);
        else p.x = Math.max(p.x, (tx + 1) * TILE);
        blocked = true;
      }
    }
    for (const s of this.dynSolids()) {
      const sb = s.box();
      if (!hit(p.box(), sb)) continue;
      if (dx > 0) p.x = Math.min(p.x, sb.x - PLAYER.W);
      else p.x = Math.max(p.x, sb.x + sb.w);
      blocked = true;
    }
    if (blocked) p.vx = 0;
  }

  private moveY(dy: number) {
    const p = this.player;
    if (dy === 0) return;
    const prevBottom = p.y + PLAYER.H;
    const prevTop = p.y;
    p.y += dy;
    let b = p.box();
    const x0 = Math.floor(b.x / TILE);
    const x1 = Math.floor((b.x + b.w - 1e-6) / TILE);
    const y0 = Math.floor(b.y / TILE);
    const y1 = Math.floor((b.y + b.h - 1e-6) / TILE);

    if (dy < 0) {
      // ceiling: try a small corner correction first
      let blocked = false;
      for (let ty = y0; ty <= y1 && !blocked; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidCell(tx, ty)) blocked = true;
      if (!blocked) for (const s of this.dynSolids()) if (hit(b, s.box()) && prevTop >= s.box().y + s.box().h - 1) blocked = true;
      if (blocked) {
        for (const off of [1, -1, 2, -2, 3, -3, 4, -4]) {
          const nb = { ...b, x: b.x + off };
          if (this.boxFree(nb)) {
            p.x += off;
            return;
          }
        }
        // bonk
        let ny = -Infinity;
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidCell(tx, ty)) ny = Math.max(ny, (ty + 1) * TILE);
        for (const s of this.dynSolids()) {
          const sb = s.box();
          if (hit(b, sb) && prevTop >= sb.y + sb.h - 1) ny = Math.max(ny, sb.y + sb.h);
        }
        if (ny > -Infinity) p.y = ny;
        p.vy = 0;
        this.emit('bump', p.cx, p.y);
      }
      return;
    }

    // falling / standing
    let landY = Infinity;
    let landOn: Solid | null = null;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tileAt(tx, ty);
        if (isSolidTile(t) || (t === Tl.CAT && prevBottom <= ty * TILE + 0.01)) {
          if (ty * TILE < landY) {
            landY = ty * TILE;
            landOn = null;
          }
        }
      }
    }
    for (const s of this.dynSolids()) {
      const sb = s.box();
      if (!hit(b, sb)) continue;
      if (prevBottom <= sb.y + 1 + Math.max(0, -s.dy) || s === p.ground) {
        // ties go to the dynamic solid so half-standing on a lift/platform still rides it
        if (sb.y <= landY) {
          landY = sb.y;
          landOn = s;
        }
      }
    }
    if (landY < Infinity) {
      p.y = landY - PLAYER.H;
      p.vy = 0;
      p.grounded = true;
      p.ground = landOn;
      b = p.box();
    }
  }

  // -- internals: update phases --------------------------------------------

  private runPending() {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const q = this.pending[i];
      q.t -= DT;
      if (q.t <= 0) {
        this.pending.splice(i, 1);
        this.doAction(q.act);
      }
    }
  }

  private doAction(a: Action) {
    if (a.do === 'shake') {
      this.shake = Math.max(this.shake, a.amount);
      return;
    }
    const target = this.ids.get(a.id);
    if (!target) throw new Error(`action ${a.do}: unknown id ${a.id}`);
    if (a.do === 'drop' && target instanceof Bag) this.dropBag(target);
    else if (a.do === 'open' && target instanceof Trapdoor) this.openTrap(target);
    else if (a.do === 'start' && target instanceof Mover) {
      if (!target.active) this.emit('moverStart', target.x, target.y);
      target.active = true;
    } else if (a.do === 'activate' && target instanceof Cutout) this.activateCutout(target);
  }

  private updateTriggers() {
    const pb = this.player.box();
    for (const t of this.triggers) {
      if (t.fired && t.once) continue;
      if (t.cond === 'grounded' && !this.player.grounded) continue;
      if (!hit(pb, t.box)) continue;
      t.fired = true;
      for (const a of t.acts) {
        if (a.delay) this.pending.push({ t: a.delay, act: a });
        else this.doAction(a);
      }
    }
  }

  private updateSolids() {
    const p = this.player;
    const alive = this.state === 'play';
    const all: Solid[] = [];
    // movers
    for (const m of this.movers) {
      if (m.def.start === 'stand' && !m.active && alive && p.ground === m) {
        m.active = true;
        this.emit('moverStart', m.x, m.y);
      }
      m.update();
      all.push(m);
    }
    // lifts
    for (const l of this.lifts) {
      l.dx = l.dy = 0;
      if (l.state === 'shake') {
        l.t += DT;
        if (l.t >= 0.22) l.state = 'rise';
      } else if (l.state === 'rise') {
        l.v = Math.min(l.speed, l.v + 260 * DT);
        const ny = Math.max(l.topY, l.y - l.v * DT);
        l.dy = ny - l.y;
        l.y = ny;
        if (l.y <= l.topY) {
          l.state = 'up';
          this.shake = Math.max(this.shake, 1.5);
          this.emit('liftStop', l.x + l.w / 2, l.y);
        }
      }
      all.push(l);
    }
    // carried bags
    for (const b of this.bags) {
      b.dx = b.dy = 0;
      if (b.state === 'land' && b.onSolid && (b.onSolid.dx || b.onSolid.dy)) {
        b.x += b.onSolid.dx;
        b.y += b.onSolid.dy;
        b.dx = b.onSolid.dx;
        b.dy = b.onSolid.dy;
        all.push(b);
      }
    }
    if (!alive) return;
    // carry / push the player
    for (const s of all) {
      if (!s.dx && !s.dy) continue;
      if (p.ground === s) {
        this.moveX(s.dx);
        p.y += s.dy;
        if (!this.boxFree(p.box(), s)) {
          // pushed into a ceiling or wall
          this.kill('crush');
          return;
        }
      } else if (hit(p.box(), s.box())) {
        const sb = s.box();
        if (s.dy < 0 && p.y + PLAYER.H - sb.y <= -s.dy + 2) {
          p.y = sb.y - PLAYER.H;
          p.ground = s;
          p.grounded = true;
        } else if (s.dx !== 0) {
          p.x = s.dx > 0 ? sb.x + sb.w : sb.x - PLAYER.W;
        } else if (s.dy > 0) {
          p.y = sb.y + sb.h;
        }
        if (!this.boxFree(p.box(), null)) {
          this.kill('crush');
          return;
        }
      }
    }
  }

  private updatePlayer(inp: Input) {
    const p = this.player;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (inp.jumpPressed) p.buffer = PLAYER.BUFFER;
    else p.buffer = Math.max(0, p.buffer - DT);
    p.jumpHeld = inp.jump;

    // horizontal
    let a: number;
    if (p.grounded) a = dir === 0 ? PLAYER.DEC : p.vx !== 0 && Math.sign(p.vx) !== dir ? PLAYER.TURN : PLAYER.ACC;
    else a = dir === 0 ? PLAYER.AIR_DEC : PLAYER.AIR_ACC;
    p.vx = approach(p.vx, dir * PLAYER.RUN, a * DT);
    if (dir) p.face = dir as 1 | -1;

    // coyote + buffered jump
    p.coyote = p.grounded ? PLAYER.COYOTE : Math.max(0, p.coyote - DT);
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -PLAYER.JUMP_V;
      p.buffer = 0;
      p.coyote = 0;
      p.grounded = false;
      if (p.ground) p.carryVx = p.ground.dx / DT;
      p.ground = null;
      p.sx = 0.72;
      p.sy = 1.3;
      this.emit('jump', p.cx, p.y + PLAYER.H);
      this.dust(p.cx, p.y + PLAYER.H, 4, 20);
    }

    // gravity (variable jump height via stronger gravity after release)
    let g: number;
    if (p.vy < 0) g = p.jumpHeld ? PLAYER.G_UP : PLAYER.G_CUT;
    else g = PLAYER.G_DOWN;
    if (p.jumpHeld && Math.abs(p.vy) < PLAYER.APEX_V && !p.grounded) g *= PLAYER.APEX_G;
    p.vy = Math.min(PLAYER.MAX_FALL, p.vy + g * DT);

    const wasGrounded = p.grounded;
    const prevGround = p.ground;
    const fallV = p.vy;
    p.grounded = false;
    this.moveX((p.vx + p.carryVx) * DT);
    this.moveY(p.vy * DT);
    if (!p.grounded) {
      // walked off a moving platform: keep its momentum
      if (wasGrounded && prevGround && p.carryVx === 0) p.carryVx = prevGround.dx / DT;
      p.ground = null;
    } else p.carryVx = 0;

    // presentation
    if (p.grounded && !wasGrounded) {
      if (fallV > 110) {
        const k = Math.min(1, fallV / PLAYER.MAX_FALL);
        p.sx = 1 + 0.35 * k;
        p.sy = 1 - 0.35 * k;
        p.landT = 0.12;
        this.emit('land', p.cx, p.y + PLAYER.H);
        this.dust(p.cx, p.y + PLAYER.H, 3 + Math.round(4 * k), 30);
      }
    }
    p.sx += (1 - p.sx) * Math.min(1, DT * 14);
    p.sy += (1 - p.sy) * Math.min(1, DT * 14);
    if (p.grounded) {
      p.airT = 0;
      if (Math.abs(p.vx) > 5) p.runT += DT * (Math.abs(p.vx) / PLAYER.RUN);
      else p.runT = 0;
    } else p.airT += DT;
    if (p.landT > 0) p.landT -= DT;

    // stand-activated things
    if (p.grounded) this.checkStanding();

    if (p.y > this.ph + 12) this.kill('fall');
  }

  private animateIdlePlayer() {
    const p = this.player;
    p.sx += (1 - p.sx) * Math.min(1, DT * 14);
    p.sy += (1 - p.sy) * Math.min(1, DT * 14);
  }

  private checkStanding() {
    const p = this.player;
    if (p.ground && p.ground.kind === 'lift') {
      const l = p.ground as Lift;
      if (l.state === 'idle') {
        l.state = 'shake';
        l.t = 0;
        this.emit('liftStart', l.x + l.w / 2, l.y);
      }
      return;
    }
    if (p.ground) return;
    const row = Math.floor((p.y + PLAYER.H + 0.5) / TILE);
    const c0 = Math.floor(p.x / TILE);
    const c1 = Math.floor((p.x + PLAYER.W - 1e-6) / TILE);
    for (const td of this.traps) {
      if (td.state !== 'closed' || td.g.y !== row) continue;
      if (c1 >= td.g.x && c0 < td.g.x + td.g.w) this.armTrap(td);
    }
  }

  private armTrap(td: Trapdoor) {
    if (td.state !== 'closed') return;
    if (td.delay <= 0) this.openTrap(td);
    else {
      td.state = 'armed';
      td.t = 0;
      this.emit('trapArm', (td.g.x + td.g.w / 2) * TILE, td.g.y * TILE);
    }
  }

  private openTrap(td: Trapdoor) {
    if (td.state === 'open') return;
    td.state = 'open';
    td.t = 0;
    for (let x = td.g.x; x < td.g.x + td.g.w; x++) this.tiles[td.g.y * this.level.w + x] = Tl.AIR;
    for (const c of this.covers) if (c.reveal && c.reveal === td.id) c.shown = true;
    this.emit('trapOpen', (td.g.x + td.g.w / 2) * TILE, td.g.y * TILE);
    this.shake = Math.max(this.shake, 1);
    for (let x = td.g.x; x < td.g.x + td.g.w; x++) this.dust(x * TILE + 8, td.g.y * TILE + 2, 3, 20, '#8a6a4a');
  }

  private updateTraps() {
    for (const td of this.traps) {
      if (td.state === 'armed') {
        td.t += DT;
        if (td.t >= td.delay) this.openTrap(td);
      } else if (td.state === 'open') {
        td.t += DT;
        td.swing = Math.min(1, td.swing + DT / TRAP_SWING);
      }
    }
    // covers the player walks into reveal themselves
    const pb = this.player.box();
    for (const c of this.covers) if (!c.shown && hit(pb, c.box)) c.shown = true;
    // a ghost light whose floor dropped away falls with it (presentation only)
    for (const g of this.ghosts) {
      const col = Math.floor((g.x + 8) / TILE);
      const row = Math.floor((g.y + g.drop + 0.5) / TILE);
      if (!isSolidTile(this.tileAt(col, row)) && row < this.level.h) {
        g.vy = Math.min(300, g.vy + 1400 * DT);
        g.drop += g.vy * DT;
        const nrow = Math.floor((g.y + g.drop) / TILE);
        if (isSolidTile(this.tileAt(col, nrow))) {
          g.drop = nrow * TILE - g.y;
          g.vy = 0;
          this.dust(g.x + 8, g.y + g.drop, 5, 30);
        }
      }
    }
  }

  private dropBag(b: Bag) {
    if (b.state !== 'hang') return;
    b.state = 'wobble';
    b.t = 0;
    this.emit('bagWobble', b.x + 8, b.y);
  }

  private updateBags() {
    const p = this.player;
    const pb = p.box();
    for (const b of this.bags) {
      switch (b.state) {
        case 'hang':
          if (this.state === 'play' && b.trig && hit(pb, b.trig)) this.dropBag(b);
          break;
        case 'wobble':
          b.t += DT;
          if (b.t >= BAG.WOBBLE) {
            b.state = 'fall';
            b.vy = 60;
          }
          break;
        case 'fall': {
          b.vy = Math.min(BAG.MAX_V, b.vy + BAG.G * DT);
          this.fallBag(b, b.vy * DT);
          if (b.state === 'fall' || b.state === 'land') {
            const hb = b.hitBox();
            if (b.state === 'fall' && this.state === 'play' && hit(hb, p.box())) this.kill('bag');
            for (const c of this.cutouts) {
              if (c.flat || b.state !== 'fall' || !hit(hb, c.hitBox())) continue;
              if (c.kind === 'knight') {
                // cardboard loses to sand: the knight folds, the bag splits open
                c.flat = true;
                this.emit('knightCrush', c.x + c.w / 2, c.y);
                this.dust(c.x + c.w / 2, c.railY, 8, 40);
                this.burstBag(b);
              } else if (c.kind === 'bear') {
                c.stun = 1.2;
                this.burstBag(b);
              }
            }
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private burstBag(b: Bag) {
    b.state = 'gone';
    this.emit('bagBurst', b.x + 8, b.y + 8);
    for (let i = 0; i < 22; i++) {
      this.addFx(b.x + 8, b.y + 8, (this.rand() - 0.5) * 160, -this.rand() * 140, 0.5 + this.rand() * 0.4, i % 2 ? '#dcbc82' : '#b48e55', 1, 500);
    }
  }

  private fallBag(b: Bag, dy: number) {
    const L = this.level;
    const col = Math.floor((b.x + TILE / 2) / TILE);
    const prevBottom = b.y + TILE;
    const newBottom = prevBottom + dy;
    const r0 = Math.floor(prevBottom / TILE);
    const r1 = Math.floor((newBottom - 1e-6) / TILE);
    let landY = Infinity;
    let landSolid: Solid | null = null;
    for (let r = r0; r <= r1 && r < L.h; r++) {
      const t = this.tileAt(col, r);
      if (t === Tl.TRAP) {
        const td = this.traps.find((q) => q.g.y === r && col >= q.g.x && col < q.g.x + q.g.w);
        if (td && td.byBag) {
          this.openTrap(td);
          continue;
        }
      }
      if (isSolidTile(t) || isSpike(t) || t === Tl.CAT) {
        landY = r * TILE;
        if (isSpike(t)) this.covered.add(r * L.w + col);
        break;
      }
    }
    for (const s of this.dynSolids()) {
      if (s === b) continue;
      const sb = s.box();
      const ov = Math.min(b.x + TILE, sb.x + sb.w) - Math.max(b.x, sb.x);
      if (ov < 4) continue;
      if (prevBottom <= sb.y + 0.5 && newBottom >= sb.y && sb.y < landY) {
        landY = sb.y;
        landSolid = s;
      }
    }
    if (landY < Infinity) {
      b.y = landY - TILE;
      b.state = 'land';
      b.onSolid = landSolid;
      b.vy = 0;
      this.shake = Math.max(this.shake, 2);
      this.emit('bagLand', b.x + 8, b.y + TILE);
      this.dust(b.x + 8, b.y + TILE, 8, 45);
      const p = this.player;
      if (b.hint && this.state === 'play' && p.x + PLAYER.W <= b.x + 1 && Math.abs(p.y + PLAYER.H - (b.y + TILE)) < TILE * 2) {
        this.hintT = 1.2;
        this.emit('stuck', b.x, b.y);
      }
      return;
    }
    b.y += dy;
    if (b.y > this.ph + 32) b.state = 'gone';
  }

  private activateCutout(c: Cutout) {
    if (c.active) return;
    c.active = true;
    this.emit(c.kind === 'bear' ? 'bearRoar' : 'knightOut', c.x + c.w / 2, c.y);
    if (c.kind === 'bear') this.shake = Math.max(this.shake, 2.5);
  }

  private blockingBag(c: Cutout, nx: number): Bag | null {
    const nb = { x: nx, y: c.y, w: c.w, h: c.h };
    for (const b of this.bags) if (b.state === 'land' && hit(nb, b.box())) return b;
    return null;
  }

  private updateCutouts() {
    const p = this.player;
    const alive = this.state === 'play';
    for (const c of this.cutouts) {
      c.t += DT;
      c.moving = false;
      if (c.flat || !c.active) continue;
      if (c.stun > 0) c.stun -= DT;
      else {
        const mode = c.def.mode ?? 'patrol';
        let nx = c.x;
        if (mode === 'patrol') {
          nx = c.x + c.dir * c.def.speed * DT;
          if (nx < c.x0) {
            nx = c.x0;
            c.dir = 1;
          } else if (nx + c.w > c.x1) {
            nx = c.x1 - c.w;
            c.dir = -1;
          }
          const bb = this.blockingBag(c, nx);
          if (bb) {
            nx = c.dir > 0 ? bb.x - c.w : bb.x + TILE;
            c.dir = (c.dir * -1) as 1 | -1;
          }
        } else if (mode === 'chase') {
          if (alive) {
            const tgt = p.cx - c.w / 2;
            const d = clamp(tgt - c.x, -c.def.speed * DT, c.def.speed * DT);
            nx = clamp(c.x + d, c.x0, c.x1 - c.w);
            if (d !== 0) c.dir = d > 0 ? 1 : -1;
            const bb = this.blockingBag(c, nx);
            if (bb) {
              nx = c.dir > 0 ? bb.x - c.w : bb.x + TILE;
              c.blockT += DT;
              if (c.def.breaksBags && c.blockT > 1.1) {
                this.burstBag(bb);
                c.blockT = 0;
                c.stun = 0.25;
                this.shake = Math.max(this.shake, 2);
              }
            } else c.blockT = 0;
          }
        } else if (mode === 'sync') {
          const lead = this.ids.get(c.def.syncTo ?? '');
          if (lead instanceof Cutout) nx = clamp(lead.x + (lead.w - c.w) / 2, c.x0, c.x1 - c.w);
          if (nx !== c.x) c.dir = nx > c.x ? 1 : -1;
        }
        c.moving = Math.abs(nx - c.x) > 0.01;
        c.x = nx;
        // a charging bear flattens any cardboard knight sharing its floor
        if (c.kind === 'bear') {
          for (const k of this.cutouts) {
            if (k.kind !== 'knight' || k.flat || !k.active || k.railY !== c.railY || !hit(k.box(), c.box())) continue;
            k.flat = true;
            this.emit('knightCrush', k.x + k.w / 2, k.y);
            this.dust(k.x + k.w / 2, k.railY, 8, 40);
          }
        }
      }
      if (alive && hit(c.hitBox(), p.box())) this.kill('cutout');
    }
  }

  private updateSpots() {
    const p = this.player;
    for (const s of this.spots) {
      s.t += DT;
      if (s.mode === 'sweep' && s.def.sweep) {
        const [a, b, period] = s.def.sweep;
        const x0 = (a + s.ox) * TILE;
        const x1 = (b + s.ox) * TILE;
        s.tx = x0 + (x1 - x0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * s.t) / period));
        if (s.def.follow && this.state === 'play' && Math.abs(s.tx - p.cx) < 7 && p.y + PLAYER.H > s.floorY - 40) {
          s.mode = 'follow';
          s.caught = true;
          this.emit('spotCatch', p.cx, p.y);
        }
      } else if (s.mode === 'follow' && this.state !== 'dying') {
        s.tx += (p.cx - s.tx) * Math.min(1, DT * 7);
      }
    }
  }

  private checkHazards() {
    const p = this.player;
    const b = p.box();
    const x0 = Math.floor(b.x / TILE);
    const x1 = Math.floor((b.x + b.w - 1e-6) / TILE);
    const y0 = Math.floor(b.y / TILE);
    const y1 = Math.floor((b.y + b.h - 1e-6) / TILE);
    const W = this.level.w;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tileAt(tx, ty);
        if (!isSpike(t) || this.covered.has(ty * W + tx)) continue;
        const cx = tx * TILE;
        const cy = ty * TILE;
        let hb: Box;
        if (t === Tl.SP_U) hb = { x: cx + 2, y: cy + 9, w: 12, h: 7 };
        else if (t === Tl.SP_D) hb = { x: cx + 2, y: cy, w: 12, h: 7 };
        else if (t === Tl.SP_L) hb = { x: cx + 9, y: cy + 2, w: 7, h: 12 };
        else hb = { x: cx, y: cy + 2, w: 7, h: 12 };
        if (hit(b, hb)) {
          this.kill('spikes');
          return;
        }
      }
    }
  }

  private checkGhosts() {
    const pb = this.player.box();
    for (const g of this.ghosts) {
      if (g.index === this.cp || !hit(pb, g.box())) continue;
      if (g.index < this.cp) continue;
      this.cp = g.index;
      this.lit.add(g.index);
      if (!g.lit) {
        g.lit = true;
        this.emit('checkpoint', g.x + 8, g.y - 28);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          this.addFx(g.x + 8, g.y - 27, Math.cos(a) * 50, Math.sin(a) * 50, 0.45, i % 2 ? '#ffd35c' : '#fff1b0', 1, 0, true);
        }
      }
    }
  }

  private checkDoors() {
    const p = this.player;
    if (!p.grounded) return;
    for (const d of this.doors) {
      if (p.cx >= d.x + 9 && p.cx <= d.x + 23 && Math.abs(p.y + PLAYER.H - d.y) < 2) {
        this.state = 'exit';
        this.stateT = 0;
        this.exitDoor = d;
        this.emit('exit', d.x + 16, d.y - 24);
        return;
      }
    }
  }

  private updateState() {
    if (this.state === 'dying') {
      this.stateT += DT;
      if (this.stateT >= DEATH.HOLD) this.respawn();
    } else if (this.state === 'exit') {
      this.stateT += DT;
      const p = this.player;
      if (this.exitDoor) p.x += (this.exitDoor.x + 11 - p.x) * Math.min(1, DT * 10);
      if (this.stateT >= 0.75) this.state = 'done';
    }
  }

  private respawn() {
    this.reset();
    this.state = 'play';
    this.stateT = 0;
    this.spawnT = 0;
    this.deathCause = null;
    this.emit('respawn', this.player.cx, this.player.y);
  }

  private camTarget(): number {
    const p = this.player;
    let tx = p.cx + p.face * 26 - VIEW_W / 2;
    // keep an active pursuer in frame while it is close behind (never hide what can kill you)
    for (const c of this.cutouts) {
      if (!c.active || c.def.mode !== 'chase' || c.flat) continue;
      if (c.x + c.w < p.cx && p.cx - c.x < 230) tx = Math.max(p.cx - VIEW_W + 100, Math.min(tx, c.x - 20));
    }
    for (const z of this.cams) {
      if (p.cx >= z.x0 && p.cx < z.x1) tx = clamp(tx, z.min, z.max);
    }
    return clamp(tx, 0, Math.max(0, this.pw - VIEW_W));
  }

  snapCamera() {
    this.cam.x = this.camTarget();
    this.cam.y = Math.max(0, this.ph - VIEW_H);
  }

  private updateCamera(snap: boolean) {
    if (snap) return this.snapCamera();
    if (this.state === 'dying') return;
    const tx = this.camTarget();
    this.cam.x += (tx - this.cam.x) * (1 - Math.exp(-5.5 * DT));
    if (Math.abs(tx - this.cam.x) < 0.05) this.cam.x = tx;
    this.cam.y = Math.max(0, this.ph - VIEW_H);
    this.shake = Math.max(0, this.shake - DT * 12);
  }

  private updateFx() {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= DT;
      if (f.life <= 0) {
        this.fx.splice(i, 1);
        continue;
      }
      f.vy += f.g * DT;
      f.x += f.vx * DT;
      f.y += f.vy * DT;
    }
  }

  // -- test / dev helpers ------------------------------------------------------

  /** Jump straight to a checkpoint (dev menu and automated playtests). */
  warpToCheckpoint(index: number) {
    for (let i = 0; i <= index; i++) this.lit.add(i);
    this.cp = index;
    this.respawn();
    this.events.length = 0;
  }

  segX(name: string): number {
    const s = this.level.segs.find((q) => q.name === name);
    if (!s) throw new Error(`no segment ${name}`);
    return s.x * TILE;
  }
}
