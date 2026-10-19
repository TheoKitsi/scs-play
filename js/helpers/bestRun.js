import { CONFIG } from '../config.js';

// A scoped successor to the old, hidden mode-only ghost HUD. Uses the mastery
// save and the same accepted-answer/elapsed events, never a second game clock.
export function bestRunKey(game, duration) {
  return !game.practice && !game.isDaily && !game.continued && CONFIG.MODE_ORDER.includes(game.mode)
    && ['blitz', 'classic'].includes(game.playType) && duration > 0 && duration <= 120
    ? `v1:${game.playType}:${duration}` : null;
}

function validRun(run) {
  return run && Number.isFinite(run.score) && run.score > 0 && Array.isArray(run.pace)
    && run.pace.length > 1 && run.pace.length <= 242 && Number.isInteger(run.elapsed) && run.elapsed > 0 && run.elapsed <= 240
    && run.pace[0].t === 0 && run.pace[0].s === 0
    && run.pace.every((p, i, all) => Number.isInteger(p.t) && p.t >= 0 && p.t <= run.elapsed
      && Number.isFinite(p.s) && p.s >= 0 && (!i || p.t > all[i - 1].t));
}

export function createBestRun(game, mastery, duration) {
  const key = bestRunKey(game, duration);
  const stored = key && mastery?.get(game.mode, 'bestRuns', {})?.[key];
  const previous = validRun(stored) ? structuredClone(stored) : null;
  const pace = [{ t: 0, s: 0 }];
  let finished = false;
  const record = () => {
    if (!key || finished) return;
    const t = Math.min(240, Math.max(0, Math.floor(game.elapsed)));
    const s = Math.max(0, Math.round(game.score));
    // Keep t=0 as the true start; later points describe each completed second.
    if (!t) return;
    if (pace.at(-1).t === t) pace[pace.length - 1] = { t, s };
    else pace.push({ t, s });
  };
  return {
    eligible: Boolean(key),
    hasReference: Boolean(previous),
    record,
    delta() {
      if (!previous || !key || game.continued || game.elapsed > previous.elapsed) return null;
      let score = 0;
      for (const point of previous.pace) { if (point.t <= game.elapsed) score = point.s; else break; }
      return Math.round(game.score - score);
    },
    finish(stats, continued = false) {
      if (finished || !key || !mastery || continued || game.timer > 0 || stats.elapsed < 1 || stats.elapsed > 240 || stats.correct < 1) return false;
      record();
      finished = true;
      if (previous && stats.score <= previous.score) return false;
      if (pace.at(-1).t !== stats.elapsed) pace.push({ t: stats.elapsed, s: stats.rawScore });
      else pace[pace.length - 1].s = stats.rawScore;
      // At most two play types per current duration; old unscoped paces are
      // deliberately not promoted because their rules cannot be established.
      const runs = { ...(mastery.get(game.mode, 'bestRuns', {}) || {}) };
      delete runs[key];
      runs[key] = { score: stats.score, elapsed: stats.elapsed, pace };
      const entries = Object.entries(runs).filter(([name]) => /^v1:(blitz|classic):\d+$/.test(name)).slice(-4);
      mastery.set(game.mode, 'bestRuns', Object.fromEntries(entries));
      return true;
    },
  };
}
