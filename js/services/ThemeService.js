/* ═══════════════════════════════════════
   SCS Play — Theme Service
   Applies visual themes & light/dark mode.
   ═══════════════════════════════════════ */
import { CONFIG } from '../config.js';

/** Apply an unlockable game theme (neon, ocean, etc.) */
export function applyTheme(themeId) {
  CONFIG.THEMES.forEach(th => document.body.classList.remove(`theme-${th.id}`));
  if (themeId && themeId !== 'default') {
    document.body.classList.add(`theme-${themeId}`);
  }
}

/** Apply light/dark/auto mode — forced dark only */
export function applyThemeMode(_mode) {
  document.body.classList.remove('light-theme');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = '#0a0a1a';
  const metaScheme = document.querySelector('meta[name="color-scheme"]');
  if (metaScheme) metaScheme.content = 'dark';
}

/** Listen for OS theme changes — no-op (dark only) */
export function listenSystemTheme() {}
