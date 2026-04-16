/* ═══════════════════════════════════════════════
   SCS Play — Mode Mastery System
   Per-mode tracking, sub-scores, mastery levels.
   Each mode registers custom metrics that feed
   into a mode-specific mastery profile.
   ═══════════════════════════════════════════════ */
import { CONFIG } from '../config.js';

/**
 * Generic per-mode mastery tracker.
 * Stores data under save.data.modeMastery[mode].
 * Each mode can define its own metric keys via CONFIG.MODE_MASTERY_DEFS.
 */
export class ModeMastery {
  constructor(saveService) {
    this.save = saveService;
  }

  /* ── Read / Write helpers ── */
  _ensure(mode) {
    if (!this.save.data.modeMastery) this.save.data.modeMastery = {};
    if (!this.save.data.modeMastery[mode]) this.save.data.modeMastery[mode] = {};
    return this.save.data.modeMastery[mode];
  }

  get(mode, key, fallback = 0) {
    const m = this._ensure(mode);
    return m[key] ?? fallback;
  }

  set(mode, key, value) {
    const m = this._ensure(mode);
    m[key] = value;
  }

  inc(mode, key, amount = 1) {
    const m = this._ensure(mode);
    m[key] = (m[key] || 0) + amount;
    return m[key];
  }

  max(mode, key, value) {
    const m = this._ensure(mode);
    m[key] = Math.max(m[key] || 0, value);
    return m[key];
  }

  getAll(mode) {
    return this._ensure(mode);
  }

  /* ── Array metrics (e.g. history of reaction times) ── */
  push(mode, key, value, maxLen = 50) {
    const m = this._ensure(mode);
    if (!Array.isArray(m[key])) m[key] = [];
    m[key].push(value);
    if (m[key].length > maxLen) m[key] = m[key].slice(-maxLen);
    return m[key];
  }

  getArray(mode, key) {
    const m = this._ensure(mode);
    return Array.isArray(m[key]) ? m[key] : [];
  }

  /* ── Set metrics (e.g. collected words, countries) ── */
  addToSet(mode, key, value) {
    const m = this._ensure(mode);
    if (!Array.isArray(m[key])) m[key] = [];
    if (!m[key].includes(value)) {
      m[key].push(value);
      return true;
    }
    return false;
  }

  getSet(mode, key) {
    const m = this._ensure(mode);
    return Array.isArray(m[key]) ? m[key] : [];
  }

  setSize(mode, key) {
    return this.getSet(mode, key).length;
  }

  /* ── Map metrics (e.g. per-direction stats) ── */
  mapInc(mode, mapKey, subKey, amount = 1) {
    const m = this._ensure(mode);
    if (!m[mapKey] || typeof m[mapKey] !== 'object' || Array.isArray(m[mapKey])) m[mapKey] = {};
    m[mapKey][subKey] = (m[mapKey][subKey] || 0) + amount;
    return m[mapKey][subKey];
  }

  mapGet(mode, mapKey, subKey, fallback = 0) {
    const m = this._ensure(mode);
    if (!m[mapKey] || typeof m[mapKey] !== 'object') return fallback;
    return m[mapKey][subKey] ?? fallback;
  }

  mapGetAll(mode, mapKey) {
    const m = this._ensure(mode);
    if (!m[mapKey] || typeof m[mapKey] !== 'object' || Array.isArray(m[mapKey])) return {};
    return m[mapKey];
  }

  /* ── Mastery tier calculation ── */
  getMasteryTier(mode) {
    const def = CONFIG.MODE_MASTERY_DEFS?.[mode];
    if (!def || !def.tiers) return { tier: 0, name: '', next: null };
    const score = this.getMasteryScore(mode);
    let tier = 0;
    for (let i = def.tiers.length - 1; i >= 0; i--) {
      if (score >= def.tiers[i].threshold) { tier = i; break; }
    }
    const current = def.tiers[tier];
    const next = def.tiers[tier + 1] || null;
    return { tier, name: current.name, score, next };
  }

  getMasteryScore(mode) {
    const def = CONFIG.MODE_MASTERY_DEFS?.[mode];
    if (!def || !def.scoreCalc) return 0;
    return def.scoreCalc(this, mode);
  }

  /* ── Persist (delegates to SaveService.save) ── */
  async persist() {
    await this.save.save();
  }
}

/* ═══════════════════════════════════════════════
   KLASSIK Mode Mastery — Speed-focused hooks
   ═══════════════════════════════════════════════ */

/**
 * Called after each correct answer in Klassik mode.
 * Tracks speed zones, color combos, perfect runs, ghost racer data.
 */
export function trackKlassikAnswer(mastery, result, engine) {
  const mode = 'klassik';
  const reaction = result.reaction;

  /* Speed zone tracking */
  if (reaction < 200)      mastery.inc(mode, 'zone200', 1);
  else if (reaction < 300) mastery.inc(mode, 'zone300', 1);
  else if (reaction < 500) mastery.inc(mode, 'zone500', 1);

  /* Perfect (flawless) run tracking */
  if (result.correct) {
    mastery.inc(mode, 'currentFlawless', 1);
    const current = mastery.get(mode, 'currentFlawless');
    mastery.max(mode, 'bestFlawless', current);
  }

  /* Color combo tracking */
  if (result.correct && result.direction) {
    const color = engine.cornerMap[result.direction]?.colorIndex;
    if (color != null) {
      const lastColor = mastery.get(mode, '_lastColor', -1);
      if (color === lastColor) {
        const combo = mastery.inc(mode, '_colorCombo', 1);
        mastery.max(mode, 'bestColorCombo', combo);
      } else {
        mastery.set(mode, '_colorCombo', 1);
      }
      mastery.set(mode, '_lastColor', color);
    }
  }

  /* Ghost racer: track score at each second */
  const elapsed = engine.elapsed || 0;
  mastery.push(mode, '_currentPace', { t: elapsed, s: engine.score }, 200);
}

/**
 * Called at game start — snapshot the PB pace for ghost racer comparison.
 */
export function startKlassikGhostRacer(mastery) {
  const mode = 'klassik';
  mastery.set(mode, '_currentPace', []);
  mastery.set(mode, 'currentFlawless', 0);
  mastery.set(mode, '_lastColor', -1);
  mastery.set(mode, '_colorCombo', 1);
}

/**
 * Called at game end — persist the PB pace if it's a new PB.
 */
export function endKlassikGame(mastery, stats, isNewPB) {
  const mode = 'klassik';
  if (isNewPB) {
    const pace = mastery.getArray(mode, '_currentPace');
    mastery.set(mode, 'pbPace', [...pace]);
  }

  /* Push avg reaction for trend tracking */
  if (stats.avgReaction > 0) {
    mastery.push(mode, 'reactionHistory', stats.avgReaction, 30);
  }

  /* Accumulate totals */
  mastery.inc(mode, 'totalGames', 1);
  mastery.inc(mode, 'totalCorrect', stats.correct || 0);

  /* Zen state tracking */
  if (stats.streak >= 50) {
    mastery.inc(mode, 'zenReached', 1);
  }
}

/**
 * Get ghost racer comparison: current score vs PB pace at this elapsed time.
 * Returns delta (positive = ahead of PB).
 */
export function getGhostDelta(mastery, currentScore, elapsed) {
  const pbPace = mastery.getArray('klassik', 'pbPace');
  if (!pbPace.length) return null;

  /* Find closest PB pace entry to current elapsed time */
  let closest = pbPace[0];
  for (const entry of pbPace) {
    if (entry.t <= elapsed) closest = entry;
    else break;
  }
  if (!closest) return null;
  return currentScore - closest.s;
}

/**
 * Get the current speed zone based on recent reaction time.
 * Returns: 'ultra' (<200ms), 'fast' (<300ms), 'good' (<500ms), or null.
 */
export function getSpeedZone(reaction) {
  if (reaction < 200) return 'ultra';
  if (reaction < 300) return 'fast';
  if (reaction < 500) return 'good';
  return null;
}

/**
 * Build Klassik mastery insights for the ResultsScreen.
 */
export function getKlassikInsights(mastery, stats) {
  const mode = 'klassik';
  const insights = [];

  /* Speed zone breakdown */
  const z200 = mastery.get(mode, 'zone200');
  const z300 = mastery.get(mode, 'zone300');
  const z500 = mastery.get(mode, 'zone500');
  if (z200 > 0 || z300 > 0 || z500 > 0) {
    insights.push({
      type: 'speed-zones',
      label: 'Speed Zones',
      data: { ultra: z200, fast: z300, good: z500 }
    });
  }

  /* Perfect run */
  const bestFlawless = mastery.get(mode, 'bestFlawless');
  const currentFlawless = mastery.get(mode, 'currentFlawless');
  if (bestFlawless > 0) {
    insights.push({
      type: 'flawless',
      label: 'Flawless Streak',
      data: { current: currentFlawless, best: bestFlawless, isNew: currentFlawless >= bestFlawless && currentFlawless > 0 }
    });
  }

  /* Color combo */
  const bestCC = mastery.get(mode, 'bestColorCombo');
  if (bestCC >= 3) {
    insights.push({
      type: 'color-combo',
      label: 'Color Combo',
      data: { best: bestCC }
    });
  }

  /* Reaction trend */
  const history = mastery.getArray(mode, 'reactionHistory');
  if (history.length >= 3) {
    const recent = history.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = history.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    const trend = oldAvg - avg; // positive = getting faster
    insights.push({
      type: 'speed-trend',
      label: 'Speed Trend',
      data: { avg: Math.round(avg), trend: Math.round(trend), history }
    });
  }

  /* Zen state */
  const zenCount = mastery.get(mode, 'zenReached');
  if (zenCount > 0) {
    insights.push({
      type: 'zen',
      label: 'Zen State',
      data: { count: zenCount, reachedThisGame: stats.streak >= 50 }
    });
  }

  return insights;
}


/* ═══════════════════════════════════════════════
   BEGINNER (Formen) Mode Mastery — Pattern mastery hooks
   ═══════════════════════════════════════════════ */

/**
 * Initialise per-game transient state for Formen.
 */
export function startFormenGame(mastery) {
  const mode = 'beginner';
  mastery.set(mode, '_currentPace', []);
  mastery.set(mode, '_lastShape', '');
  mastery.set(mode, '_shapeChain', 0);
  mastery.set(mode, '_flowStreak', 0);
}

/**
 * Called after each answer in Formen mode.
 * Tracks shape mastery grid, shape combo chains, flow meter, and pace.
 */
export function trackFormenAnswer(mastery, result, engine) {
  const mode = 'beginner';
  const reaction = result.reaction;

  /* Resolve shape+color from the correct corner (result.expected = direction) */
  const cornerInfo = engine.cornerMap?.[result.expected];
  const shape = cornerInfo?.shape || 'unknown';
  const colorIdx = cornerInfo?.colorIndex ?? -1;

  if (result.correct) {
    /* ── Shape Mastery Grid: track accuracy per shape-color combo ── */
    const gridKey = `${shape}_${colorIdx}`;
    mastery.mapInc(mode, 'shapeGrid', gridKey, 1);

    /* ── Shape Combo Chain: consecutive same-shape correct answers ── */
    const lastShape = mastery.get(mode, '_lastShape', '');
    if (shape === lastShape) {
      const chain = mastery.inc(mode, '_shapeChain', 1);
      mastery.max(mode, 'bestShapeChain', chain);
    } else {
      mastery.set(mode, '_shapeChain', 1);
    }
    mastery.set(mode, '_lastShape', shape);

    /* ── Dual Match Jackpot detection ── */
    // A "dual match" = the center shape's shape AND color both match the correct corner.
    // Since in beginner mode each corner has a unique shape+color, a correct swipe is always
    // a dual match when both attributes are used for matching. We track it as a special event
    // when the player is very fast (<300ms) — a "jackpot moment".
    if (reaction < 300) {
      mastery.inc(mode, 'jackpotCount', 1);
    }

    /* ── Flow Meter: consistent sub-threshold speed ── */
    const flowThreshold = CONFIG.BEGINNER_FLOW_THRESHOLD || 500;
    if (reaction < flowThreshold) {
      const flowStreak = mastery.inc(mode, '_flowStreak', 1);
      mastery.inc(mode, 'flowHits', 1);
      mastery.max(mode, 'bestFlowStreak', flowStreak);
    } else {
      mastery.set(mode, '_flowStreak', 0);
    }
  } else {
    /* Miss: break shape chain and flow */
    mastery.set(mode, '_shapeChain', 0);
    mastery.set(mode, '_lastShape', '');
    mastery.set(mode, '_flowStreak', 0);
  }

  /* Ghost racer pace (shared mechanic) */
  const elapsed = engine.elapsed || 0;
  mastery.push(mode, '_currentPace', { t: elapsed, s: engine.score }, 200);
}

