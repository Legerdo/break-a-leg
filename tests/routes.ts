// "Informed player" routes for every act, shared by the headless suite (tests/sim.ts)
// and the in-browser autoplay (tests/autoplay.ts). Each route clears its act with zero deaths.
import { TILE } from '../src/game/config';
import { Bot, I, type Script } from './bot';

export const routeLog: { fn: ((b: Bot, label: string) => void) | null } = { fn: null };
export function log(b: Bot, label: string) {
  routeLog.fn?.(b, label);
}

export function cut(b: Bot, id: string) {
  const c = b.w.cutouts.find((q) => q.def.id === id);
  if (!c) throw new Error(`no cutout ${id}`);
  return c;
}

/** Run right at a knight and jump over it once it is close enough. */
export function* jumpOverRight(b: Bot, id: string, gap = 14): Script {
  const c = cut(b, id);
  for (let i = 0; i < 900; i++) {
    const g = c.x + 2 - (b.p.x + 10);
    if (g <= gap && g > -4) break;
    yield I(1);
  }
  yield* b.jump(1, 40);
}

// ---------------------------------------------------------------------------
// ACT I

export function* a1Wings(b: Bot): Script {
  yield* b.runPast(b.X('I-wings', 7) + 6);
  yield* b.jump(1, 40); // up onto the crates
  log(b, 'on crates');
  yield* b.runPast(b.X('I-wings', 12) + 12);
  yield* b.jump(1, 40); // over the pit
  log(b, 'past pit');
  yield* b.runPast(b.X('I-wings', 17) + 4);
  yield* b.jump(1, 40); // over the tacks
  log(b, 'past tacks');
}
export function* a1Mark(b: Bot): Script {
  yield* b.runPast(b.X('I-mark', 8) - 12);
  yield* b.jump(1, 20); // hop the X
  log(b, 'past X');
}
export function* a1Bridge(b: Bot): Script {
  // walk to the pit edge; the bag drops into the pit and becomes a step
  yield* b.walkTo(b.X('I-bridge', 6) - 10);
  yield* b.waitUntil(() => b.w.bags.some((q) => q.state === 'land'), 120);
  log(b, 'bag landed');
  yield* b.jump(1, 16);
  log(b, 'on bag');
  yield* b.walkTo(b.X('I-bridge', 8) + 6);
  yield* b.jump(1, 24);
  log(b, 'past bridge');
}
export function* a1Headroom(b: Bot): Script {
  yield* b.walkTo(b.X('I-headroom', 12) - 24);
  yield* b.creepTo(b.X('I-headroom', 12) - 19);
  yield* b.waitUntil(() => b.w.bags.some((q) => q.state === 'land' && q.x === b.X('I-headroom', 12)), 120);
  log(b, 'bag landed ahead');
  yield* b.walkTo(b.X('I-headroom', 12) - 16);
  yield* b.jump(1, 30);
  log(b, 'past bag');
}
export function* a1Rest(b: Bot): Script {
  yield* b.runPast(b.X('I-rest', 1) - 4);
  yield* b.jump(1, 20); // onto the crates
  yield* b.runPast(b.X('I-rest', 3) + 2);
  yield* b.jump(1, 40); // up to the catwalk
  log(b, 'on catwalk');
  yield* b.runPast(b.X('I-rest', 9) + 2);
  yield* b.jump(1, 30); // off the end, over the tacks
  log(b, 'past rest tacks');
  yield* b.walkTo(b.X('I-rest', 14));
}
export function* a1Bigger(b: Bot): Script {
  // long jump from the very edge over tack + X + T
  yield* b.runPast(b.X('I-bigger', 6) - 10);
  yield* b.jump(1, 40);
  log(b, 'past bigger');
}
export function* a1Door(b: Bot): Script {
  yield* b.runPast(b.X('I-door', 12), 1); // just run into the door
}
export function* act1All(b: Bot): Script {
  yield* a1Wings(b);
  yield* a1Mark(b);
  yield* a1Bridge(b);
  yield* a1Headroom(b);
  yield* a1Rest(b);
  yield* a1Bigger(b);
  yield* a1Door(b);
}

// ---------------------------------------------------------------------------
// ACT II

