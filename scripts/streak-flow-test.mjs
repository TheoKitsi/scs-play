import assert from 'node:assert/strict';

globalThis.location = { hostname: 'localhost' };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE' }, configurable: true });
const { GameEngine } = await import('../js/game/GameEngine.js');
const { CONFIG } = await import('../js/config.js');

class Clock {
  now = 1000;
  tasks = new Map();
  id = 0;
  schedule(callback, delay, repeat = false) {
    const id = ++this.id;
    const ms = Math.max(repeat ? 1 : 0, Number(delay) || 0);
    this.tasks.set(id, { callback, at: this.now + ms, repeat: repeat ? ms : 0 });
    return id;
  }
  tick(ms) {
    const target = this.now + ms;
    let executions = 0;
    while (true) {
      const next = [...this.tasks].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next || next[1].at > target) break;
      assert.ok(++executions < 10000, 'Timer loop must remain bounded');
      const [id, task] = next;
      this.now = task.at;
      if (task.repeat) task.at += task.repeat;
      else this.tasks.delete(id);
      task.callback();
    }
    this.now = target;
  }
  until(predicate) {
    for (let i = 0; i < 1000 && !predicate(); i++) {
      const next = Math.min(...[...this.tasks.values()].map(task => task.at));
      assert.ok(Number.isFinite(next), 'A next stimulus must always be scheduled');
      this.tick(next - this.now);
    }
    assert.ok(predicate(), 'Stimulus must become available');
  }
}

const originals = Object.fromEntries(['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'].map(key => [key, globalThis[key]]));
const dateNow = Date.now;
const perfNow = Object.getOwnPropertyDescriptor(performance, 'now');
let clock;
globalThis.setTimeout = (fn, delay) => clock.schedule(fn, delay);
globalThis.setInterval = (fn, delay) => clock.schedule(fn, delay, true);
globalThis.clearTimeout = globalThis.clearInterval = id => clock.tasks.delete(id);
Date.now = () => 1700000000000 + clock.now;
Object.defineProperty(performance, 'now', { configurable: true, value: () => clock.now });

try {
  for (const mode of ['klassik', 'beginner', 'expert', 'mathe', 'stroop']) {
    clock = new Clock();
    const game = new GameEngine();
    game.start(mode, 'endless');
    let seed = 1337;
    game.rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const gaps = [];
    const events = { combo: 0, fever: 0, cooldown: 0, shuffle: 0, rush: 0 };
    let answeredAt = null;
    game.onResult = () => { answeredAt = clock.now; };
    game.onSpawn = () => {
      if (answeredAt != null) gaps.push(clock.now - answeredAt);
      answeredAt = null;
      assert.ok(!(game.inRush && game._shuffleInProgress), 'Rush and Shuffle must not own spawning simultaneously');
    };
    game.onComboMilestone = () => { events.combo++; };
    game.onFeverStart = () => { events.fever++; };
    game.onFeverEnd = () => { events.cooldown++; };
    game.onCornerShuffle = () => { events.shuffle++; };
    game.onRush = () => { events.rush++; };
    for (let answer = 0; answer < 100; answer++) {
      clock.until(() => game.currentShape != null);
      clock.tick(100);
      const result = game.handleSwipe(game.currentShape.direction, clock.now, game.currentShape.stimulusId);
      assert.equal(result?.correct, true, `${mode}: fast correct answer must remain accepted`);
    }
    clock.until(() => game.currentShape != null);
    assert.equal(game.correct, 100);
    assert.equal(game.wrong, 0);
    assert.ok(events.combo > 0 && events.fever > 0 && events.cooldown > 0 && events.rush > 0);
    if (['klassik', 'beginner', 'expert'].includes(mode)) assert.ok(events.shuffle > 0);
    const maxGap = Math.max(...gaps);
    console.log(`${mode}: maximum answer-to-next-stimulus ${maxGap}ms; ${JSON.stringify(events)}`);
    assert.ok(maxGap <= Math.max(400, CONFIG.CORNER_SHUFFLE_WARNING_MS), `${mode}: celebrations/Rush must not stall a flawless player (${maxGap}ms)`);
    game.stop();
    assert.equal(clock.tasks.size, 0, `${mode}: stop cancels all gameplay timers`);
  }

  clock = new Clock();
  const timed = new GameEngine();
  timed.start('klassik', 'endless');
  clock.until(() => timed.currentShape != null);
  timed.playType = 'classic';
  timed.timer = 45;
  timed.elapsed = 15;
  timed._nextShuffleAt = Infinity;
  let rushes = 0;
  timed.onRush = () => { rushes++; };
  for (let answer = 0; answer < 5; answer++) {
    clock.until(() => timed.currentShape != null);
    clock.tick(100);
    timed.handleSwipe(timed.currentShape.direction, clock.now, timed.currentShape.stimulusId);
  }
  assert.equal(rushes, 1, 'A fast Rush must not retrigger repeatedly at the same timer second');
  timed.stop();

  clock = new Clock();
  const unanswered = new GameEngine();
  unanswered.start('klassik', 'endless');
  clock.until(() => unanswered.currentShape != null);
  clock.tick(100);
  unanswered.handleSwipe(unanswered.currentShape.direction, clock.now, unanswered.currentShape.stimulusId);
  unanswered._triggerRush();
  clock.until(() => unanswered._rushIndex === 1);
  for (let item = 1; item <= CONFIG.RUSH_COUNT; item++) {
    const token = unanswered.currentShape.stimulusId;
    const deadline = Math.max(CONFIG.RUSH_DELAY, unanswered._minAnswerWindow);
    clock.tick(deadline - 1);
    assert.equal(unanswered.currentShape.stimulusId, token, 'Rush must preserve the full answer window');
    assert.equal(unanswered.wrong, item - 1);
    clock.tick(1);
    assert.equal(unanswered.wrong, item, 'An unanswered Rush item must expire exactly once');
  }
  assert.equal(unanswered.inRush, false, 'Unanswered Rush must also return to normal play');
  unanswered.stop();
  assert.equal(clock.tasks.size, 0);

  clock = new Clock();
  const interrupted = new GameEngine();
  interrupted.start('klassik', 'endless');
  clock.until(() => interrupted.currentShape != null);
  clock.tick(100);
  interrupted.handleSwipe(interrupted.currentShape.direction, clock.now, interrupted.currentShape.stimulusId);
  interrupted._triggerRush();
  interrupted._triggerCornerShuffle();
  assert.equal(interrupted._shuffleInProgress, false, 'Shuffle defers while Rush owns the successor');
  interrupted.pause();
  clock.tick(5000);
  assert.equal(interrupted.currentShape, null, 'No late Rush item may appear during pause');
  interrupted.resume();
  clock.until(() => interrupted.currentShape != null);
  assert.equal(interrupted.inRush, false);
  interrupted.stop();
  assert.equal(clock.tasks.size, 0);
  console.log('Streak flow regression tests passed.');
} finally {
  Object.assign(globalThis, originals);
  Date.now = dateNow;
  if (perfNow) Object.defineProperty(performance, 'now', perfNow);
  else delete performance.now;
}
