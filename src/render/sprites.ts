// Palette + hand-authored pixel sprites. Every sprite is a grid of palette keys.

export const PAL: Record<string, string> = {
  k: '#0b0810',
  n: '#161020',
  N: '#211830',
  m: '#2e2340',
  M: '#433459',
  w: '#3a2216',
  o: '#5c3920',
  O: '#7d5230',
  p: '#a36f3e',
  P: '#cf9a5a',
  r: '#4d0f1d',
  R: '#7c1a2c',
  e: '#ad2a3b',
  E: '#dc4d4f',
  g: '#39394b',
  G: '#5f5f78',
  s: '#9696ae',
  S: '#d6d6e6',
  W: '#f4efe6',
  y: '#e59a2e',
  Y: '#ffd25a',
  l: '#fff3b8',
  b: '#8c6a3c',
  B: '#b8904f',
  c: '#e0c283',
  u: '#233e78',
  U: '#3f6cc0',
  i: '#7fa8e8',
  f: '#f2cf9e',
  F: '#c8935e',
  x: '#2c7a4a',
  X: '#5ce08a',
  h: '#6a4a3a',
  H: '#8e6a52',
};

export type Sprite = HTMLCanvasElement;

export function makeSprite(rows: string[], pal: Record<string, string> = PAL): Sprite {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

export function flipSprite(s: Sprite): Sprite {
  const c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  const g = c.getContext('2d')!;
  g.translate(s.width, 0);
  g.scale(-1, 1);
  g.drawImage(s, 0, 0);
  return c;
}

/** Recolor a sprite: every opaque pixel becomes `color` (used for hit flashes / silhouettes). */
export function tintSprite(s: Sprite, color: string): Sprite {
  const c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  const g = c.getContext('2d')!;
  g.drawImage(s, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, s.width, s.height);
  return c;
}

// ---------------------------------------------------------------------------
// Pip, the marionette who cut his strings. 12x16, facing right.

const HEAD = [
  '....kkkk....',
  '...kffffk...',
  '..kffffffk..',
  '..kffkfkfk..',
  '..kffffffPk.',
  '...kFffFk...',
];
const HEAD_BLINK = [
  '....kkkk....',
  '...kffffk...',
  '..kffffffk..',
  '..kffFfFfk..',
  '..kffffffPk.',
  '...kFffFk...',
];
const TORSO = [
  '...kkEEkk...',
  '..kEEEEEEk..',
  '.kEkUUUUUk..',
  '..kfUUUUUfk.',
  '...kUUUUUk..',
  '...kuuuuuk..',
];
const TORSO_RUN_A = [
  '...kkEEkk...',
  '.kkEEEEEEk..',
  'kEkkUUUUUkf.',
  '..kfUUUUUk..',
  '...kUUUUUk..',
  '...kuuuuuk..',
];
const TORSO_RUN_B = [
  '...kkEEkk...',
  '..kEEEEEEk..',
  '.EkkUUUUUk..',
  '..kUUUUUUfk.',
  '..fkUUUUUk..',
  '...kuuuuuk..',
];
const TORSO_UP = [
  '.f.kkEEkk.f.',
  '.kkEEEEEEkk.',
  '..kkUUUUUk..',
  'EE.kUUUUUk..',
  '...kUUUUUk..',
  '...kuuuuuk..',
];
const TORSO_FALL = [
  '...kkEEkk...',
  '.fkEEEEEEkf.',
  '..kkUUUUUk..',
  '.EEkUUUUUk..',
  'E..kUUUUUk..',
  '...kuuuuuk..',
];
const LEGS_STAND = ['...kOk.kOk..', '...kOk.kOk..', '..kwwk.kwwk.', '..kkkk.kkkk.'];
const LEGS_RUN_A = ['...kOk.kOk..', '..kOk...kOk.', '.kwwk...kwwk', '.kkkk...kkkk'];
const LEGS_RUN_B = ['...kOkOk....', '....kOOk....', '....kwwk....', '....kkkk....'];
const LEGS_JUMP = ['...kOkkOk...', '..kOk..kOk..', '..kwk..kwk..', '...k....k...'];
const LEGS_FALL = ['..kOk..kOk..', '..kOk..kOk..', '.kwwk..kwwk.', '.kkk....kkk.'];

export const PIP_FRAMES = {
  idle0: [...HEAD, ...TORSO, ...LEGS_STAND],
  idle1: [...HEAD_BLINK, ...TORSO, ...LEGS_STAND],
  run0: [...HEAD, ...TORSO_RUN_A, ...LEGS_RUN_A],
  run1: [...HEAD, ...TORSO, ...LEGS_RUN_B],
  run2: [...HEAD, ...TORSO_RUN_B, ...LEGS_RUN_A],
  run3: [...HEAD, ...TORSO, ...LEGS_RUN_B],
  jump: [...HEAD, ...TORSO_UP, ...LEGS_JUMP],
  fall: [...HEAD, ...TORSO_FALL, ...LEGS_FALL],
  bow: [
    '............',
    '............',
    '............',
    '............',
    '....kkkk....',
    '...kkEEkkk..',
    '..kEEEkffffk',
    '.kEkUUkffkffk',
    '..kUUUkffffPk',
    '..kfUUUkFfFk',
    '...kUUUUkk..',
    '...kuuuuuk..',
    ...LEGS_STAND,
  ],
};

// ---------------------------------------------------------------------------
// Cardboard knight on a rolling base. 14x24, facing right.
export const KNIGHT = [
  '.......EE.....',
  '......EEEE....',
  '.......kEk....',
  '.....kkkkkk...',
  '....ksSSSssk..',
  '....ksssssskk.',
  '....kgkgkgksk.',
  '....ksssssssk.',
  '.....kkkkkkk..',
  '..kkkGGGGGk...',
  '.kcckGsssGkkS.',
  '.kcEckGsGkkkSk',
  '.kEEEkssskkkSk',
  '.kcEckGGGkkkSk',
  '.kcckksssk.kSk',
  '..kk.kGGGk.kyk',
  '.....ksssk.kyk',
  '.....kGkGk..k.',
  '.....ksksk....',
  '....kksksk....',
  '....kkk.kkk...',
  '..kwwwwwwwwk..',
  '..kOkkkkkkOk..',
  '...kk....kk...',
];
export const KNIGHT_FLAT = [
  '...kkkkkkkkkkkkkkkkkkk..',
  '.kkcccGGsssssGGsssSSkEk.',
  'kwwwwwwwwwwwwwwwwwwwwwwk',
];

// Thundercloud cutout on a ceiling trolley. 32x22. The bolt is the hazard.
export const CLOUD = [
  '..........kkkk.....kkkk.........',
  '........kkWWWWk..kkWWWWkk.......',
  '......kkWWWWWWWkkWWWWWWWWk......',
  '.....kWWWWWWWWWWWWWWWWWWWWkk....',
  '...kkWWWWWWWWWWWWWWWWWWWWWWWk...',
  '..kWWWWWWSWWWWWWWWWWWWWSWWWWWk..',
  '.kWWWSSSSSSWWWWWWWSSSSSSSWWWWWk.',
  'kSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSk',
  'ksssSSSsssSSSSSSssSSSSSssSSSsssk',
  '.kksssskkssssssskkssssskksssskk.',
  '...kkkk..kkkYYkkk.kkkkk..kkkk...',
  '..........kYYYk.................',
  '.........kYYYk..................',
  '........kYYYYkkkk...............',
  '........kYYYYYYYk...............',
  '.........kkkYYYk................',
  '...........kYYk.................',
  '..........kYYk..................',
  '..........kYYkkk................',
  '...........kYYYk................',
  '............kYk.................',
  '.............k..................',
];

// Cardboard bear on a rolling base. 30x28, facing right.
export const BEAR = [
  '.....................kk..kk...',
  '....................kHHkkHHk..',
  '...................kHhhhhhhHk.',
  '..................khhhhhhhhhhk',
  '..................khhkhhhhkhhk',
  '..................khhhhhhhhhhk',
  '..........kkkkkkkkkhhhhhHHHHk.',
  '.......kkkhhhhhhhhhhhhhHHkkHk.',
  '.....kkhhhhhhhhhhhhhhhhHHHHk..',
  '....khhhhhhhhhhhhhhhhhhhkkk...',
  '...khhhhhhhhHhhhhhhhhhhhk.....',
  '..khhhhhhhHHhhhhhhhhhhhhk.....',
  '..khhhhhhhhhhhhhhhhhhhhhk.....',
  '.khhhhhhhhhhhhhhhhhhhhhhhk....',
  '.khhhhhhhhhhhhhhhhhhhhhhhk....',
  '.khhhhhhhhhhhhhhhhhhhhhhhk....',
  'kbkhhhhhhhhhhhhhhhhhhhhhhk....',
  'k.khhhhhkkkkkkkkkkhhhhhhhk....',
  '..khhhhk..........khhhhhk.....',
  '..khhhk...........khhhhk......',
  '..khhhk...........khhhk.......',
  '..kWkWk...........kWkWk.......',
  '..kkkkk...........kkkkk.......',
  '.kwwwwwwwwwwwwwwwwwwwwwwwwk...',
  '.kOkkkkkkkkkkkkkkkkkkkkkOkk...',
  '..kk....................kk....',
  '..............................',
  '..............................',
];

// Sandbag, 16x16.
export const BAG = [
  '.......kk.......',
  '......kyyk......',
  '.......kk.......',
  '......kbbk......',
  '.....kBBBBk.....',
  '....kBBcBBBk....',
  '...kBBccBBBBk...',
  '..kBBcBBBBBBBk..',
  '.kBBcBBBBBBBBBk.',
  '.kBBBBBBBBBBBbk.',
  '.kBBBBkkkkBBBbk.',
  '.kBBBBkbbkBBBbk.',
  '.kbBBBBkkBBBBbk.',
  '..kbbBBBBBBbbk..',
  '...kkbbbbbbkk...',
  '.....kkkkkk.....',
];
