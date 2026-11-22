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
let _collectionReturn = false;
let failedControl = null;

function preferenceSaveFailed(control) {
  const notice = $('#settingsSaveNotice');
  if (control) {
    failedControl = control;
    const row = control.closest('.setting-row');
    if (row && row.nextElementSibling !== notice) row.after(notice);
  }
  notice.hidden = false;
  $('#settingsSaveStatus').textContent = t('settings_save_error');
  if (app.currentScreen === 'settings') {
    if (document.activeElement === control) $('#btnSettingsRetrySave').focus({ preventScroll: true });
    notice.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
}

async function savePreference(key, value, control) {
  try {
    await app.save.setSetting(key, value);
    $('#settingsSaveNotice').hidden = true;
    failedControl = null;
  } catch { preferenceSaveFailed(control); }
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
    url.searchParams.set('from', 'settings');
    link.href = url.href;
    const newTab = getLanguage() === 'de' ? 'öffnet in neuem Tab' : 'opens in a new tab';
    link.setAttribute('aria-label', `${link.textContent} (${newTab})`);
  });
}

/* The bottom back button says where it actually goes (menu or paused game) */
function applyBackLabel() {
  const label = _collectionReturn ? `← ${getLanguage() === 'de' ? 'Sammlung' : 'Collection'}` : t(_backLabelKey);
  $$('.btn-back-bottom', $('#settings')).forEach(btn => { btn.textContent = label; });
}

function markSection(id) {
  for (const button of $$('.settings-nav button')) {
    if (button.dataset.settingsSection === id) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
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
  const origin = app.currentScreen;
  _collectionReturn = origin === 'hub';
  _settingsBack = fromPause && showPausedGame ? showPausedGame : () => {
    window.addEventListener('scs:screenchange', event => {
      if (event.detail.id !== origin) return;
      requestAnimationFrame(() => {
        const button = origin === 'hub' ? $('#hub [data-action="settings"]') : $('#btnSettings');
        if (app.currentScreen === origin && button?.getClientRects().length) button.focus();
      });
    }, { once: true });
    showHome();
  };
  _backLabelKey = fromPause && showPausedGame ? 'nav_back_game' : 'nav_back_home';
  showScreen('settings', app);
  $('#settings .screen-content').scrollTop = 0;
  markSection('settingsDisplay');
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
  if (logout) logout.hidden = app.auth?.isGuest !== false;

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
  $('#btnSettingsRetrySave').setAttribute('aria-describedby', 'settingsSaveStatus');
  for (const row of $$('#settings .setting-row')) {
    const input = row.querySelector('input, select');
    const name = row.querySelector('span[data-i18n]');
    if (!input || !name) continue;
    name.id = `${input.id}Label`;
    input.setAttribute('aria-labelledby', name.id);
    const descriptions = [...row.querySelectorAll('small')].map((node, index) => {
      node.id ||= `${input.id}Hint${index}`;
      return node.id;
    });
    if (descriptions.length) input.setAttribute('aria-describedby', descriptions.join(' '));
  }
  $('#btnSettingsRetrySave').addEventListener('click', async event => {
    const button = event.currentTarget;
    if (button.hasAttribute('aria-busy')) return;
    button.setAttribute('aria-busy', 'true');
    try {
      if (!await save.save()) throw new Error('No active save');
      if (app.currentScreen === 'settings' && document.activeElement === button) failedControl?.focus();
      $('#settingsSaveNotice').hidden = true;
      failedControl = null;
    } catch { preferenceSaveFailed(); }
    finally { button.removeAttribute('aria-busy'); }
  });
  window.addEventListener('scs:perftier', syncPresentationControls);
  window.addEventListener('scs:motionpreference', syncPresentationControls);
  const scroller = $('#settings .screen-content');
  const groups = $$('#settings .setting-group');
  let frame = 0;
  scroller.addEventListener('scroll', () => {
    if (frame || app.currentScreen !== 'settings') return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (app.currentScreen !== 'settings') return;
      const line = scroller.getBoundingClientRect().top + parseFloat(getComputedStyle(scroller).scrollPaddingTop) + 2;
      const current = groups.filter(group => group.getBoundingClientRect().top <= line).at(-1) || groups[0];
      markSection(current.id);
    });
  }, { passive: true });
  $$('.settings-nav button').forEach(button => {
    button.addEventListener('click', () => {
      const section = document.getElementById(button.dataset.settingsSection);
      const heading = section?.querySelector('legend');
      if (!heading) return;
      markSection(section.id);
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
      const saving = savePreference(key, val, el);
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
      await savePreference(key, Number(el.value), el);
      if (preview) preview();
    });
  };
  bindVolume('#rangeSfxVolume', '#sfxVolumeValue', 'sfxVolume', v => audio.setSfxVolume(v), () => audio.tap());
  bindVolume('#rangeMusicVolume', '#musicVolumeValue', 'musicVolume', v => audio.setMusicVolume(v));

  const langEl = $('#selectLang');
  if (langEl) {
    langEl.addEventListener('change', async () => {
      const val = langEl.value;
      const saving = savePreference('language', val, langEl);
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
