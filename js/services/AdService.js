/* ═══════════════════════════════════════
   SCS Play — Ad Service (AdMob Integration)
   Real Ad Integration with Fallback Mock
   ═══════════════════════════════════════ */
import { $ }     from '../helpers/dom.js';
import { t }     from '../i18n.js';
import { haptic } from '../helpers/haptics.js';
import app from '../appState.js';
import { closeModal, openModal } from '../helpers/modal.js';

const AD_INTERSTITIAL_DELAY = 2;
const AD_FIRST_INTERSTITIAL_AT = 5;
const AD_SHOW_EVERY_N_GAMES = 4;
let adContextActive = false;
let activeMockClose = null;

function shouldShowInterstitial(sessionGames) {
  if (sessionGames < AD_FIRST_INTERSTITIAL_AT) return false;
  return ((sessionGames - AD_FIRST_INTERSTITIAL_AT) % AD_SHOW_EVERY_N_GAMES) === 0;
}

// Attempt to detect Capacitor/Cordova AdMob context
export async function initAdService() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) {
    adContextActive = true;
    try {
      await window.Capacitor.Plugins.AdMob.initialize();
    } catch(e) { adContextActive = false; }
  } else if (window.admob) {
    adContextActive = true;
  }
}

export function isAdFree(save) {
  return save && (save.hasPurchase('adfree') || save.hasPurchase('vip'));
}

export function updateAdBanner(save) {
  const banner = $('#adBanner');
  if (!banner) return;
  const isFree = isAdFree(save);
  banner.classList.toggle('hidden', isFree);
  
  if (adContextActive && !isFree) {
     // Trigger real banner load here
     // window.Capacitor.Plugins.AdMob.showBanner(...)
  } else if (adContextActive && isFree) {
     // window.Capacitor.Plugins.AdMob.hideBanner();
  }
}

export function updateGameAdBanner(save) {
  const banner = $('#gameAdBanner');
  if (banner) banner.classList.toggle('hidden', isAdFree(save));
  document.body.classList.toggle('ad-free', isAdFree(save));
}

export function showAdInterstitial(save, sessionGames) {
  return new Promise((resolve) => {
    if (isAdFree(save)) { resolve(); return; }
    if (!shouldShowInterstitial(sessionGames)) { resolve(); return; }
    
    // Real Ad SDK integration
    if (adContextActive && window.Capacitor) {
      window.Capacitor.Plugins.AdMob.prepareInterstitial({ adId: 'your-admob-id' })
        .then(() => window.Capacitor.Plugins.AdMob.showInterstitial())
        .then(() => resolve())
        .catch(() => { _showMockInterstitial(resolve); });
      return;
    }
    
    _showMockInterstitial(resolve);
  });
}

export function showRewardedAd(save) {
  return new Promise((resolve) => {
    // Reward is given immediately for AdFree users without looking at ad
    if (isAdFree(save)) { resolve(true); return; }
    
    if (adContextActive && window.Capacitor && window.Capacitor.Plugins) {
      window.Capacitor.Plugins.AdMob.prepareRewardVideoAd({ adId: 'your-reward-id' })
        .then(() => window.Capacitor.Plugins.AdMob.showRewardVideoAd())
        .then((reward) => resolve(true))
        .catch(() => { _showMockRewarded(resolve); });
      return;
    }
    
    _showMockRewarded(resolve);
  });
}

function _showMockInterstitial(resolve) {
  _showMockAd(resolve, false);
}

function _showMockRewarded(resolve) {
  _showMockAd(resolve, true);
}

function _showMockAd(resolve, rewarded) {
  activeMockClose?.(false);

  const overlay = $('#adInterstitial');
  const closeBtn = $('#btnAdClose');
  const timerEl = $('#adSkipTimer');
  if (!overlay) { resolve(rewarded ? false : undefined); return; }

  let settled = false;
  let countdown = rewarded ? 5 : AD_INTERSTITIAL_DELAY;
  let timer = null;
  let safetyTimeout = null;
  const updateTimer = () => {
    if (!timerEl) return;
    timerEl.textContent = rewarded
      ? ((t('ad_reward_loading') || 'Loading Video Ad...') + ` ${countdown}s`)
      : t('ad_interstitial_skip', { n: countdown });
  };
  const close = (completed = true) => {
    if (settled) return;
    settled = true;
    clearInterval(timer);
    clearTimeout(safetyTimeout);
    closeBtn?.removeEventListener('click', handleCloseClick);
    closeModal(overlay);
    if (activeMockClose === close) activeMockClose = null;
    if (completed && app?.save) haptic('tap', app.save);
    resolve(rewarded ? completed : undefined);
  };
  const handleCloseClick = () => close(true);

  activeMockClose = close;
  if (closeBtn) closeBtn.style.display = 'none';
  updateTimer();
  openModal(overlay, {
    initialFocus: '#btnAdClose',
    canDismiss: () => countdown <= 0,
    onDismiss: () => close(true),
  });

  timer = setInterval(() => {
    countdown--;
    if (countdown > 0) updateTimer();
    else {
      clearInterval(timer);
      timer = null;
      if (timerEl) timerEl.textContent = rewarded ? (t('ad_reward_ready') || 'Reward granted! You can close now.') : '';
      if (closeBtn) {
        closeBtn.style.display = '';
        closeBtn.focus();
      }
    }
  }, 1000);
  safetyTimeout = setTimeout(() => close(true), rewarded ? 15000 : 10000);
  closeBtn?.addEventListener('click', handleCloseClick);
}
