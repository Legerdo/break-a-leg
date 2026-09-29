import type { LevelDef } from '../game/types';

// FINALE — "EXIT, PURSUED BY A BEAR."
// Job: test everything under pressure, no new rules. A cardboard bear rides one long
// rail behind you (it is slower than a committed run). Each obstacle is a known rule
// where hesitation is the mistake. Then a quiet-looking last room asks the final question:
// the spotlit X on seams, the same sign as the very first trap... and the only way up.

export const finale: LevelDef = {
  id: 'finale',
  title: 'FINALE',
  subtitle: 'EXIT, PURSUED BY A BEAR',
  segments: [
    {
      name: 'F-start',
      map: [
        'WWWW................',
        'WWWW................',
        'WWWW................',
        'WWWW................',
        'WWWW................',
        'WWWW................',
        'WWWW................',
        'WW..................',
        'WW..................',
        '####################',
        '####################',
        '####################',
      ],
      ents: [
        { t: 'start', x: 5, y: 8 },
        { t: 'ghost', x: 5, y: 8 },
        { t: 'sign', x: 8, y: 8, text: 'EXIT, PURSUED BY A BEAR.' },
        { t: 'arch', x: 2, y: 7, w: 2, h: 2 },
        // one rail for the whole chase: from the arch to the bumper in F-end (global x 83)
        { t: 'cutout', id: 'bear', kind: 'bear', rail: [2, 83], y: 8, x: 2, speed: 70, mode: 'chase', active: false, breaksBags: true },
        { t: 'trigger', rect: [11, 0, 1, 12], acts: [{ do: 'activate', id: 'bear', delay: 0.25 }] },
      ],
    },
    {
      // Recall T4: tacks + two seamed panels. Only the long jump works; no time to think.
      name: 'F-gap',
      map: [
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '#####.TT######',
        '#####^^^######',
        '##############',
      ],
    },
    {
      // Recall T7: a rail running into a dark tunnel ahead means a knight is waiting in it.
      // It rolls out at you; hop it without slowing down, then run through.
      name: 'F-wings',
      map: [
        '..........WWWW..',
        '..........WWWW..',
        '..........WWWW..',
        '..........WWWW..',
        '..........WWWW..',
        '..........WWWW..',
        '..........WWWW..',
        '................',
        '................',
        '################',
        '################',
        '################',
      ],
      ents: [
        { t: 'cutout', id: 'kF', kind: 'knight', rail: [2, 14], y: 8, x: 12, speed: 80, dir: -1, active: false },
        { t: 'arch', x: 10, y: 7, w: 4, h: 2 },
        { t: 'trigger', rect: [1, 0, 1, 12], acts: [{ do: 'activate', id: 'kF' }] },
      ],
    },
    {
      // Recall T12: a high bag is slow. Sprint under it and it lands behind you,
      // on the rail, and holds the bear for a moment. Creep and the bear catches up.
      name: 'F-bag',
      map: [
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '##############',
        '##############',
        '##############',
      ],
      ents: [{ t: 'bag', x: 6, y: 2 }],
    },
    {
      // Recall T16: the tape is just tape. A panicked hop over it goes into the tacks.
      name: 'F-tape',
      map: [
        '................',
        '................',
        '................',
        '....WWWWWWWW....',
        '....WWWWWWWW....',
        '....vvvvvvvv....',
        '................',
        '................',
        '................',
        '#######x########',
        '################',
        '################',
      ],
      ents: [{ t: 'spot', x: 7, target: 7 }],
    },
    {
      // The rail ends. The bear cannot follow past its bumper.
      name: 'F-end',
      map: [
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '..........',
        '##########',
        '##########',
        '##########',
      ],
      ents: [{ t: 'ghost', x: 6, y: 8 }],
    },
    {
      // THE FINAL MARK: the exit is on a balcony five tiles up. There is a gap in the
      // balcony right above the spotlit X. The understudy bear rolls in from the right.
      // Everything learned says "X on seams = trapdoor". This one is a stage lift.
      name: 'F-mark',
      map: [
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '......####....############',
        '........................WW',
        '........................WW',
        '..........................',
        '..........................',
        '###########ML#############',
        '##########################',
        '##########################',
      ],
      ents: [
        { t: 'sign', x: 8, y: 8, text: 'HIT YOUR MARK.' },
        { t: 'spot', x: 11.5, target: 11.5 },
        { t: 'lift', x: 11, y: 9, rise: 5, speed: 75 },
        { t: 'door', x: 21, y: 3 },
        { t: 'arch', x: 24, y: 7, w: 2, h: 2 },
        { t: 'deco', kind: 'poster', x: 20, y: 5, w: 4, text: 'UNDERSTUDY' },
        { t: 'cutout', id: 'bear2', kind: 'bear', rail: [3, 26], y: 8, x: 24, speed: 62, mode: 'chase', active: false, breaksBags: true },
        { t: 'trigger', rect: [2, 0, 1, 9], acts: [{ do: 'activate', id: 'bear2', delay: 0.4 }] },
        { t: 'cam', x0: 7, x1: 26, min: 6, max: 6 },
      ],
    },
  ],
};
