/* ═══════════════════════════════════════
   SCS Play — Home Screen
   Mode picker, play type, hero card,
   daily challenge, XP bar, avatar.
   ═══════════════════════════════════════ */
import { CONFIG }           from '../config.js';
import { t, getLanguage }    from '../i18n.js';
import { $, $$, setText, setHTML, showScreen } from '../helpers/dom.js';
import { getUnlockLevel }   from '../helpers/modeUnlockHelper.js';
import { updateAvatarDisplay } from '../helpers/avatarDisplayHelper.js';
import { updateAdBanner, isAdFree } from '../services/AdService.js';
import { applyTheme }       from '../services/ThemeService.js';
import { getBodyFx }        from '../services/EffectsService.js';
import { updateXPBar }      from '../helpers/xpBarHelper.js';
import { checkOnboardingHints } from '../helpers/onboardingHints.js';
import { getOrSeedQuests, countCompleted as questsCompleted } from '../services/DailyQuestService.js';
import { getProgress as getPassProgress, PASS_STAGES } from '../services/SeasonPass.js';
import app                   from '../appState.js';

/* ═══════ Hero Carousel State ═══════ */
let carouselIdx = 0;            // current index into MODE_ORDER
let carouselTouchX = null;      // touch start X for swipe
let carouselAnimating = false;  // prevent double-swipe
const SWIPE_THRESHOLD = 40;     // px minimum for swipe

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

/* ═══════ Hero card ═══════ */
const MODE_DESC_KEYS = {
  klassik: 'mode_klassik_desc', beginner: 'mode_beginner_desc',
  expert: 'mode_expert_desc', ultra: 'mode_ultra_desc',
  mathe: 'mode_mathe_desc', worte: 'mode_worte_desc', memo: 'mode_memo_desc',
  sequenz: 'mode_sequenz_desc',
  stroop: 'mode_stroop_desc', fokus: 'mode_fokus_desc', chaos: 'mode_chaos_desc',
  hauptstaedte: 'mode_hauptstaedte_desc', algebra: 'mode_algebra_desc',
  wissen: 'mode_wissen_desc'
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
  wissen:   'rgba(251,191,36,0.22)',
};

export function updateHeroCard() {
  /* Now handled by renderCarousel() — kept as a no-op for compat */
  renderCarousel();
}

/* ═══════ Carousel Engine ═══════ */

/** Get the SVG HTML for a mode from the hidden template cards */
function getModeSVG(mode) {
  const card = $(`.mode-card[data-mode="${mode}"]`);
  if (!card) return '';
  const svg = card.querySelector('.mode-card-visual svg');
  return svg ? svg.outerHTML : '';
}

/** Build a single hero slide element */
function buildSlide(mode) {
  const { save } = app;
  const unlocked = save.isModeUnlocked(mode);
  const slide = document.createElement('div');
  slide.className = 'hero-slide';
  slide.dataset.mode = mode;
  slide.dataset.pos = 'hidden';

  if (unlocked) {
    const pb = save.getPB(mode);
    const lv = save.getModeLevel ? save.getModeLevel(mode) : 0;
    const lvName = save.getModeLevelName ? save.getModeLevelName(mode, getLanguage()) : '';
    const aura = MODE_AURA[mode] || 'rgba(124,58,237,0.5)';
    const lvProgress = save.getModeLevelProgress ? save.getModeLevelProgress(mode) : 0;
    const lvPct = Math.round(Math.min(1, Math.max(0, lvProgress)) * 100);
    const pins = save.data.pinnedModes || [null,null,null,null];
    const isPinned = pins.includes(mode);
    slide.innerHTML = `
      <div class="hero-slide-visual" style="--slide-aura:${aura}">${getModeSVG(mode)}</div>
      <span class="hero-slide-name">${t(`mode_${mode}`) || mode.toUpperCase()}</span>
      <span class="hero-slide-desc">${t(MODE_DESC_KEYS[mode] || 'mode_klassik_desc')}</span>
      <div class="hero-slide-badges">
        <span class="hero-slide-badge hero-slide-badge--pb">${pb > 0 ? `PB ${pb.toLocaleString()}` : (t('hero_first_record') || '--')}</span>
        ${lv > 0 ? `<span class="hero-slide-badge hero-slide-badge--level">Lv.${lv} ${lvName}</span>` : ''}
        ${(() => {
          if (app.mastery) {
            const tierInfo = app.mastery.getMasteryTier(mode);
            if (tierInfo.name && tierInfo.tier > 0) {
              return `<span class="hero-slide-badge hero-slide-badge--mastery">${tierInfo.name}</span>`;
            }
          }
          return '';
        })()}
      </div>
      <div class="hero-slide-level-bar"><div class="hero-slide-level-fill" style="width:${lvPct}%"></div></div>
      <button class="hero-pin-btn ${isPinned ? 'pinned' : ''}" data-pin-mode="${mode}" aria-label="${isPinned ? 'Unpin' : 'Pin'}">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="${isPinned ? 'M16 9V4h1V2H7v2h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z' : 'M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7v2h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1V2z'}"/></svg>
      </button>`;
  } else {
    const unlockLv = getUnlockLevel(mode);
    slide.innerHTML = `
      <div class="hero-slide-locked">
        <div class="hero-slide-visual" style="filter:grayscale(1) brightness(0.5)">${getModeSVG(mode)}</div>
        <span class="hero-slide-name" style="opacity:0.5">${t(`mode_${mode}`) || mode.toUpperCase()}</span>
        <span class="hero-slide-lock-label">Level ${unlockLv} ${t('required') || 'benötigt'}</span>
      </div>`;
  }
  return slide;
}

