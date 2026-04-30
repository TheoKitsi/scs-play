/* ═══════════════════════════════════════
   SCS Play — App Orchestrator
   Wires all modules, binds events, boots.
   ═══════════════════════════════════════ */
import { haptic } from './helpers/haptics.js';
import { CONFIG, DEBUG }    from './config.js';
import { t }                from './i18n.js';
import { $, $$, showScreen } from './helpers/dom.js';
import { initPerfMode }     from './helpers/perfMode.js';
import { AudioManager }     from './audio.js';
import { AuthService }      from './auth.js';
import { SaveService }      from './save.js';
import { GameEngine }       from './game/GameEngine.js';
import { shareScore }       from './services/ShareService.js';
import { initAdService, showRewardedAd } from './services/AdService.js';
import { bindMicroFeedback } from './helpers/microFeedback.js';
import { ModeMastery }      from './game/ModeMastery.js';
import app                  from './appState.js';

/* ─── Screens ─── */
import { boot }             from './screens/BootScreen.js';
import { bindAuth }         from './screens/AuthScreen.js';
import { showHome, getBodyFx, updateModeSelector, updatePlayTypeSelector }
                            from './screens/HomeScreen.js';
import { showTutorial, tutorialNext, tutorialPrev, tutorialFinish }
                            from './screens/TutorialScreen.js';
import { startGame, beginGame, doCountdown, pauseGame, resumeGame,
         restartGame, quitGame, stopPractice }
                            from './screens/GameScreen.js';
import { showResults, showContinuePrompt, doContinue, declineContinue,
         updateLivesDisplay, wasLastGameGood }
                            from './screens/ResultsScreen.js';
import { showLeaderboard }  from './screens/LeaderboardScreen.js';
import { showAchievements } from './screens/AchievementsScreen.js';
import { showSettings, bindSettings }
                            from './screens/SettingsScreen.js';
import { showStore, bindShopTabs, updateShopLives }
                            from './screens/StoreScreen.js';
import { showAvatarSelect, bindAvatarSave }
                            from './screens/AvatarScreen.js';
import { showEngagementReport }
                            from './screens/EngagementReportScreen.js';
import { bindWheel, updateWheelCard }
                            from './screens/WheelScreen.js';

/* ═══════ Perf-mode + a11y baseline (must run before screens render) ═══════ */
initPerfMode();

/* ═══════ Instantiate core services ═══════ */
app.audio = new AudioManager();
app.auth  = new AuthService();
app.save  = new SaveService(app.auth);
app.game  = new GameEngine();
app.mastery = new ModeMastery(app.save);

try {
  if (globalThis.localStorage?.getItem('scsQa') === '1') {
    globalThis.__SCS_QA__ = {
      forceGameOver() {
        app.game?._endGame();
      },
      setContinued(value = true) {
        if (app.game) app.game.continued = value;
      },
    };
  }
} catch { /* ignore QA hook setup failures */ }


/* ═══════ Offline / Online indicator ═══════ */
function initOfflineIndicator() {
  const toast = $('#offlineToast');
  const msgEl = $('#offlineMsg');
  if (!toast) return;

  function showToast(isOnline) {
    if (msgEl) msgEl.textContent = isOnline ? t('online_msg') : t('offline_msg');
    toast.classList.toggle('online', isOnline);
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 5000);
  }

  window.addEventListener('offline', () => showToast(false));
  window.addEventListener('online',  () => showToast(true));
}

/* ═══════ Visibility API — auto-pause ═══════ */
function initVisibilityPause() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && app.currentScreen === 'game' && app.game.running && !app.game.paused) {
      pauseGame();
    }
  });
}

/* ═══════ Orientation check ═══════ */
function checkOrientation() {
  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  const isPhoneLikeViewport = Math.min(window.innerWidth, window.innerHeight) <= 900;
  $('#landscapeWarning')?.classList.toggle('active', isLandscape && isTouchDevice && isPhoneLikeViewport);
}