/**
 * End-of-game persistence for Formen.
 */
export function endFormenGame(mastery, stats, isNewPB) {
  const mode = 'beginner';
  mastery.inc(mode, 'totalGames', 1);
  mastery.inc(mode, 'totalCorrect', stats.correct || 0);

  if (isNewPB) {
    const pace = mastery.getArray(mode, '_currentPace');
    mastery.set(mode, 'pbPace', [...pace]);
  }

  if (stats.avgReaction > 0) {
    mastery.push(mode, 'reactionHistory', stats.avgReaction, 30);
  }
}

/**
 * Get the ghost delta for Formen (same logic as Klassik).
 */
export function getFormenGhostDelta(mastery, currentScore, elapsed) {
  const pbPace = mastery.getArray('beginner', 'pbPace');
  if (!pbPace.length) return null;
  let closest = pbPace[0];
  for (const entry of pbPace) {
    if (entry.t <= elapsed) closest = entry;
    else break;
  }
  if (!closest) return null;
  return currentScore - closest.s;
}

/**
 * Build Formen mastery insights for the ResultsScreen.
 */
export function getFormenInsights(mastery, stats) {
  const mode = 'beginner';
  const insights = [];

  /* Shape Mastery Grid: how many shape-color combos have been hit */
  const gridData = mastery.mapGetAll(mode, 'shapeGrid');
  const gridCount = Object.keys(gridData).length;
  const gridMax = 16; // 4 shapes x 4 colors
  if (gridCount > 0) {
    insights.push({
      type: 'shape-grid',
      label: 'Shape Mastery',
      data: { grid: gridData, filled: gridCount, max: gridMax }
    });
  }

  /* Shape Combo Chain best */
  const bestChain = mastery.get(mode, 'bestShapeChain');
  if (bestChain >= 2) {
    insights.push({
      type: 'shape-chain',
      label: 'Shape Chain',
      data: { best: bestChain }
    });
  }

  /* Jackpot count */
  const jackpots = mastery.get(mode, 'jackpotCount');
  if (jackpots > 0) {
    insights.push({
      type: 'jackpot',
      label: 'Jackpots',
      data: { count: jackpots }
    });
  }

  /* Flow Meter best */
  const bestFlow = mastery.get(mode, 'bestFlowStreak');
  const flowHits = mastery.get(mode, 'flowHits');
  if (bestFlow >= 3) {
    insights.push({
      type: 'flow',
      label: 'Flow',
      data: { bestStreak: bestFlow, totalHits: flowHits }
    });
  }

  /* Reaction history trend (speed evolution) */
  const history = mastery.getArray(mode, 'reactionHistory');
  if (history.length >= 3) {
    const recent = history.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = history.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    const trend = oldAvg - avg;
    insights.push({
      type: 'speed-trend',
      label: 'Speed Evolution',
      data: { avg: Math.round(avg), trend: Math.round(trend), history }
    });
  }

  return insights;
}

/* ═══════════════════════════════════════════════
   EXPERT Mode Mastery — 8-Direction Compass hooks
   ═══════════════════════════════════════════════ */

const EXPERT_DIRS = ['ul','ur','dl','dr','up','down','left','right'];

/** Called at game start for Expert mode. */
export function startExpertGame(mastery) {
  const mode = 'expert';
  mastery.set(mode, '_currentPace', []);
  mastery.set(mode, '_recentDirs', []);
  mastery.set(mode, '_roundDirCorrect', {});
  mastery.set(mode, '_roundDirSpeed', {});
}

/** Called after each answer in Expert mode. */
export function trackExpertAnswer(mastery, result, engine) {
  const mode = 'expert';
  const dir = result.expected;

  /* Ghost racer pace */
  const pace = mastery.getArray(mode, '_currentPace');
  pace.push({ t: Math.round(engine.elapsed), s: engine.score });

  if (result.correct) {
    mastery.mapInc(mode, 'dirCorrect', dir, 1);
    mastery.mapInc(mode, '_roundDirCorrect', dir, 1);
    mastery.mapInc(mode, '_roundDirSpeed', dir, result.reaction);

    /* Best reaction per direction (ever) */
    const bestKey = `bestRt_${dir}`;
    const currentBest = mastery.get(mode, bestKey, 9999);
    if (result.reaction < currentBest) mastery.set(mode, bestKey, result.reaction);

    /* Star calculation: cumulative correct per direction */
    const totalCorrect = mastery.mapGet(mode, 'dirCorrect', dir, 0);
    const thresholds = CONFIG.EXPERT_STAR_THRESHOLDS || [3, 8, 15, 30, 60];
    let stars = 0;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (totalCorrect >= thresholds[i]) { stars = i + 1; break; }
    }
    const m = mastery._ensure(mode);
    if (!m.dirStars) m.dirStars = {};
    m.dirStars[dir] = stars;

    /* Full Compass detection: 8 unique dirs in last N correct answers */
    const recent = mastery.getArray(mode, '_recentDirs');
    recent.push(dir);
    const win = CONFIG.EXPERT_FULL_COMPASS_WINDOW || 8;
    if (recent.length > win) recent.splice(0, recent.length - win);
    const uniqueRecent = new Set(recent);
    if (uniqueRecent.size >= 8) {
      mastery.inc(mode, 'fullCompassCount', 1);
      mastery.set(mode, '_recentDirs', []);
      return { fullCompass: true, stars };
    }
    return { fullCompass: false, stars };
  } else {
    mastery.mapInc(mode, 'dirWrong', dir, 1);
    mastery.set(mode, '_recentDirs', []);
    return { fullCompass: false, stars: 0 };
  }
}

/** Called at end of Expert game. */
export function endExpertGame(mastery, stats, isNewPB) {
  const mode = 'expert';
  mastery.inc(mode, 'totalGames', 1);
  mastery.inc(mode, 'totalCorrect', stats.correct || 0);
  if (isNewPB) {
    const pace = mastery.getArray(mode, '_currentPace');
    mastery.set(mode, 'pbPace', [...pace]);
  }
  if (stats.avgReaction > 0) {
    mastery.push(mode, 'reactionHistory', stats.avgReaction, 30);
  }
}

/** Ghost racer delta for Expert. */
export function getExpertGhostDelta(mastery, currentScore, elapsed) {
  const pbPace = mastery.getArray('expert', 'pbPace');
  if (!pbPace.length) return null;
  let closest = pbPace[0];
  for (const entry of pbPace) {
    if (entry.t <= elapsed) closest = entry;
    else break;
  }
  if (!closest) return null;
  return currentScore - closest.s;
}

/** Determine the weakest direction (fewest correct relative to total). */
export function getWeakestDirection(mastery) {
  const mode = 'expert';
  let weakest = null;
  let lowestRatio = Infinity;
  for (const dir of EXPERT_DIRS) {
    const correct = mastery.mapGet(mode, 'dirCorrect', dir, 0);
    const wrong = mastery.mapGet(mode, 'dirWrong', dir, 0);
    const total = correct + wrong;
    if (total < 3) continue;
    const ratio = correct / total;
    if (ratio < lowestRatio) { lowestRatio = ratio; weakest = dir; }
  }
  return weakest;
}

/** Build Expert mastery insights for the ResultsScreen. */
export function getExpertInsights(mastery, stats) {
  const mode = 'expert';
  const insights = [];

  /* Direction Heatmap */
  const heatmapData = {};
  let hasData = false;
  for (const dir of EXPERT_DIRS) {
    const correct = mastery.mapGet(mode, 'dirCorrect', dir, 0);
    const wrong = mastery.mapGet(mode, 'dirWrong', dir, 0);
    const bestRt = mastery.get(mode, `bestRt_${dir}`, 0);
    const stars = mastery.mapGet(mode, 'dirStars', dir, 0);
    heatmapData[dir] = { correct, wrong, bestRt, stars };
    if (correct > 0 || wrong > 0) hasData = true;
  }
  if (hasData) {
    insights.push({ type: 'direction-heatmap', label: 'Direction Heatmap', data: heatmapData });
  }

  /* Compass Mastery: total stars */
  const totalStars = Object.values(mastery.mapGetAll(mode, 'dirStars')).reduce((a, b) => a + b, 0);
  const maxStars = 8 * 5;
  if (totalStars > 0) {
    insights.push({ type: 'compass-stars', label: 'Compass Mastery', data: { totalStars, maxStars, perDir: mastery.mapGetAll(mode, 'dirStars') } });
  }

  /* Full Compass events */
  const fullCompass = mastery.get(mode, 'fullCompassCount');
  if (fullCompass > 0) {
    insights.push({ type: 'full-compass', label: 'Full Compass', data: { count: fullCompass } });
  }

  /* Speed tiers per direction */
  const tiers = CONFIG.EXPERT_SPEED_TIERS || [];
  const tierData = {};
  let hasTiers = false;
  for (const dir of EXPERT_DIRS) {
    const bestRt = mastery.get(mode, `bestRt_${dir}`, 9999);
    let tier = null;
    for (const t of tiers) { if (bestRt <= t.max) { tier = t.id; break; } }
    tierData[dir] = tier;
    if (tier) hasTiers = true;
  }
  if (hasTiers) {
    insights.push({ type: 'speed-tiers', label: 'Speed Tiers', data: tierData });
  }

  /* Reaction history trend */
  const history = mastery.getArray(mode, 'reactionHistory');
  if (history.length >= 3) {
    const recent = history.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = history.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    const trend = oldAvg - avg;
    insights.push({ type: 'speed-trend', label: 'Speed Evolution', data: { avg: Math.round(avg), trend: Math.round(trend), history } });
  }

  return insights;
}

/* ═══════════════════════════════════════════════
   ULTRA MODE (12 Directions) — Mastery Tracking
   ═══════════════════════════════════════════════ */

const ULTRA_DIRS = ['ul','ur','dl','dr','up','down','left','right','ene','nnw','wsw','sse'];

/** Initialise per-round Ultra tracking state. */
export function startUltraGame(mastery) {
  const m = mastery._ensure('ultra');
  m._currentPace = [];
  m._recentDirs = [];
  m._roundDirCorrect = {};
  m._roundDirSpeed = {};
}

/**
 * Track a single Ultra answer.
 * Returns { fullCompass: bool, stars: number } for HUD use.
 */
export function trackUltraAnswer(mastery, result, engine) {
  const mode = 'ultra';
  const dir = result.direction;

  if (result.correct) {
    mastery.mapInc(mode, 'dirCorrect', dir);
    mastery.max(mode, 'bestStreak', engine?.streak ?? 0);

    /* Per-direction best reaction */
    const prevBest = mastery.get(mode, `bestRt_${dir}`, 9999);
    if (result.reaction < prevBest) mastery.set(mode, `bestRt_${dir}`, result.reaction);

    /* Star thresholds per direction */
    const thresholds = CONFIG.ULTRA_STAR_THRESHOLDS || [3, 8, 15, 30, 60];
    const dirCorrect = mastery.mapGet(mode, 'dirCorrect', dir, 0);
    let stars = 0;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (dirCorrect >= thresholds[i]) { stars = i + 1; break; }
    }
    const m = mastery._ensure(mode);
    if (!m.dirStars) m.dirStars = {};
    m.dirStars[dir] = stars;

    /* Full Compass detection: 12 unique directions in sliding window */
    const windowSize = CONFIG.ULTRA_FULL_COMPASS_WINDOW || 12;
    m._recentDirs.push(dir);
    if (m._recentDirs.length > windowSize) m._recentDirs.shift();
    const unique = new Set(m._recentDirs).size;
    let fullCompass = false;
    if (unique >= 12) {
      mastery.inc(mode, 'fullCompassCount');
      m._recentDirs = [];
      fullCompass = true;
    }

    /* Ghost racer pace tracking */
    const elapsed = engine?.elapsed ?? 0;
    m._currentPace.push({ t: Math.round(elapsed), s: engine?.score ?? 0 });

    /* Per-round tracking */
    m._roundDirCorrect[dir] = (m._roundDirCorrect[dir] || 0) + 1;
    if (!m._roundDirSpeed[dir] || result.reaction < m._roundDirSpeed[dir]) {
      m._roundDirSpeed[dir] = result.reaction;
    }

    return { fullCompass, stars };
  } else {
    mastery.mapInc(mode, 'dirWrong', dir);
    return { fullCompass: false, stars: 0 };
  }
}

