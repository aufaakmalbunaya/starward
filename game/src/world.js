// The simulation: the forest, the fire driven by the wind, the firefighter's tools,
// the seven waves and the score. Fixed 1/60 s steps, all randomness from one seeded
// generator, so the same seed always plays the same game. No drawing and no browser
// in here: the renderer paints this state, and the tests step it in plain Node.
import {
  BOSS,
  CALM_SECONDS,
  CELL,
  COLS,
  COMBO_MAX,
  COMBO_WINDOW,
  GRID_Y,
  PLAYER,
  ROWS,
  SCORE,
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
    /** Boons the crew owns this run: { id, name, count }. Shown in the HUD. */
    boons: [],
    /** Chained douses: combo count, seconds left on the chain, best chain. */
    combo: 0,
    comboTimer: 0,
    comboBest: 0,
    /** The wave-7 boss, or null before wave 7. */
    boss: null,
    bossDefeated: false,
    /** Flames doused, by kind: { imp, crown, spot }. */
    variantDoused: { imp: 0, crown: 0, spot: 0 },
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
    // Later waves bring new kinds of flame: Crown Fire from wave 3, fast
    // Ember Imps from wave 5. Wave 7 brings the Crownfire itself.
    const variant = n >= 5 ? 'imp' : n >= 3 ? 'crown' : 'spot';
    const lit = igniteEdge(state.forest, state.wind, 1 + n, random, variant);
    state.banner = `WAVE ${n} OF ${WAVES} — WIND ${state.wind.name}${' ▮'.repeat(state.wind.strength)}`;
    state.bannerTime = 2.6;
    state.phase = 'wave';
    if (n === WAVES) spawnBoss();
    return lit;
  }

  /** Wave 7: the Crownfire walks in from the edge the wind blows from. */
  function spawnBoss() {
    let col = 0;
    let row = Math.floor(ROWS / 2);
    if (state.wind.dy < 0) {
      col = Math.floor(random() * COLS);
      row = ROWS - 1;
    } else if (state.wind.dy > 0) {
      col = Math.floor(random() * COLS);
      row = 0;
    } else if (state.wind.dx < 0) {
      col = COLS - 1;
      row = Math.floor(random() * ROWS);
    } else {
      col = 0;
      row = Math.floor(random() * ROWS);
    }
    state.boss = {
      name: BOSS.name,
      hp: BOSS.hp,
      maxHp: BOSS.hp,
      x: col * CELL + CELL / 2,
      y: GRID_Y + row * CELL + CELL / 2,
      phase: 1,
      igniteTimer: 0,
    };
    state.banner = `WAVE 7 — ${BOSS.name.toUpperCase()} HAS COME`;
    state.bannerTime = 3.2;
  }

  /** The boss walks toward the station and sets the forest alight around it. */
  function stepBoss(dt) {
    const boss = state.boss;
    if (!boss) return;
    const nextPhase = boss.hp > 200 ? 1 : boss.hp > 100 ? 2 : 3;
    if (nextPhase !== boss.phase) {
      boss.phase = nextPhase;
      state.banner =
        nextPhase === 2
          ? `${BOSS.name.toUpperCase()} RAGES — IT BURNS FASTER`
          : `${BOSS.name.toUpperCase()} IS ENRAGED — HOLD THE LINE`;
      state.bannerTime = 2.6;
    }
    const speed = boss.phase === 3 ? BOSS.speedPhase3 : boss.phase === 2 ? BOSS.speedPhase2 : BOSS.speed;
    const targetX = 19.5 * CELL;
    const targetY = GRID_Y + 9.5 * CELL;
    const dx = targetX - boss.x;
    const dy = targetY - boss.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 80) {
      boss.x += (dx / dist) * speed * dt;
      boss.y += (dy / dist) * speed * dt;
    }
    boss.igniteTimer -= dt;
    const interval = boss.phase === 3 ? 0.35 : 0.6;
    if (boss.igniteTimer <= 0) {
      boss.igniteTimer = interval;
      const bcol = Math.floor(boss.x / CELL);
      const brow = Math.floor((boss.y - GRID_Y) / CELL);
      const radius = boss.phase === 3 ? 2 : 1;
      for (let tries = 0; tries < 4; tries += 1) {
        const col = bcol + Math.floor(random() * (radius * 2 + 1)) - radius;
        const row = brow + Math.floor(random() * (radius * 2 + 1)) - radius;
        const cell = state.forest.at(col, row);
        if (cell && state.forest.flammable(cell) && !cell.fireproof && cell.wet <= 0) {
          cell.fire = 5;
          cell.variant = 'crown';
          break;
        }
      }
    }
  }

  function endGame(reason, won) {
    state.phase = won ? 'won' : 'over';
    state.won = won;
    state.overReason = reason;
    // The trees-saved bonus is a victory bonus: a lost run scores its waves and
    // its fires put out, nothing more.
    state.treesBonus = won ? state.forest.treesAlive() * SCORE.tree : 0;
    state.score += state.treesBonus;
    if (won && state.bossDefeated) state.score += SCORE.boss;
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
      if (state.stationBurn >= state.mods.stationBurnLimit) {
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
      const out = splashAt(player, state.forest, state.water, state.mods, input.waterTarget || null, state.variantDoused);
      if (out >= 0) {
        state.water -= PLAYER.splashCost;
        state.extinguished += out;
        const cx = input.waterTarget ? input.waterTarget.col : Math.floor(player.x / CELL);
        const cy = input.waterTarget ? input.waterTarget.row : Math.floor((player.y - GRID_Y) / CELL);
        state.particles.splash(cx * CELL + CELL / 2, GRID_Y + cy * CELL + CELL / 2);
        if (out > 0) {
          // Chained douses raise the multiplier: each douse within the window
          // pays more than the last, up to x8.
          state.combo += 1;
          state.comboTimer = COMBO_WINDOW;
          const mult = Math.min(state.combo, COMBO_MAX);
          if (mult > state.comboBest) state.comboBest = mult;
          const gain = out * SCORE.extinguish * mult;
          state.score += gain;
          floater(cx * CELL + CELL / 2, GRID_Y + cy * CELL, `+${gain} x${mult}`, '#7ec8f2');
        }
        // A splash landing close to the Crownfire wounds it.
        const boss = state.boss;
        if (boss) {
          const bcol = Math.floor(boss.x / CELL);
          const brow = Math.floor((boss.y - GRID_Y) / CELL);
          const reach = state.mods.splashRadius + BOSS.hitReach;
          if (Math.abs(cx - bcol) <= reach && Math.abs(cy - brow) <= reach) {
            boss.hp = Math.max(0, boss.hp - BOSS.splashDamage);
            floater(boss.x, boss.y - 30, `-${BOSS.splashDamage} ${BOSS.name.toUpperCase()}`, '#ff9a3d');
            state.particles.splash(boss.x, boss.y);
          }
        }
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
      state.boons = [];
      state.combo = 0;
      state.comboTimer = 0;
      state.comboBest = 0;
      state.boss = null;
      state.bossDefeated = false;
      state.variantDoused = { imp: 0, crown: 0, spot: 0 };
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
      const owned = state.boons.find((b) => b.id === upgrade.id);
      if (owned) owned.count += 1;
      else state.boons.push({ id: upgrade.id, name: upgrade.name, count: 1 });
      state.upgrades = [];
      startWave(state.wave + 1);
      return true;
    },

    /** The Rain Call boon: a downpour douses every flame burning right now. */
    rainCall() {
      let out = 0;
      for (const cell of state.forest.cells) {
        if (cell.fire > 0) {
          if (cell.variant) state.variantDoused[cell.variant] = (state.variantDoused[cell.variant] || 0) + 1;
          cell.fire = 0;
          cell.variant = null;
          out += 1;
        }
        cell.wet = Math.max(cell.wet, 25);
      }
      state.extinguished += out;
      state.score += out * SCORE.extinguish;
      state.banner = 'RAIN CALL — EVERY FLAME DOUSED';
      state.bannerTime = 2.6;
      return out;
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
      // A chain breaks when the window runs out without another douse.
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.combo = 0;
      }
      stepBoss(dt);
      emitFireParticles();
      // Dousing the Crownfire wins the game on the spot, boss bonus included.
      if (state.boss && state.boss.hp <= 0) {
        state.bossDefeated = true;
        state.boss = null;
        endGame('The Crownfire is doused. The forest stands.', true);
        events |= EVENT_WIN | EVENT_OVER;
        return events;
      }

      if (state.phase === 'wave') {
        state.waveTime += dt;
        if (state.waveTime >= WAVE_SECONDS) {
          if (state.wave >= WAVES) {
            // Wave 7's timer is up but the boss lives: the fight goes on
            // until the Crownfire is doused or the station burns.
            state.phase = 'boss';
            state.banner = 'THE CROWNFIRE REMAINS — FINISH IT';
            state.bannerTime = 3;
          } else {
            state.phase = 'calm';
            state.calmTime = 0;
            state.score += SCORE.wave;
            state.banner = `WAVE ${state.wave} CLEAR — MOP UP, THEN REST`;
            state.bannerTime = 2.6;
            events |= EVENT_WAVE_CLEAR;
          }
        }
      } else if (state.phase === 'boss') {
        // No timer here: the boss fight ends only in victory or defeat.
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
