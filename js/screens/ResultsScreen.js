/* ═══════════════════════════════════════
   SCS Play — Results Screen
   Score display, stats, XP, continue, achievements.
   ═══════════════════════════════════════ */
import { CONFIG }           from '../config.js';
import { t, getLanguage }    from '../i18n.js';
import { $, setText, showScreen } from '../helpers/dom.js';
import { haptic }           from '../helpers/haptics.js';
import app                   from '../appState.js';
import { updateXPBar }      from '../helpers/xpBarHelper.js';
import { updateLivesDisplay } from '../helpers/livesDisplayHelper.js';
import { maybeShowFeedback } from '../helpers/microFeedback.js';
import { getKlassikInsights, getFormenInsights, getExpertInsights, getUltraInsights, getMatheInsights, getAlgebraInsights, getWorteInsights, getHauptstaedteInsights, getWissenInsights, getMemoInsights, getSequenzInsights, getStroopInsights, getFokusInsights, getChaosInsights } from '../game/ModeMastery.js';
import { getOrSeedQuests, recordGameResult as recordQuestProgress, autoClaim as autoClaimQuests } from '../services/DailyQuestService.js';
import { isQualifiedRound, getRoundRequirements } from '../services/ProgressionService.js';

let _resultGeneration = 0;
let _resultCountUpCancel = null;
const _resultTimers = new Set();
const _resultFrames = new Set();

function cancelResultWork() {
  _resultGeneration++;
  _resultTimers.forEach(clearTimeout);
  _resultTimers.clear();
  _resultFrames.forEach(cancelAnimationFrame);
  _resultFrames.clear();
  if (_resultCountUpCancel) _resultCountUpCancel();
  _resultCountUpCancel = null;
  return _resultGeneration;
}

function scheduleResult(generation, callback, delay) {
  if (generation !== _resultGeneration) return;
  const id = setTimeout(() => {
    _resultTimers.delete(id);
    if (generation === _resultGeneration) callback();
  }, delay);
  _resultTimers.add(id);
}

function scheduleResultFrame(generation, callback) {
  if (generation !== _resultGeneration) return;
  const id = requestAnimationFrame(() => {
    _resultFrames.delete(id);
    if (generation === _resultGeneration) callback();
  });
  _resultFrames.add(id);
}

window.addEventListener('scs:screenchange', ({ detail }) => {
  if (detail?.prevScreen === 'results' && detail.id !== 'results') cancelResultWork();
});

