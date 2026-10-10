import assert from 'node:assert/strict';

globalThis.location = { hostname: 'localhost' };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE' }, configurable: true });
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
globalThis.document = { addEventListener() {} };

const { SaveService } = await import('../js/save.js');
const { GameEngine } = await import('../js/game/GameEngine.js');
const { ModeMastery } = await import('../js/game/ModeMastery.js');
const { generateAchievements, getAchById } = await import('../js/achievements/AchievementSystem.js');
const { getOrSeedQuests, recordGameResult, autoClaim } = await import('../js/services/DailyQuestService.js');

async function fresh(data) {
  storage.clear();
  if (data) storage.set('scs_save:guest', JSON.stringify(data));
  const save = new SaveService({ isGuest: true, user: { id: 'guest' } });
  await save.load();
  return save;
}

function round(overrides = {}) {
  const engine = new GameEngine();
  Object.assign(engine, {
    mode: 'klassik', playType: 'blitz', elapsed: 30,
    score: 2000, correct: 18, total: 20, wrong: 2, bestStreak: 12,
    reactionTimes: Array(18).fill(350), ...overrides,
  });
  engine.wrong = engine.total - engine.correct;
  return engine._buildStats();
}

const finish = (save, stats) => save.withBatch(async () => {
  const result = await save.addScore(stats);
  if (result.duplicate) return { ...result, unlocked: [], completed: [] };
  const completed = recordGameResult(save, stats);
  const goal = await autoClaim(save);
  const daily = stats.isDaily ? await save.claimDailyReward(stats) : null;
  const unlocked = save.checkAchievements(stats, save.getGamesPlayed());
  await save.save();
  return { ...result, unlocked, completed, goal, daily };
});

assert.equal(generateAchievements().length, 17, 'The active catalog must contain only meaningful, distinct milestones');

for (const mode of ['mathe', 'wissen', 'stroop', 'fokus', 'chaos']) {
  const save = await fresh();
  const result = await finish(save, round({ mode, elapsed: 40, correct: 5, total: 5, reactionTimes: Array(5).fill(2500) }));
  assert.equal(result.xpEarned, 30, 'Reading/thinking rounds qualify at a mode-appropriate sample size');
  assert.equal(result.unlocked.length, 0);
}

for (const stats of [round(), round({ score: 1000000, correct: 80, total: 80, bestStreak: 80, reactionTimes: Array(80).fill(150) })]) {
  const save = await fresh();
  const result = await finish(save, stats);
  assert.ok(result.xpEarned >= 20 && result.xpEarned <= 30, 'A first Blitz round has a bounded reward even at extreme score/speed');
  assert.equal(save.getLevel(), 0, 'The first round cannot jump through account levels');
  assert.equal(result.isNewPB, false, 'The first score establishes a baseline rather than a record celebration');
  assert.deepEqual(result.unlocked, [], 'A first round must not unlock overlapping performance achievements');
  assert.equal(result.completed.length, 0);
  assert.equal(getOrSeedQuests(save).length, 1);
  assert.ok(getOrSeedQuests(save)[0].progress <= 1);
  assert.equal(save.data.seasonPass, null, 'Normal rounds do not start or pay a season pass');
  assert.ok(result.fireEarned <= 3);
  const mastery = new ModeMastery(save);
  mastery.set('klassik', 'zone200', 80);
  mastery.set('klassik', 'bestFlawless', 80);
  mastery.set('klassik', 'totalGames', 1);
  assert.equal(mastery.getMasteryTier('klassik').tier, 0, 'Even strong first-round metrics do not establish a mastery rank');
}

{
  const save = await fresh();
  const stats = round({ score: 1000000, correct: 1000, total: 1001, reactionTimes: Array(1000).fill(200) });
  assert.equal(stats.accuracy, 100);
  await finish(save, stats);
  assert.equal(save.data.progression.perfectRounds, 0, 'Rounded 100% is not an exactly flawless round');
  assert.ok(stats.xp <= 30, 'Per-answer lightning rewards cannot inflate XP');
}

