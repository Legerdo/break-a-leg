import type { LevelDef } from '../game/types';

// ACT I — REHEARSAL
// Job: build trust in the basic vocabulary (floor, tacks, ghost lights, doors),
// then betray ONE rule at a time. Every trap here is visible and reacts to what you just did.
//
// Legend: . air  # deck  W backstage wall  C crate  = catwalk (one-way)
//         ^ v tacks   T trapdoor panel (seamed)   X trapdoor with X tape
//         x X tape on a normal deck tile   L/M stage lift panel (M taped)

export const act1: LevelDef = {
  id: 'act1',
  title: 'ACT I',
  subtitle: 'REHEARSAL',
  segments: [
    {
      // Plain platforming. Signs tell the truth here, on purpose.
      name: 'I-wings',
      map: [
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '..........CC............',
        '.........CCC.......^^...',
        '##############..########',
        '##############..########',
        '##############..########',
      ],
      ents: [
        { t: 'start', x: 2, y: 8 },
        { t: 'ghost', x: 2, y: 8 },
        { t: 'sign', x: 5, y: 8, text: 'BREAK A LEG!' },
        { t: 'sign', x: 17, y: 8, text: 'MIND THE TACKS.' },
        { t: 'deco', kind: 'rope', x: 7, y: 0, h: 6 },
        { t: 'deco', kind: 'bucket', x: 13, y: 8 },
        { t: 'deco', kind: 'lamp', x: 22, y: 1 },
      ],
    },
    {
      // T1 "HIT YOUR MARK": spotlight + X tape + sign = the stagehand points at a spot.
      // The X is a trapdoor into a harmless 2-deep pit. First contact with seams, zero cost.
      name: 'I-mark',
      map: [
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '#########X########',
        '#########.########',
        '##################',
      ],
      ents: [
        { t: 'sign', x: 6, y: 8, text: 'HIT YOUR MARK.' },
        { t: 'spot', x: 9, target: 9 },
        { t: 'sign', x: 9, y: 10, text: 'NOT THAT HARD.' },
        { t: 'deco', kind: 'chair', x: 14, y: 8 },
      ],
    },
    {
      // T2 "SANDBAG BRIDGE": a pit too wide to jump. Walking up to it drops the bag
      // INTO the pit, where it flattens the tacks and becomes the stepping stone.
      // Lesson: bags fall when you get near, and fallen bags are solid.
      name: 'I-bridge',
      map: [
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '######.....#######',
        '######^^^^^#######',
        '##################',
      ],
      ents: [
        { t: 'bag', x: 8, y: 4, trig: [4, 0, 2, 12] },
        { t: 'ghost', x: 15, y: 8 },
        { t: 'deco', kind: 'rope', x: 3, y: 0, h: 7 },
      ],
    },
    {
      // T3 "HEADROOM": right after bags became friends, one hangs over the walkway.
      // Same rule (falls when you get near) but now the thing under it is you.
      // Running in at full speed gets caught; creeping up lets it drop ahead as a hurdle.
      name: 'I-headroom',
      map: [
        '....WWWWWWWWWWWWWW....',
        '....WWWWWWWWWWWWWW....',
        '....WWWWWWWWWWWWWW....',
        '....WWWWWWWWWWWWWW....',
        '....WWWWWWWWWWWWWW....',
        '....WWWWWWWWWWWWWW....',
        '......................',
        '......................',
        '......................',
        '######################',
        '######################',
        '######################',
      ],
      ents: [
        { t: 'bag', x: 12, y: 6 },
        { t: 'deco', kind: 'poster', x: 7, y: 6, text: 'CREW ONLY' },
      ],
    },
    {
      // Breather: optional catwalk, ghost light.
      name: 'I-rest',
      map: [
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '.....=====......',
        '................',
        '..CC.....^^^....',
        '################',
        '################',
        '################',
      ],
      ents: [
        { t: 'ghost', x: 14, y: 8 },
        { t: 'deco', kind: 'rope', x: 5, y: 0, h: 6 },
        { t: 'deco', kind: 'rope', x: 9, y: 0, h: 6 },
      ],
    },
    {
      // T4 "THE BIGGER PICTURE": the X sits on the first half of a TWO-panel trapdoor
      // right where a normal hop lands. Players who learned "avoid the X" hop just past
      // it, onto the second panel. Lesson: read the seams, not the tape.
      name: 'I-bigger',
      map: [
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '######.XT#########',
        '######^^^#########',
        '##################',
      ],
      ents: [
        { t: 'spot', x: 7, target: 7 },
        { t: 'deco', kind: 'rack', x: 13, y: 7, w: 2, h: 2 },
      ],
    },
    {
      // T5 "STAGE DOOR": the first real exit, with a bag hanging right over it.
      // It is a nerve test: the bag follows the usual rule, but the door always wins the race.
      name: 'I-door',
      map: [
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '##################',
        '##################',
        '##################',
      ],
      ents: [
        { t: 'bag', x: 11, y: 2 },
        { t: 'door', x: 11, y: 8 },
        { t: 'deco', kind: 'lamp', x: 4, y: 1 },
      ],
    },
  ],
};
