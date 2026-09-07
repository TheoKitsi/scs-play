import assert from 'node:assert/strict';

globalThis.location = { hostname: 'localhost' };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE' }, configurable: true });
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
globalThis.document = { addEventListener() {} };

const { SaveService } = await import('../js/save.js');
const { recordGameResult, autoClaim } = await import('../js/services/DailyQuestService.js');
const { PASS_STAGES, addBonusPoints, collectReachedRewards } = await import('../js/services/SeasonPass.js');

const auth = { isGuest: true, user: { id: 'guest' } };
const save = new SaveService(auth);
await save.load();

save.data.dailyXPDate = new Date().toISOString().slice(0, 10);
save.data.dailyXPEarned = 2990;
const scoreResult = await save.addScore({
  mode: 'klassik', playType: 'blitz', score: 100, streak: 0,
  accuracy: 80, avgReaction: 500, correct: 4, total: 5, xp: 100
});
assert.equal(scoreResult.xpEarned, 46, 'addScore must return the effective XP after diminishing returns');
assert.equal(save.data.totalXP, 46);

save.data.totalXP = 90;
save.data.level = 0;
save.data.dailyQuests = {
  date: new Date().toISOString().slice(0, 10),
  quests: [{ id: 'test', type: 'games', target: 1, progress: 0, claimed: false, rewardXP: 20, rewardFire: 3 }]
};
recordGameResult(save, { total: 1 });
const questReward = await autoClaim(save);
assert.equal(questReward.leveledUp, true, 'Quest XP must immediately recalculate the level');
assert.equal(save.getLevel(), 1);
assert.equal(save.getTotalXP(), 110);

save.data.dailyQuests = {
  date: new Date().toISOString().slice(0, 10),
  quests: [{ id: 'acc80', type: 'accuracy', target: 80, progress: 0, claimed: false, rewardXP: 1, rewardFire: 0 }]
};
assert.equal(recordGameResult(save, { accuracy: 100, total: 4 }).length, 0);
assert.equal(recordGameResult(save, { accuracy: 80, total: 5 }).length, 1, 'Accuracy quests require at least five answers');

assert.equal(PASS_STAGES.at(-1).at, (5 + 3) * 10, 'Ten active days with four missed days must reach the final stage');
save.data.seasonPass = {
  startDate: new Date().toISOString().slice(0, 10),
  points: 0,
  dailyGameCount: {},
  claimedStages: []
};
save.data.seasonPass.points = 77;
assert.equal(addBonusPoints(save, 4), 3, 'Quest pass points must be capped at three per day');
assert.equal(addBonusPoints(save, 1), 0);
const beforePassXP = save.getTotalXP();
const firstClaim = await collectReachedRewards(save);
assert.equal(firstClaim.stages.length, PASS_STAGES.length, 'Collect must include every reached stage');
assert.equal(save.getTotalXP(), beforePassXP + PASS_STAGES.reduce((sum, stage) => sum + stage.xp, 0));
assert.equal(save.data.streakFreezes, 1);
const balances = { xp: save.getTotalXP(), fire: save.data.fire, freeze: save.data.streakFreezes };
const secondClaim = await collectReachedRewards(save);
assert.equal(secondClaim.stages.length, 0, 'Collect must be idempotent');
assert.deepEqual(
  { xp: save.getTotalXP(), fire: save.data.fire, freeze: save.data.streakFreezes },
  balances
);

console.log('Progression logic regression tests passed.');
