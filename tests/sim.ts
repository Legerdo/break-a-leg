// Headless playtests: every act must be clearable with zero deaths by an informed
// player, and each designed troll must actually catch the "naive" behaviour it targets.
// Run: npx tsx tests/sim.ts [-v]
import { TILE } from '../src/game/config';
import { act1 } from '../src/levels/act1';
import { act2 } from '../src/levels/act2';
import { act3 } from '../src/levels/act3';
import { finale } from '../src/levels/finale';
import type { LevelDef } from '../src/game/types';
import { World } from '../src/game/world';
import { Bot, I, run, type Script } from './bot';
import {
  a1Bigger,
  a1Mark,
  a1Wings,
  a2Center,
  a2Climb,
  a2Open,
  a2Wings,
  a3Bag,
  a3Ghost,
  a3MixedLow,
  a3Tunnel,
  act1All,
  act2All,
  act3All,
  cut,
  fHopWingsKnight,
  finaleAll,
  jumpOverRight,
  log,
  routeLog,
} from './routes';

declare const process: { argv: string[]; exit(code: number): never };
if (process.argv.includes('-v')) {
  routeLog.fn = (b, label) =>
    console.log(`   · ${label.padEnd(28)} x=${b.p.x.toFixed(1)} y=${b.p.y.toFixed(1)} g=${b.p.grounded} deaths=${b.w.deaths} t=${b.w.time.toFixed(2)}`);
}
let failures = 0;
let passes = 0;

function expect(name: string, ok: boolean, detail: string) {
  if (ok) {
    passes++;
    console.log(`  ok   ${name}  (${detail})`);
  } else {
    failures++;
    console.log(`  FAIL ${name}  (${detail})`);
  }
}

function clears(name: string, def: LevelDef, script: (b: Bot) => Script, cp?: number) {
  const r = run(def, script, { cp });
  expect(name, r.state === 'done' && r.deaths === 0, `state=${r.state} deaths=${r.deaths} ${r.causes.join(' ')} t=${(r.frames / 60).toFixed(1)}s at x=${(r.x / TILE).toFixed(1)}`);
  return r;
}

function reaches(name: string, def: LevelDef, script: (b: Bot) => Script, check: (r: ReturnType<typeof run>) => boolean, cp?: number) {
  const r = run(def, script, { cp });
  expect(name, r.deaths === 0 && check(r), `state=${r.state} deaths=${r.deaths} ${r.causes.join(' ')} x=${(r.x / TILE).toFixed(2)} y=${(r.y / TILE).toFixed(2)}`);
  return r;
}

function dies(name: string, def: LevelDef, script: (b: Bot) => Script, cause: string, cp?: number) {
  const r = run(def, script, { cp });
  const got = r.causes[0] ?? 'none';
  expect(name, got.startsWith(cause), `expected ${cause}, got ${got}`);
  return r;
}

// ---------------------------------------------------------------------------

