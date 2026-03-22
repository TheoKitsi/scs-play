/* ═══════════════════════════════════════
   SCS Play — Settings Screen
   Toggles, language.
   ═══════════════════════════════════════ */
import { t, setLanguage }   from '../i18n.js';
import { $, $$, localise, showScreen } from '../helpers/dom.js';
import app                   from '../appState.js';

export function showSettings(fromPause, showHome) {
  const { save } = app;
  showScreen('settings', app);
  $('#toggleColorblind').checked = save.getSetting('colorblind');
  $('#toggleMotion').checked     = save.getSetting('reducedMotion');
  $('#toggleHaptics').checked    = save.getSetting('haptics');
  $('#toggleSound').checked      = save.getSetting('sound');
  $('#toggleMusic').checked      = save.getSetting('music');
  $('#selectLang').value         = save.getSetting('language') || 'auto';

  $$('.btn-back, .btn-back-bottom', $('#settings')).forEach(btn => {
    btn._customBack = true;
    btn.onclick = () => {
      btn._customBack = false;
      if (fromPause) {
        showScreen('game', app);
        $('#pauseOverlay')?.classList.add('active');
      } else {
        showHome();
      }
    };
  });
}

export function bindSettings(showHome) {
  const { save, audio } = app;

  const bind = (sel, key, cb) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('change', async () => {
      const val = el.type === 'checkbox' ? el.checked : el.value;
      await save.setSetting(key, val);
      if (cb) cb(val);
    });
  };

  bind('#toggleColorblind', 'colorblind', v => { app.colorblind = v; });
  bind('#toggleMotion', 'reducedMotion', v => { app.effects?.setReduced(v); });
  bind('#toggleHaptics', 'haptics');
  bind('#toggleSound', 'sound', v => audio.toggle(v));
  bind('#toggleMusic', 'music', v => audio.toggleMusic(v));

  const langEl = $('#selectLang');
  if (langEl) {
    langEl.addEventListener('change', async () => {
      const val = langEl.value;
      await save.setSetting('language', val);
      if (val === 'auto') {
        const browserLang = (navigator.language || 'de').substring(0, 2);
        setLanguage(browserLang === 'de' ? 'de' : 'en');
      } else {
        setLanguage(val);
      }
      localise(t);
    });
  }
}
