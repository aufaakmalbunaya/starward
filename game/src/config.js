// Starward: every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size.
export const FIELD = { width: 1280, height: 720 };
export const BEACON = { x: 640, y: 360, radius: 34, maxIntegrity: 3 };
export const STEP = 1 / 60;
export const WIN_WAVE = 10;

export const SHIP = {
  radius: 14,
  speed: 340,
  accel: 2400,
  drag: 0.86,
  fireCooldown: 0.22,
  bulletSpeed: 720,
  bulletDamage: 1,
  maxHull: 3,
  invulnerable: 1.2,
};

export const BULLET = { radius: 4, life: 1.1 };

// Enemy types: how each kind moves, how tough it is, what it is worth.
export const ENEMY_TYPES = {
  drone: { radius: 15, speed: 62, hp: 1, score: 10, salvage: 1, color: '#ff5d8f', shape: 'hex' },
  dart: { radius: 11, speed: 118, hp: 1, score: 15, salvage: 1, color: '#ff9f43', shape: 'tri' },
  brute: { radius: 24, speed: 40, hp: 3, score: 30, salvage: 3, color: '#ff4d4d', shape: 'square' },
  elite: { radius: 34, speed: 52, hp: 9, score: 100, salvage: 8, color: '#c77dff', shape: 'star' },
};

// Wave n spawns 4 + 2n enemies; the mix shifts toward faster and tougher kinds.
export function waveComposition(wave) {
  const total = 4 + wave * 2;
  const counts = { drone: 0, dart: 0, brute: 0, elite: 0 };
  for (let i = 0; i < total; i += 1) {
    if (wave >= 5 && i === total - 1) counts.elite += 1;
    else if (wave >= 3 && i % 5 === 4) counts.brute += 1;
    else if (wave >= 2 && i % 3 === 2) counts.dart += 1;
    else counts.drone += 1;
  }
  return counts;
}

export const SALVAGE = { radius: 7, magnetRadius: 130, collectRadius: 22, life: 9 };

// Between-wave shop: each upgrade, its salvage cost growth and its cap.
export const UPGRADES = [
  { id: 'fire', key: '1', name: 'Rapid Cycler', desc: '+18% fire rate', base: 4, growth: 3, max: 5 },
  { id: 'damage', key: '2', name: 'Heavy Rounds', desc: '+1 bullet damage', base: 5, growth: 4, max: 5 },
  { id: 'speed', key: '3', name: 'Ion Thrusters', desc: '+12% ship speed', base: 3, growth: 2, max: 5 },
  { id: 'repair', key: '4', name: 'Beacon Repair', desc: 'Restore 1 integrity', base: 6, growth: 4, max: 3 },
];

export const PALETTE = {
  backdrop: '#070a1c',
  spaceTop: '#0b1030',
  spaceBottom: '#05060f',
  beacon: '#ffb347',
  beaconCore: '#ffe6a3',
  ship: '#4de8ff',
  shipDark: '#1b9fc4',
  bullet: '#aef6ff',
  text: '#eef2ff',
  muted: '#9aa5c9',
  panel: 'rgba(13, 18, 46, 0.92)',
  panelEdge: '#2c3a6e',
  danger: '#ff5d5d',
  salvage: '#ffd166',
  wave: '#8affc1',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'starward.best';
export const MUTE_KEY = 'starward.muted';
