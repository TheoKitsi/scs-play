import { CONFIG } from '../../config.js';
import { getLanguage, t } from '../../i18n.js';

// These are instructions for the instrument, independent of any live item.
const guides = {
  klassik: ['Vergleiche die Farben.', 'Match the colors.'],
  beginner: ['Vergleiche die Umrisse.', 'Match the outlines.'],
  expert: ['Suche die Form auf dem Ring.', 'Find the shape on the ring.'],
  mathe: ['Rechne zuerst, wähle dann.', 'Solve first, then choose.'],
  wissen: ['Lies die Frage bis zum Ende.', 'Read the whole question.'],
  memo: ['Merke dir, wo jedes Symbol liegt.', 'Remember where each symbol sits.'],
  sequenz: ['Warte auf das Signal zum Nachspielen.', 'Wait for the signal to repeat.'],
  stroop: ['Achte auf die Schriftfarbe.', 'Look at the ink color.'],
  fokus: ['Lies den Pfeil in der Mitte.', 'Read the middle arrow.'],
  chaos: ['Prüfe zuerst die aktuelle Regel.', 'Check the current rule first.'],
};
export function roundGuide(mode) {
  const lang = getLanguage();
  return guides[mode]?.[lang === 'de' ? 0 : 1] || CONFIG.RULE_LABELS[lang]?.[mode] || '';
}

// A single ephemeral receipt, including a continuation. No question history.
let misses = null;
export function beginMissReceipt(id) { misses = { id, picks: 0, late: 0 }; }
export function noteMiss(id, late) {
  if (misses?.id === id) misses[late ? 'late' : 'picks']++;
}
export function missReceipt(id) {
  return misses?.id === id && (misses.picks || misses.late) ? misses : null;
}

export function clockFact(game) {
  const de = getLanguage() === 'de';
  if (game.practice) return [t('practice_mode'), '∞'];
  if (game.playType === 'endless') return [de ? 'Rundenleben' : 'Round lives', game.endlessLives];
  return [de ? 'Restzeit' : 'Time left', `${Math.max(0, game.timer)} s`];
}
