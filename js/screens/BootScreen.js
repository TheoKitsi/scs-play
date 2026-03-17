/* ═══════════════════════════════════════
   SCS Play — Boot Screen
   Animated splash → auth or home.
   ═══════════════════════════════════════ */
import { CONFIG }              from '../config.js';
import { t, setLanguage }      from '../i18n.js';
import { $, $$, setText, localise, showScreen } from '../helpers/dom.js';
import { applyTheme, applyThemeMode, listenSystemTheme } from '../services/ThemeService.js';
import { isAdFree }            from '../services/AdService.js';
import { EngagementTracker }   from '../helpers/engagementTracker.js';
import app                     from '../appState.js';

export async function boot(showHome, showAuth) {
  const { save, auth, audio } = app;

  showScreen('boot', app);
  const progressFill = $('#bootProgressFill');
  const setProgress = (pct) => { if (progressFill) progressFill.style.width = pct + '%'; };

  setText('#bootStatus', t('boot_init'));
  setProgress(10);

  setTimeout(() => {
    $$('.boot-orb').forEach(orb => {
      orb.style.animation = `orbFadeIn 2s ease-out forwards, orbFloat ${10 + Math.random() * 5}s ease-in-out infinite`;
    });
  }, 300);

  setProgress(20);
  try { await auth.init(); } catch {}
  setText('#bootStatus', t('boot_audio'));
  setProgress(40);
  await new Promise(r => setTimeout(r, 400));

  setText('#bootStatus', t('boot_sync'));
  setProgress(60);
  try { await save.load(); } catch {}
  setProgress(80);

  app.colorblind = save.getSetting('colorblind');
  audio.toggle(save.getSetting('sound'));
  audio.toggleMusic(save.getSetting('music'));
  app.selectedMode = save.getSetting('gameMode') || 'klassik';
  app.selectedPlayType = save.getSetting('playType') || 'blitz';
  if (!save.isModeUnlocked(app.selectedMode)) app.selectedMode = 'klassik';

  /* Assign random avatar on first run */
  const currentAvatar = save.getAvatar();
  if (!currentAvatar.icon || (currentAvatar.icon === 'circle' && currentAvatar.colorIndex === 0 && !save.data.avatar)) {
    const icons = CONFIG.AVATAR_ICONS;
    const randomIcon = icons[Math.floor(Math.random() * icons.length)];
    const randomCI = Math.floor(Math.random() * CONFIG.AVATAR_COLORS_INDICES.length);
    await save.setAvatar(randomIcon, randomCI);
  }

  /* Auto-detect language */
  const langSetting = save.getSetting('language') || 'auto';
  if (langSetting === 'auto') {
    const browserLang = (navigator.language || 'de').substring(0, 2);
    setLanguage(browserLang === 'de' ? 'de' : 'en');
  } else {
    setLanguage(langSetting);
  }
  localise(t);

  /* Auto-detect theme mode */
  applyThemeMode(save.getSetting('themeMode') || 'auto');
  listenSystemTheme(() => save.getSetting('themeMode') || 'auto');

  applyTheme(save.getActiveTheme());
  document.body.classList.toggle('ad-free', isAdFree(save));

  /* Initialize engagement tracker (after save data is fully loaded) */
  app.engagement = new EngagementTracker(save);

  setProgress(100);
  setText('#bootStatus', t('boot_ready'));
  if (typeof audio.bootJingle === 'function') audio.bootJingle();

  /* Register service worker */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  await new Promise(r => setTimeout(r, CONFIG.BOOT_MIN_DISPLAY));

  const bootEl = $('#boot');
  if (bootEl) {
    bootEl.classList.add('fade-out');
    await new Promise(r => setTimeout(r, 700));
  }

  if (auth.user) {
    showHome();
  } else {
    showAuth();
  }
}
