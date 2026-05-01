import { t } from '../i18n.js';
import app from '../appState.js';
import { $ } from './dom.js';

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
      };
    }
  } catch {}
}

export function initOfflineIndicator() {
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
  window.addEventListener('online', () => showToast(true));
}

export function initVisibilityPause(pauseGame) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && app.currentScreen === 'game' && app.game.running && !app.game.paused) {
      pauseGame();
    }
  });
}

export function checkOrientation() {
  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  const isPhoneLikeViewport = Math.min(window.innerWidth, window.innerHeight) <= 900;
  $('#landscapeWarning')?.classList.toggle('active', isLandscape && isTouchDevice && isPhoneLikeViewport);
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
  window.addEventListener('error', (e) => {
    if (debug) console.error('[SCS Error]', e.message, e.filename, ':', e.lineno);
    e.preventDefault();
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (debug) console.error('[SCS Rejection]', e.reason);
    e.preventDefault();
  });
}

export function initPwaInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    const dismissed = localStorage.getItem(INSTALL_DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400000) return;
    const banner = $('#pwaInstallBanner');
    if (banner) banner.style.display = '';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#btnDismissInstall')) return;
    const banner = $('#pwaInstallBanner');
    if (banner) banner.style.display = 'none';
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
  });

  app.promptInstall = async () => {
    if (!deferredInstall) return false;
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    deferredInstall = null;
    const banner = $('#pwaInstallBanner');
    if (banner) banner.style.display = 'none';
    return outcome === 'accepted';
  };
}

export function initBackButton({ pauseGame, showHome }) {
  window.addEventListener('popstate', () => {
    const isRootScreen = app.currentScreen === 'home' || app.currentScreen === 'boot' || app.currentScreen === 'auth';
    if (!app.currentScreen || isRootScreen) return;
    if (app.currentScreen === 'game' && app.game.running && !app.game.paused) {
      pauseGame();
    } else {
      showHome();
    }
  });
}

export function initOrientationListeners() {
  if (screen.orientation) screen.orientation.addEventListener('change', checkOrientation);
  window.addEventListener('resize', checkOrientation, { passive: true });
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