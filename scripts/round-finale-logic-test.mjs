import assert from 'node:assert/strict';
globalThis.location = { hostname: 'localhost' };
globalThis.document = { documentElement: {} };
const { bestRunKey, createBestRun } = await import('../js/helpers/bestRun.js');
const { roundHighlight, practiceSuggestion } = await import('../js/helpers/roundSummary.js');
const { setLanguage } = await import('../js/i18n.js');
const { GameEngine } = await import('../js/game/GameEngine.js');

const practice = new GameEngine();
practice.running = true;
practice.practice = true;
practice.currentShape = { stimulusId: 1 };
practice._scheduleSpawn(1);
assert.equal(practice._spawnTimeout, null, 'An unanswered practice task has no replacement deadline');
practice._startSeqInputTimeout();
assert.equal(practice._seqInputTimeout, null, 'Sequence practice has no input timeout');
practice.mode = 'sequenz';
practice.playType = 'endless';
practice.endlessLives = 5;
practice._scheduleSequenzRound = () => {};
for (let n = 0; n < 7; n++) {
  practice._seqPhase = 'go'; practice._seqPattern = ['ul']; practice._seqInputIndex = 0;
  practice.handleSequenzInput('dr');
}
assert.equal(practice.endlessLives, 5, 'Sequence practice cannot use up round lives');
assert.equal(practice.running, true);
practice.stop();

const values = {};
const mastery = { get: (mode, key, fallback) => values[mode]?.[key] ?? fallback, set: (mode, key, value) => { (values[mode] ||= {})[key] = value; } };
const game = { mode: 'klassik', playType: 'blitz', elapsed: 0, score: 0, timer: 30, continued: false };
assert.equal(bestRunKey(game, 30), 'v1:blitz:30');
for (const variation of [{ practice: true }, { isDaily: true }, { continued: true }, { playType: 'competition' }, { playType: 'endless' }, { mode: '__proto__' }]) {
  assert.equal(bestRunKey({ ...game, ...variation }, 30), null);
}
const stats = { mode: 'klassik', playType: 'blitz', total: 20, correct: 18, streak: 12, score: 1400, rawScore: 1200, elapsed: 24 };
const run = createBestRun(game, mastery, 30);
assert.equal(run.hasReference, false);
assert.equal(run.delta(), null);
for (let t = 1; t <= 24; t++) { game.elapsed = t; game.score = t * 50; run.record(); run.record(); }
game.timer = 0;
// Engine declineContinue sets continued=true too; only a USED continuation
// disqualifies the comparison. Penalty/bonus time remains legitimate play.
game.continued = true;
assert.equal(run.finish(stats, false), true);
assert.equal(run.finish(stats), false, 'A reference is committed once');
assert.equal(values.klassik.bestRuns['v1:blitz:30'].pace.length, 25);
assert.equal(values.klassik.bestRuns['v1:blitz:30'].pace.at(-1).s, 1200, 'Never add end bonuses to a live pace');
game.continued = false; game.elapsed = 0; game.score = 0;
const compare = createBestRun(game, mastery, 30);
assert.equal(compare.hasReference, true);
assert.equal(compare.delta(), 0, 'No future points leaked before the first second');
game.elapsed = 10; game.score = 600;
assert.equal(compare.delta(), 100);
game.elapsed = 25;
assert.equal(compare.delta(), null, 'Stop comparing after the reference ended');
assert.equal(createBestRun(game, mastery, 60).hasReference, false, 'Different durations are isolated');
assert.equal(createBestRun({ ...game, playType: 'classic' }, mastery, 30).hasReference, false, 'Different play types are isolated');
assert.equal(createBestRun({ ...game, mode: 'beginner' }, mastery, 30).hasReference, false, 'Different modes are isolated');
const retained = JSON.stringify(values);
assert.equal(compare.finish({ ...stats, score: 9999 }, true), false, 'Used continuation cannot replace a reference');
assert.equal(JSON.stringify(values), retained);
const early = createBestRun({ ...game, timer: 1 }, mastery, 30);
assert.equal(early.finish({ ...stats, score: 9999 }), false, 'Forced/early ends are not full reference rounds');
values.klassik.bestRuns['v1:blitz:40'] = { score: 100, elapsed: 10, pace: [{ t: 0, s: 0 }, { t: 9, s: Infinity }] };
assert.equal(createBestRun(game, mastery, 40).hasReference, false, 'Malformed saved paths are ignored');

for (const language of ['de', 'en']) {
  setLanguage(language);
  assert.equal(roundHighlight({ total: 0 }), '');
  assert.ok(roundHighlight(stats, 1000).includes('400'));
  assert.ok(roundHighlight(stats).includes('12'));
  assert.equal(practiceSuggestion({ ...stats, practice: true }), '');
  for (const mode of ['klassik', 'beginner', 'expert', 'mathe', 'wissen', 'memo', 'sequenz', 'stroop', 'fokus', 'chaos']) {
    assert.ok(practiceSuggestion({ ...stats, mode }).includes(language === 'de' ? 'ohne' : 'no '));
  }
}
console.log('PASS scoped, bounded, bonus-safe best-run references and truthful DE/EN result/practice summaries');
