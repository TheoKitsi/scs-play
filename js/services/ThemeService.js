/* ═══════════════════════════════════════
   SCS Play — Theme Service
   Applies unlockable game themes (dark only).
   ═══════════════════════════════════════ */
import { CONFIG } from '../config.js';

/** Apply an unlockable game theme (neon, ocean, etc.) */
export function applyTheme(themeId) {
  CONFIG.THEMES.forEach(th => document.body.classList.remove(`theme-${th.id}`));
  if (themeId && themeId !== 'default') {
    document.body.classList.add(`theme-${themeId}`);
  }
  const chrome = document.querySelector('meta[name="theme-color"]');
  if (chrome) chrome.content = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#162535';
}
