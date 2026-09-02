import assert from 'node:assert/strict';

globalThis.fetch = async () => ({ ok: true, json: async () => ({ tracks: [] }) });

const { AudioManager } = await import('../js/audio.js');

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

console.log('Audio logic regression tests passed.');