for (const stats of [
  round({ elapsed: 0, total: 0, correct: 0 }),
  round({ elapsed: 10 }), round({ total: 4, correct: 4 }), round({ correct: 0 }),
  round({ practice: true }), { ...round(), aborted: true },
]) {
  const save = await fresh();
  const result = await finish(save, stats);
  assert.equal(result.xpEarned, 0, 'Empty, short, practice or aborted rounds must not farm rewards');
  assert.equal(result.fireEarned, 0);
  assert.equal(save.data.progression.qualifiedRounds, 0);
  assert.equal(getOrSeedQuests(save)[0].progress, 0);
  assert.deepEqual(result.unlocked, []);
}

{
  const save = await fresh();
  assert.equal((await save.addScore(round({ playType: 'classic', elapsed: 60, total: 30, correct: 30 }))).xpEarned, 50);
  const long = round({ playType: 'endless', elapsed: 3600, score: 1000000, total: 1000, correct: 1000 });
  assert.ok((await save.addScore(long)).xpEarned <= 110, 'Long Endless runs scale by playtime but cannot mint thousands of XP');
}

{
  const save = await fresh();
  save.data.dailyXPDate = new Date().toISOString().slice(0, 10);
  save.data.dailyXPEarned = 2990;
  const stats = round({ total: 20, correct: 20 });
  const result = await save.addScore(stats);
  assert.equal(result.xpEarned, 18, 'Diminishing returns apply to the new bounded XP budget');
  assert.equal(save.getModeXP('klassik'), 18);
}

{
  const save = await fresh();
  const goal = getOrSeedQuests(save)[0];
  goal.type = 'games';
  const awards = [];
  for (let i = 1; i <= 20; i++) {
    const result = await finish(save, round());
    awards.push(result.unlocked);
    if (i < 3) assert.equal(result.goal.xp, 0, 'A daily goal cannot finish after one or two rounds');
    if (i === 3) assert.equal(result.goal.xp, 15);
    if (i > 3) assert.equal(result.goal.xp, 0, 'Daily rewards are paid once');
  }
  assert.deepEqual(awards[4].sort(), ['consistent_rounds_5', 'games_total_5']);
  assert.ok(awards.every(ids => ids.length <= 2), 'The old unlock flood must not reappear on round 3, 5, or later');
  assert.equal(save.getTotalXP(), 20 * 25 + 15);
  assert.ok(save.getAchievements().length < 5);
  await save.load();
  assert.equal(save.data.progression.qualifiedRounds, 20, 'Qualified activity survives reload');
  assert.equal((await autoClaim(save)).xp, 0);
}

{
  const save = await fresh();
  const goal = getOrSeedQuests(save)[0];
  goal.type = 'games';
  const stats = round();
  await finish(save, stats);
  const before = structuredClone(save.data);
  assert.equal((await finish(save, stats)).duplicate, true);
  assert.deepEqual(save.data, before, 'The same finalized round cannot pay XP, currency, or goal progress twice');
  recordGameResult(save, stats);
  assert.equal(goal.progress, 1, 'The goal also guards repeated round IDs');
  await save.load();
  assert.equal((await finish(save, stats)).duplicate, true, 'Round receipts guard duplicates after reload');
  const improvement = await finish(save, round({ score: 3000 }));
  assert.equal(improvement.isNewPB, true, 'A subsequent real improvement is still a personal record');
}

{
  const save = await fresh();
  const emptyDaily = round({ isDaily: true, total: 0, correct: 0 });
  await finish(save, emptyDaily);
  assert.equal(save.hasDailyToday(), false, 'An empty daily run must not mark the challenge complete');
  const stats = round({ isDaily: true });
  const first = await finish(save, stats);
  assert.equal(first.daily.xp, 10);
  assert.equal(save.getLevel(), 0);
  assert.equal(first.unlocked.length, 0);
  assert.equal(await save.claimDailyReward(stats), null);
}

