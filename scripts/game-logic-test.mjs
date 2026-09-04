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
const { CONFIG } = await import('../js/config.js');
const { SwipeHandler } = await import('../js/input.js');
const {
  ModeMastery,
  endStroopGame,
  startStroopGame,
  trackSequenzResult,
  trackStroopAnswer
} = await import('../js/game/ModeMastery.js');

const mastery = new ModeMastery({ data: {} });
trackSequenzResult(mastery, {
  correct: true,
  sequenzComplete: true,
  seqLen: 4,
  sequenzRound: 0
}, { _seqPattern: ['ul', 'ur', 'dr', 'dl'] });
assert.deepEqual(
  mastery.get('sequenz', 'bestPattern'),
  ['ul', 'ur', 'dr', 'dl'],
  'Sequenz best pattern must use the engine sequence state'
);

startStroopGame(mastery);
trackStroopAnswer(mastery, {
  correct: false,
  reaction: 0,
  item: { isCongruent: true }
}, { _stroopChallengeUntil: 0 });
trackStroopAnswer(mastery, {
  correct: false,
  reaction: 0,
  item: { isCongruent: false }
}, { _stroopChallengeUntil: 0 });
endStroopGame(mastery, { correct: 0 }, false);
assert.equal(mastery.get('stroop', 'lastCongRt'), 0, 'Stroop congruent RT must be zero without correct answers');
assert.equal(mastery.get('stroop', 'lastIncongRt'), 0, 'Stroop incongruent RT must be zero without correct answers');

mastery.set('stroop', '_inChallenge', true);
trackStroopAnswer(mastery, {
  correct: false,
  reaction: 0,
  item: { isCongruent: true }
}, { _stroopChallengeUntil: performance.now() - 1 });
assert.equal(mastery.get('stroop', '_inChallenge'), false, 'Expired Stroop challenges must reset their tracking state');

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

const competitionStage = new GameEngine();
competitionStage.running = true;
competitionStage.mode = 'klassik';
competitionStage.playType = 'competition';
competitionStage.ranked = true;
competitionStage.competitionLevel = 0;
competitionStage.competitionTarget = 100;
competitionStage.currentShape = { direction: 'ul', stimulusId: 1 };
competitionStage.lastSpawnTime = performance.now() - 200;
competitionStage._scheduleSpawn = () => {};
let competitionCompletions = 0;
competitionStage.onCompetitionComplete = () => { competitionCompletions++; };
competitionStage.handleSwipe('ul', performance.now(), 1);
assert.equal(competitionStage.running, true, 'Competition must continue after reaching the one-star target');
assert.equal(competitionStage._competitionWon, true);
competitionStage.currentShape = { direction: 'ul', stimulusId: 2 };
competitionStage.lastSpawnTime = performance.now() - 200;
competitionStage.handleSwipe('ul', performance.now(), 2);
assert.equal(competitionCompletions, 1, 'Competition completion feedback must only fire once');
competitionStage.stop();

for (const [score, expectedStars] of [[99, 0], [100, 1], [150, 2], [200, 3]]) {
  const starStage = new GameEngine();
  starStage.playType = 'competition';
  starStage.competitionTarget = 100;
  starStage.score = score;
  assert.equal(starStage._buildStats().competitionStars, expectedStars, `Score ${score} must award ${expectedStars} stars`);
}

const earlyStage = new GameEngine();
earlyStage.start('mathe', 'competition', { competitionLevel: 0 });
const earlyInterval = earlyStage.spawnInterval;
earlyStage.stop();
const lateStage = new GameEngine();
lateStage.start('mathe', 'competition', { competitionLevel: 9 });
assert.ok(lateStage.spawnInterval < earlyInterval, 'Later stages must start faster');
assert.equal(lateStage.correct, 0, 'Stage difficulty must not prefill correct-answer statistics');
assert.equal(lateStage._getMathPhase(), CONFIG.MATH_PHASES[4], 'Late stages must start in a higher content phase');
lateStage.stop();

