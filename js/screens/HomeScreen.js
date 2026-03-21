/* ═══════════════════════════════════════
   SCS Play — Home Screen
   Mode picker, play type, hero card,
   daily challenge, XP bar, avatar.
   ═══════════════════════════════════════ */
import { CONFIG }           from '../config.js';
import { t, getLanguage }    from '../i18n.js';
import { $, $$, setText, setHTML, safeSrc, showScreen } from '../helpers/dom.js';
import { avatarSVG }        from '../renderers/avatars.js';
import { updateAdBanner, isAdFree } from '../services/AdService.js';
import { applyTheme }       from '../services/ThemeService.js';
import { EffectsManager }   from '../effects.js';
import app                   from '../appState.js';

/* ═══════ Daily Countdown Timer ═══════ */
let dailyCountdownInterval = null;

function getTimeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function getOrCreateTimerEl() {
  let el = $('#dailyTimer');
  if (!el) {
    const right = document.querySelector('.daily-right');
    if (!right) return null;
    el = document.createElement('span');
    el.className = 'daily-timer';
    el.id = 'dailyTimer';
    right.appendChild(el);
  }
  return el;
}

function startDailyCountdown() {
  const timerEl = getOrCreateTimerEl();
  if (!timerEl) return;
  
  // Clear any existing interval
  if (dailyCountdownInterval) {
    clearInterval(dailyCountdownInterval);
    dailyCountdownInterval = null;
  }
  
  const updateTimer = () => {
    const ms = getTimeUntilMidnight();
    if (ms <= 0) {
      clearInterval(dailyCountdownInterval);
      dailyCountdownInterval = null;
      if (app.currentScreen === 'home') showHome();
      return;
    }
    timerEl.textContent = `⏱ ${formatCountdown(ms)}`;
  };
  
  updateTimer();
  dailyCountdownInterval = setInterval(updateTimer, 1000);
}

function stopDailyCountdown() {
  if (dailyCountdownInterval) {
    clearInterval(dailyCountdownInterval);
    dailyCountdownInterval = null;
  }
}

/* Register on app so showScreen() can stop it without circular imports */
app._stopDailyCountdown = stopDailyCountdown;

/* ═══════ Personalized Greeting ═══════ */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return t('greeting_night') || 'Gute Nacht';
  if (h < 12) return t('greeting_morning') || 'Guten Morgen';
  if (h < 18) return t('greeting_afternoon') || 'Guten Tag';
  return t('greeting_evening') || 'Guten Abend';
}

/* ═══════ XP bar ═══════ */
export function updateXPBar() {
  const { save } = app;
  const prog = save.getXPProgress();
  const bar = $('#xpBarFill');
  const levelNum = $('#xpLevelNum');
  const title = $('#xpTitle');
  const numbers = $('#xpNumbers');
  const percent = $('#xpPercent');
  
  if (bar) bar.style.width = (prog.pct * 100) + '%';
  if (levelNum) {
    const lvl = save.getLevel() + 1;
    levelNum.textContent = `${t('level')} ${lvl}`;
  }
  if (title) {
    title.textContent = save.getLevelName();
  }
  if (numbers) {
    numbers.textContent = `${prog.current.toLocaleString()} / ${prog.needed.toLocaleString()} XP`;
  }
  if (percent) {
    percent.textContent = `${Math.round(prog.pct * 100)}%`;
  }
}

/* ═══════ Avatar display ═══════ */
export function updateAvatarDisplay() {
  const { save } = app;
  const avatar = save.getAvatar();
  if (avatar.photo) {
    setHTML('#homeAvatar', `<img src="${safeSrc(avatar.photo)}" alt="Avatar" style="width:24px;height:24px;border-radius:50%;object-fit:cover">`);
  } else {
    const color = CONFIG.COLORS.normal[avatar.colorIndex] || CONFIG.COLORS.normal[0];
    setHTML('#homeAvatar', avatarSVG(avatar.icon, color, 24));
  }
}

