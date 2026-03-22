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

const THEME_META = {
  dark:  { themeColor: '#0a0a1a', colorScheme: 'dark' },
  light: { themeColor: '#f5f5f5', colorScheme: 'light' }
};

/** Apply light/dark/auto mode */
export function applyThemeMode(mode = 'dark') {
  const resolved = mode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : mode;
  const isLight = resolved === 'light';
  document.body.classList.toggle('light-theme', isLight);
  const meta = isLight ? THEME_META.light : THEME_META.dark;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = meta.themeColor;
  const metaScheme = document.querySelector('meta[name="color-scheme"]');
  if (metaScheme) metaScheme.content = meta.colorScheme;
}

/** Listen for OS theme changes and re-apply if mode is 'auto' */
let _autoMql = null;
export function listenSystemTheme(getSetting) {
  if (_autoMql) return;
  _autoMql = window.matchMedia('(prefers-color-scheme: light)');
  _autoMql.addEventListener('change', () => {
    const mode = typeof getSetting === 'function' ? getSetting('themeMode') : 'dark';
    if (mode === 'auto') applyThemeMode('auto');
  });
}
