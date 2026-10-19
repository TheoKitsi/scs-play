import { CONFIG } from '../config.js';
import { haptic } from './haptics.js';

/** One post-answer cue, shared by swipes, taps, keys and sequence steps.
 * Milestone/perfect callbacks must not layer additional answer buzzes on it. */
export function playGameImpact(result, game, audio, save) {
  const perfect = result.correct && Number.isFinite(result.reaction)
    && result.reaction <= CONFIG.PERFECT_WINDOW_MS;
  const quality = !result.correct ? 'miss' : result.bonus ? 'bonus'
    : perfect ? 'perfect' : 'good';
  audio.gameImpact({ correct: result.correct, quality, streak: result.streak || 0,
    mode: game.mode, fever: game.feverActive, autoMiss: result.autoMiss,
    direction: result.correct ? result.direction || result.expected : null });
  if (result.autoMiss) return;
  const pattern = !result.correct ? 'impactMiss' : result.bonus ? 'impactBonus'
    : perfect ? 'impactPerfect' : game.feverActive || (result.streak > 0 && result.streak % 10 === 0)
      ? 'impactFlow' : 'impactGood';
  haptic(pattern, save);
}
