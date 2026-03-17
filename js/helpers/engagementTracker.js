/* ═══════════════════════════════════════
   SCS Play — Engagement Tracker
   Passive behavioral tracking for measuring
   player enjoyment. All data local-only.
   ═══════════════════════════════════════ */

const MAX_SESSIONS = 50;
const MAX_FEEDBACK = 100;
const RETURN_DAYS_WINDOW = 30;

export class EngagementTracker {
  constructor(save) {
    this._save = save;
    this._sessionStart = null;
    this._sessionStartPerf = null;
    this._sessionGames = 0;
    this._screensVisited = [];
    this._resultsShownAt = 0;
    this._currentScreen = 'boot';
    this._inGame = false;
    this._init();
  }

  /* ─── Init: start a session, mark return day ─── */
  _init() {
    this._ensureData();
    this._startSession();
    this._markReturnDay();
    this._bindVisibility();
  }

  _ensureData() {
    const d = this._save.data;
    if (!d.engagement) {
      d.engagement = {
        sessions: [],
        returnDays: [],
        postGameActions: {
          retryCount: 0,
          retryAfterGood: 0,
          retryAfterBad: 0,
          homeAfterBad: 0,
          totalResultsTimeSec: 0,
          totalResultsViews: 0,
          shareCount: 0
        },
        quitPatterns: {
          midGameQuits: 0,
          pauseToQuit: 0,
          earlyQuits: 0,
          totalGameStarts: 0
        },
        featureAdoption: {
          screensVisited: [],
          modesPlayed: [],
          playTypesPlayed: [],
          avatarChanged: false,
          themeChanged: false,
          dailyChallengesPlayed: 0,
          tutorialCompleted: false
        },
        microFeedback: [],
        lastPromptGame: 0,
        lastPromptDate: null,
        sessionPromptShown: false,
        firstSeen: new Date().toISOString()
      };
    }
    // Migrations for older engagement data
    const e = d.engagement;
    if (!e.firstSeen) e.firstSeen = new Date().toISOString();
    if (!e.postGameActions) e.postGameActions = { retryCount: 0, retryAfterGood: 0, retryAfterBad: 0, homeAfterBad: 0, totalResultsTimeSec: 0, totalResultsViews: 0, shareCount: 0 };
    if (!e.quitPatterns) e.quitPatterns = { midGameQuits: 0, pauseToQuit: 0, earlyQuits: 0, totalGameStarts: 0 };
    if (!e.featureAdoption) e.featureAdoption = { screensVisited: [], modesPlayed: [], playTypesPlayed: [], avatarChanged: false, themeChanged: false, dailyChallengesPlayed: 0, tutorialCompleted: false };
    if (!e.microFeedback) e.microFeedback = [];
    if (!e.sessions) e.sessions = [];
    if (!e.returnDays) e.returnDays = [];
  }

  _eng() { return this._save.data.engagement; }

  /* ═══════ Session Tracking ═══════ */

  _startSession() {
    this._sessionStart = new Date().toISOString();
    this._sessionStartPerf = performance.now();
    this._sessionGames = 0;
    this._screensVisited = [];
    const e = this._eng();
    e.sessionPromptShown = false;
  }

  _endSession(voluntary) {
    if (!this._sessionStart) return;
    const durationSec = Math.round((performance.now() - this._sessionStartPerf) / 1000);
    if (durationSec < 2) return; // ignore sub-2s sessions (reload etc.)

    const session = {
      start: this._sessionStart,
      end: new Date().toISOString(),
      durationSec,
      gamesPlayed: this._sessionGames,
      screensVisited: [...new Set(this._screensVisited)],
      endedVoluntary: voluntary
    };

    const e = this._eng();
    e.sessions.push(session);
    if (e.sessions.length > MAX_SESSIONS) {
      e.sessions = e.sessions.slice(-MAX_SESSIONS);
    }
    this._save.save();
    this._sessionStart = null;
  }

