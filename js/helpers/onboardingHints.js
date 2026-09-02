/* ═══════════════════════════════════════
   SCS Play — Onboarding Hints System
   Contextual first-time hints with
   spotlight overlay + dismiss tracking.
   ═══════════════════════════════════════ */
import { t } from '../i18n.js';
import { $ } from './dom.js';
import app from '../appState.js';
import { closeModal, openModal } from './modal.js';

const HINTS = [
  { id: 'hint_carousel',  target: '.hero-slider',        i18n: 'hint_carousel' },
  { id: 'hint_playflow',  target: '#homePlayCommand',     i18n: 'hint_playflow' },
];

let _overlay = null;
let _queue = [];
let _activeHint = null;
let _showTimer = null;
let _nextTimer = null;

function isHomeActive() {
  return document.querySelector('#home')?.classList.contains('active');
}

function getShown() {
  return app.save?.data?.hintsShown || {};
}

function markShown(id) {
  if (!app.save?.data) return;
  if (!app.save.data.hintsShown) app.save.data.hintsShown = {};
  app.save.data.hintsShown[id] = true;
  app.save.save();
}

function createOverlay() {
  if (_overlay) return _overlay;
  const div = document.createElement('div');
  div.className = 'onboarding-overlay';
  div.innerHTML = `
    <div class="onboarding-spotlight"></div>
    <div class="onboarding-bubble">
      <p class="onboarding-text"></p>
      <div class="onboarding-actions">
        <button class="onboarding-btn-ok"></button>
      </div>
    </div>`;
  document.body.appendChild(div);
  div.querySelector('.onboarding-btn-ok').addEventListener('click', dismissCurrent);
  div.addEventListener('click', (e) => {
    if (e.target === div) dismissCurrent();
  });
  _overlay = div;
  div.setAttribute('aria-label', t('hint_ok'));
  return div;
}

function dismissCurrent() {
  if (!_overlay) return;
  const hintId = _overlay.dataset.hintId;
  if (hintId) markShown(hintId);
  closeModal(_overlay);
  _activeHint = null;
  // Show next hint in queue after short delay
  clearTimeout(_nextTimer);
  _nextTimer = setTimeout(() => {
    _nextTimer = null;
    if (isHomeActive() && _queue.length > 0) {
      showHint(_queue.shift());
    }
  }, 400);
}

function clearOnboardingHints() {
  clearTimeout(_showTimer);
  clearTimeout(_nextTimer);
  _showTimer = null;
  _nextTimer = null;
  _queue = [];
  _activeHint = null;
  if (_overlay) {
    closeModal(_overlay, { restoreFocus: false });
    _overlay.removeAttribute('data-hint-id');
  }
}

function positionSpotlight(overlay, hint) {
  const targetEl = $(hint.target);
  const spotlight = overlay.querySelector('.onboarding-spotlight');
  const bubble = overlay.querySelector('.onboarding-bubble');
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const pad = 8;
    spotlight.style.top = `${rect.top - pad}px`;
    spotlight.style.left = `${rect.left - pad}px`;
    spotlight.style.width = `${rect.width + pad * 2}px`;
    spotlight.style.height = `${rect.height + pad * 2}px`;
    spotlight.style.borderRadius = '16px';
    spotlight.style.display = '';
    const below = window.innerHeight - rect.bottom;
    bubble.style.position = 'fixed';
    bubble.style.left = '50%';
    bubble.style.transform = 'translateX(-50%)';
    bubble.style.top = `${below >= 180 ? rect.bottom + 16 : Math.max(16, rect.top - 166)}px`;
  } else {
    spotlight.style.display = 'none';
    bubble.removeAttribute('style');
  }
}

function showHint(hint) {
  if (!isHomeActive()) return;
  const overlay = createOverlay();
  overlay.dataset.hintId = hint.id;
  _activeHint = hint;

  positionSpotlight(overlay, hint);

  // Set text
  overlay.querySelector('.onboarding-text').textContent = t(hint.i18n);
  overlay.querySelector('.onboarding-btn-ok').textContent = t('hint_ok');

  openModal(overlay, {
    initialFocus: '.onboarding-btn-ok',
    onDismiss: dismissCurrent,
  });
}

/** Check and show pending onboarding hints for the home screen */
export function checkOnboardingHints() {
  if (!app.save?.data) return;
  if (!isHomeActive()) return;
  const shown = getShown();
  clearTimeout(_showTimer);
  _queue = [];
  for (const hint of HINTS) {
    if (!shown[hint.id]) {
      _queue.push(hint);
    }
  }
  if (_queue.length > 0) {
    // Delay slightly so the home screen has rendered
    _showTimer = setTimeout(() => {
      _showTimer = null;
      if (isHomeActive() && _queue.length > 0) showHint(_queue.shift());
    }, 800);
  }
}

window.addEventListener('resize', () => {
  if (_overlay?.classList.contains('active') && _activeHint) {
    if (!isHomeActive()) {
      clearOnboardingHints();
      return;
    }
    positionSpotlight(_overlay, _activeHint);
  }
}, { passive: true });

window.addEventListener('scs:screenchange', (event) => {
  if (event.detail?.id !== 'home') clearOnboardingHints();
});
