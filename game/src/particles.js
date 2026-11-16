// Particles: embers, smoke, splashes and dust. Visual only, never part of the rules:
// the pool is allocated once at boot and reused, so the game never allocates mid-frame.
export const KIND_EMBER = 0;
export const KIND_SMOKE = 1;
export const KIND_SPLASH = 2;
export const KIND_DUST = 3;

const POOL = 240;

export function createParticles(random) {
  const items = [];
  for (let i = 0; i < POOL; i += 1) {
    items.push({ active: false, kind: KIND_EMBER, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2 });
  }
  function free() {
    for (const item of items) if (!item.active) return item;
    return null;
  }
  function spawn(kind, x, y, vx, vy, life, size) {
    const item = free();
    if (!item) return;
    item.active = true;
    item.kind = kind;
    item.x = x;
    item.y = y;
    item.vx = vx;
    item.vy = vy;
    item.life = life;
    item.max = life;
    item.size = size;
  }
  return {
    items,
    ember(x, y, windX) {
      spawn(KIND_EMBER, x, y, windX * (20 + random() * 30) + (random() - 0.5) * 20, -30 - random() * 40, 0.8 + random() * 0.7, 2 + random() * 2);
    },
    smoke(x, y) {
      spawn(KIND_SMOKE, x, y, (random() - 0.5) * 12, -22 - random() * 18, 1.6 + random() * 1.2, 5 + random() * 5);
    },
    splash(x, y) {
      for (let i = 0; i < 10; i += 1) {
        const angle = random() * Math.PI * 2;
        const speed = 40 + random() * 90;
        spawn(KIND_SPLASH, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 30, 0.4 + random() * 0.3, 2 + random() * 2);
      }
    },
    dust(x, y) {
      for (let i = 0; i < 6; i += 1) {
        spawn(KIND_DUST, x + (random() - 0.5) * 20, y + (random() - 0.5) * 10, (random() - 0.5) * 30, -10 - random() * 20, 0.5 + random() * 0.4, 2 + random() * 2);
      }
    },
    step(dt) {
      for (const item of items) {
        if (!item.active) continue;
        item.life -= dt;
        if (item.life <= 0) {
          item.active = false;
          continue;
        }
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        if (item.kind === KIND_SMOKE) {
          item.vy -= 6 * dt;
          item.size += 6 * dt;
        } else if (item.kind === KIND_EMBER) {
          item.vy -= 12 * dt;
        } else if (item.kind === KIND_SPLASH) {
          item.vy += 160 * dt;
        }
      }
    },
    draw(ctx) {
      for (const item of items) {
        if (!item.active) continue;
        const t = item.life / item.max;
        if (item.kind === KIND_EMBER) {
          ctx.globalAlpha = t;
          ctx.fillStyle = t > 0.5 ? '#ffd23e' : '#ff8a1e';
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.size * t + 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.kind === KIND_SMOKE) {
          ctx.globalAlpha = t * 0.35;
          ctx.fillStyle = '#8a8f98';
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.kind === KIND_SPLASH) {
          ctx.globalAlpha = t;
          ctx.fillStyle = '#7ec8f2';
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.size * t + 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = t * 0.8;
          ctx.fillStyle = '#a9805a';
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.size * t + 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}
