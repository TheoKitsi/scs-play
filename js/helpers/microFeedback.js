/* ═══════════════════════════════════════
   SCS Play — Micro Feedback
   Optional vector-face feedback inside
   opened round details, never over play.
   ═══════════════════════════════════════ */

import { $ } from './dom.js';
import { t } from '../i18n.js';
import app   from '../appState.js';
import { icon } from '../renderers/icons.js';

/**
 * Check trigger conditions and show feedback prompt if appropriate.
 * @param {'pb'|'levelup'|'sampling'|'new_mode'|'streak'} trigger
 * @param {object} context  — { mode, score, sessionGame, engagementScore }
 */
export function maybeShowFeedback(trigger, context) {
  /* Requested from opened round details only; never cover replay/navigation. */
  const host = $('#resDetailsBody');
  if (app.currentScreen !== 'results' || !$('#resDetails')?.open || !host) return;
  const { engagement } = app;
  if (!engagement) return;
  if (!engagement.shouldShowFeedback(trigger, context.sessionGame || 0)) return;

  const el = $('#microFeedback');
  if (!el) return;
  host.appendChild(el);
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', t('mf_how_was_that'));

  // Store context for recording
  el.dataset.trigger = trigger;
  el.dataset.context = JSON.stringify(context);

  // Show
  el.hidden = false;
  el.inert = false;
  el.classList.add('active');
  el.classList.remove('dismissed');
}

/**
 * Record feedback and dismiss the prompt.
 * @param {number|null} rating — 1-4 or null if skipped
 */
function dismissFeedback(rating) {
  const el = $('#microFeedback');
  if (!el || !el.classList.contains('active')) return;

  const trigger = el.dataset.trigger || 'sampling';
  let context = {};
  try { context = JSON.parse(el.dataset.context || '{}'); } catch {}

  el.classList.remove('active');
  el.classList.add('dismissed');
  el.hidden = true;
  el.inert = true;

  const { engagement } = app;
  if (engagement) {
    engagement.recordFeedback(trigger, rating, context);
  }
}

/**
 * Bind click handlers on the feedback prompt buttons.
 * Call once at app init.
 */
export function bindMicroFeedback() {
  const el = $('#microFeedback');
  if (!el) return;
  window.addEventListener('scs:screenchange', ({ detail }) => {
    if (detail?.id !== 'results') dismissFeedback(null);
  });

  // The response is recorded immediately, before navigation can change context.
  el.querySelectorAll('.mf-btn').forEach(btn => {
    btn.querySelector('span').innerHTML = icon(`face-${btn.dataset.rating}`);
    btn.addEventListener('click', () => {
      const rating = parseInt(btn.dataset.rating);
      if (rating >= 1 && rating <= 4) {
        dismissFeedback(rating);
      }
    });
  });

  // Skip button
  const skipBtn = el.querySelector('.mf-skip');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => dismissFeedback(null));
  }
}
