import type { LevelDef } from '../game/types';

// ACT II — PREVIEWS
// Job: pattern learning. New vocabulary (cardboard knights on rails, the sweeping
// spotlight) is introduced honestly, bent once, and then everything the player knows
// is combined into a puzzle they can solve on sight ("I get this game now").

export const act2: LevelDef = {
  id: 'act2',
  title: 'ACT II',
  subtitle: 'PREVIEWS',
  segments: [
    {
      // T6 trust: knights ride visible rails between bumpers. Jump them.
      name: 'II-open',
      map: [
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..............CC..........',
        '##########################',
        '##########################',
        '##########################',
      ],
      ents: [
        { t: 'start', x: 2, y: 8 },
        { t: 'ghost', x: 2, y: 8 },
        { t: 'cutout', id: 'kA', kind: 'knight', rail: [5, 14], y: 8, x: 8, speed: 40, dir: 1 },
        { t: 'cutout', id: 'kB', kind: 'knight', rail: [17, 25], y: 8, x: 22, speed: 62, dir: -1 },
        { t: 'deco', kind: 'lamp', x: 10, y: 1 },
        { t: 'deco', kind: 'lamp', x: 20, y: 1 },
      ],
    },
    {
      // T7 "FROM THE WINGS": an empty rail running into a dark tunnel. Rails mean
      // something moves; the knight lives in the wing and rolls out when you get close.
      name: 'II-wings',
      map: [
        '....................WWWW',
        '....................WWWW',
        '....................WWWW',
        '....................WWWW',
        '....................WWWW',
        '....................WWWW',
        '....................WWWW',
        '........................',
        '........................',
        '########################',
        '########################',
        '########################',
      ],
      ents: [
        { t: 'cutout', id: 'kW', kind: 'knight', rail: [4, 23], y: 8, x: 22, speed: 75, dir: -1, active: false },
        { t: 'arch', x: 20, y: 7, w: 4, h: 2 },
        { t: 'trigger', rect: [14, 0, 1, 12], acts: [{ do: 'activate', id: 'kW' }] },
        { t: 'deco', kind: 'poster', x: 21, y: 5, text: 'WINGS' },
      ],
    },
    {
      // Ghost light right after the wings: a death in CENTER STAGE never replays T6/T7.
      name: 'II-landing',
      map: [
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '######',
        '######',
        '######',
      ],
      ents: [{ t: 'ghost', x: 2, y: 8 }],
    },
    {
      // T8 "CENTER STAGE": a sweeping searchlight draws the eye right and screams
      // "don't get caught". It is harmless (it just turns into a follow spot).
      // The real problem: while you wait in the dark for it to pass, a knight rolls out
      // of the arch under the ledge you just walked across.
      name: 'II-center',
      map: [
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..######..................',
        '.C####....................',
        'CC####....................',
        '##########################',
        '##########################',
        '##########################',
      ],
      ents: [
        { t: 'cutout', id: 'kC', kind: 'knight', rail: [6, 21], y: 8, x: 6, speed: 58, dir: 1, active: false },
        { t: 'arch', x: 6, y: 7, w: 2, h: 2 },
        { t: 'trigger', rect: [8, 0, 13, 9], cond: 'grounded', acts: [{ do: 'activate', id: 'kC', delay: 1.3 }] },
        { t: 'spot', x: 14, sweep: [9, 20, 2.6], follow: true },
        { t: 'cam', x0: 4, x1: 22, min: 1, max: 5 },
        { t: 'deco', kind: 'chair', x: 23, y: 8 },
      ],
    },
    {
      // Pattern practice: untaped seams in a row, and this time the spotlight sits on the
      // ONLY safe landing between them (you cannot clear both seams in one jump).
      // Spotlight grammar so far: lure (T1) -> harmless (T8) -> sometimes honest (here).
      name: 'II-seams',
      map: [
        '......................',
        '......................',
        '......................',
        '......................',
        '......................',
        '......................',
        '......................',
        '......................',
        '......................',
        '####TT###T###TT#######',
        '####..###.###..#######',
        '####^^###^###^^#######',
      ],
      ents: [
        { t: 'spot', x: 11, target: 11 },
        { t: 'cutout', id: 'kS', kind: 'knight', rail: [17, 22], y: 8, x: 19, speed: 45, dir: 1 },
      ],
    },
    {
      // T9 "THE PROBE": five seamed panels (too wide to jump) under a bag.
      // Combine T2 + T4: stand at the edge, let the bag open the trapdoor and become
      // the step at the bottom of the pit.
      name: 'II-probe',
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
        '######TTTTT#######',
        '######.....#######',
        '######^^^^^#######',
      ],
      ents: [
        { t: 'ghost', x: 2, y: 8 },
        { t: 'bag', x: 8, y: 3, trig: [4, 0, 2, 12] },
        { t: 'deco', kind: 'rope', x: 12, y: 0, h: 5 },
      ],
    },
    {
      // Breather with honest moving platforms. The paranoid player expects a trick; there is none.
      name: 'II-flyby',
      map: [
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '........................',
        '###..................###',
        '###..................###',
        '###^^^^^^^^^^^^^^^^^^###',
      ],
      ents: [
        { t: 'mover', id: 'mA', kind: 'flown', x: 3, y: 9, w: 3, h: 1, path: [[6, 0]], speed: 48, mode: 'pingpong', start: 'always', wait: 0.6 },
        { t: 'mover', id: 'mB', kind: 'flown', x: 18, y: 9, w: 3, h: 1, path: [[-6, 0]], speed: 48, mode: 'pingpong', start: 'always', wait: 0.6 },
      ],
    },
    {
      name: 'II-door',
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
      ents: [
        { t: 'door', x: 9, y: 8 },
        { t: 'deco', kind: 'lamp', x: 5, y: 1 },
      ],
    },
  ],
};