/** Persist Ultra end-of-game stats. */
export function endUltraGame(mastery, stats, isNewPB) {
  const mode = 'ultra';
  mastery.inc(mode, 'totalGames');
  mastery.inc(mode, 'totalCorrect', stats.correct || 0);
  if (isNewPB) {
    mastery.set(mode, 'pbPace', mastery._ensure(mode)._currentPace);
  }
  if (stats.avgReaction > 0) {
    mastery.push(mode, 'reactionHistory', stats.avgReaction, 50);
  }
  if (stats.elapsed) {
    mastery.max(mode, 'bestSurvivorTime', stats.elapsed);
  }
}

/** Ghost racer delta for Ultra. */
export function getUltraGhostDelta(mastery, currentScore, elapsed) {
  const pace = mastery.get('ultra', 'pbPace', null);
  if (!pace || !Array.isArray(pace) || pace.length < 2) return null;
  let ghostScore = 0;
  for (const p of pace) {
    if (p.t <= elapsed) ghostScore = p.s;
    else break;
  }
  return currentScore - ghostScore;
}

/** Find the weakest direction in Ultra. Requires min 3 total answers. */
export function getWeakestUltraDirection(mastery) {
  const mode = 'ultra';
  let weakest = null;
  let lowestRatio = 1;
  for (const dir of ULTRA_DIRS) {
    const correct = mastery.mapGet(mode, 'dirCorrect', dir, 0);
    const wrong = mastery.mapGet(mode, 'dirWrong', dir, 0);
    const total = correct + wrong;
    if (total < 3) continue;
    const ratio = correct / total;
    if (ratio < lowestRatio) { lowestRatio = ratio; weakest = dir; }
  }
  return weakest;
}

/** Build Ultra mastery insights for the ResultsScreen. */
export function getUltraInsights(mastery, stats) {
  const mode = 'ultra';
  const insights = [];

  /* Direction Heatmap (12-grid) */
  const heatmapData = {};
  let hasData = false;
  for (const dir of ULTRA_DIRS) {
    const correct = mastery.mapGet(mode, 'dirCorrect', dir, 0);
    const wrong = mastery.mapGet(mode, 'dirWrong', dir, 0);
    const bestRt = mastery.get(mode, `bestRt_${dir}`, 0);
    const stars = mastery.mapGet(mode, 'dirStars', dir, 0);
    heatmapData[dir] = { correct, wrong, bestRt, stars };
    if (correct > 0 || wrong > 0) hasData = true;
  }
  if (hasData) {
    insights.push({ type: 'ultra-heatmap', label: '12-Star Grid', data: heatmapData });
  }

  /* Compass Mastery: total stars (12 dirs x 5 stars) */
  const totalStars = Object.values(mastery.mapGetAll(mode, 'dirStars')).reduce((a, b) => a + b, 0);
  const maxStars = 12 * 5;
  if (totalStars > 0) {
    insights.push({ type: 'ultra-stars', label: 'Ultra Compass', data: { totalStars, maxStars, perDir: mastery.mapGetAll(mode, 'dirStars') } });
  }

  /* Full Compass events */
  const fullCompass = mastery.get(mode, 'fullCompassCount');
  if (fullCompass > 0) {
    insights.push({ type: 'ultra-full-compass', label: 'Full Compass', data: { count: fullCompass } });
  }

  /* Speed tiers per direction */
  const tiers = CONFIG.ULTRA_SPEED_TIERS || [];
  const tierData = {};
  let hasTiers = false;
  for (const dir of ULTRA_DIRS) {
    const bestRt = mastery.get(mode, `bestRt_${dir}`, 9999);
    let tier = null;
    for (const t of tiers) { if (bestRt <= t.max) { tier = t.id; break; } }
    tierData[dir] = tier;
    if (tier) hasTiers = true;
  }
  if (hasTiers) {
    insights.push({ type: 'ultra-speed-tiers', label: 'Speed Tiers', data: tierData });
  }

  /* Survivor time */
  const bestSurvivor = mastery.get(mode, 'bestSurvivorTime', 0);
  if (bestSurvivor > 0) {
    const sec = Math.floor(bestSurvivor / 1000);
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    insights.push({ type: 'ultra-survivor', label: 'Best Survival', data: { ms: bestSurvivor, display: `${min}:${String(s).padStart(2, '0')}` } });
  }

  /* Elite Statistik — community percentile simulation (Plan 4 feature 5) */
  const bestStreak = mastery.get(mode, 'bestStreak', 0);
  if (bestStreak > 0) {
    const table = CONFIG.COMMUNITY_PERCENTILES?.ultra_streak || [5,8,12,18,25,35,50,70,100];
    let pct = 99;
    for (let i = table.length - 1; i >= 0; i--) {
      if (bestStreak >= table[i]) { pct = Math.max(1, Math.round((1 - (i + 1) / table.length) * 100)); break; }
    }
    insights.push({ type: 'elite-stat', label: 'Elite', data: { streak: bestStreak, percentile: pct } });
  }

  /* Reaction history trend */
  const history = mastery.getArray(mode, 'reactionHistory');
  if (history.length >= 3) {
    const recent = history.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = history.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    const trend = oldAvg - avg;
    insights.push({ type: 'speed-trend', label: 'Speed Evolution', data: { avg: Math.round(avg), trend: Math.round(trend), history } });
  }

  return insights;
}

/* ═══════════════════════════════════════════════
   MATHE MODE — Operation Mastery & Brain Age
   ═══════════════════════════════════════════════ */

const MATH_OPS = ['+', '\u2212', '\u00D7', '\u00F7']; // +, −, ×, ÷

/** Extract the operator from an equation string like "7 + 5". */
function _parseOp(eq) {
  if (!eq) return null;
  for (const op of MATH_OPS) {
    if (eq.includes(op)) return op;
  }
  return null;
}

/** Initialise per-round Mathe tracking. */
export function startMatheGame(mastery) {
  const m = mastery._ensure('mathe');
  m._currentPace = [];
  m._roundOps = {};
  m._highestPhase = 0;
}

/**
 * Track a single Mathe answer.
 * Returns { op, phase } for HUD use.
 */
export function trackMatheAnswer(mastery, result, engine) {
  const mode = 'mathe';
  const eq = engine?.currentShape?.display || '';
  const op = _parseOp(eq);

  /* Track current phase */
  const phases = CONFIG.MATH_PHASES || [];
  let phaseIdx = 0;
  for (let i = phases.length - 1; i >= 0; i--) {
    if ((engine?.correct ?? 0) >= (phases[i]?.threshold ?? 0)) { phaseIdx = i; break; }
  }
  const m = mastery._ensure(mode);
  if (phaseIdx > (m._highestPhase || 0)) m._highestPhase = phaseIdx;

  if (result.correct && op) {
    mastery.mapInc(mode, 'opCorrect', op);
    mastery.mapInc(mode, 'opTotal', op);

    /* Per-op best reaction */
    const prevBest = mastery.get(mode, `bestRt_${op}`, 9999);
    if (result.reaction < prevBest) mastery.set(mode, `bestRt_${op}`, result.reaction);

    /* Per-op speed history (rolling) */
    const key = `opSpeed_${op}`;
    const arr = mastery.getArray(mode, key);
    arr.push(result.reaction);
    if (arr.length > 30) arr.splice(0, arr.length - 30);
    m[key] = arr;

    /* Ghost racer pace tracking */
    const elapsed = engine?.elapsed ?? 0;
    m._currentPace.push({ t: Math.round(elapsed), s: engine?.score ?? 0 });

    /* Round tracking */
    if (!m._roundOps[op]) m._roundOps[op] = 0;
    m._roundOps[op]++;

    /* Math Facts Tracker (Plan 5 feature 4) — per-equation mastery */
    const eq = engine?.currentShape?.display || '';
    if (eq) {
      mastery.mapInc(mode, 'factCorrect', eq);
      mastery.mapInc(mode, 'factTotal', eq);
      /* Store best RT for this specific fact */
      const factBest = mastery.mapGet(mode, 'factBestRt', eq, 9999);
      if (result.reaction < factBest) {
        const fbm = mastery._ensure(mode);
        if (!fbm.factBestRt) fbm.factBestRt = {};
        fbm.factBestRt[eq] = result.reaction;
      }
    }
  } else if (op) {
    mastery.mapInc(mode, 'opTotal', op);
    mastery.mapInc(mode, 'opWrong', op);
    /* Math Facts Tracker — track misses too */
    const eqMiss = engine?.currentShape?.display || '';
    if (eqMiss) mastery.mapInc(mode, 'factTotal', eqMiss);
  }

  return { op, phase: phaseIdx };
}

/** Persist Mathe end-of-game stats. */
export function endMatheGame(mastery, stats, isNewPB) {
  const mode = 'mathe';
  mastery.inc(mode, 'totalGames');
  mastery.inc(mode, 'totalCorrect', stats.correct || 0);
  if (isNewPB) {
    mastery.set(mode, 'pbPace', mastery._ensure(mode)._currentPace);
  }
  if (stats.avgReaction > 0) {
    mastery.push(mode, 'reactionHistory', stats.avgReaction, 50);
  }
  /* Save highest phase reached */
  const m = mastery._ensure(mode);
  mastery.max(mode, 'bestPhase', m._highestPhase || 0);
}

/** Ghost racer delta for Mathe. */
export function getMatheGhostDelta(mastery, currentScore, elapsed) {
  const pace = mastery.get('mathe', 'pbPace', null);
  if (!pace || !Array.isArray(pace) || pace.length < 2) return null;
  let ghostScore = 0;
  for (const p of pace) {
    if (p.t <= elapsed) ghostScore = p.s;
    else break;
  }
  return currentScore - ghostScore;
}

/**
 * Calculate a "Brain Age" from Math performance.
 * Lower = better. Scale: 20 (genius) to 80 (slow).
 * Based on average reaction time, accuracy, and phase reached.
 */
function _calcBrainAge(mastery) {
  const mode = 'mathe';
  const hist = mastery.getArray(mode, 'reactionHistory');
  if (hist.length < 2) return null;
  const avgRt = hist.slice(-5).reduce((a, b) => a + b, 0) / Math.min(hist.length, 5);
  const totalCorrect = mastery.get(mode, 'totalCorrect', 0);
  const totalGames = mastery.get(mode, 'totalGames', 1);
  const bestPhase = mastery.get(mode, 'bestPhase', 0);

  /* Formula: base 60, subtract for speed + accuracy + phase */
  let age = 60;
  age -= Math.max(0, (1000 - avgRt) / 40);   // faster = younger (max -25)
  age -= bestPhase * 2;                        // higher phase = younger (max -12)
  age -= Math.min(10, totalCorrect / totalGames / 5); // more correct/game = younger
  return Math.max(20, Math.min(80, Math.round(age)));
}

