import assert from 'node:assert/strict';

globalThis.fetch = async () => ({ ok: true, json: async () => ({ tracks: [] }) });

const { AudioManager } = await import('../js/audio.js');

const unavailable = new AudioManager();
await unavailable._loadMusicManifest();
assert.equal(unavailable._ensure(), false, 'Missing Web Audio must not block boot or menus');
assert.doesNotThrow(() => { unavailable.tap(); unavailable.startMusic(); });
assert.equal(unavailable._musicRunning, false, 'No synth scheduler without a usable context');
globalThis.AudioContext = class { constructor() { throw new Error('Audio device unavailable'); } };
assert.equal(new AudioManager()._ensure(), false, 'Audio-context construction failure must remain non-fatal');
delete globalThis.AudioContext;

const finale = new AudioManager();
const cadence = [];
finale._play = (...args) => cadence.push(args);
finale.roundEnd('time');
assert.equal(cadence.length, 2, 'A timeout is one short two-voice cadence');
assert.ok(cadence.every(args => args[2] <= .22));
assert.equal(finale._musicRequested, false, 'Ending must not resurrect background music after hiding');
finale.stopMusic();
assert.equal(finale._musicEndTimer, null, 'Navigation cancels the pending music fade finisher');
cadence.length = 0;
finale.roundEnd('lives');
assert.equal(cadence[0][0], 392, 'Endless has a different, non-punitive ending');
finale.stopMusic();
cadence.length = 0;
finale.roundEnd('win');
assert.equal(cadence[0][0], 659, 'A won competition has a distinct resolution');
finale.stopMusic();

const mapping = new AudioManager();
mapping.setMusicMode('blitz', { modeId: 'klassik' });
assert.equal(mapping._musicFamily, 'sort', 'Classic sorting must use the sort music family');
mapping.setMusicMode('blitz', { modeId: 'mathe' });
assert.equal(mapping._musicFamily, 'think', 'Text-heavy modes must use the restrained think family');
assert.equal(mapping._musicMode, 'classic', 'Think modes retain their focused harmonic base');
mapping.setMusicMode('blitz', { modeId: 'memo' });
assert.equal(mapping._musicFamily, 'memory', 'Memo must use the memory family');
assert.equal(mapping._getMusicArrangement().repeatMotif, true, 'Memory arrangements must preserve recognizable motifs');
mapping.setMusicMode('blitz', { modeId: 'stroop' });
assert.equal(mapping._musicFamily, 'reflex', 'Stroop must use the reflex family');
assert.equal(mapping._getMusicArrangement().hatEvery, 4, 'Low reflex intensity starts with a controlled pulse');

const intensity = new AudioManager();
intensity.setMusicMode('blitz', { modeId: 'mathe' });
assert.equal(intensity.setPerformanceIntensity(12), 1, 'Think intensity must rise later than fast modes');
intensity._lastIntensityUpdate = -Infinity;
assert.equal(intensity.setPerformanceIntensity(19), 1, 'Hysteresis must hold just below the next think threshold');
intensity._lastIntensityUpdate = -Infinity;
assert.equal(intensity.setPerformanceIntensity(20), 2, 'Think intensity must cross at its explicit threshold');
intensity._lastIntensityUpdate = -Infinity;
assert.equal(intensity.setPerformanceIntensity(16), 2, 'Hysteresis must prevent oscillation around a threshold');
intensity._lastIntensityUpdate = -Infinity;
assert.equal(intensity.setPerformanceIntensity(15), 1, 'Intensity must fall only at the lower hysteresis threshold');

