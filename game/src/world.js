// The simulation: ship, bullets, enemies spiralling onto the beacon, salvage,
// particles and waves. Fixed 1/60 s steps, all randomness from one seeded
// generator, so the same seed always plays the same game.
import {
  BEACON, BULLET, ENEMY_TYPES, FIELD, SALVAGE, SHIP, STEP, UPGRADES,
  WIN_WAVE, waveComposition,
} from './config.js';
import { pick, range } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_KILL = 1;
export const EVENT_BEACON_HIT = 2;
export const EVENT_SHIP_HIT = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_SALVAGE = 32;
export const EVENT_WON = 64;

const SHOP_SECONDS = 25;
const SPAWN_MARGIN = 50;

function upgradeCost(upgrade, level) {
  return upgrade.base + upgrade.growth * level;
}

function spawnPoint(random) {
  const side = Math.floor(random() * 4);
  if (side === 0) return { x: range(random, 0, FIELD.width), y: -SPAWN_MARGIN };
  if (side === 1) return { x: FIELD.width + SPAWN_MARGIN, y: range(random, 0, FIELD.height) };
  if (side === 2) return { x: range(random, 0, FIELD.width), y: FIELD.height + SPAWN_MARGIN };
  return { x: -SPAWN_MARGIN, y: range(random, 0, FIELD.height) };
}