const preservedQuestion = new GameEngine();
preservedQuestion.running = true;
preservedQuestion.mode = 'mathe';
preservedQuestion.playType = 'competition';
preservedQuestion.currentShape = { direction: 'dr', stimulusId: 7 };
preservedQuestion.lastSpawnTime = performance.now() - 200;
preservedQuestion.pause();
let resumedDelay = null;
preservedQuestion._scheduleSpawn = delay => { resumedDelay = delay; };
preservedQuestion.resume();
assert.equal(preservedQuestion.currentShape.direction, 'dr', 'Pause must preserve the active task');
assert.ok(resumedDelay > 0, 'Resumed tasks must retain an answer deadline');
preservedQuestion.stop();

const wissenRush = new GameEngine();
wissenRush.running = true;
wissenRush.mode = 'wissen';
let wissenRushTriggered = false;
wissenRush.onRush = () => { wissenRushTriggered = true; };
wissenRush._triggerRush();
assert.equal(wissenRushTriggered, false, 'Wissen must not use the generic timed Rush');

const algebraSquare = new GameEngine();
algebraSquare.rng = () => 0;
const positiveRoot = algebraSquare._generateAlgebraEquation({ type: 'square' });
assert.match(positiveRoot.equation, /^x > 0:/, 'Square equations must state the positive-root restriction');

const focusAttempts = new GameEngine();
focusAttempts.mode = 'fokus';
focusAttempts.total = 10;
focusAttempts.correct = 2;
focusAttempts.rng = () => 0;
focusAttempts._assignCorners();
focusAttempts._scheduleSpawn = () => {};
focusAttempts._spawnFokus();
assert.equal(focusAttempts.currentShape.flankers.length, 4, 'Fokus difficulty must continue to scale by attempts');

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

const staleGesture = new GameEngine();
staleGesture.running = true;
staleGesture.practice = true;
staleGesture._scheduleSpawn = () => {};
staleGesture.currentShape = { direction: 'ul' };
staleGesture._emitSpawn();
const oldStimulusId = staleGesture.currentShape.stimulusId;
staleGesture.currentShape = { direction: 'dr' };
staleGesture._emitSpawn();
staleGesture.lastSpawnTime = performance.now() - 100;
assert.equal(
  staleGesture.handleSwipe('ul', performance.now(), oldStimulusId),
  null,
  'A gesture started on an old stimulus must not score or miss the new stimulus'
);
assert.equal(staleGesture.total, 0);
assert.equal(staleGesture.currentShape.direction, 'dr');
const currentStimulusId = staleGesture.currentShape.stimulusId;
assert.equal(staleGesture.handleSwipe('dr', performance.now(), currentStimulusId)?.correct, true);

const invalidTimestamp = new GameEngine();
invalidTimestamp.running = true;
invalidTimestamp.practice = true;
invalidTimestamp.currentShape = { direction: 'ul', stimulusId: 1 };
assert.equal(invalidTimestamp.handleSwipe('ul', Number.NaN, 1), null);
assert.equal(invalidTimestamp.total, 0, 'Invalid input timestamps must not mutate game state');

const memoReveal = new GameEngine();
memoReveal.running = true;
memoReveal.mode = 'memo';
memoReveal.practice = false;
memoReveal._memoPhase = 'playing';
memoReveal._memoCorrectSinceReveal = CONFIG.MEMO_REVEAL_EVERY - 1;
memoReveal.currentShape = { direction: 'ul', stimulusId: 1 };
memoReveal.lastSpawnTime = performance.now() - 1000;
const memoSchedules = [];
memoReveal._scheduleSpawn = delay => memoSchedules.push(delay);
memoReveal.handleSwipe('ul', performance.now(), 1);
assert.equal(memoReveal._memoPhase, 'reveal');
assert.equal(memoSchedules.length, 0, 'Memo must not spawn while corners are revealed');
clearTimeout(memoReveal._memoPreviewTimeout);

