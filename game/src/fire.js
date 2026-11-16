// The fire itself: how it spreads from cell to cell, pushed by the wind, and how water
// puts it out. Pure simulation, no drawing and no browser in it.
import { COLS, FIRE, ROWS } from './config.js';
import {
  TYPE_BARE,
  TYPE_GRASS,
  TYPE_STATION,
  TYPE_TREE,
  index,
} from './forest.js';

/** The eight wind directions, as the unit step the wind blows towards. */
export const WINDS = [
  { name: 'N', dx: 0, dy: -1 },
  { name: 'NE', dx: 1, dy: -1 },
  { name: 'E', dx: 1, dy: 0 },
  { name: 'SE', dx: 1, dy: 1 },
  { name: 'S', dx: 0, dy: 1 },
  { name: 'SW', dx: -1, dy: 1 },
  { name: 'W', dx: -1, dy: 0 },
  { name: 'NW', dx: -1, dy: -1 },
];

/** Pick a wind for a wave: a new direction, stronger as the waves go on. */
export function rollWind(random, wave) {
  const wind = WINDS[Math.floor(random() * WINDS.length)];
  return { ...wind, strength: Math.min(3, 1 + Math.floor((wave - 1) / 3) + (random() < 0.3 ? 1 : 0)) };
}

/** How much the wind helps a fire jump from one cell to its neighbour. */
function windFactor(wind, dc, dr) {
  const dot = dc * wind.dx + dr * wind.dy;
  if (dot > 0) return FIRE.windDown;
  if (dot < 0) return FIRE.windUp;
  return FIRE.windCross;
}

function burnTime(cell) {
  if (cell.type === TYPE_TREE) return FIRE.burnTree;
  if (cell.type === TYPE_GRASS) return FIRE.burnGrass;
  if (cell.type === TYPE_STATION) return 1e9;
  return 0;
}

export function igniteCell(cell) {
  cell.fire = burnTime(cell);
}

/**
 * One fire step. `stats` collects what happened (ignitions, embers, burnouts) for the
 * caller to score and announce. Returns nothing; the grid is mutated in place.
 */
export function stepFire(forest, wind, dt, random, stats, emberFactor) {
  const cells = forest.cells;
  // Ignitions decided this step, applied after the scan so one step never chains twice.
  const toIgnite = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = cells[index(col, row)];
      if (cell.wet > 0) cell.wet = Math.max(0, cell.wet - dt);
      if (cell.fire <= 0) continue;
      cell.fire -= dt;
      if (cell.fire <= 0) {
        cell.fire = 0;
        if (cell.type !== TYPE_STATION) cell.burnt = true;
        stats.burnouts += 1;
        continue;
      }
      // Neighbours catch from this burning cell.
      const neighbours = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dc, dr] of neighbours) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const target = cells[index(nc, nr)];
        if (!forest.flammable(target)) continue;
        let chance = FIRE.igniteBase * windFactor(wind, dc, dr);
        chance *= target.type === TYPE_GRASS ? FIRE.grassFuel : FIRE.treeFuel;
        // The cabin is built to resist: it catches far slower than a tree.
        if (target.type === TYPE_STATION) chance *= 0.35;
        if (target.wet > 0) chance *= FIRE.wetResist;
        if (target.fireproof) chance = 0;
        if (random() < chance * dt) toIgnite.push(target);
      }
      // Embers: a burning cell can throw a spark several cells downwind.
      const emberChance = FIRE.emberChance * wind.strength * emberFactor;
      if (random() < emberChance * dt) {
        const jump = FIRE.emberMinJump + Math.floor(random() * (FIRE.emberMaxJump - FIRE.emberMinJump + 1));
        const tc = col + wind.dx * jump;
        const tr = row + wind.dy * jump;
        if (tc >= 0 && tc < COLS && tr >= 0 && tr < ROWS) {
          const target = cells[index(tc, tr)];
          // The cabin resists embers as it resists the front.
          const emberIgnite = FIRE.emberIgnite * (target.type === TYPE_STATION ? 0.35 : 1);
          if (forest.flammable(target) && target.wet <= 0 && !target.fireproof && random() < emberIgnite) {
            toIgnite.push(target);
            stats.embers += 1;
          }
        }
      }
    }
  }
  for (const cell of toIgnite) {
    if (cell.fire <= 0 && !cell.burnt) {
      igniteCell(cell);
      stats.ignitions += 1;
    }
  }
}

/** Light `count` new fires along the edge the wind blows from. */
export function igniteEdge(forest, wind, count, random) {
  let lit = 0;
  let guard = 0;
  while (lit < count && guard < 200) {
    guard += 1;
    let col;
    let row;
    if (wind.dy < 0) {
      // Wind blows north: fires start at the south edge.
      col = Math.floor(random() * COLS);
      row = ROWS - 1;
    } else if (wind.dy > 0) {
      col = Math.floor(random() * COLS);
      row = 0;
    } else if (wind.dx < 0) {
      col = COLS - 1;
      row = Math.floor(random() * ROWS);
    } else {
      col = 0;
      row = Math.floor(random() * ROWS);
    }
    const cell = forest.at(col, row);
    if (cell && forest.flammable(cell)) {
      igniteCell(cell);
      lit += 1;
    }
  }
  return lit;
}

/**
 * Drop water on a cell: everything burning in the radius goes out and the ground stays
 * wet, so it resists ignition for a while. Returns how many fires went out.
 */
export function douse(forest, centreCol, centreRow, radius, wetSeconds) {
  let out = 0;
  for (let dr = -radius; dr <= radius; dr += 1) {
    for (let dc = -radius; dc <= radius; dc += 1) {
      if (dc * dc + dr * dr > radius * radius + radius * 0.5) continue;
      const cell = forest.at(centreCol + dc, centreRow + dr);
      if (!cell) continue;
      if (cell.type === TYPE_TREE || cell.type === TYPE_GRASS || cell.type === TYPE_STATION) {
        cell.wet = Math.max(cell.wet, wetSeconds);
        if (cell.fire > 0) {
          cell.fire = 0;
          out += 1;
        }
      }
    }
  }
  return out;
}

/** Is the player standing beside open water, where the tank refills? */
export function nearWater(forest, col, row) {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const cell = forest.at(col + dc, row + dr);
      if (cell && cell.type === 4) return true;
    }
  }
  return false;
}

/** Turn a cell into bare earth: a firebreak that never burns. */
export function digCell(cell) {
  cell.type = TYPE_BARE;
  cell.fire = 0;
  cell.burnt = false;
  cell.wet = 0;
  cell.fireproof = false;
}
