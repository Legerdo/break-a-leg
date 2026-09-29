// Level data types. All entity coordinates are in tiles, local to their segment.
// A "cell (x, y)" is the tile column/row an object occupies at its bottom-left.

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean; // held
  jumpPressed: boolean; // edge (latched until consumed by a sim step)
}

export const NO_INPUT: Input = { left: false, right: false, jump: false, jumpPressed: false };

export type TileRect = [x: number, y: number, w: number, h: number];

export type Action =
  | { do: 'drop'; id: string; delay?: number }
  | { do: 'open'; id: string; delay?: number }
  | { do: 'start'; id: string; delay?: number }
  | { do: 'activate'; id: string; delay?: number }
  | { do: 'shake'; amount: number; delay?: number };

export type EntDef =
  | { t: 'start'; x: number; y: number }
  | { t: 'ghost'; x: number; y: number; id?: string }
  | { t: 'sign'; x: number; y: number; text: string; hidden?: boolean }
  | { t: 'door'; x: number; y: number }
  | {
      t: 'bag';
      x: number;
      y: number;
      id?: string;
      trig?: TileRect; // override proximity trigger
      auto?: boolean; // default true: proximity trigger enabled
      hint?: boolean; // show retry hint if it seals the way
    }
  | { t: 'trap'; x: number; y: number; id?: string; delay?: number; byBag?: boolean }
  | { t: 'lift'; x: number; y: number; rise: number; speed?: number }
  | {
      t: 'mover';
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      path: [number, number][]; // offsets in tiles from the start, first is implicitly [0,0]
      speed: number; // px/s
      mode: 'pingpong' | 'loop' | 'once';
      start: 'always' | 'stand' | 'trigger';
      kind: 'flown' | 'wagon';
      wait?: number; // pause at each waypoint (s)
      rail?: boolean; // draw an overhead rail along the path
    }
  | {
      t: 'cutout';
      id: string;
      kind: 'knight' | 'cloud' | 'bear';
      rail: [x0: number, x1: number]; // tile range the cutout may occupy (inclusive start, exclusive end)
      y: number; // cell row of its base (knight/bear) or of the ceiling rail (cloud)
      x: number; // starting tile x
      speed: number;
      dir?: 1 | -1;
      mode?: 'patrol' | 'chase' | 'sync';
      syncTo?: string;
      hang?: number; // cloud only: rope length in px below its ceiling rail
      active?: boolean; // default true
      breaksBags?: boolean;
      label?: string;
    }
  | { t: 'arch'; x: number; y: number; w: number; h: number }
  // A facade drawn over open cells until the linked trapdoor opens (or the player enters it).
  | { t: 'cover'; x: number; y: number; w: number; h: number; reveal?: string }
  | {
      t: 'spot';
      id?: string;
      x: number; // source column (tile, can be fractional)
      target?: number; // fixed target tile x (center)
      sweep?: [x0: number, x1: number, period: number];
      floor?: number; // cell row the light lands on (default 8)
      follow?: boolean; // becomes a follow spot when it touches the player
    }
  | { t: 'trigger'; rect: TileRect; acts: Action[]; once?: boolean; cond?: 'any' | 'grounded' }
  | { t: 'cam'; x0: number; x1: number; min?: number; max?: number }
  | { t: 'deco'; kind: DecoKind; x: number; y: number; w?: number; h?: number; text?: string };

export type DecoKind =
  | 'rope'
  | 'lamp'
  | 'ladder'
  | 'bucket'
  | 'chair'
  | 'poster'
  | 'curtain'
  | 'arrow'
  | 'rack'
  | 'cable';

export interface SegmentDef {
  name: string; // design label used in docs / tests
  map: string[]; // exactly ROWS strings of equal length
  ents?: EntDef[];
}

export interface LevelDef {
  id: string;
  title: string;
  subtitle: string;
  segments: SegmentDef[];
  tint?: string;
}
