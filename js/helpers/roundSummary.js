import { t } from '../i18n.js';

export function roundHighlight(stats, previousPB = 0) {
  if (!stats.total) return '';
  if (previousPB > 0 && stats.score > previousPB) return t('round_pb_delta', { n: (stats.score - previousPB).toLocaleString() });
  if (stats.streak >= 5) return t('round_streak', { n: stats.streak });
  return t('round_hits', { correct: stats.correct, total: stats.total });
}

/** One truthful practice suggestion, not a diagnosis or a new difficulty. */
export function practiceSuggestion(stats) {
  if (!stats.total || stats.practice) return '';
  const key = stats.mode === 'memo' || stats.mode === 'sequenz' ? 'practice_memory'
    : stats.mode === 'stroop' || stats.mode === 'fokus' || stats.mode === 'chaos' ? 'practice_rule'
      : stats.mode === 'mathe' || stats.mode === 'wissen' ? 'practice_read' : 'practice_match';
  return t(key);
}
