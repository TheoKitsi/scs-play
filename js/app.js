/* ═══════════════════════════════════════
   SCS Play — App Orchestrator
   Wires all modules, binds events, boots.
   ═══════════════════════════════════════ */
import { haptic } from './helpers/haptics.js';
import { DEBUG }            from './config.js';
import { t }                from './i18n.js';
import { $, $$, showScreen } from './helpers/dom.js';
import { closeModal }        from './helpers/modal.js';
import { appDialog } from './helpers/appDialog.js';
import { initPerfMode }     from './helpers/perfMode.js';
import { getUnlockLevel }   from './helpers/modeUnlockHelper.js';
import { bindQaHooks, checkOrientation, initBackButton, initErrorBoundary,
         initGestureNavInset, initOfflineIndicator, initOrientationListeners,
         initPwaInstallPrompt, initVisibilityPause, initWakeLock }
                            from './helpers/systemIntegration.js';
import { AudioManager }     from './audio.js';
import { AuthService }      from './auth.js';
import { SaveService }      from './save.js';
import { GameEngine }       from './game/GameEngine.js';
import { shareScore }       from './services/ShareService.js';
import { bindMicroFeedback } from './helpers/microFeedback.js';
import { ModeMastery }      from './game/ModeMastery.js';
import app                  from './appState.js';

/* ─── Screens ─── */
import { applyLoadedSave, boot } from './screens/BootScreen.js';
import { bindAuth }         from './screens/AuthScreen.js';
import { showHome, updateModeSelector, updatePlayTypeSelector }
                            from './screens/HomeScreen.js';
import { getBodyFx }        from './services/EffectsService.js';
import { showTutorial, tutorialNext, tutorialPrev, tutorialFinish }
                            from './screens/TutorialScreen.js';
import { showResults, showContinuePrompt, doContinue, declineContinue,
         wasLastGameGood }
                            from './screens/ResultsScreen.js';
import { showSettings, bindSettings, backFromSettings }
                            from './screens/SettingsScreen.js';
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
bindQaHooks();
initWakeLock();
initPwaInstallPrompt();

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
  $('#homeLivesBadge')?.addEventListener('click', () => appDialog({ title: t('reserve_lives'), message: t('reserve_lives_help') }));
}

/* ═══════ Navigation wrappers ═══════ */
let trialReturnMode = null;
let quickSelection = null;
let hubSection = 'play', catalog = new URL(location.href).searchParams.get('view') === 'arcade';
let hubTicket = 0;
async function openShelf(load, render, title) {
  const from = app.currentScreen, ticket = ++hubTicket;
  try {
    const screen = await load();
    if (app.currentScreen === from && ticket === hubTicket) render(screen);
  } catch {
    if (app.currentScreen === from && ticket === hubTicket) await appDialog({title:t(title),message:t('error_network')});
  }
}
const showAchievements = () => openShelf(()=>import('./screens/AchievementsScreen.js'),m=>m.showAchievements(),'achievements_short');
const showLeaderboard = () => openShelf(()=>import('./screens/LeaderboardScreen.js'),m=>m.showLeaderboard(),'leaderboard');
const goHub = async (section = 'play') => {
  const ticket = ++hubTicket, from = app.currentScreen;
  const { showPlayHub } = await import('./screens/PlayHub.js');
  if (ticket !== hubTicket || from !== app.currentScreen) return;
  catalog = false; hubSection = section;
  showPlayHub(section, (action, last) => {
    if (action === 'catalog') { catalog = true; showHome(); }
    else if (action === 'worlds') navPrism();
    else if (action === 'resume' && !last) navPrism(null, true);
    else if (action === 'play' || action === 'collection') goHub(action);
    else if (action === 'records') showLeaderboard();
    else if (action === 'awards') showAchievements();
    else if (action === 'looks') navShowStore();
    else if (action === 'settings') showSettings(false, navShowHome);
    else navStartGame(false, false, null, action === 'resume' ? last : {mode:action,type:'blitz'});
  });
};
const navShowHome  = () => {
  if (quickSelection) {
    Object.assign(app, quickSelection); quickSelection = null;
    delete $('#game').dataset.quickColors;
    delete $('#game').dataset.hubRound;
  }
  if (trialReturnMode) { app.selectedMode = trialReturnMode; trialReturnMode = null; }
  if (catalog) showHome(); else goHub(hubSection);
};
const navShowAuth  = () => showScreen('auth', app);
let shopBound = false;
const navShowStore = () => openShelf(()=>import('./screens/StoreScreen.js'),screen=>{
  if (!shopBound) {screen.bindShopTabs();shopBound=true}
  screen.showStore(navShowHome);
},'store');
const navActivateHome = async () => {
  await app.save.load();
  applyLoadedSave();
  showHome();
};

