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
    slide.innerHTML = `
      <div class="hero-slide-visual" style="--slide-aura:${aura}">${getModeSVG(mode)}</div>
      <span class="hero-slide-name">${t(`mode_${mode}`) || mode.toUpperCase()}</span>
      <span class="hero-slide-desc">${t(MODE_DESC_KEYS[mode] || 'mode_klassik_desc')}</span>
      <div class="hero-slide-badges">
        <span class="hero-slide-badge hero-slide-badge--pb">${pb > 0 ? `PB ${pb.toLocaleString()}` : (t('hero_first_record') || '--')}</span>
        ${lv > 0 ? `<span class="hero-slide-badge hero-slide-badge--level">Lv.${lv} ${lvName}</span>` : ''}
      </div>`;
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
  updatePinButton();
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
    app.selectedMode = currentMode;
  }
}

/** Navigate carousel: direction = -1 (prev) or +1 (next) */
function navigateCarousel(direction) {
  if (carouselAnimating) return;
  carouselAnimating = true;
  const total = CONFIG.MODE_ORDER.length;
  carouselIdx = ((carouselIdx + direction) % total + total) % total;
  positionSlides();
  updateBackdropAura();
  updatePinButton();
  updateHeroStats();
  updatePlayTypeSelector();
  updateShortcutGrid();
  setTimeout(() => { carouselAnimating = false; }, 360);
}

/** Navigate to specific index */
function goToSlide(idx) {
  if (carouselAnimating || idx === carouselIdx) return;
  carouselAnimating = true;
  carouselIdx = idx;
  positionSlides();
  updateBackdropAura();
  updatePinButton();
  updateHeroStats();
  updatePlayTypeSelector();
  updateShortcutGrid();
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

/** Update pin button state */
function updatePinButton() {
  const btn = $('#heroPinBtn');
  if (!btn) return;
  const currentMode = CONFIG.MODE_ORDER[carouselIdx];
  const pinned = app.save.data.pinnedModes || [];
  const isPinned = pinned.includes(currentMode);
  btn.classList.toggle('pinned', isPinned);
  const label = $('#heroPinLabel');
  if (label) {
    if (currentMode === 'klassik') {
      label.textContent = 'Fixiert';
    } else {
      label.textContent = isPinned ? 'Entfernen' : 'Pinnen';
    }
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
  }

  // Pin button
  const pinBtn = $('#heroPinBtn');
  if (pinBtn) {
    pinBtn.addEventListener('click', () => {
      const currentMode = CONFIG.MODE_ORDER[carouselIdx];
      if (!app.save.isModeUnlocked(currentMode)) return;
      togglePin(currentMode);
    });
  }
}

/* ═══════ Shortcut Pinboard ═══════ */

const SHORTCUT_SLOTS = 8; // 4x2 grid

/** Toggle a mode's pinned state */
function togglePin(mode) {
  // FARBEN (klassik) is always locked at slot 0
  if (mode === 'klassik') return;
  const pinned = app.save.data.pinnedModes || [];

  if (pinned.includes(mode)) {
    // Unpin: replace with null (but protect slot 0 = klassik)
    const idx = pinned.indexOf(mode);
    if (idx === 0) return; // slot 0 is reserved
    pinned[idx] = null;
  } else {
    // Pin: find first empty slot
    const emptyIdx = pinned.indexOf(null);
    if (emptyIdx !== -1) {
      pinned[emptyIdx] = mode;
    } else if (pinned.length < SHORTCUT_SLOTS) {
      pinned.push(mode);
    } else {
      return; // No empty slots
    }
  }
  // Ensure slot 0 is always klassik
  if (pinned[0] !== 'klassik') {
    // Remove klassik from wherever it is
    const kIdx = pinned.indexOf('klassik');
    if (kIdx > 0) pinned[kIdx] = null;
    pinned[0] = 'klassik';
  }
  // Ensure array is always SHORTCUT_SLOTS long
  while (pinned.length < SHORTCUT_SLOTS) pinned.push(null);
  app.save.data.pinnedModes = pinned.slice(0, SHORTCUT_SLOTS);
  app.save.save();
  updateShortcutGrid();
  updatePinButton();
}

/** Render the shortcut grid */
export function updateShortcutGrid() {
  const grid = $('#shortcutGrid');
  if (!grid) return;

  const pinned = app.save.data.pinnedModes || [];
  // Ensure slot 0 is always klassik
  if (pinned[0] !== 'klassik') pinned[0] = 'klassik';
  // Ensure we always have SHORTCUT_SLOTS entries
  while (pinned.length < SHORTCUT_SLOTS) pinned.push(null);

  grid.innerHTML = '';
  pinned.slice(0, SHORTCUT_SLOTS).forEach((mode, i) => {
    const slot = document.createElement('button');
    slot.className = 'shortcut-slot';

    if (mode && app.save.isModeUnlocked(mode)) {
      slot.dataset.mode = mode;
      if (mode === app.selectedMode) slot.classList.add('selected');
      const svgHTML = getModeSVG(mode);
      const modeName = t(`mode_${mode}`) || mode.toUpperCase();
      slot.innerHTML = `<div class="shortcut-visual">${svgHTML}</div><span class="shortcut-name">${modeName}</span>`;
      slot.addEventListener('click', () => {
        app.selectedMode = mode;
        // Sync carousel to this mode
        const modeIdx = CONFIG.MODE_ORDER.indexOf(mode);
        if (modeIdx !== -1) goToSlide(modeIdx);
        updateShortcutGrid();
        updatePlayTypeSelector();
        updateHeroStats();
      });
    } else {
      slot.classList.add('empty');
      slot.innerHTML = `<svg class="shortcut-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
    }
    grid.appendChild(slot);
  });
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
  /* Sync carousel index to current selectedMode */
  const modeIdx = CONFIG.MODE_ORDER.indexOf(app.selectedMode);
  if (modeIdx !== -1) carouselIdx = modeIdx;

  initCarouselListeners();
  renderCarousel();
  updateShortcutGrid();
  updateHeroStats();
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