/** Build Mathe mastery insights for the ResultsScreen. */
export function getMatheInsights(mastery, stats) {
  const mode = 'mathe';
  const insights = [];

  /* Operation breakdown */
  const opData = {};
  let hasOps = false;
  for (const op of MATH_OPS) {
    const correct = mastery.mapGet(mode, 'opCorrect', op, 0);
    const total = mastery.mapGet(mode, 'opTotal', op, 0);
    const bestRt = mastery.get(mode, `bestRt_${op}`, 0);
    opData[op] = { correct, total, bestRt };
    if (total > 0) hasOps = true;
  }
  if (hasOps) {
    insights.push({ type: 'math-ops', label: 'Operation Mastery', data: opData });
  }

  /* Brain Age */
  const brainAge = _calcBrainAge(mastery);
  if (brainAge !== null) {
    insights.push({ type: 'brain-age', label: 'Brain Age', data: { age: brainAge } });
  }

  /* Best phase reached */
  const bestPhase = mastery.get(mode, 'bestPhase', 0);
  if (bestPhase > 0) {
    const phaseNames = ['+/\u2212 Easy', '+/\u2212 Medium', '+/\u2212/\u00D7', 'All Ops', 'Advanced', 'Expert', 'Master'];
    insights.push({ type: 'math-phase', label: 'Best Phase', data: { phase: bestPhase, name: phaseNames[bestPhase] || `Phase ${bestPhase}` } });
  }

  /* Reaction history trend */
  const rHistory = mastery.getArray(mode, 'reactionHistory');
  if (rHistory.length >= 3) {
    const recent = rHistory.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = rHistory.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    const trend = oldAvg - avg;
    insights.push({ type: 'speed-trend', label: 'Speed Evolution', data: { avg: Math.round(avg), trend: Math.round(trend), history: rHistory } });
  }

  /* Math Facts Tracker (Plan 5 feature 4) — top mastered equations */
  const factCorrectMap = mastery.mapGetAll(mode, 'factCorrect');
  const factTotalMap = mastery.mapGetAll(mode, 'factTotal');
  const factBestRtMap = mastery.mapGetAll(mode, 'factBestRt');
  const facts = Object.keys(factTotalMap)
    .map(eq => ({ eq, correct: factCorrectMap[eq] || 0, total: factTotalMap[eq] || 0, bestRt: factBestRtMap[eq] || 0 }))
    .filter(f => f.total >= 2)
    .sort((a, b) => b.correct - a.correct)
    .slice(0, 8);
  if (facts.length > 0) {
    insights.push({ type: 'math-facts', label: 'Math Facts', data: { facts } });
  }

  /* Community Speed comparison (Plan 5 feature 5) */
  if (rHistory.length >= 2) {
    const myAvg = rHistory.slice(-5).reduce((a, b) => a + b, 0) / Math.min(rHistory.length, 5);
    const table = CONFIG.COMMUNITY_PERCENTILES?.mathe_rt || [2000,1500,1200,1000,800,600,500,400,300];
    let pct = 50;
    for (let i = table.length - 1; i >= 0; i--) {
      if (myAvg <= table[i]) { pct = Math.round(((i + 1) / table.length) * 100); break; }
    }
    insights.push({ type: 'community-speed', label: 'Community Ranking', data: { avgRt: Math.round(myAvg), percentile: pct } });
  }

  return insights;
}

/* ═══════════════════════════════════════════════
   ALGEBRA MODE — Equation Type Mastery & IQ
   ═══════════════════════════════════════════════ */

const ALGEBRA_TYPES = ['linear_add', 'linear_sub', 'two_step', 'square', 'sqrt', 'power', 'fraction_add'];
const ALGEBRA_TYPE_LABELS = {
  linear_add: 'ax+b=c',
  linear_sub: 'ax\u2212b=c',
  two_step: 'a(x+b)=c',
  square: 'x\u00B2=n',
  sqrt: '\u221An',
  power: 'a\u207F',
  fraction_add: 'a/b+c/d'
};
const ALGEBRA_TYPE_WEIGHT = {
  linear_add: 1, linear_sub: 1.2, two_step: 1.5,
  square: 2, sqrt: 2, power: 2.5, fraction_add: 3
};

/** Derive current algebra equation type from engine state. */
function _getAlgType(engine) {
  const phases = CONFIG.ALGEBRA_PHASES || [];
  let phase = phases[0];
  const correct = engine?.correct ?? 0;
  const elapsed = engine?.elapsed ?? 0;
  for (const p of phases) { if (correct >= p.threshold) phase = p; }
  const timeIdx = Math.min(phases.length - 1, Math.floor(elapsed / 20));
  if (phases.indexOf(phases[timeIdx]) > phases.indexOf(phase)) phase = phases[timeIdx];
  return phase?.type || 'linear_add';
}

/** Initialise per-round Algebra tracking. */
export function startAlgebraGame(mastery) {
  const m = mastery._ensure('algebra');
  m._currentPace = [];
  m._highestPhase = 0;
  m._roundTypeCount = {};
  m._roundTypeCorrect = {};
  m._roundWeightedScore = 0;
  m._roundTotal = 0;
}

/**
 * Track a single Algebra answer.
 * Returns { eqType, phase } for HUD use.
 */
export function trackAlgebraAnswer(mastery, result, engine) {
  const mode = 'algebra';
  const eqType = _getAlgType(engine);

  /* Track current phase index */
  const phases = CONFIG.ALGEBRA_PHASES || [];
  let phaseIdx = 0;
  for (let i = phases.length - 1; i >= 0; i--) {
    const correct = engine?.correct ?? 0;
    const elapsed = engine?.elapsed ?? 0;
    const timeIdx = Math.min(phases.length - 1, Math.floor(elapsed / 20));
    const correctIdx = phases.findIndex(p => correct < p.threshold) - 1;
    phaseIdx = Math.max(correctIdx < 0 ? phases.length - 1 : correctIdx, timeIdx);
    break;
  }
  const m = mastery._ensure(mode);
  if (phaseIdx > (m._highestPhase || 0)) m._highestPhase = phaseIdx;

  /* Round counters */
  m._roundTotal = (m._roundTotal || 0) + 1;
  if (!m._roundTypeCount) m._roundTypeCount = {};
  m._roundTypeCount[eqType] = (m._roundTypeCount[eqType] || 0) + 1;

  if (result.correct) {
    mastery.mapInc(mode, 'typeCorrect', eqType);
    mastery.mapInc(mode, 'typeTotal', eqType);

    /* Per-type best reaction */
    const prevBest = mastery.get(mode, `bestRt_${eqType}`, 9999);
    if (result.reaction < prevBest) mastery.set(mode, `bestRt_${eqType}`, result.reaction);

    /* Weighted IQ score tracking */
    const weight = ALGEBRA_TYPE_WEIGHT[eqType] || 1;
    m._roundWeightedScore = (m._roundWeightedScore || 0) + (weight * (1200 - Math.min(result.reaction, 1200)) / 1200);
    if (!m._roundTypeCorrect) m._roundTypeCorrect = {};
    m._roundTypeCorrect[eqType] = (m._roundTypeCorrect[eqType] || 0) + 1;

    /* Track equation type as newly unlocked */
    mastery.addToSet(mode, 'unlockedTypes', eqType);

    /* Ghost racer pace */
    const elapsed = engine?.elapsed ?? 0;
    m._currentPace.push({ t: Math.round(elapsed), s: engine?.score ?? 0 });
  } else {
    mastery.mapInc(mode, 'typeTotal', eqType);
    mastery.mapInc(mode, 'typeWrong', eqType);
  }

  return { eqType, phase: phaseIdx };
}

/** Persist Algebra end-of-game stats. */
export function endAlgebraGame(mastery, stats, isNewPB) {
  const mode = 'algebra';
  mastery.inc(mode, 'totalGames');
  mastery.inc(mode, 'totalCorrect', stats.correct || 0);

  if (isNewPB) {
    mastery.set(mode, 'pbPace', mastery._ensure(mode)._currentPace);
  }
  if (stats.avgReaction > 0) {
    mastery.push(mode, 'reactionHistory', stats.avgReaction, 50);
  }

  const m = mastery._ensure(mode);
  mastery.max(mode, 'bestPhase', m._highestPhase || 0);

  /* Calculate Algebra IQ: weighted score normalized to 80-160 scale */
  const total = m._roundTotal || 1;
  const ws = m._roundWeightedScore || 0;
  const rawIQ = 80 + (ws / total) * 80;
  const iq = Math.max(80, Math.min(160, Math.round(rawIQ)));
  mastery.max(mode, 'algebraIQ', iq);
}

/** Ghost racer delta for Algebra. */
export function getAlgebraGhostDelta(mastery, currentScore, elapsed) {
  const pace = mastery.get('algebra', 'pbPace', null);
  if (!pace || !Array.isArray(pace) || pace.length < 2) return null;
  let ghostScore = 0;
  for (const p of pace) {
    if (p.t <= elapsed) ghostScore = p.s;
    else break;
  }
  return currentScore - ghostScore;
}

/** Build Algebra mastery insights for the ResultsScreen. */
export function getAlgebraInsights(mastery, stats) {
  const mode = 'algebra';
  const insights = [];

  /* Equation type gallery */
  const typeData = {};
  let hasTypes = false;
  for (const t of ALGEBRA_TYPES) {
    const correct = mastery.mapGet(mode, 'typeCorrect', t, 0);
    const total = mastery.mapGet(mode, 'typeTotal', t, 0);
    const bestRt = mastery.get(mode, `bestRt_${t}`, 0);
    const unlocked = mastery.getArray(mode, 'unlockedTypes').includes(t);
    typeData[t] = { correct, total, bestRt, label: ALGEBRA_TYPE_LABELS[t], unlocked };
    if (total > 0) hasTypes = true;
  }
  if (hasTypes) {
    insights.push({ type: 'algebra-types', label: 'Equation Gallery', data: typeData });
  }

  /* Algebra IQ */
  const iq = mastery.get(mode, 'algebraIQ', 0);
  if (iq > 0) {
    insights.push({ type: 'algebra-iq', label: 'Algebra IQ', data: { iq } });
  }

  /* Best phase reached */
  const bestPhase = mastery.get(mode, 'bestPhase', 0);
  if (bestPhase > 0) {
    const phases = CONFIG.ALGEBRA_PHASES || [];
    const phaseName = phases[bestPhase]?.label || `Phase ${bestPhase}`;
    insights.push({ type: 'algebra-phase', label: 'Best Phase', data: { phase: bestPhase, name: phaseName } });
  }

  /* Reaction history trend */
  const history = mastery.getArray(mode, 'reactionHistory');
  if (history.length >= 3) {
    const recent = history.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = history.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    const trend = oldAvg - avg;
    insights.push({ type: 'speed-trend', label: 'Speed Evolution', data: { avg: Math.round(avg), trend: Math.round(trend), history } });
  }

  /* Time Attack Target (Plan 6 feature 5) — suggest goal for next game */
  const prevBestCorrect = mastery.get(mode, 'totalCorrect', 0);
  const prevGames = mastery.get(mode, 'totalGames', 1);
  const avgCorrectPerGame = Math.round(prevBestCorrect / prevGames);
  const timeAttackTarget = Math.max(10, avgCorrectPerGame + 3);
  insights.push({ type: 'time-attack', label: 'Time Attack', data: { target: timeAttackTarget, avgPerGame: avgCorrectPerGame } });

  return insights;
}

/* ═══════════════════════════════════════════════
   WORTE MODE — Word Collection & Category Mastery
   ═══════════════════════════════════════════════ */

/** Initialise per-round Worte tracking. */
export function startWorteGame(mastery) {
  const m = mastery._ensure('worte');
  m._currentPace = [];
  m._roundNewWords = 0;
}

/**
 * Track a single Worte answer.
 * Returns { category, isNew } for HUD use.
 */
export function trackWorteAnswer(mastery, result, engine) {
  const mode = 'worte';
  const cat = engine?.currentShape?.category || null;
  const word = engine?.currentShape?.display || '';
  const m = mastery._ensure(mode);

  let isNew = false;
  if (result.correct && cat) {
    mastery.mapInc(mode, 'catCorrect', cat);
    mastery.mapInc(mode, 'catTotal', cat);

    /* Add word to collection (if text, not emoji) */
    if (word && word.length > 1) {
      const collection = mastery.getArray(mode, 'wordCollection');
      const lc = word.toLowerCase();
      if (!collection.includes(lc)) {
        collection.push(lc);
        m.wordCollection = collection;
        isNew = true;
        m._roundNewWords = (m._roundNewWords || 0) + 1;
      }
    }

    /* Ghost racer */
    const elapsed = engine?.elapsed ?? 0;
    m._currentPace.push({ t: Math.round(elapsed), s: engine?.score ?? 0 });
  } else if (cat) {
    mastery.mapInc(mode, 'catTotal', cat);
  }

  return { category: cat, isNew };
}

/** Persist Worte end-of-game stats. */
export function endWorteGame(mastery, stats, isNewPB) {
  const mode = 'worte';
  mastery.inc(mode, 'totalGames');
  mastery.inc(mode, 'totalCorrect', stats.correct || 0);
  if (isNewPB) {
    mastery.set(mode, 'pbPace', mastery._ensure(mode)._currentPace);
  }
  if (stats.avgReaction > 0) {
    mastery.push(mode, 'reactionHistory', stats.avgReaction, 50);
  }
}

/** Ghost racer delta for Worte. */
export function getWorteGhostDelta(mastery, currentScore, elapsed) {
  const pace = mastery.get('worte', 'pbPace', null);
  if (!pace || !Array.isArray(pace) || pace.length < 2) return null;
  let ghostScore = 0;
  for (const p of pace) {
    if (p.t <= elapsed) ghostScore = p.s;
    else break;
  }
  return currentScore - ghostScore;
}