export function createWorld(random) {
  const state = {
    time: 0,
    phase: 'title',
    score: 0,
    best: 0,
    wave: 0,
    kills: 0,
    salvage: 0,
    beaconIntegrity: BEACON.maxIntegrity,
    ship: { x: FIELD.width / 2, y: FIELD.height / 2 + 170, vx: 0, vy: 0, angle: -Math.PI / 2, hull: SHIP.maxHull, invuln: 0, fireTimer: 0 },
    bullets: [],
    enemies: [],
    salvageDrops: [],
    particles: [],
    floaters: [],
    stars: [],
    spawnQueue: [],
    spawnTimer: 0,
    shopTimer: 0,
    waveBanner: '',
    bannerTimer: 0,
    shake: 0,
    upgrades: { fire: 0, damage: 0, speed: 0, repair: 0 },
    won: false,
    overReason: '',
  };

  function makeStars() {
    state.stars = [];
    for (let layer = 0; layer < 3; layer += 1) {
      const count = 40 + layer * 30;
      for (let i = 0; i < count; i += 1) {
        state.stars.push({
          x: random() * FIELD.width,
          y: random() * FIELD.height,
          layer,
          size: 0.6 + layer * 0.7 + random() * 0.8,
          twinkle: random() * Math.PI * 2,
        });
      }
    }
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const power = range(random, speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power,
        life: range(random, 0.3, 0.8),
        maxLife: 0.8,
        color,
        size: range(random, 2, 5),
      });
    }
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 1.1 });
  }

  function fireRate() {
    return SHIP.fireCooldown * Math.pow(0.82, state.upgrades.fire);
  }

  function bulletDamage() {
    return SHIP.bulletDamage + state.upgrades.damage;
  }

  function shipSpeed() {
    return SHIP.speed * (1 + 0.12 * state.upgrades.speed);
  }

  function startWave(n) {
    state.wave = n;
    const counts = waveComposition(n);
    const queue = [];
    for (const [type, count] of Object.entries(counts)) {
      for (let i = 0; i < count; i += 1) queue.push(type);
    }
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    state.spawnQueue = queue;
    state.spawnTimer = 0.8;
    state.phase = 'play';
    state.waveBanner = n === 1 ? 'WAVE 1 — THEY COME FOR THE BEACON' : `WAVE ${n}`;
    state.bannerTimer = 2.2;
    if (n > 1) state.ship.hull = Math.min(SHIP.maxHull, state.ship.hull + 1);
  }

  function endGame(reason, won) {
    state.phase = won ? 'won' : 'over';
    state.won = won;
    state.overReason = reason;
    if (won) state.score += 500;
  }

  function damageBeacon() {
    state.beaconIntegrity -= 1;
    state.shake = Math.max(state.shake, 14);
    burst(BEACON.x, BEACON.y, '#ffb347', 26, 260);
    if (state.beaconIntegrity <= 0) {
      burst(BEACON.x, BEACON.y, '#ffb347', 60, 420);
      burst(BEACON.x, BEACON.y, '#ffffff', 30, 300);
      endGame('The beacon fell. The light went out.', false);
      return EVENT_BEACON_HIT | EVENT_OVER;
    }
    return EVENT_BEACON_HIT;
  }

  function killEnemy(enemy, index) {
    const type = ENEMY_TYPES[enemy.type];
    state.enemies.splice(index, 1);
    state.score += type.score;
    state.kills += 1;
    burst(enemy.x, enemy.y, type.color, 18, 240);
    floater(enemy.x, enemy.y - 10, `+${type.score}`, '#eef2ff');
    for (let i = 0; i < type.salvage; i += 1) {
      const angle = random() * Math.PI * 2;
      state.salvageDrops.push({
        x: enemy.x, y: enemy.y,
        vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60,
        life: SALVAGE.life, value: 1,
      });
    }
    return EVENT_KILL;
  }

  function stepPlay(dt, move, aim, firing) {
    let events = EVENT_NONE;
    const ship = state.ship;
    const speed = shipSpeed();

    // Ship: accelerate toward the move direction, drag, clamp to the field.
    ship.vx += move.x * SHIP.accel * dt;
    ship.vy += move.y * SHIP.accel * dt;
    ship.vx *= Math.pow(SHIP.drag, dt * 60);
    ship.vy *= Math.pow(SHIP.drag, dt * 60);
    const v = Math.hypot(ship.vx, ship.vy);
    if (v > speed) {
      ship.vx = (ship.vx / v) * speed;
      ship.vy = (ship.vy / v) * speed;
    }
    ship.x = Math.min(FIELD.width - 20, Math.max(20, ship.x + ship.vx * dt));
    ship.y = Math.min(FIELD.height - 20, Math.max(20, ship.y + ship.vy * dt));
    ship.angle = Math.atan2(aim.y - ship.y, aim.x - ship.x);
    if (ship.invuln > 0) ship.invuln -= dt;

    // Fire toward the aim point.
    ship.fireTimer -= dt;
    if (firing && ship.fireTimer <= 0) {
      ship.fireTimer = fireRate();
      const a = ship.angle;
      state.bullets.push({
        x: ship.x + Math.cos(a) * 20,
        y: ship.y + Math.sin(a) * 20,
        vx: Math.cos(a) * SHIP.bulletSpeed,
        vy: Math.sin(a) * SHIP.bulletSpeed,
        life: BULLET.life,
      });
      events |= 0; // the caller plays the shot sound when firing is true
    }

    // Spawn the wave's queue, one enemy at a time.
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = Math.max(0.35, 0.85 - state.wave * 0.05);
        const type = state.spawnQueue.shift();
        const point = spawnPoint(random);
        const def = ENEMY_TYPES[type];
        state.enemies.push({
          type,
          x: point.x, y: point.y,
          vx: 0, vy: 0,
          hp: def.hp,
          angle: 0,
          wobble: random() * Math.PI * 2,
          wobbleSpeed: range(random, 1.2, 2.4),
        });
      }
    }

    // Enemies spiral toward the beacon with a sideways drift.
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      const def = ENEMY_TYPES[enemy.type];
      const dx = BEACON.x - enemy.x;
      const dy = BEACON.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const inward = def.speed * (1 + (state.wave - 1) * 0.04);
      const tangent = def.speed * 0.55;
      const wob = Math.sin(state.time * enemy.wobbleSpeed + enemy.wobble) * 0.35;
      const tx = (-dy / dist) * (tangent + wob * tangent);
      const ty = (dx / dist) * (tangent + wob * tangent);
      enemy.vx = (dx / dist) * inward + tx;
      enemy.vy = (dy / dist) * inward + ty;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.angle += dt * 1.5;
      if (dist < BEACON.radius + def.radius) {
        state.enemies.splice(i, 1);
        burst(enemy.x, enemy.y, def.color, 14, 200);
        events |= damageBeacon();
        if (events & EVENT_OVER) return events;
      }
    }

    // Bullets fly straight and die on the first enemy they touch.
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let dead = bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = state.enemies[j];
          const def = ENEMY_TYPES[enemy.type];
          const dx = bullet.x - enemy.x;
          const dy = bullet.y - enemy.y;
          if (dx * dx + dy * dy < (def.radius + BULLET.radius) * (def.radius + BULLET.radius)) {
            dead = true;
            enemy.hp -= bulletDamage();
            burst(bullet.x, bullet.y, '#aef6ff', 5, 120);
            if (enemy.hp <= 0) events |= killEnemy(enemy, j);
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }

    // A ship that rams an enemy destroys it and loses one hull.
    if (ship.invuln <= 0) {
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = state.enemies[i];
        const def = ENEMY_TYPES[enemy.type];
        const dx = ship.x - enemy.x;
        const dy = ship.y - enemy.y;
        if (dx * dx + dy * dy < (def.radius + SHIP.radius) * (def.radius + SHIP.radius)) {
          state.enemies.splice(i, 1);
          burst(enemy.x, enemy.y, def.color, 20, 260);
          ship.hull -= 1;
          ship.invuln = SHIP.invulnerable;
          ship.vx = (dx / (Math.hypot(dx, dy) || 1)) * 320;
          ship.vy = (dy / (Math.hypot(dx, dy) || 1)) * 320;
          state.shake = Math.max(state.shake, 10);
          events |= EVENT_SHIP_HIT;
          if (ship.hull <= 0) {
            burst(ship.x, ship.y, '#4de8ff', 50, 380);
            endGame('Your ship was torn apart defending the beacon.', false);
            events |= EVENT_OVER;
            return events;
          }
          break;
        }
      }
    }

    // Salvage drifts, is pulled toward a near ship, and is collected on touch.
    for (let i = state.salvageDrops.length - 1; i >= 0; i -= 1) {
      const drop = state.salvageDrops[i];
      drop.life -= dt;
      const dx = ship.x - drop.x;
      const dy = ship.y - drop.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < SALVAGE.magnetRadius) {
        drop.vx += (dx / dist) * 900 * dt;
        drop.vy += (dy / dist) * 900 * dt;
      } else {
        drop.vx *= 0.96;
        drop.vy *= 0.96;
      }
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      if (dist < SALVAGE.collectRadius) {
        state.salvage += drop.value;
        state.salvageDrops.splice(i, 1);
        events |= EVENT_SALVAGE;
        continue;
      }
      if (drop.life <= 0) state.salvageDrops.splice(i, 1);
    }

    // Wave cleared: no enemies left and nothing left to spawn.
    if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
      if (state.wave >= WIN_WAVE) {
        endGame('Ten waves held. The beacon still burns.', true);
        events |= EVENT_WON | EVENT_OVER;
      } else {
        state.phase = 'shop';
        state.shopTimer = SHOP_SECONDS;
        state.score += 25 + state.wave * 10;
        events |= EVENT_WAVE_CLEAR;
      }
    }
    return events;
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 40 * dt);
  }

  return {
    state,
    reset() {
      state.time = 0;
      state.phase = 'title';
      state.score = 0;
      state.wave = 0;
      state.kills = 0;
      state.salvage = 0;
      state.beaconIntegrity = BEACON.maxIntegrity;
      state.ship = { x: FIELD.width / 2, y: FIELD.height / 2 + 170, vx: 0, vy: 0, angle: -Math.PI / 2, hull: SHIP.maxHull, invuln: 0, fireTimer: 0 };
      state.bullets = [];
      state.enemies = [];
      state.salvageDrops = [];
      state.particles = [];
      state.floaters = [];
      state.spawnQueue = [];
      state.spawnTimer = 0;
      state.shopTimer = 0;
      state.waveBanner = '';
      state.bannerTimer = 0;
      state.shake = 0;
      state.upgrades = { fire: 0, damage: 0, speed: 0, repair: 0 };
      state.won = false;
      state.overReason = '';
      makeStars();
      // A few drones drift around the beacon behind the title screen.
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        state.enemies.push({
          type: 'drone', x: BEACON.x + Math.cos(a) * 240, y: BEACON.y + Math.sin(a) * 240,
          vx: 0, vy: 0, hp: 1, angle: a, wobble: a, wobbleSpeed: 0.5,
        });
      }
    },
    startGame() {
      this.reset();
      // The title screen's ambient drones are decoration, not wave 1.
      state.enemies = [];
      startWave(1);
    },
    nextWave() {
      if (state.phase !== 'shop') return;
      startWave(state.wave + 1);
    },
    shopItems() {
      return UPGRADES.map((u) => {
        const level = state.upgrades[u.id];
        return {
          id: u.id, key: u.key, name: u.name, desc: u.desc,
          level, max: u.max,
          cost: level >= u.max ? null : upgradeCost(u, level),
          owned: level >= u.max,
        };
      });
    },
    buyUpgrade(id) {
      const upgrade = UPGRADES.find((u) => u.id === id);
      if (!upgrade || state.phase !== 'shop') return false;
      const level = state.upgrades[id];
      if (level >= upgrade.max) return false;
      const cost = upgradeCost(upgrade, level);
      if (state.salvage < cost) return false;
      state.salvage -= cost;
      state.upgrades[id] = level + 1;
      if (id === 'repair') state.beaconIntegrity = Math.min(BEACON.maxIntegrity, state.beaconIntegrity + 1);
      return true;
    },
    step(dt, move, aim, firing) {
      state.time += dt;
      stepParticles(dt);
      if (state.phase === 'title') {
        // Ambient drift: the title drones circle the beacon, never attacking.
        for (const enemy of state.enemies) {
          enemy.angle += dt * 0.4;
          const r = 240 + Math.sin(state.time * 0.6 + enemy.wobble) * 30;
          enemy.x = BEACON.x + Math.cos(enemy.angle) * r;
          enemy.y = BEACON.y + Math.sin(enemy.angle) * r;
        }
        return EVENT_NONE;
      }
      if (state.phase === 'shop') {
        state.shopTimer -= dt;
        // Salvage still drifts in during the shop.
        for (let i = state.salvageDrops.length - 1; i >= 0; i -= 1) {
          const drop = state.salvageDrops[i];
          drop.life -= dt;
          if (drop.life <= 0) state.salvageDrops.splice(i, 1);
        }
        if (state.shopTimer <= 0) this.nextWave();
        return EVENT_NONE;
      }
      if (state.phase === 'play') return stepPlay(dt, move, aim, firing);
      return EVENT_NONE;
    },
  };
}