{
  const today = new Date().toISOString().slice(0, 10);
  const legacy = {
    totalXP: 5000, level: 5, fire: 400, lives: 7, gamesPlayed: 100,
    achievements: ['score_any_5000', 'games_total_5', 'diamond_catch'],
    purchases: { theme_neon: true }, pb_klassik: 9000,
    scores_klassik: [{ score: 9000, playType: 'blitz', date: today }],
    modeMastery: { klassik: { totalGames: 5, zone300: 20, bestFlawless: 20 } },
    seasonPass: { startDate: today, points: 80, claimedStages: [0, 1] },
    dailyQuests: { date: today, quests: [{ id: 'old', progress: 1, target: 1, claimed: true, rewardXP: 100 }] },
  };
  const save = await fresh(legacy);
  const goal = getOrSeedQuests(save)[0];
  assert.equal(goal.claimed, true, 'A previously claimed day cannot pay another goal after migration');
  assert.equal((await autoClaim(save)).xp, 0);
  assert.equal(save.getTotalXP(), 5000);
  assert.equal(save.getFireBalance(), 400);
  assert.equal(save.getLives(), 7);
  assert.equal(save.hasPurchase('theme_neon'), true);
  assert.equal(save.getPB('klassik'), 9000);
  assert.ok(save.getAchievements().includes('score_any_5000'));
  assert.ok(getAchById('score_any_5000')?.name.de, 'Archived awards retain their readable names');
  assert.ok(new ModeMastery(save).getMasteryTier('klassik').tier > 0, 'Previously earned mastery ranks are preserved');
  const first = await finish(save, round());
  assert.equal(first.isNewPB, false, 'Legacy ruleset history must not be replaced by a lower new baseline');
  assert.equal(save.getPB('klassik', 'blitz'), 9000);
  assert.equal(first.unlocked.length, 0, 'Legacy aggregate stats cannot unlock a new backlog');
  assert.deepEqual(save.data.seasonPass, legacy.seasonPass, 'Retired season state and already claimed stages are retained');
  await save.load();
  assert.equal(save.getTotalXP(), 5025);
  assert.ok(new ModeMastery(save).getMasteryTier('klassik').tier > 0);
}

{
  const save = await fresh();
  for (let i = 0; i < 5; i++) await finish(save, round({ mode: 'fokus' }));
  const mastery = new ModeMastery(save);
  mastery.set('fokus', 'bestFocusScore', 100);
  mastery.set('fokus', 'totalCorrect', 100);
  mastery.set('fokus', 'congruentCorrect', 50);
  mastery.set('fokus', 'incongruentCorrect', 1);
  assert.equal(mastery.getMasteryTier('fokus').tier, 0, 'One-sided samples do not establish focus mastery');
  mastery.set('fokus', 'incongruentCorrect', 20);
  assert.ok(mastery.getMasteryTier('fokus').tier > 0, 'Repeated, sufficiently sampled performance can earn a rank');
}

{
  const save = await fresh();
  save.data.lastLoginDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  save.data.loginStreak = 100;
  await save.claimDailyLogin();
  assert.equal(save.getFireBalance(), 5, 'Long login streaks do not create an unbounded currency allowance');
  assert.equal(save.getTotalXP(), 0);
  assert.equal(save.data.progression.activeDays.length, 0, 'Opening the app is not a completed training day');
}

{
  const save = await fresh();
  const before = structuredClone(save.data);
  const write = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('storage full'); };
  try {
    await assert.rejects(finish(save, round()), /storage full/);
  } finally {
    localStorage.setItem = write;
  }
  assert.deepEqual(save.data, before, 'A failed round commit rolls back XP, goals, achievements and the receipt together');
}

console.log('Lean progression regression tests passed.');
