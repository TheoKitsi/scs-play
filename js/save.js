/* ═══════════════════════════════════════
   SCS Play — Save Service
   localStorage + Firestore sync
   XP, levels, achievements, daily, IAP lives
   Competition progress tracking
   ═══════════════════════════════════════ */
import { CONFIG } from './config.js';
import { getLanguage } from './i18n.js';
import {
  ensureAchStats, updateAchStats, checkAllAchievements,
  migrateOldAchievements, getAchById
} from './achievements/AchievementSystem.js';

const KEY = 'scs_save';

function defaults() {
  return {
    scores_klassik:  [],
    scores_beginner: [],
    scores_expert:   [],
    scores_ultra:    [],
    /* v14: New mode scores */
    scores_mathe:    [],
    scores_worte:    [],
    scores_memo:     [],
    scores_sequenz:  [],
    scores_stroop:   [],
    scores_fokus:    [],
    scores_chaos:    [],
    pb_klassik:  0,
    pb_beginner: 0,
    pb_expert:   0,
    pb_ultra:    0,
    /* v14: New mode PBs */
    pb_mathe:    0,
    pb_worte:    0,
    pb_memo:     0,
    pb_sequenz:  0,
    pb_stroop:   0,
    pb_fokus:    0,
    pb_chaos:    0,
    /* Endless PBs (by correct count) */
    pb_endless_klassik:  0,
    pb_endless_beginner: 0,
    pb_endless_expert:   0,
    pb_endless_ultra:    0,
    pb_endless_mathe:    0,
    pb_endless_worte:    0,
    pb_endless_memo:     0,
    pb_endless_sequenz:  0,
    pb_endless_stroop:   0,
    pb_endless_fokus:    0,
    pb_endless_chaos:    0,
    totalXP:   0,
    level:     0,
    gamesPlayed: 0,
    achievements: [],
    dailyChallenges: {},
    /* Competition progress */
    competitionLevel: 0,     // highest completed level (0-9)
    competitionStars: [],    // stars per level [0-3]
    ultraUnlockedViaCompetition: false,
    /* v5: IAP / Lives */
    lives: 3,
    purchases: {},
    /* v23: Fire currency */
    fire: 0,
    /* v11: Daily login */
    lastLoginDate: null,
    loginStreak: 0,
    /* v12: Daily XP diminishing returns */
    dailyXPDate: null,
    dailyXPEarned: 0,
    /* v11: Unlockables */
    activeTheme: 'default',
    activeTrail: 'default',
    settings: {
      colorblind: false,
      reducedMotion: false,
      haptics: true,
      sound: true,
      music: true,
      language: 'auto',
      gameMode: 'klassik',
      playType: 'blitz',          // blitz | classic | endless | competition
      tutorialDone: false,
      themeMode: 'auto'           // auto | dark | light (v17)
    },
    /* v20: Per-mode instruction view counter */
    instructionViews: {},
    /* v7: Avatar */
    avatar: null,   // { icon: 'star', colorIndex: 3 }
    /* v34: Hero carousel shortcut pinboard (8 user slots = 4x2 grid) */
    pinnedModes: ['klassik', 'beginner', 'mathe', 'stroop', null, null, null, null]
  };
}