/* ═══════ Hero card ═══════ */
const MODE_DESC_KEYS = {
  klassik: 'mode_klassik_desc', beginner: 'mode_beginner_desc',
  expert: 'mode_expert_desc', ultra: 'mode_ultra_desc',
  mathe: 'mode_mathe_desc', worte: 'mode_worte_desc', memo: 'mode_memo_desc',
  sequenz: 'mode_sequenz_desc',
  stroop: 'mode_stroop_desc', fokus: 'mode_fokus_desc', chaos: 'mode_chaos_desc',
  hauptstaedte: 'mode_hauptstaedte_desc', algebra: 'mode_algebra_desc'
};

const MODE_AURA = {
  klassik:  'rgba(255,71,87,0.25)',
  beginner: 'rgba(55,66,250,0.25)',
  expert:   'rgba(83,82,237,0.25)',
  ultra:    'rgba(123,104,238,0.25)',
  mathe:    'rgba(255,179,71,0.28)',
  worte:    'rgba(46,213,115,0.25)',
  memo:     'rgba(56,189,248,0.25)',
  sequenz:  'rgba(167,139,250,0.25)',
  stroop:   'rgba(239,68,68,0.28)',
  fokus:    'rgba(139,92,246,0.25)',
  chaos:    'rgba(249,115,22,0.28)',
  hauptstaedte: 'rgba(56,189,248,0.25)',
  algebra:  'rgba(251,191,36,0.25)',
};

export function updateHeroCard() {
  const { save } = app;
  const card = $(`.mode-card[data-mode="${app.selectedMode}"]`);
  const visual = $('#heroVisualLarge');
  if (visual && card) {
    const svg = card.querySelector('.mode-card-visual svg');
    if (svg) {
      visual.innerHTML = '';
      const clone = svg.cloneNode(true);
      clone.style.width = '100%'; clone.style.height = '100%';
      visual.appendChild(clone);
    }
  }
  const nameEl = $('#heroModeName');
  if (nameEl) nameEl.textContent = t(`mode_${app.selectedMode}`) || app.selectedMode.toUpperCase();
  const descEl = $('#heroModeDesc');
  if (descEl) descEl.textContent = t(MODE_DESC_KEYS[app.selectedMode] || 'mode_klassik_desc');
  const pb = save.getPB(app.selectedMode);
  const pbEl = $('#heroPB');
  if (pbEl) pbEl.textContent = pb > 0 ? `PB ${pb.toLocaleString()}` : t('hero_first_record');

  /* v25: Per-mode level in hero card */
  const modeLvEl = $('#heroModeLevel');
  if (modeLvEl) {
    const lv = save.getModeLevel(app.selectedMode);
    const lvName = save.getModeLevelName(app.selectedMode, getLanguage());
    modeLvEl.textContent = lv > 0 ? `Lv.${lv} ${lvName}` : '';
    modeLvEl.style.display = lv > 0 ? '' : 'none';
  }

  /* Mode Aura — set CSS var for the hero backdrop glow */
  const heroBackdrop = $('#heroBackdrop');
  if (heroBackdrop) {
    const aura = MODE_AURA[app.selectedMode] || 'rgba(124,58,237,0.35)';
    heroBackdrop.style.background = `radial-gradient(ellipse 80% 70% at 50% 40%, ${aura} 0%, rgba(124,58,237,0.08) 50%, transparent 100%)`;
  }
  /* Also update the visual glow filter color */
  const heroVisEl = $('#heroVisualLarge');
  if (heroVisEl) {
    const auraColor = MODE_AURA[app.selectedMode] || 'rgba(124,58,237,0.5)';
    heroVisEl.style.filter = `drop-shadow(0 0 30px ${auraColor})`;
  }
}

