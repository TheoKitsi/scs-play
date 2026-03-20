/* ═══════════════════════════════════════
   SCS Play — Results Screen
   Score display, stats, XP, continue, achievements.
   ═══════════════════════════════════════ */
import { CONFIG }           from '../config.js';
import { t, getLanguage }    from '../i18n.js';
import { $, setText, showScreen } from '../helpers/dom.js';
import { haptic }           from '../helpers/haptics.js';
import { showAdInterstitial, isAdFree } from '../services/AdService.js';
import app                   from '../appState.js';
import { getBodyFx, updateXPBar } from './HomeScreen.js';
import { maybeShowFeedback } from '../helpers/microFeedback.js';
import { generateAchievements, getProgress } from '../achievements/AchievementSystem.js';

let _lastRetryKey = '';

/* Determine if the last game was "good" (score above mode average) */
export function wasLastGameGood() {
  const stats = app.lastResultStats;
  if (!stats) return false;
  const scores = app.save.getScores(stats.mode || app.selectedMode);
  if (scores.length < 2) return stats.accuracy >= 60;
  const avg = scores.reduce((s, sc) => s + sc.score, 0) / scores.length;
  return stats.score >= avg;
}

export function updateLivesDisplay() {
  const val = app.save.getLives();
  const hud = $('#homeLivesCount');
  const shop = $('#shopLivesCount');
  if (hud) hud.textContent = val;
  if (shop) shop.textContent = val;
}

