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
import { updateXPBar }      from '../helpers/xpBarHelper.js';
import { updateLivesDisplay } from '../helpers/livesDisplayHelper.js';
import { getBodyFx }        from '../services/EffectsService.js';
import { maybeShowFeedback } from '../helpers/microFeedback.js';
import { generateAchievements, getProgress } from '../achievements/AchievementSystem.js';
import { getKlassikInsights, getFormenInsights, getExpertInsights, getUltraInsights, getMatheInsights, getAlgebraInsights, getWorteInsights, getHauptstaedteInsights, getWissenInsights, getMemoInsights, getSequenzInsights, getStroopInsights, getFokusInsights, getChaosInsights } from '../game/ModeMastery.js';
import { recordGameResult as recordQuestProgress, autoClaim as autoClaimQuests } from '../services/DailyQuestService.js';
import { recordGamePoint as recordPassGamePoint, addBonusPoints as addPassBonusPoints } from '../services/SeasonPass.js';

let _lastRetryKey = '';

function ensureReplayHook() {
  let el = $('#resNextHook');
  if (el) return el;
  const buttons = $('#resNormalBtns');
  if (!buttons || !buttons.parentElement) return null;
  el = document.createElement('div');
  el.id = 'resNextHook';
  el.className = 'results-next-hook';
  buttons.parentElement.insertBefore(el, buttons);
  return el;
}

/**
 * Ensure a Near-Miss pill exists in the results panel.
 * Sits just above the action buttons in #resPhase3 so it
 * lands inside the player's eye-line when the buttons reveal.
 */
function ensureNearMissPill() {
  let el = $('#resNearMiss');
  if (el) return el;
  const buttons = $('#resNormalBtns');
  if (!buttons || !buttons.parentElement) return null;
  el = document.createElement('div');
  el.id = 'resNearMiss';
  el.className = 'results-near-miss';
  el.setAttribute('role', 'status');
  el.style.display = 'none';
  buttons.parentElement.insertBefore(el, buttons);
  return el;
}

/**
 * Compute near-miss state. Returns null when not close enough,
 * otherwise { gap, target, kind } where kind ∈ {pb, session}.
 */
function computeNearMiss(score, sessionBest, allTimePB) {
  if (!score || score <= 0) return null;
  const candidates = [];
  if (allTimePB > score) {
    const gap = allTimePB - score;
    const threshold = Math.max(50, Math.round(allTimePB * 0.10));
    if (gap <= threshold) candidates.push({ gap, target: allTimePB, kind: 'pb' });
  }
  if (sessionBest > score) {
    const gap = sessionBest - score;
    const threshold = Math.max(50, Math.round(sessionBest * 0.10));
    if (gap <= threshold) candidates.push({ gap, target: sessionBest, kind: 'session' });
  }
  if (!candidates.length) return null;
  /* Prefer the smaller gap so the player sees the most achievable target. */
  candidates.sort((a, b) => a.gap - b.gap);
  return candidates[0];
}

function getRemainingToNextLevel(xp, level) {
  const thresholds = CONFIG.LEVEL_THRESHOLDS;
  const current = thresholds[level] || 0;
  const next = thresholds[level + 1] || thresholds[thresholds.length - 1] || current;
  if (next <= current) return 0;
  return Math.max(0, next - xp);
}

function getReplayHook(save, stats, modeLabel) {
  if (stats.playType === 'competition') {
    const target = CONFIG.COMPETITION_SCORE_TARGETS[stats.competitionLevel] || 2000;
    if (stats.score < target) {
      return {
        text: t('next_goal_competition_push', { n: target - stats.score }),
        tone: 'competition',
      };
    }
  }

  const modeKey = stats.mode || app.selectedMode;
  const modeXP = save.getModeXP(modeKey);
  const modeLevel = save.getModeLevel(modeKey);
  const remainingModeXP = getRemainingToNextLevel(modeXP, modeLevel);
  if (remainingModeXP > 0 && remainingModeXP <= 220) {
    return {
      text: t('next_goal_mode_level', { mode: modeLabel, n: remainingModeXP, level: modeLevel + 1 }),
      tone: 'level',
    };
  }

  const sessionDiff = app.sessionBest - stats.score;
  if (app.sessionBest > stats.score && sessionDiff <= Math.max(180, Math.round(app.sessionBest * 0.16))) {
    return {
      text: t('next_goal_session_best', { n: sessionDiff }),
      tone: 'flow',
    };
  }

  if (stats.isDaily || stats.accuracy >= 85 || stats.streak >= 12) {
    return {
      text: t('next_goal_keep_flow'),
      tone: 'flow',
    };
  }

  return null;
}

/* Determine if the last game was "good" (score above mode average) */
export function wasLastGameGood() {
  const stats = app.lastResultStats;
  if (!stats) return false;
  const scores = app.save.getScores(stats.mode || app.selectedMode);
  if (scores.length < 2) return stats.accuracy >= 60;
  const avg = scores.reduce((s, sc) => s + sc.score, 0) / scores.length;
  return stats.score >= avg;
}