const navShowResults        = (stats, cc) => showResults(stats, cc);
const navShowContinuePrompt = (stats) => showContinuePrompt(stats);
const navShowTutorial       = () => showTutorial();

let gameScreenPromise;
const loadGameScreen = () => gameScreenPromise ||= import('./screens/GameScreen.js').then(async screen => {
  await screen.prepareArenaEngine();
  return screen;
}).catch(error=>{ gameScreenPromise=null; throw error; });

function loadingNotice(label) {
  const status=document.createElement('div');
  status.className='launch-notice'; status.setAttribute('role','status');
  const timer=setTimeout(()=>{status.textContent=label;document.body.appendChild(status)},400);
  const stop=()=>{clearTimeout(timer);status.remove();window.removeEventListener('scs:screenchange',stop)};
  window.addEventListener('scs:screenchange',stop);
  return stop;
}

let prismLoading = false;
const navPrism = async (challengeId = null, play = false) => {
  const from = app.currentScreen;
  if (prismLoading || !['home', 'hub', 'boot'].includes(from)) return;
  prismLoading = true;
  const entry = from === 'hub' ? $(`#hub [data-action="${play?'resume':'worlds'}"]`) : from === 'home' ? $(play ? '#btnPrismPlay' : '#btnPrism') : null;
  entry?.setAttribute('aria-busy', 'true');
  const hideNotice=loadingNotice(t('enter_garden'));
  try {
    const { openPrism } = await import('./screens/PrismScreen.js');
    if (app.currentScreen === from) openPrism({ onHome: navShowHome, onHub: goHub, onQuickColors: () => navStartGame(), challengeId, play });
  } catch {
    if (app.currentScreen === from) {
      if (from === 'boot') navShowHome();
      await appDialog({ title: 'Prism Worlds', message: t('prism_load_error') });
    }
  } finally {
    prismLoading = false; hideNotice(); entry?.removeAttribute('aria-busy');
  }
};

let gameLoading = false;
const navStartGame = async (practice = false, daily = false, trialMode = null, choice = null) => {
  const from = app.currentScreen;
  if (gameLoading || !['home', 'hub', 'results', 'prism', 'leaderboard'].includes(from)) return;
  if ((from === 'hub' || from === 'leaderboard') && (!choice || !app.save.isModeUnlocked(choice.mode) ||
      !['blitz','classic','endless','competition'].includes(choice.type) || (choice.type === 'competition' && !app.save.isCompetitionUnlocked()) ||
      (choice.mode === 'sequenz' && choice.type !== 'endless'))) return;
  gameLoading = true;
  let cancelled = false;
  const cancelOnNavigation = ({ detail }) => { if (detail.id !== from) cancelled = true; };
  const entry = from === 'hub' ? $('#hub [data-action]:focus') : $(from === 'leaderboard' ? '#btnLbPlayNow' : from === 'prism' ? '#pwQuickColors' : from === 'home' ? '#btnPlay' : practice ? '#btnPracticeResult' : '#btnOneMore');
  entry?.setAttribute('aria-busy', 'true');
  const hideNotice=loadingNotice(t('enter_arcade'));
  window.addEventListener('scs:screenchange', cancelOnNavigation);
  try {
    const gameScreen = await loadGameScreen();
    if (!cancelled && app.currentScreen === from && !app.gameStarting) {
      if (from === 'prism' || from === 'hub' || from === 'leaderboard') {
        if (from === 'leaderboard' && !entry?.isConnected) return;
        if (from === 'prism' && (!entry?.isConnected || $('#pwDialog.active'))) return;
        quickSelection = { selectedMode: app.selectedMode, selectedPlayType: app.selectedPlayType };
        app.selectedMode = choice?.mode || 'klassik'; app.selectedPlayType = choice?.type || 'blitz';
        $('#game').dataset.hubRound = app.selectedMode;
        if (app.selectedMode === 'klassik') $('#game').dataset.quickColors = '';
        app.engagement?.trackGameStart();
      }
      if (trialMode) {
        if (!practice || !$('#heroSlider .hero-slide[data-pos="current"] [data-trial="' + CSS.escape(trialMode) + '"]')) return;
        trialReturnMode = app.selectedMode;
        app.selectedMode = trialMode;
      }
      gameScreen.startGame(practice, daily, navShowTutorial, navShowResults, navShowHome, navShowContinuePrompt);
    }
  } catch {
    if (!cancelled) await appDialog({ title: 'Prism Arcade', message: t('game_load_error') });
  } finally {
    window.removeEventListener('scs:screenchange', cancelOnNavigation);
    hideNotice();
    entry?.removeAttribute('aria-busy');
    gameLoading = false;
  }
};