function testAct1() {
  console.log('ACT I');
  clears('act1 informed route', act1, act1All);
  reaches(
    'T1 mark drops you harmlessly and you can climb out',
    act1,
    function* (b) {
      yield* a1Wings(b);
      yield* b.walkTo(b.X('I-mark', 9) + 3);
      yield* b.idle(40);
      log(b, 'in pit');
      yield* b.jump(1, 40);
      yield* b.runPast(b.X('I-mark', 12));
    },
    (r) => r.world.traps.some((t) => t.state === 'open') && r.x > r.world.segX('I-mark') + 11 * TILE,
  );
  dies('T2 pit is unjumpable without the bag', act1, function* (b) {
    yield* a1Wings(b);
    yield* a1Mark(b);
    yield* b.runPast(b.X('I-bridge', 5) + 2);
    yield* b.jump(1, 40);
    yield* b.idle(60);
  }, 'spikes');
  dies('T3 running under the low bag gets crushed', act1, function* (b) {
    yield* b.runPast(b.X('I-headroom', 16));
  }, 'bag', 1);
  dies('T3 stopping under the bag gets crushed', act1, function* (b) {
    yield* b.walkTo(b.X('I-headroom', 12) - 2);
    yield* b.idle(60);
  }, 'bag', 1);
  dies('T4 hopping just past the X lands on the second panel', act1, function* (b) {
    yield* b.runPast(b.X('I-bigger', 5) + 4);
    yield* b.jump(1, 12);
    yield* b.idle(60);
  }, 'spikes', 2);
  dies('T4 landing on the X', act1, function* (b) {
    yield* b.runPast(b.X('I-bigger', 5) + 4);
    yield* b.jump(1, 4);
    yield* b.idle(60);
  }, 'spikes', 2);
  clears('T5 creeping to the door: bag lands in front, hop in', act1, function* (b) {
    yield* a1Bigger(b);
    yield* b.walkTo(b.X('I-door', 8));
    yield* b.creepTo(b.X('I-door', 10) - 3);
    yield* b.waitUntil(() => b.w.bags.some((q) => q.state === 'land'), 120);
    yield* b.walkTo(b.X('I-door', 10) - 6);
    yield* b.jump(1, 30);
    yield* b.walkTo(b.X('I-door', 11) + 6);
    yield* b.hold(60, 0);
  }, 2);
  dies('T5 stopping under the door bag', act1, function* (b) {
    yield* a1Bigger(b);
    yield* b.walkTo(b.X('I-door', 11) - 3);
    yield* b.idle(60);
  }, 'bag', 2);
}

function testAct2() {
  console.log('ACT II');
  clears('act2 informed route', act2, act2All);
  dies('T7 walking into the wings meets the knight', act2, function* (b) {
    yield* a2Open(b);
    yield* b.runPast(b.X('II-wings', 23));
  }, 'cutout');
  dies('T8 waiting in the dark for the light gets hit from behind', act2, function* (b) {
    yield* a2Open(b);
    yield* a2Wings(b);
    yield* a2Climb(b);
    yield* b.runPast(b.X('II-center', 8) + 2);
    yield* b.settle();
    yield* b.idle(240);
  }, 'cutout');
  reaches('T8 getting caught by the spotlight is harmless', act2, function* (b) {
    yield* a2Open(b);
    yield* a2Wings(b);
    yield* a2Climb(b);
    yield* b.runPast(b.X('II-center', 9));
    const s = b.w.spots[0];
    yield* b.waitUntil(() => s.mode === 'follow', 400, 1);
    yield* b.runPast(b.X('II-center', 22));
  }, (r) => r.world.spots[0].caught);
  dies('T8 from its own ghost light: waiting in the dark', act2, function* (b) {
    yield* a2Climb(b);
    yield* b.runPast(b.X('II-center', 8) + 2);
    yield* b.settle();
    yield* b.idle(240);
  }, 'cutout', 1);
  dies('II-seams: untaped seams are live', act2, function* (b) {
    yield* a2Center(b);
    yield* b.walkTo(b.X('II-seams', 3) + 4);
    yield* b.jump(1, 20);
    yield* b.walkTo(b.X('II-seams', 9) + 3);
    yield* b.idle(40);
  }, 'spikes', 1);
  dies('T9 stepping onto the wide seam', act2, function* (b) {
    yield* b.runPast(b.X('II-probe', 8));
    yield* b.idle(60);
  }, 'spikes', 2);
  dies('T9 best-possible long jump cannot clear the seam', act2, function* (b) {
    yield* b.walkTo(b.X('II-probe', 1));
    yield* b.runPast(b.X('II-probe', 6) - 1);
    yield* b.jump(1, 60);
    yield* b.idle(60);
  }, 'spikes', 2);
}