function setResultValue(selector, value, hasData = true) {
  const el = $(selector);
  if (!el) return;
  el.textContent = hasData ? value : '\u2014';
  el.classList.toggle('is-no-data', !hasData);
  if (hasData) {
    el.removeAttribute('aria-label');
  } else {
    el.setAttribute('aria-label', t('er_no_data'));
  }
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
  const resultGeneration = cancelResultWork();
  const { save, audio, effects, engagement } = app;
  app.lastResultStats = stats;

  const alreadySaved = stats.roundId && save.data.progression?.recentRounds.some(round => round.id === stats.roundId);
  if (!canContinue && !alreadySaved) {
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
  if (engagement) engagement.markResultsShown();
  if (stats.score > app.sessionBest) app.sessionBest = stats.score;

  let isNewPB = false, leveledUp = false, unlocked = [], fireEarned = 0, gameXPEarned = 0;
  let completedGoal = false, ultraUnlocked = false, duplicate = false;
  if (!canContinue) {
    await save.withBatch(async () => {
      const scoreResult = await save.addScore(stats);
      ({ isNewPB, leveledUp, fireEarned, xpEarned: gameXPEarned, duplicate = false } = scoreResult);
      fireEarned = fireEarned || 0;
      if (!duplicate && stats.playType === 'competition' && stats.competitionWon) {
        const stars = stats.competitionStars;
        const wasUnlocked = save.isUltraUnlockedViaCompetition();
        ultraUnlocked = await save.completeCompetitionLevel(stats.competitionLevel, stars) && !wasUnlocked;
      }
      if (!duplicate) {
        completedGoal = recordQuestProgress(save, stats).length > 0;
        const claim = await autoClaimQuests(save);
        leveledUp = leveledUp || claim.leveledUp;
        gameXPEarned += claim.xp;
        fireEarned += claim.fire;
        if (stats.isDaily) {
          const reward = await save.claimDailyReward(stats);
          if (reward) {
            leveledUp = leveledUp || reward.leveledUp;
            gameXPEarned += reward.xp;
            fireEarned += reward.fire;
          }
        }
        unlocked = save.checkAchievements(stats, app.sessionGames);
        app.mastery?.getMasteryTier(stats.mode);
        const receipt = save.data.progression?.recentRounds.find(round => round.id === stats.roundId);
        if (receipt) Object.assign(receipt.result, { xpEarned: gameXPEarned, fireEarned, leveledUp });
        await save.save();
      }
    });
  }

  if (resultGeneration !== _resultGeneration) return;

  const headingEl = $('[data-i18n="game_over"]');
  if (headingEl) {
    if (stats.isDaily && isQualifiedRound(stats)) {
      headingEl.textContent = t('daily_complete');
    } else {
      headingEl.textContent = stats.playType === 'endless' ? t('endless_over') : t('game_over');
    }
  }

  /* Daily Challenge banner in results */
  let dailyBanner = $('#resDailyBanner');
  if (stats.isDaily && !canContinue && isQualifiedRound(stats)) {
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
    dailyBanner.textContent = t('result_daily_recorded');
    dailyBanner.style.display = '';
  } else if (dailyBanner) {
    dailyBanner.style.display = 'none';
  }

  const ringEl = $('#resXPRingFill');
  if (ringEl) {
    ringEl.style.stroke = 'var(--primary-glow)';
    ringEl.style.filter = '';
  }

  /* Dramatic ring entrance */
  const xpRing = $('.results-xp-ring');
  if (xpRing) {
    xpRing.classList.remove('ring-entrance');
    scheduleResultFrame(resultGeneration, () => xpRing.classList.add('ring-entrance'));
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
      _resultCountUpCancel = effects.scoreCountUp(scoreEl, 0, stats.score, CONFIG.RESULTS_COUNTUP_MS);
      scheduleResult(resultGeneration, () => scoreEl.classList.add('score-complete'), CONFIG.RESULTS_COUNTUP_MS + 50);
  } else {
    setText('#resScore', stats.score.toLocaleString());
    if (scoreEl) scoreEl.classList.add('score-complete');
  }

  setText('#resBestStreak', stats.streak);
  setText('#resAccuracy', stats.accuracy + '%');
  const hasReactionData = Number(stats.correct) > 0
    && Number.isFinite(Number(stats.avgReaction))
    && Number(stats.avgReaction) > 0;
  setResultValue('#resAvgReaction', `${stats.avgReaction}${t('ms')}`, hasReactionData);
  setText('#resCorrect', `${stats.correct} / ${stats.total}`);
  setText('#resStreakBonus', '+' + stats.streakBonus);
  setText('#resAccBonus', '+' + stats.accBonus);

  /* v21: Enhanced stat displays */
  const bonusEl = $('#resBonusExtra');
  if (bonusEl) {
    const parts = [];
    if (stats.perfectBonus > 0) parts.push(t('perfect_bonus', { n: stats.perfectBonus }));
    bonusEl.textContent = parts.join(' \u2022 ');
    bonusEl.style.display = parts.length > 0 ? 'block' : 'none';
  }
  const perfectEl = $('#resPerfectRound');
  if (perfectEl) {
    perfectEl.style.display = 'none';
  }
  setResultValue('#resBestReaction', `${stats.bestReactionTime}${t('ms')}`,
    Number(stats.correct) > 0 && Number(stats.bestReactionTime) > 0);

  const resultMode = stats.mode || app.selectedMode;
  const modeLabel = t(`mode_${resultMode}`) || resultMode;
  const playLabel = t(`play_${stats.playType || app.selectedPlayType}`) || '';
  setText('#resMode', `${modeLabel} \u2022 ${playLabel}`);
  setText('#resXP', t('xp_earned', { n: gameXPEarned }));

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
  setText('#resNextLevel', `${t('level')} ${save.getLevel() + 1}`);
  const xpBar = $('#resXPBar');
  if (xpBar) {
    xpBar.style.width = (prog.pct * 100) + '%';
    xpBar.parentElement.setAttribute('aria-valuenow', String(Math.round(prog.pct * 100)));
  }

  /* v25: Per-mode level display */
  const modeLvEl = $('#resModeLevelInfo');
  if (modeLvEl) {
    const modeKey = stats.mode || app.selectedMode;
    const modeLvName = save.getModeLevelName(modeKey, getLanguage());
    const modeLvProgress = save.getModeLevelProgress(modeKey);
    const modeLv = save.getModeLevel(modeKey);
    modeLvEl.innerHTML = `<span class="mode-level-label">${modeLabel} Lv.${modeLv + 1}</span> <span class="mode-level-name">${modeLvName}</span>`;
    modeLvEl.style.display = '';
    const modeLvBar = $('#resModeLevelBar');
    if (modeLvBar) modeLvBar.style.width = (modeLvProgress * 100) + '%';
  }

  setText('#resSession', t('session_games', { n: app.sessionGames }));
  setText('#resBestToday', t('best_session', { n: app.sessionBest }));

  const compEl = $('#resCompResult');
  if (compEl) {
    if (stats.playType === 'competition') {
      compEl.style.display = 'block';
      const levelLabel = t('competition_level', { n: stats.competitionLevel + 1 });
      compEl.textContent = stats.competitionWon
        ? `${levelLabel} · ${t('competition_complete')} · ${'★'.repeat(stats.competitionStars)}`
        : `${levelLabel} · ${t('competition_failed')} · ${stats.rawScore}/${stats.competitionTarget}`;
      compEl.classList.toggle('comp-success', stats.competitionWon);
      compEl.classList.toggle('comp-fail', !stats.competitionWon);
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
      if (lives > 0) {
        if (btnUse) { btnUse.style.display = ''; btnUse.textContent = `${t('continue_btn')} (${t('continue_lives', { n: lives })})`; }
      } else {
        if (btnUse) btnUse.style.display = 'none';
      }
    }
  } else {
    if (resContinue) resContinue.style.display = 'none';
    if (resNormalBtns) resNormalBtns.style.display = '';
  }

  const milestone = !canContinue && !duplicate
    ? ultraUnlocked ? t('competition_ultra_unlocked')
      : stats.playType === 'competition' ? `${t('competition_level', { n: stats.competitionLevel + 1 })} · ${t(stats.competitionWon ? 'competition_complete' : 'competition_failed')}`
        : leveledUp ? `${t('level_up')} ${save.getLevelName()}`
        : unlocked.length ? `${t('achievement')} ${save.getAchievementName(unlocked[0])}`
          : completedGoal ? t('result_goal_complete')
            : isNewPB ? t('result_pb_improved') : ''
    : '';
  const milestoneEl = $('#resMilestone');
  if (milestoneEl) {
    milestoneEl.textContent = milestone;
    milestoneEl.hidden = !milestone;
  }
  if (milestone && (stats.playType !== 'competition' || stats.competitionWon)) {
    if (stats.playType === 'competition' && !ultraUnlocked) audio.competitionWin();
    else if (leveledUp || ultraUnlocked) audio.levelUp();
    else if (isNewPB && !unlocked.length && !completedGoal) audio.newPB();
    else audio.achievementUnlock();
    haptic('tap', save);
  }
  updateLivesDisplay();
  const xpSection = $('#resXPSection');
  if (xpSection) xpSection.hidden = canContinue;
  const countupDuration = CONFIG.RESULTS_COUNTUP_MS || 1200;
  const statsDelay = CONFIG.RESULTS_STATS_DELAY || 400;
  const buttonsDelay = CONFIG.RESULTS_BUTTONS_DELAY || 800;

  const retryBtn = $('#btnOneMore');
  if (retryBtn) {
    retryBtn.classList.remove('retry-glow', 'cta-pulse');
  }

  const hasNextCompetitionStage = stats.playType === 'competition'
    && stats.competitionWon
    && stats.competitionLevel < CONFIG.COMPETITION_LEVELS - 1;
  setText('#oneMoreText', hasNextCompetitionStage
    ? t('competition_level', { n: stats.competitionLevel + 2 })
    : t('retry'));

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
    scheduleResultFrame(resultGeneration, () => {
      scheduleResultFrame(resultGeneration, () => { xpRingFill.classList.add('animated'); });
    });
  }

  scheduleResult(resultGeneration, () => { if (phase2) phase2.classList.add('results-phase-visible'); },
    countupDuration + statsDelay);
  scheduleResult(resultGeneration, () => { if (phase3) phase3.classList.add('results-phase-visible'); },
    countupDuration + statsDelay + buttonsDelay);

  const details = $('#resDetails');
  if (details) {
    details.open = false;
    details.hidden = canContinue;
    let rendered = false;
    details.ontoggle = () => {
      if (!details.open || rendered || resultGeneration !== _resultGeneration) return;
      rendered = true;
      const goal = getOrSeedQuests(save)[0];
      setText('#resDailyGoal', goal ? `${t(goal.labelKey, { n: goal.target })} · ${goal.progress}/${goal.target}` : '');
      const requirements = getRoundRequirements(stats);
      setText('#resRoundHelp', t('progression_round_help', { n: requirements.minAnswers, hits: requirements.minCorrect }));
      if (app.mastery) renderMasteryInsights(app.mastery, stats);
      if (!milestone && engagement && save.data.progression.qualifiedRounds >= 20 && app.sessionGames % 10 === 0) {
        maybeShowFeedback('sampling', { mode: stats.mode, score: stats.score, sessionGame: app.sessionGames });
      }
    };
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
    const parent = $('#resDetailsBody');
    if (!parent) return;
    parent.appendChild(el);
  }

  const mode = stats.mode;
  let insights = [];
  const masteryTier = mastery.getMasteryTier(mode);

  if (!masteryTier.qualified) {
    el.style.display = '';
    el.classList.add('results-mastery--empty');
    el.textContent = t('result_analysis_pending');
    return;
  }

  if (!stats.correct) {
    el.style.display = '';
    el.classList.add('results-mastery--empty');
    el.innerHTML = `<div class="results-mastery-title">${getLanguage() === 'de' ? 'Modus-Analyse' : 'Mode insights'}</div><p>${getLanguage() === 'de'
      ? 'Deine Modus-Analyse startet mit der ersten richtigen Antwort.'
      : 'Your mode analysis starts with the first correct answer.'}</p>`;
    return;
  }
  el.classList.remove('results-mastery--empty');

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
  let html = `<div class="results-mastery-title">${lang === 'de' ? 'Modus-Analyse' : 'Mode insights'}</div>`;

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
  const tierInfo = masteryTier;
  if (tierInfo.name) {
    html += `<div style="text-align:center;margin-top:8px;font-size:0.55rem;color:rgba(255,255,255,0.4)">
      Mastery: <span style="color:#FFD700;font-weight:700">${tierInfo.name}</span>
      ${tierInfo.next ? ` &middot; ${lang === 'de' ? 'Nächstes' : 'Next'}: ${tierInfo.next.name} (${tierInfo.next.threshold - tierInfo.score})` : ''}
    </div>`;
  }

  el.innerHTML = html;
  el.style.display = '';
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
