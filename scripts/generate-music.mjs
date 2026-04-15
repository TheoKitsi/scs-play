import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadMp3Encoder() {
  try {
    const bundlePath = path.resolve(__dirname, '../node_modules/lamejs/lame.all.js');
    const lameBundleSource = readFileSync(bundlePath, 'utf8');
    const lameBundleContext = {};
    vm.createContext(lameBundleContext);
    vm.runInContext(lameBundleSource, lameBundleContext);
    const encoder = lameBundleContext?.lamejs?.Mp3Encoder;
    if (typeof encoder !== 'function') {
      throw new Error('Mp3Encoder missing from lamejs bundle');
    }
    return encoder;
  } catch (error) {
    throw new Error(`Unable to load lamejs encoder: ${error.message}`);
  }
}

const Mp3Encoder = loadMp3Encoder();

const SAMPLE_RATE = 44100;
const BIT_RATE = 128;
const BEATS_PER_BAR = 4;
const MUSIC_DIR = path.resolve(__dirname, '../audio/music');

const NOTE_INDEX = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

const TRACKS = [
  {
    name: 'menu',
    bpm: 72,
    bars: 16,
    seed: 11,
    masterGain: 0.78,
    pad: { wave: 'sine', amp: 0.09, attack: 0.16, release: 0.22, panSpread: 0.5, detune: 0.0025 },
    bass: { wave: 'triangle', amp: 0.07, attack: 0.01, release: 0.12, pan: -0.08 },
    lead: { wave: 'triangle', amp: 0.065, attack: 0.01, release: 0.08 },
    arp: { wave: 'sine', amp: 0.04, attack: 0.005, release: 0.05, panSpread: 0.55 },
    drums: { kick: 0.24, snare: 0, hat: 0.06 },
    delay: { left: 0.28, right: 0.41, feedback: 0.18, mix: 0.18 },
    progression: [
      {
        chord: ['C4', 'E4', 'G4', 'B4'],
        bass: ['C2', null, 'G1', null, 'C2', null, 'G1', null],
        lead: ['E5', null, 'G5', null, 'A5', null, 'G5', 'E5'],
        arp: ['C5', null, 'G4', null, 'E5', null, 'G4', null, 'B4', null, 'G4', null, 'E5', null, 'D5', null],
        drums: { kick: [0], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['A3', 'C4', 'E4', 'G4'],
        bass: ['A1', null, 'E2', null, 'A1', null, 'E2', null],
        lead: ['C6', null, 'B5', null, 'A5', null, 'G5', 'E5'],
        arp: ['A4', null, 'E5', null, 'C5', null, 'E5', null, 'G4', null, 'E5', null, 'C5', null, 'E5', null],
        drums: { kick: [0], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['F3', 'A3', 'C4', 'E4'],
        bass: ['F1', null, 'C2', null, 'F1', null, 'C2', null],
        lead: ['A5', null, 'G5', null, 'E5', null, 'F5', 'A5'],
        arp: ['F4', null, 'C5', null, 'A4', null, 'C5', null, 'E5', null, 'C5', null, 'A4', null, 'C5', null],
        drums: { kick: [0], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['G3', 'B3', 'D4', 'E4'],
        bass: ['G1', null, 'D2', null, 'G1', null, 'D2', null],
        lead: ['B5', null, 'A5', null, 'G5', 'E5', 'D5', null],
        arp: ['G4', null, 'D5', null, 'B4', null, 'D5', null, 'E5', null, 'D5', null, 'B4', null, 'A4', null],
        drums: { kick: [0], hat: [2, 6, 10, 14] },
      },
    ],
  },
  {
    name: 'classic',
    bpm: 115,
    bars: 16,
    seed: 23,
    masterGain: 0.82,
    pad: { wave: 'triangle', amp: 0.075, attack: 0.06, release: 0.12, panSpread: 0.45, detune: 0.002 },
    bass: { wave: 'square', amp: 0.085, attack: 0.004, release: 0.06, pan: -0.04 },
    lead: { wave: 'triangle', amp: 0.07, attack: 0.004, release: 0.07 },
    arp: { wave: 'softsaw', amp: 0.045, attack: 0.003, release: 0.045, panSpread: 0.5 },
    drums: { kick: 0.5, snare: 0.3, hat: 0.11 },
    delay: { left: 0.21, right: 0.29, feedback: 0.12, mix: 0.11 },
    progression: [
      {
        chord: ['C4', 'E4', 'G4'],
        bass: ['C2', 'G1', 'C2', 'G1', 'C2', 'G1', 'E2', 'G1'],
        lead: ['E5', 'G5', null, 'A5', 'G5', null, 'E5', 'D5'],
        arp: ['C5', 'G4', 'E5', 'G4', 'C5', 'G4', 'E5', 'G4', 'B4', 'G4', 'E5', 'G4', 'C5', 'G4', 'E5', 'D5'],
        drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['A3', 'C4', 'E4'],
        bass: ['A1', 'E2', 'A1', 'E2', 'A1', 'E2', 'G1', 'E2'],
        lead: ['C6', 'B5', null, 'A5', 'G5', null, 'E5', 'G5'],
        arp: ['A4', 'E5', 'C5', 'E5', 'A4', 'E5', 'C5', 'E5', 'G4', 'E5', 'C5', 'E5', 'A4', 'E5', 'C5', 'B4'],
        drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['F3', 'A3', 'C4'],
        bass: ['F1', 'C2', 'F1', 'C2', 'F1', 'C2', 'A1', 'C2'],
        lead: ['A5', 'G5', null, 'E5', 'F5', null, 'A5', 'G5'],
        arp: ['F4', 'C5', 'A4', 'C5', 'F4', 'C5', 'A4', 'C5', 'E5', 'C5', 'A4', 'C5', 'F4', 'C5', 'A4', 'G4'],
        drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['G3', 'B3', 'D4'],
        bass: ['G1', 'D2', 'G1', 'D2', 'G1', 'D2', 'F2', 'D2'],
        lead: ['B5', 'A5', null, 'G5', 'E5', null, 'D5', 'G5'],
        arp: ['G4', 'D5', 'B4', 'D5', 'G4', 'D5', 'B4', 'D5', 'F5', 'D5', 'B4', 'D5', 'G4', 'D5', 'B4', 'A4'],
        drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
    ],
  },
  {
    name: 'endless',
    bpm: 92,
    bars: 16,
    seed: 37,
    masterGain: 0.72,
    pad: { wave: 'sine', amp: 0.095, attack: 0.22, release: 0.28, panSpread: 0.58, detune: 0.0035 },
    bass: { wave: 'sine', amp: 0.07, attack: 0.02, release: 0.14, pan: -0.02 },
    lead: { wave: 'sine', amp: 0.05, attack: 0.03, release: 0.16 },
    arp: { wave: 'triangle', amp: 0.03, attack: 0.015, release: 0.11, panSpread: 0.6 },
    drums: { kick: 0.2, snare: 0.08, hat: 0.045 },
    delay: { left: 0.32, right: 0.47, feedback: 0.26, mix: 0.22 },
    progression: [
      {
        chord: ['D4', 'F4', 'A4', 'C5'],
        bass: ['D2', null, 'A1', null, 'D2', null, 'A1', null],
        lead: ['A5', null, null, 'C6', null, null, 'A5', 'F5'],
        arp: ['D5', null, null, 'A4', null, 'F5', null, null, 'C5', null, null, 'A4', null, 'F5', null, null],
        drums: { kick: [0], hat: [6, 14] },
      },
      {
        chord: ['Bb3', 'D4', 'F4', 'A4'],
        bass: ['Bb1', null, 'F2', null, 'Bb1', null, 'F2', null],
        lead: ['F5', null, null, 'A5', null, null, 'F5', 'D5'],
        arp: ['Bb4', null, null, 'F4', null, 'D5', null, null, 'A4', null, null, 'F4', null, 'D5', null, null],
        drums: { kick: [0], hat: [6, 14] },
      },
      {
        chord: ['C4', 'E4', 'G4', 'Bb4'],
        bass: ['C2', null, 'G1', null, 'C2', null, 'G1', null],
        lead: ['G5', null, null, 'Bb5', null, null, 'G5', 'E5'],
        arp: ['C5', null, null, 'G4', null, 'E5', null, null, 'Bb4', null, null, 'G4', null, 'E5', null, null],
        drums: { kick: [0], hat: [6, 14] },
      },
      {
        chord: ['A3', 'C4', 'E4', 'G4'],
        bass: ['A1', null, 'E2', null, 'A1', null, 'E2', null],
        lead: ['E5', null, null, 'G5', null, null, 'E5', 'C5'],
        arp: ['A4', null, null, 'E5', null, 'C5', null, null, 'G4', null, null, 'E5', null, 'C5', null, null],
        drums: { kick: [0], hat: [6, 14] },
      },
    ],
  },
  {
    name: 'blitz',
    bpm: 136,
    bars: 16,
    seed: 53,
    masterGain: 0.84,
    pad: { wave: 'softsaw', amp: 0.05, attack: 0.02, release: 0.09, panSpread: 0.36, detune: 0.0016 },
    bass: { wave: 'square', amp: 0.11, attack: 0.002, release: 0.04, pan: 0 },
    lead: { wave: 'softsaw', amp: 0.082, attack: 0.002, release: 0.035 },
    arp: { wave: 'square', amp: 0.05, attack: 0.001, release: 0.02, panSpread: 0.32 },
    drums: { kick: 0.62, snare: 0.36, hat: 0.13 },
    delay: { left: 0.17, right: 0.23, feedback: 0.1, mix: 0.08 },
    progression: [
      {
        chord: ['E3', 'B3', 'E4'],
        bass: ['E1', 'E1', 'B1', 'E1', 'E1', 'E1', 'B1', 'D2'],
        lead: ['E5', 'G5', 'B5', 'G5', 'E5', 'D5', 'B4', 'D5'],
        arp: ['E4', 'B4', 'E5', 'B4', 'G5', 'B4', 'E5', 'B4', 'E4', 'B4', 'E5', 'B4', 'D5', 'B4', 'E5', 'B4'],
        drums: { kick: [0, 3, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['D3', 'A3', 'D4'],
        bass: ['D1', 'D1', 'A1', 'D1', 'D1', 'D1', 'A1', 'C2'],
        lead: ['D5', 'F5', 'A5', 'F5', 'D5', 'C5', 'A4', 'C5'],
        arp: ['D4', 'A4', 'D5', 'A4', 'F5', 'A4', 'D5', 'A4', 'D4', 'A4', 'D5', 'A4', 'C5', 'A4', 'D5', 'A4'],
        drums: { kick: [0, 3, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['C3', 'G3', 'C4'],
        bass: ['C1', 'C1', 'G1', 'C1', 'C1', 'C1', 'G1', 'B1'],
        lead: ['C5', 'E5', 'G5', 'E5', 'C5', 'B4', 'G4', 'B4'],
        arp: ['C4', 'G4', 'C5', 'G4', 'E5', 'G4', 'C5', 'G4', 'C4', 'G4', 'C5', 'G4', 'B4', 'G4', 'C5', 'G4'],
        drums: { kick: [0, 3, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['D3', 'A3', 'D4'],
        bass: ['D1', 'D1', 'A1', 'D1', 'D1', 'D1', 'A1', 'C2'],
        lead: ['D5', 'F5', 'A5', 'F5', 'E5', 'D5', 'A4', 'B4'],
        arp: ['D4', 'A4', 'D5', 'A4', 'F5', 'A4', 'D5', 'A4', 'E5', 'A4', 'D5', 'A4', 'B4', 'A4', 'D5', 'A4'],
        drums: { kick: [0, 3, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
    ],
  },
  {
    name: 'competition',
    bpm: 140,
    bars: 16,
    seed: 71,
    masterGain: 0.86,
    pad: { wave: 'softsaw', amp: 0.055, attack: 0.018, release: 0.08, panSpread: 0.34, detune: 0.0014 },
    bass: { wave: 'square', amp: 0.112, attack: 0.002, release: 0.04, pan: 0 },
    lead: { wave: 'softsaw', amp: 0.084, attack: 0.002, release: 0.03 },
    arp: { wave: 'triangle', amp: 0.042, attack: 0.001, release: 0.022, panSpread: 0.3 },
    drums: { kick: 0.66, snare: 0.4, hat: 0.14 },
    delay: { left: 0.16, right: 0.22, feedback: 0.08, mix: 0.07 },
    progression: [
      {
        chord: ['A3', 'C4', 'E4'],
        bass: ['A1', 'A1', 'E2', 'A1', 'A1', 'A1', 'E2', 'G2'],
        lead: ['A5', 'C6', 'E6', 'C6', 'A5', 'G5', 'E5', 'G5'],
        arp: ['A4', 'E5', 'A5', 'E5', 'C6', 'E5', 'A5', 'E5', 'A4', 'E5', 'A5', 'E5', 'G5', 'E5', 'A5', 'E5'],
        drums: { kick: [0, 3, 8, 10, 11], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['F3', 'A3', 'C4'],
        bass: ['F1', 'F1', 'C2', 'F1', 'F1', 'F1', 'C2', 'E2'],
        lead: ['F5', 'A5', 'C6', 'A5', 'F5', 'E5', 'C5', 'E5'],
        arp: ['F4', 'C5', 'F5', 'C5', 'A5', 'C5', 'F5', 'C5', 'F4', 'C5', 'F5', 'C5', 'E5', 'C5', 'F5', 'C5'],
        drums: { kick: [0, 3, 8, 10, 11], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['C4', 'E4', 'G4'],
        bass: ['C2', 'C2', 'G1', 'C2', 'C2', 'C2', 'G1', 'B1'],
        lead: ['E5', 'G5', 'C6', 'G5', 'E5', 'D5', 'C5', 'D5'],
        arp: ['C5', 'G4', 'C6', 'G4', 'E5', 'G4', 'C6', 'G4', 'C5', 'G4', 'C6', 'G4', 'B4', 'G4', 'C6', 'G4'],
        drums: { kick: [0, 3, 8, 10, 11], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
      {
        chord: ['G3', 'B3', 'D4'],
        bass: ['G1', 'G1', 'D2', 'G1', 'G1', 'G1', 'D2', 'F2'],
        lead: ['D5', 'G5', 'B5', 'G5', 'E5', 'D5', 'B4', 'A4'],
        arp: ['G4', 'D5', 'G5', 'D5', 'B5', 'D5', 'G5', 'D5', 'G4', 'D5', 'G5', 'D5', 'F5', 'D5', 'G5', 'D5'],
        drums: { kick: [0, 3, 8, 10, 11], snare: [4, 12], hat: [2, 6, 10, 14] },
      },
    ],
  },
];

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function noteToFreq(note) {
  if (!note) return null;
  const match = /^([A-G](?:#|b)?)(-?\d)$/.exec(note);
  if (!match) throw new Error(`Invalid note: ${note}`);
  const [, name, octaveRaw] = match;
  const octave = Number(octaveRaw);
  const noteIndex = NOTE_INDEX[name];
  if (noteIndex == null) throw new Error(`Unknown note name: ${name}`);
  const midi = (octave + 1) * 12 + noteIndex;
  return 440 * 2 ** ((midi - 69) / 12);
}

function createBuffer(sampleCount) {
  return {
    left: new Float32Array(sampleCount),
    right: new Float32Array(sampleCount),
  };
}

function envelopeAt(time, duration, synth) {
  const attack = synth.attack ?? 0.01;
  const release = synth.release ?? 0.05;
  const hold = Math.max(duration - attack - release, 0.001);
  if (time < 0 || time > duration) return 0;
  if (time < attack) return time / attack;
  if (time < attack + hold) return 1;
  return Math.max(0, 1 - (time - attack - hold) / release);
}

function waveSample(type, phase) {
  switch (type) {
    case 'triangle':
      return 2 * Math.asin(Math.sin(phase)) / Math.PI;
    case 'square':
      return Math.sign(Math.sin(phase)) || 1;
    case 'softsaw': {
      let sum = 0;
      for (let harmonic = 1; harmonic <= 8; harmonic++) {
        sum += Math.sin(phase * harmonic) / harmonic;
      }
      return (2 / Math.PI) * sum * 0.85;
    }
    case 'sine':
    default:
      return Math.sin(phase);
  }
}

function panGains(pan = 0) {
  const value = Math.max(-1, Math.min(1, pan));
  const angle = (value + 1) * Math.PI / 4;
  return { left: Math.cos(angle), right: Math.sin(angle) };
}

function addNote(buffer, frequency, startSec, durationSec, synth, pan = 0) {
  if (!frequency || durationSec <= 0) return;
  const start = Math.floor(startSec * SAMPLE_RATE);
  const sampleCount = Math.floor(durationSec * SAMPLE_RATE);
  const end = Math.min(buffer.left.length, start + sampleCount);
  const gains = panGains(pan);
  const wave = synth.wave ?? 'sine';
  const amp = synth.amp ?? 0.08;
  const detune = synth.detune ?? 0;

  for (let i = start; i < end; i++) {
    const time = (i - start) / SAMPLE_RATE;
    const env = envelopeAt(time, durationSec, synth);
    if (env <= 0) continue;
    const phase = 2 * Math.PI * frequency * time;
    let sample = waveSample(wave, phase);
    if (detune > 0) {
      sample = (
        sample
        + waveSample(wave, phase * (1 + detune)) * 0.7
        + waveSample(wave, phase * (1 - detune)) * 0.7
      ) / 2.4;
    }
    const value = sample * env * amp;
    buffer.left[i] += value * gains.left;
    buffer.right[i] += value * gains.right;
  }
}

function addChord(buffer, notes, startSec, durationSec, synth) {
  const spread = synth.panSpread ?? 0.4;
  notes.forEach((note, index) => {
    const pan = notes.length === 1 ? 0 : -spread + (2 * spread * index) / (notes.length - 1);
    addNote(buffer, noteToFreq(note), startSec, durationSec, synth, pan);
  });
}

function addKick(buffer, startSec, amount) {
  const duration = 0.22;
  const start = Math.floor(startSec * SAMPLE_RATE);
  const end = Math.min(buffer.left.length, start + Math.floor(duration * SAMPLE_RATE));
  for (let i = start; i < end; i++) {
    const time = (i - start) / SAMPLE_RATE;
    const env = Math.exp(-18 * time);
    const freq = 130 - 85 * Math.min(1, time / duration);
    const sample = (Math.sin(2 * Math.PI * freq * time) * 0.9 + Math.sin(2 * Math.PI * 1800 * time) * Math.exp(-120 * time) * 0.1) * env * amount;
    buffer.left[i] += sample * 0.72;
    buffer.right[i] += sample * 0.72;
  }
}

function addSnare(buffer, startSec, amount, random) {
  const duration = 0.18;
  const start = Math.floor(startSec * SAMPLE_RATE);
  const end = Math.min(buffer.left.length, start + Math.floor(duration * SAMPLE_RATE));
  for (let i = start; i < end; i++) {
    const time = (i - start) / SAMPLE_RATE;
    const env = Math.exp(-22 * time);
    const noise = (random() * 2 - 1) * env;
    const body = Math.sin(2 * Math.PI * 190 * time) * Math.exp(-14 * time);
    const sample = (noise * 0.8 + body * 0.2) * amount;
    buffer.left[i] += sample * 0.56;
    buffer.right[i] += sample * 0.56;
  }
}

function addHat(buffer, startSec, amount, random) {
  const duration = 0.06;
  const start = Math.floor(startSec * SAMPLE_RATE);
  const end = Math.min(buffer.left.length, start + Math.floor(duration * SAMPLE_RATE));
  let previous = 0;
  for (let i = start; i < end; i++) {
    const time = (i - start) / SAMPLE_RATE;
    const env = Math.exp(-60 * time);
    const white = random() * 2 - 1;
    const high = white - previous * 0.82;
    previous = white;
    const sample = high * env * amount;
    buffer.left[i] += sample * 0.45;
    buffer.right[i] += sample * 0.45;
  }
}

function addDrums(buffer, barStartSec, beatSec, pattern, drumLevels, random) {
  for (const step of pattern.kick || []) addKick(buffer, barStartSec + step * beatSec / 4, drumLevels.kick);
  for (const step of pattern.snare || []) addSnare(buffer, barStartSec + step * beatSec / 4, drumLevels.snare, random);
  for (const step of pattern.hat || []) addHat(buffer, barStartSec + step * beatSec / 4, drumLevels.hat, random);
}

function addDelay(buffer, delay) {
  if (!delay) return;
  const leftDelay = Math.floor(delay.left * SAMPLE_RATE);
  const rightDelay = Math.floor(delay.right * SAMPLE_RATE);
  const feedback = delay.feedback ?? 0.15;
  const mix = delay.mix ?? 0.1;
  for (let i = 0; i < buffer.left.length; i++) {
    if (i >= leftDelay) buffer.left[i] += buffer.left[i - leftDelay] * feedback * mix;
    if (i >= rightDelay) buffer.right[i] += buffer.right[i - rightDelay] * feedback * mix;
  }
}

function normalize(buffer, gain = 0.84) {
  let peak = 0;
  for (let i = 0; i < buffer.left.length; i++) {
    peak = Math.max(peak, Math.abs(buffer.left[i]), Math.abs(buffer.right[i]));
  }
  const scale = peak > 0 ? gain / peak : 1;
  for (let i = 0; i < buffer.left.length; i++) {
    buffer.left[i] = Math.tanh(buffer.left[i] * scale * 1.2);
    buffer.right[i] = Math.tanh(buffer.right[i] * scale * 1.2);
  }
}

function toInt16(floatArray) {
  const output = new Int16Array(floatArray.length);
  for (let i = 0; i < floatArray.length; i++) {
    const sample = Math.max(-1, Math.min(1, floatArray[i]));
    output[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return output;
}

async function writeMp3(filePath, buffer) {
  const encoder = new Mp3Encoder(2, SAMPLE_RATE, BIT_RATE);
  const left = toInt16(buffer.left);
  const right = toInt16(buffer.right);
  const chunks = [];
  for (let i = 0; i < left.length; i += 1152) {
    const block = encoder.encodeBuffer(left.subarray(i, i + 1152), right.subarray(i, i + 1152));
    if (block.length > 0) chunks.push(Buffer.from(block));
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(Buffer.from(end));
  await fs.writeFile(filePath, Buffer.concat(chunks));
}

function renderTrack(track) {
  const beatSec = 60 / track.bpm;
  const totalSeconds = track.bars * BEATS_PER_BAR * beatSec;
  const buffer = createBuffer(Math.floor(totalSeconds * SAMPLE_RATE));
  const random = mulberry32(track.seed);

  for (let bar = 0; bar < track.bars; bar++) {
    const part = track.progression[bar % track.progression.length];
    const barStart = bar * BEATS_PER_BAR * beatSec;
    addChord(buffer, part.chord, barStart, beatSec * 3.8, track.pad);

    part.bass.forEach((note, step) => {
      if (!note) return;
      addNote(buffer, noteToFreq(note), barStart + step * beatSec * 0.5, beatSec * 0.42, track.bass, track.bass.pan ?? 0);
    });

    part.lead.forEach((note, step) => {
      if (!note) return;
      const pan = step % 2 === 0 ? -0.12 : 0.12;
      addNote(buffer, noteToFreq(note), barStart + step * beatSec * 0.5, beatSec * 0.38, track.lead, pan);
    });

    part.arp.forEach((note, step) => {
      if (!note) return;
      const spread = track.arp.panSpread ?? 0.3;
      const pan = step % 2 === 0 ? -spread : spread;
      addNote(buffer, noteToFreq(note), barStart + step * beatSec * 0.25, beatSec * 0.2, track.arp, pan);
    });

    addDrums(buffer, barStart, beatSec, part.drums || {}, track.drums, random);
  }

  addDelay(buffer, track.delay);
  normalize(buffer, track.masterGain);
  return buffer;
}

async function updateTrackManifest(names) {
  const manifestPath = path.join(MUSIC_DIR, 'tracks.json');
  await fs.writeFile(manifestPath, JSON.stringify({ tracks: names }, null, 2) + '\n', 'utf8');
}

async function main() {
  await fs.mkdir(MUSIC_DIR, { recursive: true });
  const built = [];

  for (const track of TRACKS) {
    console.log(`Generating ${track.name}.mp3`);
    const rendered = renderTrack(track);
    await writeMp3(path.join(MUSIC_DIR, `${track.name}.mp3`), rendered);
    built.push(track.name);
  }

  await updateTrackManifest(built);
  console.log(`Generated ${built.length} tracks in ${MUSIC_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});