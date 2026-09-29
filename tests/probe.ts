// Measures jump arcs of the player controller on a flat test stage.
import { World } from '../src/game/world';
import type { LevelDef } from '../src/game/types';

const row = (s: string) => s.padEnd(60, s[s.length - 1]);
const flat: LevelDef = {
  id: 'probe',
  title: '',
  subtitle: '',
  segments: [
    {
      name: 'flat',
      map: [
        row('.'), row('.'), row('.'), row('.'), row('.'), row('.'),
        row('.'), row('.'), row('.'), row('#'), row('#'), row('#'),
      ],
      ents: [{ t: 'start', x: 2, y: 8 }],
    },
  ],
};

function measure(holdFrames: number, runUp: number) {
  const w = new World(flat);
  for (let i = 0; i < runUp; i++) w.step({ left: false, right: true, jump: false, jumpPressed: false });
  const x0 = w.player.x;
  const y0 = w.player.y;
  let minY = y0;
  let f = 0;
  w.step({ left: false, right: true, jump: true, jumpPressed: true });
  f++;
  while (f < 200) {
    w.step({ left: false, right: true, jump: f < holdFrames, jumpPressed: false });
    f++;
    minY = Math.min(minY, w.player.y);
    if (w.player.grounded) break;
  }
  return { height: +(y0 - minY).toFixed(1), dist: +(w.player.x - x0).toFixed(1), frames: f, vx0: +w.player.vx.toFixed(1) };
}

console.log('tap jump      ', measure(1, 60));
console.log('half jump     ', measure(8, 60));
console.log('full jump     ', measure(60, 60));
console.log('standing full ', measure(60, 0));
// time to reach full speed
{
  const w = new World(flat);
  let f = 0;
  while (w.player.vx < 91.9 && f < 100) {
    w.step({ left: false, right: true, jump: false, jumpPressed: false });
    f++;
  }
  console.log('frames to full speed', f, 'dist', (w.player.x - 35).toFixed(1));
}
