/* ═══════════════════════════════════════════════
   SCS Play — Game Engine
   Core game logic: spawning, scoring, timer,
   rush, fever, adaptive difficulty,
   math / word / memo modes.
   ═══════════════════════════════════════════════ */
import { CONFIG } from '../config.js';

/* ─── Mulberry32 seeded PRNG ─── */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function todaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class GameEngine {
  constructor() { this.reset(); }

  reset() {
    this.mode = 'beginner';
    this.playType = 'blitz';
    this.isDaily = false;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.multiplier = 1;
    this.correct = 0;
    this.wrong = 0;
    this.total = 0;
    this.timer = CONFIG.GAME_DURATION;
    this.running = false;
    this.practice = false;
    this.paused = false;
    this.continued = false;

    /* Achievement tracking counters */
    this._goldenCaught = 0;
    this._diamondCaught = 0;
    this._feverTriggered = 0;
    this._maxMultiplier = 1;

    this.endlessLives = CONFIG.ENDLESS_MAX_MISSES;
    this.endlessTotalMisses = 0;

    this.competitionLevel = 0;
    this.competitionTarget = 0;

    this.spawnInterval = CONFIG.SPAWN_INTERVAL_START;
    this.currentShape = null;
    this.cornerMap = {};
    this.rng = Math.random;

    this.reactionTimes = [];
    this.lastSpawnTime = 0;
    clearInterval(this._elapsedInterval);
    this._elapsedInterval = null;
    clearTimeout(this._timerInterval);
    this._timerInterval = null;
    this._timerWallStart = null;
    this._timerTarget = 0;
    this._timerPausedAccum = 0;
    this._timerPauseStart = null;
    clearTimeout(this._spawnTimeout);
    this._spawnTimeout = null;
    clearTimeout(this._rushTimeout);
    this._rushTimeout = null;
    this._rushQueue = [];
    this.inRush = false;
    this._rushIndex = 0;
    this._consecutiveMisses = 0;
    this._recentWindow = [];

    this.feverActive = false;
    this._feverTimeout = null;
    this._feverCooldownUntil = 0;
    this.bonusType = null;
    this.feverStreak = 0;

    /* Corner shuffle */
    this._nextShuffleAt = Infinity;
    this._shuffleCount = 0;
    clearTimeout(this._shuffleTimeout);
    this._shuffleTimeout = null;

    /* Word mode: corner-label shuffle tracking */
    this._wordShuffleCounter = 0;
    this._wordShuffledDirs = null;

    /* Memo (hidden corners) state */
    this._memoRevealCount = 0;
    this._memoCorrectSinceReveal = 0;
    clearTimeout(this._memoPreviewTimeout);
    this._memoPreviewTimeout = null;

    /* Sequenz (Simon Says) state */
    this._seqRound = 0;
    this._seqPattern = [];
    this._seqInputIndex = 0;
    this._seqPhase = 'idle'; // 'idle' | 'watch' | 'go'
    this._seqFlashTimeouts = [];
    clearTimeout(this._seqInputTimeout);
    this._seqInputTimeout = null;

    this.elapsed = 0;

    /* callbacks */
    this.onTick = null;
    this.onSpawn = null;
    this.onResult = null;
    this.onRush = null;
    this.onGameOver = null;
    this.onMultiplierChange = null;
    this.onPerfect = null;
    this.onStreak = null;
    this.onFeverStart = null;
    this.onFeverEnd = null;
    this.onBonus = null;
    this.onContinuePrompt = null;
    this.onEndlessMiss = null;
    this.onComboMilestone = null;
    this.onCompetitionComplete = null;
    this.onCornersUpdate = null;
    this.onScoreMilestone = null;
    this.onStreakBreak = null;
    this.onCornerShuffleWarn = null;
    this.onCornerShuffle = null;
    this.onChaosRuleSwitch = null;
    /* Streak time bonus callbacks */
    this.onTimerBonus = null;
    this.onTimerPenalty = null;
    this.onEndlessLifeEarned = null;
    /* Memo (hidden corners) callbacks */
    this.onMemoPreview = null;
    this.onMemoCover = null;
    this.onMemoReveal = null;
    /* Sequenz callbacks */
    this.onSequenzFlash = null;
    this.onSequenzReady = null;
    this.onSequenzResult = null;
    this.onSequenzRoundStart = null;
    this._lastMilestoneIndex = -1;
    this._lang = 'de';
  }

  get contentType() {
    if (this.mode === 'mathe' || this.mode === 'algebra') return 'math';
    if (this.mode === 'hauptstaedte') return 'capitals';
    if (this.mode === 'worte') return 'word';
    if (this.mode === 'stroop') return 'stroop';
    if (this.mode === 'fokus') return 'fokus';
    if (this.mode === 'chaos') return 'chaos';
    return 'shape';
  }

  get isBrainMode() {
    return this.mode === 'mathe' || this.mode === 'worte' || this.mode === 'hauptstaedte' || this.mode === 'algebra';
  }

  get isReflexMode() {
    return this.mode === 'stroop' || this.mode === 'fokus' || this.mode === 'chaos';
  }

  get isMemoMode() {
    return this.mode === 'memo';
  }

  get isSequenzMode() {
    return this.mode === 'sequenz';
  }

  get _spawnStart() {
    if (this.isSequenzMode || this.isMemoMode) return CONFIG.SPAWN_MEMO_START;
    if (!this.isBrainMode && !this.isReflexMode) return CONFIG.SPAWN_INTERVAL_START;
    if (this.playType === 'classic')  return CONFIG.SPAWN_BRAIN_CLASSIC_START;
    if (this.playType === 'endless')  return CONFIG.SPAWN_BRAIN_ENDLESS_START;
    return CONFIG.SPAWN_BRAIN_START;
  }
  get _spawnMin() {
    if (this.isSequenzMode || this.isMemoMode) return CONFIG.SPAWN_MEMO_MIN;
    return (this.isBrainMode || this.isReflexMode) ? CONFIG.SPAWN_BRAIN_MIN : CONFIG.SPAWN_INTERVAL_MIN;
  }
  get _spawnMax() {
    if (this.isSequenzMode || this.isMemoMode) return CONFIG.SPAWN_MEMO_MAX;
    return (this.isBrainMode || this.isReflexMode) ? CONFIG.SPAWN_BRAIN_MAX : CONFIG.SPAWN_INTERVAL_MAX;
  }
  get _spawnStep() {
    if (this.isSequenzMode || this.isMemoMode) return CONFIG.SPAWN_MEMO_STEP;
    return (this.isBrainMode || this.isReflexMode) ? CONFIG.SPAWN_BRAIN_STEP : CONFIG.SPAWN_INTERVAL_STEP;
  }
  get _speedStep() {
    return Math.max(1, Math.round((this._spawnStart - this._spawnMin) / CONFIG.SPEED_CORRECT_DIVISOR));
  }

  get shapes() {
    if (this.mode === 'ultra')    return CONFIG.SHAPES_ULTRA;
    if (this.mode === 'expert')   return CONFIG.SHAPES_EXPERT;
    if (this.mode === 'klassik')  return CONFIG.SHAPES_KLASSIK;
    if (this.mode === 'memo' || this.mode === 'sequenz') return CONFIG.SHAPES_MEMO;
    return CONFIG.SHAPES_BEGINNER;
  }

  get directions() {
    if (this.mode === 'ultra')    return CONFIG.DIRECTIONS_ULTRA;
    if (this.mode === 'expert')   return CONFIG.DIRECTIONS_EXPERT;
    if (this.mode === 'klassik')  return CONFIG.DIRECTIONS_KLASSIK;
    if (this.mode === 'mathe' || this.mode === 'worte' || this.mode === 'memo' || this.mode === 'sequenz'
        || this.mode === 'stroop' || this.mode === 'fokus' || this.mode === 'chaos'
        || this.mode === 'hauptstaedte' || this.mode === 'algebra')
      return CONFIG.DIRECTIONS_4;
    return CONFIG.DIRECTIONS_BEGINNER;
  }

  _getDuration() {
    switch (this.playType) {
      case 'classic':     return CONFIG.DURATION_CLASSIC;
      case 'endless':     return CONFIG.DURATION_ENDLESS;
      case 'competition': {
        const table = (this.isBrainMode || this.isReflexMode)
          ? (CONFIG.DURATION_COMPETITION_BRAIN || CONFIG.DURATION_COMPETITION)
          : CONFIG.DURATION_COMPETITION;
        return table[this.competitionLevel] || 30;
      }
      case 'blitz':
      default:
        return (this.isBrainMode || this.isReflexMode)
          ? (CONFIG.DURATION_BLITZ_BRAIN || CONFIG.DURATION_BLITZ)
          : CONFIG.DURATION_BLITZ;
    }
  }

  start(mode = 'beginner', playType = 'blitz', options = {}) {
    this.reset();
    this.mode = mode;
    this.playType = playType;
    this.practice = options.practice || false;
    this.isDaily = options.daily || false;
    this._lang = options.lang || 'de';
    this.running = true;

    if (playType === 'competition') {
      this.competitionLevel = options.competitionLevel || 0;
      const baseTarget = CONFIG.COMPETITION_SCORE_TARGETS[this.competitionLevel] || 2000;
      /* Scale targets down for slower modes (brain/reflex produce fewer answers) */
      const categoryScale = (this.isBrainMode || this.isReflexMode) ? 0.7
                           : (this.isMemoMode || this.isSequenzMode) ? 0.8
                           : 1.0;
      this.competitionTarget = Math.round(baseTarget * categoryScale);
    }

    const dur = this._getDuration();
    this.timer = dur || 0;

    if (playType === 'endless') {
      this.endlessLives = CONFIG.ENDLESS_MAX_MISSES;
    }

    this.rng = this.isDaily ? mulberry32(todaySeed()) : mulberry32(Date.now() & 0xFFFFFFFF);
    this.spawnInterval = this._spawnStart;
    this._isFirstSpawn = true;
    this._assignCorners();
    /* Corner shuffle: set first threshold for shape modes */
    if (!this.isBrainMode && !this.isMemoMode && !this.isSequenzMode && !this.isReflexMode) {
      this._nextShuffleAt = CONFIG.CORNER_SHUFFLE_FIRST;
      this._shuffleCount = 0;
    }

    /* Sequenz mode: lives-based, no timed spawning — purely round-based */
    if (this.isSequenzMode) {
      this.playType = 'endless';
      this.endlessLives = CONFIG.ENDLESS_MAX_MISSES;
      this._startElapsedTimer();
      setTimeout(() => this._startSequenzRound(), 1000);
      return this.cornerMap;
    }

    /* Memo (hidden corners): show corners briefly, then cover and start */
    if (this.isMemoMode) {
      this._memoRevealCount = 0;
      this._memoCorrectSinceReveal = 0;
      const previewMs = CONFIG.MEMO_PREVIEW_MS;
      if (this.onMemoPreview) this.onMemoPreview(this.cornerMap, previewMs);
      this._memoPreviewTimeout = setTimeout(() => {
        if (!this.running) return;
        if (this.onMemoCover) this.onMemoCover();
        if (!this.practice && dur > 0) this._startTimer();
        this._startElapsedTimer();
        this._scheduleSpawn(600);
      }, previewMs);
      return this.cornerMap;
    }

    if (!this.practice && dur > 0) this._startTimer();
    this._startElapsedTimer();
    this._scheduleSpawn(600);
    return this.cornerMap;
  }

  _assignCorners() {
    const dirs = this.directions;

    if (this.mode === 'mathe') {
      this.cornerMap = {};
      dirs.forEach((d, i) => {
        this.cornerMap[d] = {
          display: '?', value: 0, type: 'math',
          color: CONFIG.COLORS.normal[i],
          colorblind: CONFIG.COLORS.colorblind[i],
          colorIndex: i
        };
      });
      return;
    }

    if (this.mode === 'algebra') {
      this.cornerMap = {};
      dirs.forEach((d, i) => {
        this.cornerMap[d] = {
          display: '?', value: 0, type: 'algebra',
          color: CONFIG.COLORS.normal[i],
          colorblind: CONFIG.COLORS.colorblind[i],
          colorIndex: i
        };
      });
      return;
    }

    if (this.mode === 'hauptstaedte') {
      this.cornerMap = {};
      dirs.forEach((d, i) => {
        this.cornerMap[d] = {
          display: '?', value: '', type: 'capitals',
          color: CONFIG.COLORS.normal[i],
          colorblind: CONFIG.COLORS.colorblind[i],
          colorIndex: i
        };
      });
      return;
    }

    if (this.mode === 'worte') {
      const lang = this._lang || 'de';
      const cats = CONFIG.WORD_CATEGORIES[lang];
      const labels = CONFIG.WORD_CAT_LABELS[lang];
      const emojis = CONFIG.WORD_CAT_EMOJIS;
      this.cornerMap = {};
      dirs.forEach((d, i) => {
        const cat = cats[i];
        this.cornerMap[d] = {
          display: `${emojis[cat] || ''} ${labels[cat] || cat}`,
          value: cat, type: 'word',
          color: CONFIG.COLORS.normal[i],
          colorblind: CONFIG.COLORS.colorblind[i],
          colorIndex: i
        };
      });
      return;
    }

    /* ── STROOP: corners show color swatches ── */
    if (this.mode === 'stroop') {
      const lang = this._lang || 'de';
      const pool = dirs.length <= 4 ? CONFIG.STROOP_COLORS_4 : CONFIG.STROOP_COLORS_8;
      const colors = pool.slice(0, dirs.length);
      this.cornerMap = {};
      dirs.forEach((d, i) => {
        const c = colors[i];
        this.cornerMap[d] = {
          display: c[`name_${lang}`] || c.name_en,
          value: c.hex, type: 'stroop',
          color: c.hex, colorblind: c.hex, colorIndex: i
        };
      });
      return;
    }

    /* ── FOKUS: corners show arrow directions ── */
    if (this.mode === 'fokus') {
      const arrows = dirs.length <= 4 ? CONFIG.FOKUS_ARROWS : CONFIG.FOKUS_ARROWS_8;
      this.cornerMap = {};
      dirs.forEach((d, i) => {
        this.cornerMap[d] = {
          display: arrows[i], value: arrows[i], type: 'fokus',
          color: CONFIG.COLORS.normal[i],
          colorblind: CONFIG.COLORS.colorblind[i], colorIndex: i
        };
      });
      return;
    }

    /* ── CHAOS: corners show shape+color combinations ── */
    if (this.mode === 'chaos') {
      const chaosColors = CONFIG.CHAOS_COLORS;
      const chaosShapes = CONFIG.CHAOS_SHAPES;
      const chaosSizes  = CONFIG.CHAOS_SIZES;
      this.cornerMap = {};
      this._chaosRuleSwitchIn = CONFIG.CHAOS_RULE_SWITCH_MIN + Math.floor(this.rng() * (CONFIG.CHAOS_RULE_SWITCH_MAX - CONFIG.CHAOS_RULE_SWITCH_MIN));
      this._chaosCorrectSinceSwitch = 0;
      this._chaosRule = CONFIG.CHAOS_DIMENSIONS[Math.floor(this.rng() * CONFIG.CHAOS_DIMENSIONS.length)];
      dirs.forEach((d, i) => {
        this.cornerMap[d] = {
          shape: chaosShapes[i % chaosShapes.length],
          color: chaosColors[i % chaosColors.length],
          colorblind: chaosColors[i % chaosColors.length],
          size: chaosSizes[i % chaosSizes.length],
          type: 'chaos', colorIndex: i
        };
      });
      return;
    }

    let shapes;
    if (this.mode === 'klassik') {
      shapes = dirs.map(() => 'square');
    } else {
      shapes = shuffle(this.shapes.slice(0, dirs.length), this.rng);
    }
    this.cornerMap = {};
    dirs.forEach((d, i) => {
      this.cornerMap[d] = {
        shape: shapes[i],
        color: CONFIG.COLORS.normal[i],
        colorblind: CONFIG.COLORS.colorblind[i],
        colorIndex: i
      };
    });
  }

  _startTimer() {
    /* Drift-corrected countdown using wall clock instead of setInterval.
       Tracks total paused time so pause/resume doesn't cause drift. */
    this._timerWallStart = Date.now();
    this._timerTarget = this.timer;
    this._timerPausedAccum = 0;
    this._timerPauseStart = null;
    const tick = () => {
      if (!this.running) return;
      const wallElapsed = (Date.now() - this._timerWallStart - this._timerPausedAccum) / 1000;
      this.timer = Math.max(0, Math.ceil(this._timerTarget - wallElapsed));
      if (this.onTick) this.onTick(this.timer);
      if (this.timer <= 0) { this._endGame(); return; }
      /* Schedule next tick at the next whole-second boundary */
      const nextSecond = this._timerTarget - this.timer + 1;
      const nextTickIn = nextSecond * 1000 - (Date.now() - this._timerWallStart - this._timerPausedAccum);
      this._timerInterval = setTimeout(tick, Math.max(50, nextTickIn));
    };
    this._timerInterval = setTimeout(tick, 1000);
  }

  _startElapsedTimer() {
    this._elapsedInterval = setInterval(() => {
      if (this.paused) return;
      this.elapsed++;
      if (this.onTick) this.onTick(this.elapsed);
    }, 1000);
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    /* Record pause start for drift-corrected timer */
    this._timerPauseStart = Date.now();
    clearTimeout(this._timerInterval);
    clearTimeout(this._spawnTimeout);
    clearTimeout(this._shuffleTimeout);
    clearTimeout(this._memoPreviewTimeout);
    this._rushQueue.forEach(t => clearTimeout(t));
    this._rushQueue = [];
    this.inRush = false;
    /* Sequenz: clear queued flashes + input timeout */
    this._seqFlashTimeouts.forEach(t => clearTimeout(t));
    this._seqFlashTimeouts = [];
    clearTimeout(this._seqInputTimeout);
    this._seqInputTimeout = null;
    /* Fever: save remaining duration so it can resume later */
    if (this._feverTimeout && this.feverActive) {
      const feverElapsed = performance.now() - (this._feverStartedAt || 0);
      this._feverRemainingMs = Math.max(0, CONFIG.FEVER_DURATION - feverElapsed);
      clearTimeout(this._feverTimeout);
      this._feverTimeout = null;
    }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    /* Accumulate paused duration for drift-corrected timer */
    if (this._timerPauseStart) {
      this._timerPausedAccum = (this._timerPausedAccum || 0) + (Date.now() - this._timerPauseStart);
      this._timerPauseStart = null;
    }
    /* Fever: restart with remaining duration */
    if (this.feverActive && this._feverRemainingMs > 0) {
      this._feverStartedAt = performance.now();
      this._feverTimeout = setTimeout(() => this._endFever(), this._feverRemainingMs);
      this._feverRemainingMs = 0;
    }
    /* Sequenz: restart current round from scratch if interrupted during watch */
    if (this.isSequenzMode) {
      this._seqPhase = 'idle';
      setTimeout(() => this._startSequenzRound(), 600);
      return;
    }
    /* Restart countdown tick if we have an active timer */
    if (this._timerWallStart && this.timer > 0) {
      const wallElapsed = (Date.now() - this._timerWallStart - this._timerPausedAccum) / 1000;
      const nextSecond = this._timerTarget - this.timer + 1;
      const nextTickIn = nextSecond * 1000 - wallElapsed * 1000;
      const tick = () => {
        if (!this.running) return;
        const we = (Date.now() - this._timerWallStart - this._timerPausedAccum) / 1000;
        this.timer = Math.max(0, Math.ceil(this._timerTarget - we));
        if (this.onTick) this.onTick(this.timer);
        if (this.timer <= 0) { this._endGame(); return; }
        const ns = this._timerTarget - this.timer + 1;
        const nti = ns * 1000 - (Date.now() - this._timerWallStart - this._timerPausedAccum);
        this._timerInterval = setTimeout(tick, Math.max(50, nti));
      };
      this._timerInterval = setTimeout(tick, Math.max(50, nextTickIn));
    }
    /* Memo (hidden corners): brief re-reveal on resume, then cover and resume spawning */
    if (this.isMemoMode) {
      const previewMs = Math.max(
        CONFIG.MEMO_PREVIEW_MIN_MS,
        CONFIG.MEMO_PREVIEW_MS - this._memoRevealCount * CONFIG.MEMO_PREVIEW_SHRINK
      );
      if (this.onMemoReveal) this.onMemoReveal(this.cornerMap, previewMs);
      this._memoPreviewTimeout = setTimeout(() => {
        if (!this.running || this.paused) return;
        if (this.onMemoCover) this.onMemoCover();
        this.currentShape = null;
        this._scheduleSpawn(400);
      }, previewMs);
      return;
    }
    this.currentShape = null;
    this._scheduleSpawn(400);
  }

  continueGame() {
    if (this.continued) return false;
    this.continued = true;
    this.currentShape = null;           // clear stale shape to prevent phantom autoMiss
    this.timer = CONFIG.CONTINUE_EXTRA_TIME;
    this.running = true;
    this.spawnInterval = this._spawnStart;
    this._startTimer();
    this._scheduleSpawn(600);
    return true;
  }

  _scheduleSpawn(delay) {
    if (!this.running || this.paused) return;
    clearTimeout(this._spawnTimeout);
    let d = delay != null ? delay : (this.practice ? CONFIG.PRACTICE_INTERVAL : this.spawnInterval);
    if (this._isFirstSpawn && delay == null) {
      this._isFirstSpawn = false;
      d += (this.isBrainMode || this.isMemoMode) ? 800 : 500;
    }
    this._spawnTimeout = setTimeout(() => this._spawn(), d);
  }

  _spawn() {
    if (!this.running || this.paused) return;
    /* Grace period: don't auto-miss if the player hasn't had enough time to answer */
    if (this.currentShape && !this.practice && !this.inRush) {
      const elapsed = performance.now() - this.lastSpawnTime;
      if (elapsed < (CONFIG.MIN_ANSWER_WINDOW || 1200)) {
        /* Delay this spawn instead of penalizing the player */
        const remaining = (CONFIG.MIN_ANSWER_WINDOW || 1200) - elapsed;
        this._scheduleSpawn(remaining + 50);
        return;
      }
      this.autoMiss();
    }

    if (this.mode === 'mathe')  { this._spawnMath();  return; }
    if (this.mode === 'algebra') { this._spawnAlgebra(); return; }
    if (this.mode === 'hauptstaedte') { this._spawnHauptstaedte(); return; }
    if (this.mode === 'worte')  { this._spawnWord();  return; }
    if (this.mode === 'stroop') { this._spawnStroop(); return; }
    if (this.mode === 'fokus')  { this._spawnFokus();  return; }
    if (this.mode === 'chaos')  { this._spawnChaos();  return; }

    const dirs = this.directions;
    const idx = Math.floor(this.rng() * dirs.length);
    const dir = dirs[idx];
    const info = this.cornerMap[dir];

    let bonus = null;
    if (!this.practice) {
      const roll = this.rng();
      if (roll < CONFIG.DIAMOND_CHANCE) bonus = 'diamond';
      else if (roll < CONFIG.DIAMOND_CHANCE + CONFIG.GOLDEN_CHANCE) bonus = 'golden';
    }

    this.currentShape = { direction: dir, shape: info.shape, color: info.color,
                          colorblind: info.colorblind, bonus };
    this.bonusType = bonus;
    this.lastSpawnTime = performance.now();

    if (this.onSpawn) this.onSpawn(this.currentShape);
    this._scheduleSpawn();
  }

  _getMathPhase() {
    const phases = CONFIG.MATH_PHASES;
    let phase = phases[0];
    for (const p of phases) { if (this.correct >= p.threshold) phase = p; }
    /* Time-based fallback: advance at least 1 phase per 20 elapsed seconds */
    const timeIdx = Math.min(phases.length - 1, Math.floor(this.elapsed / 20));
    if (phases.indexOf(phases[timeIdx]) > phases.indexOf(phase)) phase = phases[timeIdx];
    return phase;
  }

  _generateEquation(phase) {
    const op = phase.ops[Math.floor(this.rng() * phase.ops.length)];
    let a, b, answer;
    switch (op) {
      case '+':
        a = Math.floor(this.rng() * phase.max) + phase.min;
        b = Math.floor(this.rng() * phase.max) + phase.min;
        answer = a + b;
        return { equation: `${a} + ${b}`, answer };
      case '\u2212':
        a = Math.floor(this.rng() * phase.max) + phase.min + 1;
        b = Math.floor(this.rng() * a) + 1;
        answer = a - b;
        return { equation: `${a} \u2212 ${b}`, answer };
      case '\u00D7': {
        const mMax = phase.multMax || phase.max;
        a = Math.floor(this.rng() * (mMax - 1)) + 2;
        b = Math.floor(this.rng() * (mMax - 1)) + 2;
        answer = a * b;
        return { equation: `${a} \u00D7 ${b}`, answer };
      }
      case '\u00F7': {
        const dMax = phase.divMax || phase.max;
        b = Math.floor(this.rng() * (dMax - 1)) + 2;
        answer = Math.floor(this.rng() * (dMax - 1)) + 2;
        a = b * answer;
        return { equation: `${a} \u00F7 ${b}`, answer };
      }
      default:
        a = Math.floor(this.rng() * 10) + 1;
        b = Math.floor(this.rng() * 10) + 1;
        answer = a + b;
        return { equation: `${a} + ${b}`, answer };
    }
  }

  _generateDistractors(correct, count) {
    const set = new Set();
    const tryAdd = v => { if (v > 0 && v !== correct && !set.has(v)) set.add(v); };

    // Phase 1: Plausible distractors — digit swap, +/-1, +/-2, common math errors
    if (correct > 10) {
      const str = String(correct);
      if (str.length === 2 && str[0] !== str[1]) {
        tryAdd(parseInt(str[1] + str[0], 10));
      }
    }
    tryAdd(correct + 1);
    tryAdd(correct - 1);
    tryAdd(correct + 2);
    tryAdd(correct - 2);
    if (correct > 10) { tryAdd(correct + 10); tryAdd(correct - 10); }
    tryAdd(correct + 5);
    tryAdd(correct - 5);

    // Phase 2: Evenly-spaced offsets to fill remaining slots
    if (set.size < count) {
      const range = Math.max(10, Math.ceil(correct * 0.3));
      for (let i = 1; set.size < count && i <= range; i++) {
        tryAdd(correct + i * 3);
        if (set.size < count) tryAdd(correct - i * 3);
      }
    }

    // Phase 3: Sequential fallback — guaranteed to fill
    for (let i = 1; set.size < count; i++) {
      tryAdd(correct + i);
      if (set.size < count) tryAdd(Math.max(1, correct - i));
    }

    // Shuffle and return exactly count distractors
    const arr = [...set].slice(0, count);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  _spawnMath() {
    const dirs = this.directions;
    const phase = this._getMathPhase();
    const { equation, answer } = this._generateEquation(phase);
    const correctIdx = Math.floor(this.rng() * dirs.length);
    const correctDir = dirs[correctIdx];
    const distractors = this._generateDistractors(answer, dirs.length - 1);

    let dIdx = 0;
    dirs.forEach((d, i) => {
      if (i === correctIdx) {
        this.cornerMap[d].display = String(answer);
        this.cornerMap[d].value = answer;
      } else {
        this.cornerMap[d].display = String(distractors[dIdx]);
        this.cornerMap[d].value = distractors[dIdx];
        dIdx++;
      }
    });

    let bonus = null;
    if (!this.practice) {
      const roll = this.rng();
      if (roll < CONFIG.DIAMOND_CHANCE) bonus = 'diamond';
      else if (roll < CONFIG.DIAMOND_CHANCE + CONFIG.GOLDEN_CHANCE) bonus = 'golden';
    }

    this.currentShape = {
      direction: correctDir, display: equation, type: 'math',
      color: this.cornerMap[correctDir].color,
      colorblind: this.cornerMap[correctDir].colorblind,
      bonus
    };
    this.bonusType = bonus;
    this.lastSpawnTime = performance.now();

    if (this.onCornersUpdate) this.onCornersUpdate(this.cornerMap);
    if (this.onSpawn) this.onSpawn(this.currentShape);
    this._scheduleSpawn();
  }

  /* ═══ HAUPTSTÄDTE (Capitals) spawn ═══ */
  _getCapitalsTier() {
    const tiers = CONFIG.CAPITALS_TIERS;
    let tier = tiers[0];
    for (const t of tiers) { if (this.correct >= t.threshold) tier = t; }
    const timeIdx = Math.min(tiers.length - 1, Math.floor(this.elapsed / 20));
    if (tiers.indexOf(tiers[timeIdx]) > tiers.indexOf(tier)) tier = tiers[timeIdx];
    return tiers.indexOf(tier);
  }

  _spawnHauptstaedte() {
    const dirs = this.directions;
    const lang = this._lang || 'de';
    const bank = CONFIG.CAPITALS_BANK;
    const tierIdx = this._getCapitalsTier();

    /* Filter pool: allow entries up to current tier */
    const pool = bank.filter(e => e.tier <= tierIdx);
    /* Pick a random entry */
    const entry = pool[Math.floor(this.rng() * pool.length)];
    const countryName = lang === 'en' ? entry.country_en : entry.country_de;
    const correctCapital = lang === 'en' && entry.capital_en ? entry.capital_en : entry.capital;

    /* Generate 3 distractor capitals from same region first, then fill from global pool */
    const sameRegion = bank.filter(e => e.region === entry.region && e !== entry);
    const otherPool = bank.filter(e => e.region !== entry.region);
    const distractorEntries = [];
    const usedCapitals = new Set([correctCapital]);

    /* Prefer same-region distractors (plausible wrong answers) */
    const shuffledRegion = shuffle(sameRegion, this.rng);
    for (const d of shuffledRegion) {
      if (distractorEntries.length >= 3) break;
      const cap = lang === 'en' && d.capital_en ? d.capital_en : d.capital;
      if (!usedCapitals.has(cap)) {
        distractorEntries.push(cap);
        usedCapitals.add(cap);
      }
    }
    /* Fill remaining with global pool */
    const shuffledGlobal = shuffle(otherPool, this.rng);
    for (const d of shuffledGlobal) {
      if (distractorEntries.length >= 3) break;
      const cap = lang === 'en' && d.capital_en ? d.capital_en : d.capital;
      if (!usedCapitals.has(cap)) {
        distractorEntries.push(cap);
        usedCapitals.add(cap);
      }
    }

    /* Place correct + distractors into corners */
    const correctIdx = Math.floor(this.rng() * dirs.length);
    const correctDir = dirs[correctIdx];
    let dIdx = 0;
    dirs.forEach((d, i) => {
      if (i === correctIdx) {
        this.cornerMap[d].display = correctCapital;
        this.cornerMap[d].value = correctCapital;
      } else {
        this.cornerMap[d].display = distractorEntries[dIdx] || '???';
        this.cornerMap[d].value = distractorEntries[dIdx] || '';
        dIdx++;
      }
    });

    let bonus = null;
    if (!this.practice) {
      const roll = this.rng();
      if (roll < CONFIG.DIAMOND_CHANCE) bonus = 'diamond';
      else if (roll < CONFIG.DIAMOND_CHANCE + CONFIG.GOLDEN_CHANCE) bonus = 'golden';
    }

    this.currentShape = {
      direction: correctDir, display: countryName, type: 'capitals',
      color: this.cornerMap[correctDir].color,
      colorblind: this.cornerMap[correctDir].colorblind,
      bonus
    };
    this.bonusType = bonus;
    this.lastSpawnTime = performance.now();

    if (this.onCornersUpdate) this.onCornersUpdate(this.cornerMap);
    if (this.onSpawn) this.onSpawn(this.currentShape);
    this._scheduleSpawn();
  }

  /* ═══ ALGEBRA spawn ═══ */
  _getAlgebraPhase() {
    const phases = CONFIG.ALGEBRA_PHASES;
    let phase = phases[0];
    for (const p of phases) { if (this.correct >= p.threshold) phase = p; }
    const timeIdx = Math.min(phases.length - 1, Math.floor(this.elapsed / 20));
    if (phases.indexOf(phases[timeIdx]) > phases.indexOf(phase)) phase = phases[timeIdx];
    return phase;
  }

  _generateAlgebraEquation(phase) {
    switch (phase.type) {
      case 'linear_add': {
        /* ax + b = c → solve for x */
        const a = Math.floor(this.rng() * 8) + 2;    /* 2-9 */
        const x = Math.floor(this.rng() * 10) + 1;    /* 1-10 */
        const b = Math.floor(this.rng() * 15) + 1;    /* 1-15 */
        const c = a * x + b;
        return { equation: `${a}x + ${b} = ${c}`, answer: x, answerDisplay: String(x) };
      }
      case 'linear_sub': {
        /* ax - b = c → solve for x */
        const a = Math.floor(this.rng() * 8) + 2;
        const x = Math.floor(this.rng() * 10) + 2;    /* 2-11: ensure ax > b */
        const b = Math.floor(this.rng() * (a * x - 1)) + 1;
        const c = a * x - b;
        return { equation: `${a}x \u2212 ${b} = ${c}`, answer: x, answerDisplay: String(x) };
      }
      case 'two_step': {
        /* a(x + b) = c → solve for x */
        const a = Math.floor(this.rng() * 6) + 2;     /* 2-7 */
        const x = Math.floor(this.rng() * 10) + 1;    /* 1-10 */
        const b = Math.floor(this.rng() * 10) + 1;    /* 1-10 */
        const c = a * (x + b);
        return { equation: `${a}(x + ${b}) = ${c}`, answer: x, answerDisplay: String(x) };
      }
      case 'square': {
        /* x² = n → x = ? (use only perfect squares) */
        const squares = CONFIG.ALGEBRA_PERFECT_SQUARES;
        const n = squares[Math.floor(this.rng() * squares.length)];
        const x = Math.round(Math.sqrt(n));
        return { equation: `x\u00B2 = ${n}`, answer: x, answerDisplay: String(x) };
      }
      case 'sqrt': {
        /* √n = ? */
        const squares = CONFIG.ALGEBRA_PERFECT_SQUARES;
        const n = squares[Math.floor(this.rng() * squares.length)];
        const answer = Math.round(Math.sqrt(n));
        return { equation: `\u221A${n}`, answer, answerDisplay: String(answer) };
      }
      case 'power': {
        /* aⁿ = ? */
        const powers = CONFIG.ALGEBRA_POWERS;
        const p = powers[Math.floor(this.rng() * powers.length)];
        const exp = p.exps[Math.floor(this.rng() * p.exps.length)];
        const answer = Math.pow(p.base, exp);
        const superscript = String(exp).split('').map(d => '\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079'[+d]).join('');
        return { equation: `${p.base}${superscript}`, answer, answerDisplay: String(answer) };
      }
      case 'fraction_add': {
        /* a/b + c/d = rn/rd (pre-computed fractions for clean results) */
        const fracs = CONFIG.ALGEBRA_FRACTIONS;
        const f = fracs[Math.floor(this.rng() * fracs.length)];
        const equation = `${f.a}/${f.b} + ${f.c}/${f.d}`;
        /* Use numeric answer for distractor generation; display fraction result */
        const answer = f.rd === 1 ? f.rn : f.rn / f.rd;
        const answerDisplay = f.rd === 1 ? String(f.rn) : `${f.rn}/${f.rd}`;
        return { equation, answer, answerDisplay, isFraction: f.rd !== 1, rn: f.rn, rd: f.rd };
      }
      default:
        return this._generateAlgebraEquation(CONFIG.ALGEBRA_PHASES[0]);
    }
  }

  _generateAlgebraDistractors(correct, count, isFraction, rn, rd) {
    if (isFraction) {
      /* For fraction answers, generate plausible fraction distractors */
      const set = new Set();
      const tryAdd = (n, d) => {
        const key = `${n}/${d}`;
        const val = n / d;
        if (val > 0 && Math.abs(val - correct) > 0.001 && !set.has(key)) set.add(key);
      };
      /* Common fraction mistakes */
      tryAdd(rn + 1, rd);
      tryAdd(Math.max(1, rn - 1), rd);
      tryAdd(rn, rd + 1);
      tryAdd(rn, Math.max(1, rd - 1));
      tryAdd(rd, rn); /* swapped */
      tryAdd(rn + rd, rd);
      tryAdd(rn, rn + rd);
      /* Fill remaining */
      for (let i = 1; set.size < count; i++) {
        tryAdd(rn + i, rd);
        if (set.size < count) tryAdd(Math.max(1, rn - i), rd);
        if (set.size < count) tryAdd(rn + i, rd + 1);
      }
      const arr = [...set].slice(0, count);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr; /* returns string fractions like "3/4" */
    }
    /* Integer answers: reuse math distractor generator */
    return this._generateDistractors(correct, count);
  }

  _spawnAlgebra() {
    const dirs = this.directions;
    const phase = this._getAlgebraPhase();
    const { equation, answer, answerDisplay, isFraction, rn, rd } = this._generateAlgebraEquation(phase);
    const correctIdx = Math.floor(this.rng() * dirs.length);
    const correctDir = dirs[correctIdx];

    const distractors = this._generateAlgebraDistractors(answer, dirs.length - 1, isFraction, rn, rd);

    let dIdx = 0;
    dirs.forEach((d, i) => {
      if (i === correctIdx) {
        this.cornerMap[d].display = answerDisplay;
        this.cornerMap[d].value = answer;
      } else {
        const dist = distractors[dIdx];
        this.cornerMap[d].display = String(dist);
        this.cornerMap[d].value = isFraction ? parseFloat(dist) || 0 : dist;
        dIdx++;
      }
    });

    let bonus = null;
    if (!this.practice) {
      const roll = this.rng();
      if (roll < CONFIG.DIAMOND_CHANCE) bonus = 'diamond';
      else if (roll < CONFIG.DIAMOND_CHANCE + CONFIG.GOLDEN_CHANCE) bonus = 'golden';
    }

    this.currentShape = {
      direction: correctDir, display: equation, type: 'math',
      color: this.cornerMap[correctDir].color,
      colorblind: this.cornerMap[correctDir].colorblind,
      bonus
    };
    this.bonusType = bonus;
    this.lastSpawnTime = performance.now();

    if (this.onCornersUpdate) this.onCornersUpdate(this.cornerMap);
    if (this.onSpawn) this.onSpawn(this.currentShape);
    this._scheduleSpawn();
  }

  _spawnWord() {
    const dirs = this.directions;
    const lang = this._lang || 'de';
    const cats = CONFIG.WORD_CATEGORIES[lang];
    const banks = CONFIG.WORD_BANKS[lang];
    const emojiBanks = CONFIG.WORD_EMOJI_BANKS;

    const catIdx = Math.floor(this.rng() * cats.length);
    const correctCat = cats[catIdx];
    /* Shuffle category→corner mapping periodically to prevent memorization,
       but NOT every single spawn (too demanding) */
    const shuffleEvery = CONFIG.WORD_SHUFFLE_INTERVAL || 5;
    if (!this._wordShuffledDirs || this._wordShuffleCounter >= shuffleEvery) {
      this._wordShuffledDirs = shuffle([...dirs], this.rng);
      this._wordShuffleCounter = 0;
    }
    this._wordShuffleCounter++;
    const shuffledDirs = this._wordShuffledDirs;
    const correctDir = shuffledDirs[catIdx];
    /* Re-assign corner labels to match shuffled dirs */
    const labels = CONFIG.WORD_CAT_LABELS[lang];
    const emojis = CONFIG.WORD_CAT_EMOJIS;
    shuffledDirs.forEach((d, i) => {
      const cat = cats[i];
      this.cornerMap[d].display = `${emojis[cat] || ''} ${labels[cat] || cat}`;
      this.cornerMap[d].value = cat;
    });
    if (this.onCornersUpdate) this.onCornersUpdate(this.cornerMap);

    let displayStr = '';

    /* Progressive difficulty phases for visual interference:
       Phase 0 (< 20 correct): plain words only
       Phase 1 (20+ correct):  emoji spawns mixed in
       Phase 2 (30+ correct):  Stroop-style text coloring added */
    const wordPhase = this.correct >= 30 ? 2 : this.correct >= 20 ? 1 : 0;

    if (wordPhase >= 1 && this.rng() < 0.25 && emojiBanks && emojiBanks[correctCat]) {
      const eBank = emojiBanks[correctCat];
      displayStr = eBank[Math.floor(this.rng() * eBank.length)];
    } else {
      const words = banks[correctCat];
      displayStr = words[Math.floor(this.rng() * words.length)];
    }

    let bonus = null;
    if (!this.practice) {
      const roll = this.rng();
      if (roll < CONFIG.DIAMOND_CHANCE) bonus = 'diamond';
      else if (roll < CONFIG.DIAMOND_CHANCE + CONFIG.GOLDEN_CHANCE) bonus = 'golden';
    }

    /* Stroop-style text coloring — only in phase 2+ (30+ correct) and at 40% rate */
    let textColor = null;
    if (wordPhase >= 2 && this.rng() < 0.4) {
      const randomDir = dirs[Math.floor(this.rng() * dirs.length)];
      textColor = this.cornerMap[randomDir].color;
    }

    this.currentShape = {
      direction: correctDir, display: displayStr, type: 'word',
      category: correctCat,
      color: this.cornerMap[correctDir].color,
      colorblind: this.cornerMap[correctDir].colorblind,
      textColor: textColor,
      bonus
    };
    this.bonusType = bonus;
    this.lastSpawnTime = performance.now();

    if (this.onSpawn) this.onSpawn(this.currentShape);
    this._scheduleSpawn();
  }

  /* ═══ STROOP spawn ═══ */
  _spawnStroop() {
    const dirs = this.directions;
    const lang = this._lang || 'de';
    const pool = dirs.length <= 4 ? CONFIG.STROOP_COLORS_4 : CONFIG.STROOP_COLORS_8;
    const colors = pool.slice(0, dirs.length);

    /* Pick a random INK color — this is what the player must match */
    const inkIdx = Math.floor(this.rng() * colors.length);
    const inkColor = colors[inkIdx];
    const correctDir = dirs[inkIdx]; /* corner showing this color swatch */

    /* Pick a WORD — different color name for incongruent, same for congruent */
    let wordIdx;
    if (this.rng() < (CONFIG.STROOP_CONGRUENT_RATE || 0.2)) {
      wordIdx = inkIdx; /* congruent: word matches ink */
    } else {
      do { wordIdx = Math.floor(this.rng() * colors.length); } while (wordIdx === inkIdx);
    }
    const wordColor = colors[wordIdx];
    const displayWord = wordColor[`name_${lang}`] || wordColor.name_en;

    let bonus = null;
    if (!this.practice) {
      const roll = this.rng();
      if (roll < CONFIG.DIAMOND_CHANCE) bonus = 'diamond';
      else if (roll < CONFIG.DIAMOND_CHANCE + CONFIG.GOLDEN_CHANCE) bonus = 'golden';
    }

    this.currentShape = {
      direction: correctDir,
      display: displayWord,        /* The text word (e.g., "ROT") */
      inkColor: inkColor.hex,       /* The actual ink color the word is drawn in */
      type: 'stroop',
      color: inkColor.hex,
      colorblind: inkColor.hex,
      bonus
    };
    this.bonusType = bonus;
    this.lastSpawnTime = performance.now();
    if (this.onSpawn) this.onSpawn(this.currentShape);
    this._scheduleSpawn();
  }

  /* ═══ FOKUS (Flanker) spawn ═══ */
  _spawnFokus() {
    const dirs = this.directions;
    const arrows = dirs.length <= 4 ? CONFIG.FOKUS_ARROWS : CONFIG.FOKUS_ARROWS_8;

    /* Pick the CENTER arrow direction */
    const centerIdx = Math.floor(this.rng() * arrows.length);
    const centerArrow = arrows[centerIdx];
    const correctDir = dirs[centerIdx];

    /* Pick flanker arrows */
    const flankerCount = CONFIG.FOKUS_FLANKER_COUNT || 4;
    const isCongruent = this.rng() < (CONFIG.FOKUS_CONGRUENT_RATE || 0.3);
    let flankerArrow;
    if (isCongruent) {
      flankerArrow = centerArrow;
    } else {
      do {
        flankerArrow = arrows[Math.floor(this.rng() * arrows.length)];
      } while (flankerArrow === centerArrow);
    }
    const flankers = Array(flankerCount).fill(flankerArrow);

    let bonus = null;
    if (!this.practice) {
      const roll = this.rng();
      if (roll < CONFIG.DIAMOND_CHANCE) bonus = 'diamond';
      else if (roll < CONFIG.DIAMOND_CHANCE + CONFIG.GOLDEN_CHANCE) bonus = 'golden';
    }

    this.currentShape = {
      direction: correctDir,
      display: centerArrow,
      flankers: flankers,
      isCongruent: isCongruent,
      type: 'fokus',
      color: CONFIG.COLORS.normal[centerIdx],
      colorblind: CONFIG.COLORS.colorblind[centerIdx],
      bonus
    };
    this.bonusType = bonus;
    this.lastSpawnTime = performance.now();
    if (this.onSpawn) this.onSpawn(this.currentShape);
    this._scheduleSpawn();
  }

  /* ═══ CHAOS (Rule Switch) spawn ═══ */
  _spawnChaos() {
    const dirs = this.directions;
    const rule = this._chaosRule;

    /* ── CHAOS-MATH: show equation, corners show numbers ── */
    if (rule === 'math') {
      const phase = { ops: ['+', '\u2212'], min: 1, max: 15 };
      const { equation, answer } = this._generateEquation(phase);
      const correctIdx = Math.floor(this.rng() * dirs.length);
      const correctDir = dirs[correctIdx];
      const distractors = this._generateDistractors(answer, dirs.length - 1);
      let dIdx = 0;
      dirs.forEach((d, i) => {
        if (i === correctIdx) {
          this.cornerMap[d] = { display: String(answer), value: answer, type: 'math',
            color: CONFIG.COLORS.normal[i], colorblind: CONFIG.COLORS.colorblind[i], colorIndex: i };
        } else {
          this.cornerMap[d] = { display: String(distractors[dIdx]), value: distractors[dIdx], type: 'math',
            color: CONFIG.COLORS.normal[i], colorblind: CONFIG.COLORS.colorblind[i], colorIndex: i };
          dIdx++;
        }
      });
      let bonus = null;
      if (!this.practice) {
        const roll = this.rng();
        if (roll < CONFIG.DIAMOND_CHANCE) bonus = 'diamond';
        else if (roll < CONFIG.DIAMOND_CHANCE + CONFIG.GOLDEN_CHANCE) bonus = 'golden';
      }
      this.currentShape = {
        direction: correctDir, display: equation, type: 'math', chaosRule: rule,
        color: this.cornerMap[correctDir].color,
        colorblind: this.cornerMap[correctDir].colorblind, bonus
      };
      this.bonusType = bonus;
      this.lastSpawnTime = performance.now();
      if (this.onCornersUpdate) this.onCornersUpdate(this.cornerMap);
      if (this.onSpawn) this.onSpawn(this.currentShape);
      this._scheduleSpawn();
      return;
    }

    /* ── CHAOS-STROOP: show color word in conflicting ink ── */
    if (rule === 'stroop') {
      const lang = this._lang || 'de';
      const pool = CONFIG.STROOP_COLORS_4;
      const colors = pool.slice(0, dirs.length);
      dirs.forEach((d, i) => {
        const c = colors[i];
        this.cornerMap[d] = {
          display: c[`name_${lang}`] || c.name_en,
          value: c.hex, type: 'stroop',
          color: c.hex, colorblind: c.hex, colorIndex: i
        };
      });
      const inkIdx = Math.floor(this.rng() * colors.length);
      const inkColor = colors[inkIdx];
      const correctDir = dirs[inkIdx];
      let wordIdx;
      if (this.rng() < 0.25) { wordIdx = inkIdx; }
      else { do { wordIdx = Math.floor(this.rng() * colors.length); } while (wordIdx === inkIdx); }
      const wordColor = colors[wordIdx];
      const displayWord = wordColor[`name_${lang}`] || wordColor.name_en;
      let bonus = null;
      if (!this.practice) {
        const roll = this.rng();
        if (roll < CONFIG.DIAMOND_CHANCE) bonus = 'diamond';
        else if (roll < CONFIG.DIAMOND_CHANCE + CONFIG.GOLDEN_CHANCE) bonus = 'golden';
      }
      this.currentShape = {
        direction: correctDir, display: displayWord,
        inkColor: inkColor.hex, type: 'stroop', chaosRule: rule,
        color: inkColor.hex, colorblind: inkColor.hex, bonus
      };
      this.bonusType = bonus;
      this.lastSpawnTime = performance.now();
      if (this.onCornersUpdate) this.onCornersUpdate(this.cornerMap);
      if (this.onSpawn) this.onSpawn(this.currentShape);
      this._scheduleSpawn();
      return;
    }

    /* ── Standard CHAOS: color / shape / size ── */
    const chaosShapes = CONFIG.CHAOS_SHAPES;
    const chaosColors = CONFIG.CHAOS_COLORS;
    const chaosSizes = CONFIG.CHAOS_SIZES;

    /* Shuffle corner properties each spawn to prevent memorization.
       Each dimension value appears exactly once across corners. */
    const sShapes = shuffle(chaosShapes.slice(0, dirs.length), this.rng);
    const sColors = shuffle(chaosColors.slice(0, dirs.length), this.rng);
    const sSizes  = shuffle(chaosSizes.slice(0, dirs.length), this.rng);
    dirs.forEach((d, i) => {
      this.cornerMap[d] = {
        shape: sShapes[i], color: sColors[i], colorblind: sColors[i],
        size: sSizes[i], type: 'chaos', colorIndex: i
      };
    });

    /* Pick a random correct corner, then build stimulus to match it
       on the active rule dimension; other dimensions are random noise */
    const correctIdx = Math.floor(this.rng() * dirs.length);
    const correctDir = dirs[correctIdx];
    const cc = this.cornerMap[correctDir];
    let stimShape, stimColor, stimSize;
    if (rule === 'color') {
      stimColor = cc.color;
      stimShape = chaosShapes[Math.floor(this.rng() * chaosShapes.length)];
      stimSize  = chaosSizes[Math.floor(this.rng() * chaosSizes.length)];
    } else if (rule === 'shape') {
      stimShape = cc.shape;
      stimColor = chaosColors[Math.floor(this.rng() * chaosColors.length)];
      stimSize  = chaosSizes[Math.floor(this.rng() * chaosSizes.length)];
    } else { /* size */
      stimSize  = cc.size;
      stimShape = chaosShapes[Math.floor(this.rng() * chaosShapes.length)];
      stimColor = chaosColors[Math.floor(this.rng() * chaosColors.length)];
    }

    let bonus = null;
    if (!this.practice) {
      const roll = this.rng();
      if (roll < CONFIG.DIAMOND_CHANCE) bonus = 'diamond';
      else if (roll < CONFIG.DIAMOND_CHANCE + CONFIG.GOLDEN_CHANCE) bonus = 'golden';
    }

    this.currentShape = {
      direction: correctDir,
      display: stimShape,
      stimColor: stimColor,
      stimSize: stimSize,
      chaosRule: rule,
      type: 'chaos',
      color: stimColor,
      colorblind: stimColor,
      bonus
    };
    this.bonusType = bonus;
    this.lastSpawnTime = performance.now();
    if (this.onCornersUpdate) this.onCornersUpdate(this.cornerMap);
    if (this.onSpawn) this.onSpawn(this.currentShape);
    this._scheduleSpawn();
  }

  /* Called from handleSwipe on correct chaos answer */
  _checkChaosRuleSwitch() {
    this._chaosCorrectSinceSwitch++;
    if (this._chaosCorrectSinceSwitch >= this._chaosRuleSwitchIn) {
      this._chaosCorrectSinceSwitch = 0;
      this._chaosRuleSwitchIn = CONFIG.CHAOS_RULE_SWITCH_MIN + Math.floor(this.rng() * (CONFIG.CHAOS_RULE_SWITCH_MAX - CONFIG.CHAOS_RULE_SWITCH_MIN));
      /* After threshold, include extra dimensions (math, stroop) */
      const baseDims = CONFIG.CHAOS_DIMENSIONS;
      const extraDims = CONFIG.CHAOS_EXTRA_DIMENSIONS || [];
      const threshold = CONFIG.CHAOS_EXTRA_THRESHOLD || 15;
      const dims = this.correct >= threshold ? [...baseDims, ...extraDims] : baseDims;
      let newRule;
      do { newRule = dims[Math.floor(this.rng() * dims.length)]; } while (newRule === this._chaosRule && dims.length > 1);
      this._chaosRule = newRule;
      if (this.onChaosRuleSwitch) this.onChaosRuleSwitch(newRule);
    }
  }

  handleSwipe(direction, timestamp) {
    if (!this.running || this.paused || !this.currentShape) return null;
    if (!direction) return null;  /* guard against null from dead-zone or missed hit-test */
    const reaction = timestamp - this.lastSpawnTime;
    if (reaction < CONFIG.ANTI_CHEAT_MIN_REACTION) return null;

    this.total++;
    const isCorrect = direction === this.currentShape.direction;
    const bonus = this.currentShape.bonus;
    let pointsEarned = 0;

    const prevStreak = this.streak;

    if (isCorrect) {
      this.correct++;
      this.streak++;
      this.feverStreak++;
      this._consecutiveMisses = 0;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;

      if (!this.practice) {
        const tbWindow = (this.isBrainMode || this.isMemoMode || this.isReflexMode)
          ? (CONFIG.TIME_BONUS_WINDOW_BRAIN || CONFIG.TIME_BONUS_WINDOW)
          : CONFIG.TIME_BONUS_WINDOW;
        const timeBonus = Math.max(0, Math.round(CONFIG.TIME_BONUS_MAX * (1 - reaction / tbWindow)));
        let base = CONFIG.BASE_SCORE + timeBonus;
        if (bonus === 'diamond')     base *= CONFIG.DIAMOND_MULT;
        else if (bonus === 'golden') base *= CONFIG.GOLDEN_MULT;
        if (this.feverActive) base *= CONFIG.FEVER_MULT;
        base *= this.multiplier;
        pointsEarned = Math.round(base);
        this.score += pointsEarned;

        /* Score milestone check */
        if (this.onScoreMilestone) {
          const milestones = CONFIG.SCORE_MILESTONES || [];
          for (let mi = 0; mi < milestones.length; mi++) {
            if (mi > this._lastMilestoneIndex && this.score >= milestones[mi]) {
              this._lastMilestoneIndex = mi;
              this.onScoreMilestone(milestones[mi], mi);
              break; /* one milestone per answer to avoid overlapping celebrations */
            }
          }
        }

        const newMult = Math.min(CONFIG.MULTIPLIER_MAX, 1 + Math.floor(this.streak / CONFIG.STREAK_PER_MULTIPLIER));
        if (newMult !== this.multiplier) {
          this.multiplier = newMult;
          if (this.onMultiplierChange) this.onMultiplierChange(this.multiplier);
        }
        if (reaction <= CONFIG.PERFECT_WINDOW_MS && this.onPerfect) this.onPerfect();
        if (this.streak % 10 === 0 && this.onStreak) this.onStreak(this.streak);

        if ((this.streak === 20 || this.streak === 30 || this.streak === 40 || this.streak === 50 || this.streak === 75) && this.onComboMilestone) {
          this.onComboMilestone(this.streak);
        }

        const _feverReq = (this.isBrainMode || this.isReflexMode) ? (CONFIG.FEVER_STREAK_BRAIN || 8) : CONFIG.FEVER_STREAK;
        if (!this.feverActive && this.feverStreak >= _feverReq && performance.now() >= this._feverCooldownUntil) this._startFever();

        /* ── Streak Time Bonus ── */
        if (this.streak > CONFIG.STREAK_TIME_THRESHOLD) {
          if (this.playType === 'endless') {
            // Endless: award life at milestone streaks
            if (this.streak % CONFIG.ENDLESS_LIFE_STREAK === 0) {
              if (this.endlessLives < CONFIG.ENDLESS_MAX_MISSES) {
                this.endlessTotalMisses = Math.max(0, this.endlessTotalMisses - 1);
                this.endlessLives = CONFIG.ENDLESS_MAX_MISSES - this.endlessTotalMisses;
                if (this.onEndlessLifeEarned) this.onEndlessLifeEarned(this.endlessLives);
              }
            }
          } else if (this._timerWallStart && this.timer > 0) {
            // Timed modes: add seconds
            this._timerTarget += CONFIG.STREAK_TIME_BONUS;
            this.timer = Math.max(0, Math.ceil(
              this._timerTarget - (Date.now() - this._timerWallStart - this._timerPausedAccum) / 1000
            ));
            if (this.onTimerBonus) this.onTimerBonus(CONFIG.STREAK_TIME_BONUS);
          }
        }

        /* ── Direct speed-up on correct ── */
        this.spawnInterval = Math.max(this._spawnMin, this.spawnInterval - this._speedStep);

        /* ── Memo: check if it's time for a corner re-reveal ── */
        if (this.isMemoMode) {
          this._memoCorrectSinceReveal++;
          if (this._memoCorrectSinceReveal >= CONFIG.MEMO_REVEAL_EVERY) {
            this._memoCorrectSinceReveal = 0;
            this._memoRevealCount++;
            /* Shuffle corner positions periodically to increase difficulty */
            if (this._memoRevealCount % CONFIG.MEMO_SHUFFLE_AFTER === 0) {
              this._shuffleCorners();
            }
            const previewMs = Math.max(
              CONFIG.MEMO_PREVIEW_MIN_MS,
              CONFIG.MEMO_PREVIEW_MS - this._memoRevealCount * CONFIG.MEMO_PREVIEW_SHRINK
            );
            /* Pause spawning during reveal */
            clearTimeout(this._spawnTimeout);
            if (this.onMemoReveal) this.onMemoReveal(this.cornerMap, previewMs);
            this._memoPreviewTimeout = setTimeout(() => {
              if (!this.running || this.paused) return;
              if (this.onMemoCover) this.onMemoCover();
              this._scheduleSpawn(400);
            }, previewMs);
          }
        }
      }
      this.reactionTimes.push(reaction);
      this._addRecentResult(true, reaction);
      /* Track bonus catches for achievements */
      if (bonus === 'golden')  this._goldenCaught++;
      if (bonus === 'diamond') this._diamondCaught++;
      this._maxMultiplier = Math.max(this._maxMultiplier, this.multiplier);
      if (bonus && this.onBonus) this.onBonus(bonus, pointsEarned);
      /* Chaos: check rule switch on correct */
      if (this.mode === 'chaos') this._checkChaosRuleSwitch();
    } else {
      this.wrong++;
      const brokenStreak = this.streak;
      this.streak = 0;
      this.feverStreak = 0;
      this._consecutiveMisses++;
      if (!this.practice) {
        this.multiplier = Math.max(1, this.multiplier - CONFIG.MISS_PENALTY);
        if (this.onMultiplierChange) this.onMultiplierChange(this.multiplier);

        /* ── Wrong answer time penalty (brain modes: reduced/no penalty) ── */
        const wrongPenalty = (this.isBrainMode || this.isReflexMode)
          ? (CONFIG.WRONG_TIME_PENALTY_BRAIN ?? CONFIG.WRONG_TIME_PENALTY)
          : CONFIG.WRONG_TIME_PENALTY;
        if (wrongPenalty > 0 && this.playType !== 'endless' && this._timerWallStart && this.timer > 0) {
          this._timerTarget -= wrongPenalty;
          this.timer = Math.max(0, Math.ceil(
            this._timerTarget - (Date.now() - this._timerWallStart - this._timerPausedAccum) / 1000
          ));
          if (this.onTimerPenalty) this.onTimerPenalty(wrongPenalty);
          if (this.timer <= 0) { this._endGame(); return null; }
        }

        /* ── Speed recovery on wrong ── */
        this.spawnInterval = Math.min(this._spawnMax, this.spawnInterval + this._speedStep * CONFIG.SPEED_WRONG_RECOVERY_MULT);
      }
      this._addRecentResult(false, reaction);

      if (brokenStreak >= 5 && this.onStreakBreak) {
        this.onStreakBreak(brokenStreak);
      }

      if (this.playType === 'endless') {
        this.endlessTotalMisses++;
        this.endlessLives = CONFIG.ENDLESS_MAX_MISSES - this.endlessTotalMisses;
        if (this.onEndlessMiss) this.onEndlessMiss(this.endlessLives);
        if (this.endlessLives <= 0) {
          this._endGame();
          return null;
        }
      }
    }

    if (!this.practice) this._adjustDifficulty();

    const result = {
      correct: isCorrect, direction, expected: this.currentShape.direction,
      points: pointsEarned, reaction, bonus, prevStreak,
      streak: this.streak, multiplier: this.multiplier, score: this.score
    };
    this.currentShape = null;
    this.bonusType = null;

    clearTimeout(this._spawnTimeout);
    /* After an answer: spawn next item quickly.
       Brain/Memo modes get a slightly longer pause so the player can read new corners.
       Normal modes: minimal delay for snappy feel. */
    const postAnswerDelay = (this.isBrainMode || this.isMemoMode)
      ? Math.max(150, Math.min(400, this.spawnInterval * 0.2))
      : (this.practice ? CONFIG.PRACTICE_INTERVAL : Math.max(80, this.spawnInterval * 0.15));
    this._scheduleSpawn(postAnswerDelay);
    if (this.onResult) this.onResult(result);

    /* Corner shuffle check (shape modes only) */
    if (isCorrect && !this.practice && this.correct >= this._nextShuffleAt) {
      this._triggerCornerShuffle();
    }

    const dur = this._getDuration();
    const hasTimer = dur > 0;
    if (!this.practice && hasTimer && this.timer > 5 && this.timer < dur &&
        isCorrect && this.timer % CONFIG.RUSH_INTERVAL === 0 && this.streak >= 3) {
      this._triggerRush();
    }
    if (this.playType === 'endless' && isCorrect && this.correct > 0 && this.correct % 20 === 0 && this.streak >= 3) {
      this._triggerRush();
    }

    if (this.playType === 'competition' && this.score >= this.competitionTarget && isCorrect) {
      if (this.onCompetitionComplete) this.onCompetitionComplete(this.competitionLevel, this.score);
    }

    return result;
  }

  autoMiss() {
    if (this.practice || !this.currentShape) return;
    this.total++;
    this.wrong++;
    this.streak = 0;
    this.feverStreak = 0;
    this._consecutiveMisses++;
    this.multiplier = Math.max(1, this.multiplier - CONFIG.MISS_PENALTY);
    if (this.onMultiplierChange) this.onMultiplierChange(this.multiplier);
    this._addRecentResult(false, 9999);

    /* ── Auto-miss time penalty & speed recovery ── */
    const autoMissPenalty = (this.isBrainMode || this.isReflexMode)
      ? (CONFIG.WRONG_TIME_PENALTY_BRAIN ?? CONFIG.WRONG_TIME_PENALTY)
      : CONFIG.WRONG_TIME_PENALTY;
    if (autoMissPenalty > 0 && this.playType !== 'endless' && this._timerWallStart && this.timer > 0) {
      this._timerTarget -= autoMissPenalty;
      this.timer = Math.max(0, Math.ceil(
        this._timerTarget - (Date.now() - this._timerWallStart - this._timerPausedAccum) / 1000
      ));
      if (this.onTimerPenalty) this.onTimerPenalty(autoMissPenalty);
      if (this.timer <= 0) { this._endGame(); return; }
    }
    this.spawnInterval = Math.min(this._spawnMax, this.spawnInterval + this._speedStep * CONFIG.SPEED_WRONG_RECOVERY_MULT);

    if (!this.practice) this._adjustDifficulty();

    if (this.playType === 'endless') {
      this.endlessTotalMisses++;
      this.endlessLives = CONFIG.ENDLESS_MAX_MISSES - this.endlessTotalMisses;
      if (this.onEndlessMiss) this.onEndlessMiss(this.endlessLives);
    }

    const result = {
      correct: false, direction: null, expected: this.currentShape?.direction,
      points: 0, reaction: 9999, bonus: null, streak: 0,
      multiplier: this.multiplier, score: this.score, autoMiss: true
    };
    this.currentShape = null;
    if (this.onResult) this.onResult(result);

    if (this.playType === 'endless' && this.endlessLives <= 0) {
      this._endGame();
    }

    return result;
  }

  /* ─── Sequenz (Simon Says) Mode ─── */

  _getSequenzFlashMs() {
    const base = CONFIG.SEQUENZ_FLASH_MS;
    const min = CONFIG.SEQUENZ_FLASH_MIN || 250;
    const every = CONFIG.SEQUENZ_SPEED_UP_EVERY || 3;
    return Math.max(min, base - Math.floor(this._seqRound / every) * (CONFIG.SEQUENZ_SPEED_STEP || 50));
  }

  _startSequenzRound() {
    if (!this.running || this.paused) return;
    const dirs = this.directions;
    const seqLen = Math.min(
      CONFIG.SEQUENZ_START_LENGTH + this._seqRound,
      CONFIG.SEQUENZ_MAX_LENGTH || 20
    );

    /* Generate random pattern */
    this._seqPattern = [];
    for (let i = 0; i < seqLen; i++) {
      this._seqPattern.push(dirs[Math.floor(this.rng() * dirs.length)]);
    }
    this._seqInputIndex = 0;
    this._seqPhase = 'watch';

    if (this.onSequenzRoundStart) this.onSequenzRoundStart(this._seqRound, seqLen);

    /* Flash each direction one by one */
    const flashMs = this._getSequenzFlashMs();
    const pauseMs = CONFIG.SEQUENZ_PAUSE_MS;
    this._seqFlashTimeouts = [];

    this._seqPattern.forEach((dir, i) => {
      const delay = (flashMs + pauseMs) * i + pauseMs;
      const t = setTimeout(() => {
        if (!this.running || this.paused) return;
        if (this.onSequenzFlash) this.onSequenzFlash(dir, i, seqLen, flashMs);
      }, delay);
      this._seqFlashTimeouts.push(t);
    });

    /* After final flash, enter "go" phase */
    const totalDelay = (flashMs + pauseMs) * seqLen + (CONFIG.SEQUENZ_READY_DELAY || 400);
    const readyT = setTimeout(() => {
      if (!this.running || this.paused) return;
      this._seqPhase = 'go';
      this.lastSpawnTime = performance.now();
      if (this.onSequenzReady) this.onSequenzReady(seqLen);
      this._startSeqInputTimeout();
    }, totalDelay);
    this._seqFlashTimeouts.push(readyT);
  }

  _startSeqInputTimeout() {
    clearTimeout(this._seqInputTimeout);
    let ms = CONFIG.SEQUENZ_INPUT_TIMEOUT_MS || 4000;
    /* After difficulty plateau, progressively reduce input timeout */
    const maxLen = CONFIG.SEQUENZ_MAX_LENGTH || 20;
    const plateauRound = maxLen - (CONFIG.SEQUENZ_START_LENGTH || 4);
    if (this._seqRound > plateauRound) {
      const extra = this._seqRound - plateauRound;
      ms = Math.max(
        CONFIG.SEQUENZ_INPUT_TIMEOUT_MIN || 2000,
        ms - extra * (CONFIG.SEQUENZ_INPUT_TIMEOUT_STEP || 100)
      );
    }
    this._seqInputTimeout = setTimeout(() => {
      if (!this.running || this.paused || this._seqPhase !== 'go') return;
      /* Treat timeout as a wrong answer — pick an impossible direction */
      this.handleSequenzInput('__timeout__');
    }, ms);
  }

  handleSequenzInput(direction) {
    if (!this.running || this.paused) return null;
    if (this._seqPhase !== 'go') return null;
    clearTimeout(this._seqInputTimeout);

    const expected = this._seqPattern[this._seqInputIndex];
    const isCorrect = direction === expected;
    const reaction = performance.now() - this.lastSpawnTime;
    this.total++;

    if (isCorrect) {
      this._seqInputIndex++;
      this.correct++;

      /* Full sequence reproduced? */
      if (this._seqInputIndex >= this._seqPattern.length) {
        this.streak++;
        this.feverStreak++;
        this._consecutiveMisses = 0;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;

        const seqLen = this._seqPattern.length;
        let pts = Math.round(CONFIG.BASE_SCORE * Math.pow(seqLen, 1.2)) * this.multiplier;
        if (this.feverActive) pts *= CONFIG.FEVER_MULT;
        pts = Math.round(pts);
        this.score += pts;

        /* Multiplier */
        const newMult = Math.min(CONFIG.MULTIPLIER_MAX,
          1 + Math.floor(this.streak / CONFIG.STREAK_PER_MULTIPLIER));
        if (newMult !== this.multiplier) {
          this.multiplier = newMult;
          if (this.onMultiplierChange) this.onMultiplierChange(this.multiplier);
        }
        if (this.streak % 5 === 0 && this.onStreak) this.onStreak(this.streak);
        if ((this.streak === 5 || this.streak === 10 || this.streak === 15 || this.streak === 20)
            && this.onComboMilestone) this.onComboMilestone(this.streak);

        /* ── Sequenz life recovery (mirrors handleSwipe endless logic) ── */
        if (this.streak % CONFIG.ENDLESS_LIFE_STREAK === 0) {
          if (this.endlessLives < CONFIG.ENDLESS_MAX_MISSES) {
            this.endlessTotalMisses = Math.max(0, this.endlessTotalMisses - 1);
            this.endlessLives = CONFIG.ENDLESS_MAX_MISSES - this.endlessTotalMisses;
            if (this.onEndlessLifeEarned) this.onEndlessLifeEarned(this.endlessLives);
          }
        }

        /* Fever */
        const _feverReqSeq = CONFIG.FEVER_STREAK_BRAIN || 8;
        if (!this.feverActive && this.feverStreak >= _feverReqSeq
            && performance.now() >= this._feverCooldownUntil) this._startFever();

        /* Score milestone */
        if (this.onScoreMilestone) {
          const milestones = CONFIG.SCORE_MILESTONES || [];
          for (let mi = 0; mi < milestones.length; mi++) {
            if (mi > this._lastMilestoneIndex && this.score >= milestones[mi]) {
              this._lastMilestoneIndex = mi;
              this.onScoreMilestone(milestones[mi], mi);
              break; /* one milestone per answer */
            }
          }
        }

        this.reactionTimes.push(reaction);
        this._addRecentResult(true, reaction);

        const result = {
          correct: true, direction, expected, points: pts, reaction,
          streak: this.streak, multiplier: this.multiplier, score: this.score,
          sequenzRound: this._seqRound, sequenzComplete: true,
          seqLen
        };
        if (this.onSequenzResult) this.onSequenzResult(result);
        if (this.onResult) this.onResult(result);

        /* Next round */
        this._seqRound++;
        this._seqPhase = 'idle';
        setTimeout(() => this._startSequenzRound(), 1200);
        return result;
      }

      /* Partial — correct step, not yet complete */
      this.lastSpawnTime = performance.now();
      this._startSeqInputTimeout();
      const partial = {
        correct: true, direction, expected, points: 0, reaction,
        streak: this.streak, multiplier: this.multiplier, score: this.score,
        sequenzStep: this._seqInputIndex, sequenzComplete: false
      };
      if (this.onSequenzResult) this.onSequenzResult(partial);
      return partial;
    }

    /* ─ Wrong input ─ */
    this.wrong++;
    const brokenStreak = this.streak;
    this.streak = 0;
    this.feverStreak = 0;
    this._consecutiveMisses++;
    this.multiplier = Math.max(1, this.multiplier - CONFIG.MISS_PENALTY);
    if (this.onMultiplierChange) this.onMultiplierChange(this.multiplier);
    if (brokenStreak >= 3 && this.onStreakBreak) this.onStreakBreak(brokenStreak);
    this._addRecentResult(false, reaction);

    this.endlessTotalMisses++;
    this.endlessLives = CONFIG.ENDLESS_MAX_MISSES - this.endlessTotalMisses;
    if (this.onEndlessMiss) this.onEndlessMiss(this.endlessLives);

    const fail = {
      correct: false, direction, expected, points: 0, reaction,
      streak: 0, multiplier: this.multiplier, score: this.score,
      sequenzRound: this._seqRound, sequenzComplete: false
    };
    if (this.onSequenzResult) this.onSequenzResult(fail);
    if (this.onResult) this.onResult(fail);

    if (this.endlessLives <= 0) { this._endGame(); return fail; }

    /* Retry same round */
    this._seqPhase = 'idle';
    setTimeout(() => this._startSequenzRound(), 1500);
    return fail;
  }

  /* ─── Corner Shuffle ─── */
  _triggerCornerShuffle() {
    if (this.isBrainMode || this.isMemoMode || this.isSequenzMode || this.isReflexMode) return;
    this._shuffleCount++;
    const interval = Math.max(
      CONFIG.CORNER_SHUFFLE_MIN_INTERVAL,
      CONFIG.CORNER_SHUFFLE_INTERVAL - (this._shuffleCount - 1) * CONFIG.CORNER_SHUFFLE_STEP
    );
    this._nextShuffleAt = this.correct + interval;

    /* Fire warning callback */
    if (this.onCornerShuffleWarn) this.onCornerShuffleWarn();

    /* Pause spawning during shuffle animation */
    clearTimeout(this._spawnTimeout);
    this._shuffleTimeout = setTimeout(() => {
      if (!this.running || this.paused) return;
      this._shuffleCorners();
      if (this.onCornerShuffle) this.onCornerShuffle(this.cornerMap);
      /* Resume spawning after shuffle */
      this._scheduleSpawn(400);
    }, CONFIG.CORNER_SHUFFLE_WARNING_MS);
  }

  _shuffleCorners() {
    const dirs = this.directions;
    const entries = dirs.map(d => ({ ...this.cornerMap[d] }));
    const shuffled = shuffle(entries, this.rng);

    /* Also shuffle color assignments to increase difficulty */
    if (CONFIG.CORNER_SHUFFLE_COLORS && this._shuffleCount >= 2) {
      const colorIndices = shuffled.map(e => ({ color: e.color, colorblind: e.colorblind, colorIndex: e.colorIndex }));
      const shuffledColors = shuffle(colorIndices, this.rng);
      shuffled.forEach((e, i) => {
        e.color = shuffledColors[i].color;
        e.colorblind = shuffledColors[i].colorblind;
        e.colorIndex = shuffledColors[i].colorIndex;
      });
    }

    dirs.forEach((d, i) => { this.cornerMap[d] = shuffled[i]; });
  }

  _startFever() {
    this.feverActive = true;
    this.feverStreak = 0;
    this._feverTriggered++;  /* count for achievements */
    this._feverStartedAt = performance.now();
    this._feverRemainingMs = 0;
    if (this.onFeverStart) this.onFeverStart();
    clearTimeout(this._feverTimeout);
    this._feverTimeout = setTimeout(() => this._endFever(), CONFIG.FEVER_DURATION);
  }

  _endFever() {
    this.feverActive = false;
    clearTimeout(this._feverTimeout);
    this._feverTimeout = null;
    this._feverCooldownUntil = performance.now() + (CONFIG.FEVER_COOLDOWN_MS || 3000);
    if (this.onFeverEnd) this.onFeverEnd();
  }

  _triggerRush() {
    if (this.onRush) this.onRush();
    clearTimeout(this._spawnTimeout);
    this._rushQueue.forEach(t => clearTimeout(t));
    this._rushQueue = [];

    this.inRush = true;
    this._rushIndex = 0;
    const totalShapes = CONFIG.RUSH_COUNT;
    const warningDelay = CONFIG.RUSH_WARNING_MS || 400;
    const rushDelay = (this.isBrainMode || this.isMemoMode)
      ? (CONFIG.RUSH_DELAY_BRAIN || CONFIG.RUSH_DELAY)
      : CONFIG.RUSH_DELAY;

    for (let i = 0; i < totalShapes; i++) {
      const delay = warningDelay + rushDelay * (i + 1);
      const t = setTimeout(() => {
        if (!this.running || this.paused) return;
        this._rushIndex = i + 1;
        this._spawn();
        if (this._rushIndex >= totalShapes) {
          setTimeout(() => {
            this.inRush = false;
            if (this.running && !this.paused) this._scheduleSpawn();
          }, rushDelay);
        }
      }, delay);
      this._rushQueue.push(t);
    }
  }

  _addRecentResult(correct, reaction) {
    this._recentWindow.push({ correct, reaction });
    if (this._recentWindow.length > 10) this._recentWindow.shift();
  }

  _adjustDifficulty() {
    if (this._recentWindow.length < 5) return;
    if (this.correct < 8) return;             // grace period: no adaptive changes in first 8 correct
    const w = this._recentWindow;
    const acc = w.filter(r => r.correct).length / w.length;
    const avgReact = w.filter(r => r.correct).reduce((s, r) => s + r.reaction, 0) /
                     Math.max(1, w.filter(r => r.correct).length);
    const minI = this._spawnMin, maxI = this._spawnMax, step = this._spawnStep;
    const reactionThreshold = (this.isBrainMode || this.isMemoMode)
      ? CONFIG.DIFFICULTY_GOOD_REACTION_BRAIN
      : CONFIG.DIFFICULTY_GOOD_REACTION;
    if (acc >= CONFIG.DIFFICULTY_GOOD_ACCURACY && avgReact <= reactionThreshold) {
      this.spawnInterval = Math.max(minI, this.spawnInterval - step);
    } else if (acc <= CONFIG.DIFFICULTY_BAD_ACCURACY || this._consecutiveMisses >= CONFIG.DIFFICULTY_BAD_CONSECUTIVE_MISSES) {
      this.spawnInterval = Math.min(maxI, this.spawnInterval + step);
    }
  }

  _endGame() {
    this.running = false;
    clearTimeout(this._timerInterval);
    clearInterval(this._elapsedInterval);
    clearTimeout(this._spawnTimeout);
    clearTimeout(this._feverTimeout);
    clearTimeout(this._shuffleTimeout);
    clearTimeout(this._memoPreviewTimeout);
    this._rushQueue.forEach(t => clearTimeout(t));
    this._rushQueue = [];
    this._seqFlashTimeouts.forEach(t => clearTimeout(t));
    this._seqFlashTimeouts = [];
    clearTimeout(this._seqInputTimeout);
    this._seqInputTimeout = null;

    if (this.playType !== 'endless' && !this.continued && this.onContinuePrompt && this._getDuration() > 0) {
      this.onContinuePrompt(this._buildStats());
      return;
    }

    this._finalizeGameOver();
  }

  _buildStats() {
    const accuracy = this.total > 0 ? this.correct / this.total : 0;
    const avgReaction = this.reactionTimes.length > 0
      ? Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length) : 0;
    const streakBonus = this.bestStreak * CONFIG.END_BONUS_STREAK_MULT;
    const accBonus = Math.round(accuracy * 100) * CONFIG.END_BONUS_ACCURACY_MULT;
    const finalScore = this.score + streakBonus + accBonus;
    const xp = Math.round(finalScore / 100 * CONFIG.XP_PER_100_SCORE);
    const lightningCount = this.reactionTimes.filter(r => r < 300).length;
    const bestReactionTime = this.reactionTimes.length > 0 ? Math.min(...this.reactionTimes) : 0;
    const isPerfectRound = Math.round(accuracy * 100) === 100 && this.total >= 15;
    const perfectBonus = isPerfectRound ? 500 : 0;
    const lightningBonus = lightningCount * 25;
    const day = new Date().getDay();
    const isWeekend = (day === 0 || day === 6);
    const weekendMult = isWeekend ? (CONFIG.WEEKEND_XP_MULTIPLIER || 1) : 1;
    const totalXp = Math.round((xp + perfectBonus + lightningBonus) * weekendMult);
    return {
      score: finalScore, streak: this.bestStreak,
      accuracy: Math.round(accuracy * 100),
      correct: this.correct, wrong: this.wrong, total: this.total,
      avgReaction, streakBonus, accBonus, xp: totalXp,
      mode: this.mode, playType: this.playType, isDaily: this.isDaily,
      competitionLevel: this.competitionLevel,
      elapsed: this.elapsed,
      /* Achievement tracking extras */
      goldenCaught: this._goldenCaught,
      diamondCaught: this._diamondCaught,
      feverTriggered: this._feverTriggered,
      maxMultiplier: this._maxMultiplier,
      /* Enhanced stats */
      lightningCount,
      bestReactionTime,
      isPerfectRound,
      perfectBonus,
      lightningBonus,
      isWeekend,
      weekendMult,
      sequenzRounds: this._seqRound,
    };
  }

  _finalizeGameOver() {
    const stats = this._buildStats();
    this.score = stats.score;
    if (this.onGameOver) this.onGameOver(stats);
    return stats;
  }

  declineContinue() {
    this.continued = true;
    this._finalizeGameOver();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.inRush = false;
    clearTimeout(this._timerInterval);
    clearInterval(this._elapsedInterval);
    clearTimeout(this._spawnTimeout);
    clearTimeout(this._feverTimeout);
    clearTimeout(this._shuffleTimeout);
    clearTimeout(this._memoPreviewTimeout);
    this._rushQueue.forEach(t => clearTimeout(t));
    this._rushQueue = [];
    this._seqFlashTimeouts.forEach(t => clearTimeout(t));
    this._seqFlashTimeouts = [];
    clearTimeout(this._seqInputTimeout);
    this._seqInputTimeout = null;
  }

  static todaySeed() { return todaySeed(); }
  static todayKey()  { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
}
