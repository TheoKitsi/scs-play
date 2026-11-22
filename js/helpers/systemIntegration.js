import { t } from '../i18n.js';
import app from '../appState.js';
import { $ } from './dom.js';
import { dismissTopModal } from './modal.js';
import { cancelHaptics } from './haptics.js';
import { appDialog } from './appDialog.js';

let wakeLock = null;
let deferredInstall = null;
const INSTALL_DISMISS_KEY = 'scs_install_dismissed';

export function bindQaHooks() {
  try {
    if (globalThis.localStorage?.getItem('scsQa') === '1') {
      globalThis.__SCS_QA__ = {
        forceGameOver() {
          app.game?._endGame();
        },
        setContinued(value = true) {
          if (app.game) app.game.continued = value;
        },
        setGameSelection(mode, playType = 'blitz') {
          app.selectedMode = mode;
          app.selectedPlayType = playType;
          const playButton = $('#btnPlay');
          if (playButton) playButton.disabled = false;
        },
        triggerChaosRuleSwitch(rule = 'color') {
          app.game?.onChaosRuleSwitch?.(rule);
        },
        /* Read-only snapshot for scripts/perf-benchmark.mjs */
        arcadeRendererState() { return app.arcadeArena?.snapshot() || null; },
        prismRendererState() { return app.prismNavigation?.rendererState?.() || null; },
        gameState() {
          const game = app.game;
          if (!game) return null;
          return {
            running: game.running,
            paused: game.paused,
            score: game.score,
            timer: game.timer,
            mode: game.mode,
            playType: game.playType,
            practice: game.practice,
            continued: game.continued,
            stimulusId: game.currentShape?.stimulusId ?? null,
            stimulusAge: game.currentShape ? performance.now() - game.lastSpawnTime : null,
            direction: game.currentShape?.direction ?? null,
            streak: game.streak,
            correct: game.correct,
            spawnInterval: game.spawnInterval,
            feverActive: game.feverActive,
            elapsed: game.elapsed,
            total: game.total,
          };
        },
        progressionState() {
          const save = app.save;
          return {
            xp: save.getTotalXP(), level: save.getLevel(), fire: save.getFireBalance(), lives: save.getLives(),
            achievements: [...save.getAchievements()], progression: structuredClone(save.data.progression),
            quests: structuredClone(save.data.dailyQuests), seasonPass: structuredClone(save.data.seasonPass),
            masteryTier: app.mastery.getMasteryTier(app.selectedMode).tier,
          };
        },
      };
    }
  } catch {}
}

export function initOfflineIndicator() {
  const toast = $('#offlineToast');
  const msgEl = $('#offlineMsg');
  if (!toast) return;

  let hideTimer = null;
  let pendingState = null;
  const icon = toast.querySelector('.offline-icon');
  icon?.setAttribute('aria-hidden', 'true');
  if (msgEl) msgEl.textContent = '';
  function hideToast() {
    clearTimeout(hideTimer);
    toast.classList.remove('active');
    if (msgEl) msgEl.textContent = '';
  }
  function showToast(isOnline) {
    if (document.hidden) { pendingState = isOnline; return; }
    pendingState = null;
    toast.classList.toggle('online', isOnline);
    toast.classList.add('active');
    if (icon) icon.textContent = isOnline ? '✓' : '!';
    if (msgEl) msgEl.textContent = isOnline ? t('online_msg') : t('offline_msg');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideToast, 6500);
  }

  window.addEventListener('offline', () => showToast(false));
  window.addEventListener('online', () => showToast(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (toast.classList.contains('active')) pendingState = toast.classList.contains('online');
      hideToast();
    }
    else if (pendingState !== null) showToast(pendingState);
  });
  if (navigator.onLine === false) showToast(false);
}

export function initVisibilityPause(pauseGame) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelHaptics();
    if (document.hidden && app.currentScreen === 'game' && app.game?.running && !app.game.paused) {
      pauseGame();
    }
    app.audio?.setVisibility?.(document.hidden);
  });
}

export function checkOrientation() {
  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  const narrowArena = app.currentScreen === 'game' && isLandscape && isTouchDevice && window.innerHeight < 500;
  const warning = $('#landscapeWarning');
  if (warning) { warning.hidden = !narrowArena; warning.classList.toggle('active', narrowArena); }
  return narrowArena;
}

export function initWakeLock() {
  app.requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  };

  app.releaseWakeLock = async () => {
    if (!wakeLock) return;
    try { await wakeLock.release(); } catch {}
    wakeLock = null;
  };
}