const throttled = new AudioManager();
throttled.setMusicMode('blitz', { modeId: 'stroop' });
assert.equal(throttled.setPerformanceIntensity(3), 1);
assert.equal(throttled.setPerformanceIntensity(20), 1, 'Rapid intensity changes must be throttled');
throttled._lastIntensityUpdate = -Infinity;
assert.equal(throttled.setPerformanceIntensity(20), 3, 'A later update may apply the accumulated flow level');
assert.ok(throttled._musicTempo <= throttled._baseTempo + 12, 'Flow tempo lift must stay secondary to arrangement and mix');
throttled._musicAudio = { playbackRate: 1, volume: 0, currentTime: 0, pause() {} };
throttled._lastIntensityUpdate = -Infinity;
throttled.setPerformanceIntensity(0);
assert.equal(throttled._musicAudio.playbackRate, 1, 'A broken streak must restore the source playback rate');
throttled._lastIntensityUpdate = -Infinity;
throttled.setPerformanceIntensity(20);
assert.equal(throttled._musicAudio.playbackRate, 1.03, 'File flow must use only a minimal playback-rate lift');
throttled.stopMusic();
assert.equal(throttled._musicIntensity, 0, 'Stopping music must clear run-specific flow state');
assert.equal(throttled._musicAudio.playbackRate, 1, 'Stopping music must restore the file playback rate');

const toggled = new AudioManager();
await toggled._loadMusicManifest();
toggled.toggleMusic(false);
toggled.startMusic();
assert.equal(toggled._musicRequested, true, 'Disabled music must retain a valid play request');
let toggleStarts = 0;
toggled.startMusic = () => { toggleStarts++; };
toggled.toggleMusic(true);
assert.equal(toggleStarts, 1, 'Enabling music must resume the requested context');

const visibility = new AudioManager();
await visibility._loadMusicManifest();
visibility._musicRequested = true;
visibility._musicRunning = true;
visibility.setVisibility(true);
assert.equal(visibility._musicRunning, false, 'Hidden apps must stop active music');
assert.equal(visibility._musicRequested, true, 'Visibility suspension must preserve the play request');
let visibilityStarts = 0;
visibility.startMusic = () => { visibilityStarts++; };
visibility.setVisibility(false);
assert.equal(visibilityStarts, 1, 'Visible apps must resume temporarily suspended music');

class RejectingAudio {
  constructor() {
    this.paused = true;
    this.currentTime = 0;
    this.playbackRate = 1;
    this.volume = 0;
  }
  play() { return Promise.reject(new Error('decode failed')); }
  pause() { this.paused = true; }
}
globalThis.Audio = RejectingAudio;

const fallback = new AudioManager();
await fallback._loadMusicManifest();
fallback._availableMusicTracks.add('classic');
fallback._ensure = () => {};
const startMusic = fallback.startMusic.bind(fallback);
let fallbackStarts = 0;
fallback.startMusic = () => {
  fallbackStarts++;
  if (fallbackStarts === 1) startMusic();
};
fallback.startMusic();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(fallbackStarts, 2, 'Rejected file playback must invoke procedural fallback');
assert.equal(fallback._availableMusicTracks.has('classic'), false, 'Failed tracks must not be retried immediately');

const lifecycle = new AudioManager();
let lifecyclePlays = 0;
lifecycle._play = () => { lifecyclePlays++; };
lifecycle.perfect();
assert.equal(lifecyclePlays, 1, 'The first note of an SFX sequence must play immediately');
lifecycle.setVisibility(true);
await new Promise(resolve => setTimeout(resolve, 150));
assert.equal(lifecyclePlays, 1, 'Hidden apps must cancel delayed SFX notes');

const sequenceAudio = new AudioManager();
const sequenceCues = [];
let sequenceSchedules = 0;
sequenceAudio._play = (...args) => { sequenceCues.push(args); };
sequenceAudio._scheduleSfx = () => { sequenceSchedules++; };
sequenceAudio.sequenceStep('ul');
sequenceAudio.sequenceStep('ul');
sequenceAudio.sequenceStep('dr');
assert.equal(sequenceCues.length, 3, 'Each watched sequence step must emit exactly one cue');
assert.deepEqual(sequenceCues[0], sequenceCues[1], 'Repeated directions must use a stable cue');
assert.notEqual(sequenceCues[0][0], sequenceCues[2][0], 'Different directions must use distinct pitches');
assert.equal(sequenceSchedules, 0, 'Sequence cues must not schedule milestone notes');

