/* One bounded round reward and a small set of evidence-based milestones. */
const PROGRESSION_VERSION = 1;
export const DAILY_REWARD = Object.freeze({ xp: 10, fire: 1, lives: 0 });

export function getRoundRequirements(stats) {
  const readingMode = ['mathe', 'worte', 'algebra', 'hauptstaedte', 'wissen', 'stroop', 'fokus', 'chaos'].includes(stats?.mode);
  const minAnswers = readingMode ? 5 : stats?.mode === 'sequenz' ? 6 : 10;
  return { minAnswers, minCorrect: Math.ceil(minAnswers / 2), perfectAnswers: readingMode ? 5 : stats?.mode === 'sequenz' ? 6 : 15 };
}

export function isQualifiedRound(stats) {
  const { minAnswers, minCorrect } = getRoundRequirements(stats);
  return Boolean(stats && !stats.practice && !stats.aborted
    && Number(stats.elapsed) >= 20 && Number(stats.total) >= minAnswers
    && Number(stats.correct) >= minCorrect && Number(stats.correct) <= Number(stats.total));
}

export function getRoundRewards(stats) {
  if (!isQualifiedRound(stats)) return { qualified: false, baseXP: 0, performanceXP: 0, perfectXP: 0, xp: 0, fire: 0 };
  const accuracy = Number(stats.correct) / Number(stats.total);
  const baseXP = stats.playType === 'classic' ? 40
    : stats.playType === 'endless' ? Math.min(100, Math.max(20, Math.floor(stats.elapsed / 60) * 20))
      : 20;
  const perfectXP = stats.correct === stats.total && stats.total >= getRoundRequirements(stats).perfectAnswers ? 5 : 0;
  const performanceXP = (accuracy >= 0.9 ? 5 : 0) + perfectXP;
  return {
    qualified: true, baseXP, performanceXP, perfectXP, xp: baseXP + performanceXP,
    fire: Math.min(3, Math.max(0, Math.floor((Number(stats.streak) || 0) / 10))),
  };
}

export function ensureProgression(data) {
  if (!data.progression || data.progression.version !== PROGRESSION_VERSION) {
    data.progression = {
      version: PROGRESSION_VERSION,
      qualifiedRounds: 0, consistentRounds: 0, perfectRounds: 0,
      modeRounds: {}, modeAnswers: {}, practicedModes: 0,
      activeDays: [], previous: {}, recentRounds: [], masteryFloors: {},
      migrateMastery: Object.values(data.modeMastery || {}).some(mode => mode.totalGames > 0),
    };
  }
  const p = data.progression;
  for (const key of ['qualifiedRounds', 'consistentRounds', 'perfectRounds', 'practicedModes']) {
    p[key] = Number.isFinite(p[key]) ? Math.max(0, Math.trunc(p[key])) : 0;
  }
  for (const key of ['modeRounds', 'modeAnswers', 'previous', 'masteryFloors']) {
    if (!p[key] || typeof p[key] !== 'object' || Array.isArray(p[key])) p[key] = {};
  }
  for (const key of ['activeDays', 'recentRounds']) {
    if (!Array.isArray(p[key])) p[key] = [];
  }
  return data.progression;
}

export function recordRoundProgress(data, stats) {
  const p = ensureProgression(data);
  p.previous = {
    qualifiedRounds: p.qualifiedRounds, consistentRounds: p.consistentRounds,
    perfectRounds: p.perfectRounds, practicedModes: p.practicedModes,
    activeDays: p.activeDays.length,
  };
  if (!isQualifiedRound(stats)) return;
  p.qualifiedRounds++;
  if (stats.correct / stats.total >= 0.9) p.consistentRounds++;
  if (getRoundRewards(stats).perfectXP > 0) p.perfectRounds++;
  p.modeRounds[stats.mode] = (p.modeRounds[stats.mode] || 0) + 1;
  p.modeAnswers[stats.mode] = (p.modeAnswers[stats.mode] || 0) + stats.total;
  const families = { ultra: 'expert', algebra: 'mathe', worte: 'wissen', hauptstaedte: 'wissen' };
  const practiced = new Set(Object.entries(p.modeRounds)
    .filter(([, rounds]) => rounds >= 5).map(([mode]) => families[mode] || mode));
  p.practicedModes = practiced.size;
  const today = new Date().toISOString().slice(0, 10);
  if (!p.activeDays.includes(today)) p.activeDays.push(today);
}
