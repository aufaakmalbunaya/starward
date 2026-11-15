// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred; the margin is
// filled with the backdrop colour. Deep indigo space, a warm amber beacon, a
// cyan ship: the whole game reads at a glance, even shrunk to a contact sheet.
import { BEACON, ENEMY_TYPES, FIELD, FONT, PALETTE, SALVAGE, SHIP, WIN_WAVE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_SHOP = 'shop';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WON = 'won';

function shapePath(context, shape, radius) {
  context.beginPath();
  if (shape === 'tri') {
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
  } else if (shape === 'square') {
    context.rect(-radius * 0.8, -radius * 0.8, radius * 1.6, radius * 1.6);
    return;
  } else if (shape === 'star') {
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? radius : radius * 0.5;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
  } else {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
  }
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.ratio = ratio;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  window.addEventListener('resize', resize);
  resize();

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawStars(state) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.spaceTop);
    gradient.addColorStop(1, PALETTE.spaceBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of state.stars) {
      const parallax = 1 - star.layer * 0.12;
      const sx = ((star.x * parallax) % FIELD.width + FIELD.width) % FIELD.width;
      const twinkle = 0.55 + 0.45 * Math.sin(state.time * 1.5 + star.twinkle);
      context.globalAlpha = twinkle * (0.4 + star.layer * 0.25);
      context.fillStyle = star.layer === 2 ? '#cfe6ff' : '#8fa3d9';
      context.fillRect(sx, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;
    // A faint nebula wash so the field is never flat black.
    const nebula = context.createRadialGradient(200, 140, 20, 200, 140, 320);
    nebula.addColorStop(0, 'rgba(80, 60, 160, 0.20)');
    nebula.addColorStop(1, 'rgba(80, 60, 160, 0)');
    context.fillStyle = nebula;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const nebula2 = context.createRadialGradient(1120, 600, 20, 1120, 600, 300);
    nebula2.addColorStop(0, 'rgba(20, 120, 140, 0.14)');
    nebula2.addColorStop(1, 'rgba(20, 120, 140, 0)');
    context.fillStyle = nebula2;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawBeacon(state) {
    const pulse = 1 + 0.06 * Math.sin(state.time * 2.4);
    const integrity = state.beaconIntegrity;
    const glow = context.createRadialGradient(BEACON.x, BEACON.y, 4, BEACON.x, BEACON.y, 130);
    const alpha = integrity > 0 ? 0.5 : 0.12;
    glow.addColorStop(0, `rgba(255, 179, 71, ${alpha})`);
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    context.fillStyle = glow;
    context.fillRect(BEACON.x - 140, BEACON.y - 140, 280, 280);

    context.save();
    context.translate(BEACON.x, BEACON.y);
    context.rotate(state.time * 0.5);
    context.strokeStyle = 'rgba(255, 179, 71, 0.55)';
    context.lineWidth = 2;
    context.setLineDash([14, 10]);
    context.beginPath();
    context.arc(0, 0, BEACON.radius + 16, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.rotate(-state.time * 0.9);
    context.strokeStyle = 'rgba(255, 230, 163, 0.4)';
    context.beginPath();
    context.arc(0, 0, BEACON.radius + 26, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    context.fillStyle = PALETTE.beacon;
    context.beginPath();
    context.arc(BEACON.x, BEACON.y, BEACON.radius * pulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.beaconCore;
    context.beginPath();
    context.arc(BEACON.x, BEACON.y, BEACON.radius * 0.55 * pulse, 0, Math.PI * 2);
    context.fill();
    // Integrity pips under the beacon.
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = i < integrity ? PALETTE.beacon : 'rgba(255, 93, 93, 0.7)';
      context.beginPath();
      context.arc(BEACON.x - 22 + i * 22, BEACON.y + BEACON.radius + 22, 6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawShip(state) {
    const ship = state.ship;
    if (ship.invuln > 0 && Math.floor(state.time * 14) % 2 === 0) return; // blink while invulnerable
    context.save();
    context.translate(ship.x, ship.y);
    context.rotate(ship.angle);
    // Engine flame.
    const flame = 10 + Math.random() * 0; // flame length is steady; speed shows in the trail
    context.fillStyle = '#ff9f43';
    context.beginPath();
    context.moveTo(-12, 5);
    context.lineTo(-12 - flame, 0);
    context.lineTo(-12, -5);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.ship;
    context.beginPath();
    context.moveTo(20, 0);
    context.lineTo(-12, 11);
    context.lineTo(-6, 0);
    context.lineTo(-12, -11);
    context.closePath();
    context.fill();
    context.fillStyle = '#e8feff';
    context.beginPath();
    context.arc(4, 0, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Aim reticle at the mouse is drawn by the caller through state.aim.
    if (state.aim) {
      context.strokeStyle = 'rgba(174, 246, 255, 0.8)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(state.aim.x, state.aim.y, 10, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(state.aim.x - 15, state.aim.y);
      context.lineTo(state.aim.x - 6, state.aim.y);
      context.moveTo(state.aim.x + 6, state.aim.y);
      context.lineTo(state.aim.x + 15, state.aim.y);
      context.moveTo(state.aim.x, state.aim.y - 15);
      context.lineTo(state.aim.x, state.aim.y - 6);
      context.moveTo(state.aim.x, state.aim.y + 6);
      context.lineTo(state.aim.x, state.aim.y + 15);
      context.stroke();
    }
  }

  function drawEnemies(state) {
    for (const enemy of state.enemies) {
      const def = ENEMY_TYPES[enemy.type];
      context.save();
      context.translate(enemy.x, enemy.y);
      context.rotate(enemy.angle);
      context.shadowColor = def.color;
      context.shadowBlur = 14;
      context.fillStyle = def.color;
      shapePath(context, def.shape, def.radius);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = 'rgba(7, 10, 28, 0.85)';
      context.beginPath();
      context.arc(0, 0, def.radius * 0.42, 0, Math.PI * 2);
      context.fill();
      if (def.hp > 1) {
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(0, 0, def.radius * 0.2, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
      // Health ticks over tough enemies.
      if (enemy.hp < def.hp) {
        const w = def.radius * 2;
        context.fillStyle = 'rgba(255,255,255,0.25)';
        context.fillRect(enemy.x - w / 2, enemy.y - def.radius - 12, w, 4);
        context.fillStyle = PALETTE.danger;
        context.fillRect(enemy.x - w / 2, enemy.y - def.radius - 12, w * (enemy.hp / def.hp), 4);
      }
    }
  }

  function drawBullets(state) {
    context.fillStyle = PALETTE.bullet;
    context.shadowColor = '#4de8ff';
    context.shadowBlur = 8;
    for (const bullet of state.bullets) {
      context.beginPath();
      context.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    context.shadowBlur = 0;
  }

  function drawSalvage(state) {
    for (const drop of state.salvageDrops) {
      const blink = drop.life < 2 ? (Math.floor(state.time * 8) % 2 === 0 ? 0.35 : 1) : 1;
      context.globalAlpha = blink;
      context.fillStyle = PALETTE.salvage;
      context.save();
      context.translate(drop.x, drop.y);
      context.rotate(state.time * 3);
      context.fillRect(-5, -5, 10, 10);
      context.restore();
      context.globalAlpha = 1;
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
    for (const f of state.floaters) {
      context.globalAlpha = Math.max(0, f.life);
      text(f.text, f.x, f.y, 18, f.color, 'center', '700 ');
      context.globalAlpha = 1;
    }
  }

  function drawHud(state, best) {
    // Top bar: score left, wave centre, salvage right.
    text(`SCORE ${state.score}`, 24, 40, 26, PALETTE.text, 'left', '700 ');
    text(`WAVE ${Math.max(1, state.wave)} / ${WIN_WAVE}`, FIELD.width / 2, 40, 26, PALETTE.wave, 'center', '700 ');
    text(`SALVAGE ${state.salvage}`, FIELD.width - 24, 40, 26, PALETTE.salvage, 'right', '700 ');
    // Beacon integrity and hull, bottom left.
    text('BEACON', 24, FIELD.height - 46, 16, PALETTE.muted, 'left', '700 ');
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = i < state.beaconIntegrity ? PALETTE.beacon : 'rgba(255, 93, 93, 0.35)';
      context.beginPath();
      context.arc(112 + i * 26, FIELD.height - 52, 9, 0, Math.PI * 2);
      context.fill();
    }
    text('HULL', 24, FIELD.height - 16, 16, PALETTE.muted, 'left', '700 ');
    for (let i = 0; i < SHIP.maxHull; i += 1) {
      context.fillStyle = i < state.ship.hull ? PALETTE.ship : 'rgba(77, 232, 255, 0.25)';
      context.beginPath();
      context.arc(112 + i * 26, FIELD.height - 22, 9, 0, Math.PI * 2);
      context.fill();
    }
    text(`BEST ${Math.max(best, state.score)}`, FIELD.width - 24, FIELD.height - 16, 16, PALETTE.muted, 'right');
    text('M mute · P pause', FIELD.width - 24, FIELD.height - 46, 14, PALETTE.muted, 'right');
    // Wave banner across the middle.
    if (state.bannerTimer > 0 && state.waveBanner) {
      context.globalAlpha = Math.min(1, state.bannerTimer);
      text(state.waveBanner, FIELD.width / 2, 120, 34, PALETTE.text, 'center', '800 ');
      context.globalAlpha = 1;
    }
    // Kills so far, small, under the score.
    text(`KILLS ${state.kills}`, 24, 66, 15, PALETTE.muted, 'left');
  }

  function panel(width, height) {
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(x, y, width, height, 16);
    context.fill();
    context.stroke();
    return { x, y, width, height };
  }

  function drawTitle(state, best) {
    const p = panel(680, 430);
    text('STARWARD', FIELD.width / 2, p.y + 92, 72, PALETTE.text, 'center', '800 ');
    text('DEFEND THE LAST BEACON', FIELD.width / 2, p.y + 136, 22, PALETTE.beacon, 'center', '700 ');
    text('Enemies spiral in from the dark. If they reach the beacon,', FIELD.width / 2, p.y + 196, 19, PALETTE.text, 'center');
    text('it loses integrity. Three hits and the light goes out.', FIELD.width / 2, p.y + 222, 19, PALETTE.text, 'center');
    text('WASD / arrows — fly      Mouse — aim      Click / hold — fire', FIELD.width / 2, p.y + 272, 19, PALETTE.ship, 'center', '700 ');
    text('Collect salvage between waves. Spend it on upgrades: 1 fire rate,', FIELD.width / 2, p.y + 306, 17, PALETTE.muted, 'center');
    text('2 damage, 3 speed, 4 repair the beacon. Survive all 10 waves to win.', FIELD.width / 2, p.y + 330, 17, PALETTE.muted, 'center');
    text('CLICK OR PRESS SPACE TO LAUNCH', FIELD.width / 2, p.y + 386, 20, PALETTE.wave, 'center', '800 ');
    if (best > 0) text(`BEST SCORE ${best}`, FIELD.width / 2, p.y + 416, 16, PALETTE.muted, 'center');
  }

  function drawShop(state, shopItems) {
    const p = panel(720, 440);
    text(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, p.y + 64, 36, PALETTE.wave, 'center', '800 ');
    text(`Score ${state.score}  ·  Salvage ${state.salvage}  ·  Next wave starts in ${Math.ceil(state.shopTimer)}s (N to skip)`, FIELD.width / 2, p.y + 100, 18, PALETTE.text, 'center');
    text('UPGRADES — press 1–4 or click a row', FIELD.width / 2, p.y + 140, 17, PALETTE.muted, 'center', '700 ');
    shopItems.forEach((item, i) => {
      const y = p.y + 168 + i * 62;
      const affordable = item.cost !== null && state.salvage >= item.cost;
      context.fillStyle = affordable ? 'rgba(77, 232, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
      context.beginPath();
      context.roundRect(p.x + 40, y, p.width - 80, 52, 10);
      context.fill();
      text(`[${item.key}]  ${item.name}`, p.x + 60, y + 32, 20, affordable ? PALETTE.text : PALETTE.muted, 'left', '700 ');
      text(item.desc, p.x + 330, y + 32, 17, PALETTE.muted, 'left');
      const right = item.owned ? 'MAXED' : `${item.cost} salvage · Lv ${item.level}/${item.max}`;
      text(right, p.x + p.width - 60, y + 32, 18, item.owned ? PALETTE.muted : affordable ? PALETTE.salvage : PALETTE.danger, 'right', '700 ');
    });
  }

  function drawPaused() {
    const p = panel(420, 200);
    text('PAUSED', FIELD.width / 2, p.y + 92, 44, PALETTE.text, 'center', '800 ');
    text('Press P or Space to keep flying', FIELD.width / 2, p.y + 140, 18, PALETTE.muted, 'center');
  }

  function drawOver(state, best, won) {
    const p = panel(620, 420);
    text(won ? 'THE BEACON STILL BURNS' : 'GAME OVER', FIELD.width / 2, p.y + 84, 48, won ? PALETTE.wave : PALETTE.danger, 'center', '800 ');
    text(state.overReason, FIELD.width / 2, p.y + 128, 19, PALETTE.text, 'center');
    text(`SCORE ${state.score}`, FIELD.width / 2, p.y + 196, 34, PALETTE.text, 'center', '700 ');
    text(`Waves survived ${won ? WIN_WAVE : Math.max(0, state.wave - 1)}  ·  Enemies destroyed ${state.kills}  ·  Best ${Math.max(best, state.score)}`, FIELD.width / 2, p.y + 238, 18, PALETTE.muted, 'center');
    if (won) text('You held all ten waves. The last light in the dark is yours.', FIELD.width / 2, p.y + 272, 17, PALETTE.beacon, 'center');
    text('CLICK OR PRESS SPACE TO FLY AGAIN', FIELD.width / 2, p.y + 340, 20, PALETTE.wave, 'center', '800 ');
    text('STARWARD — defend the last beacon', FIELD.width / 2, p.y + 386, 15, PALETTE.muted, 'center');
  }

  return {
    resize,
    toField(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
      const ox = (rect.width - FIELD.width * scale) / 2;
      const oy = (rect.height - FIELD.height * scale) / 2;
      return {
        x: (clientX - ox) / scale,
        y: (clientY - oy) / scale,
      };
    },
    draw(state, screen, best, shopItems) {
      resize();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = PALETTE.backdrop;
      context.fillRect(0, 0, canvas.width, canvas.height);
      const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
      const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
      context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
      drawStars(state);
      drawBeacon(state);
      drawSalvage(state);
      drawEnemies(state);
      drawBullets(state);
      drawShip(state);
      drawParticles(state);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      if (screen === SCREEN_SHOP) {
        drawHud(state, best);
        drawShop(state, shopItems || []);
      }
      if (screen === SCREEN_PAUSED) drawPaused();
      if (screen === SCREEN_OVER || screen === SCREEN_WON) drawOver(state, best, screen === SCREEN_WON);
      context.setTransform(1, 0, 0, 1, 0, 0);
    },
  };
}
