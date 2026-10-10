/* One deterministic daily goal, requiring three genuinely played rounds. */
import { isQualifiedRound, ensureProgression } from './ProgressionService.js';

const QUEST_VERSION = 1;
function todayKey() { return new Date().toISOString().slice(0, 10); }

export function getOrSeedQuests(save) {
  if (!save?.data) return [];
  const today = todayKey();
  const current = save.data.dailyQuests;
  const currentGoals = Array.isArray(current?.quests) ? current.quests : [];
  if (current?.date === today && current.version === QUEST_VERSION && currentGoals.length === 1 && currentGoals[0]) {
    const goal = currentGoals[0];
    goal.type = 'games';
    goal.target = 3;
    goal.progress = goal.claimed ? 3 : Math.min(3, Math.max(0, Number(goal.progress) || 0));
    goal.rewardXP = 15;
    goal.rewardFire = 2;
    if (goal.labelKey !== 'quest_legacy_completed') goal.labelKey = 'quest_lean_games';
    return currentGoals;
  }
  const goal = { id: 'play3', type: 'games', labelKey: 'quest_lean_games', target: 3, progress: 0, claimed: false, rewardXP: 15, rewardFire: 2 };
  if (current?.date === today) {
    ensureProgression(save.data).legacyDailyQuests = current;
    if (currentGoals.some(quest => quest?.claimed)) {
      goal.progress = goal.target;
      goal.claimed = true;
      goal.labelKey = 'quest_legacy_completed';
    } else {
      const rounds = currentGoals.filter(quest => quest?.type === 'games').map(quest => Number(quest.progress) || 0);
      goal.type = 'games';
      goal.labelKey = 'quest_lean_games';
      goal.progress = Math.min(2, Math.max(0, ...rounds));
    }
  }
  save.data.dailyQuests = { date: today, version: QUEST_VERSION, quests: [goal] };
  return save.data.dailyQuests.quests;
}

export function recordGameResult(save, stats) {
  const goals = getOrSeedQuests(save);
  if (!isQualifiedRound(stats)) return [];
  const completed = [];
  for (const goal of goals) {
    if (goal.claimed || goal.progress >= goal.target) continue;
    if (stats.roundId && goal.lastRoundId === stats.roundId) continue;
    if (stats.roundId) goal.lastRoundId = stats.roundId;
    goal.progress = Math.min(goal.target, goal.progress + 1);
    if (goal.progress >= goal.target) completed.push(goal);
  }
  return completed;
}

export async function autoClaim(save) {
  const goals = getOrSeedQuests(save);
  let xp = 0, fire = 0;
  for (const goal of goals) {
    if (!goal.claimed && goal.progress >= goal.target) {
      goal.claimed = true;
      xp += goal.rewardXP;
      fire += goal.rewardFire;
    }
  }
  if (fire) save.data.fire = (save.data.fire || 0) + fire;
  const result = xp ? await save.grantXP(xp) : { leveledUp: false };
  if (!xp && fire) await save.save();
  return { xp, fire, leveledUp: !!result.leveledUp };
}

export function countCompleted(save) {
  return getOrSeedQuests(save).filter(goal => goal.progress >= goal.target).length;
}