/** Build Worte mastery insights for the ResultsScreen. */
export function getWorteInsights(mastery, stats) {
  const mode = 'worte';
  const insights = [];

  /* Word collection progress */
  const collection = mastery.getArray(mode, 'wordCollection');
  if (collection.length > 0) {
    /* Count total words across all banks for comparison */
    const banks = CONFIG.WORD_BANKS || {};
    let totalAvail = 0;
    for (const lang of Object.values(banks)) {
      for (const words of Object.values(lang)) totalAvail += words.length;
    }
    insights.push({ type: 'word-collection', label: 'Word Collection', data: { collected: collection.length, total: totalAvail } });
  }

  /* Category mastery */
  const cats = CONFIG.WORD_CATEGORIES || {};
  const catData = {};
  let hasCats = false;
  for (const lang of Object.values(cats)) {
    for (const cat of lang) {
      const correct = mastery.mapGet(mode, 'catCorrect', cat, 0);
      const total = mastery.mapGet(mode, 'catTotal', cat, 0);
      if (total > 0) {
        catData[cat] = { correct, total };
        hasCats = true;
      }
    }
  }
  if (hasCats) {
    insights.push({ type: 'word-categories', label: 'Category Mastery', data: catData });
  }

  /* Reaction history trend */
  const wHistory = mastery.getArray(mode, 'reactionHistory');
  if (wHistory.length >= 3) {
    const recent = wHistory.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = wHistory.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    const trend = oldAvg - avg;
    insights.push({ type: 'speed-trend', label: 'Speed Evolution', data: { avg: Math.round(avg), trend: Math.round(trend), history: wHistory } });
  }

  /* Word of the Day (Plan 7 feature 3) — deterministic daily word */
  const deSeed = new Date();
  const dayNum = deSeed.getFullYear() * 10000 + (deSeed.getMonth() + 1) * 100 + deSeed.getDate();
  const allWords = collection.length > 0 ? collection : [];
  const banks = CONFIG.WORD_BANKS || {};
  let fullPool = [];
  for (const lang of Object.values(banks)) {
    for (const words of Object.values(lang)) fullPool = fullPool.concat(words);
  }
  if (fullPool.length > 0) {
    const wotdIdx = dayNum % fullPool.length;
    const wordOfDay = fullPool[wotdIdx];
    const known = collection.includes(wordOfDay?.toLowerCase?.());
    insights.push({ type: 'word-of-day', label: 'Word of the Day', data: { word: wordOfDay, known } });
  }

  /* Bilingual Progress (Plan 7 feature 5) — show cross-language coverage */
  const deCats = CONFIG.WORD_CATEGORIES?.de || [];
  const enCats = CONFIG.WORD_CATEGORIES?.en || [];
  if (deCats.length > 0 && enCats.length > 0) {
    let deCorrect = 0, enCorrect = 0;
    for (const c of deCats) deCorrect += mastery.mapGet(mode, 'catCorrect', c, 0);
    for (const c of enCats) enCorrect += mastery.mapGet(mode, 'catCorrect', c, 0);
    if (deCorrect > 0 || enCorrect > 0) {
      insights.push({ type: 'bilingual', label: 'Bilingual', data: { de: deCorrect, en: enCorrect } });
    }
  }

  return insights;
}

/* ═══════════════════════════════════════════════
   HAUPTSTAEDTE (Capitals) Mastery
   Region mastery, country collection, streaks.
   ═══════════════════════════════════════════════ */
const REGIONS = ['europe', 'americas', 'asia', 'oceania', 'africa'];

function _lookupCapEntry(displayName) {
  const bank = CONFIG.CAPITALS_BANK || [];
  return bank.find(e => e.country_de === displayName || e.country_en === displayName) || null;
}

export function startHauptstaedteGame(mastery) {
  const mode = 'hauptstaedte';
  mastery.set(mode, '_sessionCorrect', 0);
  mastery.set(mode, '_sessionStreak', 0);
  mastery.set(mode, '_bestSessionStreak', 0);
  const pbArr = mastery.getArray(mode, 'pbPace');
  mastery.set(mode, '_pbPace', pbArr);
  mastery.set(mode, '_pbIdx', 0);
}

export function trackHauptstaedteAnswer(mastery, result, game) {
  const mode = 'hauptstaedte';
  const entry = _lookupCapEntry(game.currentShape?.display);
  const region = entry?.region || 'unknown';

  if (result.correct) {
    mastery.inc(mode, '_sessionCorrect');
    mastery.inc(mode, '_sessionStreak');
    mastery.max(mode, '_bestSessionStreak', mastery.get(mode, '_sessionStreak'));
    mastery.mapInc(mode, 'regionCorrect', region);
    mastery.mapInc(mode, 'regionTotal', region);
    if (result.reaction > 0) mastery.push(mode, 'reactionHistory', result.reaction, 50);

    /* Country collection */
    const countryKey = (game.currentShape?.display || '').toLowerCase();
    const isNew = mastery.addToSet(mode, 'countryCollection', countryKey);

    return { region, isNew, streak: mastery.get(mode, '_sessionStreak') };
  } else {
    mastery.set(mode, '_sessionStreak', 0);
    mastery.mapInc(mode, 'regionTotal', region);
    return { region, isNew: false, streak: 0 };
  }
}

export function endHauptstaedteGame(mastery, stats, isPB) {
  const mode = 'hauptstaedte';
  mastery.inc(mode, 'totalGames');
  mastery.inc(mode, 'totalCorrect', stats.correct);
  mastery.max(mode, 'bestCountryStreak', mastery.get(mode, '_bestSessionStreak'));
  if (isPB) {
    const pace = [];
    const hist = mastery.getArray(mode, 'reactionHistory').slice(-stats.correct);
    let cumScore = 0;
    hist.forEach((rt, i) => { cumScore += (1000 - Math.min(rt, 1000)); pace.push({ t: i, s: cumScore }); });
    mastery.set(mode, 'pbPace', pace);
  }
}

export function getHauptstaedteGhostDelta(mastery, score, elapsed) {
  const mode = 'hauptstaedte';
  const pbPace = mastery.get(mode, '_pbPace', null);
  if (!pbPace || !Array.isArray(pbPace) || pbPace.length === 0) return null;
  let ghostScore = 0;
  for (const p of pbPace) { if (p.t <= elapsed) ghostScore = p.s; else break; }
  return score - ghostScore;
}

export function getHauptstaedteInsights(mastery, stats) {
  const mode = 'hauptstaedte';
  const insights = [];

  /* Region breakdown */
  const regionData = {};
  let hasRegion = false;
  for (const r of REGIONS) {
    const correct = mastery.mapGet(mode, 'regionCorrect', r, 0);
    const total = mastery.mapGet(mode, 'regionTotal', r, 0);
    if (total > 0) { regionData[r] = { correct, total }; hasRegion = true; }
  }
  if (hasRegion) insights.push({ type: 'region-mastery', label: 'Region Mastery', data: regionData });

  /* Country collection */
  const collected = (mastery.getArray(mode, 'countryCollection') || []).length;
  const totalCountries = (CONFIG.CAPITALS_BANK || []).length;
  if (totalCountries > 0) insights.push({ type: 'country-collection', label: 'Countries', data: { collected, total: totalCountries } });

  /* Country streak */
  const bestStreak = mastery.get(mode, 'bestCountryStreak', 0);
  if (bestStreak > 0) insights.push({ type: 'country-streak', label: 'Best Country Streak', data: { best: bestStreak } });

  /* Speed trend */
  const hHistory = mastery.getArray(mode, 'reactionHistory');
  if (hHistory.length >= 3) {
    const recent = hHistory.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = hHistory.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    insights.push({ type: 'speed-trend', label: 'Speed Evolution', data: { avg: Math.round(avg), trend: Math.round(oldAvg - avg), history: hHistory } });
  }

  /* World Map data (Plan 8 feature 1) — per-country region mapping for SVG */
  const countrySet = mastery.getArray(mode, 'countryCollection') || [];
  const bank = CONFIG.CAPITALS_BANK || [];
  const mapData = {};
  for (const entry of bank) {
    const key = (entry.country_de || entry.country_en || '').toLowerCase();
    mapData[key] = { region: entry.region || 'unknown', known: countrySet.includes(key) };
  }
  if (Object.keys(mapData).length > 0) {
    insights.push({ type: 'world-map', label: 'World Map', data: mapData });
  }

  /* Explorer-Titel (Plan 8 feature 5) — title based on regional mastery */
  const regionStars = {};
  for (const r of REGIONS) {
    const correct = mastery.mapGet(mode, 'regionCorrect', r, 0);
    const total = mastery.mapGet(mode, 'regionTotal', r, 0);
    const acc = total > 0 ? correct / total : 0;
    regionStars[r] = acc >= 0.9 ? 5 : acc >= 0.7 ? 4 : acc >= 0.5 ? 3 : acc >= 0.3 ? 2 : total > 0 ? 1 : 0;
  }
  const europeStars = regionStars.europe || 0;
  const allRegionsPlayed = REGIONS.every(r => (mastery.mapGet(mode, 'regionTotal', r, 0) > 0));
  const avgAcc = totalCountries > 0 ? collected / totalCountries : 0;
  let explorerTitle = null;
  if (avgAcc >= 0.9) explorerTitle = { id: 'geo-master', label_de: 'Geo-Meister', label_en: 'Geo-Master' };
  else if (allRegionsPlayed) explorerTitle = { id: 'world-traveller', label_de: 'Weltreisender', label_en: 'World Traveller' };
  else if (europeStars >= 4) explorerTitle = { id: 'europe-expert', label_de: 'Europa-Experte', label_en: 'European Expert' };
  if (explorerTitle) insights.push({ type: 'explorer-title', label: 'Explorer Title', data: explorerTitle });

  /* Tier Progression (Plan 8 feature 4) — current mastery tier */
  const tierInfo = mastery.getMasteryTier(mode);
  if (tierInfo.tier > 0 || tierInfo.name) {
    insights.push({ type: 'mastery-tier', label: 'Mastery Tier', data: tierInfo });
  }

  return insights;
}

/* ═══════════════════════════════════════════════
   WISSEN (Knowledge) Mastery
   Topic mastery, knowledge IQ, difficulty tracking.
   ═══════════════════════════════════════════════ */
const WISSEN_CATS = ['geo', 'sci', 'hist', 'sport', 'nature', 'cult'];
const WISSEN_CAT_LABELS = { geo: 'Geography', sci: 'Science', hist: 'History', sport: 'Sport', nature: 'Nature', cult: 'Culture' };

function _lookupWissenEntry(questionText) {
  const bank = CONFIG.WISSEN_BANK || [];
  return bank.find(e => e.q_de === questionText || e.q_en === questionText) || null;
}

export function startWissenGame(mastery) {
  const mode = 'wissen';
  mastery.set(mode, '_sessionCorrect', 0);
  mastery.set(mode, '_sessionWrong', 0);
  mastery.set(mode, '_sessionTierSum', 0);
  mastery.set(mode, '_sessionTierCount', 0);
  mastery.set(mode, '_topicStreak', 0);
  mastery.set(mode, '_lastCat', '');
  const pbArr = mastery.getArray(mode, 'pbPace');
  mastery.set(mode, '_pbPace', pbArr);
}

export function trackWissenAnswer(mastery, result, game) {
  const mode = 'wissen';
  const entry = _lookupWissenEntry(game.currentShape?.display);
  const cat = entry?.cat || 'misc';
  const tier = entry?.tier || 0;

  if (result.correct) {
    mastery.inc(mode, '_sessionCorrect');
    mastery.mapInc(mode, 'catCorrect', cat);
    mastery.mapInc(mode, 'catTotal', cat);
    mastery.inc(mode, '_sessionTierSum', tier + 1);
    mastery.inc(mode, '_sessionTierCount');
    if (result.reaction > 0) mastery.push(mode, 'reactionHistory', result.reaction, 50);

    /* Topic Streak (Plan 9 feature 4) — consecutive correct in same topic */
    const lastCat = mastery.get(mode, '_lastCat', '');
    if (cat === lastCat) {
      const streak = mastery.inc(mode, '_topicStreak');
      mastery.max(mode, 'bestTopicStreak', streak);
    } else {
      mastery.set(mode, '_topicStreak', 1);
    }
    mastery.set(mode, '_lastCat', cat);

    return { cat, tier, correct: true, topicStreak: mastery.get(mode, '_topicStreak', 1) };
  } else {
    mastery.inc(mode, '_sessionWrong');
    mastery.mapInc(mode, 'catTotal', cat);
    mastery.set(mode, '_topicStreak', 0);
    mastery.set(mode, '_lastCat', '');
    return { cat, tier, correct: false, topicStreak: 0 };
  }
}

