// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred; the margin is filled with the
// backdrop colour. Deep green forest, bright orange fire, a blue pond: the whole game
// reads at a glance, even shrunk to a contact sheet.
import { CELL, COLS, FIELD, FONT, GRID_Y, HUD_H, PALETTE, ROWS, UPGRADE_SECONDS, WAVES } from './config.js';
import { TYPE_BARE, TYPE_GRASS, TYPE_ROCK, TYPE_STATION, TYPE_TREE, TYPE_WATER } from './forest.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WON = 'won';

/** The three upgrade cards' rectangles, so the main loop can hit-test clicks. */
export function upgradeCardRect(index) {
  const w = 300;
  const h = 200;
  const gap = 36;
  const total = 3 * w + 2 * gap;
  const x = (FIELD.width - total) / 2 + index * (w + gap);
  return { x, y: 268, w, h };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
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
  resize();
  window.addEventListener('resize', resize);

  function toField(clientX, clientY) {
    return {
      x: (clientX * view.ratio - view.x) / view.scale,
      y: (clientY * view.ratio - view.y) / view.scale,
    };
  }

  function text(str, x, y, size, color, align = 'left', weight = 600) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function shadeColor(base, dark, light, shade) {
    return shade < 0.33 ? dark : shade < 0.66 ? base : light;
  }

  function drawGround(state) {
    const time = state.time;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const cell = state.forest.cells[row * COLS + col];
        const x = col * CELL;
        const y = GRID_Y + row * CELL;
        if (cell.type === TYPE_WATER) {
          ctx.fillStyle = PALETTE.waterDeep;
          ctx.fillRect(x, y, CELL, CELL);
          ctx.fillStyle = PALETTE.water;
          const wave = Math.sin(time * 1.6 + col * 1.3 + row * 0.7) * 2;
          ctx.fillRect(x + 3, y + 8 + wave, CELL - 6, 3);
          ctx.fillRect(x + 8, y + 20 - wave, CELL - 16, 3);
          continue;
        }
        if (cell.type === TYPE_ROCK) {
          ctx.fillStyle = shadeColor(PALETTE.rock, PALETTE.rockDark, '#6d7684', cell.shade);
          ctx.fillRect(x, y, CELL, CELL);
          ctx.fillStyle = PALETTE.rockDark;
          ctx.beginPath();
          ctx.arc(x + 10 + cell.shade * 12, y + 12 + cell.shade * 8, 7, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        if (cell.type === TYPE_BARE) {
          ctx.fillStyle = shadeColor(PALETTE.bare, PALETTE.bareDark, '#7d5a3c', cell.shade);
          ctx.fillRect(x, y, CELL, CELL);
          ctx.fillStyle = PALETTE.bareDark;
          ctx.fillRect(x + 6 + cell.shade * 14, y + 8 + cell.shade * 12, 3, 3);
          ctx.fillRect(x + 18 - cell.shade * 8, y + 20, 3, 3);
          continue;
        }
        if (cell.burnt) {
          ctx.fillStyle = cell.shade < 0.5 ? PALETTE.burnt : PALETTE.burntAsh;
          ctx.fillRect(x, y, CELL, CELL);
          ctx.fillStyle = '#3a3230';
          ctx.fillRect(x + 5 + cell.shade * 16, y + 6 + cell.shade * 14, 2, 2);
          continue;
        }
        // Living ground: grass, or a pine on grass.
        ctx.fillStyle = shadeColor(PALETTE.grass, PALETTE.grassDark, '#35703c', cell.shade);
        ctx.fillRect(x, y, CELL, CELL);
        if (cell.type === TYPE_TREE) {
          const cx = x + CELL / 2;
          ctx.fillStyle = '#5d3f28';
          ctx.fillRect(cx - 2, y + 22, 4, 8);
          ctx.fillStyle = shadeColor(PALETTE.tree, PALETTE.treeDark, PALETTE.treeLight, cell.shade);
          ctx.beginPath();
          ctx.moveTo(cx, y + 3);
          ctx.lineTo(cx - 11, y + 20);
          ctx.lineTo(cx + 11, y + 20);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = shadeColor(PALETTE.treeLight, PALETTE.tree, PALETTE.treeDark, cell.shade);
          ctx.beginPath();
          ctx.moveTo(cx, y + 9);
          ctx.lineTo(cx - 8, y + 24);
          ctx.lineTo(cx + 8, y + 24);
          ctx.closePath();
          ctx.fill();
          if (cell.fireproof) {
            ctx.fillStyle = '#bfe8ff';
            ctx.beginPath();
            ctx.arc(cx + 8, y + 6, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (cell.wet > 0) {
          ctx.fillStyle = 'rgba(47, 127, 194, 0.28)';
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
    }
  }

  function drawFire(state) {
    const time = state.time;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const cell = state.forest.cells[row * COLS + col];
        if (cell.fire <= 0) continue;
        const x = col * CELL + CELL / 2;
        const y = GRID_Y + row * CELL + CELL / 2;
        const flick = Math.sin(time * 9 + col * 1.7 + row * 2.3) * 3 + Math.sin(time * 17 + col * 3.1) * 2;
        ctx.fillStyle = 'rgba(255, 122, 26, 0.20)';
        ctx.beginPath();
        ctx.arc(x, y, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.fireEdge;
        ctx.beginPath();
        ctx.moveTo(x - 11, y + 10);
        ctx.lineTo(x - 4 + flick * 0.4, y - 12 - flick);
        ctx.lineTo(x + 2, y + 2);
        ctx.lineTo(x + 8 + flick * 0.3, y - 8 - flick * 0.6);
        ctx.lineTo(x + 11, y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PALETTE.fireMid;
        ctx.beginPath();
        ctx.moveTo(x - 7, y + 10);
        ctx.lineTo(x - 2 + flick * 0.3, y - 6 - flick * 0.7);
        ctx.lineTo(x + 6, y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PALETTE.fireCore;
        ctx.beginPath();
        ctx.arc(x, y + 5, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawStation(state) {
    const x = 19 * CELL;
    const y = GRID_Y + 9 * CELL;
    const burning = state.forest.at(19, 9).fire > 0 || state.forest.at(20, 9).fire > 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 32, y + 58, 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.stationWall;
    ctx.fillRect(x + 4, y + 20, 56, 40);
    ctx.fillStyle = PALETTE.stationRoof;
    ctx.beginPath();
    ctx.moveTo(x, y + 22);
    ctx.lineTo(x + 32, y + 2);
    ctx.lineTo(x + 64, y + 22);
    ctx.closePath();
    ctx.fill();
    const glow = 0.6 + 0.4 * Math.sin(state.time * 3);
    ctx.fillStyle = burning ? '#ff5a2e' : PALETTE.stationLight;
    ctx.globalAlpha = burning ? 1 : glow;
    ctx.fillRect(x + 14, y + 32, 12, 14);
    ctx.fillRect(x + 38, y + 32, 12, 14);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(x + 28, y + 40, 8, 20);
    text('RANGER', x + 32, y + 16, 9, PALETTE.text, 'center', 700);
  }

  function drawPlayer(state) {
    const p = state.player;
    const bob = p.moving ? Math.sin(state.time * 14) * 2 : 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 13, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs.
    ctx.fillStyle = PALETTE.playerPants;
    ctx.fillRect(p.x - 7, p.y + 4 + bob, 5, 9);
    ctx.fillRect(p.x + 2, p.y + 4 - bob, 5, 9);
    // Jacket.
    ctx.fillStyle = PALETTE.playerJacket;
    roundRect(ctx, p.x - 10, p.y - 8, 20, 14, 5);
    ctx.fill();
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(p.x - 10, p.y - 2, 20, 2);
    // Head and helmet.
    ctx.fillStyle = PALETTE.playerSkin;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 13, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerHelmet;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 14, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(p.x - 9, p.y - 15, 18, 3);
    // The spade, swinging while digging.
    if (p.digProgress > 0) {
      const swing = Math.sin(state.time * 20) * 0.4;
      ctx.strokeStyle = '#c9a06a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x + 8, p.y);
      ctx.lineTo(p.x + 16, p.y + 8 + swing * 8);
      ctx.stroke();
    }
  }

  function drawHud(state, best) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, FIELD.width, HUD_H);
    ctx.fillStyle = PALETTE.hudLine;
    ctx.fillRect(0, HUD_H - 2, FIELD.width, 2);
    text('EMBERLINE', 16, 28, 21, PALETTE.text, 'left', 800);
    text('HOLD THE LINE', 16, 48, 11, PALETTE.muted, 'left', 600);
    // Wave pips.
    text('WAVE', 196, 28, 12, PALETTE.muted, 'left', 700);
    for (let i = 0; i < WAVES; i += 1) {
      const cx = 252 + i * 24;
      const cy = 32;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      if (i < state.wave - 1 || (state.phase === 'won' && i < WAVES)) {
        ctx.fillStyle = PALETTE.gold;
        ctx.fill();
      } else if (i === state.wave - 1) {
        ctx.fillStyle = Math.sin(state.time * 5) > 0 ? PALETTE.fireMid : PALETTE.fireEdge;
        ctx.fill();
      } else {
        ctx.strokeStyle = PALETTE.muted;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    text(`${Math.max(1, state.wave)}/${WAVES}`, 252, 52, 11, PALETTE.muted, 'left', 600);
    // Wind compass.
    const wx = 470;
    const wy = 32;
    ctx.strokeStyle = PALETTE.muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(wx, wy, 18, 0, Math.PI * 2);
    ctx.stroke();
    const angle = Math.atan2(state.wind.dy, state.wind.dx);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wx - Math.cos(angle) * 8, wy - Math.sin(angle) * 8);
    ctx.lineTo(wx + Math.cos(angle) * 13, wy + Math.sin(angle) * 13);
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(wx + Math.cos(angle) * 13, wy + Math.sin(angle) * 13, 3, 0, Math.PI * 2);
    ctx.fill();
    text(`WIND ${state.wind.name}`, wx + 26, 28, 12, PALETTE.text, 'left', 700);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < state.wind.strength ? PALETTE.fireMid : '#2c4a35';
      ctx.fillRect(wx + 26 + i * 14, 36, 10, 8);
    }
    // Water tank.
    text('WATER', 620, 22, 11, PALETTE.muted, 'left', 700);
    ctx.fillStyle = '#0a1a26';
    roundRect(ctx, 620, 28, 150, 14, 4);
    ctx.fill();
    const tankFrac = state.water / state.mods.tankMax;
    ctx.fillStyle = tankFrac < 0.3 ? PALETTE.danger : PALETTE.water;
    if (tankFrac > 0) {
      roundRect(ctx, 620, 28, Math.max(8, 150 * tankFrac), 14, 4);
      ctx.fill();
    }
    text(`${Math.ceil(state.water)}`, 778, 40, 12, PALETTE.text, 'left', 700);
    // Forest left standing.
    const alive = state.forest.treesAlive();
    const total = Math.max(1, state.treesStart);
    const pct = Math.round((alive / total) * 100);
    text('FOREST', 830, 22, 11, PALETTE.muted, 'left', 700);
    text(`${pct}%`, 830, 42, 17, pct < 40 ? PALETTE.danger : PALETTE.text, 'left', 800);
    // Score.
    text('SCORE', 960, 22, 11, PALETTE.muted, 'left', 700);
    text(String(state.score), 960, 42, 17, PALETTE.text, 'left', 800);
    text(`BEST ${best}`, 1120, 42, 13, PALETTE.muted, 'left', 600);
    // Station burning alarm.
    if (state.stationBurn > 0) {
      const blink = Math.sin(state.time * 10) > 0;
      text('STATION BURNING — DOUSE IT!', FIELD.width / 2, 96, 20, blink ? PALETTE.danger : '#ffb3a0', 'center', 800);
    }
    // Wave banner.
    if (state.bannerTime > 0) {
      ctx.globalAlpha = Math.min(1, state.bannerTime);
      const bw = 560;
      ctx.fillStyle = 'rgba(10, 20, 13, 0.85)';
      roundRect(ctx, (FIELD.width - bw) / 2, 118, bw, 46, 10);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelLine;
      ctx.lineWidth = 1.5;
      roundRect(ctx, (FIELD.width - bw) / 2, 118, bw, 46, 10);
      ctx.stroke();
      text(state.banner, FIELD.width / 2, 148, 20, PALETTE.gold, 'center', 800);
      ctx.globalAlpha = 1;
    }
  }

  function drawHint(str) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, FIELD.height - 16, FIELD.width, 16);
    text(str, FIELD.width / 2, FIELD.height - 4, 11, PALETTE.muted, 'center', 600);
  }

  function overlay(alpha) {
    ctx.fillStyle = `rgba(6, 12, 8, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function statsLines(state) {
    const alive = state.forest.treesAlive();
    const total = Math.max(1, state.treesStart);
    return [
      `Waves held: ${state.won ? WAVES : Math.max(0, state.wave - 1)} of ${WAVES}`,
      `Fires put out: ${state.extinguished}`,
      `Firebreaks dug: ${state.dug}`,
      `Trees still standing: ${alive} of ${total} (${Math.round((alive / total) * 100)}%)`,
      `Trees saved bonus: +${state.treesBonus}`,
      `Score: ${state.score}`,
    ];
  }

  function drawTitle(state, best) {
    overlay(0.55);
    text('EMBERLINE', FIELD.width / 2, 190, 84, PALETTE.gold, 'center', 800);
    text('A wildfire is sweeping the forest toward the ranger station.', FIELD.width / 2, 232, 21, PALETTE.text, 'center', 600);
    text('Dig firebreaks. Drop water. Hold the line for seven waves.', FIELD.width / 2, 262, 21, PALETTE.text, 'center', 600);
    const pw = 620;
    const px = (FIELD.width - pw) / 2;
    ctx.fillStyle = 'rgba(20, 38, 27, 0.92)';
    roundRect(ctx, px, 300, pw, 132, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelLine;
    ctx.lineWidth = 1.5;
    roundRect(ctx, px, 300, pw, 132, 12);
    ctx.stroke();
    text('HOW TO PLAY', px + 24, 330, 13, PALETTE.gold, 'left', 800);
    text('WASD or arrows — run through the forest', px + 24, 358, 16, PALETTE.text, 'left', 600);
    text('Hold SPACE — dig a firebreak under your feet', px + 24, 382, 16, PALETTE.text, 'left', 600);
    text('K or click — splash water where the fire is', px + 24, 406, 16, PALETTE.text, 'left', 600);
    text('Stand by the pond to refill — and mind which way the wind blows', px + 24, 430, 16, PALETTE.text, 'left', 600);
    if (best > 0) text(`BEST SCORE ${best}`, FIELD.width / 2, 470, 16, PALETTE.muted, 'center', 700);
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) text('PRESS SPACE OR CLICK TO START', FIELD.width / 2, 520, 20, PALETTE.text, 'center', 800);
  }

  function drawUpgrade(state, ui) {
    overlay(0.72);
    text(`WAVE ${state.wave} CLEAR — CHOOSE ONE`, FIELD.width / 2, 200, 30, PALETTE.gold, 'center', 800);
    text('The fire is out for now. Pick an upgrade, then face the next wave.', FIELD.width / 2, 232, 17, PALETTE.text, 'center', 600);
    const choices = ui.upgrades || [];
    choices.forEach((choice, i) => {
      const r = upgradeCardRect(i);
      ctx.fillStyle = PALETTE.panel;
      roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelLine;
      ctx.lineWidth = 2;
      roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(r.x + 30, r.y + 32, 15, 0, Math.PI * 2);
      ctx.fill();
      text(choice.key, r.x + 30, r.y + 38, 17, '#14261b', 'center', 800);
      text(choice.name, r.x + 56, r.y + 38, 20, PALETTE.text, 'left', 800);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 15px ${FONT}`;
      ctx.textAlign = 'left';
      const words = choice.desc.split(' ');
      let line = '';
      let ly = r.y + 84;
      for (const word of words) {
        if ((line + word).length > 26) {
          ctx.fillText(line.trim(), r.x + 24, ly);
          line = '';
          ly += 22;
        }
        line += `${word} `;
      }
      if (line.trim()) ctx.fillText(line.trim(), r.x + 24, ly);
    });
    text('Press 1, 2 or 3 — or click a card', FIELD.width / 2, 520, 16, PALETTE.muted, 'center', 600);
    const left = Math.max(0, Math.ceil(UPGRADE_SECONDS - (state.upgradeTime || 0)));
    text(`Or wait — the first card is taken in ${left}s`, FIELD.width / 2, 546, 14, PALETTE.muted, 'center', 600);
  }

  function drawPaused() {
    overlay(0.6);
    text('PAUSED', FIELD.width / 2, 330, 48, PALETTE.text, 'center', 800);
    text('Press P or SPACE to keep fighting the fire', FIELD.width / 2, 372, 18, PALETTE.muted, 'center', 600);
  }

  function drawEnd(state, won) {
    overlay(0.72);
    text(won ? 'THE FOREST STANDS' : 'THE STATION BURNED', FIELD.width / 2, 200, 44, won ? PALETTE.gold : PALETTE.danger, 'center', 800);
    text(state.overReason, FIELD.width / 2, 238, 19, PALETTE.text, 'center', 600);
    const lines = statsLines(state);
    lines.forEach((line, i) => {
      text(line, FIELD.width / 2, 296 + i * 30, 18, i === lines.length - 1 ? PALETTE.gold : PALETTE.text, 'center', i === lines.length - 1 ? 800 : 600);
    });
    const blink = Math.sin(state.time * 4) > -0.2;
    if (blink) text('PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, 520, 20, PALETTE.text, 'center', 800);
  }

  return {
    toField,
    draw(state, screen, best, ui = {}) {
      const ratio = view.ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = PALETTE.backdrop;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(ratio * view.scale, 0, 0, ratio * view.scale, ratio * view.x, ratio * view.y);
      if (state.shake > 0) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      drawGround(state);
      drawStation(state);
      drawPlayer(state);
      drawFire(state);
      state.particles.draw(ctx);
      for (const f of state.floaters) {
        ctx.globalAlpha = Math.max(0, f.life);
        text(f.text, f.x, f.y, 15, f.color, 'center', 800);
        ctx.globalAlpha = 1;
      }
      drawHud(state, best);
      if (screen === SCREEN_TITLE) {
        drawTitle(state, best);
        drawHint('SPACE or click to start  ·  M mute');
      } else if (screen === SCREEN_UPGRADE) {
        drawUpgrade(state, ui);
        drawHint('Press 1, 2 or 3 — or click a card');
      } else if (screen === SCREEN_PAUSED) {
        drawPaused();
        drawHint('P or SPACE to continue  ·  M mute');
      } else if (screen === SCREEN_OVER) {
        drawEnd(state, false);
        drawHint('SPACE or click to try again');
      } else if (screen === SCREEN_WON) {
        drawEnd(state, true);
        drawHint('SPACE or click to play again');
      } else {
        drawHint('WASD move  ·  hold SPACE dig  ·  K or click splash water  ·  P pause  ·  M mute');
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
  };
}