function testAct3() {
  console.log('ACT III');
  clears('act3 informed route', act3, act3All);
  reaches('T12 creeping seals the tunnel (retry hint shown)', act3, function* (b) {
    yield* b.walkTo(b.X('III-tunnel', 12));
    yield* b.creepTo(b.X('III-tunnel', 15) - 19);
    yield* b.idle(60);
    yield* b.hold(60, 1);
  }, (r) => r.world.bags[0].state === 'land' && r.x < r.world.bags[0].x && r.world.hintT >= 0);
  reaches('T12 committing from a standstill at the trigger still makes it', act3, function* (b) {
    yield* b.walkTo(b.X('III-tunnel', 15) - 22);
    yield* b.creepTo(b.X('III-tunnel', 15) - 19.5);
    yield* b.runPast(b.X('III-tunnel', 17));
  }, (r) => r.x > r.world.segX('III-tunnel') + 16 * TILE);
  reaches('T13 the ghost light saves, then drops you safely', act3, function* (b) {
    yield* a3Tunnel(b);
    yield* a3Ghost(b);
  }, (r) => r.world.cp === 1 && r.y > 6 * TILE);
  dies('T14 hopping the knight under the cloud', act3, function* (b) {
    const k = cut(b, 'kD');
    yield* b.waitUntil(() => b.p.y > 6 * TILE && b.p.grounded, 120);
    yield* b.walkTo(b.X('III-double', 2));
    yield* b.waitUntil(() => k.dir === -1 && k.x < b.X('III-double', 12), 900);
    yield* jumpOverRight(b, 'kD', 26);
    yield* b.idle(30);
  }, 'cutout', 1);
  dies('III-mixed: sprinting (the T12 lesson) under the LOW bag gets crushed', act3, function* (b) {
    yield* b.runPast(b.X('III-mixed', 12));
  }, 'bag', 2);
  reaches('III-mixed: creeping (the T3 lesson) under the SHAFT bag seals the tunnel', act3, function* (b) {
    yield* a3MixedLow(b);
    yield* b.walkTo(b.X('III-mixed', 21));
    yield* b.creepTo(b.X('III-mixed', 23) - 19);
    yield* b.idle(60);
    yield* b.hold(60, 1);
  }, (r) => {
    const bag = r.world.bags.find((q) => q.x === r.world.segX('III-mixed') + 23 * TILE)!;
    return bag.state === 'land' && r.x < bag.x;
  }, 2);
  reaches('T15 dropping the bag too early seals the corridor', act3, function* (b) {
    const k = cut(b, 'kE');
    yield* b.walkTo(b.X('III-bag', 7) + 8);
    yield* b.waitUntil(() => k.dir === 1, 900);
    yield* b.walkTo(b.X('III-bag', 8));
    yield* b.idle(120);
  }, (r) => {
    const bag = r.world.bags.find((q) => q.x === r.world.segX('III-bag') + 9 * TILE)!;
    const k = r.world.cutouts.find((c) => c.def.id === 'kE')!;
    return bag.state === 'land' && !k.flat && r.world.hintT >= 0;
  }, 3);
  dies('T16 a full jump over the tape hits the ceiling tacks', act3, function* (b) {
    yield* a3Bag(b);
    yield* b.runPast(b.X('III-tape', 7));
    yield* b.jump(1, 40);
    yield* b.idle(20);
  }, 'spikes', 3);
}