const navTutorialFinish = async () => {
  const gameScreen = await loadGameScreen();
  tutorialFinish(gameScreen.doCountdown, (practice, daily) => {
    gameScreen.beginGame(practice, daily, navShowResults, navShowHome, navShowContinuePrompt);
  });
};

const withGameScreen = (action) => loadGameScreen().then(action);
const pauseLoadedGame = () => gameScreenPromise?.then(m => m.pauseGame());
const quitLoadedGame = () => gameScreenPromise?.then(m => m.quitGame(navShowHome));

/* ═══════ Bind all events ═══════ */
function bindEvents() {
  const { save, audio } = app;

  bindAuth(navActivateHome);
  bindSettings(navShowHome);
  window.addEventListener('scs:play-record-mode', ({detail}) => {
    if (app.currentScreen === 'leaderboard') navStartGame(false,false,null,detail);
  });
  bindStatTooltips();
  bindMicroFeedback();

  /* ─ Mode selector ─ */
  $$('.mode-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (!save.isModeUnlocked(mode)) {
        const reqLevel = getUnlockLevel(mode);
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
  $('#catalogHub').onclick = () => goHub();
  $('#btnPrism')?.addEventListener('click', () => navPrism());
  $('#btnPrismPlay')?.addEventListener('click', () => navPrism(null, true));
  $('#heroSlider')?.addEventListener('click', event => {
    const button = event.target.closest('[data-trial]');
    if (button) navStartGame(true, false, button.dataset.trial);
  });
  $('#btnPlay')?.addEventListener('click',         () => { app.engagement?.trackGameStart(); navStartGame(false, false); });
  $('#btnDaily')?.addEventListener('click',        () => { if (!save.hasDailyToday()) { app.engagement?.trackGameStart(); navStartGame(false, true); } });
  $('#btnLeaderboard')?.addEventListener('click',  () => showLeaderboard());
  $('#btnAchievements')?.addEventListener('click', () => showAchievements());
  $('#btnSettings')?.addEventListener('click',     () => showSettings(false, navShowHome));
  $('#btnStore')?.addEventListener('click',        () => navShowStore());
  $('#btnLogout')?.addEventListener('click',       async () => {
    await app.save.save();
    await app.auth.signOut();
    await app.save.load();
    applyLoadedSave();
    navShowAuth();
  });
  $('#btnInstallPWA')?.addEventListener('click',   () => app.promptInstall());
  $('#btnEngagementReport')?.addEventListener('click', async () => {
    const { showEngagementReport } = await import('./screens/EngagementReportScreen.js');
    showEngagementReport();
  });

  /* ─ Avatar ─ */
  let avatarSaveBound = false;
  const openAvatar = async () => {
    const avatarScreen = await import('./screens/AvatarScreen.js');
    if (!avatarSaveBound) {
      avatarScreen.bindAvatarSave(navShowHome);
      avatarSaveBound = true;
    }
    avatarScreen.showAvatarSelect(navShowStore);
  };
  $('#btnAvatar')?.addEventListener('click', openAvatar);
  $('#homeAvatar')?.addEventListener('click', openAvatar);

  /* ─ Tutorial ─ */
  $('#btnTutorialNext')?.addEventListener('click', () => tutorialNext(navTutorialFinish));
  $('#btnTutorialPrev')?.addEventListener('click', () => tutorialPrev());
  $('#btnTutorialSkip')?.addEventListener('click', () => navTutorialFinish());

  /* ─ Results & navigation ─ */
  $('#btnHome')?.addEventListener('click',    () => { app.engagement?.trackPostGameAction('home', wasLastGameGood()); navShowHome(); });
  $('#btnOneMore')?.addEventListener('click', () => { app.engagement?.trackPostGameAction('retry', wasLastGameGood()); app.engagement?.trackGameStart(); navStartGame(false, false); });
  $('#btnShare')?.addEventListener('click',   () => { app.engagement?.trackPostGameAction('share', wasLastGameGood()); shareScore(app.lastResultStats, getBodyFx); });
  $('#btnPracticeResult')?.addEventListener('click', () => {
    const stats = app.lastResultStats;
    if (!stats || app.currentScreen !== 'results' || app.continueStats || !save.isModeUnlocked(stats.mode)) return;
    app.selectedMode = stats.mode;
    navStartGame(true, false);
  });

  /* ─ Game controls ─ */
  $('#btnStopPractice')?.addEventListener('click', () => withGameScreen(m => m.stopPractice(navShowHome)));
  $('#btnPause')?.addEventListener('click',        (e) => { e.stopPropagation(); withGameScreen(m => m.pauseGame()); });
  $('#btnResume')?.addEventListener('click',        () => withGameScreen(m => m.resumeGame()));
  $('#btnPauseRestart')?.addEventListener('click',  () => withGameScreen(m => m.restartGame(navShowTutorial, navShowResults, navShowHome, navShowContinuePrompt)));
  $('#btnPauseSettings')?.addEventListener('click', () => {
    closeModal($('#pauseOverlay'), { restoreFocus: false });
    showSettings(true, navShowHome, () => {
      showScreen('game', app);
      withGameScreen(m => m.reopenPauseMenu());
    });
  });
  $('#btnPauseQuit')?.addEventListener('click', () => { app.engagement?.trackPauseToQuit(); withGameScreen(m => m.quitGame(navShowHome)); });

  /* ─ Continue prompt ─ */
  $('#btnResContinueUse')?.addEventListener('click', () => doContinue(cancel => withGameScreen(m => m.resumeContinuedGame(cancel))));
  $('#btnResContinueNo')?.addEventListener('click',  () => declineContinue());
  /* ─ Shop tabs ─ */
  bindWheel();
  window.addEventListener('scs:show-home', navShowHome);
  window.addEventListener('scs:update-wheel-card', updateWheelCard);

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
    btn.addEventListener('click', () => {
      if (!btn._customBack) navShowHome();
    });
  });

  initOrientationListeners(pauseLoadedGame);
}

