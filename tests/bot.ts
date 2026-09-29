// Tiny scripted "player" for headless playtests.
// A script is a generator that yields one Input per simulated frame.
import { PLAYER, TILE } from '../src/game/config';
import type { Input, LevelDef } from '../src/game/types';
import { World } from '../src/game/world';

export type Script = Generator<Input, void, void>;

export const I = (dir: -1 | 0 | 1, jump = false, pressed = false): Input => ({
  left: dir < 0,
  right: dir > 0,
  jump,
  jumpPressed: pressed,
});

export class Bot {
  constructor(public w: World) {}
  get p() {
    return this.w.player;
  }
  /** Global pixel x of a tile column inside a named segment. */
  X(seg: string, tile: number) {
    return this.w.segX(seg) + tile * TILE;
  }

  *idle(frames: number): Script {
    for (let i = 0; i < frames; i++) yield I(0);
  }
  *hold(frames: number, dir: -1 | 0 | 1): Script {
    for (let i = 0; i < frames; i++) yield I(dir);
  }
  /** Walk until the player's left edge reaches x (moving right) or goes below x (moving left). */
  *walkTo(x: number, max = 1200): Script {
    for (let i = 0; i < max; i++) {
      const px = this.p.x;
      if (Math.abs(px - x) < 0.5) return;
      const dir = px < x ? 1 : -1;
      // start braking so we stop close to x
      const brake = (this.p.vx * this.p.vx) / (2 * PLAYER.DEC);
      if (dir > 0 && px + brake >= x) return yield* this.settle();
      if (dir < 0 && px - brake <= x) return yield* this.settle();
      yield I(dir as 1 | -1);
    }
    throw new Error(`walkTo(${x.toFixed(1)}) timed out at ${this.p.x.toFixed(1)}`);
  }
  /** Tap-walk (a few frames at a time) until reaching x; mimics a cautious player. */
  *creepTo(x: number, max = 1500): Script {
    for (let i = 0; i < max; i++) {
      if (this.p.x >= x) return yield* this.settle();
      yield I(i % 6 < 2 ? 1 : 0);
    }
    throw new Error(`creepTo(${x}) timed out`);
  }
  *settle(): Script {
    for (let i = 0; i < 30 && Math.abs(this.p.vx) > 0.01; i++) yield I(0);
  }
  /** Run (holding dir) until the left edge passes x, no braking. */
  *runPast(x: number, dir: 1 | -1 = 1, max = 1200): Script {
    for (let i = 0; i < max; i++) {
      if (dir > 0 ? this.p.x >= x : this.p.x <= x) return;
      yield I(dir);
    }
    throw new Error(`runPast(${x}) timed out at ${this.p.x.toFixed(1)}`);
  }
  /** Jump holding `dir`; hold the button for holdFrames; keep dir until landing. */
  *jump(dir: -1 | 0 | 1, holdFrames = 40, airDir: -1 | 0 | 1 = dir): Script {
    // if we are mid-air (e.g. just stepped off a crate), land first
    for (let i = 0; i < 120 && !this.p.grounded; i++) yield I(dir);
    yield I(dir, true, true);
    let f = 1;
    // wait to leave the ground
    while (this.p.grounded && f < 4) {
      yield I(dir, f < holdFrames);
      f++;
    }
    for (; f < 240; f++) {
      if (this.p.grounded || this.w.state !== 'play') return;
      yield I(airDir, f < holdFrames);
    }
  }
  *waitUntil(cond: () => boolean, max = 1200, dir: -1 | 0 | 1 = 0): Script {
    for (let i = 0; i < max; i++) {
      if (cond()) return;
      yield I(dir);
    }
    throw new Error('waitUntil timed out');
  }
}

export interface RunResult {
  deaths: number;
  causes: string[];
  frames: number;
  state: World['state'];
  x: number;
  y: number;
  world: World;
}

export function run(def: LevelDef, build: (b: Bot) => Script, opts: { cp?: number; maxFrames?: number; stopOnDeath?: boolean } = {}): RunResult {
  const w = new World(def);
  if (opts.cp !== undefined) w.warpToCheckpoint(opts.cp);
  const b = new Bot(w);
  const causes: string[] = [];
  const startDeaths = w.deaths;
  const it = build(b);
  let frames = 0;
  const max = opts.maxFrames ?? 60 * 240;
  let prevState = w.state;
  for (; frames < max; frames++) {
    const r = it.next();
    const inp = r.done ? I(0) : r.value;
    w.step(inp);
    if (w.state === 'dying' && prevState === 'play') {
      causes.push(`${w.deathCause}@${Math.round(w.player.x)},${Math.round(w.player.y)}`);
      if (opts.stopOnDeath !== false) break;
    }
    prevState = w.state;
    if (w.state === 'done') break;
    if (r.done && w.state === 'play') {
      // let physics settle a bit after the script ends
      for (let i = 0; i < 20; i++) w.step(I(0));
      break;
    }
  }
  return { deaths: w.deaths - startDeaths, causes, frames, state: w.state, x: w.player.x, y: w.player.y, world: w };
}
