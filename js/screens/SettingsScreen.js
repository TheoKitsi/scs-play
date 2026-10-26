/* ═══════════════════════════════════════
   SCS Play — Settings Screen
   Toggles, language.
   ═══════════════════════════════════════ */
import { t, setLanguage, getLanguage } from '../i18n.js';
import { $, $$, localise, showScreen } from '../helpers/dom.js';
import app                   from '../appState.js';
import { applyMotionPreference } from '../helpers/perfMode.js';
import { livingArena } from '../helpers/livingArena.js';
import { cancelHaptics } from '../helpers/haptics.js';

let _settingsBack = null;
let _backLabelKey = 'nav_back_home';

function preferenceSaveFailed() {
  $('#settingsSaveNotice').hidden = false;
  $('#settingsSaveStatus').textContent = t('settings_save_error');
  if (app.currentScreen === 'settings') $('#settingsSaveNotice').scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

async function savePreference(key, value) {
  try {
    await app.save.setSetting(key, value);
    $('#settingsSaveNotice').hidden = true;
  } catch { preferenceSaveFailed(); }
}

function updateVolumeControl(input) {
  if (!input) return;
  input.style.setProperty('--range-value', `${input.value}%`);
  input.setAttribute('aria-valuetext', `${input.value}%`);
}

function syncAudioControls() {
  $('#rangeSfxVolume').disabled = !$('#toggleSound').checked;
  $('#rangeMusicVolume').disabled = !$('#toggleMusic').checked;
}

function syncPresentationControls() {
  const reduced = document.body.hasAttribute('data-reduced-motion');
  const depth = Boolean(app.save?.getSetting('arenaDepth'));
  const key = !depth ? 'settings_depth_off' : reduced ? 'settings_depth_motion'
    : document.body.dataset.perfMode !== 'high' ? 'settings_depth_quality' : 'settings_depth_ready';
  const status = $('#depthStatus');
  if (status) status.textContent = t(key);
  if (!$('#settingsSaveNotice').hidden) $('#settingsSaveStatus').textContent = t('settings_save_error');
  $$('.legal-links a').forEach(link => {
    const url = new URL(link.href);
    url.searchParams.set('lang', getLanguage());
    link.href = url.href;
  });
}

/* The bottom back button says where it actually goes (menu or paused game) */
function applyBackLabel() {
  $$('.btn-back-bottom', $('#settings')).forEach(btn => { btn.textContent = t(_backLabelKey); });
}

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
  _backLabelKey = fromPause && showPausedGame ? 'nav_back_game' : 'nav_back_home';
  showScreen('settings', app);
  $$('.settings-nav button').forEach(btn => btn.removeAttribute('aria-current'));
  $('#toggleColorblind').checked = save.getSetting('colorblind');
  $('#toggleMotion').checked     = save.getSetting('reducedMotion');
  $('#toggleDepth').checked      = Boolean(save.getSetting('arenaDepth'));
  $('#toggleBestRun').checked    = Boolean(save.getSetting('bestRunGhost'));
  $('#toggleHaptics').checked    = save.getSetting('haptics');
  $('#toggleSound').checked      = save.getSetting('sound');
  $('#toggleMusic').checked      = save.getSetting('music');
  const sfxVolume = save.getSetting('sfxVolume') ?? 80;
  const musicVolume = save.getSetting('musicVolume') ?? 70;
  $('#rangeSfxVolume').value = sfxVolume;
  $('#rangeMusicVolume').value = musicVolume;
  $('#sfxVolumeValue').textContent = `${sfxVolume}%`;
  $('#musicVolumeValue').textContent = `${musicVolume}%`;
  updateVolumeControl($('#rangeSfxVolume'));
  updateVolumeControl($('#rangeMusicVolume'));
  syncAudioControls();
  syncPresentationControls();
  $('#selectLang').value         = save.getSetting('language') || 'auto';

  /* Guests have no account to sign out of; the button only bounced them to
     the start screen. */
  const logout = $('#btnLogout');
  if (logout) logout.style.display = app.auth?.isGuest === false ? '' : 'none';

  applyBackLabel();
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
  $('#btnSettingsRetrySave').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (!await save.save()) throw new Error('No active save');
      $('#settingsSaveNotice').hidden = true;
    } catch { preferenceSaveFailed(); }
    finally { button.disabled = false; }
  });
  window.addEventListener('scs:perftier', syncPresentationControls);
  window.addEventListener('scs:motionpreference', syncPresentationControls);
  $$('.settings-nav button').forEach(button => {
    button.addEventListener('click', () => {
      const section = document.getElementById(button.dataset.settingsSection);
      const heading = section?.querySelector('legend');
      if (!heading) return;
      $$('.settings-nav button').forEach(btn => btn.removeAttribute('aria-current'));
      button.setAttribute('aria-current', 'true');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      section.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  });

  const bind = (sel, key, cb) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('change', async () => {
      const val = el.type === 'checkbox' ? el.checked : el.value;
      const saving = savePreference(key, val);
      if (cb) cb(val);
      await saving;
    });
  };

  bind('#toggleColorblind', 'colorblind', v => { app.colorblind = v; });
  bind('#toggleBestRun', 'bestRunGhost');
  bind('#toggleMotion', 'reducedMotion', v => {
    applyMotionPreference(v);
    app.effects?.setReduced(v);
  });
  bind('#toggleHaptics', 'haptics', v => { if (!v) cancelHaptics(); });
  bind('#toggleDepth', 'arenaDepth', v => { livingArena.setDepthEnabled(v); syncPresentationControls(); });
  bind('#toggleSound', 'sound', v => { audio.toggle(v); syncAudioControls(); });
  bind('#toggleMusic', 'music', v => { audio.toggleMusic(v); syncAudioControls(); });

  const bindVolume = (selector, outputSelector, key, setter, preview) => {
    const el = $(selector);
    const output = $(outputSelector);
    if (!el) return;
    el.addEventListener('input', () => {
      const value = Number(el.value);
      if (output) output.textContent = `${value}%`;
      updateVolumeControl(el);
      setter(value / 100);
    });
    el.addEventListener('change', async () => {
      await savePreference(key, Number(el.value));
      if (preview) preview();
    });
  };
  bindVolume('#rangeSfxVolume', '#sfxVolumeValue', 'sfxVolume', v => audio.setSfxVolume(v), () => audio.tap());
  bindVolume('#rangeMusicVolume', '#musicVolumeValue', 'musicVolume', v => audio.setMusicVolume(v));

  const langEl = $('#selectLang');
  if (langEl) {
    langEl.addEventListener('change', async () => {
      const val = langEl.value;
      const saving = savePreference('language', val);
      if (val === 'auto') {
        const browserLang = (navigator.language || 'de').substring(0, 2);
        setLanguage(browserLang === 'de' ? 'de' : 'en');
      } else {
        setLanguage(val);
      }
      localise(t);
      applyBackLabel();
      syncPresentationControls();
      await saving;
    });
  }
}