/* ═══════ Screen Wake Lock (prevent sleep during gameplay) ═══════ */
let _wakeLock = null;
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { _wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
async function releaseWakeLock() {
  if (_wakeLock) { try { await _wakeLock.release(); } catch {} _wakeLock = null; }
}
app.requestWakeLock = requestWakeLock;
app.releaseWakeLock = releaseWakeLock;

/* ═══════ Global error boundary ═══════ */
function initErrorBoundary() {
  window.addEventListener('error', (e) => {
    if (DEBUG) console.error('[SCS Error]', e.message, e.filename, ':', e.lineno);
    e.preventDefault();
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (DEBUG) console.error('[SCS Rejection]', e.reason);
    e.preventDefault();
  });
}

/* ═══════ PWA Install Prompt ═══════ */
let _deferredInstall = null;
const _INSTALL_DISMISS_KEY = 'scs_install_dismissed';

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredInstall = e;
  /* Don't show if user dismissed within last 7 days */
  const dismissed = localStorage.getItem(_INSTALL_DISMISS_KEY);
  if (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400000) return;
  const banner = $('#pwaInstallBanner');
  if (banner) banner.style.display = '';
});

/* Dismiss banner (hide for 7 days) */
document.addEventListener('click', (e) => {
  if (e.target.closest('#btnDismissInstall')) {
    const banner = $('#pwaInstallBanner');
    if (banner) banner.style.display = 'none';
    localStorage.setItem(_INSTALL_DISMISS_KEY, String(Date.now()));
  }
});

app.promptInstall = async () => {
  if (!_deferredInstall) return false;
  _deferredInstall.prompt();
  const { outcome } = await _deferredInstall.userChoice;
  _deferredInstall = null;
  const banner = $('#pwaInstallBanner');
  if (banner) banner.style.display = 'none';
  return outcome === 'accepted';
};

/* ═══════ SPA Back-button support ═══════ */
function initBackButton() {
  window.addEventListener('popstate', () => {
    if (app.currentScreen && app.currentScreen !== 'home' && app.currentScreen !== 'boot' && app.currentScreen !== 'auth') {
      if (app.currentScreen === 'game' && app.game.running && !app.game.paused) {
        pauseGame();
      } else {
        showHome();
      }
    }
  });
}

/* ═══════ Stat tooltips ═══════ */
function _showTooltip(i18nKey, el) {
  getBodyFx().achievementToast(t(i18nKey));
  app.audio.tap();
  if (el) { el.classList.add('stat-tapped'); setTimeout(() => el.classList.remove('stat-tapped'), 300); }
}

function bindStatTooltips() {
  $$('.stat-clickable').forEach(el => {
    el.addEventListener('click', () => { const key = el.dataset.tooltip; if (key) _showTooltip(key, el); });
  });
  $('#xpSection')?.addEventListener('click', () => _showTooltip('tooltip_level'));
  $('#homeLivesBadge')?.addEventListener('click', () => _showTooltip('tooltip_lives'));
}

/* ═══════ Navigation wrappers ═══════ */
const navShowHome  = () => showHome();
const navShowAuth  = () => showScreen('auth', app);
const navShowStore = () => showStore(navShowHome);

const navShowResults        = (stats, cc) => showResults(stats, cc);
const navShowContinuePrompt = (stats) => showContinuePrompt(stats);
const navShowTutorial       = () => showTutorial();

const navStartGame = (practice = false, daily = false) => {
  startGame(practice, daily, navShowTutorial, navShowResults, navShowHome, navShowContinuePrompt);
};

const navTutorialFinish = () => {
  tutorialFinish(doCountdown, (practice, daily) => {
    beginGame(practice, daily, navShowResults, navShowHome, navShowContinuePrompt);
  });
};

