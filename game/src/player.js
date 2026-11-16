// The firefighter: runs around the forest, digs firebreaks underfoot and drops water.
// Pure movement and tool rules; the world owns the score and the waves.
import { CELL, GRID_Y, PLAYER } from './config.js';
import { digCell, douse, nearWater } from './fire.js';
import { TYPE_BARE, TYPE_GRASS, TYPE_TREE } from './forest.js';

export function createPlayer() {
  return {
    // Start in the clearing, just south of the ranger station.
    x: 20 * CELL + CELL / 2,
    y: GRID_Y + 12 * CELL + CELL / 2,
    faceX: 0,
    faceY: -1,
    digProgress: 0,
    digCol: -1,
    digRow: -1,
    moving: false,
  };
}

function cellOf(x, y) {
  return { col: Math.floor(x / CELL), row: Math.floor((y - GRID_Y) / CELL) };
}

function blocked(forest, x, y) {
  const { col, row } = cellOf(x, y);
  return !forest.walkable(forest.at(col, row));
}

/**
 * Move the player, axis by axis, so a wall stops one direction without freezing the
 * other. Four sample points around the body keep the circle out of rocks, water and
 * the station. Returns nothing; the player is mutated in place.
 */
export function movePlayer(player, forest, dx, dy, speed, dt) {
  const r = PLAYER.radius;
  const nx = player.x + dx * speed * dt;
  const ny = player.y + dy * speed * dt;
  if (
    !blocked(forest, nx - r, player.y) &&
    !blocked(forest, nx + r, player.y) &&
    !blocked(forest, nx, player.y - r) &&
    !blocked(forest, nx, player.y + r)
  ) {
    player.x = nx;
  }
  if (
    !blocked(forest, player.x - r, ny) &&
    !blocked(forest, player.x + r, ny) &&
    !blocked(forest, player.x, ny - r) &&
    !blocked(forest, player.x, ny + r)
  ) {
    player.y = ny;
  }
  player.x = Math.max(r, Math.min(CELL * 40 - r, player.x));
  player.y = Math.max(GRID_Y + r, Math.min(GRID_Y + CELL * 20 - r, player.y));
  if (dx !== 0 || dy !== 0) {
    player.faceX = dx;
    player.faceY = dy;
    player.moving = true;
  } else {
    player.moving = false;
  }
}

/**
 * Dig the cell under the player's feet into bare earth: a firebreak that never burns.
 * Digging a burning tree cuts it out from under the fire. Progress is kept only while
 * the player stays on the same cell. Returns the dug cell, or null.
 */
export function digStep(player, forest, digTime, dt) {
  const { col, row } = cellOf(player.x, player.y);
  const cell = forest.at(col, row);
  if (!cell || (cell.type !== TYPE_TREE && cell.type !== TYPE_GRASS)) {
    player.digProgress = 0;
    player.digCol = -1;
    player.digRow = -1;
    return null;
  }
  if (player.digCol !== col || player.digRow !== row) {
    player.digCol = col;
    player.digRow = row;
    player.digProgress = 0;
  }
  player.digProgress += dt;
  if (player.digProgress >= digTime) {
    player.digProgress = 0;
    digCell(cell);
    return { col, row };
  }
  return null;
}

/**
 * Drop water on a cell: fires in the radius go out and the ground stays wet. The
 * target is the clicked cell when one is in reach, else the player's own cell.
 * Returns how many fires went out, or -1 when the tank cannot pay.
 */
export function splashAt(player, forest, tank, mods, target) {
  if (tank < PLAYER.splashCost) return -1;
  let col;
  let row;
  if (target) {
    const dx = target.col - Math.floor(player.x / CELL);
    const dy = target.row - Math.floor((player.y - GRID_Y) / CELL);
    if (dx * dx + dy * dy > 36) return -1;
    col = target.col;
    row = target.row;
  } else {
    col = Math.floor(player.x / CELL);
    row = Math.floor((player.y - GRID_Y) / CELL);
  }
  return douse(forest, col, row, mods.splashRadius, mods.wetSeconds);
}

/** Refill the tank while standing beside the pond; the spring upgrade adds a trickle. */
export function refillStep(player, forest, tank, mods, dt) {
  let next = tank;
  const { col, row } = cellOf(player.x, player.y);
  if (nearWater(forest, col, row)) next += mods.refillRate * dt;
  next += mods.passiveRefill * dt;
  return Math.min(mods.tankMax, next);
}

export { TYPE_BARE };
