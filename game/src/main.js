// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, upgrade, paused, game over
// and victory.
//
// ?seed=N fixes the fire pattern. ?shot=start|play|upgrade|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, CELL, GRID_Y, STEP } from './config.js';
import { createRandom } from './random.js';
import { isMuted, setCrackle, setMuted, sfx } from './audio.js';
import {
  EVENT_DIG,
  EVENT_OVER,
  EVENT_SPLASH,
  EVENT_UPGRADE,
  EVENT_WAVE_CLEAR,
  EVENT_WIN,
  createWorld,
} from './world.js';
import {
  ACTION_CLICK,
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_NEXT,
  ACTION_PAUSE,
  ACTION_PICK_1,
  ACTION_PICK_2,
  ACTION_PICK_3,
  ACTION_WATER,
  createInput,
} from './input.js';
import {
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_UPGRADE,
  SCREEN_WON,
  createRenderer,
  upgradeCardRect,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const PICK_ACTIONS = [ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3];

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { upgrades: world.upgradeChoices() });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  // A water drop asked for this frame (K, or a click on the field): the first
  // simulation step of the frame takes it, so it fires exactly once.
  let waterRequest = null;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.startGame();
    screen = SCREEN_PLAY;
    sfx.horn();
    announce('Playing. Hold the line against the fire.');
  }

  function endGame() {
    screen = world.state.won ? SCREEN_WON : SCREEN_OVER;
    if (world.state.won) sfx.win();
    else sfx.lose();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(
      world.state.won
        ? `Victory. Score ${world.state.score}.`
        : `Game over. Score ${world.state.score}. Best ${best}.`,
    );
  }

  function clickCell(point) {
    return {
      col: Math.floor(point.x / CELL),
      row: Math.floor((point.y - GRID_Y) / CELL),
    };
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      setMuted(!isMuted());
      announce(isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WON) {
      if (actions & (ACTION_CONFIRM | ACTION_CLICK)) startGame();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
        return;
      }
      if (actions & ACTION_WATER) {
        waterRequest = { target: null };
      } else if (actions & ACTION_CLICK) {
        const point = input.clickPoint();
        if (point.y >= GRID_Y) waterRequest = { target: clickCell(point) };
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM | ACTION_CLICK)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      for (let i = 0; i < PICK_ACTIONS.length; i += 1) {
        if (actions & PICK_ACTIONS[i] && world.pickUpgrade(i)) {
          sfx.upgrade();
          screen = SCREEN_PLAY;
          sfx.horn();
          announce(`Wave ${world.state.wave}.`);
          return;
        }
      }
      if (actions & ACTION_CLICK) {
        const point = input.clickPoint();
        for (let i = 0; i < 3; i += 1) {
          const r = upgradeCardRect(i);
          if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) {
            if (world.pickUpgrade(i)) {
              sfx.upgrade();
              screen = SCREEN_PLAY;
              sfx.horn();
              announce(`Wave ${world.state.wave}.`);
            }
            return;
          }
        }
      }
      if (actions & ACTION_NEXT) {
        // N skips the choice and takes the first card.
        if (world.pickUpgrade(0)) {
          sfx.upgrade();
          screen = SCREEN_PLAY;
          sfx.horn();
          announce(`Wave ${world.state.wave}.`);
        }
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { move: { x: 0, y: 0 }, dig: false, water: false, waterTarget: null });
      return;
    }
    if (screen === SCREEN_UPGRADE) return;
    if (screen !== SCREEN_PLAY) return;
    const request = waterRequest;
    waterRequest = null;
    const events = world.step(STEP, {
      move: input.direction(),
      dig: input.digging(),
      water: request !== null,
      waterTarget: request ? request.target : null,
    });
    if (events & EVENT_DIG) sfx.dig();
    if (events & EVENT_SPLASH) sfx.splash();
    if (events & EVENT_WAVE_CLEAR) sfx.horn();
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_UPGRADE) {
      screen = SCREEN_UPGRADE;
      sfx.upgrade();
      announce('Wave clear. Choose a boon, then face the next wave.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_UPGRADE) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_UPGRADE)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    setCrackle(Math.min(1, world.state.forest.burningCount() / 40));
    // The upgrade screen can end on its own (the 20 s auto-pick): follow the
    // world back into play when it does.
    if (screen === SCREEN_UPGRADE && world.state.phase === 'play') {
      screen = SCREEN_PLAY;
      sfx.horn();
      announce(`Wave ${world.state.wave}.`);
    }
    renderer.draw(world.state, screen, best, { upgrades: world.upgradeChoices() });
  }

  // Leaving the tab pauses a running game rather than letting the fire spread unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberline. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
