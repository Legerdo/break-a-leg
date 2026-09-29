// Global tuning. Units: pixels and seconds.

export const TILE = 16;
export const VIEW_W = 320;
export const VIEW_H = 192;
export const ROWS = 12;
export const DT = 1 / 60;

export const PLAYER = {
  W: 10,
  H: 14,
  RUN: 92,
  ACC: 1100,
  DEC: 1600,
  TURN: 2600,
  AIR_ACC: 900,
  AIR_DEC: 380,
  JUMP_V: 340,
  G_UP: 1000,
  G_CUT: 2900,
  G_DOWN: 1500,
  APEX_V: 45,
  APEX_G: 0.6,
  MAX_FALL: 300,
  COYOTE: 0.1,
  BUFFER: 0.12,
};

export const BAG = {
  WOBBLE: 0.2,
  G: 2000,
  MAX_V: 520,
  LEAD: 10, // default proximity trigger distance (px) on each side of the bag column
};

export const DEATH = {
  HITSTOP: 0.08,
  HOLD: 0.6, // time from death to respawn (player regains control right away)
};

export const TRAP_SWING = 0.18;