/* ═══════ Bind all events ═══════ */
function bindEvents() {
  const { save, audio } = app;

  bindAuth(navShowHome);
  bindSettings(navShowHome);
  bindStatTooltips();
  bindMicroFeedback();

  /* ─ Mode selector ─ */
  $$('.mode-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (!save.isModeUnlocked(mode)) {
        let reqLevel = 1;
        if (mode === 'expert')     reqLevel = CONFIG.UNLOCK_EXPERT + 1;
        else if (mode === 'ultra') reqLevel = CONFIG.UNLOCK_ULTRA + 1;
        else if (mode === 'memo')  reqLevel = (CONFIG.UNLOCK_MEMO || 0) + 1;
        else if (mode === 'sequenz') reqLevel = (CONFIG.UNLOCK_SEQUENZ || 0) + 1;
        else if (mode === 'stroop') reqLevel = (CONFIG.UNLOCK_STROOP || 0) + 1;
        else if (mode === 'fokus') reqLevel = (CONFIG.UNLOCK_FOKUS || 0) + 1;
        else if (mode === 'chaos') reqLevel = (CONFIG.UNLOCK_CHAOS || 0) + 1;
        else if (mode === 'hauptstaedte') reqLevel = (CONFIG.UNLOCK_HAUPTSTAEDTE || 0) + 1;
        else if (mode === 'algebra') reqLevel = (CONFIG.UNLOCK_ALGEBRA || 0) + 1;
        else if (mode === 'wissen') reqLevel = (CONFIG.UNLOCK_WISSEN || 0) + 1;
        getBodyFx().achievementToast(t('mode_locked_toast', { n: reqLevel }));
        return;
      }
      app.selectedMode = mode;
      save.setSetting('gameMode', mode);
      updateModeSelector();
      audio.tap();
    });
  });

  /* ─ Play type selector ─ */
  $$('.play-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const play = btn.dataset.play;
      if (play === 'competition' && !save.isCompetitionUnlocked()) {
        getBodyFx().achievementToast(t('play_competition_locked'));
        return;
      }
      /* Sequenz forces endless — block non-endless selection */
      if (app.selectedMode === 'sequenz' && play !== 'endless') {
        getBodyFx().achievementToast(t('sequenz_endless_only') || 'Sequenz: nur Endlos');
        return;
      }
      app.selectedPlayType = play;
      save.setSetting('playType', play);
      updatePlayTypeSelector();
      audio.tap();
    });
  });

  /* ─ Primary actions ─ */
  $('#btnPlay')?.addEventListener('click',         () => { app.engagement?.trackGameStart(); navStartGame(false, false); });
  $('#btnDaily')?.addEventListener('click',        () => { if (!save.hasDailyToday()) { app.engagement?.trackGameStart(); navStartGame(false, true); } });
  $('#btnLeaderboard')?.addEventListener('click',  () => showLeaderboard());
  $('#btnAchievements')?.addEventListener('click', () => showAchievements());
  $('#btnSettings')?.addEventListener('click',     () => showSettings(false, navShowHome));
  $('#btnStore')?.addEventListener('click',        () => navShowStore());
  $('#btnLogout')?.addEventListener('click',       async () => { await app.auth.signOut(); navShowAuth(); });
  $('#btnInstallPWA')?.addEventListener('click',   () => app.promptInstall());
  $('#btnEngagementReport')?.addEventListener('click', () => showEngagementReport());

  /* ─ Avatar ─ */
  $('#btnAvatar')?.addEventListener('click',  () => showAvatarSelect(navShowStore));
  $('#homeAvatar')?.addEventListener('click', () => showAvatarSelect(navShowStore));
  bindAvatarSave(navShowHome);

  /* ─ Tutorial ─ */
  $('#btnTutorialNext')?.addEventListener('click', () => tutorialNext(navTutorialFinish));
  $('#btnTutorialPrev')?.addEventListener('click', () => tutorialPrev());
  $('#btnTutorialSkip')?.addEventListener('click', () => navTutorialFinish());

  /* ─ Results & navigation ─ */
  $('#btnHome')?.addEventListener('click',    () => { app.engagement?.trackPostGameAction('home', wasLastGameGood()); navShowHome(); });
  $('#btnOneMore')?.addEventListener('click', () => { app.engagement?.trackPostGameAction('retry', wasLastGameGood()); app.engagement?.trackGameStart(); navStartGame(false, false); });
  $('#btnShare')?.addEventListener('click',   () => { app.engagement?.trackPostGameAction('share', wasLastGameGood()); shareScore(app.lastResultStats, getBodyFx); });

  /* ─ Game controls ─ */
  $('#btnStopPractice')?.addEventListener('click', () => stopPractice(navShowHome));
  $('#btnPause')?.addEventListener('click',        (e) => { e.stopPropagation(); pauseGame(); });
  $('#btnResume')?.addEventListener('click',        () => resumeGame());
  $('#btnPauseRestart')?.addEventListener('click',  () => restartGame(navShowTutorial, navShowResults, navShowHome, navShowContinuePrompt));
  $('#btnPauseSettings')?.addEventListener('click', () => {
    $('#pauseOverlay')?.classList.remove('active');
    showSettings(true, navShowHome);
  });
  $('#btnPauseQuit')?.addEventListener('click', () => { app.engagement?.trackPauseToQuit(); quitGame(navShowHome); });

  /* ─ Continue prompt ─ */
  $('#btnResContinueUse')?.addEventListener('click', () => doContinue());
  $('#btnResContinueNo')?.addEventListener('click',  () => declineContinue());
  $('#btnResContinueBuy')?.addEventListener('click', () => {
    app.continueStats = null;
    app.game.declineContinue();
    navShowStore();
  });
  $('#btnResContinueAd')?.addEventListener('click', async () => {
    const rewarded = await showRewardedAd(save);
    if (!rewarded) {
      getBodyFx().achievementToast(t('ad_failed') || 'Ad not available');
      return;
    }
    await save.addLives(CONFIG.LIVES_REWARDED_AD);
    updateLivesDisplay();
    updateShopLives();
    getBodyFx().achievementToast(t('iap_lives_added', { n: CONFIG.LIVES_REWARDED_AD }));
    setTimeout(() => doContinue(), 500);
  });

  /* ─ Shop tabs ─ */
  bindShopTabs();
  bindWheel();

  /* ─ Back button fallback ─ */
  $$('.btn-back').forEach(btn => {
    if (!btn.dataset.backBound) {
      btn.dataset.backBound = '1';
      btn.addEventListener('click', () => {
        if (!btn._customBack) navShowHome();
      });
    }
  });

  /* ─ Bottom back buttons (phone-friendly) ─ */
  $$('.btn-back-bottom').forEach(btn => {
    btn.addEventListener('click', () => navShowHome());
  });

  /* ─ Orientation ─ */
  if (screen.orientation) screen.orientation.addEventListener('change', checkOrientation);
  window.addEventListener('resize', checkOrientation, { passive: true });
}