export async function showResults(stats, canContinue = false) {
  const { save, audio, effects, engagement } = app;
  app.lastResultStats = stats;

  if (!canContinue) {
    app.sessionGames++;

    /* Engagement: track game end + mode/playType adoption */
    if (engagement) {
      engagement.trackGameEnd();
      engagement.trackModePlay(stats.mode);
      engagement.trackPlayType(stats.playType || 'blitz');
      if (stats.isDaily) engagement.trackDailyChallenge();
    }
  }

  showScreen('results', app);
  if (!canContinue) {
    void showAdInterstitial(save, app.sessionGames);
  }
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

    /* v60 Welle 4: Daily quest progress + Season Pass points */
    try {
      const completed = recordQuestProgress(save, stats);
      recordPassGamePoint(save);
      if (completed && completed.length) {
        const claim = autoClaimQuests(save);
        if (claim.xp)   { save.data.totalXP = (save.data.totalXP || 0) + claim.xp; }
        if (claim.fire) { save.data.fire    = (save.data.fire    || 0) + claim.fire; }
        addPassBonusPoints(save, completed.length);
        const fx = getBodyFx();
        const lang = getLanguage();
        completed.forEach((q, i) => {
          setTimeout(() => {
            try {
              const label = (typeof t === 'function') ? t('quest_complete_toast', { n: q.target, xp: q.rewardXP, fire: q.rewardFire }) : 'Quest!';
              fx.achievementToast(label);
            } catch {}
          }, 1800 + i * 700);
        });
      }
      await save.save();
    } catch (e) { console.warn('quest/pass hook failed', e); }

    if (stats.isDaily) {
      const reward = await save.claimDailyReward();
      if (reward) {
        setTimeout(() => {
          const fx = getBodyFx();
          fx.achievementToast(t('daily_reward_earned', { l: reward.lives, x: reward.xp }));
        }, 1500);
      }
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

  /* Tier-colored ring: tint based on accuracy */
  const tier = stats.accuracy >= 95 && stats.score >= 5000 ? 3
    : stats.accuracy >= 80 && stats.score >= 2000 ? 2
    : stats.accuracy >= 60 ? 1 : 0;
  const ringColors = ['#EF4444', '#F59E0B', '#7C3AED', '#2DD4BF'];
  const ringEl = $('#resXPRingFill');
  if (ringEl) {
    ringEl.style.stroke = ringColors[tier];
    ringEl.style.filter = `drop-shadow(0 0 12px ${ringColors[tier]})`;
  }

  /* Dramatic ring entrance */
  const xpRing = $('.results-xp-ring');
  if (xpRing) {
    xpRing.classList.remove('ring-entrance');
    requestAnimationFrame(() => xpRing.classList.add('ring-entrance'));
  }

  const phase2 = $('#resPhase2');
  const phase3 = $('#resPhase3');
  if (phase2) { phase2.classList.add('results-phase-hidden'); phase2.classList.remove('results-phase-visible'); }
  if (phase3) { phase3.classList.add('results-phase-hidden'); phase3.classList.remove('results-phase-visible'); }

  /* Reset transient state from previous results pass */
  const prevOneMore = $('#btnOneMore');
  if (prevOneMore) prevOneMore.classList.remove('cta-pulse');

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
  const statsDelay = CONFIG.RESULTS_STATS_DELAY || 400;
  const buttonsDelay = CONFIG.RESULTS_BUTTONS_DELAY || 800;
  const maxToasts = 3;
  const toastSlice = unlocked.slice(0, maxToasts);
  const achBaseDelay = countupDuration + statsDelay + 260;
  toastSlice.forEach((id, i) => {
    const achName = save.getAchievementName(id) || id;
    setTimeout(() => { bodyFx.achievementToast(`${t('achievement')} ${achName}`); audio.achievementUnlock(); haptic('diamond', app.save); }, achBaseDelay + i * 1500);
  });
  if (unlocked.length > maxToasts) {
    const extra = unlocked.length - maxToasts;
    setTimeout(() => { bodyFx.achievementToast(t('more_achievements', { n: extra })); }, achBaseDelay + maxToasts * 1500);
  }

  /* Close-to-PB motivator */
  const closePBEl = $('#resCloseToePB');
  if (!canContinue && !isNewPB) {
    const currentPB = save.getPB(stats.mode || app.selectedMode);
    if (currentPB > 0 && stats.score > 0) {
      const diff = currentPB - stats.score;
      const threshold = Math.max(currentPB * 0.15, 100);
      if (diff > 0 && diff <= threshold) {
        const motivEl = closePBEl || (() => {
          const el = document.createElement('div');
          el.id = 'resCloseToePB';
          el.className = 'results-close-pb';
          const pbContainer = $('#resPB');
          if (pbContainer && pbContainer.parentElement) {
            pbContainer.parentElement.insertBefore(el, pbContainer.nextSibling);
          }
          return el;
        })();
        if (motivEl) {
          motivEl.textContent = t('close_to_pb', { n: diff }) || `Nur ${diff} Punkte von deinem PB!`;
          motivEl.style.display = '';
        }
      } else if (closePBEl) {
        closePBEl.style.display = 'none';
      }
    } else if (closePBEl) {
      closePBEl.style.display = 'none';
    }
  } else if (closePBEl) {
    closePBEl.style.display = 'none';
  }

  const replayHookEl = ensureReplayHook();
  const replayHook = !canContinue ? getReplayHook(save, stats, modeLabel) : null;
  if (replayHookEl) {
    if (replayHook?.text) {
      replayHookEl.textContent = replayHook.text;
      replayHookEl.className = `results-next-hook is-${replayHook.tone || 'flow'}`;
      replayHookEl.style.display = '';
    } else {
      replayHookEl.textContent = '';
      replayHookEl.className = 'results-next-hook';
      replayHookEl.style.display = 'none';
    }
  }

  /* ── Near-Miss pill — strong dopamine "one more game" hook ──
     Only when not in continue prompt and not a new PB (the new PB
     celebration owns the spotlight in that case). */
  const nearMissEl = ensureNearMissPill();
  if (nearMissEl) {
    if (!canContinue && !isNewPB) {
      const allTimePB = save.getPB(stats.mode || app.selectedMode) || 0;
      const nm = computeNearMiss(stats.score, app.sessionBest, allTimePB);
      if (nm) {
        const labelKey = nm.kind === 'pb' ? 'near_miss_pb' : 'near_miss_session';
        const fallback = nm.kind === 'pb'
          ? `Nur noch <span class="nm-num">${nm.gap}</span> bis zum neuen Rekord!`
          : `Nur noch <span class="nm-num">${nm.gap}</span> bis zum Tagesbest!`;
        let label = t(labelKey, { n: nm.gap });
        if (!label || label === labelKey) label = fallback;
        nearMissEl.innerHTML = `<span class="nm-spark" aria-hidden="true">⚡</span><span>${label}</span>`;
        nearMissEl.style.display = '';
      } else {
        nearMissEl.style.display = 'none';
        nearMissEl.innerHTML = '';
      }
    } else {
      nearMissEl.style.display = 'none';
      nearMissEl.innerHTML = '';
    }
  }

  /* Retry button glow pulse */
  const retryBtn = $('#btnOneMore');
  if (retryBtn) {
    retryBtn.classList.remove('retry-glow');
    const countupDone = countupDuration + statsDelay + buttonsDelay + 220;
    setTimeout(() => retryBtn.classList.add('retry-glow'), countupDone);
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
    countupDuration + statsDelay);
  setTimeout(() => { if (phase3) phase3.classList.add('results-phase-visible'); },
    countupDuration + statsDelay + buttonsDelay);

  /* Auto-pulse the Replay CTA once buttons are visible.
     Compositor-safe (transform only); css gates it for low-perf
     and reduced-motion in 12-polish-v18-v19.css. */
  const ctaPulseDelay = countupDuration + statsDelay + buttonsDelay + 600;
  setTimeout(() => {
    const btn = $('#btnOneMore');
    if (!btn) return;
    /* Only pulse when the normal buttons row is actually shown
       (not during a continue prompt). */
    const normalBtns = $('#resNormalBtns');
    if (!normalBtns || normalBtns.style.display === 'none') return;
    btn.classList.add('cta-pulse');
  }, ctaPulseDelay);

  /* ─── MicroFeedback trigger (delayed to not clash with animations) ─── */
  if (!canContinue && engagement) {
    const feedbackDelay = countupDuration + 1800;
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
    setTimeout(() => renderAchTeasers(save), countupDuration + statsDelay + 120);
  }

  /* Mode Mastery insights (show after stats phase) */
  if (!canContinue && app.mastery) {
    setTimeout(() => renderMasteryInsights(app.mastery, stats), countupDuration + statsDelay + 300);
  }
}

/* ═══════ Mode Mastery Insights ═══════ */
function renderMasteryInsights(mastery, stats) {
  let el = $('#resMasteryInsights');
  if (!el) {
    /* Create the container once, insert before achievement teasers */
    el = document.createElement('div');
    el.id = 'resMasteryInsights';
    el.className = 'results-mastery';
    const achTeasers = $('#resAchTeasers');
    const parent = achTeasers?.parentElement || $('#resPhase2');
    if (parent) {
      if (achTeasers) parent.insertBefore(el, achTeasers);
      else parent.appendChild(el);
    } else return;
  }

  const mode = stats.mode;
  let insights = [];

  if (mode === 'klassik') {
    insights = getKlassikInsights(mastery, stats);
  }
  if (mode === 'beginner') {
    insights = getFormenInsights(mastery, stats);
  }
  if (mode === 'expert') {
    insights = getExpertInsights(mastery, stats);
  }
  if (mode === 'ultra') {
    insights = getUltraInsights(mastery, stats);
  }
  if (mode === 'mathe') {
    insights = getMatheInsights(mastery, stats);
  }
  if (mode === 'algebra') {
    insights = getAlgebraInsights(mastery, stats);
  }
  if (mode === 'worte') {
    insights = getWorteInsights(mastery, stats);
  }
  if (mode === 'hauptstaedte') {
    insights = getHauptstaedteInsights(mastery, stats);
  }
  if (mode === 'wissen') {
    insights = getWissenInsights(mastery, stats);
  }
  if (mode === 'memo') {
    insights = getMemoInsights(mastery, stats);
  }
  if (mode === 'sequenz') {
    insights = getSequenzInsights(mastery, stats);
  }
  if (mode === 'stroop') {
    insights = getStroopInsights(mastery, stats);
  }
  if (mode === 'fokus') {
    insights = getFokusInsights(mastery, stats);
  }
  if (mode === 'chaos') {
    insights = getChaosInsights(mastery, stats);
  }
  /* Future modes will add their insight getters here */

  if (insights.length === 0) {
    el.style.display = 'none';
    return;
  }

  const lang = getLanguage();
  let html = `<div class="results-mastery-title">${lang === 'de' ? 'Mastery' : 'Mastery'}</div>`;

  for (const insight of insights) {
    switch (insight.type) {
      case 'speed-zones': {
        const d = insight.data;
        html += `<div class="mastery-speed-zones">`;
        if (d.ultra > 0) html += `<span class="mastery-zone-chip" data-zone="ultra"><span class="mastery-zone-count">${d.ultra}</span> ULTRA</span>`;
        if (d.fast > 0) html += `<span class="mastery-zone-chip" data-zone="fast"><span class="mastery-zone-count">${d.fast}</span> BLITZ</span>`;
        if (d.good > 0) html += `<span class="mastery-zone-chip" data-zone="good"><span class="mastery-zone-count">${d.good}</span> ${lang === 'de' ? 'SCHNELL' : 'FAST'}</span>`;
        html += `</div>`;
        break;
      }
      case 'flawless': {
        const d = insight.data;
        const newClass = d.isNew ? ' mastery-flawless-new' : '';
        html += `<div class="mastery-flawless">
          <span>${lang === 'de' ? 'Fehlerfrei' : 'Flawless'}:</span>
          <span class="mastery-flawless-value${newClass}">${d.current}</span>
          <span style="opacity:0.5">${lang === 'de' ? 'Rekord' : 'Best'}: ${d.best}</span>
          ${d.isNew ? `<span class="mastery-flawless-new">NEW</span>` : ''}
        </div>`;
        break;
      }
      case 'speed-trend': {
        const d = insight.data;
        const improving = d.trend > 0;
        const arrowClass = improving ? 'improving' : 'declining';
        const arrow = improving ? '\u2191' : '\u2193';
        /* Mini sparkline from reaction history */
        const hist = d.history.slice(-10);
        const maxR = Math.max(...hist, 1);
        const bars = hist.map(r => {
          const h = Math.max(2, Math.round((r / maxR) * 18));
          return `<div class="mastery-trend-bar" style="height:${h}px"></div>`;
        }).join('');
        html += `<div class="mastery-trend">
          <span class="mastery-trend-arrow ${arrowClass}">${arrow}</span>
          <span>${d.avg}ms avg</span>
          <span class="mastery-trend-sparkline">${bars}</span>
          <span style="opacity:0.5">${improving ? (lang === 'de' ? 'schneller!' : 'faster!') : ''}</span>
        </div>`;
        break;
      }
      case 'color-combo': {
        html += `<div class="mastery-color-combo">${lang === 'de' ? 'Farb-Kombo Rekord' : 'Color Combo Record'}: ${insight.data.best}x</div>`;
        break;
      }
      case 'zen': {
        const d = insight.data;
        const label = d.reachedThisGame
          ? (lang === 'de' ? 'ZEN STATE erreicht!' : 'ZEN STATE reached!')
          : (lang === 'de' ? `ZEN STATE: ${d.count}x erreicht` : `ZEN STATE: ${d.count}x reached`);
        html += `<div class="mastery-zen">${label}</div>`;
        break;
      }
      /* ── Formen (Beginner) insight types ── */
      case 'shape-grid': {
        const d = insight.data;
        const shapes = ['circle', 'square', 'triangle', 'star'];
        const shapeLabels = { circle: '\u25CF', square: '\u25A0', triangle: '\u25B2', star: '\u2605' };
        html += `<div class="mastery-shape-grid">`;
        for (let ci = 0; ci < 4; ci++) {
          for (const s of shapes) {
            const key = `${s}_${ci}`;
            const count = d.grid[key] || 0;
            const cls = count >= 10 ? 'filled-high' : count > 0 ? 'filled' : '';
            html += `<div class="mastery-shape-grid-cell ${cls}" title="${s} #${ci}: ${count}">${shapeLabels[s] || '?'}${count > 0 ? `<br>${count}` : ''}</div>`;
          }
        }
        html += `</div>`;
        html += `<div class="mastery-grid-progress">${d.filled} / ${d.max} ${lang === 'de' ? 'Kombinationen entdeckt' : 'combinations discovered'}</div>`;
        break;
      }
      case 'shape-chain': {
        html += `<div class="mastery-shape-chain">${lang === 'de' ? 'Form-Kette Rekord' : 'Shape Chain Record'}: ${insight.data.best}x</div>`;
        break;
      }
      case 'jackpot': {
        html += `<div class="mastery-jackpot">${lang === 'de' ? 'Jackpots' : 'Jackpots'}: ${insight.data.count}x</div>`;
        break;
      }
      case 'flow': {
        const d = insight.data;
        html += `<div class="mastery-flow">${lang === 'de' ? 'Bester Flow-Streak' : 'Best Flow Streak'}: ${d.bestStreak}x &middot; ${lang === 'de' ? 'Flow-Treffer' : 'Flow Hits'}: ${d.totalHits}</div>`;
        break;
      }
      /* ── Expert insight types ── */
      case 'direction-heatmap': {
        const d = insight.data;
        const dirLabels = { up:'\u2191', ur:'\u2197', right:'\u2192', dr:'\u2198', down:'\u2193', dl:'\u2199', left:'\u2190', ul:'\u2196' };
        html += `<div class="mastery-dir-heatmap">`;
        for (const dir of ['ul','up','ur','left','','right','dl','down','dr']) {
          if (dir === '') { html += `<div class="mastery-heatmap-center">\u2316</div>`; continue; }
          const info = d[dir] || { correct: 0, wrong: 0, bestRt: 0, stars: 0 };
          const total = info.correct + info.wrong;
          const acc = total > 0 ? Math.round(info.correct / total * 100) : 0;
          const heat = acc >= 90 ? 'hot' : acc >= 70 ? 'warm' : acc >= 50 ? 'cool' : total > 0 ? 'cold' : '';
          html += `<div class="mastery-heatmap-cell ${heat}" title="${dir}: ${acc}% (${info.correct}/${total})">
            <span class="heatmap-arrow">${dirLabels[dir]}</span>
            ${total > 0 ? `<span class="heatmap-acc">${acc}%</span>` : ''}
          </div>`;
        }
        html += `</div>`;
        break;
      }
      case 'compass-stars': {
        const d = insight.data;
        html += `<div class="mastery-compass-stars">`;
        html += `<span>${lang === 'de' ? 'Kompass' : 'Compass'}: ${d.totalStars} / ${d.maxStars} \u2605</span>`;
        html += `</div>`;
        break;
      }
      case 'full-compass': {
        html += `<div class="mastery-full-compass">${lang === 'de' ? 'Voller Kompass' : 'Full Compass'}: ${insight.data.count}x</div>`;
        break;
      }
      case 'speed-tiers': {
        const d = insight.data;
        const tierColors = { gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32' };
        const dirLabels = { up:'\u2191', ur:'\u2197', right:'\u2192', dr:'\u2198', down:'\u2193', dl:'\u2199', left:'\u2190', ul:'\u2196' };
        html += `<div class="mastery-speed-tiers">`;
        for (const [dir, tier] of Object.entries(d)) {
          if (tier) {
            html += `<span class="mastery-tier-badge" style="color:${tierColors[tier] || '#fff'}">${dirLabels[dir] || dir} ${tier}</span>`;
          }
        }
        html += `</div>`;
        break;
      }
      /* ── Ultra insight types ── */
      case 'ultra-heatmap': {
        const d = insight.data;
        const dirLabels = {
          up:'\u2191', nnw:'\u2196\u2191', ul:'\u2196', left:'\u2190', wsw:'\u2199\u2190', dl:'\u2199',
          down:'\u2193', sse:'\u2198\u2193', dr:'\u2198', right:'\u2192', ene:'\u2197\u2192', ur:'\u2197'
        };
        const clockOrder = ['up','ene','ur','right','dr','sse','down','wsw','dl','left','ul','nnw'];
        html += `<div class="mastery-ultra-heatmap">`;
        for (const dir of clockOrder) {
          const info = d[dir] || { correct: 0, wrong: 0, bestRt: 0, stars: 0 };
          const total = info.correct + info.wrong;
          const acc = total > 0 ? Math.round(info.correct / total * 100) : 0;
          const heat = acc >= 90 ? 'hot' : acc >= 70 ? 'warm' : acc >= 50 ? 'cool' : total > 0 ? 'cold' : '';
          html += `<div class="mastery-ultra-cell ${heat}" title="${dir}: ${acc}% (${info.correct}/${total})">
            <span class="ultra-cell-arrow">${dirLabels[dir] || dir}</span>
            ${total > 0 ? `<span class="ultra-cell-acc">${acc}%</span>` : ''}
          </div>`;
        }
        html += `</div>`;
        break;
      }
      case 'ultra-stars': {
        const d = insight.data;
        html += `<div class="mastery-ultra-stars">`;
        html += `<span>${lang === 'de' ? 'Ultra-Kompass' : 'Ultra Compass'}: ${d.totalStars} / ${d.maxStars} \u2605</span>`;
        html += `</div>`;
        break;
      }
      case 'ultra-full-compass': {
        html += `<div class="mastery-ultra-full-compass">${lang === 'de' ? 'Voller Kompass XII' : 'Full Compass XII'}: ${insight.data.count}x</div>`;
        break;
      }
      case 'ultra-speed-tiers': {
        const d = insight.data;
        const tierColors = { gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32' };
        const dirLabels = {
          up:'\u2191', nnw:'\u2196\u2191', ul:'\u2196', left:'\u2190', wsw:'\u2199\u2190', dl:'\u2199',
          down:'\u2193', sse:'\u2198\u2193', dr:'\u2198', right:'\u2192', ene:'\u2197\u2192', ur:'\u2197'
        };
        html += `<div class="mastery-ultra-speed-tiers">`;
        for (const [dir, tier] of Object.entries(d)) {
          if (tier) {
            html += `<span class="mastery-tier-badge" style="color:${tierColors[tier] || '#fff'}">${dirLabels[dir] || dir} ${tier}</span>`;
          }
        }
        html += `</div>`;
        break;
      }
      case 'ultra-survivor': {
        const d = insight.data;
        html += `<div class="mastery-ultra-survivor">${lang === 'de' ? 'Bester Ultra-Run' : 'Best Ultra Run'}: ${d.display}</div>`;
        break;
      }

      /* ── Mathe insight types ── */
      case 'math-ops': {
        const d = insight.data;
        html += `<div class="mastery-math-ops">`;
        for (const [op, info] of Object.entries(d)) {
          const pct = info.total > 0 ? Math.round((info.correct / info.total) * 100) : 0;
          const heat = pct >= 80 ? 'hot' : pct >= 50 ? 'warm' : pct > 0 ? 'cool' : 'cold';
          const bestLabel = info.bestRt > 0 ? `${info.bestRt}ms` : '-';
          html += `<div class="mastery-math-op-card ${heat}">
            <div class="mastery-math-op-sym">${op}</div>
            <div class="mastery-math-op-pct">${pct}%</div>
            <div class="mastery-math-op-best">${bestLabel}</div>
          </div>`;
        }
        html += `</div>`;
        break;
      }
      case 'brain-age': {
        const d = insight.data;
        const ageColor = d.age <= 30 ? '#2ED573' : d.age <= 45 ? '#FFA502' : d.age <= 60 ? '#FF6348' : '#FF4757';
        html += `<div class="mastery-brain-age" style="--age-color:${ageColor}">
          <span class="mastery-brain-label">${lang === 'de' ? 'Gehirnalter' : 'Brain Age'}</span>
          <span class="mastery-brain-value">${d.age}</span>
        </div>`;
        break;
      }
      case 'math-phase': {
        const d = insight.data;
        html += `<div class="mastery-math-phase">${lang === 'de' ? 'Beste Phase' : 'Best Phase'}: <strong>${d.name}</strong> (${d.phase}/6)</div>`;
        break;
      }

      /* ── Algebra insight types ── */
      case 'algebra-types': {
        const d = insight.data;
        html += `<div class="mastery-algebra-types">`;
        for (const [t, info] of Object.entries(d)) {
          const pct = info.total > 0 ? Math.round((info.correct / info.total) * 100) : 0;
          const heat = info.unlocked ? (pct >= 80 ? 'hot' : pct >= 50 ? 'warm' : pct > 0 ? 'cool' : 'cold') : 'locked';
          const bestLabel = info.bestRt > 0 ? `${info.bestRt}ms` : '-';
          html += `<div class="mastery-algebra-type-card ${heat}">
            <div class="mastery-algebra-type-label">${info.label}</div>
            <div class="mastery-algebra-type-pct">${info.unlocked ? `${pct}%` : '?'}</div>
            <div class="mastery-algebra-type-best">${info.unlocked ? bestLabel : ''}</div>
          </div>`;
        }
        html += `</div>`;
        break;
      }
      case 'algebra-iq': {
        const d = insight.data;
        const iqColor = d.iq >= 130 ? '#2ED573' : d.iq >= 110 ? '#FFA502' : d.iq >= 100 ? '#FF6348' : '#FF4757';
        html += `<div class="mastery-algebra-iq" style="--iq-color:${iqColor}">
          <span class="mastery-iq-label">Algebra IQ</span>
          <span class="mastery-iq-value">${d.iq}</span>
        </div>`;
        break;
      }
      case 'algebra-phase': {
        const d = insight.data;
        html += `<div class="mastery-algebra-phase">${lang === 'de' ? 'Beste Phase' : 'Best Phase'}: <strong>${d.name}</strong> (${d.phase}/6)</div>`;
        break;
      }

      /* ── Worte insight types ── */
      case 'word-collection': {
        const d = insight.data;
        const pct = d.total > 0 ? Math.round((d.collected / d.total) * 100) : 0;
        html += `<div class="mastery-word-collection">
          <div class="mastery-word-coll-bar"><div class="mastery-word-coll-fill" style="width:${pct}%"></div></div>
          <div class="mastery-word-coll-text">${d.collected} / ${d.total} ${lang === 'de' ? 'W\u00F6rter gesammelt' : 'words collected'} (${pct}%)</div>
        </div>`;
        break;
      }
      case 'word-categories': {
        const d = insight.data;
        const labels = CONFIG.WORD_CAT_LABELS || {};
        const emojis = CONFIG.WORD_CAT_EMOJIS || {};
        html += `<div class="mastery-word-cats">`;
        for (const [cat, info] of Object.entries(d)) {
          const pct = info.total > 0 ? Math.round((info.correct / info.total) * 100) : 0;
          const heat = pct >= 80 ? 'hot' : pct >= 50 ? 'warm' : pct > 0 ? 'cool' : 'cold';
          const label = labels[lang]?.[cat] || labels.de?.[cat] || labels.en?.[cat] || cat;
          const emoji = emojis[cat] || '';
          html += `<div class="mastery-word-cat-card ${heat}">
            <div class="mastery-word-cat-emoji">${emoji}</div>
            <div class="mastery-word-cat-name">${label}</div>
            <div class="mastery-word-cat-pct">${pct}%</div>
          </div>`;
        }
        html += `</div>`;
        break;
      }

      /* ── Hauptstaedte insight types ── */
      case 'region-mastery': {
        const d = insight.data;
        const regionLabels = { europe: 'Europe', americas: 'Americas', asia: 'Asia', oceania: 'Oceania', africa: 'Africa' };
        html += `<div class="mastery-region-cards">`;
        for (const [r, info] of Object.entries(d)) {
          const pct = info.total > 0 ? Math.round((info.correct / info.total) * 100) : 0;
          const heat = pct >= 80 ? 'hot' : pct >= 50 ? 'warm' : pct > 0 ? 'cool' : 'cold';
          html += `<div class="mastery-region-card ${heat}">
            <div class="mastery-region-name">${regionLabels[r] || r}</div>
            <div class="mastery-region-pct">${pct}%</div>
          </div>`;
        }
        html += `</div>`;
        break;
      }
      case 'country-collection': {
        const d = insight.data;
        const pct = d.total > 0 ? Math.round((d.collected / d.total) * 100) : 0;
        html += `<div class="mastery-country-collection">
          <div class="mastery-country-bar"><div class="mastery-country-fill" style="width:${pct}%"></div></div>
          <div class="mastery-country-text">${d.collected} / ${d.total} ${lang === 'de' ? 'L\u00E4nder entdeckt' : 'countries discovered'} (${pct}%)</div>
        </div>`;
        break;
      }
      case 'country-streak': {
        html += `<div class="mastery-country-streak">${lang === 'de' ? 'Beste L\u00E4nder-Serie' : 'Best Country Streak'}: ${insight.data.best}x</div>`;
        break;
      }

      /* ── Wissen insight types ── */
      case 'topic-radar': {
        const d = insight.data;
        html += `<div class="mastery-topic-cards">`;
        for (const [cat, info] of Object.entries(d)) {
          const pct = info.total > 0 ? Math.round((info.correct / info.total) * 100) : 0;
          const heat = pct >= 80 ? 'hot' : pct >= 50 ? 'warm' : pct > 0 ? 'cool' : 'cold';
          html += `<div class="mastery-topic-card ${heat}">
            <div class="mastery-topic-name">${info.label}</div>
            <div class="mastery-topic-pct">${pct}%</div>
          </div>`;
        }
        html += `</div>`;
        break;
      }
      case 'wissen-iq': {
        const d = insight.data;
        const iqColor = d.iq >= 130 ? '#2ED573' : d.iq >= 110 ? '#FFA502' : d.iq >= 100 ? '#FF6348' : '#FF4757';
        html += `<div class="mastery-wissen-iq" style="--iq-color:${iqColor}">
          <span class="mastery-wissen-iq-label">${lang === 'de' ? 'Wissens-IQ' : 'Knowledge IQ'}</span>
          <span class="mastery-wissen-iq-value">${d.iq}</span>
        </div>`;
        break;
      }

      /* ── Memo insight types ── */
      case 'memory-span': {
        const d = insight.data;
        html += `<div class="mastery-memory-span">
          <span class="mastery-span-label">${lang === 'de' ? 'Merkspanne' : 'Memory Span'}</span>
          <span class="mastery-span-value">${d.best}</span>
          <span class="mastery-span-sub">${lang === 'de' ? `(alle ${d.revealEvery} korrekt)` : `(${d.revealEvery} correct streak)`}</span>
        </div>`;
        break;
      }
      case 'perfect-recalls': {
        html += `<div class="mastery-perfect-recalls">${lang === 'de' ? 'Perfekte Erinnerungen' : 'Perfect Recalls'}: ${insight.data.count}x</div>`;
        break;
      }

      /* ── Sequenz insight types ── */
      case 'seq-record': {
        const d = insight.data;
        html += `<div class="mastery-seq-record">
          <span class="mastery-seq-label">${lang === 'de' ? 'Sequenz-Rekord' : 'Sequence Record'}</span>
          <span class="mastery-seq-value">${d.best}</span>
          <span class="mastery-seq-target">/ ${d.target}</span>
        </div>`;
        break;
      }
      case 'seq-rounds': {
        const d = insight.data;
        html += `<div class="mastery-seq-rounds">${lang === 'de' ? 'Runden' : 'Rounds'}: ${d.total} (${lang === 'de' ? 'perfekt' : 'perfect'}: ${d.perfect})</div>`;
        break;
      }

      /* ── Stroop insight types ── */
      case 'interference': {
        const d = insight.data;
        const intColor = d.current <= 10 ? '#2ED573' : d.current <= 25 ? '#FFA502' : '#FF4757';
        html += `<div class="mastery-interference" style="--int-color:${intColor}">
          <span class="mastery-int-label">${lang === 'de' ? 'Interferenz' : 'Interference'}</span>
          <span class="mastery-int-value">${d.current}%</span>
          <span class="mastery-int-best">${lang === 'de' ? 'Bester' : 'Best'}: ${d.best}%</span>
        </div>`;
        break;
      }
      case 'stroop-split': {
        const d = insight.data;
        html += `<div class="mastery-stroop-split">
          <span class="mastery-split-cong">${lang === 'de' ? 'Kongruent' : 'Congruent'}: ${d.congRt}ms</span>
          <span class="mastery-split-incong">${lang === 'de' ? 'Inkongruent' : 'Incongruent'}: ${d.incongRt}ms</span>
        </div>`;
        break;
      }

      /* ── Fokus insight types ── */
      case 'focus-score': {
        const d = insight.data;
        const focColor = d.current >= 70 ? '#2ED573' : d.current >= 40 ? '#FFA502' : '#FF4757';
        html += `<div class="mastery-focus-score" style="--foc-color:${focColor}">
          <span class="mastery-foc-label">${lang === 'de' ? 'Fokus-Score' : 'Focus Score'}</span>
          <span class="mastery-foc-value">${d.current}</span>
          <span class="mastery-foc-best">${lang === 'de' ? 'Bester' : 'Best'}: ${d.best}</span>
        </div>`;
        break;
      }
      case 'distraction-cost': {
        const d = insight.data;
        html += `<div class="mastery-distraction-cost">${lang === 'de' ? 'Ablenkungskosten' : 'Distraction Cost'}: ${d.cost}%</div>`;
        break;
      }
      case 'fokus-split': {
        const d = insight.data;
        html += `<div class="mastery-fokus-split">
          <span class="mastery-split-cong">${lang === 'de' ? 'Kongruent' : 'Congruent'}: ${d.congRt}ms</span>
          <span class="mastery-split-incong">${lang === 'de' ? 'Inkongruent' : 'Incongruent'}: ${d.incongRt}ms</span>
        </div>`;
        break;
      }

      /* ── Chaos insight types ── */
      case 'rule-mastery': {
        const d = insight.data;
        const ruleLabels = { color: 'Color', shape: 'Shape', size: 'Size', math: 'Math', stroop: 'Stroop' };
        html += `<div class="mastery-rule-cards">`;
        for (const [r, info] of Object.entries(d)) {
          const pct = info.total > 0 ? Math.round((info.correct / info.total) * 100) : 0;
          const heat = pct >= 80 ? 'hot' : pct >= 50 ? 'warm' : pct > 0 ? 'cool' : 'cold';
          html += `<div class="mastery-rule-card ${heat}">
            <div class="mastery-rule-name">${ruleLabels[r] || r}</div>
            <div class="mastery-rule-pct">${pct}%</div>
          </div>`;
        }
        html += `</div>`;
        break;
      }
      case 'flex-score': {
        const d = insight.data;
        const flexColor = d.current >= 70 ? '#2ED573' : d.current >= 40 ? '#FFA502' : '#FF4757';
        html += `<div class="mastery-flex-score" style="--flex-color:${flexColor}">
          <span class="mastery-flex-label">${lang === 'de' ? 'Flexibilit\u00E4t' : 'Flexibility'}</span>
          <span class="mastery-flex-value">${d.current}</span>
          <span class="mastery-flex-best">${lang === 'de' ? 'Bester' : 'Best'}: ${d.best}</span>
        </div>`;
        break;
      }
      case 'switches-survived': {
        html += `<div class="mastery-switches">${lang === 'de' ? 'Regelwechsel überlebt' : 'Switches Survived'}: ${insight.data.total}</div>`;
        break;
      }

      /* ── Plan 4: Ultra ── */
      case 'elite-stat': {
        const d = insight.data;
        html += `<div class="mastery-elite-stat">
          <span class="mastery-elite-label">${lang === 'de' ? 'Elite-Statistik' : 'Elite Stat'}</span>
          <span class="mastery-elite-value">${lang === 'de' ? 'Top' : 'Top'} ${d.percentile}%</span>
          <span class="mastery-elite-streak">${d.streak} Streak</span>
        </div>`;
        break;
      }

      /* ── Plan 5: Mathe ── */
      case 'math-facts': {
        const facts = insight.data.facts;
        html += `<div class="mastery-math-facts"><span class="mastery-mf-title">${lang === 'de' ? 'Gemeisterte Fakten' : 'Mastered Facts'}</span>`;
        for (const f of facts) {
          html += `<span class="mastery-mf-chip">${f.eq} <small>${f.correct}/${f.total} &middot; ${(f.bestRt / 1000).toFixed(1)}s</small></span>`;
        }
        html += `</div>`;
        break;
      }
      case 'community-speed': {
        const d = insight.data;
        html += `<div class="mastery-community-speed">
          <span>${lang === 'de' ? 'Schneller als' : 'Faster than'} <strong>${d.percentile}%</strong></span>
          <small>Ø ${(d.avgRt / 1000).toFixed(2)}s</small>
        </div>`;
        break;
      }

      /* ── Plan 6: Algebra ── */
      case 'time-attack': {
        const d = insight.data;
        html += `<div class="mastery-time-attack">
          <span class="mastery-ta-label">${lang === 'de' ? 'Ziel' : 'Target'}: ${d.target}</span>
          <span class="mastery-ta-avg">Ø ${d.avgPerGame}</span>
        </div>`;
        break;
      }

      /* ── Plan 7: Worte ── */
      case 'word-of-day': {
        const d = insight.data;
        html += `<div class="mastery-wotd">
          <span class="mastery-wotd-label">${lang === 'de' ? 'Wort des Tages' : 'Word of the Day'}</span>
          <span class="mastery-wotd-word">${d.word}</span>
          ${d.known ? `<span class="mastery-wotd-known">${lang === 'de' ? 'Gemeistert' : 'Known'}</span>` : ''}
        </div>`;
        break;
      }
      case 'bilingual': {
        const d = insight.data;
        html += `<div class="mastery-bilingual">
          <span>DE: ${d.de}</span><span>EN: ${d.en}</span>
        </div>`;
        break;
      }

      /* ── Plan 8: Hauptstaedte ── */
      case 'world-map': {
        const countries = insight.data;
        const known = Object.values(countries).filter(c => c.known).length;
        const total = Object.keys(countries).length;
        html += `<div class="mastery-world-map">
          <span class="mastery-wm-title">${lang === 'de' ? 'Weltkarte' : 'World Map'}</span>
          <span class="mastery-wm-count">${known} / ${total}</span>
          <div class="mastery-wm-grid">`;
        for (const [country, info] of Object.entries(countries)) {
          html += `<span class="mastery-wm-dot${info.known ? ' known' : ''}" title="${country}">${info.known ? '&#9679;' : '&#9675;'}</span>`;
        }
        html += `</div></div>`;
        break;
      }
      case 'explorer-title': {
        const d = insight.data;
        const label = lang === 'de' ? d.label_de : d.label_en;
        html += `<div class="mastery-explorer-title"><span>${label}</span></div>`;
        break;
      }
      case 'mastery-tier': {
        const d = insight.data;
        if (d && d.name) {
          html += `<div class="mastery-tier-insight">
            <span class="mastery-tier-name">${d.name}</span>
            ${d.next ? `<small>${d.next.threshold - d.score} ${lang === 'de' ? 'bis' : 'to'} ${d.next.name}</small>` : ''}
          </div>`;
        }
        break;
      }

      /* ── Plan 9: Wissen ── */
      case 'expert-badges': {
        const cats = insight.data;
        html += `<div class="mastery-expert-badges"><span class="mastery-eb-title">${lang === 'de' ? 'Experten-Badges' : 'Expert Badges'}</span>`;
        for (const [cat, info] of Object.entries(cats)) {
          html += `<span class="mastery-eb-chip${info.correct >= 10 ? ' earned' : ''}">${info.label}: ${info.correct}</span>`;
        }
        html += `</div>`;
        break;
      }
      case 'topic-streak': {
        html += `<div class="mastery-topic-streak">${lang === 'de' ? 'Themen-Streak' : 'Topic Streak'}: ${insight.data.best}</div>`;
        break;
      }

      /* ── Plan 10-13: Shared daily-streak ── */
      case 'daily-streak': {
        const d = insight.data;
        html += `<div class="mastery-daily-streak">
          <span>${lang === 'de' ? 'Tägliches Training' : 'Daily Training'}: ${d.current} ${lang === 'de' ? 'Tage' : 'days'}</span>
          <small>${lang === 'de' ? 'Rekord' : 'Best'}: ${d.best}</small>
        </div>`;
        break;
      }

      /* ── Plan 10: Memo ── */
      case 'preview-milestone': {
        const d = insight.data;
        html += `<div class="mastery-preview-ms">
          <span>${lang === 'de' ? 'Vorschauzeit' : 'Preview Time'}: ${(d.currentMs / 1000).toFixed(1)}s</span>
          <small>${d.reveals} ${lang === 'de' ? 'Aufdeckungen' : 'reveals'}</small>
        </div>`;
        break;
      }
      case 'brain-scan': {
        const d = insight.data;
        const hist = d.history || [];
        const maxVal = Math.max(d.best || 1, ...hist);
        html += `<div class="mastery-brain-scan">
          <span class="mastery-bs-title">${lang === 'de' ? 'Gehirnscan' : 'Brain Scan'}</span>
          <svg class="mastery-bs-svg" viewBox="0 0 ${hist.length * 12} 40" preserveAspectRatio="none">
            <polyline fill="none" stroke="#FFD700" stroke-width="1.5"
              points="${hist.map((v, i) => `${i * 12},${40 - (v / maxVal) * 36}`).join(' ')}" />
          </svg>
          <small>${lang === 'de' ? 'Beste Spanne' : 'Best Span'}: ${d.best}</small>
        </div>`;
        break;
      }

      /* ── Plan 11: Sequenz ── */
      case 'speed-per-length': {
        const d = insight.data;
        html += `<div class="mastery-speed-len"><span class="mastery-sl-title">${lang === 'de' ? 'Speed pro Länge' : 'Speed by Length'}</span>`;
        for (const [len, ms] of Object.entries(d)) {
          html += `<span class="mastery-sl-chip">${len}: ${(ms / 1000).toFixed(2)}s</span>`;
        }
        html += `</div>`;
        break;
      }
      case 'pattern-replay': {
        const d = insight.data;
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
        html += `<div class="mastery-pattern-replay">
          <span class="mastery-pr-title">${lang === 'de' ? 'Beste Sequenz' : 'Best Pattern'} (${d.length})</span>
          <div class="mastery-pr-dots">${(d.pattern || []).map(idx => `<span class="mastery-pr-dot" style="background:${colors[idx % colors.length]}"></span>`).join('')}</div>
        </div>`;
        break;
      }

      /* ── Plan 12: Stroop ── */
      case 'brain-control': {
        const d = insight.data;
        html += `<div class="mastery-brain-ctrl">
          <span class="mastery-bc-label">${lang === 'de' ? 'Gehirnkontrolle' : 'Brain Control'}</span>
          <span class="mastery-bc-level">${d.label}</span>
        </div>`;
        break;
      }
      case 'challenge-rounds': {
        html += `<div class="mastery-challenge-rounds">${lang === 'de' ? 'Challenge-Runden' : 'Challenge Rounds'}: ${insight.data.total}</div>`;
        break;
      }
      case 'interference-chart': {
        const hist = insight.data.history || [];
        const maxVal = Math.max(100, ...hist);
        html += `<div class="mastery-interference-chart">
          <span class="mastery-ic-title">${lang === 'de' ? 'Interferenz-Verlauf' : 'Interference Trend'}</span>
          <svg class="mastery-ic-svg" viewBox="0 0 ${Math.max(hist.length * 12, 24)} 40" preserveAspectRatio="none">
            <polyline fill="none" stroke="#FF6B6B" stroke-width="1.5"
              points="${hist.map((v, i) => `${i * 12},${40 - (v / maxVal) * 36}`).join(' ')}" />
          </svg>
        </div>`;
        break;
      }

      /* ── Plan 13: Fokus ── */
      case 'distraction-level': {
        const d = insight.data;
        html += `<div class="mastery-dist-level">
          <span>${lang === 'de' ? 'Ablenkungsstufe' : 'Distraction Level'}</span>
          <span class="mastery-dl-label">${d.label}</span>
        </div>`;
        break;
      }
      case 'tunnel-vision': {
        const d = insight.data;
        html += `<div class="mastery-tunnel-vision">
          <span>${lang === 'de' ? 'Tunnelblick' : 'Tunnel Vision'}: ${d.run}</span>
          <small>${lang === 'de' ? 'Stufe' : 'Tier'} ${d.tier}/${d.maxTier}</small>
        </div>`;
        break;
      }

      /* ── Plan 14: Chaos ── */
      case 'chaos-rank': {
        const d = insight.data;
        html += `<div class="mastery-chaos-rank">
          <span class="mastery-cr-label">${d.rank}</span>
          <small>${d.score} pts${d.next ? ` &middot; ${lang === 'de' ? 'Nächstes' : 'Next'}: ${d.next}` : ''}</small>
        </div>`;
        break;
      }
      case 'adaptation-speed': {
        const d = insight.data;
        html += `<div class="mastery-adaptation">
          <span>${lang === 'de' ? 'Anpassung' : 'Adaptation'}: Ø ${d.avgErrors.toFixed(1)} ${lang === 'de' ? 'Fehler' : 'errors'}</span>
          <small>${d.samples} ${lang === 'de' ? 'Wechsel' : 'switches'}</small>
        </div>`;
        break;
      }
    }
  }

  /* Mastery tier display */
  const tierInfo = mastery.getMasteryTier(mode);
  if (tierInfo.name) {
    html += `<div style="text-align:center;margin-top:8px;font-size:0.55rem;color:rgba(255,255,255,0.4)">
      Mastery: <span style="color:#FFD700;font-weight:700">${tierInfo.name}</span>
      ${tierInfo.next ? ` &middot; ${lang === 'de' ? 'Nächstes' : 'Next'}: ${tierInfo.next.name} (${tierInfo.next.threshold - tierInfo.score})` : ''}
    </div>`;
  }

  el.innerHTML = html;
  el.style.display = '';
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