let resumes = 0;
const hiddenPrimitive = new AudioManager();
hiddenPrimitive.ctx = { state: 'suspended', resume: () => { resumes++; } };
hiddenPrimitive.setVisibility(true);
hiddenPrimitive._play(440, 'sine', 0.1);
assert.equal(resumes, 0, 'Hidden sound primitives must not resume the audio context');

const muted = new AudioManager();
let mutedPlays = 0;
let tensionStops = 0;
muted._play = () => { mutedPlays++; };
muted.stopTension = () => { tensionStops++; };
muted._sfxGain = { gain: { value: muted._sfxVolume } };
muted.rush();
muted.toggle(false);
await new Promise(resolve => setTimeout(resolve, 200));
assert.equal(mutedPlays, 0, 'Muting must cancel an entire queued SFX sequence');
assert.equal(tensionStops, 1, 'Muting must stop active tension audio');
assert.equal(muted._sfxGain.gain.value, 0, 'Muting must silence active SFX immediately');

console.log('Audio logic regression tests passed.');

// Normal file playback, not just procedural fallback, gets a beat-aligned mix.
const phaseAudio = new AudioManager();
phaseAudio._musicRunning = true;
phaseAudio._musicFilePlaying = true;
phaseAudio._musicAudio = { currentTime: 3.1, playbackRate: 1.02, volume: 0, pause() {} };
phaseAudio._baseTempo = 120;
const nativeSet = globalThis.setTimeout, nativeClear = globalThis.clearTimeout;
const pending = new Map();
let nextTimer = 0;
globalThis.setTimeout = (callback, delay) => { pending.set(++nextTimer, { callback, delay }); return nextTimer; };
globalThis.clearTimeout = id => pending.delete(id);
let mixes = 0;
phaseAudio._applyMusicIntensity = () => { mixes++; };
try {
  phaseAudio.setArenaPhase('rush');
  assert.equal(mixes, 0, 'An event cannot retime the source halfway through a beat');
  assert.ok(Math.abs([...pending.values()][0].delay - 400 / 1.02) < 1, 'Delay comes from the real file playhead and playback rate');
  phaseAudio.setArenaPhase('fever');
  assert.equal(pending.size, 1, 'Rapid transitions coalesce rather than stacking sounds/timers');
  const transition = [...pending.values()][0]; pending.clear(); transition.callback();
  assert.equal(phaseAudio._arenaPhase, 'fever');
  assert.equal(mixes, 1);
  phaseAudio.setArenaPhase('cooldown');
  phaseAudio.stopMusic();
  assert.equal(pending.size, 0, 'Leaving/pausing/hiding cancels the phase finisher');
  assert.equal(phaseAudio._arenaPhase, 'calm');
} finally { globalThis.setTimeout = nativeSet; globalThis.clearTimeout = nativeClear; }

const fileGraph = new AudioManager();
const cutoffs = [];
let sources = 0;
fileGraph.ctx = { currentTime: 5, destination: {},
  createBiquadFilter: () => ({ type: '', Q: { value: 0 }, frequency: { setTargetAtTime: value => cutoffs.push(value) }, connect() {} }),
  createMediaElementSource: () => { sources++; return { connect() {}, disconnect() {} }; } };
fileGraph._connectMusicFile(); fileGraph._connectMusicFile();
assert.equal(sources, 1, 'One reusable file routing graph, never a new graph per phase');
fileGraph._arenaPhase = 'watch'; fileGraph._applyMusicMix();
assert.equal(cutoffs.at(-1), 3400, 'Memory watch materially softens normal file playback');
fileGraph._arenaPhase = 'rush'; fileGraph._applyMusicMix();
assert.equal(cutoffs.at(-1), 16000, 'Rush opens the same file rather than creating a competing track');
const unsupportedGraph = new AudioManager();
assert.doesNotThrow(() => unsupportedGraph._connectMusicFile(), 'No Web Audio leaves ordinary file playback usable');
console.log('PASS beat-aligned/coalesced file transitions, reusable EQ graph, bounded gains and cancellation');