const smoothSpeed = new GameEngine();
smoothSpeed.mode = 'klassik';
smoothSpeed.correct = 10;
smoothSpeed.spawnInterval = CONFIG.SPAWN_INTERVAL_START;
smoothSpeed._recentWindow = Array.from({ length: 10 }, () => ({ correct: true, reaction: 100 }));
smoothSpeed._adjustDifficulty();
assert.equal(
  smoothSpeed.spawnInterval,
  CONFIG.SPAWN_INTERVAL_START,
  'Adaptive difficulty must not compound the normal correct-answer speed curve'
);

const equationBounds = new GameEngine();
equationBounds.rng = () => 0.999999;
const maxAddition = equationBounds._generateEquation({ ops: ['+'], min: 10, max: 50 });
assert.equal(maxAddition.equation, '50 + 50', 'Math max must be an upper bound, not a range width');

const exactPerfect = new GameEngine();
exactPerfect.correct = 999;
exactPerfect.total = 1000;
assert.equal(exactPerfect._buildStats().isPerfectRound, false, 'Rounded 99.9% accuracy is not perfect');

assert.ok(CONFIG.CORNER_SHUFFLE_WARNING_MS <= 400, 'Corner shuffle cue must remain rhythm-safe');

const inputElement = { querySelectorAll: () => [], querySelector: () => null };
const input = new SwipeHandler(inputElement);
let gestureToken = 1;
input.onGestureStart = () => gestureToken++;
input._start({ touches: [{ clientX: 10, clientY: 10 }] });
assert.equal(input._gestureStimulusId, 1);
input._start({ touches: [{ clientX: 20, clientY: 20 }] });
assert.equal(input._gestureStimulusId, 1, 'A second finger must not replace the active gesture target');
input._cancel();
assert.equal(input._isTouch, false, 'Cancelled touches must not disable later mouse input');

input.mode = 'ultra';
assert.equal(input._classify(100, -47), 'ene', 'Ultra ENE must match its visible right-edge slot');
assert.equal(input._classify(47, -100), 'ur', 'Ultra upper-right must match its visible inner slot');
assert.equal(input._classify(-100, 47), 'wsw', 'Ultra WSW must match its visible left-edge slot');
assert.equal(input._classify(-47, 100), 'dl', 'Ultra lower-left must match its visible inner slot');

const rushAnswer = new GameEngine();
rushAnswer.running = true;
rushAnswer.practice = true;
rushAnswer.inRush = true;
rushAnswer.currentShape = { direction: 'ur', stimulusId: 1 };
rushAnswer.lastSpawnTime = performance.now() - 100;
let rushAnswerSchedules = 0;
rushAnswer._scheduleSpawn = () => { rushAnswerSchedules++; };
rushAnswer.handleSwipe('ur', performance.now(), 1);
assert.equal(rushAnswerSchedules, 0, 'Rush answers must not start a competing normal spawn timer');

const sequenzCallbacks = new GameEngine();
sequenzCallbacks.running = true;
sequenzCallbacks.mode = 'sequenz';
sequenzCallbacks._seqPhase = 'go';
sequenzCallbacks._seqPattern = ['ur'];
sequenzCallbacks._seqInputIndex = 0;
sequenzCallbacks.lastSpawnTime = performance.now() - 100;
let sequenzResults = 0;
let genericResults = 0;
sequenzCallbacks.onSequenzResult = () => { sequenzResults++; };
sequenzCallbacks.onResult = () => { genericResults++; };
sequenzCallbacks.handleSequenzInput('ur');
assert.equal(sequenzResults, 1);
assert.equal(genericResults, 0, 'Completed sequences must not emit duplicate generic feedback');
sequenzCallbacks.stop();

const originalSetTimeout = globalThis.setTimeout;
const scheduledSequenzCallbacks = [];
globalThis.setTimeout = callback => {
  scheduledSequenzCallbacks.push(callback);
  return scheduledSequenzCallbacks.length;
};
try {
  const stoppedSequenz = new GameEngine();
  stoppedSequenz.start('sequenz', 'blitz');
  stoppedSequenz.stop();
  scheduledSequenzCallbacks.at(-1)();
  assert.equal(stoppedSequenz._seqRound, 0, 'Stopping must cancel a queued Sequenz round');

  const completedSequenz = new GameEngine();
  completedSequenz.running = true;
  completedSequenz.mode = 'sequenz';
  completedSequenz._seqPhase = 'go';
  completedSequenz._seqPattern = ['ul'];
  completedSequenz.lastSpawnTime = performance.now() - 100;
  completedSequenz.handleSequenzInput('ul');
  completedSequenz.stop();
  scheduledSequenzCallbacks.at(-1)();
  assert.equal(completedSequenz._seqRound, 1, 'Stopping must cancel a queued next Sequenz round');
} finally {
  globalThis.setTimeout = originalSetTimeout;
}

