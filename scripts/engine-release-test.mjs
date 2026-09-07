import assert from 'node:assert/strict';

globalThis.location = { hostname: 'localhost' };
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'de-DE' },
  configurable: true
});

const { GameEngine } = await import('../js/game/GameEngine.js');
const { CONFIG } = await import('../js/config.js');

function prepareWrongAnswer(mode, playType) {
  const engine = new GameEngine();
  engine.running = true;
  engine.ranked = true;
  engine.mode = mode;
  engine.playType = playType;
  engine.currentShape = { direction: 'ul', display: 'release-item', stimulusId: 1 };
  engine.lastSpawnTime = performance.now() - 5000;
  return engine;
}

const timedWrong = prepareWrongAnswer('wissen', 'blitz');
timedWrong.timer = 1;
timedWrong._timerTarget = 1;
timedWrong._timerWallStart = Date.now();
timedWrong._timerPausedAccum = 0;
const timedEvents = [];
timedWrong.onResult = result => timedEvents.push(['result', result]);
timedWrong.onGameOver = () => timedEvents.push(['gameOver']);
const timedResult = timedWrong.handleSwipe('dr', performance.now(), 1);
assert.equal(timedResult.correct, false);
assert.equal(timedResult.expected, 'ul');
assert.equal(timedResult.item.display, 'release-item');
assert.deepEqual(timedEvents.map(([event]) => event), ['result', 'gameOver']);
assert.equal(timedWrong.running, false);

const endlessWrong = prepareWrongAnswer('beginner', 'endless');
endlessWrong.endlessTotalMisses = CONFIG.ENDLESS_MAX_MISSES - 1;
endlessWrong.endlessLives = 1;
let endlessResults = 0;
let endlessSpawns = 0;
endlessWrong.onResult = result => {
  endlessResults++;
  assert.equal(result.expected, 'ul');
  assert.equal(result.item.display, 'release-item');
};
endlessWrong.onSpawn = () => { endlessSpawns++; };
const endlessResult = endlessWrong.handleSwipe('dr', performance.now(), 1);
assert.equal(endlessResult.correct, false);
assert.equal(endlessResults, 1);
assert.equal(endlessSpawns, 0);
assert.equal(endlessWrong.running, false);

const timedAutoMiss = prepareWrongAnswer('beginner', 'blitz');
timedAutoMiss.timer = 1;
timedAutoMiss._timerTarget = 1;
timedAutoMiss._timerWallStart = Date.now();
timedAutoMiss._timerPausedAccum = 0;
const autoMissEvents = [];
timedAutoMiss.onResult = result => autoMissEvents.push(['result', result]);
timedAutoMiss.onGameOver = () => autoMissEvents.push(['gameOver']);
const autoMissResult = timedAutoMiss.autoMiss();
assert.equal(autoMissResult.autoMiss, true);
assert.equal(autoMissResult.expected, 'ul');
assert.equal(autoMissResult.item.display, 'release-item');
assert.deepEqual(autoMissEvents.map(([event]) => event), ['result', 'gameOver']);

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
try {
  for (const mode of ['beginner', 'mathe', 'stroop']) {
    const callbacks = new Map();
    let nextId = 0;
    globalThis.setTimeout = callback => {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    };
    globalThis.clearTimeout = id => callbacks.delete(id);

    const rush = new GameEngine();
    rush.running = true;
    rush.practice = true;
    rush.mode = mode;
    rush.rng = () => 0;
    rush._assignCorners();
    rush._triggerRush();
    assert.equal(callbacks.size, CONFIG.RUSH_COUNT, `${mode}: Rush must queue only its intended spawns`);

    for (const id of [...rush._rushQueue]) {
      rush.currentShape = null;
      callbacks.get(id)();
      callbacks.delete(id);
    }
    assert.equal(callbacks.size, 1, `${mode}: Rush spawns must not queue normal successors`);

    const completionId = rush._rushTimeout;
    callbacks.get(completionId)();
    callbacks.delete(completionId);
    assert.equal(rush.inRush, false);
    assert.equal(callbacks.size, 1, `${mode}: Rush completion must queue exactly one normal successor`);
    rush.stop();
  }
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}

for (const mode of ['stroop', 'chaos']) {
  const engine = new GameEngine();
  engine.mode = mode;
  engine.practice = true;
  engine.rng = () => 0;
  engine._assignCorners();
  engine._scheduleSpawn = () => {};
  if (mode === 'stroop') engine._spawnStroop();
  else engine._spawnChaos();

  for (const corner of Object.values(engine.cornerMap)) {
    assert.notEqual(corner.colorblind, corner.color, `${mode}: corner colorblind value must differ`);
    assert.equal(typeof corner.colorblindPattern, 'string');
  }
  assert.notEqual(engine.currentShape.colorblind, engine.currentShape.color, `${mode}: stimulus colorblind value must differ`);
  assert.equal(typeof engine.currentShape.colorblindPattern, 'string');
}

console.log('Engine release regression tests passed.');
