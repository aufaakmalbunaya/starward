// Sound, all synthesised with the Web Audio API: no audio files, no network. Every
// call is a no-op until the first user gesture creates the context, and M mutes it.
let ctx = null;
let master = null;
let crackleGain = null;
let crackleOn = false;
let muted = false;

function ensure() {
  if (ctx) return true;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    // The fire's crackle: looped noise through a band-pass, its gain following the fire.
    const length = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;
    crackleGain = ctx.createGain();
    crackleGain.gain.value = 0;
    noise.connect(filter);
    filter.connect(crackleGain);
    crackleGain.connect(master);
    noise.start();
    crackleOn = true;
    return true;
  } catch {
    return false;
  }
}

function tone(freq, dur, type, volume, when = 0, slideTo = null) {
  if (!ensure() || muted) return;
  try {
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    // Sound never breaks the game.
  }
}

function noiseBurst(dur, volume, freq) {
  if (!ensure() || muted) return;
  try {
    const t0 = ctx.currentTime;
    const length = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  } catch {
    // Sound never breaks the game.
  }
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

/** The crackle follows how much forest is burning: 0 is silent, 1 is a roar. */
export function setCrackle(level) {
  if (!crackleOn || !crackleGain) return;
  try {
    crackleGain.gain.setTargetAtTime(Math.min(0.12, level * 0.12), ctx.currentTime, 0.2);
  } catch {
    // Sound never breaks the game.
  }
}

export const sfx = {
  click() {
    tone(660, 0.06, 'sine', 0.15);
  },
  dig() {
    noiseBurst(0.09, 0.25, 500);
    tone(120, 0.08, 'sine', 0.2, 0, 70);
  },
  splash() {
    noiseBurst(0.25, 0.3, 1200);
  },
  horn() {
    tone(220, 0.35, 'triangle', 0.25);
    tone(330, 0.4, 'triangle', 0.2, 0.12);
  },
  upgrade() {
    tone(523, 0.12, 'sine', 0.2);
    tone(659, 0.12, 'sine', 0.2, 0.09);
    tone(784, 0.2, 'sine', 0.2, 0.18);
  },
  win() {
    [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.25, 'triangle', 0.22, i * 0.13));
  },
  lose() {
    [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.3, 'triangle', 0.2, i * 0.16));
  },
};