/** Render all slides and position them */
function renderCarousel() {
  const slider = $('#heroSlider');
  if (!slider) return;

  const modes = CONFIG.MODE_ORDER;
  const total = modes.length;

  // Rebuild slides
  slider.innerHTML = '';
  modes.forEach((mode, i) => {
    const slide = buildSlide(mode);
    slider.appendChild(slide);
  });

  positionSlides();
  updateBackdropAura();
}

/** Position slides relative to carouselIdx (infinite wrapping) */
function positionSlides() {
  const slider = $('#heroSlider');
  if (!slider) return;
  const slides = slider.querySelectorAll('.hero-slide');
  const total = slides.length;
  if (total === 0) return;

  slides.forEach((slide, i) => {
    const diff = ((i - carouselIdx) % total + total) % total;
    if (diff === 0) {
      slide.dataset.pos = 'current';
    } else if (diff === total - 1) {
      slide.dataset.pos = 'prev';
    } else if (diff === 1) {
      slide.dataset.pos = 'next';
    } else {
      slide.dataset.pos = 'hidden';
    }
  });

  // Update selected mode
  const currentMode = CONFIG.MODE_ORDER[carouselIdx];
  if (currentMode && app.save.isModeUnlocked(currentMode)) {
    if (app.selectedMode !== currentMode) {
      app.selectedMode = currentMode;
      app.save.setSetting('gameMode', currentMode);
    }
  }
}

/** Navigate carousel: direction = -1 (prev) or +1 (next) */
function navigateCarousel(direction) {
  if (carouselAnimating) return;
  carouselAnimating = true;
  const total = CONFIG.MODE_ORDER.length;
  const prevPlayType = app.selectedPlayType;
  carouselIdx = ((carouselIdx + direction) % total + total) % total;
  positionSlides();
  updateBackdropAura();
  updateHeroStats();
  updatePlayTypeSelector();
  // Restore play type if the new mode supports it (A6 fix)
  if (app.selectedMode !== 'sequenz' && prevPlayType) {
    app.selectedPlayType = prevPlayType;
    $$('.play-type-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.play === prevPlayType);
    });
  }
  updateQuickShortcuts();
  setTimeout(() => { carouselAnimating = false; }, 360);
}

/** Navigate to specific index */
function goToSlide(idx) {
  if (carouselAnimating || idx === carouselIdx) return;
  carouselAnimating = true;
  const prevPlayType = app.selectedPlayType;
  carouselIdx = idx;
  positionSlides();
  updateBackdropAura();
  updateHeroStats();
  updatePlayTypeSelector();
  // Restore play type if the new mode supports it (A6 fix)
  if (app.selectedMode !== 'sequenz' && prevPlayType) {
    app.selectedPlayType = prevPlayType;
    $$('.play-type-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.play === prevPlayType);
    });
  }
  updateQuickShortcuts();
  setTimeout(() => { carouselAnimating = false; }, 360);
}

