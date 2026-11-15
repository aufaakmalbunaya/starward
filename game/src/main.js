// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play, shop,
// paused, game over and victory.
//
// ?seed=N fixes the enemy pattern. ?shot=start|play|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BEACON_HIT, EVENT_KILL, EVENT_OVER, EVENT_SALVAGE, EVENT_SHIP_HIT, EVENT_WAVE_CLEAR, EVENT_WON } from './world.js';
import {
  ACTION_CONFIRM, ACTION_MUTE, ACTION_NEXT_WAVE, ACTION_PAUSE, ACTION_SHOP_1,
  ACTION_SHOP_2, ACTION_SHOP_3, ACTION_SHOP_4, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SHOP, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const SHOP_ACTIONS = [ACTION_SHOP_1, ACTION_SHOP_2, ACTION_SHOP_3, ACTION_SHOP_4];
const SHOP_IDS = ['fire', 'damage', 'speed', 'repair'];

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
    renderer.draw(world.state, scene.screen, scene.best, world.shopItems());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const audio = createAudio();
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.startGame();
    screen = SCREEN_PLAY;
    audio.waveHorn();
    announce('Playing. Defend the beacon.');
  }

  function endGame() {
    screen = world.state.won ? SCREEN_WON : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(world.state.won ? `Victory. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function playEvents(events) {
    if (events & EVENT_KILL) audio.explosion();
    if (events & EVENT_SALVAGE) audio.pickup();
    if (events & EVENT_SHIP_HIT) audio.hit();
    if (events & EVENT_BEACON_HIT) audio.alarm();
    if (events & EVENT_WAVE_CLEAR) audio.waveHorn();
    if (events & EVENT_WON) audio.waveHorn();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WON) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_SHOP) {
      for (let i = 0; i < SHOP_ACTIONS.length; i += 1) {
        if (actions & SHOP_ACTIONS[i]) {
          if (world.buyUpgrade(SHOP_IDS[i])) audio.buy();
          else audio.denied();
        }
      }
      if (actions & ACTION_NEXT_WAVE) {
        world.nextWave();
        screen = SCREEN_PLAY;
        audio.waveHorn();
        announce(`Wave ${world.state.wave}.`);
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, { x: 640, y: 260 }, false);
      return;
    }
    if (screen === SCREEN_SHOP) {
      world.step(STEP, { x: 0, y: 0 }, { x: 640, y: 260 }, false);
      if (world.state.phase === 'play') screen = SCREEN_PLAY;
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.direction();
    const aim = input.aim();
    const firing = input.firing();
    const events = world.step(STEP, move, aim, firing);
    if (firing && world.state.ship.fireTimer > 0.18) audio.shoot();
    playEvents(events);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_WAVE_CLEAR) {
      screen = SCREEN_SHOP;
      announce(`Wave cleared. Spend your salvage, then press N for the next wave.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_SHOP) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_SHOP)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    world.state.aim = screen === SCREEN_PLAY ? input.aim() : null;
    renderer.draw(world.state, screen, best, world.shopItems());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Starward. Press Space or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
