import assert from 'node:assert/strict';

globalThis.location = { hostname: 'localhost' };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE' }, configurable: true });
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear()
};

const { GameEngine } = await import('../js/game/GameEngine.js');
const { SaveService } = await import('../js/save.js');

const wissenEndless = new GameEngine();
wissenEndless.start('wissen', 'endless', { lang: 'de' });
assert.equal(wissenEndless.timer, 0, 'Wissen endless must not start a countdown');
wissenEndless.stop();

const dailyA = GameEngine.dailyConfig();
const dailyB = GameEngine.dailyConfig();
assert.deepEqual(dailyA, dailyB, 'Daily configuration must be deterministic');
assert.notEqual(dailyA.mode, 'sequenz', 'Daily must use a comparable timed mode');
assert.equal(dailyA.playType, 'blitz');

const ranked = new GameEngine();
ranked.mode = 'beginner';
ranked.playType = 'competition';
ranked.ranked = true;
ranked.running = true;
ranked.rng = () => 0;
ranked._assignCorners();
ranked._scheduleSpawn = () => {};
ranked._spawn();
assert.equal(ranked.currentShape.bonus, null, 'Ranked runs must not roll score bonuses');
ranked.stop();

const snapshot = new GameEngine();
snapshot.running = true;
snapshot.practice = true;
snapshot.currentShape = { direction: 'ul', display: 'Hund', category: 'tier' };
snapshot.lastSpawnTime = performance.now() - 2000;
snapshot._scheduleSpawn = () => {};
const answer = snapshot.handleSwipe('ul', performance.now());
assert.equal(answer.item.display, 'Hund');
assert.equal(answer.item.category, 'tier');
assert.equal(snapshot.currentShape, null, 'Answered item must be cleared after snapshotting');

const bonusCap = new GameEngine();
bonusCap.timer = 30;
bonusCap._timerTarget = 30;
bonusCap._timerWallStart = Date.now();
bonusCap._timerPausedAccum = 0;
assert.equal(bonusCap._awardTimerBonus(5), 5);
assert.equal(bonusCap._awardTimerBonus(5), 3);
assert.equal(bonusCap._awardTimerBonus(5), 0);

const auth = {
  isGuest: true,
  user: { id: 'guest' },
  async cloudLoad() { return null; },
  async cloudSave() {}
};
const saves = new SaveService(auth);
await saves.load();
saves.data.totalXP = 111;
await saves.save();
assert.ok(storage.has('scs_save:guest'));

auth.isGuest = false;
auth.user = { id: 'account-a' };
await saves.load();
assert.equal(saves.data.totalXP, 0, 'Account A must not inherit guest progress');
saves.data.totalXP = 222;
await saves.save();

auth.user = { id: 'account-b' };
await saves.load();
assert.equal(saves.data.totalXP, 0, 'Account B must not inherit account A progress');
saves.data.totalXP = 333;
assert.equal(await saves.save(), true);

auth.user = { id: 'account-a' };
await saves.load();
assert.equal(saves.data.totalXP, 222, 'Account A progress must be restored by UID');
auth.user = { id: 'account-b' };
assert.equal(await saves.save(), false, 'A stale in-memory save must not cross account boundaries');

storage.clear();
storage.set('scs_save', JSON.stringify({ totalXP: 77 }));
auth.isGuest = true;
auth.user = { id: 'guest' };
const migrated = new SaveService(auth);
await migrated.load();
assert.equal(migrated.data.totalXP, 77);
assert.ok(storage.has('scs_save:guest'));
assert.equal(storage.has('scs_save'), false, 'Legacy save must migrate only once');

await migrated.addScore({ mode: 'klassik', playType: 'blitz', score: 500, streak: 2, accuracy: 80, avgReaction: 400, xp: 0 });
await migrated.addScore({ mode: 'klassik', playType: 'classic', score: 900, streak: 3, accuracy: 85, avgReaction: 450, xp: 0 });
assert.equal(migrated.getPB('klassik', 'blitz'), 500);
assert.equal(migrated.getPB('klassik', 'classic'), 900);
assert.equal(migrated.getPB('klassik'), 900, 'All-time PB should remain available for overview UI');

console.log('Game logic regression tests passed.');
