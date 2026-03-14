/* ═══════════════════════════════════════
   SCS Play — Micro Feedback
   Minimal emoji-based feedback prompt
   shown at key moments during gameplay.
   ═══════════════════════════════════════ */

import { $ } from './dom.js';
import { t } from '../i18n.js';
import app   from '../appState.js';

const AUTO_DISMISS_MS = 8000;
let _dismissTimer = null;

/**
 * Check trigger conditions and show feedback prompt if appropriate.
 * @param {'pb'|'levelup'|'sampling'|'new_mode'|'streak'} trigger
 * @param {object} context  — { mode, score, sessionGame, engagementScore }
 */
export function maybeShowFeedback(trigger, context) {
  const { engagement } = app;
  if (!engagement) return;
  if (!engagement.shouldShowFeedback(trigger, context.sessionGame || 0)) return;

  const el = $('#microFeedback');
  if (!el) return;

  // Store context for recording
  el.dataset.trigger = trigger;
  el.dataset.context = JSON.stringify(context);

  // Show
  el.classList.add('active');
  el.classList.remove('dismissed');

  // Auto-dismiss after timeout
  clearTimeout(_dismissTimer);
  _dismissTimer = setTimeout(() => {
    dismissFeedback(null); // null = skipped
  }, AUTO_DISMISS_MS);
}

/**
 * Record feedback and dismiss the prompt.
 * @param {number|null} rating — 1-4 or null if skipped
 */
export function dismissFeedback(rating) {
  clearTimeout(_dismissTimer);
  const el = $('#microFeedback');
  if (!el || !el.classList.contains('active')) return;

  const trigger = el.dataset.trigger || 'sampling';
  let context = {};
  try { context = JSON.parse(el.dataset.context || '{}'); } catch {}

  el.classList.remove('active');
  el.classList.add('dismissed');

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

  // Emoji rating buttons
  el.querySelectorAll('.mf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rating = parseInt(btn.dataset.rating);
      if (rating >= 1 && rating <= 4) {
        btn.classList.add('mf-selected');
        setTimeout(() => dismissFeedback(rating), 300);
      }
    });
  });

  // Skip button
  const skipBtn = el.querySelector('.mf-skip');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => dismissFeedback(null));
  }
}