export function* a2Open(b: Bot): Script {
  const kA = cut(b, 'kA');
  // wait until kA comes back toward us, then meet it with a jump
  yield* b.waitUntil(() => kA.dir === -1 && kA.x < b.X('II-open', 10), 600);
  yield* jumpOverRight(b, 'kA', 26);
  log(b, 'past kA');
  // onto the crate island
  yield* b.runPast(b.X('II-open', 12) + 4);
  yield* b.jump(1, 14);
  log(b, 'on crates');
  yield* b.walkTo(b.X('II-open', 15) + 2);
  const kB = cut(b, 'kB');
  yield* b.waitUntil(() => kB.dir === -1 && kB.x - (b.p.x + 10) < 44, 900);
  yield* b.jump(1, 40);
  log(b, 'past kB');
  yield* b.runPast(b.X('II-open', 25));
}
export function* a2Wings(b: Bot): Script {
  const k = cut(b, 'kW');
  yield* b.walkTo(b.X('II-wings', 14) - 6); // trigger the knight, then wait for it
  yield* b.waitUntil(() => k.active && k.x < b.X('II-wings', 17), 300);
  yield* b.waitUntil(() => k.x + 2 - (b.p.x + 10) < 26, 300);
  yield* b.jump(1, 40);
  log(b, 'past kW');
  yield* b.runPast(b.X('II-wings', 22));
}
export function* a2Climb(b: Bot): Script {
  yield* b.runPast(b.X('II-center', 0) - 14);
  yield* b.jump(1, 16);
  yield* b.runPast(b.X('II-center', 0) + 4);
  yield* b.jump(1, 16);
  yield* b.runPast(b.X('II-center', 1) + 4);
  yield* b.jump(1, 16);
  log(b, 'on ledge');
}
export function* a2Center(b: Bot): Script {
  yield* a2Climb(b);
  yield* b.runPast(b.X('II-center', 22)); // drop in and keep walking: the light is harmless
  log(b, 'across center');
}
export function* a2Seams(b: Bot): Script {
  yield* b.walkTo(b.X('II-seams', 3) + 4);
  yield* b.jump(1, 20); // over 4-5
  yield* b.walkTo(b.X('II-seams', 8) + 4);
  yield* b.jump(1, 12); // over 9, into the spotlight
  log(b, 'in the light');
  yield* b.walkTo(b.X('II-seams', 12) + 4);
  yield* b.jump(1, 20); // over 13-14
  const k = cut(b, 'kS');
  yield* b.waitUntil(() => k.dir === -1 && k.x - (b.p.x + 10) < 30, 900);
  yield* b.jump(1, 40);
  log(b, 'past kS');
  yield* b.runPast(b.X('II-seams', 21));
}
export function* a2Probe(b: Bot): Script {
  yield* b.walkTo(b.X('II-probe', 5) + 2);
  yield* b.waitUntil(() => b.w.bags.some((q) => q.state === 'land' && q.x === b.X('II-probe', 8)), 180);
  log(b, 'probe bag landed');
  yield* b.jump(1, 16);
  log(b, 'on probe bag');
  yield* b.walkTo(b.X('II-probe', 8) + 5);
  yield* b.jump(1, 40);
  log(b, 'past probe');
}
export function* a2Flyby(b: Bot): Script {
  const mA = b.w.movers.find((m) => m.def.id === 'mA')!;
  const mB = b.w.movers.find((m) => m.def.id === 'mB')!;
  yield* b.walkTo(b.X('II-flyby', 2) + 2);
  yield* b.waitUntil(() => mA.x === mA.pts[0].x && mA.waitT > 0.2, 600);
  yield* b.walkTo(mA.x + 19);
  log(b, 'on mA');
  yield* b.waitUntil(() => mA.x === mA.pts[1].x && mB.x === mB.pts[1].x, 600);
  yield* b.walkTo(mB.x + 19);
  log(b, 'on mB');
  yield* b.waitUntil(() => mB.x === mB.pts[0].x, 600);
  yield* b.runPast(b.X('II-flyby', 22));
  log(b, 'past flyby');
}
export function* a2Door(b: Bot): Script {
  yield* b.runPast(b.X('II-door', 10));
}
export function* act2All(b: Bot): Script {
  yield* a2Open(b);
  yield* a2Wings(b);
  yield* a2Center(b);
  yield* a2Seams(b);
  yield* a2Probe(b);
  yield* a2Flyby(b);
  yield* a2Door(b);
}

// ---------------------------------------------------------------------------
// ACT III