/* ═══════ Init ═══════ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('svg.ui-icon').forEach(icon => {
    if (!icon.hasAttribute('aria-label')) icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
  });
  initGestureNavInset();
  initErrorBoundary(DEBUG);
  /* global-haptics-bound */
  document.addEventListener('click', (e) => {
    const tapTarget = e.target.closest('button, .btn, .mode-card, .play-type-btn, input[type="checkbox"], select, .footer-item, .item-card, .avatar-option');
    /* Gameplay targets own their precisely timed answer feedback. A generic
       menu buzz here would immediately overwrite perfect/bonus impacts. */
    if (tapTarget && !tapTarget.matches('.corner-shape,#centerPlatform')) haptic('tap', app.save);
  });
  bindEvents();
  boot(navShowHome, navShowAuth, () => {
    const params = new URL(location.href).searchParams, challenge = params.get('prism');
    if (challenge) return navPrism(challenge, true);
    const entry = params.get('view');
    if (entry === 'collection' || entry === 'play') return goHub(entry);
    if (entry === 'garden') return navPrism(null, true);
    return app.save.getSetting('lastPlay') ? goHub() : navPrism(null, true);
  });
  initOfflineIndicator();
  initVisibilityPause(pauseLoadedGame);
  initBackButton({ pauseGame: pauseLoadedGame, quitGame: quitLoadedGame, showHome: navShowHome, backFromSettings });
  checkOrientation();
});
