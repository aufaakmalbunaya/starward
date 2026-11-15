// Synthesized sound only: every effect and the music loop are built from WebAudio
// oscillators and filtered noise, so the game ships no audio files at all.
import { MUTE_KEY } from './config.js';

const MUSIC_NOTES = [110, 130.81, 164.81, 196, 164.81, 130.81, 98, 123.47];
const MUSIC_STEP = 0.22;

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!context || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  function startMusic() {
    if (!context || musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (muted || !context) return;
      const note = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      tone(note, MUSIC_STEP * 1.8, 'triangle', 0.07);
      if (musicStep % 4 === 0) tone(note / 2, MUSIC_STEP * 3, 'sine', 0.09);
      musicStep += 1;
    }, MUSIC_STEP * 1000);
  }

  return {
    get muted() {
      return muted;
    },
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
      startMusic();
    },
    toggleMute() {
      muted = !muted;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Storage can be off: the mute then lasts this visit only.
      }
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot() {
      tone(880, 0.09, 'square', 0.08, 220);
    },
    explosion() {
      noise(0.28, 0.25, 900);
      tone(120, 0.25, 'sine', 0.18, 40);
    },
    hit() {
      tone(180, 0.08, 'sawtooth', 0.1, 90);
    },
    pickup() {
      tone(660, 0.07, 'sine', 0.1, 990);
    },
    alarm() {
      tone(440, 0.16, 'sawtooth', 0.14, 330);
      tone(330, 0.16, 'sawtooth', 0.14, 440);
    },
    waveHorn() {
      tone(196, 0.5, 'triangle', 0.14, 392);
      tone(294, 0.5, 'triangle', 0.08, 294);
    },
    buy() {
      tone(523, 0.1, 'sine', 0.12);
      window.setTimeout(() => tone(784, 0.14, 'sine', 0.12), 90);
    },
    denied() {
      tone(160, 0.14, 'square', 0.1, 110);
    },
  };
}