export function* a3Tunnel(b: Bot): Script {
  yield* b.runPast(b.X('III-tunnel', 23)); // commit: the tall shaft makes the bag slow
  log(b, 'through tunnel');
}
export function* a3Ghost(b: Bot): Script {
  yield* b.runPast(b.X('III-ghost', 2) + 4);
  yield* b.jump(1, 14);
  yield* b.runPast(b.X('III-ghost', 3) + 4);
  yield* b.jump(1, 14);
  yield* b.runPast(b.X('III-ghost', 4) + 4);
  yield* b.jump(1, 14);
  yield* b.runPast(b.X('III-ghost', 5) + 4);
  yield* b.jump(1, 14);
  log(b, 'on walkway');
  yield* b.runPast(b.X('III-ghost', 12) + 6);
  yield* b.jump(1, 30); // walkway tacks
  yield* b.walkTo(b.X('III-ghost', 21));
  yield* b.waitUntil(() => b.p.y > 6 * TILE && b.p.grounded, 120);
  log(b, 'dropped into crossover');
}
export function* a3Double(b: Bot): Script {
  const k = cut(b, 'kD');
  yield* b.walkTo(b.X('III-double', 2));
  // let the knight carry the cloud to the end of the short ceiling rail
  yield* b.waitUntil(() => k.dir === 1 && k.x > b.X('III-double', 16), 900);
  yield* b.walkTo(b.X('III-double', 17));
  log(b, 'under parked cloud');
  yield* b.waitUntil(() => k.dir === -1 && k.x + 2 - (b.p.x + 10) < 30, 900);
  yield* b.jump(1, 40);
  log(b, 'past kD');
  yield* b.runPast(b.X('III-double', 27));
}
export function* a3MixedLow(b: Bot): Script {
  // low bag with headroom: creep, let it fall ahead, hop it
  yield* b.walkTo(b.X('III-mixed', 7) - 24);
  yield* b.creepTo(b.X('III-mixed', 7) - 19);
  yield* b.waitUntil(() => b.w.bags.some((q) => q.state === 'land' && q.x === b.X('III-mixed', 7)), 120);
  yield* b.walkTo(b.X('III-mixed', 7) - 16);
  yield* b.jump(1, 30);
  log(b, 'past low bag');
  yield* b.walkTo(b.X('III-mixed', 12));
}
export function* a3Mixed(b: Bot): Script {
  yield* a3MixedLow(b);
  // shaft bag over a one-tile tunnel: sprint
  yield* b.runPast(b.X('III-mixed', 29));
  log(b, 'through mixed tunnel');
}
export function* a3Bag(b: Bot): Script {
  const k = cut(b, 'kE');
  yield* b.walkTo(b.X('III-bag', 7) + 8); // just outside the bag's reach
  yield* b.waitUntil(() => k.dir === -1 && k.x < b.X('III-bag', 11) + 6 && k.x > b.X('III-bag', 10) + 8, 900);
  yield* b.walkTo(b.X('III-bag', 8));
  yield* b.waitUntil(() => k.flat, 120);
  log(b, 'knight bagged');
  yield* b.runPast(b.X('III-bag', 21));
}
export function* a3Tape(b: Bot): Script {
  yield* b.runPast(b.X('III-tape', 17)); // just walk across the mark
}
export function* a3Door(b: Bot): Script {
  yield* b.runPast(b.X('III-door', 8));
}
export function* act3All(b: Bot): Script {
  yield* a3Tunnel(b);
  yield* a3Ghost(b);
  yield* a3Double(b);
  yield* a3Mixed(b);
  yield* a3Bag(b);
  yield* a3Tape(b);
  yield* a3Door(b);
}

// ---------------------------------------------------------------------------
// FINALE

export function* fHopWingsKnight(b: Bot): Script {
  const k = cut(b, 'kF');
  yield* b.waitUntil(() => k.active && k.x + 2 - (b.p.x + 10) < 34, 300, 1);
  yield* b.jump(1, 40);
  log(b, 'past wings knight');
}
export function* fChase(b: Bot): Script {
  yield* b.runPast(b.X('F-gap', 5) - 13); // long jump from the edge over tack + two panels
  yield* b.jump(1, 40);
  log(b, 'past gap');
  yield* fHopWingsKnight(b);
  yield* b.runPast(b.X('F-tape', 0)); // sprint under the high bag
  log(b, 'past bag');
  yield* b.runPast(b.X('F-end', 6)); // walk across the tape, reach the ghost light
  log(b, 'chase over');
}
export function* fMark(b: Bot): Script {
  const lift = b.w.lifts[0];
  yield* b.walkTo(b.X('F-mark', 11) + 11);
  yield* b.waitUntil(() => lift.state === 'up', 240);
  log(b, 'lift up');
  yield* b.walkTo(b.X('F-mark', 12) + 12);
  yield* b.jump(1, 20);
  yield* b.walkTo(b.X('F-mark', 21) + 11);
  yield* b.idle(60);
}
export function* finaleAll(b: Bot): Script {
  yield* fChase(b);
  yield* fMark(b);
}

export const ROUTES = [act1All, act2All, act3All, finaleAll];
