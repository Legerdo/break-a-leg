import type { LevelDef } from '../game/types';

// ACT III — OPENING NIGHT
// Job: reverse trolls. The player now has habits ("creep up to bags", "seams kill",
// "jump over the tape", "jump over knights"). Each room is built so that the habit
// is the trap, and the counter-move is visible if you actually read the stage.

export const act3: LevelDef = {
  id: 'act3',
  title: 'ACT III',
  subtitle: 'OPENING NIGHT',
  segments: [
    {
      // T12 "LOW CLEARANCE": a one-tile tunnel under a tall shaft with a bag at the top.
      // Creeping up (the T3 lesson) drops it ahead of you and seals the tunnel.
      // The shaft is tall, so the bag is slow: a committed sprint beats it.
      name: 'III-tunnel',
      map: [
        '......WWWWWWWWWWWWWWWWW...',
        '......WWWWWWWWWWWWWWWWW...',
        '......WWWWWWWWW.WWWWWWW...',
        '......WWWWWWWWW.WWWWWWW...',
        '......WWWWWWWWW.WWWWWWW...',
        '......WWWWWWWWW.WWWWWWW...',
        '......WWWWWWWWW.WWWWWWW...',
        '......WWWWWWWWW.WWWWWWW...',
        '..........................',
        '##########################',
        '##########################',
        '##########################',
      ],
      ents: [
        { t: 'start', x: 1, y: 8 },
        { t: 'ghost', x: 1, y: 8 },
        { t: 'sign', x: 3, y: 8, text: 'MIND YOUR HEAD.' },
        { t: 'bag', x: 15, y: 2, hint: true },
      ],
    },
    {
      // T13 "GHOST LIGHT": the only thing that never lied (a ghost light) stands on
      // seams at a dead end. It does save your progress... and then the floor drops you
      // into a hidden crossover. Seams can be a route, not just a death.
      name: 'III-ghost',
      map: [
        '.......................W',
        '.......................W',
        '.......................W',
        '.......................W',
        '..............^^.......W',
        '......##############TTT#',
        '.....C##############....',
        '....CC##############....',
        '...CCC##############....',
        '########################',
        '########################',
        '########################',
      ],
      ents: [
        { t: 'trap', x: 20, y: 5, id: 'gtrap', delay: 0.45 },
        { t: 'ghost', x: 21, y: 4 },
        { t: 'cover', x: 23, y: 6, w: 1, h: 3, reveal: 'gtrap' },
        { t: 'deco', kind: 'rope', x: 9, y: 0, h: 3 },
      ],
    },
    {
      // T14 "DOUBLE ACT": a knight on the floor and a thundercloud on a ceiling rail
      // that follows it. Jumping the knight (the Act II habit) puts you in the bolt.
      // The ceiling rail is shorter than the floor rail: follow the knight to where the
      // cloud cannot go, and jump it there.
      name: 'III-double',
      map: [
        'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWWWWWWWWWWWWWW',
        'W...........................',
        'W...........................',
        '............................',
        '............................',
        '............................',
        '############################',
        '############################',
        '############################',
      ],
      ents: [
        { t: 'cover', x: 0, y: 6, w: 2, h: 3, reveal: 'gtrap' },
        { t: 'cutout', id: 'kD', kind: 'knight', rail: [4, 25], y: 8, x: 10, speed: 50, dir: 1 },
        { t: 'cutout', id: 'cD', kind: 'cloud', rail: [4, 16], y: 3, x: 10, speed: 0, mode: 'sync', syncTo: 'kD', hang: 32 },
        { t: 'cam', x0: 2, x1: 26, min: 1, max: 8 },
      ],
    },
    {
      // T14b "MIXED SIGNALS": the same honest sign, two bags, two opposite answers.
      // A low bag in open headroom (creep, T3) and then a bag at the top of a tall shaft
      // over a one-tile tunnel (sprint, T12). The player has to read which rule applies.
      name: 'III-mixed',
      map: [
        '...WWWWWWWW......WWWWWWWWWWW..',
        '...WWWWWWWW......WWWWWWWWWWW..',
        '...WWWWWWWW......WWWWWW.WWWW..',
        '...WWWWWWWW......WWWWWW.WWWW..',
        '...WWWWWWWW......WWWWWW.WWWW..',
        '...WWWWWWWW......WWWWWW.WWWW..',
        '.................WWWWWW.WWWW..',
        '.................WWWWWW.WWWW..',
        '..............................',
        '##############################',
        '##############################',
        '##############################',
      ],
      ents: [
        { t: 'ghost', x: 0, y: 8 },
        { t: 'sign', x: 1, y: 8, text: 'MIND YOUR HEAD.' },
        { t: 'bag', x: 7, y: 6 },
        { t: 'bag', x: 23, y: 2, hint: true },
      ],
    },
    {
      // T15 "BAG THE KNIGHT": a knight patrols a corridor too low to jump it in.
      // A bag waits in a slot above the knight's turnaround. The player now knows exactly
      // how long a bag takes to fall, so the stagehand's weapon becomes theirs.
      name: 'III-bag',
      map: [
        '......WWWWWWWWWWWWWW..',
        '......WWWWWWWWWWWWWW..',
        '......WWWWWWWWWWWWWW..',
        '......WWW.WWWWWWWWWW..',
        '......WWW.WWWWWWWWWW..',
        '......WWW.WWWWWWWWWW..',
        '......WWW.WWWWWWWWWW..',
        '......................',
        '......................',
        '######################',
        '######################',
        '######################',
      ],
      ents: [
        { t: 'ghost', x: 2, y: 8 },
        { t: 'bag', x: 9, y: 4, hint: true },
        { t: 'cutout', id: 'kE', kind: 'knight', rail: [9, 17], y: 8, x: 15, speed: 60, dir: -1 },
      ],
    },
    {
      // T16 "PAINTER'S TAPE": the same spotlight, the same sign, the same X as Act I,
      // but on plain deck with no seams, under a ceiling of tacks. Jumping over the mark
      // is what kills. Walking across it is the whole solution.
      name: 'III-tape',
      map: [
        '..................',
        '..................',
        '..................',
        '.....WWWWWWWW.....',
        '.....WWWWWWWW.....',
        '.....vvvvvvvv.....',
        '..................',
        '..................',
        '..................',
        '#########x########',
        '##################',
        '##################',
      ],
      ents: [
        { t: 'sign', x: 3, y: 8, text: 'HIT YOUR MARK.' },
        { t: 'spot', x: 9, target: 9 },
      ],
    },
    {
      name: 'III-door',
      map: [
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '############',
        '############',
        '############',
      ],
      ents: [{ t: 'door', x: 7, y: 8 }],
    },
  ],
};