export function initErrorBoundary(debug) {
  const offerBootRetry = () => {
    const status = $('#boot.active #bootStatus');
    if (!status || $('#bootRetry')) return;
    status.setAttribute('role', 'alert');
    status.textContent = document.documentElement.lang === 'de'
      ? 'SCS Play konnte nicht gestartet werden. Versuche, die App neu zu laden.'
      : 'SCS Play could not start. Try reloading the app.';
    const retry = document.createElement('button');
    retry.id = 'bootRetry';
    retry.type = 'button';
    retry.className = 'btn btn-secondary';
    retry.textContent = t('retry');
    retry.addEventListener('click', () => location.reload());
    status.after(retry);
    retry.setAttribute('aria-describedby', status.id);
    retry.focus();
  };
  window.addEventListener('error', (e) => {
    if (debug) console.error('[SCS Error]', e.message, e.filename, ':', e.lineno);
    if (e.error) offerBootRetry();
    e.preventDefault();
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (debug) console.error('[SCS Rejection]', e.reason);
    if (e.reason?.name !== 'AbortError') offerBootRetry();
    e.preventDefault();
  });
}

export function initPwaInstallPrompt() {
  const banner = $('#pwaInstallBanner');
  if (!banner) return;
  const homeContainer = banner.parentElement;
  const dismiss = $('#btnDismissInstall');
  dismiss.dataset.i18nAria = 'ad_interstitial_close';
  const hide = () => {
    const focused = banner.contains(document.activeElement);
    banner.hidden = true;
    if (!focused) return;
    const next = app.currentScreen === 'settings' ? $('#selectLang') : $('#btnPlay');
    if (next && !next.disabled && next.getClientRects().length) next.focus();
  };
  const place = () => {
    const destination = app.currentScreen === 'settings' ? $('#settingsProfile') : homeContainer;
    if (destination && banner.parentElement !== destination) destination.append(banner);
  };
  const rememberDismissal = () => {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now())); } catch {}
  };
  banner.hidden = true;
  banner.style.removeProperty('display');
  window.addEventListener('scs:screenchange', place);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    let dismissed;
    try { dismissed = Number(localStorage.getItem(INSTALL_DISMISS_KEY)); } catch {}
    if (dismissed && Date.now() - dismissed < 7 * 86400000) return;
    place();
    dismiss.setAttribute('aria-label', t(dismiss.dataset.i18nAria));
    banner.hidden = false;
  });

  dismiss.addEventListener('click', () => {
    hide();
    rememberDismissal();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    hide();
  });

  app.promptInstall = async () => {
    if (!deferredInstall) return false;
    const prompt = deferredInstall;
    deferredInstall = null;
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      hide();
      if (outcome === 'dismissed') rememberDismissal();
      return outcome === 'accepted';
    } catch {
      hide();
      if (['settings', 'home'].includes(app.currentScreen)) {
        await appDialog({ title: t('pwa_install_title'), message: document.documentElement.lang === 'de'
          ? 'Die Installation wurde nicht gestartet. Du kannst im Browser weiterspielen.'
          : 'Installation did not start. You can keep playing in your browser.' });
      }
      return false;
    }
  };
}

export function initBackButton({ pauseGame, quitGame, showHome, backFromSettings }) {
  const handleBack = () => {
    if (dismissTopModal('back')) return;
    if (backFromSettings?.()) return;
    if (app.currentScreen === 'prism' && app.prismNavigation) { app.prismNavigation.back(); return; }
    if (app.currentScreen === 'hub') {
      if ($('#hub [data-action="collection"][aria-current]')) { $('#hub [data-action="play"]').click(); return; }
      return false;
    }
    const isRootScreen = app.currentScreen === 'home' || app.currentScreen === 'boot' || app.currentScreen === 'auth';
    if (!app.currentScreen || isRootScreen) return false;
    if (app.currentScreen === 'game') {
      if (app.game.running && !app.game.paused) pauseGame();
      else quitGame();
      return;
    }
    showHome();
  };

  window.addEventListener('popstate', handleBack);
  if (window.Capacitor?.isNativePlatform?.()) {
    import('../services/NativeLifecycle.js').then(({ bindNativeLifecycle }) => bindNativeLifecycle({
      back: handleBack,
      active: isActive => {
        app.audio?.setVisibility?.(!isActive);
        if (!isActive) {
          cancelHaptics();
          window.dispatchEvent(new Event('scs:native-pause'));
          if (app.currentScreen === 'game' && app.game?.running && !app.game.paused) pauseGame?.();
        }
      },
    })).catch(() => { /* Web/unsupported plugin must never block the game. */ });
  }
}

export function initOrientationListeners(pauseGame) {
  const warning = $('#landscapeWarning');
  if (warning) $('#btnResume')?.before(warning);
  const update = () => {
    if (checkOrientation() && app.game?.running && !app.game.paused) pauseGame?.();
  };
  if (screen.orientation) screen.orientation.addEventListener('change', update);
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('scs:screenchange', update);
}

export function initGestureNavInset() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isAndroid && !isIOS) return;

  const mqFull = matchMedia('(display-mode: fullscreen)');
  const mqStandalone = matchMedia('(display-mode: standalone)');
  const iosStandalone = navigator.standalone === true;

  const apply = () => {
    const immersive = mqFull.matches || mqStandalone.matches || iosStandalone;
    const offset = immersive ? '34px' : '0px';
    document.documentElement.style.setProperty('--gesture-nav-inset', offset);
  };
  apply();
  mqFull.addEventListener('change', apply);
  mqStandalone.addEventListener('change', apply);
}