/** Update backdrop aura color for current mode */
function updateBackdropAura() {
  const currentMode = CONFIG.MODE_ORDER[carouselIdx];
  const heroBackdrop = $('#heroBackdrop');
  if (heroBackdrop) {
    const aura = MODE_AURA[currentMode] || 'rgba(124,58,237,0.35)';
    heroBackdrop.style.background = `radial-gradient(ellipse 80% 70% at 50% 40%, ${aura} 0%, rgba(124,58,237,0.08) 50%, transparent 100%)`;
  }
}

/** Init carousel event listeners (called once) */
let carouselInitialized = false;
function initCarouselListeners() {
  if (carouselInitialized) return;
  carouselInitialized = true;

  // Arrow nav
  const prevBtn = $('#heroNavPrev');
  const nextBtn = $('#heroNavNext');
  if (prevBtn) prevBtn.addEventListener('click', () => navigateCarousel(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigateCarousel(1));

  // Touch/swipe on slider
  const slider = $('#heroSlider');
  if (slider) {
    slider.addEventListener('touchstart', (e) => {
      carouselTouchX = e.touches[0].clientX;
    }, { passive: true });

    slider.addEventListener('touchend', (e) => {
      if (carouselTouchX === null) return;
      const dx = e.changedTouches[0].clientX - carouselTouchX;
      carouselTouchX = null;
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        navigateCarousel(dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    // Delegated pin/unpin click
    slider.addEventListener('click', (e) => {
      const btn = e.target.closest('.hero-pin-btn');
      if (!btn) return;
      e.stopPropagation();
      const mode = btn.dataset.pinMode;
      togglePin(mode);
    });
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

/* ═══════ Quick shortcuts — 4 pinnable slots ═══════ */
function togglePin(mode) {
  const { save } = app;
  const pins = save.data.pinnedModes || [null, null, null, null];
  // Ensure exactly 4 slots
  while (pins.length < 4) pins.push(null);
  const idx = pins.indexOf(mode);
  let wasPinned = false;
  if (idx !== -1) {
    // Unpin
    pins[idx] = null;
    wasPinned = true;
  } else {
    // Pin into first empty slot
    const empty = pins.indexOf(null);
    if (empty !== -1) pins[empty] = mode;
  }
  save.data.pinnedModes = pins.slice(0, 4);
  save.save();
  renderCarousel();          // re-render pin icons on slides
  updateQuickShortcuts();

  // Toast feedback
  const modeName = t(`mode_${mode}`) || mode.toUpperCase();
  const msg = wasPinned ? t('pin_removed', { mode: modeName }) : t('pin_added', { mode: modeName });
  getBodyFx().achievementToast(msg);
}

function updateQuickShortcuts() {
  const el = $('#quickShortcuts');
  if (!el) return;
  const { save } = app;
  const pins = (save.data.pinnedModes || [null, null, null, null]).slice(0, 4);
  while (pins.length < 4) pins.push(null);
  const current = app.selectedMode;

  el.innerHTML = pins.map((m, i) => {
    if (m) {
      const isActive = m === current ? ' active' : '';
      const name = t(`mode_${m}`) || m.toUpperCase();
      return `<button class="qs-slot filled${isActive}" data-mode="${m}" data-slot="${i}">
        <span class="qs-slot-icon">${getModeSVG(m)}</span>
        <span class="qs-slot-name">${name}</span>
      </button>`;
    }
    return `<button class="qs-slot empty" data-slot="${i}"><span class="qs-slot-plus">+</span></button>`;
  }).join('');

  el.querySelectorAll('.qs-slot').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode) {
        // Navigate to pinned mode
        const idx = CONFIG.MODE_ORDER.indexOf(mode);
        if (idx !== -1) goToSlide(idx);
        updateQuickShortcuts();
      } else {
        // Empty slot → pin current carousel mode
        togglePin(current);
      }
    });
  });
}

/* ═══════ Mode selector ═══════ */
export function updateModeSelector() {
  /* Sync carousel index to current selectedMode */
  const modeIdx = CONFIG.MODE_ORDER.indexOf(app.selectedMode);
  if (modeIdx !== -1) carouselIdx = modeIdx;

  initCarouselListeners();
  renderCarousel();
  updateHeroStats();
}

/* ═══════ Play type selector ═══════ */
export function updatePlayTypeSelector() {
  const { save } = app;
  const isSequenz = app.selectedMode === 'sequenz';
  const isBrainReflex = ['mathe','worte','memo','sequenz','stroop','fokus','chaos','hauptstaedte','algebra','wissen'].includes(app.selectedMode);
  const competitionUnlocked = save.isCompetitionUnlocked();
  /* Sequenz forces endless — auto-select and disable others */
  if (isSequenz && app.selectedPlayType !== 'endless') {
    app.selectedPlayType = 'endless';
  }
  if (!competitionUnlocked && app.selectedPlayType === 'competition') {
    app.selectedPlayType = 'blitz';
  }
  $$('.play-type-btn').forEach(btn => {
    const play = btn.dataset.play;
    const shouldHide = (isSequenz && play !== 'endless') || (play === 'competition' && !competitionUnlocked);
    btn.hidden = shouldHide;
    btn.setAttribute('aria-hidden', shouldHide ? 'true' : 'false');
    btn.classList.toggle('selected', play === app.selectedPlayType);
    if (play === 'competition') {
      btn.classList.toggle('locked', !competitionUnlocked);
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
  const { save } = app;
  try {
    const result = await save.claimDailyLogin();
    if (!result) return;
    const livesEl = $('#homeLivesCount');
    if (livesEl) livesEl.textContent = save.getLives();
    const fireEl = $('#homeFireCount');
    if (fireEl) fireEl.textContent = save.getFireBalance();
    updateHeroStats();
  } catch { /* ignore */ }
}

/* ═══════ v60 Welle 4: Daily Quests panel ═══════ */
function renderDailyQuestsPanel() {
  const root = $('#dailyQuestsPanel');
  if (!root) return;
  const { save } = app;
  const quests = getOrSeedQuests(save);
  const list = $('#dqList');
  const head = $('#dqHeadCount');
  if (head) head.textContent = `${questsCompleted(save)}/${quests.length}`;
  if (!list) return;
  list.innerHTML = quests.map(q => {
    const done = q.progress >= q.target;
    const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
    const labelKey = `quest_label_${q.type}`;
    const labelTxt = (typeof t === 'function')
      ? t(labelKey, { n: q.target })
      : `${q.type} ${q.target}`;
    return `<li class="dq-item${done ? ' dq-done' : ''}" data-id="${q.id}">
      <div class="dq-text">
        <span class="dq-label">${labelTxt}</span>
        <span class="dq-reward">+${q.rewardXP} XP · +${q.rewardFire} 🔥</span>
      </div>
      <div class="dq-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="dq-progress-fill" style="transform:scaleX(${pct/100})"></div>
      </div>
      <span class="dq-count">${Math.min(q.progress, q.target)}/${q.target}</span>
    </li>`;
  }).join('');
}

/* ═══════ v60 Welle 4: Season Pass card ═══════ */
function renderSeasonPassCard() {
  const root = $('#seasonPassCard');
  if (!root) return;
  const { save } = app;
  const p = getPassProgress(save);
  if (!p) return;
  const pct = Math.min(1, p.points / p.nextAt);
  const fill = $('#spBarFill');
  if (fill) fill.style.transform = `scaleX(${pct})`;
  const meta = $('#spMeta');
  if (meta) {
    meta.textContent = (typeof t === 'function')
      ? t('sp_meta', { d: p.daysLeft })
      : `${p.daysLeft}d`;
  }
  const stage = $('#spStage');
  if (stage) {
    stage.textContent = (typeof t === 'function')
      ? t('sp_stage', { s: p.stage, total: p.totalStages })
      : `Stage ${p.stage}/${p.totalStages}`;
  }
  const next = $('#spNext');
  if (next) {
    next.textContent = (typeof t === 'function')
      ? t('sp_next', { n: Math.max(0, p.nextAt - p.points) })
      : `${Math.max(0, p.nextAt - p.points)} pts`;
  }
}

/* ═══════ Show home ═══════ */
export function showHome() {
  const { save, auth, audio } = app;
  showScreen('home', app);
  updateXPBar();
  updateModeSelector();
  updatePlayTypeSelector();
  updateHeroStats();
  updateQuickShortcuts();
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
  window.dispatchEvent(new Event('scs:update-wheel-card'));
  /* v60 Welle 4: Quests panel + Season Pass bar */
  try { renderDailyQuestsPanel(); } catch (e) { console.warn('quests render failed', e); }
  try { renderSeasonPassCard();    } catch (e) { console.warn('pass render failed',   e); }

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

  /* Onboarding hints for first-time users */
  checkOnboardingHints();
}
