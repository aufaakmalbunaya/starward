// The screenshot scenes behind ?shot=start|play|upgrade|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame.
import { CELL, COLS, GRID_Y, ROWS, STEP } from './config.js';
import { STATION_CELLS } from './forest.js';
import { EVENT_OVER, EVENT_UPGRADE } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';

const START_SECONDS = 5;
const UPGRADE_LIMIT_SECONDS = 300;
const END_LIMIT_SECONDS = 600;

function cellCentre(col, row) {
  return { x: col * CELL + CELL / 2, y: GRID_Y + row * CELL + CELL / 2 };
}

/** The nearest burning cell to the player, or null when nothing burns. */
function nearestBurning(state) {
  const p = state.player;
  let best = null;
  let bestDist = Infinity;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = state.forest.cells[row * COLS + col];
      if (cell.fire <= 0) continue;
      const cx = col * CELL + CELL / 2;
      const cy = GRID_Y + row * CELL + CELL / 2;
      const dist = Math.hypot(cx - p.x, cy - p.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { col, row, x: cx, y: cy, dist };
      }
    }
  }
  return best;
}

function stationBurning(state) {
  for (const [col, row] of STATION_CELLS) {
    const cell = state.forest.at(col, row);
    if (cell && cell.fire > 0) return { col, row };
  }
  return null;
}

function toward(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) return { x: 0, y: 0 };
  return { x: dx / dist, y: dy / dist };
}

/** The nearest burning cell to a point, within `maxDist` px, or null. */
function nearestBurningNear(state, x, y, maxDist) {
  const found = nearestBurning(state);
  if (!found) return null;
  if (Math.hypot(found.x - x, found.y - y) > maxDist) return null;
  return found;
}

/**
 * A decent pilot, in priority order: douse the station if it burns; fight any
 * fire closing on the cabin; keep the tank full at the pond; chase the nearest
 * fire, dig a firebreak when the flames are at your feet, splash when close.
 */
function autopilot(state) {
  const p = state.player;
  const input = { move: { x: 0, y: 0 }, dig: false, water: false, waterTarget: null };
  const station = stationBurning(state);
  if (station) {
    const at = cellCentre(station.col, station.row);
    input.move = toward(p.x, p.y, at.x, at.y);
    if (Math.hypot(at.x - p.x, at.y - p.y) < 110) {
      input.water = true;
      input.waterTarget = station;
    }
    return input;
  }
  // A fire closing on the cabin outranks the chase.
  const threat = nearestBurningNear(state, 640, GRID_Y + 10 * CELL, 170);
  if (threat) {
    input.move = toward(p.x, p.y, threat.x, threat.y);
    if (threat.dist < 100) {
      input.water = true;
      input.waterTarget = { col: threat.col, row: threat.row };
    }
    return input;
  }
  if (state.water < 30) {
    const pond = { x: 2 * CELL + CELL / 2, y: GRID_Y + 15 * CELL + CELL / 2 };
    input.move = toward(p.x, p.y, pond.x, pond.y);
    return input;
  }
  const fire = nearestBurning(state);
  if (!fire) {
    input.move = toward(p.x, p.y, 640, GRID_Y + 12 * CELL);
    return input;
  }
  // Standing on fuel next to the flames: cut it out instead of walking on.
  const col = Math.floor(p.x / CELL);
  const row = Math.floor((p.y - GRID_Y) / CELL);
  const here = state.forest.at(col, row);
  if (here && (here.type === 0 || here.type === 1)) {
    const neighbours = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dc, dr] of neighbours) {
      const next = state.forest.at(col + dc, row + dr);
      if (next && next.fire > 0) {
        input.dig = true;
        return input;
      }
    }
  }
  if (fire.dist < 100) {
    input.water = true;
    input.waterTarget = { col: fire.col, row: fire.row };
  }
  input.move = toward(p.x, p.y, fire.x, fire.y);
  return input;
}

/** A careless pilot: it wanders and never digs or splashes, so the station burns. */
function idlePilot(state) {
  const dx = Math.sin(state.time * 0.5);
  const dy = Math.cos(state.time * 0.35);
  const len = Math.hypot(dx, dy) || 1;
  return { move: { x: dx / len, y: dy / len }, dig: false, water: false, waterTarget: null };
}

const EMPTY = { move: { x: 0, y: 0 }, dig: false, water: false, waterTarget: null };

/**
 * Set `world` to the named scene (start, play, upgrade or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name !== 'play' && name !== 'upgrade' && name !== 'end') {
    world.reset();
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, EMPTY);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  world.startGame();
  if (name === 'play') {
    // Play through wave 1, take the first boon, then catch wave 2 mid-fight:
    // the frame shows live flames, the combo, and the boons owned so far.
    for (let index = 0; index < UPGRADE_LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state));
      if (events & EVENT_OVER) break;
      if (events & EVENT_UPGRADE) {
        world.pickUpgrade(0);
        for (let j = 0; j < 20 / STEP; j += 1) {
          const ev2 = world.step(STEP, autopilot(world.state));
          if (ev2 & EVENT_OVER) break;
        }
        break;
      }
    }
    const over = world.state.phase === 'over';
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'upgrade') {
    for (let index = 0; index < UPGRADE_LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state));
      if (events & EVENT_UPGRADE) break;
      if (events & EVENT_OVER) break;
    }
    const over = world.state.phase === 'over';
    return { screen: over ? SCREEN_OVER : SCREEN_UPGRADE, best: world.state.score };
  }
  for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
    const events = world.step(STEP, idlePilot(world.state));
    if (events & EVENT_OVER) break;
  }
  return { screen: SCREEN_OVER, best: world.state.score };
}
