// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 60;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** The nearest enemy to the ship, or null when the field is empty. */
function nearestEnemy(state) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - state.ship.x, enemy.y - state.ship.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }
  return best;
}

/**
 * A decent pilot: chase the closest threat to the beacon, keep a little distance
 * from the beacon so it can intercept, and always fire at the nearest enemy.
 */
function autopilot(state) {
  const ship = state.ship;
  const enemy = nearestEnemy(state);
  let move = { x: 0, y: 0 };
  let aim = { x: ship.x, y: ship.y - 100 };
  let firing = false;
  if (enemy) {
    // Stand between the beacon and the enemy, slightly off to one side.
    const dx = enemy.x - 640;
    const dy = enemy.y - 360;
    const dist = Math.hypot(dx, dy) || 1;
    const guardX = 640 + (dx / dist) * 150;
    const guardY = 360 + (dy / dist) * 150;
    const gx = guardX - ship.x;
    const gy = guardY - ship.y;
    const gdist = Math.hypot(gx, gy) || 1;
    if (gdist > 24) {
      move = { x: gx / gdist, y: gy / gdist };
    }
    aim = { x: enemy.x, y: enemy.y };
    firing = true;
  }
  return { move, aim, firing };
}

/** A hurried pilot: it holds still and fires at the nearest enemy, so kills a few
 * before the ones coming from behind reach the beacon. */
function idlePilot(state) {
  const enemy = nearestEnemy(state);
  return {
    move: { x: 0, y: 0 },
    aim: enemy ? { x: enemy.x, y: enemy.y } : { x: state.ship.x, y: state.ship.y - 100 },
    firing: enemy !== null,
  };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name !== 'play' && name !== 'end') {
    world.reset();
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0 }, { x: 640, y: 260 }, false);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const pilot = name === 'end' ? idlePilot : autopilot;
  world.startGame();
  let wave2At = null;
  for (let index = 0; index < limit / STEP; index += 1) {
    const input = pilot(world.state);
    const events = world.step(STEP, input.move, input.aim, input.firing);
    if (events & EVENT_OVER) break;
    // The play scene stops a few seconds into wave 2, mid-fight, HUD full.
    if (name === 'play' && world.state.phase === 'play' && world.state.wave >= 2) {
      if (wave2At === null) wave2At = world.state.time;
      if (world.state.time - wave2At > 6 && world.state.enemies.length >= 2) break;
    }
  }
  const over = world.state.phase === 'over';
  const won = world.state.phase === 'won';
  return {
    screen: over ? SCREEN_OVER : won ? SCREEN_WON : SCREEN_PLAY,
    best: world.state.score,
  };
}
