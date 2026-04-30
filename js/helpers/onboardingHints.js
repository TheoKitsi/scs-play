/* ═══════════════════════════════════════
   SCS Play — Onboarding Hints System
   Contextual first-time hints with
   spotlight overlay + dismiss tracking.
   ═══════════════════════════════════════ */
import { t } from '../i18n.js';
import { $ } from './dom.js';
import app from '../appState.js';

const HINTS = [
  { id: 'hint_carousel',  target: '.hero-slider',        i18n: 'hint_carousel' },
  { id: 'hint_playflow',  target: '#homePlayCommand',     i18n: 'hint_playflow' },
  { id: 'hint_pin',       target: '.hero-pin-btn',        i18n: 'hint_pin' },
  { id: 'hint_shortcuts', target: '#quickShortcuts',      i18n: 'hint_shortcuts' },
];

let _overlay = null;
let _queue = [];
let _activeHint = null;
let _showTimer = null;

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
  return div;
}

function dismissCurrent() {
  if (!_overlay) return;
  const hintId = _overlay.dataset.hintId;
  if (hintId) markShown(hintId);
  _overlay.classList.remove('active');
  _activeHint = null;
  // Show next hint in queue after short delay
  setTimeout(() => {
    if (isHomeActive() && _queue.length > 0) {
      showHint(_queue.shift());
    }
  }, 400);
}

export function clearOnboardingHints() {
  clearTimeout(_showTimer);
  _showTimer = null;
  _queue = [];
  _activeHint = null;
  if (_overlay) {
    _overlay.classList.remove('active');
    _overlay.removeAttribute('data-hint-id');
  }
}

function positionSpotlight(overlay, hint) {
  const targetEl = $(hint.target);
  const spotlight = overlay.querySelector('.onboarding-spotlight');
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const pad = 8;
    spotlight.style.top = `${rect.top - pad}px`;
    spotlight.style.left = `${rect.left - pad}px`;
    spotlight.style.width = `${rect.width + pad * 2}px`;
    spotlight.style.height = `${rect.height + pad * 2}px`;
    spotlight.style.borderRadius = '16px';
    spotlight.style.display = '';
  } else {
    spotlight.style.display = 'none';
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

  requestAnimationFrame(() => overlay.classList.add('active'));
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