/* ═══════ Gesture-nav detection (fullscreen / standalone PWA) ═══════ */
function initGestureNavInset() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isAndroid && !isIOS) return;

  const mqFull = matchMedia('(display-mode: fullscreen)');
  const mqStandalone = matchMedia('(display-mode: standalone)');
  const iosStandalone = navigator.standalone === true;

  const apply = () => {
    // In fullscreen / standalone mode env(safe-area-inset-bottom) can return 0
    // on many Android devices, so we inject a CSS variable as fallback
    // covering the gesture-nav pill area (~24dp + pad).
    const immersive = mqFull.matches || mqStandalone.matches || iosStandalone;
    const offset = immersive ? '34px' : '0px';
    document.documentElement.style.setProperty('--gesture-nav-inset', offset);
  };
  apply();
  mqFull.addEventListener('change', apply);
  mqStandalone.addEventListener('change', apply);
}

/* ═══════ Init ═══════ */
document.addEventListener('DOMContentLoaded', () => {
  initGestureNavInset();
  initErrorBoundary();
  /* global-haptics-bound */
  document.addEventListener('click', (e) => {
    const tapTarget = e.target.closest('button, .btn, .mode-card, .play-type-btn, input[type="checkbox"], select, .footer-item, .item-card, .avatar-option');
    if (tapTarget) haptic('tap', app.save);
  });
  bindEvents();
  initAdService();
  boot(navShowHome, navShowAuth);
  initOfflineIndicator();
  initVisibilityPause();
  initBackButton();
  checkOrientation();
});
