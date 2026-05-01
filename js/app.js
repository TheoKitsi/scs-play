/* ═══════════════════════════════════════
   SCS Play — App Orchestrator
   Wires all modules, binds events, boots.
   ═══════════════════════════════════════ */
import { haptic } from './helpers/haptics.js';
import { CONFIG, DEBUG }    from './config.js';
import { t }                from './i18n.js';
import { $, $$, showScreen } from './helpers/dom.js';
import { initPerfMode }     from './helpers/perfMode.js';
import { getUnlockLevel }   from './helpers/modeUnlockHelper.js';
import { updateLivesDisplay } from './helpers/livesDisplayHelper.js';
import { bindQaHooks, checkOrientation, initBackButton, initErrorBoundary,
         initGestureNavInset, initOfflineIndicator, initOrientationListeners,
         initPwaInstallPrompt, initVisibilityPause, initWakeLock }
                            from './helpers/systemIntegration.js';
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
import { showHome, updateModeSelector, updatePlayTypeSelector }
                            from './screens/HomeScreen.js';
import { getBodyFx }        from './services/EffectsService.js';
import { showTutorial, tutorialNext, tutorialPrev, tutorialFinish }
                            from './screens/TutorialScreen.js';
import { startGame, beginGame, doCountdown, pauseGame, resumeGame,
         restartGame, quitGame, stopPractice }
                            from './screens/GameScreen.js';
import { showResults, showContinuePrompt, doContinue, declineContinue,
         wasLastGameGood }
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
    btn.addEventListener('click', () => navShowHome());
  });

  initOrientationListeners();
}

/* ═══════ Init ═══════ */
document.addEventListener('DOMContentLoaded', () => {
  initGestureNavInset();
  initErrorBoundary(DEBUG);
  /* global-haptics-bound */
  document.addEventListener('click', (e) => {
    const tapTarget = e.target.closest('button, .btn, .mode-card, .play-type-btn, input[type="checkbox"], select, .footer-item, .item-card, .avatar-option');
    if (tapTarget) haptic('tap', app.save);
  });
  bindEvents();
  initAdService();
  boot(navShowHome, navShowAuth);
  initOfflineIndicator();
  initVisibilityPause(pauseGame);
  initBackButton({ pauseGame, showHome: navShowHome });
  checkOrientation();
});