/* ═══════ Hero stats spotlight ═══════ */
export function updateHeroStats() {
  const { save } = app;
  const pb     = save.getPB(app.selectedMode);
  const streak = save.getDailyLoginStreak ? save.getDailyLoginStreak() : (save.data?.loginStreak || 0);
  const games  = save.getGamesPlayed ? save.getGamesPlayed() : (save.data?.gamesPlayed || 0);
  const pbEl     = $('#hstPB');
  const streakEl = $('#hstStreak');
  const gamesEl  = $('#hstGames');
  if (pbEl)     pbEl.textContent     = pb     > 0 ? pb.toLocaleString()     : '—';
  if (streakEl) streakEl.textContent = streak > 0 ? streak                  : '—';
  if (gamesEl)  gamesEl.textContent  = games  > 0 ? games.toLocaleString()  : '—';
}

/* ═══════ Mode unlock level helper ═══════ */
function getUnlockLevel(mode) {
  const map = {
    klassik: CONFIG.UNLOCK_KLASSIK,
    beginner: 0,
    expert: CONFIG.UNLOCK_EXPERT,
    ultra: CONFIG.UNLOCK_ULTRA,
    mathe: CONFIG.UNLOCK_MATHE,
    worte: CONFIG.UNLOCK_WORTE,
    memo: CONFIG.UNLOCK_MEMO,
    sequenz: CONFIG.UNLOCK_SEQUENZ,
    stroop: CONFIG.UNLOCK_STROOP,
    fokus: CONFIG.UNLOCK_FOKUS,
    chaos: CONFIG.UNLOCK_CHAOS,
    hauptstaedte: CONFIG.UNLOCK_HAUPTSTAEDTE,
    algebra: CONFIG.UNLOCK_ALGEBRA,
  };
  return (map[mode] ?? 0) + 1;
}

