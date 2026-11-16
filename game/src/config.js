// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// The grid sits between a 64 px HUD bar on top and a 16 px hint strip at the bottom.
export const FIELD = { width: 1280, height: 720 };

export const HUD_H = 64;
export const HINT_H = 16;
export const CELL = 32;
export const COLS = 40;
export const ROWS = 20;
export const GRID_Y = HUD_H;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WAVES = 7;
export const WAVE_SECONDS = 60;
export const CALM_SECONDS = 15;
/** Seconds the upgrade screen waits before taking the first card itself. */
export const UPGRADE_SECONDS = 20;

/** How long the ranger station can burn, in seconds, before it is lost. */
export const STATION_BURN_LIMIT = 6;

export const PLAYER = {
  radius: 13,
  speed: 205,
  /** Seconds of digging to turn one cell into a firebreak. */
  digTime: 0.35,
  tankMax: 100,
  splashCost: 20,
  /** Splash radius, in cells, around the target cell. */
  splashRadius: 2,
  wetSeconds: 25,
  /** Water refilled per second while standing beside the pond. */
  refillRate: 45,
};

/** Fire spread: per-second chance a burning cell ignites a neighbour, before wind and fuel. */
export const FIRE = {
  igniteBase: 0.24,
  windDown: 1.6,
  windCross: 1.0,
  windUp: 0.45,
  grassFuel: 1.3,
  treeFuel: 1.0,
  wetResist: 0.12,
  /** Per-second chance a burning cell throws an ember downwind. */
  emberChance: 0.035,
  emberMinJump: 2,
  emberMaxJump: 4,
  emberIgnite: 0.5,
  burnTree: 4.5,
  burnGrass: 2,
};

export const SCORE = { tree: 10, extinguish: 5, wave: 200 };

export const PALETTE = {
  backdrop: '#0d1a12',
  hud: '#101d15',
  hudLine: '#24402e',
  grass: '#2e5d33',
  grassDark: '#274e2b',
  tree: '#2f7a3d',
  treeDark: '#256633',
  treeLight: '#3f9a4e',
  bare: '#6b4a2f',
  bareDark: '#5d3f28',
  burnt: '#17130f',
  burntAsh: '#2a2320',
  rock: '#5b6470',
  rockDark: '#484f59',
  water: '#2f7fc2',
  waterDeep: '#1f5f96',
  wet: '#1e4d33',
  fireCore: '#ffd23e',
  fireMid: '#ff8a1e',
  fireEdge: '#e5482e',
  smoke: '#8a8f98',
  stationWall: '#c98f4e',
  stationRoof: '#b3402f',
  stationLight: '#ffd98a',
  playerJacket: '#d8442c',
  playerHelmet: '#f2c94c',
  playerSkin: '#e8b98a',
  playerPants: '#2c3e50',
  text: '#eef5ea',
  muted: '#9db8a4',
  gold: '#f2c94c',
  danger: '#ff6b4e',
  panel: '#14261b',
  panelLine: '#2c4a35',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberline.best';