export async function showResults(stats, canContinue = false) {
  const { save, audio, effects, engagement } = app;
  app.lastResultStats = stats;

  if (!canContinue) {
    app.sessionGames++;
    await showAdInterstitial(save, app.sessionGames);

    /* Engagement: track game end + mode/playType adoption */
    if (engagement) {
      engagement.trackGameEnd();
      engagement.trackModePlay(stats.mode);
      engagement.trackPlayType(stats.playType || 'blitz');
      if (stats.isDaily) engagement.trackDailyChallenge();
    }
  }

  showScreen('results', app);
  if (engagement) engagement.markResultsShown();
  if (stats.score > app.sessionBest) app.sessionBest = stats.score;

  /* v19: Victory jingle based on performance tier */
  if (!canContinue && typeof audio.victoryJingle === 'function') {
    const tier = stats.accuracy >= 95 && stats.score >= 5000 ? 3
      : stats.accuracy >= 80 && stats.score >= 2000 ? 2
      : stats.accuracy >= 60 ? 1 : 0;
    audio.victoryJingle(tier);
  }

  let isNewPB = false, leveledUp = false, unlocked = [], fireEarned = 0;
  if (!canContinue) {
    ({ isNewPB, leveledUp, fireEarned } = await save.addScore(stats));
    fireEarned = fireEarned || 0;
    unlocked = save.checkAchievements(stats, app.sessionGames);
    if (unlocked.length) await save.save();

    if (stats.isDaily) {
      const reward = await save.claimDailyReward();
      setTimeout(() => {
        const fx = getBodyFx();
        fx.achievementToast(t('daily_reward_earned', { l: reward.lives, x: reward.xp }));
      }, 1500);
    }
  }

  const headingEl = $('[data-i18n="game_over"]');
  if (headingEl) {
    if (stats.isDaily) {
      headingEl.textContent = t('daily_complete');
    } else {
      headingEl.textContent = stats.playType === 'endless' ? t('endless_over') : t('game_over');
    }
  }

  /* Daily Challenge banner in results */
  let dailyBanner = $('#resDailyBanner');
  if (stats.isDaily && !canContinue) {
    if (!dailyBanner) {
      dailyBanner = document.createElement('div');
      dailyBanner.id = 'resDailyBanner';
      dailyBanner.className = 'results-daily-banner';
      const resultsContent = $('#results .results-card, #results .results-content, #results > div');
      const insertTarget = $('[data-i18n="game_over"]');
      if (insertTarget && insertTarget.parentElement) {
        insertTarget.parentElement.insertBefore(dailyBanner, insertTarget.nextSibling);
      }
    }
    dailyBanner.innerHTML = `<span class="daily-banner-icon">🌟</span><span class="daily-banner-text">${t('daily_reward_summary')}</span>`;
    dailyBanner.style.display = '';
  } else if (dailyBanner) {
    dailyBanner.style.display = 'none';
  }

  const phase2 = $('#resPhase2');
  const phase3 = $('#resPhase3');
  if (phase2) { phase2.classList.add('results-phase-hidden'); phase2.classList.remove('results-phase-visible'); }
  if (phase3) { phase3.classList.add('results-phase-hidden'); phase3.classList.remove('results-phase-visible'); }

  const scoreEl = $('#resScore');
  if (scoreEl) scoreEl.classList.remove('score-complete');
  if (scoreEl && effects && typeof effects.scoreCountUp === 'function') {
    /* v19: Audio ticks during score count-up */
    const tickFn = typeof audio.scoreCountTick === 'function'
        ? (progress) => {
            audio.scoreCountTick(progress);
            if (progress > 0.1 && Math.random() > 0.5) haptic('tap', app.save);
        }
        : null;
      effects.scoreCountUp(scoreEl, 0, stats.score, CONFIG.RESULTS_COUNTUP_MS, tickFn);
      setTimeout(() => scoreEl.classList.add('score-complete'), CONFIG.RESULTS_COUNTUP_MS + 50);
  } else {
    setText('#resScore', stats.score.toLocaleString());
    if (scoreEl) scoreEl.classList.add('score-complete');
  }

  setText('#resBestStreak', stats.streak);
  setText('#resAccuracy', stats.accuracy + '%');
  setText('#resAvgReaction', stats.avgReaction + t('ms'));
  setText('#resCorrect', `${stats.correct} / ${stats.total}`);
  setText('#resStreakBonus', '+' + stats.streakBonus);
  setText('#resAccBonus', '+' + stats.accBonus);

  /* v21: Enhanced stat displays */
  const bonusEl = $('#resBonusExtra');
  if (bonusEl) {
    const parts = [];
    if (stats.isPerfectRound) parts.push(t('perfect_bonus', { n: stats.perfectBonus }));
    if (stats.lightningCount > 0) parts.push(t('lightning_bonus', { n: stats.lightningBonus, c: stats.lightningCount }));
    if (stats.isWeekend) parts.push(t('weekend_xp_info'));
    bonusEl.textContent = parts.join(' \u2022 ');
    bonusEl.style.display = parts.length > 0 ? 'block' : 'none';
  }
  const perfectEl = $('#resPerfectRound');
  if (perfectEl) {
    perfectEl.style.display = stats.isPerfectRound ? 'block' : 'none';
    if (stats.isPerfectRound) perfectEl.textContent = t('perfect_round');
  }
  const bestReactEl = $('#resBestReaction');
  if (bestReactEl && stats.bestReactionTime > 0) {
    bestReactEl.textContent = stats.bestReactionTime + t('ms');
  }

  const modeLabel = t(app.selectedMode) || app.selectedMode;
  const playLabel = t(`play_${stats.playType || app.selectedPlayType}`) || '';
  setText('#resMode', `${modeLabel} \u2022 ${playLabel}`);
  setText('#resXP', t('xp_earned', { n: stats.xp }));

  /* Fire earned display */
  const fireEl = $('#resFireEarned');
  if (fireEl) {
    if (fireEarned > 0) {
      fireEl.textContent = t('fire_earned', { n: fireEarned });
      fireEl.style.display = '';
    } else {
      fireEl.style.display = 'none';
    }
  }

  const prog = save.getXPProgress();
  setText('#resNextLevel', t('next_level', { n: prog.needed - prog.current }));
  const xpBar = $('#resXPBar');
  if (xpBar) xpBar.style.width = (prog.pct * 100) + '%';

  /* v25: Per-mode level display */
  const modeLvEl = $('#resModeLevelInfo');
  if (modeLvEl) {
    const modeKey = stats.mode || app.selectedMode;
    const modeLvName = save.getModeLevelName(modeKey, getLanguage());
    const modeLvProgress = save.getModeLevelProgress(modeKey);
    const modeLv = save.getModeLevel(modeKey);
    modeLvEl.innerHTML = `<span class="mode-level-label">${modeLabel} Lv.${modeLv}</span> <span class="mode-level-name">${modeLvName}</span>`;
    modeLvEl.style.display = '';
    const modeLvBar = $('#resModeLevelBar');
    if (modeLvBar) modeLvBar.style.width = (modeLvProgress * 100) + '%';
  }

  setText('#resSession', t('session_games', { n: app.sessionGames }));
  setText('#resBestToday', t('best_today', { n: app.sessionBest }));

  const compEl = $('#resCompResult');
  if (compEl) {
    if (stats.playType === 'competition') {
      compEl.style.display = 'block';
      const target = CONFIG.COMPETITION_SCORE_TARGETS[stats.competitionLevel] || 2000;
      compEl.textContent = stats.score >= target ? t('competition_complete') : t('competition_failed');
      compEl.classList.toggle('comp-success', stats.score >= target);
      compEl.classList.toggle('comp-fail', stats.score < target);
    } else {
      compEl.style.display = 'none';
    }
  }

  /* Continue section */
  const resContinue = $('#resContinue');
  const resNormalBtns = $('#resNormalBtns');
  if (canContinue) {
    if (resNormalBtns) resNormalBtns.style.display = 'none';
    if (resContinue) {
      resContinue.style.display = 'block';
      setText('#resContinueDesc', t('continue_desc', { n: CONFIG.CONTINUE_EXTRA_TIME }));
      const lives = save.getLives();
      const btnUse = $('#btnResContinueUse');
      const btnBuy = $('#btnResContinueBuy');
      const btnAd  = $('#btnResContinueAd');
      if (lives > 0) {
        if (btnUse) { btnUse.style.display = ''; btnUse.textContent = `${t('continue_btn')} (${t('continue_lives', { n: lives })})`; }
        if (btnBuy) btnBuy.style.display = 'none';
        if (btnAd)  btnAd.style.display = 'none';
      } else {
        if (btnUse) btnUse.style.display = 'none';
        if (btnBuy) btnBuy.style.display = '';
        if (btnAd)  btnAd.style.display = isAdFree(save) ? 'none' : '';
      }
    }
  } else {
    if (resContinue) resContinue.style.display = 'none';
    if (resNormalBtns) resNormalBtns.style.display = '';
  }

  const pbEl = $('#resPB');
  if (pbEl) {
    pbEl.style.display = isNewPB ? 'block' : 'none';
    if (isNewPB) {
      pbEl.textContent = t('new_pb');
      audio.newPB();
      haptic('newPB', save);
      getBodyFx().pbCelebration();
    }
  }

  if (leveledUp) {
    audio.levelUp();
    haptic('levelUp', save);
    const lvlEl = $('#resLevelUp');
    if (lvlEl) { lvlEl.style.display = 'block'; lvlEl.textContent = `${t('level_up')} ${save.getLevelName()}`; }
    setTimeout(() => {
      const fx = getBodyFx();
      fx.levelUpCelebration();
      fx.achievementToast(t('lives_earned_levelup'));
      updateLivesDisplay();
    }, 2000);
  } else {
    const lvlEl = $('#resLevelUp');
    if (lvlEl) lvlEl.style.display = 'none';
  }

  const bodyFx = getBodyFx();
  const countupDuration = CONFIG.RESULTS_COUNTUP_MS || 1200;
  const maxToasts = 3;
  const toastSlice = unlocked.slice(0, maxToasts);
  const achBaseDelay = countupDuration + (CONFIG.RESULTS_STATS_DELAY || 400) + 600;
  toastSlice.forEach((id, i) => {
    const achName = save.getAchievementName(id) || id;
    setTimeout(() => { bodyFx.achievementToast(`${t('achievement')} ${achName}`); audio.achievementUnlock(); haptic('diamond', app.save); }, achBaseDelay + i * 1500);
  });
  if (unlocked.length > maxToasts) {
    const extra = unlocked.length - maxToasts;
    setTimeout(() => { bodyFx.achievementToast(t('more_achievements', { n: extra })); }, achBaseDelay + maxToasts * 1500);
  }

  setText('#oneMoreText', t('retry'));
  /* v19: Randomize retry button text for freshness (avoid repeats) */
  const retryVariants = ['retry', 'retry_2', 'retry_3', 'retry_4', 'retry_5'];
  let retryKey;
  do {
    retryKey = retryVariants[Math.floor(Math.random() * retryVariants.length)];
  } while (retryKey === _lastRetryKey && retryVariants.length > 1);
  _lastRetryKey = retryKey;
  const retryText = t(retryKey);
  if (retryText && retryText !== retryKey) setText('#oneMoreText', retryText);

  updateXPBar();

  /* v19: Animate XP ring SVG in results */
  const xpRingFill = $('#resXPRingFill');
  if (xpRingFill) {
    const circumference = 2 * Math.PI * 65; /* r=65 in SVG */
    xpRingFill.style.strokeDasharray = circumference;
    xpRingFill.style.strokeDashoffset = circumference;
    xpRingFill.classList.remove('animated');
    const targetOffset = circumference * (1 - prog.pct);
    xpRingFill.style.setProperty('--ring-target', targetOffset);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { xpRingFill.classList.add('animated'); });
    });
  }

  setTimeout(() => { if (phase2) phase2.classList.add('results-phase-visible'); },
    countupDuration + (CONFIG.RESULTS_STATS_DELAY || 400));
  setTimeout(() => { if (phase3) phase3.classList.add('results-phase-visible'); },
    countupDuration + (CONFIG.RESULTS_STATS_DELAY || 400) + (CONFIG.RESULTS_BUTTONS_DELAY || 800));

  /* ─── MicroFeedback trigger (delayed to not clash with animations) ─── */
  if (!canContinue && engagement) {
    const feedbackDelay = countupDuration + 2500;
    setTimeout(() => {
      const ctx = { mode: stats.mode || app.selectedMode, score: stats.score, sessionGame: app.sessionGames };
      if (isNewPB)           maybeShowFeedback('pb', ctx);
      else if (leveledUp)    maybeShowFeedback('levelup', ctx);
      else if (app.sessionGames % 10 === 0) maybeShowFeedback('sampling', ctx);
      else if (app.sessionGames === 3) maybeShowFeedback('streak', ctx);
    }, feedbackDelay);
  }

  /* Achievement progress teasers (show after phase 2 loads) */
  if (!canContinue) {
    setTimeout(() => renderAchTeasers(save), countupDuration + (CONFIG.RESULTS_STATS_DELAY || 400) + 200);
  }
}