/* ═══════ Mode selector ═══════ */
export function updateModeSelector() {
  const { save } = app;
  $$('.mode-card').forEach(btn => {
    const mode = btn.dataset.mode;
    const unlocked = save.isModeUnlocked(mode);
    btn.classList.toggle('selected', mode === app.selectedMode);
    btn.classList.toggle('locked', !unlocked);
    btn.style.display = unlocked ? '' : 'none';
    /* Show/update "Lv X" label on locked cards */
    let lockLabel = btn.querySelector('.mode-card-lock-label');
    if (!unlocked) {
      if (!lockLabel) {
        lockLabel = document.createElement('span');
        lockLabel.className = 'mode-card-lock-label';
        btn.appendChild(lockLabel);
      }
      lockLabel.textContent = `Lv ${getUnlockLevel(mode)}`;
    } else if (lockLabel) {
      lockLabel.remove();
    }
  });
  updateHeroCard();
  updateHeroStats();
  /* Auto-scroll the selected card into view */
  const selectedCard = $(`.mode-card.selected`);
  if (selectedCard) selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

/* ═══════ Play type selector ═══════ */
export function updatePlayTypeSelector() {
  const { save } = app;
  const isSequenz = app.selectedMode === 'sequenz';
  const isBrainReflex = ['mathe','worte','memo','sequenz','stroop','fokus','chaos','hauptstaedte','algebra'].includes(app.selectedMode);
  /* Sequenz forces endless — auto-select and disable others */
  if (isSequenz && app.selectedPlayType !== 'endless') {
    app.selectedPlayType = 'endless';
  }
  $$('.play-type-btn').forEach(btn => {
    const play = btn.dataset.play;
    btn.classList.toggle('selected', play === app.selectedPlayType);
    if (play === 'competition') {
      btn.classList.toggle('locked', !save.isCompetitionUnlocked());
    }
    /* Sequenz: grey out non-endless play types */
    if (isSequenz && play !== 'endless') {
      btn.classList.add('locked');
      btn.title = t('sequenz_endless_only') || 'Sequenz: nur Endlos';
    } else if (!isSequenz && play !== 'competition') {
      btn.classList.remove('locked');
      btn.title = '';
    }
    /* Blitz warning removed — was inconsistent */
    btn.classList.remove('blitz-warn');
  });
}

/* ═══════ Daily login check ═══════ */
export async function checkDailyLogin() {
  const { save, audio } = app;
  try {
    const result = await save.claimDailyLogin();
    if (!result) return;
    const bodyFx = getBodyFx();
    bodyFx.achievementToast(t('daily_login_title'));
    setTimeout(() => {
      bodyFx.achievementToast(t('daily_login_lives', { n: (result && result.livesAwarded) ? result.livesAwarded : 1 }));
    }, 1500);
    if (result.streakBonus > 0) {
      setTimeout(() => {
        bodyFx.achievementToast(t('daily_login_streak_bonus', { n: result.streakBonus || 0 }));
      }, 3000);
    }
    if (result.streak && result.streak >= 2) {
      setTimeout(() => bodyFx.dailyStreakBadge(result.streak), 4500);
    }
  } catch { /* ignore */ }
}

/** Get or create the shared body-level EffectsManager */
export function getBodyFx() {
  if (!app.bodyFx) app.bodyFx = new EffectsManager(document.body);
  app.bodyFx.setReduced(app.save.getSetting('reducedMotion'));
  return app.bodyFx;
}

/* ═══════ Show home ═══════ */
export function showHome() {
  const { save, auth, audio } = app;
  showScreen('home', app);
  updateXPBar();
  updateModeSelector();
  updatePlayTypeSelector();
  updateHeroStats();
  updateAdBanner(save);
  applyTheme(save.getActiveTheme());
  document.body.classList.toggle('ad-free', isAdFree(save));

  if (typeof audio.setMusicMode === 'function') audio.setMusicMode('menu');
  audio.startMusic();

  if (auth.isGuest) {
    setText('#userInfo', t('guest_short'));
  } else {
    setText('#userInfo', auth.user?.name || auth.user?.email || '');
  }

  /* Personalized greeting */
  const greetEl = $('#homeGreeting');
  if (greetEl) greetEl.textContent = getGreeting();

  /* Update lives & fire display in home header */
  const livesEl = $('#homeLivesCount');
  if (livesEl) livesEl.textContent = save.getLives();

  const fireEl = $('#homeFireCount');
  if (fireEl) fireEl.textContent = save.getFireBalance();

  const dailyCard = $('#dailyCard');
  const dailyBtn = $('#btnDaily');
  const dailyReward = $('#dailyReward');
  const hasDailyPlayed = save.hasDailyToday();
  if (dailyCard) {
    if (hasDailyPlayed) {
      dailyCard.classList.add('daily-done');
      if (dailyBtn) dailyBtn.textContent = t('daily_done');
      if (dailyReward) dailyReward.textContent = t('daily_reward_summary');
      startDailyCountdown();
    } else {
      dailyCard.classList.remove('daily-done');
      if (dailyBtn) dailyBtn.textContent = t('play');
      /* Show streak-scaled reward text */
      const streak = save.data?.loginStreak || 0;
      const bonusXP = Math.min(streak * (CONFIG.DAILY_STREAK_XP_BONUS || 25), 250);
      const fireReward = (streak + 1) * 5;
      if (dailyReward) {
        dailyReward.textContent = bonusXP > 0
          ? t('daily_reward_detail', { xp: 100 + bonusXP, fire: fireReward })
          : t('daily_reward_text');
      }
      stopDailyCountdown();
    }
  }

  updateAvatarDisplay();
  checkDailyLogin();

  /* Weekend XP bonus badge */
  const weekendBadge = $('#weekendBadge');
  if (weekendBadge) {
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;
    weekendBadge.textContent = isWeekend ? t('weekend_xp_active') : '';
  }

  /* XP rate hint when throttled */
  const xpRateHint = $('#xpRateHint');
  if (xpRateHint) {
    const rate = save.getXPRate ? save.getXPRate() : 1;
    xpRateHint.textContent = rate < 1 ? t('xp_rate_info', { n: Math.round(rate * 100) }) : '';
  }
}