export function endWissenGame(mastery, stats, isPB) {
  const mode = 'wissen';
  mastery.inc(mode, 'totalGames');
  mastery.inc(mode, 'totalCorrect', stats.correct);

  /* Knowledge IQ — weighted by question tier difficulty */
  const tierSum = mastery.get(mode, '_sessionTierSum', 0);
  const tierCount = mastery.get(mode, '_sessionTierCount', 0);
  const avgDiff = tierCount > 0 ? tierSum / tierCount : 0;
  const acc = stats.total > 0 ? stats.correct / stats.total : 0;
  const rawIQ = 80 + (acc * 40) + (avgDiff * 15);
  const newIQ = Math.round(Math.min(160, Math.max(80, rawIQ)));
  const oldIQ = mastery.get(mode, 'wissenIQ', 0);
  if (oldIQ === 0) mastery.set(mode, 'wissenIQ', newIQ);
  else mastery.set(mode, 'wissenIQ', Math.round(oldIQ * 0.7 + newIQ * 0.3));

  if (isPB) {
    const pace = [];
    const hist = mastery.getArray(mode, 'reactionHistory').slice(-stats.correct);
    let cum = 0;
    hist.forEach((rt, i) => { cum += (1000 - Math.min(rt, 1000)); pace.push({ t: i, s: cum }); });
    mastery.set(mode, 'pbPace', pace);
  }
}

export function getWissenGhostDelta(mastery, score, elapsed) {
  const mode = 'wissen';
  const pbPace = mastery.get(mode, '_pbPace', null);
  if (!pbPace || !Array.isArray(pbPace) || pbPace.length === 0) return null;
  let ghostScore = 0;
  for (const p of pbPace) { if (p.t <= elapsed) ghostScore = p.s; else break; }
  return score - ghostScore;
}

export function getWissenInsights(mastery, stats) {
  const mode = 'wissen';
  const insights = [];

  /* Topic radar data */
  const topicData = {};
  let hasTopics = false;
  for (const cat of WISSEN_CATS) {
    const correct = mastery.mapGet(mode, 'catCorrect', cat, 0);
    const total = mastery.mapGet(mode, 'catTotal', cat, 0);
    if (total > 0) { topicData[cat] = { correct, total, label: WISSEN_CAT_LABELS[cat] || cat }; hasTopics = true; }
  }
  if (hasTopics) insights.push({ type: 'topic-radar', label: 'Knowledge Profile', data: topicData });

  /* Expert Badges per Topic (Plan 9 feature 5) */
  const badgeThreshold = CONFIG.WISSEN_EXPERT_BADGE_THRESHOLD || 10;
  const badges = {};
  let hasBadges = false;
  for (const cat of WISSEN_CATS) {
    const correct = mastery.mapGet(mode, 'catCorrect', cat, 0);
    if (correct >= badgeThreshold) { badges[cat] = { correct, label: WISSEN_CAT_LABELS[cat] || cat }; hasBadges = true; }
  }
  if (hasBadges) insights.push({ type: 'expert-badges', label: 'Expert Badges', data: badges });

  /* Topic Streak (Plan 9 feature 4) */
  const bestTopicStreak = mastery.get(mode, 'bestTopicStreak', 0);
  if (bestTopicStreak >= 3) insights.push({ type: 'topic-streak', label: 'Topic Streak', data: { best: bestTopicStreak } });

  /* Knowledge IQ */
  const iq = mastery.get(mode, 'wissenIQ', 0);
  if (iq > 0) insights.push({ type: 'wissen-iq', label: 'Knowledge IQ', data: { iq } });

  /* Speed trend */
  const wkHistory = mastery.getArray(mode, 'reactionHistory');
  if (wkHistory.length >= 3) {
    const recent = wkHistory.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = wkHistory.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    insights.push({ type: 'speed-trend', label: 'Speed Evolution', data: { avg: Math.round(avg), trend: Math.round(oldAvg - avg), history: wkHistory } });
  }

  return insights;
}

/* ═══════════════════════════════════════════════
   MEMO (Position Memory) Mastery
   Memory span, perfect recalls, brain training.
   ═══════════════════════════════════════════════ */
export function startMemoGame(mastery) {
  const mode = 'memo';
  mastery.set(mode, '_correctSinceReveal', 0);
  mastery.set(mode, '_reveals', 0);
  mastery.set(mode, '_perfectRecallRun', 0);
  mastery.set(mode, '_bestSpanThisGame', 0);
  const pbArr = mastery.getArray(mode, 'pbPace');
  mastery.set(mode, '_pbPace', pbArr);
}

export function trackMemoAnswer(mastery, result, game) {
  const mode = 'memo';
  if (result.correct) {
    mastery.inc(mode, '_correctSinceReveal');
    mastery.inc(mode, '_perfectRecallRun');
    const span = mastery.get(mode, '_correctSinceReveal');
    mastery.max(mode, '_bestSpanThisGame', span);
    if (result.reaction > 0) mastery.push(mode, 'reactionHistory', result.reaction, 50);

    /* Check if we hit a reveal boundary (every MEMO_REVEAL_EVERY) */
    const revealEvery = CONFIG.MEMO_REVEAL_EVERY || 8;
    if (span >= revealEvery) {
      mastery.set(mode, '_correctSinceReveal', 0);
      mastery.inc(mode, '_reveals');
    }
    return { span, reveals: mastery.get(mode, '_reveals') };
  } else {
    mastery.set(mode, '_correctSinceReveal', 0);
    mastery.set(mode, '_perfectRecallRun', 0);
    return { span: 0, reveals: mastery.get(mode, '_reveals') };
  }
}

export function endMemoGame(mastery, stats, isPB) {
  const mode = 'memo';
  mastery.inc(mode, 'totalGames');
  mastery.inc(mode, 'totalCorrect', stats.correct);
  const bestSpan = mastery.get(mode, '_bestSpanThisGame', 0);
  mastery.max(mode, 'bestMemorySpan', bestSpan);
  const perfectRun = mastery.get(mode, '_perfectRecallRun', 0);
  if (perfectRun >= 8) mastery.inc(mode, 'perfectRecalls');

  /* Brain Training Streak (Plan 10 feature 2) — daily play tracking */
  const today = new Date().toISOString().slice(0, 10);
  const lastPlayDate = mastery.get(mode, 'lastPlayDate', '');
  if (lastPlayDate !== today) {
    mastery.set(mode, 'lastPlayDate', today);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (lastPlayDate === yesterday) {
      mastery.inc(mode, 'dailyStreak');
    } else if (lastPlayDate !== '') {
      mastery.set(mode, 'dailyStreak', 1);
    } else {
      mastery.set(mode, 'dailyStreak', 1);
    }
    mastery.max(mode, 'bestDailyStreak', mastery.get(mode, 'dailyStreak'));
  }

  /* Track span history for brain scan visualization (Plan 10 feature 5) */
  mastery.push(mode, 'spanHistory', bestSpan, 30);

  if (isPB) {
    const pace = [];
    const hist = mastery.getArray(mode, 'reactionHistory').slice(-stats.correct);
    let cum = 0;
    hist.forEach((rt, i) => { cum += (1000 - Math.min(rt, 1000)); pace.push({ t: i, s: cum }); });
    mastery.set(mode, 'pbPace', pace);
  }
}

export function getMemoGhostDelta(mastery, score, elapsed) {
  const mode = 'memo';
  const pbPace = mastery.get(mode, '_pbPace', null);
  if (!pbPace || !Array.isArray(pbPace) || pbPace.length === 0) return null;
  let ghostScore = 0;
  for (const p of pbPace) { if (p.t <= elapsed) ghostScore = p.s; else break; }
  return score - ghostScore;
}

export function getMemoInsights(mastery, stats) {
  const mode = 'memo';
  const insights = [];

  /* Memory span */
  const bestSpan = mastery.get(mode, 'bestMemorySpan', 0);
  if (bestSpan > 0) insights.push({ type: 'memory-span', label: 'Memory Span', data: { best: bestSpan, revealEvery: CONFIG.MEMO_REVEAL_EVERY || 8 } });

  /* Perfect recalls */
  const perfectRecalls = mastery.get(mode, 'perfectRecalls', 0);
  if (perfectRecalls > 0) insights.push({ type: 'perfect-recalls', label: 'Perfect Recalls', data: { count: perfectRecalls } });

  /* Brain Training Streak (Plan 10 feature 2) */
  const dailyStreak = mastery.get(mode, 'dailyStreak', 0);
  const bestDailyStreak = mastery.get(mode, 'bestDailyStreak', 0);
  if (dailyStreak > 0) insights.push({ type: 'daily-streak', label: 'Training Streak', data: { current: dailyStreak, best: bestDailyStreak } });

  /* Preview Time Milestones (Plan 10 feature 3) */
  const reveals = mastery.get(mode, '_reveals', 0);
  if (reveals > 0) {
    const previewBase = CONFIG.MEMO_PREVIEW_MS || 3000;
    const shrink = CONFIG.MEMO_PREVIEW_SHRINK || 200;
    const currentPreview = Math.max(500, previewBase - reveals * shrink);
    insights.push({ type: 'preview-milestone', label: 'Preview Time', data: { currentMs: currentPreview, baseMs: previewBase, reveals } });
  }

  /* Brain Scan Visualization (Plan 10 feature 5) — span history as neural map */
  const spanHist = mastery.getArray(mode, 'spanHistory');
  if (spanHist.length >= 3) {
    insights.push({ type: 'brain-scan', label: 'Brain Scan', data: { history: spanHist, best: bestSpan } });
  }

  /* Speed trend */
  const mHistory = mastery.getArray(mode, 'reactionHistory');
  if (mHistory.length >= 3) {
    const recent = mHistory.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = mHistory.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    insights.push({ type: 'speed-trend', label: 'Speed Evolution', data: { avg: Math.round(avg), trend: Math.round(oldAvg - avg), history: mHistory } });
  }

  return insights;
}

/* ═══════════════════════════════════════════════
   SEQUENZ (Simon Says) Mastery
   Sequence length records, round tracking.
   ═══════════════════════════════════════════════ */
export function startSequenzGame(mastery) {
  const mode = 'sequenz';
  mastery.set(mode, '_sessionRounds', 0);
  mastery.set(mode, '_sessionPerfectRounds', 0);
  mastery.set(mode, '_sessionBestLen', 0);
}

export function trackSequenzResult(mastery, result, game) {
  const mode = 'sequenz';
  if (result.sequenzComplete && result.correct) {
    mastery.inc(mode, '_sessionRounds');
    const seqLen = result.seqLen || (CONFIG.SEQUENZ_START_LENGTH + (result.sequenzRound || 0));
    mastery.max(mode, '_sessionBestLen', seqLen);
    mastery.inc(mode, '_sessionPerfectRounds');

    /* Speed per Length (Plan 11 feature 3) — track avg reaction per sequence length */
    if (result.reaction > 0) {
      mastery.mapInc(mode, 'lenSpeedSum', String(seqLen), result.reaction);
      mastery.mapInc(mode, 'lenSpeedCount', String(seqLen));
    }

    /* Pattern Replay data (Plan 11 feature 4) — store the best sequence pattern */
    if (seqLen > mastery.get(mode, 'bestSeqLength', 0) && game?.sequenzPattern) {
      mastery.set(mode, 'bestPattern', [...game.sequenzPattern]);
    }

    return { seqLen, round: mastery.get(mode, '_sessionRounds'), isRecord: seqLen > mastery.get(mode, 'bestSeqLength', 0) };
  }
  if (!result.correct && result.sequenzRound !== undefined) {
    mastery.inc(mode, '_sessionRounds');
    return { seqLen: 0, round: mastery.get(mode, '_sessionRounds'), isRecord: false };
  }
  return null; /* partial step — no tracking needed */
}

export function endSequenzGame(mastery, stats, isPB) {
  const mode = 'sequenz';
  mastery.inc(mode, 'totalGames');
  mastery.inc(mode, 'totalRounds', mastery.get(mode, '_sessionRounds'));
  mastery.inc(mode, 'perfectRounds', mastery.get(mode, '_sessionPerfectRounds'));
  mastery.max(mode, 'bestSeqLength', mastery.get(mode, '_sessionBestLen'));

  /* Daily challenge tracking (Plan 11 feature 5) */
  const today = new Date().toISOString().slice(0, 10);
  const lastDate = mastery.get(mode, 'lastPlayDate', '');
  if (lastDate !== today) {
    mastery.set(mode, 'lastPlayDate', today);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (lastDate === yesterday) mastery.inc(mode, 'dailyStreak');
    else mastery.set(mode, 'dailyStreak', 1);
    mastery.max(mode, 'bestDailyStreak', mastery.get(mode, 'dailyStreak'));
  }
}