export class SaveService {
  constructor(authService) {
    this.auth = authService;
    this.data = defaults();
    this._loaded = false;
  }

  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...defaults(), ...parsed, settings: { ...defaults().settings, ...(parsed.settings || {}) } };
        /* Migration: indie → beginner */
        if (parsed.scores_indie?.length) {
          this.data.scores_beginner = this._mergeScores(this.data.scores_beginner || [], parsed.scores_indie);
          delete this.data.scores_indie;
        }
        if (parsed.pb_indie) {
          this.data.pb_beginner = Math.max(this.data.pb_beginner || 0, parsed.pb_indie || 0);
          delete this.data.pb_indie;
        }
        if (this.data.settings.gameMode === 'indie') {
          this.data.settings.gameMode = 'beginner';
        }
        /* Ensure fields exist for old saves */
        if (this.data.lives == null) this.data.lives = 3;
        if (!this.data.purchases) this.data.purchases = {};
        if (!this.data.scores_ultra) this.data.scores_ultra = [];
        if (this.data.competitionLevel == null) this.data.competitionLevel = 0;
        if (!this.data.competitionStars) this.data.competitionStars = [];
        if (!this.data.settings.playType) this.data.settings.playType = 'blitz';
        /* v11: Ensure unlock fields */
        if (!this.data.activeTheme) this.data.activeTheme = 'default';
        if (!this.data.activeTrail) this.data.activeTrail = 'default';
        if (this.data.lastLoginDate == null) this.data.lastLoginDate = null;
        if (this.data.loginStreak == null) this.data.loginStreak = 0;
        /* v12: daily XP tracking */
        if (this.data.dailyXPDate == null) this.data.dailyXPDate = null;
        if (this.data.dailyXPEarned == null) this.data.dailyXPEarned = 0;
        /* v12: recalc level with new thresholds */
        this.data.level = this._calcLevel(this.data.totalXP);
      }
    } catch { /* ignore corrupt data */ }

    /* Cloud sync */
    if (this.auth && !this.auth.isGuest) {
      try {
        const cloud = await this.auth.cloudLoad('saves');
        if (cloud) {
          this.data.pb_klassik = Math.max(this.data.pb_klassik, cloud.pb_klassik || 0);
          this.data.pb_beginner = Math.max(this.data.pb_beginner, cloud.pb_beginner || cloud.pb_indie || 0);
          this.data.pb_expert = Math.max(this.data.pb_expert, cloud.pb_expert || 0);
          this.data.pb_ultra = Math.max(this.data.pb_ultra, cloud.pb_ultra || 0);
          this.data.pb_mathe = Math.max(this.data.pb_mathe || 0, cloud.pb_mathe || 0);
          this.data.pb_worte = Math.max(this.data.pb_worte || 0, cloud.pb_worte || 0);
          this.data.pb_memo = Math.max(this.data.pb_memo || 0, cloud.pb_memo || 0);
          this.data.pb_sequenz = Math.max(this.data.pb_sequenz || 0, cloud.pb_sequenz || 0);
          this.data.pb_stroop = Math.max(this.data.pb_stroop || 0, cloud.pb_stroop || 0);
          this.data.pb_fokus = Math.max(this.data.pb_fokus || 0, cloud.pb_fokus || 0);
          this.data.pb_chaos = Math.max(this.data.pb_chaos || 0, cloud.pb_chaos || 0);
          this.data.totalXP = Math.max(this.data.totalXP, cloud.totalXP || 0);
          this.data.level = Math.max(this.data.level, cloud.level || 0);
          this.data.gamesPlayed = Math.max(this.data.gamesPlayed, cloud.gamesPlayed || 0);
          this.data.competitionLevel = Math.max(this.data.competitionLevel, cloud.competitionLevel || 0);
          if (cloud.ultraUnlockedViaCompetition) this.data.ultraUnlockedViaCompetition = true;
          if (cloud.achievements) {
            this.data.achievements = [...new Set([...this.data.achievements, ...cloud.achievements])];
          }
          if (cloud.dailyChallenges) {
            this.data.dailyChallenges = { ...this.data.dailyChallenges, ...cloud.dailyChallenges };
          }
          ['scores_klassik','scores_beginner','scores_expert','scores_ultra','scores_mathe','scores_worte','scores_memo','scores_sequenz','scores_stroop','scores_fokus','scores_chaos','scores_hauptstaedte','scores_algebra'].forEach(k => {
            const ck = k === 'scores_beginner' ? (cloud[k] || cloud.scores_indie) : cloud[k];
            if (ck) this.data[k] = this._mergeScores(this.data[k] || [], ck);
          });
        }
      } catch {}
    }
    /* v20: Achievement system migration & achStats init */
    migrateOldAchievements(this.data);
    ensureAchStats(this.data);

    this._loaded = true;
    return this.data;
  }

  _mergeScores(a, b) {
    const map = new Map();
    [...(a||[]), ...(b||[])].forEach(s => {
      const key = s.date + '_' + s.score;
      if (!map.has(key)) map.set(key, s);
    });
    return [...map.values()].sort((x, y) => y.score - x.score).slice(0, 50);
  }

  async save() {
    localStorage.setItem(KEY, JSON.stringify(this.data));
    if (this.auth && !this.auth.isGuest) {
      try { await this.auth.cloudSave('saves', this.data); } catch {}
    }
  }

  /* ─── Score ─── */
  async addScore(stats) {
    const entry = {
      score: stats.score, streak: stats.streak, accuracy: stats.accuracy,
      avgReaction: stats.avgReaction, mode: stats.mode, playType: stats.playType || 'blitz',
      date: new Date().toISOString()
    };
    const key = `scores_${stats.mode}`;
    if (!this.data[key]) this.data[key] = [];
    this.data[key].push(entry);
    this.data[key].sort((a, b) => b.score - a.score);
    this.data[key] = this.data[key].slice(0, 50);

    const pbKey = `pb_${stats.mode}`;
    const isNewPB = stats.score > (this.data[pbKey] || 0);
    if (isNewPB) this.data[pbKey] = stats.score;

    /* Endless PB tracking (by correct count) */
    if (stats.playType === 'endless') {
      const endlessPBKey = `pb_endless_${stats.mode}`;
      if (stats.correct > (this.data[endlessPBKey] || 0)) {
        this.data[endlessPBKey] = stats.correct;
      }
    }

    this.data.gamesPlayed++;

    /* v12: Daily diminishing returns */
    const rawXP = stats.xp || 0;
    const today = new Date().toISOString().slice(0, 10);
    if (this.data.dailyXPDate !== today) {
      this.data.dailyXPDate = today;
      this.data.dailyXPEarned = 0;
    }
    const effectiveXP = this._applyDailyDiminish(rawXP);
    this.data.dailyXPEarned += rawXP; // track raw for bracket calc
    this.data.totalXP += effectiveXP;
    const oldLevel = this.data.level;
    this.data.level = this._calcLevel(this.data.totalXP);
    const leveledUp = this.data.level > oldLevel;

    /* v25: Per-mode XP & level tracking */
    const modeXPKey = `modeXP_${stats.mode}`;
    const modeLevelKey = `modeLevel_${stats.mode}`;
    this.data[modeXPKey] = (this.data[modeXPKey] || 0) + effectiveXP;
    const oldModeLevel = this.data[modeLevelKey] || 0;
    this.data[modeLevelKey] = this._calcLevel(this.data[modeXPKey]);
    const modeLeveledUp = (this.data[modeLevelKey] || 0) > oldModeLevel;

    /* v11: Award life on level up */
    if (leveledUp) {
      this.data.lives = Math.min((this.data.lives || 0) + CONFIG.LIVES_LEVEL_UP, CONFIG.LIVES_MAX);
      /* v23: Award fire on level up */
      this.data.fire = (this.data.fire || 0) + 25;
    }

    /* v23: Award fire based on best streak */
    const fireEarned = Math.max(0, stats.streak || 0);
    if (fireEarned > 0) {
      this.data.fire = (this.data.fire || 0) + fireEarned;
    }

    if (stats.isDaily) {
      const { GameEngine } = await import('./game/GameEngine.js');
      const dayKey = GameEngine.todayKey();
      const existing = this.data.dailyChallenges[dayKey];
      if (!existing || stats.score > existing.score) {
        this.data.dailyChallenges[dayKey] = { score: stats.score, mode: stats.mode };
      }
    }
    await this.save();
    return { isNewPB, leveledUp, newLevel: this.data.level, fireEarned: fireEarned + (leveledUp ? 25 : 0), modeLeveledUp, modeLevel: this.data[modeLevelKey] || 0 };
  }

  /* ── Per-mode level getters ── */
  getModeXP(mode)    { return this.data[`modeXP_${mode}`] || 0; }
  getModeLevel(mode) { return this.data[`modeLevel_${mode}`] || 0; }
  getModeLevelName(mode, lang) {
    const lv = this.getModeLevel(mode);
    const names = lang === 'en' ? CONFIG.LEVEL_NAMES_EN : CONFIG.LEVEL_NAMES_DE;
    return names[Math.min(lv, names.length - 1)];
  }
  getModeLevelProgress(mode) {
    const xp = this.getModeXP(mode);
    const lv = this.getModeLevel(mode);
    const t = CONFIG.LEVEL_THRESHOLDS;
    const current = t[lv] || 0;
    const next = t[lv + 1] || t[t.length - 1];
    if (next <= current) return 1;
    return (xp - current) / (next - current);
  }

  _calcLevel(xp) {
    const t = CONFIG.LEVEL_THRESHOLDS;
    for (let i = t.length - 1; i >= 0; i--) {
      if (xp >= t[i]) return i;
    }
    return 0;
  }

  /* v12: Apply daily diminishing returns to XP */
  _applyDailyDiminish(rawXP) {
    const brackets = CONFIG.DAILY_XP_BRACKETS;
    if (!brackets || !brackets.length) return rawXP;
    const earned = this.data.dailyXPEarned || 0;
    let remaining = rawXP;
    let effective = 0;
    let consumed = earned;
    for (const b of brackets) {
      if (remaining <= 0) break;
      if (consumed >= b.limit) continue; // already past this bracket
      const spaceInBracket = b.limit - consumed;
      const take = Math.min(remaining, spaceInBracket);
      effective += Math.round(take * b.rate);
      remaining -= take;
      consumed += take;
    }
    return Math.max(1, effective); // always at least 1 XP
  }

  /* Return today's daily XP info for UI display */
  getDailyXPInfo() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.data.dailyXPDate !== today) return { earned: 0, rate: 1.0 };
    const earned = this.data.dailyXPEarned || 0;
    const brackets = CONFIG.DAILY_XP_BRACKETS || [];
    let currentRate = 1.0;
    for (const b of brackets) {
      if (earned < b.limit) { currentRate = b.rate; break; }
      currentRate = b.rate;
    }
    return { earned, rate: currentRate };
  }

  /* ─── Competition progress ─── */
  getCompetitionLevel() { return this.data.competitionLevel || 0; }

  async completeCompetitionLevel(level, stars) {
    if (level >= (this.data.competitionLevel || 0)) {
      this.data.competitionLevel = level + 1;
    }
    if (!this.data.competitionStars) this.data.competitionStars = [];
    const prev = this.data.competitionStars[level] || 0;
    this.data.competitionStars[level] = Math.max(prev, stars);

    /* Unlock Ultra through competition (all 10 levels) */
    if (this.data.competitionLevel >= CONFIG.COMPETITION_LEVELS) {
      this.data.ultraUnlockedViaCompetition = true;
    }
    await this.save();
    return this.data.ultraUnlockedViaCompetition;
  }

  isUltraUnlockedViaCompetition() {
    return !!this.data.ultraUnlockedViaCompetition;
  }

  /* ─── Achievements (v20: template-based system) ─── */
  /**
   * Update achievement stats and check all template achievements.
   * @param {object} stats - game stats from GameEngine._buildStats() (extended)
   * @param {number} sessionGames - app.sessionGames count
   * @returns {string[]} array of newly-unlocked achievement IDs
   */
  checkAchievements(stats, sessionGames) {
    // Update accumulated stats for the achievement system
    updateAchStats(stats, this.data, sessionGames || 0);

    // Run the full template-based check
    const newlyUnlocked = checkAllAchievements(this.data);
    return newlyUnlocked;
  }

  /**
   * Get the localized name of an achievement by its id.
   * @param {string} id
   * @param {string} lang - 'de' or 'en'
   * @returns {string}
   */
  getAchievementName(id, lang) {
    const ach = getAchById(id);
    if (!ach) return id;
    return ach.name[lang || getLanguage()] || ach.name.en || id;
  }

  async addAchievement(id) {
    if (!this.data.achievements.includes(id)) {
      this.data.achievements.push(id);
      await this.save();
      return true;
    }
    return false;
  }

  /* ─── Settings ─── */
  getSetting(key) { return this.data.settings[key]; }
  async setSetting(key, val) { this.data.settings[key] = val; await this.save(); }

  /* ─── Mode instruction view tracking ─── */
  getInstructionViews(mode) { return (this.data.instructionViews || {})[mode] || 0; }
  async incrementInstructionViews(mode) {
    if (!this.data.instructionViews) this.data.instructionViews = {};
    this.data.instructionViews[mode] = (this.data.instructionViews[mode] || 0) + 1;
    await this.save();
  }

  /* ─── Getters ─── */
  getPB(mode)        { return this.data[`pb_${mode}`] || 0; }
  getEndlessPB(mode) { return this.data[`pb_endless_${mode}`] || 0; }
  getScores(mode)    { return this.data[`scores_${mode}`] || []; }
  getLevel()         { return this.data.level; }
  getTotalXP()       { return this.data.totalXP; }
  getGamesPlayed()   { return this.data.gamesPlayed; }
  getAchievements()  { return this.data.achievements; }

  getLevelName() {
    const lang = getLanguage();
    const names = lang === 'de' ? CONFIG.LEVEL_NAMES_DE : CONFIG.LEVEL_NAMES_EN;
    return names[this.data.level] || names[0];
  }

  getXPProgress() {
    const t = CONFIG.LEVEL_THRESHOLDS;
    const lvl = this.data.level;
    const current = this.data.totalXP - t[lvl];
    const needed = (t[lvl + 1] || t[lvl] * 2) - t[lvl];
    return { current, needed, pct: Math.min(1, current / needed) };
  }

  hasDailyToday() {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    // Also check ISO format for legacy entries
    const isoKey = d.toISOString().slice(0, 10);
    return !!(this.data.dailyChallenges[key] || this.data.dailyChallenges[isoKey]);
  }
  getDailyScore() {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    const isoKey = d.toISOString().slice(0, 10);
    return (this.data.dailyChallenges[key]?.score || this.data.dailyChallenges[isoKey]?.score || 0);
  }

  /* v17: Claim daily challenge rewards (lives + XP, streak-scaled) */
  async claimDailyReward() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.data._lastDailyRewardDate === today) return null;
    this.data._lastDailyRewardDate = today;
    const livesReward = CONFIG.DAILY_REWARD_LIVES || 2;
    const baseXP = CONFIG.DAILY_REWARD_XP || 100;
    const streak = this.data.loginStreak || 0;
    const bonusXP = Math.min(streak * (CONFIG.DAILY_STREAK_XP_BONUS || 25), 250);
    const xpReward = baseXP + bonusXP;
    await this.addLives(livesReward);
    this.data.totalXP += xpReward;
    const oldLevel = this.data.level;
    this.data.level = this._calcLevel(this.data.totalXP);
    if (this.data.level > oldLevel) {
      this.data.lives = Math.min((this.data.lives || 0) + CONFIG.LIVES_LEVEL_UP, CONFIG.LIVES_MAX);
    }
    await this.save();
    return { lives: livesReward, xp: xpReward, bonusXP };
  }

  /* ─── Mode unlock check (v6: competition-gate for Ultra) ─── */
  isModeUnlocked(mode) {
    if (mode === 'klassik')  return true;
    if (mode === 'beginner') return true;
    if (mode === 'mathe')    return this.data.level >= (CONFIG.UNLOCK_MATHE || 0);
    if (mode === 'worte')    return this.data.level >= (CONFIG.UNLOCK_WORTE || 0);
    if (mode === 'memo')     return this.data.level >= (CONFIG.UNLOCK_MEMO || 0);
    if (mode === 'sequenz')  return this.data.level >= (CONFIG.UNLOCK_SEQUENZ || 0);
    if (mode === 'expert')   return this.data.level >= CONFIG.UNLOCK_EXPERT;
    if (mode === 'ultra')    return this.data.level >= CONFIG.UNLOCK_ULTRA || this.data.ultraUnlockedViaCompetition;
    if (mode === 'stroop')   return this.data.level >= (CONFIG.UNLOCK_STROOP || 0);
    if (mode === 'fokus')    return this.data.level >= (CONFIG.UNLOCK_FOKUS || 0);
    if (mode === 'chaos')    return this.data.level >= (CONFIG.UNLOCK_CHAOS || 0);
    if (mode === 'hauptstaedte') return this.data.level >= (CONFIG.UNLOCK_HAUPTSTAEDTE || 0);
    if (mode === 'algebra')  return this.data.level >= (CONFIG.UNLOCK_ALGEBRA || 0);
    return false;
  }

  isCompetitionUnlocked() {
    return this.data.level >= CONFIG.UNLOCK_COMPETITION && this.isModeUnlocked('expert');
  }

  /* ─── Lives / IAP (v5) ─── */
  getLives()       { return this.data.lives || 0; }
  async useLive()  { if (this.data.lives > 0) { this.data.lives--; await this.save(); return true; } return false; }
  async addLives(n) { this.data.lives = Math.min((this.data.lives || 0) + n, CONFIG.LIVES_MAX); await this.save(); }
  hasPurchase(id)  { return !!this.data.purchases[id]; }
  async setPurchase(id) { this.data.purchases[id] = true; await this.save(); }

  /* ─── Avatar (v7) ─── */
  getAvatar() {
    const a = this.data.avatar || { icon: 'circle', colorIndex: 0 };
    // Include photo from separate key (too large for avatar object in some saves)
    if (this.data.avatarPhoto) a.photo = this.data.avatarPhoto;
    return a;
  }
  async setAvatar(icon, colorIndex) {
    this.data.avatar = { icon, colorIndex };
    await this.save();
  }
  async setAvatarPhoto(base64) {
    this.data.avatarPhoto = base64;
    await this.save();
  }
  async removeAvatarPhoto() {
    delete this.data.avatarPhoto;
    await this.save();
  }

  /* ─── Daily Login / Lives Earning (v11) ─── */
  async claimDailyLogin() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.data.lastLoginDate === today) return null; // already claimed

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const isConsecutive = this.data.lastLoginDate === yesterday;
    const oldStreak = this.data.loginStreak || 0;
    const newStreak = isConsecutive ? oldStreak + 1 : 1;

    this.data.lastLoginDate = today;
    this.data.loginStreak = newStreak;

    let livesAwarded = CONFIG.LIVES_DAILY_LOGIN;
    let streakBonus = 0;
    if (newStreak >= 7 && newStreak % 7 === 0) {
      streakBonus = 2;
    } else if (newStreak >= 3 && newStreak % 3 === 0) {
      streakBonus = 1;
    }
    livesAwarded += streakBonus;

    this.data.lives = Math.min((this.data.lives || 0) + livesAwarded, CONFIG.LIVES_MAX);

    /* v23: Award fire on daily login (streak × 5) */
    const fireLogin = newStreak * 5;
    this.data.fire = (this.data.fire || 0) + fireLogin;

    await this.save();
    return { livesAwarded, streak: newStreak, streakBonus };
  }

  getDailyLoginStreak() {
    return this.data.loginStreak || 0;
  }

  async awardLevelUpLife() {
    this.data.lives = Math.min((this.data.lives || 0) + CONFIG.LIVES_LEVEL_UP, CONFIG.LIVES_MAX);
    await this.save();
  }

  /* ─── Fire Currency (v23) ─── */
  getFireBalance() { return this.data.fire || 0; }
  async addFire(n) {
    this.data.fire = (this.data.fire || 0) + Math.max(0, Math.floor(n));
    await this.save();
  }
  async spendFire(n) {
    const cost = Math.max(0, Math.floor(n));
    if ((this.data.fire || 0) < cost) return false;
    this.data.fire -= cost;
    await this.save();
    return true;
  }

  /* ─── Themes / Trails (v11) ─── */
  getActiveTheme() { return this.data.activeTheme || 'default'; }
  getActiveTrail()  { return this.data.activeTrail || 'default'; }

  async setActiveTheme(id) {
    const theme = CONFIG.THEMES.find(t => t.id === id);
    if (!theme || this.data.level < theme.unlockLevel) return false;
    this.data.activeTheme = id;
    await this.save();
    return true;
  }

  async setActiveTrail(id) {
    const trail = CONFIG.TRAILS.find(t => t.id === id);
    if (!trail || this.data.level < trail.unlockLevel) return false;
    this.data.activeTrail = id;
    await this.save();
    return true;
  }

  getUnlockedThemes() {
    return CONFIG.THEMES.filter(t => this.data.level >= t.unlockLevel).map(t => t.id);
  }

  getUnlockedTrails() {
    return CONFIG.TRAILS.filter(t => this.data.level >= t.unlockLevel).map(t => t.id);
  }
}
