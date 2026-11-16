// The forest: a grid of cells, each with a terrain type, a burn state and a wet timer.
// The world logic reads this grid; only the renderer draws it. Nothing here touches the
// browser, so the simulation can be tested in plain Node.
import { COLS, ROWS } from './config.js';

export const TYPE_TREE = 0;
export const TYPE_GRASS = 1;
export const TYPE_BARE = 2;
export const TYPE_ROCK = 3;
export const TYPE_WATER = 4;
export const TYPE_STATION = 5;

/** The ranger station's cells, as [col, row] pairs. */
export const STATION_CELLS = [
  [19, 9],
  [20, 9],
  [19, 10],
  [20, 10],
];

/** The pond's cells, as [col, row] pairs. */
export const POND_CELLS = [
  [1, 14],
  [2, 14],
  [3, 14],
  [1, 15],
  [2, 15],
  [3, 15],
  [1, 16],
  [2, 16],
  [3, 16],
];

export function index(col, row) {
  return row * COLS + col;
}

export function inBounds(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

export function createForest(random) {
  const cells = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      cells.push({
        type: TYPE_GRASS,
        burnt: false,
        /** Seconds of fire left; 0 means not burning. */
        fire: 0,
        /** Seconds of wetness left; wet ground resists ignition. */
        wet: 0,
        fireproof: false,
        /** 0..1 colour variance, fixed at generation so the forest looks organic. */
        shade: random(),
      });
    }
  }
  const at = (col, row) => cells[index(col, row)];
  const isStation = (col, row) => STATION_CELLS.some(([c, r]) => c === col && r === row);
  const isPond = (col, row) => POND_CELLS.some(([c, r]) => c === col && r === row);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = at(col, row);
      if (isStation(col, row)) {
        cell.type = TYPE_STATION;
        continue;
      }
      if (isPond(col, row)) {
        cell.type = TYPE_WATER;
        continue;
      }
      // A wide grass clearing around the station, so the cabin reads clearly and
      // the fire arrives as a thin front the crew can meet, not a wall of flame.
      const nearStation = Math.abs(col - 19.5) <= 5 && Math.abs(row - 9.5) <= 5;
      if (nearStation) {
        cell.type = TYPE_GRASS;
        continue;
      }
      const roll = random();
      if (roll < 0.07) cell.type = TYPE_ROCK;
      else if (roll < 0.79) cell.type = TYPE_TREE;
      else cell.type = TYPE_GRASS;
    }
  }

  return {
    cells,
    at(col, row) {
      return inBounds(col, row) ? cells[index(col, row)] : null;
    },
    /** Cells a fire can catch: trees, grass and the station itself. */
    flammable(cell) {
      return (
        cell !== null &&
        (cell.type === TYPE_TREE || cell.type === TYPE_GRASS || cell.type === TYPE_STATION) &&
        !cell.burnt &&
        cell.fire <= 0
      );
    },
    /** Cells the player can walk through. */
    walkable(cell) {
      return (
        cell !== null &&
        cell.type !== TYPE_ROCK &&
        cell.type !== TYPE_WATER &&
        cell.type !== TYPE_STATION
      );
    },
    treesTotal() {
      let total = 0;
      for (const cell of cells) if (cell.type === TYPE_TREE) total += 1;
      return total;
    },
    treesAlive() {
      let alive = 0;
      for (const cell of cells) if (cell.type === TYPE_TREE && !cell.burnt) alive += 1;
      return alive;
    },
    burningCount() {
      let burning = 0;
      for (const cell of cells) if (cell.fire > 0) burning += 1;
      return burning;
    },
  };
}