export function getSequenzInsights(mastery, stats) {
  const mode = 'sequenz';
  const insights = [];

  /* Sequence length record */
  const bestLen = mastery.get(mode, 'bestSeqLength', 0);
  if (bestLen > 0) insights.push({ type: 'seq-record', label: 'Sequence Record', data: { best: bestLen, target: 100 } });

  /* Round stats */
  const totalRounds = mastery.get(mode, 'totalRounds', 0);
  const perfectRounds = mastery.get(mode, 'perfectRounds', 0);
  if (totalRounds > 0) insights.push({ type: 'seq-rounds', label: 'Rounds', data: { total: totalRounds, perfect: perfectRounds } });

  /* Speed per Length (Plan 11 feature 3) */
  const lenSpeedSum = mastery.mapGetAll(mode, 'lenSpeedSum');
  const lenSpeedCount = mastery.mapGetAll(mode, 'lenSpeedCount');
  const speedPerLen = {};
  let hasSpeedData = false;
  for (const len of Object.keys(lenSpeedCount)) {
    const cnt = lenSpeedCount[len] || 1;
    const sum = lenSpeedSum[len] || 0;
    speedPerLen[len] = Math.round(sum / cnt);
    hasSpeedData = true;
  }
  if (hasSpeedData) insights.push({ type: 'speed-per-length', label: 'Speed by Length', data: speedPerLen });

  /* Pattern Replay (Plan 11 feature 4) */
  const bestPattern = mastery.get(mode, 'bestPattern', null);
  if (bestPattern && Array.isArray(bestPattern) && bestPattern.length > 0) {
    insights.push({ type: 'pattern-replay', label: 'Best Pattern', data: { pattern: bestPattern, length: bestPattern.length } });
  }

  /* Daily Challenge streak (Plan 11 feature 5) */
  const dailyStreak = mastery.get(mode, 'dailyStreak', 0);
  if (dailyStreak > 0) insights.push({ type: 'daily-streak', label: 'Daily Challenge', data: { current: dailyStreak, best: mastery.get(mode, 'bestDailyStreak', 0) } });

  return insights;
}

/* ═══════════════════════════════════════════════
   STROOP (Color vs Word) Mastery
   Interference tracking, congruent/incongruent split.
   ═══════════════════════════════════════════════ */
function _isStroopCongruent(game) {
  const shape = game.currentShape;
  if (!shape) return true;
  /* Compare ink color to the word meaning using STROOP_COLORS */
  const colors4 = CONFIG.STROOP_COLORS_4 || [];
  const colors8 = CONFIG.STROOP_COLORS_8 || [];
  const allColors = [...colors4, ...colors8];
  const wordColor = allColors.find(c => c.name_de === shape.display || c.name_en === shape.display);
  return wordColor ? (wordColor.hex === shape.inkColor) : true;
}

export function startStroopGame(mastery) {
  const mode = 'stroop';
  mastery.set(mode, '_congCorrect', 0);
  mastery.set(mode, '_congTotal', 0);
  mastery.set(mode, '_incongCorrect', 0);
  mastery.set(mode, '_incongTotal', 0);
  mastery.set(mode, '_congRtSum', 0);
  mastery.set(mode, '_incongRtSum', 0);
  mastery.set(mode, '_consecutiveCorrect', 0);
  mastery.set(mode, '_challengeRoundsThisGame', 0);
  mastery.set(mode, '_inChallenge', false);
  const pbArr = mastery.getArray(mode, 'pbPace');
  mastery.set(mode, '_pbPace', pbArr);
}

export function trackStroopAnswer(mastery, result, game) {
  const mode = 'stroop';
  const congruent = _isStroopCongruent(game);

  if (congruent) {
    mastery.inc(mode, '_congTotal');
    if (result.correct) {
      mastery.inc(mode, '_congCorrect');
      if (result.reaction > 0) mastery.inc(mode, '_congRtSum', result.reaction);
    }
  } else {
    mastery.inc(mode, '_incongTotal');
    if (result.correct) {
      mastery.inc(mode, '_incongCorrect');
      if (result.reaction > 0) mastery.inc(mode, '_incongRtSum', result.reaction);
    }
  }

  if (result.correct && result.reaction > 0) mastery.push(mode, 'reactionHistory', result.reaction, 50);

  /* Challenge Round trigger tracking (Plan 12 feature 4) */
  let challengeTriggered = false;
  if (result.correct) {
    const consec = mastery.inc(mode, '_consecutiveCorrect');
    const threshold = CONFIG.STROOP_CHALLENGE_EVERY || 15;
    if (consec >= threshold && !mastery.get(mode, '_inChallenge')) {
      mastery.set(mode, '_inChallenge', true);
      mastery.set(mode, '_consecutiveCorrect', 0);
      mastery.inc(mode, '_challengeRoundsThisGame');
      challengeTriggered = true;
    }
  } else {
    mastery.set(mode, '_consecutiveCorrect', 0);
  }

  return { congruent, challengeTriggered };
}

export function endStroopGame(mastery, stats, isPB) {
  const mode = 'stroop';
  mastery.inc(mode, 'totalGames');
  mastery.inc(mode, 'totalCorrect', stats.correct);
  mastery.inc(mode, 'congruentCorrect', mastery.get(mode, '_congCorrect'));
  mastery.inc(mode, 'incongruentCorrect', mastery.get(mode, '_incongCorrect'));

  /* Calculate interference: difference in accuracy between congruent and incongruent */
  const congTotal = mastery.get(mode, '_congTotal', 0);
  const incongTotal = mastery.get(mode, '_incongTotal', 0);
  const congAcc = congTotal > 0 ? mastery.get(mode, '_congCorrect') / congTotal : 1;
  const incongAcc = incongTotal > 0 ? mastery.get(mode, '_incongCorrect') / incongTotal : 1;
  const interference = Math.round(Math.max(0, (congAcc - incongAcc) * 100));
  const congRt = congTotal > 0 ? Math.round(mastery.get(mode, '_congRtSum') / mastery.get(mode, '_congCorrect', 1)) : 0;
  const incongRt = incongTotal > 0 ? Math.round(mastery.get(mode, '_incongRtSum') / mastery.get(mode, '_incongCorrect', 1)) : 0;

  mastery.set(mode, 'lastInterference', interference);
  mastery.set(mode, 'lastCongRt', congRt);
  mastery.set(mode, 'lastIncongRt', incongRt);
  if (mastery.get(mode, 'bestInterference', 100) > interference || mastery.get(mode, 'bestInterference', 100) === 100) {
    mastery.set(mode, 'bestInterference', interference);
  }

  /* Interference history for chart (Plan 12 feature 5) */
  mastery.push(mode, 'interferenceHistory', interference, 30);

  /* Challenge round tracking (Plan 12 feature 4) */
  mastery.inc(mode, 'challengeRoundsPlayed', mastery.get(mode, '_challengeRoundsThisGame', 0));

  if (isPB) {
    const pace = [];
    const hist = mastery.getArray(mode, 'reactionHistory').slice(-stats.correct);
    let cum = 0;
    hist.forEach((rt, i) => { cum += (1000 - Math.min(rt, 1000)); pace.push({ t: i, s: cum }); });
    mastery.set(mode, 'pbPace', pace);
  }
}

export function getStroopGhostDelta(mastery, score, elapsed) {
  const mode = 'stroop';
  const pbPace = mastery.get(mode, '_pbPace', null);
  if (!pbPace || !Array.isArray(pbPace) || pbPace.length === 0) return null;
  let ghostScore = 0;
  for (const p of pbPace) { if (p.t <= elapsed) ghostScore = p.s; else break; }
  return score - ghostScore;
}

export function getStroopInsights(mastery, stats) {
  const mode = 'stroop';
  const insights = [];

  /* Interference score */
  const interference = mastery.get(mode, 'lastInterference', -1);
  const bestInterference = mastery.get(mode, 'bestInterference', 100);
  if (interference >= 0) insights.push({ type: 'interference', label: 'Interference', data: { current: interference, best: bestInterference } });

  /* Congruent vs Incongruent split */
  const congRt = mastery.get(mode, 'lastCongRt', 0);
  const incongRt = mastery.get(mode, 'lastIncongRt', 0);
  if (congRt > 0 || incongRt > 0) insights.push({ type: 'stroop-split', label: 'Congruent vs Incongruent', data: { congRt, incongRt } });

  /* Brain Control Level (Plan 12 feature 3) */
  const levels = CONFIG.STROOP_BRAIN_LEVELS || [];
  if (interference >= 0 && levels.length > 0) {
    let brainLevel = levels[0];
    for (const l of levels) {
      if (interference <= l.maxInterference) brainLevel = l;
    }
    insights.push({ type: 'brain-control', label: 'Brain Control', data: brainLevel });
  }

  /* Challenge Rounds survived (Plan 12 feature 4) */
  const challengeRounds = mastery.get(mode, 'challengeRoundsPlayed', 0);
  if (challengeRounds > 0) insights.push({ type: 'challenge-rounds', label: 'Challenge Rounds', data: { total: challengeRounds } });

  /* Interference Reduction Chart (Plan 12 feature 5) */
  const intHistory = mastery.getArray(mode, 'interferenceHistory');
  if (intHistory.length >= 3) {
    insights.push({ type: 'interference-chart', label: 'Interference Trend', data: { history: intHistory } });
  }

  /* Speed trend */
  const sHistory = mastery.getArray(mode, 'reactionHistory');
  if (sHistory.length >= 3) {
    const recent = sHistory.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = sHistory.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    insights.push({ type: 'speed-trend', label: 'Speed Evolution', data: { avg: Math.round(avg), trend: Math.round(oldAvg - avg), history: sHistory } });
  }

  return insights;
}

/* ═══════════════════════════════════════════════
   FOKUS (Flanker Task) Mastery
   Focus score, congruent/incongruent tracking.
   ═══════════════════════════════════════════════ */
export function startFokusGame(mastery) {
  const mode = 'fokus';
  mastery.set(mode, '_congCorrect', 0);
  mastery.set(mode, '_congTotal', 0);
  mastery.set(mode, '_incongCorrect', 0);
  mastery.set(mode, '_incongTotal', 0);
  mastery.set(mode, '_congRtSum', 0);
  mastery.set(mode, '_incongRtSum', 0);
  mastery.set(mode, '_incongPerfectRun', 0);
  const pbArr = mastery.getArray(mode, 'pbPace');
  mastery.set(mode, '_pbPace', pbArr);
}

export function trackFokusAnswer(mastery, result, game) {
  const mode = 'fokus';
  const congruent = game.currentShape?.isCongruent ?? true;

  if (congruent) {
    mastery.inc(mode, '_congTotal');
    if (result.correct) {
      mastery.inc(mode, '_congCorrect');
      if (result.reaction > 0) mastery.inc(mode, '_congRtSum', result.reaction);
    }
  } else {
    mastery.inc(mode, '_incongTotal');
    if (result.correct) {
      mastery.inc(mode, '_incongCorrect');
      if (result.reaction > 0) mastery.inc(mode, '_incongRtSum', result.reaction);
      /* Tunnel Vision tracking (Plan 13 feature 3) — consecutive incongruent correct */
      const tvRun = mastery.inc(mode, '_incongPerfectRun');
      mastery.max(mode, 'bestIncongRun', tvRun);
    } else {
      mastery.set(mode, '_incongPerfectRun', 0);
    }
  }

  if (result.correct && result.reaction > 0) mastery.push(mode, 'reactionHistory', result.reaction, 50);

  /* Distraction Intensity level (Plan 13 feature 2) */
  const levels = CONFIG.FOKUS_DISTRACTION_LEVELS || [];
  const totalAnswered = mastery.get(mode, '_congTotal', 0) + mastery.get(mode, '_incongTotal', 0);
  let distractionLevel = levels[0] || { level: 1 };
  for (const l of levels) { if (totalAnswered >= l.threshold) distractionLevel = l; }

  return { congruent, distractionLevel };
}