/* ═══════ Achievement progress teasers (cached) ═══════ */
let _achTeaserCache = '';
let _achTeaserCacheKey = '';

function renderAchTeasers(save) {
  const el = $('#resAchTeasers');
  if (!el) return;

  /* Cache by earned count + games played to avoid re-computing 1000+ achievements */
  const cacheKey = `${save.getAchievements().length}_${save.data.gamesPlayed || 0}`;
  if (_achTeaserCache && _achTeaserCacheKey === cacheKey) {
    el.innerHTML = _achTeaserCache;
    return;
  }

  const allAchs = generateAchievements();
  const earned = new Set(save.getAchievements());
  const saveData = save.data;

  /* Find unearned achievements with highest progress (>30%, <100%) */
  const candidates = [];
  for (const ach of allAchs) {
    if (earned.has(ach.id)) continue;
    const prog = getProgress(ach, saveData);
    if (prog.pct > 0.3 && prog.pct < 1) {
      candidates.push({ ach, prog });
    }
  }

  if (candidates.length === 0) { el.innerHTML = ''; _achTeaserCache = ''; _achTeaserCacheKey = cacheKey; return; }

  /* Sort by progress descending, pick top 2 */
  candidates.sort((a, b) => b.prog.pct - a.prog.pct);
  const top = candidates.slice(0, 2);

  const html = `<span class="res-ach-teasers-title">${t('ach_almost') || 'Fast geschafft!'}</span>` +
    top.map(({ ach, prog }) => {
      const name = save.getAchievementName(ach.id);
      const pctRound = Math.round(prog.pct * 100);
      return `<div class="res-ach-teaser">
        <span class="res-ach-teaser-name">${name}</span>
        <div class="res-ach-teaser-bar"><div class="res-ach-teaser-fill" style="width:${pctRound}%"></div></div>
        <span class="res-ach-teaser-pct">${pctRound}%</span>
      </div>`;
    }).join('');
  el.innerHTML = html;
  _achTeaserCache = html;
  _achTeaserCacheKey = cacheKey;
}

/* ═══════ Continue / Decline ═══════ */
export function showContinuePrompt(stats) {
  const { audio } = app;
  audio.stopMusic();
  if (typeof audio.stopTension === 'function') audio.stopTension();
  app.continueStats = stats;
  showResults(stats, true);
}

export async function doContinue() {
  const { save, game, audio } = app;
  const ok = await save.useLive();
  if (!ok) return;
  app.continueStats = null;
  showScreen('game', app);
  game.continueGame();
  audio.startMusic();
  updateLivesDisplay();
}

export function declineContinue() {
  app.continueStats = null;
  app.game.declineContinue();
}
