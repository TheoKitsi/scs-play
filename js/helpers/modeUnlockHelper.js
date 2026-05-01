import { CONFIG } from '../config.js';

const MODE_UNLOCK_LEVELS = {
  klassik: 0,
  beginner: 0,
  expert: CONFIG.UNLOCK_EXPERT,
  ultra: CONFIG.UNLOCK_ULTRA,
  mathe: CONFIG.UNLOCK_MATHE,
  worte: CONFIG.UNLOCK_WORTE,
  memo: CONFIG.UNLOCK_MEMO,
  sequenz: CONFIG.UNLOCK_SEQUENZ,
  stroop: CONFIG.UNLOCK_STROOP,
  fokus: CONFIG.UNLOCK_FOKUS,
  chaos: CONFIG.UNLOCK_CHAOS,
  hauptstaedte: CONFIG.UNLOCK_HAUPTSTAEDTE,
  algebra: CONFIG.UNLOCK_ALGEBRA,
  wissen: CONFIG.UNLOCK_WISSEN,
};

export function getUnlockLevelIndex(mode) {
  if (!Object.prototype.hasOwnProperty.call(MODE_UNLOCK_LEVELS, mode)) return Infinity;
  return MODE_UNLOCK_LEVELS[mode] || 0;
}

export function getUnlockLevel(mode) {
  const levelIndex = getUnlockLevelIndex(mode);
  return Number.isFinite(levelIndex) ? levelIndex + 1 : 1;
}

export function isModeUnlocked(data, mode) {
  if (!data) return false;
  if (mode === 'ultra' && data.ultraUnlockedViaCompetition) return true;
  const levelIndex = getUnlockLevelIndex(mode);
  return Number.isFinite(levelIndex) && (data.level || 0) >= levelIndex;
}