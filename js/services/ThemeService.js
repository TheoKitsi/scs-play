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
}