  _bindVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // App went to background
        const voluntary = this._currentScreen !== 'game';
        if (this._inGame) {
          this._eng().quitPatterns.midGameQuits++;
        }
        this._endSession(voluntary);
      } else {
        // App came back
        this._startSession();
        this._markReturnDay();
      }
    });
    window.addEventListener('pagehide', () => {
      const voluntary = this._currentScreen !== 'game';
      this._endSession(voluntary);
    });
  }

  /* ═══════ Return Days (Retention) ═══════ */

  _markReturnDay() {
    const today = new Date().toISOString().slice(0, 10);
    const e = this._eng();
    if (!e.returnDays.includes(today)) {
      e.returnDays.push(today);
    }
    // Keep only last N days
    if (e.returnDays.length > RETURN_DAYS_WINDOW) {
      e.returnDays = e.returnDays.slice(-RETURN_DAYS_WINDOW);
    }
  }

  /* ═══════ Screen Visit Tracking ═══════ */

  trackScreenVisit(screenId) {
    this._currentScreen = screenId;
    this._inGame = screenId === 'game';
    if (!this._screensVisited.includes(screenId)) {
      this._screensVisited.push(screenId);
    }
    const fa = this._eng().featureAdoption;
    if (!fa.screensVisited.includes(screenId)) {
      fa.screensVisited.push(screenId);
    }
  }

  /* ═══════ Game Start / End Tracking ═══════ */

  trackGameStart() {
    this._inGame = true;
    this._eng().quitPatterns.totalGameStarts++;
  }

  trackGameEnd() {
    this._sessionGames++;
    this._inGame = false;
  }

  /* ═══════ Post-Game Actions ═══════ */

  markResultsShown() {
    this._resultsShownAt = performance.now();
    this._eng().postGameActions.totalResultsViews++;
  }

  trackPostGameAction(action, wasGoodGame) {
    const pga = this._eng().postGameActions;
    const timeSec = Math.round((performance.now() - this._resultsShownAt) / 1000);
    pga.totalResultsTimeSec += timeSec;

    if (action === 'retry') {
      pga.retryCount++;
      if (wasGoodGame) pga.retryAfterGood++;
      else pga.retryAfterBad++;
    } else if (action === 'home') {
      if (!wasGoodGame) pga.homeAfterBad++;
    } else if (action === 'share') {
      pga.shareCount++;
    }
  }

  /* ═══════ Quit Patterns ═══════ */

  trackPauseToQuit() {
    this._eng().quitPatterns.pauseToQuit++;
  }

  trackEarlyQuit() {
    this._eng().quitPatterns.earlyQuits++;
  }

  /* ═══════ Feature Adoption ═══════ */

  trackModePlay(mode) {
    const fa = this._eng().featureAdoption;
    if (!fa.modesPlayed.includes(mode)) {
      fa.modesPlayed.push(mode);
    }
  }

  trackPlayType(playType) {
    const fa = this._eng().featureAdoption;
    if (!fa.playTypesPlayed.includes(playType)) {
      fa.playTypesPlayed.push(playType);
    }
  }

  trackAvatarChange() { this._eng().featureAdoption.avatarChanged = true; }
  trackThemeChange() { this._eng().featureAdoption.themeChanged = true; }
  trackDailyChallenge() { this._eng().featureAdoption.dailyChallengesPlayed++; }
  trackTutorialComplete() { this._eng().featureAdoption.tutorialCompleted = true; }

  /* ═══════ Score Trend (Linear Regression) ═══════ */

  computeScoreTrend(mode) {
    const scores = this._save.getScores(mode);
    if (scores.length < 5) return null;
    // Sort by date ascending, take last 20
    const sorted = [...scores]
      .filter(s => s.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-20);
    if (sorted.length < 5) return null;

    const n = sorted.length;
    const vals = sorted.map(s => s.score);
    const xMean = (n - 1) / 2;
    const yMean = vals.reduce((s, v) => s + v, 0) / n;

    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (vals[i] - yMean);
      den += (i - xMean) ** 2;
    }
    if (den === 0) return 0;
    const slope = num / den;
    // Normalize: slope relative to mean score
    return yMean > 0 ? slope / yMean : 0;
  }

  /* ═══════ Engagement Score Computation ═══════ */

  computeEngagementScore() {
    const e = this._eng();
    const data = this._gatherSignals();

    if (data.totalGames < 3) return { score: null, label: 'not_enough_data', signals: data };

    const scores = {
      retention:  this._normalize(data.activeDaysPerWeek, 0, 5),
      sessionLen: this._bellCurve(data.avgSessionMin, 8, 25),
      scoreTrend: this._normalize(data.avgScoreTrend + 1, 0, 2), // shift -1..1 to 0..2
      retryRate:  this._normalize(data.retryRate, 0, 0.8),
      quitRate:   1 - this._normalize(data.quitRate, 0, 0.3),
      exploration:this._normalize(data.modesPlayed, 1, 6),
      features:   this._normalize(data.featuresAdopted, 1, 10),
      feedback:   this._normalize(data.avgRating, 1, 4)
    };

    const weights = [0.25, 0.15, 0.15, 0.15, 0.10, 0.10, 0.05, 0.05];
    const keys = Object.keys(scores);
    let total = 0;
    for (let i = 0; i < keys.length; i++) {
      total += (scores[keys[i]] || 0) * weights[i];
    }
    const finalScore = Math.round(total * 100);

    let label;
    if (finalScore >= 80) label = 'engagement_high';
    else if (finalScore >= 60) label = 'engagement_solid';
    else if (finalScore >= 40) label = 'engagement_mixed';
    else label = 'engagement_low';

    return { score: finalScore, label, signals: data, subscores: scores };
  }

  _gatherSignals() {
    const e = this._eng();
    const save = this._save;

    // Retention: active days in last 7 days
    const now = new Date();
    const last7 = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      last7.push(d.toISOString().slice(0, 10));
    }
    const activeDaysPerWeek = e.returnDays.filter(d => last7.includes(d)).length;

    // Session duration
    const recentSessions = e.sessions.slice(-20);
    const avgSessionSec = recentSessions.length > 0
      ? recentSessions.reduce((s, sess) => s + sess.durationSec, 0) / recentSessions.length
      : 0;
    const avgSessionMin = avgSessionSec / 60;
    const medianSessionMin = this._median(recentSessions.map(s => s.durationSec / 60));

    // Score trends across all modes
    const modes = ['klassik', 'beginner', 'expert', 'ultra', 'mathe', 'worte', 'memo', 'sequenz', 'stroop', 'fokus', 'chaos'];
    const trends = {};
    let trendSum = 0, trendCount = 0;
    for (const m of modes) {
      const t = this.computeScoreTrend(m);
      if (t !== null) {
        trends[m] = t;
        trendSum += t;
        trendCount++;
      }
    }
    const avgScoreTrend = trendCount > 0 ? trendSum / trendCount : 0;

    // Retry rate
    const pga = e.postGameActions;
    const retryRate = pga.totalResultsViews > 0
      ? pga.retryCount / pga.totalResultsViews
      : 0;

    // Quit rate
    const qp = e.quitPatterns;
    const quitRate = qp.totalGameStarts > 0
      ? (qp.midGameQuits + qp.pauseToQuit + qp.earlyQuits) / qp.totalGameStarts
      : 0;

    // Exploration
    const modesPlayed = e.featureAdoption.modesPlayed.length;
    const playTypesPlayed = e.featureAdoption.playTypesPlayed.length;

    // Feature adoption count
    const fa = e.featureAdoption;
    let featuresAdopted = fa.screensVisited.filter(s => !['boot', 'auth', 'home', 'game', 'results'].includes(s)).length;
    if (fa.avatarChanged) featuresAdopted++;
    if (fa.themeChanged) featuresAdopted++;
    if (fa.dailyChallengesPlayed > 0) featuresAdopted++;
    if (fa.tutorialCompleted) featuresAdopted++;

    // Feedback
    const ratings = e.microFeedback.filter(f => f.rating != null).map(f => f.rating);
    const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;
    const feedbackCount = e.microFeedback.length;
    const skipCount = e.microFeedback.filter(f => f.rating == null).length;
    const skipRate = feedbackCount > 0 ? skipCount / feedbackCount : 0;

    // Total games
    const totalGames = save.getGamesPlayed();
    const totalSessions = e.sessions.length;

    return {
      activeDaysPerWeek,
      avgSessionMin: Math.round(avgSessionMin * 10) / 10,
      medianSessionMin: Math.round(medianSessionMin * 10) / 10,
      avgScoreTrend: Math.round(avgScoreTrend * 1000) / 1000,
      scoreTrends: trends,
      retryRate: Math.round(retryRate * 100) / 100,
      retryAfterGood: pga.retryAfterGood,
      retryAfterBad: pga.retryAfterBad,
      quitRate: Math.round(quitRate * 100) / 100,
      midGameQuits: qp.midGameQuits,
      pauseToQuit: qp.pauseToQuit,
      earlyQuits: qp.earlyQuits,
      modesPlayed,
      playTypesPlayed,
      featuresAdopted,
      featuresList: fa.screensVisited,
      avgRating: Math.round(avgRating * 10) / 10,
      feedbackCount,
      skipRate: Math.round(skipRate * 100) / 100,
      totalGames,
      totalSessions,
      firstSeen: e.firstSeen,
      returnDays: e.returnDays,
      postGameActions: pga,
      sessionLengths: recentSessions.map(s => s.durationSec)
    };
  }

  /* ═══════ MicroFeedback ═══════ */

  shouldShowFeedback(trigger, sessionGames) {
    const e = this._eng();
    // Max 1 prompt per session
    if (e.sessionPromptShown) return false;
    // At least 3 games since last prompt
    if (sessionGames - e.lastPromptGame < 3) return false;
    // Max 1 per day
    const today = new Date().toISOString().slice(0, 10);
    if (e.lastPromptDate === today) return false;
    return true;
  }

  recordFeedback(trigger, rating, context) {
    const e = this._eng();
    e.microFeedback.push({
      timestamp: new Date().toISOString(),
      trigger,
      rating, // 1-4 or null (skipped)
      context
    });
    if (e.microFeedback.length > MAX_FEEDBACK) {
      e.microFeedback = e.microFeedback.slice(-MAX_FEEDBACK);
    }
    e.sessionPromptShown = true;
    e.lastPromptGame = context.sessionGame || 0;
    e.lastPromptDate = new Date().toISOString().slice(0, 10);
    this._save.save();
  }

  /* ═══════ History for Charts ═══════ */

  getDailyGameCounts(days = 14) {
    const counts = {};
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      counts[d.toISOString().slice(0, 10)] = 0;
    }
    // Count from sessions
    const e = this._eng();
    for (const sess of e.sessions) {
      const day = sess.start.slice(0, 10);
      if (day in counts) counts[day] += sess.gamesPlayed;
    }
    return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  }

  /* ═══════ Export ═══════ */

  exportJSON() {
    const { score, label, signals, subscores } = this.computeEngagementScore();
    return {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      engagementScore: score,
      label,
      signals,
      subscores,
      history: {
        dailyGames: this.getDailyGameCounts(14),
        sessionLengths: signals.sessionLengths,
        scoreTrends: signals.scoreTrends,
        feedbackEntries: this._eng().microFeedback
      },
      metadata: {
        totalSessions: signals.totalSessions,
        totalGames: signals.totalGames,
        firstSeen: signals.firstSeen,
        platform: 'web/pwa',
        appVersion: '1.0'
      }
    };
  }

  exportText() {
    const { score, label, signals } = this.computeEngagementScore();
    const lines = [
      '=== SCS Play — Engagement Report ===',
      `Erstellt: ${new Date().toLocaleString('de-DE')}`,
      `Datengrundlage: ${signals.totalSessions} Sessions, ${signals.totalGames} Spiele, seit ${signals.firstSeen?.slice(0, 10) || '?'}`,
      '',
      `ENGAGEMENT-SCORE: ${score !== null ? score + ' / 100' : 'Nicht genug Daten'}`,
      '',
      '--- Signale ---',
      `Rückkehr: ${signals.activeDaysPerWeek} Tage/Woche`,
      `Sessions: Ø ${signals.avgSessionMin} Min. (Median: ${signals.medianSessionMin} Min.)`,
      `Lernkurve: ${signals.avgScoreTrend > 0 ? '+' : ''}${(signals.avgScoreTrend * 100).toFixed(1)}%`,
      `Retry-Rate: ${(signals.retryRate * 100).toFixed(0)}%`,
      `Abbruch-Rate: ${(signals.quitRate * 100).toFixed(0)}% (Mid-Game: ${signals.midGameQuits}, Pause: ${signals.pauseToQuit}, Früh: ${signals.earlyQuits})`,
      `Modi gespielt: ${signals.modesPlayed}`,
      `Features entdeckt: ${signals.featuresAdopted}`,
      '',
      '--- Spieler-Feedback ---',
      `Durchschnitt: ${signals.avgRating} / 4`,
      `Einträge: ${signals.feedbackCount} (Skip-Rate: ${(signals.skipRate * 100).toFixed(0)}%)`,
      '',
      '=== Ende ==='
    ];
    return lines.join('\n');
  }

  /* ═══════ Helpers ═══════ */

  _normalize(val, min, max) {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
  }

  _bellCurve(val, idealMin, idealMax) {
    if (val >= idealMin && val <= idealMax) return 1;
    if (val < idealMin) return Math.max(0, val / idealMin);
    // Past ideal max, gradually decrease
    const overshoot = val - idealMax;
    return Math.max(0, 1 - overshoot / (idealMax * 2));
  }

  _median(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
