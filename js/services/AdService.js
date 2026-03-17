/* ═══════════════════════════════════════
   SCS Play — Ad Service (AdMob Integration)
   Real Ad Integration with Fallback Mock
   ═══════════════════════════════════════ */
import { $ }     from '../helpers/dom.js';
import { t }     from '../i18n.js';
import { haptic } from '../helpers/haptics.js';
import app from '../appState.js';

const AD_INTERSTITIAL_DELAY = 3;
const AD_SHOW_EVERY_N_GAMES = 2;
let adContextActive = false;

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
    if (sessionGames % AD_SHOW_EVERY_N_GAMES !== 0) { resolve(); return; }
    
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
    const overlay = $('#adInterstitial');
    const closeBtn = $('#btnAdClose');
    const timerEl = $('#adSkipTimer');
    if (!overlay) { resolve(); return; }

    overlay.classList.add('active');
    if (closeBtn) closeBtn.style.display = 'none';
    let countdown = AD_INTERSTITIAL_DELAY;
    if (timerEl) timerEl.textContent = t('ad_interstitial_skip', { n: countdown });
    
    let timer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        if (timerEl) timerEl.textContent = t('ad_interstitial_skip', { n: countdown });
      } else {
        clearInterval(timer);
        if (timerEl) timerEl.textContent = '';
        if (closeBtn) closeBtn.style.display = '';
      }
    }, 1000);

    const close = () => {
      clearInterval(timer);
      overlay.classList.remove('active');
      if (app && app.save) haptic('tap', app.save);
      resolve();
    };
    closeBtn?.addEventListener('click', close, { once: true });
}

function _showMockRewarded(resolve) {
    const overlay = $('#adInterstitial'); // Reuse interstitial UI as mock
    const closeBtn = $('#btnAdClose');
    const timerEl = $('#adSkipTimer');
    if (!overlay) { resolve(false); return; }

    overlay.classList.add('active');
    if (closeBtn) closeBtn.style.display = 'none';
    let countdown = 5; 
    if (timerEl) timerEl.textContent = t('ad_reward_loading') || ('Loading Video Ad... ' + countdown + 's');
    
    let timer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        if (timerEl) timerEl.textContent = t('ad_reward_loading') ? (t('ad_reward_loading') + ' ' + countdown) : ('Loading Video Ad... ' + countdown + 's');
      } else {
        clearInterval(timer);
        if (timerEl) timerEl.textContent = t('ad_reward_ready') || 'Reward granted! You can close now.';
        if (closeBtn) closeBtn.style.display = '';
      }
    }, 1000);

    const close = () => {
      clearInterval(timer);
      overlay.classList.remove('active');
      if (app && app.save) haptic('tap', app.save);
      resolve(true); // completed
    };
    closeBtn?.addEventListener('click', close, { once: true });
}