function testFinale() {
  console.log('FINALE');
  const r = clears('finale informed route', finale, finaleAll);
  const bear = r.world.cutouts.find((c) => c.def.id === 'bear')!;
  expect('bear got delayed by the bag', r.world.bags[0].state === 'gone' || r.world.bags[0].state === 'land', `bag state ${r.world.bags[0].state}, bear x ${(bear.x / TILE).toFixed(1)}`);
  dies('hesitating in the chase gets you caught', finale, function* (b) {
    yield* b.runPast(b.X('F-start', 13));
    yield* b.idle(150);
  }, 'cutout');
  dies('the wings knight in the chase', finale, function* (b) {
    yield* b.runPast(b.X('F-gap', 5) - 13);
    yield* b.jump(1, 40);
    yield* b.runPast(b.X('F-wings', 14));
  }, 'cutout');
  dies('panic hop over the tape during the chase', finale, function* (b) {
    yield* b.runPast(b.X('F-gap', 5) - 13);
    yield* b.jump(1, 40);
    yield* fHopWingsKnight(b);
    yield* b.runPast(b.X('F-tape', 5));
    yield* b.jump(1, 40);
    yield* b.idle(30);
  }, 'spikes');
  reaches('creeping to the chase bag: it drops ahead, hop it, still escape', finale, function* (b) {
    yield* b.runPast(b.X('F-gap', 5) - 13);
    yield* b.jump(1, 40);
    yield* fHopWingsKnight(b);
    yield* b.walkTo(b.X('F-bag', 6) - 22);
    yield* b.creepTo(b.X('F-bag', 6) - 19);
    yield* b.waitUntil(() => b.w.bags[0].state === 'land', 90);
    yield* b.walkTo(b.X('F-bag', 6) - 14);
    yield* b.jump(1, 40);
    yield* b.runPast(b.X('F-end', 6));
  }, (r) => r.world.cp === 1);
  dies('ignoring the mark: the understudy catches you', finale, function* (b) {
    yield* b.walkTo(b.X('F-mark', 5));
    yield* b.idle(400);
  }, 'cutout', 1);
  {
    // jump straight up through the balcony gap: feet must never rise above the balcony top
    let bestFeet = Infinity;
    run(finale, function* (b) {
      yield* b.runPast(b.X('F-mark', 13));
      yield* b.settle();
      yield I(0, true, true);
      for (let i = 0; i < 50; i++) {
        bestFeet = Math.min(bestFeet, b.p.y + 14);
        yield I(0, true);
      }
    }, { cp: 1 });
    expect('the balcony is out of reach without the lift', bestFeet > 4 * TILE + 8, `highest feet y=${bestFeet.toFixed(1)} vs balcony top ${4 * TILE}`);
  }
  reaches('half-standing on the lift still rides it', finale, function* (b) {
    yield* b.walkTo(b.X('F-mark', 12) + 12);
    yield* b.waitUntil(() => b.w.lifts[0].state === 'up', 240);
  }, (r) => r.y < 4 * TILE, 1);
}

function testWholeShow() {
  console.log('WHOLE SHOW');
  const routes: [LevelDef, (b: Bot) => Script][] = [
    [act1, act1All],
    [act2, act2All],
    [act3, act3All],
    [finale, finaleAll],
  ];
  let total = 0;
  let deaths = 0;
  for (const [def, s] of routes) {
    const r = run(def, s);
    total += r.world.time;
    deaths += r.deaths;
    if (r.state !== 'done') deaths += 1000;
  }
  expect('all four acts back to back, zero deaths', deaths === 0, `sim time ${total.toFixed(1)}s (a frame-perfect run; humans add waiting/hesitation)`);
}

function testFuzz() {
  console.log('COLLISION FUZZ');
  let seed = 99;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (const def of [act1, act2, act3, finale]) {
    let embedded = 0;
    let steps = 0;
    let deathsSeen = 0;
    for (let trial = 0; trial < 6; trial++) {
      const w = new World(def);
      w.warpToCheckpoint(trial % w.ghosts.length);
      let dir: -1 | 0 | 1 = 1;
      let jumpHold = 0;
      for (let f = 0; f < 60 * 25; f++) {
        if (rnd() < 0.04) dir = rnd() < 0.7 ? 1 : rnd() < 0.5 ? -1 : 0;
        let pressed = false;
        if (jumpHold <= 0 && rnd() < 0.05) {
          jumpHold = 1 + Math.floor(rnd() * 40);
          pressed = true;
        }
        w.step(I(dir, jumpHold > 0, pressed));
        jumpHold--;
        steps++;
        if (w.state === 'play') {
          const p = w.player;
          if (!w.boxFree({ x: p.x + 0.05, y: p.y + 0.05, w: 9.9, h: 13.9 })) embedded++;
        }
        if (w.state === 'done') break;
      }
      deathsSeen += w.deaths;
    }
    expect(`${def.id}: player never embedded in solids`, embedded === 0, `${embedded} bad frames of ${steps}, ${deathsSeen} random deaths`);
  }
}

testAct1();
testAct2();
testAct3();
testFinale();
testWholeShow();
testFuzz();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