const continued = new GameEngine();
continued.running = false;
continued.feverActive = true;
continued.inRush = true;
continued._shuffleInProgress = true;
continued._startTimer = () => {};
continued._startElapsedTimer = () => {};
continued._scheduleSpawn = () => {};
assert.equal(continued.continueGame(), true);
assert.equal(continued.feverActive, false);
assert.equal(continued.inRush, false);
assert.equal(continued._shuffleInProgress, false);
continued.stop();

const pausedShuffle = new GameEngine();
pausedShuffle.running = true;
pausedShuffle.mode = 'klassik';
pausedShuffle._assignCorners();
let shuffledAfterResume = 0;
pausedShuffle.onCornerShuffle = () => { shuffledAfterResume++; };
pausedShuffle._triggerCornerShuffle();
pausedShuffle.pause();
pausedShuffle._scheduleSpawn = () => {};
pausedShuffle.resume();
assert.equal(pausedShuffle._shuffleInProgress, false);
assert.equal(shuffledAfterResume, 1, 'A paused corner switch must complete exactly once after resume');
pausedShuffle.stop();

const pausedMemo = new GameEngine();
pausedMemo.running = true;
pausedMemo.mode = 'memo';
pausedMemo._memoPhase = 'playing';
pausedMemo.currentShape = { direction: 'ul', stimulusId: 1 };
pausedMemo.lastSpawnTime = performance.now() - 100;
let memoReveals = 0;
pausedMemo.onMemoReveal = () => { memoReveals++; };
pausedMemo.pause();
pausedMemo._scheduleSpawn = () => {};
pausedMemo.resume();
assert.equal(memoReveals, 0, 'Pausing normal Memo play must not reveal corners');
assert.equal(pausedMemo.currentShape.direction, 'ul', 'Memo pause must preserve the active stimulus');
pausedMemo.stop();

const terminalMiss = new GameEngine();
terminalMiss.running = true;
terminalMiss.mode = 'beginner';
terminalMiss.playType = 'endless';
terminalMiss.endlessLives = 1;
terminalMiss.endlessTotalMisses = CONFIG.ENDLESS_MAX_MISSES - 1;
terminalMiss.currentShape = { direction: 'ul', stimulusId: 1 };
terminalMiss.lastSpawnTime = performance.now() - terminalMiss._minAnswerWindow - 100;
terminalMiss._scheduleSpawn = () => {};
let terminalSpawns = 0;
terminalMiss.onSpawn = () => { terminalSpawns++; };
terminalMiss._spawn();
assert.equal(terminalMiss.running, false);
assert.equal(terminalSpawns, 0, 'No stimulus may spawn after the final endless life is lost');

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

migrated.data.competitionLevel = 0;
migrated.data.competitionStars = [];
migrated.data.ultraUnlockedViaCompetition = false;
assert.equal(await migrated.completeCompetitionLevel(0, 0), false, 'A failed stage must not advance Competition');
assert.equal(migrated.data.competitionLevel, 0);
for (let level = 0; level < CONFIG.COMPETITION_LEVELS; level++) {
  const unlocked = await migrated.completeCompetitionLevel(level, 1);
  assert.equal(unlocked, level === CONFIG.COMPETITION_LEVELS - 1, 'Ultra must unlock only after all ten stages');
}
assert.equal(migrated.data.competitionLevel, CONFIG.COMPETITION_LEVELS);
assert.equal(migrated.data.competitionStars.length, CONFIG.COMPETITION_LEVELS);

console.log('Game logic regression tests passed.');
