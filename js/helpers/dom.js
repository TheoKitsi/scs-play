/* ═══════════════════════════════════════
   SCS Play — DOM Utility Helpers
   Small, pure functions for common DOM ops.
   ═══════════════════════════════════════ */

/** querySelector shorthand */
export const $ = (selector, parent) => (parent || document).querySelector(selector);

/** querySelectorAll → real Array */
export const $$ = (selector, parent) => [...(parent || document).querySelectorAll(selector)];

/** Set textContent safely */
export function setText(selector, text) {
  const el = $(selector);
  if (el) el.textContent = text;
}

/** Set innerHTML safely */
export function setHTML(selector, html) {
  const el = $(selector);
  if (el) el.innerHTML = html;
}

/** Escape HTML special chars to prevent XSS in innerHTML sinks */
export function escHTML(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Validate src is a safe URL (data:image/* or https:) */
export function safeSrc(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (s.startsWith('data:image/') || s.startsWith('https://')) return s;
  return '';
}

/** Convert hex color to rgba string */
export function hexToRgba(hex, alpha) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Screen transition — hide all .screen, activate target.
 * Also updates app.currentScreen and plays transition sound.
 */
export function showScreen(id, app) {
  const prevScreen = app.currentScreen;
  $$('.screen').forEach(s => {
    if (s.classList.contains('active') && s.id !== id) {
      s.classList.add('screen-exit');
      s.classList.remove('active');
      setTimeout(() => s.classList.remove('screen-exit'), 350);
    }
  });
  const el = $(`#${id}`);
  if (el) {
    el.classList.add('active', 'screen-enter');
    setTimeout(() => el.classList.remove('screen-enter'), 350);
  }
  app.currentScreen = id;
  window.dispatchEvent(new CustomEvent('scs:screenchange', { detail: { id, prevScreen } }));
  /* Stop home-screen timers when navigating away */
  if (prevScreen === 'home' && id !== 'home' && typeof app._stopDailyCountdown === 'function') {
    app._stopDailyCountdown();
  }
  if (app.engagement) app.engagement.trackScreenVisit(id);
  if (typeof app.audio?.screenTransition === 'function') app.audio.screenTransition();
}

/** Apply i18n text to all [data-i18n], [data-i18n-placeholder], and [data-i18n-aria] elements */
export function localise(t) {
  $$('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    /* Preserve child elements (SVG icons etc.) by updating only text nodes */
    if (el.querySelector('*')) {
      let updated = false;
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          node.textContent = val;
          updated = true;
          break;
        }
      }
      if (!updated) {
        /* No existing text node — prepend one before any child element */
        el.insertBefore(document.createTextNode(val + ' '), el.firstChild);
      }
    } else {
      el.textContent = val;
    }
  });
  $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