export function endFokusGame(mastery, stats, isPB) {
  const mode = 'fokus';
  mastery.inc(mode, 'totalGames');
  mastery.inc(mode, 'totalCorrect', stats.correct);
  mastery.inc(mode, 'congruentCorrect', mastery.get(mode, '_congCorrect'));
  mastery.inc(mode, 'incongruentCorrect', mastery.get(mode, '_incongCorrect'));

  /* Focus score: weighted by incongruent accuracy */
  const congTotal = mastery.get(mode, '_congTotal', 0);
  const incongTotal = mastery.get(mode, '_incongTotal', 0);
  const congAcc = congTotal > 0 ? mastery.get(mode, '_congCorrect') / congTotal : 1;
  const incongAcc = incongTotal > 0 ? mastery.get(mode, '_incongCorrect') / incongTotal : 1;
  const focusScore = Math.round((incongAcc * 60 + congAcc * 40) * (stats.correct / Math.max(stats.total, 1)));
  mastery.set(mode, 'lastFocusScore', focusScore);
  mastery.max(mode, 'bestFocusScore', focusScore);

  const congRt = mastery.get(mode, '_congCorrect', 0) > 0 ? Math.round(mastery.get(mode, '_congRtSum') / mastery.get(mode, '_congCorrect')) : 0;
  const incongRt = mastery.get(mode, '_incongCorrect', 0) > 0 ? Math.round(mastery.get(mode, '_incongRtSum') / mastery.get(mode, '_incongCorrect')) : 0;
  mastery.set(mode, 'lastCongRt', congRt);
  mastery.set(mode, 'lastIncongRt', incongRt);

  const distractionCost = Math.round(Math.max(0, (congAcc - incongAcc) * 100));
  mastery.set(mode, 'lastDistractionCost', distractionCost);

  /* Focus Training Streak (Plan 13 feature 5) — daily play tracking */
  const today = new Date().toISOString().slice(0, 10);
  const lastPlayDate = mastery.get(mode, 'lastPlayDate', '');
  if (lastPlayDate !== today) {
    mastery.set(mode, 'lastPlayDate', today);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (lastPlayDate === yesterday) mastery.inc(mode, 'dailyStreak');
    else mastery.set(mode, 'dailyStreak', 1);
    mastery.max(mode, 'bestDailyStreak', mastery.get(mode, 'dailyStreak'));
  }

  if (isPB) {
    const pace = [];
    const hist = mastery.getArray(mode, 'reactionHistory').slice(-stats.correct);
    let cum = 0;
    hist.forEach((rt, i) => { cum += (1000 - Math.min(rt, 1000)); pace.push({ t: i, s: cum }); });
    mastery.set(mode, 'pbPace', pace);
  }
}

export function getFokusGhostDelta(mastery, score, elapsed) {
  const mode = 'fokus';
  const pbPace = mastery.get(mode, '_pbPace', null);
  if (!pbPace || !Array.isArray(pbPace) || pbPace.length === 0) return null;
  let ghostScore = 0;
  for (const p of pbPace) { if (p.t <= elapsed) ghostScore = p.s; else break; }
  return score - ghostScore;
}

export function getFokusInsights(mastery, stats) {
  const mode = 'fokus';
  const insights = [];

  /* Focus score */
  const focusScore = mastery.get(mode, 'lastFocusScore', 0);
  const bestFocus = mastery.get(mode, 'bestFocusScore', 0);
  if (focusScore > 0) insights.push({ type: 'focus-score', label: 'Focus Score', data: { current: focusScore, best: bestFocus } });

  /* Distraction cost */
  const cost = mastery.get(mode, 'lastDistractionCost', -1);
  if (cost >= 0) insights.push({ type: 'distraction-cost', label: 'Distraction Cost', data: { cost } });

  /* Congruent vs Incongruent split */
  const congRt = mastery.get(mode, 'lastCongRt', 0);
  const incongRt = mastery.get(mode, 'lastIncongRt', 0);
  if (congRt > 0 || incongRt > 0) insights.push({ type: 'fokus-split', label: 'Focus Split', data: { congRt, incongRt } });

  /* Distraction Intensity Level (Plan 13 feature 2) */
  const levels = CONFIG.FOKUS_DISTRACTION_LEVELS || [];
  const totalCorrectFokus = mastery.get(mode, 'totalCorrect', 0);
  let currentLevel = levels[0] || { level: 1 };
  for (const l of levels) { if (totalCorrectFokus >= l.threshold) currentLevel = l; }
  insights.push({ type: 'distraction-level', label: 'Distraction Level', data: currentLevel });

  /* Tunnel Vision Achievement (Plan 13 feature 3) */
  const bestIncongRun = mastery.get(mode, 'bestIncongRun', 0);
  const thresholds = CONFIG.FOKUS_TUNNEL_THRESHOLDS || [5, 10, 20, 50];
  let tvTier = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (bestIncongRun >= thresholds[i]) { tvTier = i + 1; break; }
  }
  if (tvTier > 0) insights.push({ type: 'tunnel-vision', label: 'Tunnel Vision', data: { run: bestIncongRun, tier: tvTier, maxTier: thresholds.length } });

  /* Focus Training Streak (Plan 13 feature 5) */
  const dailyStreak = mastery.get(mode, 'dailyStreak', 0);
  if (dailyStreak > 0) insights.push({ type: 'daily-streak', label: 'Focus Training', data: { current: dailyStreak, best: mastery.get(mode, 'bestDailyStreak', 0) } });

  /* Speed trend */
  const fHistory = mastery.getArray(mode, 'reactionHistory');
  if (fHistory.length >= 3) {
    const recent = fHistory.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = fHistory.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    insights.push({ type: 'speed-trend', label: 'Speed Evolution', data: { avg: Math.round(avg), trend: Math.round(oldAvg - avg), history: fHistory } });
  }

  return insights;
}

/* ═══════════════════════════════════════════════
   CHAOS (Rule Switching) Mastery
   Flexibility score, rule mastery, adaptation speed.
   ═══════════════════════════════════════════════ */
const CHAOS_RULES = ['color', 'shape', 'size', 'math', 'stroop'];

export function startChaosGame(mastery) {
  const mode = 'chaos';
  mastery.set(mode, '_switchCount', 0);
  mastery.set(mode, '_postSwitchErrors', 0);
  mastery.set(mode, '_postSwitchTotal', 0);
  mastery.set(mode, '_lastRule', '');
  mastery.set(mode, '_inAdaptation', false);
  mastery.set(mode, '_adaptSteps', []);
  const pbArr = mastery.getArray(mode, 'pbPace');
  mastery.set(mode, '_pbPace', pbArr);
}

export function trackChaosAnswer(mastery, result, game) {
  const mode = 'chaos';
  const rule = game.currentShape?.chaosRule || 'color';

  /* Detect rule switch */
  const lastRule = mastery.get(mode, '_lastRule', '');
  if (lastRule && rule !== lastRule) {
    mastery.inc(mode, '_switchCount');
    mastery.set(mode, '_inAdaptation', true);
    mastery.set(mode, '_postSwitchTotal', 0);
    mastery.set(mode, '_postSwitchErrors', 0);
  }
  mastery.set(mode, '_lastRule', rule);

  /* Track adaptation (first 3 answers after switch) */
  if (mastery.get(mode, '_inAdaptation')) {
    mastery.inc(mode, '_postSwitchTotal');
    if (!result.correct) mastery.inc(mode, '_postSwitchErrors');
    if (mastery.get(mode, '_postSwitchTotal') >= 3) {
      const errs = mastery.get(mode, '_postSwitchErrors');
      const steps = mastery.get(mode, '_adaptSteps', []);
      if (Array.isArray(steps)) steps.push(errs);
      mastery.set(mode, '_adaptSteps', steps);
      mastery.set(mode, '_inAdaptation', false);
    }
  }

  if (result.correct) {
    mastery.mapInc(mode, 'ruleCorrect', rule);
    mastery.mapInc(mode, 'ruleTotal', rule);
    if (result.reaction > 0) mastery.push(mode, 'reactionHistory', result.reaction, 50);
  } else {
    mastery.mapInc(mode, 'ruleTotal', rule);
  }

  return { rule, switchCount: mastery.get(mode, '_switchCount') };
}

export function endChaosGame(mastery, stats, isPB) {
  const mode = 'chaos';
  mastery.inc(mode, 'totalGames');
  mastery.inc(mode, 'totalCorrect', stats.correct);
  mastery.inc(mode, 'totalSwitchesSurvived', mastery.get(mode, '_switchCount'));

  /* Flexibility score: based on adaptation speed + rule diversity */
  const adaptSteps = mastery.get(mode, '_adaptSteps', []);
  const avgAdaptErrors = Array.isArray(adaptSteps) && adaptSteps.length > 0
    ? adaptSteps.reduce((a, b) => a + b, 0) / adaptSteps.length : 3;
  const switchCount = mastery.get(mode, '_switchCount', 0);
  const acc = stats.total > 0 ? stats.correct / stats.total : 0;
  const flexScore = Math.round(Math.min(100, (acc * 40) + (switchCount * 5) + ((3 - avgAdaptErrors) * 15)));
  mastery.set(mode, 'lastFlexScore', flexScore);
  mastery.max(mode, 'bestFlexScore', flexScore);

  if (isPB) {
    const pace = [];
    const hist = mastery.getArray(mode, 'reactionHistory').slice(-stats.correct);
    let cum = 0;
    hist.forEach((rt, i) => { cum += (1000 - Math.min(rt, 1000)); pace.push({ t: i, s: cum }); });
    mastery.set(mode, 'pbPace', pace);
  }
}

export function getChaosGhostDelta(mastery, score, elapsed) {
  const mode = 'chaos';
  const pbPace = mastery.get(mode, '_pbPace', null);
  if (!pbPace || !Array.isArray(pbPace) || pbPace.length === 0) return null;
  let ghostScore = 0;
  for (const p of pbPace) { if (p.t <= elapsed) ghostScore = p.s; else break; }
  return score - ghostScore;
}

export function getChaosInsights(mastery, stats) {
  const mode = 'chaos';
  const insights = [];

  /* Rule mastery */
  const ruleData = {};
  let hasRules = false;
  for (const r of CHAOS_RULES) {
    const correct = mastery.mapGet(mode, 'ruleCorrect', r, 0);
    const total = mastery.mapGet(mode, 'ruleTotal', r, 0);
    if (total > 0) { ruleData[r] = { correct, total }; hasRules = true; }
  }
  if (hasRules) insights.push({ type: 'rule-mastery', label: 'Rule Mastery', data: ruleData });

  /* Flexibility score */
  const flexScore = mastery.get(mode, 'lastFlexScore', 0);
  const bestFlex = mastery.get(mode, 'bestFlexScore', 0);
  if (flexScore > 0) insights.push({ type: 'flex-score', label: 'Flexibility', data: { current: flexScore, best: bestFlex } });

  /* Switches survived */
  const switches = mastery.get(mode, 'totalSwitchesSurvived', 0);
  if (switches > 0) insights.push({ type: 'switches-survived', label: 'Switches Survived', data: { total: switches } });

  /* Chaos Rank (Plan 14 feature 5) */
  const rankTiers = CONFIG.CHAOS_RANK || [];
  if (rankTiers.length > 0) {
    const masteryScore = mastery.getMasteryScore(mode);
    let rank = rankTiers[0];
    for (const r of rankTiers) { if (masteryScore >= r.threshold) rank = r; }
    const nextRank = rankTiers[rankTiers.indexOf(rank) + 1] || null;
    insights.push({ type: 'chaos-rank', label: 'Chaos Rank', data: { rank, score: masteryScore, next: nextRank } });
  }

  /* Adaptation Speed insight */
  const adaptSteps = mastery.get(mode, '_adaptSteps', []);
  if (Array.isArray(adaptSteps) && adaptSteps.length >= 2) {
    const avgErrors = adaptSteps.reduce((a, b) => a + b, 0) / adaptSteps.length;
    insights.push({ type: 'adaptation-speed', label: 'Adaptation Speed', data: { avgErrors: Math.round(avgErrors * 10) / 10, samples: adaptSteps.length } });
  }

  /* Speed trend */
  const cHistory = mastery.getArray(mode, 'reactionHistory');
  if (cHistory.length >= 3) {
    const recent = cHistory.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = cHistory.slice(0, -5);
    const oldAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avg;
    insights.push({ type: 'speed-trend', label: 'Speed Evolution', data: { avg: Math.round(avg), trend: Math.round(oldAvg - avg), history: cHistory } });
  }

  return insights;
}