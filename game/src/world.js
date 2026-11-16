// The simulation: the forest, the fire driven by the wind, the firefighter's tools,
// the seven waves and the score. Fixed 1/60 s steps, all randomness from one seeded
// generator, so the same seed always plays the same game. No drawing and no browser
// in here: the renderer paints this state, and the tests step it in plain Node.
import {
  CALM_SECONDS,
  CELL,
  COLS,
  GRID_Y,
  PLAYER,
  ROWS,
  SCORE,
  STATION_BURN_LIMIT,
  UPGRADE_SECONDS,
  WAVE_SECONDS,
  WAVES,
} from './config.js';
import { createForest, STATION_CELLS, TYPE_STATION, TYPE_TREE } from './forest.js';
import { igniteEdge, rollWind, stepFire } from './fire.js';
import { createPlayer, digStep, movePlayer, refillStep, splashAt } from './player.js';
import { chooseUpgrades, defaultMods } from './upgrades.js';
import { createParticles } from './particles.js';

export const EVENT_NONE = 0;
export const EVENT_WAVE_CLEAR = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_UPGRADE = 8;
export const EVENT_SPLASH = 16;
export const EVENT_DIG = 32;
export const EVENT_DENIED = 64;

export function createWorld(random) {
  const state = {
    time: 0,
    phase: 'title',
    wave: 0,
    waveTime: 0,
    calmTime: 0,
    upgradeTime: 0,
    wind: { name: 'N', dx: 0, dy: -1, strength: 1 },
    water: PLAYER.tankMax,
    score: 0,
    extinguished: 0,
    dug: 0,
    treesStart: 0,
    treesBonus: 0,
    stationBurn: 0,
    banner: '',
    bannerTime: 0,
    shake: 0,
    mods: defaultMods(),
    upgrades: [],
    overReason: '',
    won: false,
    forest: null,
    player: null,
    particles: null,
    floaters: [],
    titleLightTimer: 0,
  };

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 1.2 });
  }

  function startWave(n) {
    state.wave = n;
    state.waveTime = 0;
    state.wind = rollWind(random, n);
    const lit = igniteEdge(state.forest, state.wind, 1 + n, random);
    state.banner = `WAVE ${n} OF ${WAVES} — WIND ${state.wind.name}${' ▮'.repeat(state.wind.strength)}`;
    state.bannerTime = 2.6;
    state.phase = 'wave';
    return lit;
  }

  function endGame(reason, won) {
    state.phase = won ? 'won' : 'over';
    state.won = won;
    state.overReason = reason;
    // The trees-saved bonus is a victory bonus: a lost run scores its waves and
    // its fires put out, nothing more.
    state.treesBonus = won ? state.forest.treesAlive() * SCORE.tree : 0;
    state.score += state.treesBonus;
  }

  function stepFireAndStation(dt) {
    const stats = { ignitions: 0, embers: 0, burnouts: 0 };
    stepFire(state.forest, state.wind, dt, random, stats, state.mods.emberFactor);
    // The station burns: a few seconds to douse it before the game is lost.
    let stationBurning = false;
    for (const [col, row] of STATION_CELLS) {
      const cell = state.forest.at(col, row);
      if (cell && cell.fire > 0) stationBurning = true;
    }
    if (stationBurning) {
      state.stationBurn += dt;
      state.shake = Math.max(state.shake, 6);
      if (state.stationBurn >= STATION_BURN_LIMIT) {
        endGame('The ranger station burned down.', false);
        return EVENT_OVER;
      }
    } else {
      state.stationBurn = Math.max(0, state.stationBurn - dt * 2);
    }
    return EVENT_NONE;
  }

  function stepPlayer(dt, input) {
    let events = EVENT_NONE;
    const player = state.player;
    const move = input.move || { x: 0, y: 0 };
    movePlayer(player, state.forest, move.x, move.y, state.mods.speed, dt);
    if (input.dig) {
      const dug = digStep(player, state.forest, state.mods.digTime, dt);
      if (dug) {
        state.dug += 1;
        state.particles.dust(dug.col * CELL + CELL / 2, GRID_Y + dug.row * CELL + CELL / 2);
        events |= EVENT_DIG;
      }
    }
    if (input.water) {
      const out = splashAt(player, state.forest, state.water, state.mods, input.waterTarget || null);
      if (out >= 0) {
        state.water -= PLAYER.splashCost;
        state.extinguished += out;
        state.score += out * SCORE.extinguish;
        const cx = input.waterTarget ? input.waterTarget.col : Math.floor(player.x / CELL);
        const cy = input.waterTarget ? input.waterTarget.row : Math.floor((player.y - GRID_Y) / CELL);
        state.particles.splash(cx * CELL + CELL / 2, GRID_Y + cy * CELL + CELL / 2);
        if (out > 0) floater(cx * CELL + CELL / 2, GRID_Y + cy * CELL, `+${out * SCORE.extinguish}`, '#7ec8f2');
        events |= EVENT_SPLASH;
      } else {
        events |= EVENT_DENIED;
      }
    }
    state.water = refillStep(player, state.forest, state.water, state.mods, dt);
    return events;
  }

  function emitFireParticles() {
    const cells = state.forest.cells;
    let seen = 0;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const cell = cells[row * COLS + col];
        if (cell.fire <= 0) continue;
        seen += 1;
        if (seen % 2 === 0) continue;
        const x = col * CELL + CELL / 2;
        const y = GRID_Y + row * CELL + CELL / 2;
        state.particles.ember(x, y, state.wind.dx);
        if (seen % 3 === 0) state.particles.smoke(x, y - 10);
      }
    }
  }

  // The world is usable from the moment it is created: the title screen steps it
  // before any game starts, so reset once here.
  const api = {
    state,

    reset() {
      state.time = 0;
      state.phase = 'title';
      state.wave = 0;
      state.waveTime = 0;
      state.calmTime = 0;
      state.upgradeTime = 0;
      state.wind = { name: 'N', dx: 0, dy: -1, strength: 1 };
      state.water = PLAYER.tankMax;
      state.score = 0;
      state.extinguished = 0;
      state.dug = 0;
      state.treesBonus = 0;
      state.stationBurn = 0;
      state.banner = '';
      state.bannerTime = 0;
      state.shake = 0;
      state.mods = defaultMods();
      state.upgrades = [];
      state.overReason = '';
      state.won = false;
      state.floaters = [];
      state.titleLightTimer = 0;
      state.forest = createForest(random);
      state.treesStart = state.forest.treesTotal();
      state.player = createPlayer();
      state.particles = createParticles(random);
    },

    startGame() {
      this.reset();
      startWave(1);
    },

    /** The upgrade screen's three cards. */
    upgradeChoices() {
      return state.upgrades.map((u, i) => ({ key: String(i + 1), name: u.name, desc: u.desc }));
    },

    pickUpgrade(index) {
      if (state.phase !== 'upgrade') return false;
      const upgrade = state.upgrades[index];
      if (!upgrade) return false;
      upgrade.apply(state.mods, this);
      state.upgrades = [];
      startWave(state.wave + 1);
      return true;
    },

    /** Mark random living trees fireproof, for the saplings upgrade. */
    plantFireproof(count) {
      let planted = 0;
      let guard = 0;
      while (planted < count && guard < 500) {
        guard += 1;
        const cell = state.forest.cells[Math.floor(random() * state.forest.cells.length)];
        if (cell.type === TYPE_TREE && !cell.burnt && !cell.fireproof) {
          cell.fireproof = true;
          planted += 1;
        }
      }
      return planted;
    },

    step(dt, input) {
      state.time += dt;
      if (state.bannerTime > 0) state.bannerTime -= dt;
      if (state.shake > 0) state.shake = Math.max(0, state.shake - 30 * dt);
      state.particles.step(dt);
      for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
        const f = state.floaters[i];
        f.y -= 30 * dt;
        f.life -= dt;
        if (f.life <= 0) state.floaters.splice(i, 1);
      }

      if (state.phase === 'title') {
        // A little fire smoulders in the north behind the title screen.
        state.titleLightTimer -= dt;
        if (state.titleLightTimer <= 0) {
          state.titleLightTimer = 2;
          if (state.forest.burningCount() < 6) {
            const col = Math.floor(random() * COLS);
            const cell = state.forest.at(col, 0);
            if (cell && cell.type === TYPE_TREE && cell.fire <= 0 && !cell.burnt) {
              cell.fire = 6;
            }
          }
        }
        stepFire(state.forest, state.wind, dt, random, { ignitions: 0, embers: 0, burnouts: 0 }, 1);
        emitFireParticles();
        return EVENT_NONE;
      }

      if (state.phase === 'upgrade') {
        // The choice waits for the player, but not forever: after a while the
        // first card is taken and the next wave starts on its own.
        state.upgradeTime += dt;
        if (state.upgradeTime >= UPGRADE_SECONDS) {
          this.pickUpgrade(0);
        }
        return EVENT_NONE;
      }
      if (state.phase === 'over' || state.phase === 'won') {
        return EVENT_NONE;
      }

      let events = stepPlayer(dt, input);
      if (events & EVENT_OVER) return events;
      const fireEvents = stepFireAndStation(dt);
      events |= fireEvents;
      if (events & EVENT_OVER) return events;
      emitFireParticles();

      if (state.phase === 'wave') {
        state.waveTime += dt;
        if (state.waveTime >= WAVE_SECONDS) {
          state.phase = 'calm';
          state.calmTime = 0;
          state.score += SCORE.wave;
          state.banner = `WAVE ${state.wave} CLEAR — MOP UP, THEN REST`;
          state.bannerTime = 2.6;
          events |= EVENT_WAVE_CLEAR;
        }
      } else if (state.phase === 'calm') {
        state.calmTime += dt;
        if (state.calmTime >= CALM_SECONDS) {
          if (state.wave >= WAVES) {
            endGame('Seven waves held. The forest stands.', true);
            events |= EVENT_WIN | EVENT_OVER;
          } else {
            state.phase = 'upgrade';
            state.upgradeTime = 0;
            state.upgrades = chooseUpgrades(random);
            events |= EVENT_UPGRADE;
          }
        }
      }
      return events;
    },
  };

  api.reset();
  return api;
}
