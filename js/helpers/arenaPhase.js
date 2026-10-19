import { CONFIG } from '../config.js';
import { arenaWorld } from '../renderers/arenaWorld.js';

export function arenaEnergy(mode, streak = 0, fever = false) {
  const reading = arenaWorld(mode).family === 'think';
  return fever ? 'fever' : streak >= 30 ? 'surge' : streak >= (reading ? 18 : 15) ? 'charged'
    : streak >= (reading ? 8 : 5) ? 'flow' : 'calm';
}

/** A read-only view of the engine. No timers, hints, difficulty or grace. */
export function arenaPhase(game, now = performance.now()) {
  const energy = arenaEnergy(game.mode, game.streak, game.feverActive);
  if (game._shuffleInProgress) return { phase: 'shuffle', progress: 0 };
  if (game.mode === 'memo' && ['initialPreview', 'reveal'].includes(game._memoPhase)) return { phase: 'watch', progress: 1 };
  if (game.mode === 'sequenz') {
    if (game._seqPhase === 'idle') return { phase: 'ready', progress: 0 };
    const total = game._seqPattern?.length || 0;
    const watch = game._seqPhase !== 'go';
    const n = watch ? 0 : game._seqInputIndex || 0;
    return { phase: watch ? 'watch' : 'recall', n, total, progress: watch ? 1 : total ? n / total : 0 };
  }
  if (game.inRush) {
    const n = Math.min(CONFIG.RUSH_COUNT, Math.max(0, game._rushIndex || 0));
    return { phase: 'rush', n, total: CONFIG.RUSH_COUNT, progress: n / CONFIG.RUSH_COUNT };
  }
  if (game.feverActive) {
    const remaining = game.paused ? game._feverRemainingMs : CONFIG.FEVER_DURATION - (now - game._feverStartedAt);
    return { phase: 'fever', progress: Math.max(0, Math.min(1, remaining / CONFIG.FEVER_DURATION)) };
  }
  if (game._feverCooldownUntil > now) return { phase: 'cooldown', progress: 0 };
  if (game.mode === 'memo') return { phase: 'recall', progress: 0 };
  return { phase: energy, progress: ({ calm: 0, flow: .25, charged: .55, surge: .85 })[energy] || 0 };
}
