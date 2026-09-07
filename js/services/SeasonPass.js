/* ═══════════════════════════════════════
   SCS Play — Season Pass (Free Track)
   14-day rolling window, 10 stages, free only.
   Points come from completed daily quests
   and (capped) raw games played per day.
   Persistence: save.data.seasonPass = {
     startDate:      'YYYY-MM-DD',
      points:         number,
      dailyGameCount: { 'YYYY-MM-DD': n },
      dailyQuestCount:{ 'YYYY-MM-DD': n },
     claimedStages:  [stage indices already redeemed]
   }
   ═══════════════════════════════════════ */

export const PASS_STAGES = [
  { at: 4,  xp: 50,  fire: 5  },
  { at: 8,  xp: 75,  fire: 8  },
  { at: 14, xp: 100, fire: 10 },
  { at: 20, xp: 130, fire: 12 },
  { at: 28, xp: 160, fire: 15 },
  { at: 36, xp: 200, fire: 18 },
  { at: 45, xp: 240, fire: 22 },
  { at: 55, xp: 300, fire: 28 },
  { at: 67, xp: 380, fire: 35 },
  { at: 80, xp: 500, fire: 50, freeze: 1 }
];
const PASS_DURATION_DAYS = 14;
const DAILY_GAME_POINTS_CAP = 5;
const DAILY_QUEST_POINTS_CAP = 3;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function ensureState(save) {
  if (!save || !save.data) return null;
  let s = save.data.seasonPass;
  const today = todayKey();
  if (!s || !s.startDate) {
    s = { startDate: today, points: 0, dailyGameCount: {}, dailyQuestCount: {}, claimedStages: [] };
    save.data.seasonPass = s;
    return s;
  }
  /* Reset window when expired */
  const start = new Date(s.startDate + 'T00:00:00');
  const now   = new Date(today      + 'T00:00:00');
  const days  = Math.floor((now - start) / 86400000);
  if (days >= PASS_DURATION_DAYS) {
    s = { startDate: today, points: 0, dailyGameCount: {}, dailyQuestCount: {}, claimedStages: [] };
    save.data.seasonPass = s;
  }
  if (!s.dailyGameCount) s.dailyGameCount = {};
  if (!s.dailyQuestCount) s.dailyQuestCount = {};
  if (!Array.isArray(s.claimedStages)) s.claimedStages = [];
  return s;
}

/* Add points for one game played (capped per day) */
export function recordGamePoint(save) {
  const s = ensureState(save);
  if (!s) return 0;
  const today = todayKey();
  const cur = s.dailyGameCount[today] || 0;
  if (cur >= DAILY_GAME_POINTS_CAP) return 0;
  s.dailyGameCount[today] = cur + 1;
  s.points = (s.points || 0) + 1;
  return 1;
}

/* Add bonus points (e.g. for completed quests) */
export function addBonusPoints(save, n) {
  const s = ensureState(save);
  if (!s || !n) return 0;
  const today = todayKey();
  const cur = s.dailyQuestCount[today] || 0;
  const added = Math.min(Math.max(0, Math.floor(n)), Math.max(0, DAILY_QUEST_POINTS_CAP - cur));
  if (!added) return 0;
  s.dailyQuestCount[today] = cur + added;
  s.points = (s.points || 0) + added;
  return added;
}

/* Pay every newly reached stage exactly once, including skipped stages. */
export async function collectReachedRewards(save) {
  const s = ensureState(save);
  if (!s) return { stages: [], xp: 0, fire: 0, freeze: 0, leveledUp: false };

  const claimed = new Set(s.claimedStages.map(Number));
  const stages = [];
  let xp = 0, fire = 0, freeze = 0;
  for (let i = 0; i < PASS_STAGES.length; i++) {
    const reward = PASS_STAGES[i];
    if ((s.points || 0) < reward.at || claimed.has(i)) continue;
    claimed.add(i);
    stages.push(i);
    xp += reward.xp || 0;
    fire += reward.fire || 0;
    freeze += reward.freeze || 0;
  }
  if (!stages.length) return { stages, xp, fire, freeze, leveledUp: false };

  s.claimedStages = [...claimed].filter(Number.isInteger).sort((a, b) => a - b);
  if (fire) save.data.fire = (save.data.fire || 0) + fire;
  if (freeze) save.data.streakFreezes = Math.min(2, (save.data.streakFreezes || 0) + freeze);
  const xpResult = xp ? await save.grantXP(xp) : { leveledUp: false };
  if (!xp) await save.save();
  return { stages, xp, fire, freeze, leveledUp: !!xpResult.leveledUp };
}

export function getProgress(save) {
  const s = ensureState(save);
  if (!s) return null;
  const points = s.points || 0;
  let curStage = 0;
  for (let i = 0; i < PASS_STAGES.length; i++) {
    if (points >= PASS_STAGES[i].at) curStage = i + 1;
  }
  const next = PASS_STAGES[curStage] || null;
  const start = new Date(s.startDate + 'T00:00:00');
  const now   = new Date(todayKey()  + 'T00:00:00');
  const dayIdx = Math.floor((now - start) / 86400000);
  const daysLeft = Math.max(0, PASS_DURATION_DAYS - dayIdx);
  return {
    points,
    stage: curStage,
    totalStages: PASS_STAGES.length,
    nextAt: next ? next.at : PASS_STAGES[PASS_STAGES.length - 1].at,
    daysLeft,
    claimedStages: s.claimedStages.slice()
  };
}
