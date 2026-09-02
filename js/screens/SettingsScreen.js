/* ═══════════════════════════════════════
   SCS Play — Settings Screen
   Toggles, language.
   ═══════════════════════════════════════ */
import { t, setLanguage }   from '../i18n.js';
import { $, $$, localise, showScreen } from '../helpers/dom.js';
import app                   from '../appState.js';

let _settingsBack = null;

export function backFromSettings() {
  if (app.currentScreen !== 'settings' || !_settingsBack) return false;
  const back = _settingsBack;
  _settingsBack = null;
  back();
  return true;
}

export function showSettings(fromPause, showHome, showPausedGame) {
  const { save } = app;
  _settingsBack = fromPause && showPausedGame ? showPausedGame : showHome;
  showScreen('settings', app);
  $('#toggleColorblind').checked = save.getSetting('colorblind');
  $('#toggleMotion').checked     = save.getSetting('reducedMotion');
  $('#toggleHaptics').checked    = save.getSetting('haptics');
  $('#toggleSound').checked      = save.getSetting('sound');
  $('#toggleMusic').checked      = save.getSetting('music');
  const sfxVolume = save.getSetting('sfxVolume') ?? 80;
  const musicVolume = save.getSetting('musicVolume') ?? 70;
  $('#rangeSfxVolume').value = sfxVolume;
  $('#rangeMusicVolume').value = musicVolume;
  $('#sfxVolumeValue').textContent = `${sfxVolume}%`;
  $('#musicVolumeValue').textContent = `${musicVolume}%`;
  $('#selectLang').value         = save.getSetting('language') || 'auto';

  $$('.btn-back, .btn-back-bottom', $('#settings')).forEach(btn => {
    btn._customBack = true;
    btn.onclick = () => {
      btn._customBack = false;
      backFromSettings();
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
  bind('#toggleMotion', 'reducedMotion', v => {
    app.effects?.setReduced(v);
    document.body.toggleAttribute('data-reduced-motion', Boolean(v));
  });
  bind('#toggleHaptics', 'haptics');
  bind('#toggleSound', 'sound', v => audio.toggle(v));
  bind('#toggleMusic', 'music', v => audio.toggleMusic(v));

  const bindVolume = (selector, outputSelector, key, setter, preview) => {
    const el = $(selector);
    const output = $(outputSelector);
    if (!el) return;
    el.addEventListener('input', () => {
      const value = Number(el.value);
      if (output) output.textContent = `${value}%`;
      setter(value / 100);
    });
    el.addEventListener('change', async () => {
      await save.setSetting(key, Number(el.value));
      if (preview) preview();
    });
  };
  bindVolume('#rangeSfxVolume', '#sfxVolumeValue', 'sfxVolume', v => audio.setSfxVolume(v), () => audio.tap());
  bindVolume('#rangeMusicVolume', '#musicVolumeValue', 'musicVolume', v => audio.setMusicVolume(v));

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
