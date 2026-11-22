import { getLanguage, t } from '../i18n.js';
import { showScreen, $ } from '../helpers/dom.js';
import { CONFIG } from '../config.js';
import { lastArcade } from '../helpers/lastPlay.js';
import { PRISM_LEVELS } from '../game/prism/levels.js';
import { prismProgress } from '../services/PrismProgress.js';
import app from '../appState.js';
import { playDock } from '../renderers/playDock.js';
import { appDialog } from '../helpers/appDialog.js';

export function showPlayHub(section, act) {
  const de = getLanguage() === 'de', say = (d,e) => de ? d : e;
  const {save} = app, progress = prismProgress(save.data), last = lastArcade(save);
  const level = PRISM_LEVELS[progress.completed === 12 ? 0 : progress.unlocked];
  const collection = section === 'collection';
  const title = collection ? say('Sammlung','Collection') : say('Spielen','Play');
  const icon = id => `<svg aria-hidden="true" viewBox="0 0 24 24"><use href="#icon-${id}"/></svg>`;
  const list = [
    ['klassik','optics',CONFIG.DURATION_BLITZ],
    ['memo','archive',CONFIG.DURATION_BLITZ],
    ['mathe','calculus',CONFIG.DURATION_BLITZ_BRAIN],
  ];
  const archiveLink = (action, name, info, glyph) =>
    `<button type="button" class="hub-entry" data-action="${action}">${icon(glyph)}<span><strong>${name}</strong><small>${info}</small></span><span class="hub-next" aria-hidden="true">↗</span></button>`;
  const root = $('#hub');
  root.innerHTML = `<div class="hub-shell"><div class="hub-scroll"><header><h1>${title}</h1><span class="hub-kicker">SCS PLAY</span></header>
    ${collection ? `<section class="hub-record">
      <h2 class="hub-kicker">${say('Dein Prismengarten','Your prism garden')}</h2>
      <div class="hub-count"><strong>${progress.completed}</strong><span> / 12</span></div>
      <p>${say('Gartenrätsel gelöst','garden puzzles solved')}</p>
      <div class="hub-meter" aria-hidden="true">${PRISM_LEVELS.map(l => `<i${progress.levels[l.id] ? ' class="earned"' : ''}></i>`).join('')}</div>
      <small>${progress.stars} / 36 ${say('Sterne','stars')}</small></section>
      <div class="hub-index">
      ${archiveLink('records',say('Rekorde','Records'),say('Bestleistungen','Personal bests'),'chart')}
      ${archiveLink('awards',say('Erfolge','Achievements'),`${save.getAchievements().length} ${say('verdient','earned')}`,'trophy')}
      ${archiveLink('insights',t('engagement_report_title'),say('Spielrhythmus und Verlauf','Sessions and recent activity'),'chart')}
      ${archiveLink('looks',say('Aussehen','Appearance'),say('Designs und Ausrüstung','Themes and equipment'),'eye')}
      ${archiveLink('settings',say('Einstellungen','Settings'),say('Profil, Ton und Bedienung','Profile, sound and controls'),'sliders')}</div>` :
    `<button type="button" class="hub-resume" data-scene="${last?'harbour':'valley'}" data-action="resume">
      <span class="hub-kicker">${last ? say('Arcade · Weiterspielen','Arcade · Play again') : 'Prism Worlds'}</span>
      <strong>${last ? t('mode_'+last.mode) : level.name[de ? 0 : 1]}</strong>
      <span class="hub-playline"><i aria-hidden="true">${icon('play')}</i>${last ? t('play_'+last.type) : `${say('Rätsel','Puzzle')} ${PRISM_LEVELS.indexOf(level)+1} / 12`}</span></button>
      <div class="hub-caption"><h2>Arcade</h2><button type="button" data-action="catalog">${say('Alle Modi','All modes')} →</button></div>
      <div class="hub-shelf">${list.map(([mode,cover,seconds]) => `<button type="button" class="hub-row" data-action="${mode}">
        <img class="hub-cover" alt="" src="img/scenery/${cover}.webp" width="512" height="384">
        <span class="hub-mode"><strong>${t('mode_'+mode)}</strong><small>${t('task_'+mode)}</small></span>
        <span class="hub-duration">${seconds} s</span></button>`).join('')}</div>
      ${archiveLink('today',t('today_label'),`${t('daily_challenge_short')} · ${t('wheel_title')}`,'clock')}`}
    </div>${playDock(section)}</div>`;
  root.onclick = async event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'today') {
      act('catalog');
      requestAnimationFrame(() => window.dispatchEvent(new Event('scs:home-today')));
    } else if (action === 'insights') {
      button.disabled = true;
      try {
        const { showEngagementReport } = await import('./EngagementReportScreen.js');
        if (app.currentScreen === 'hub' && button.isConnected) showEngagementReport(() => act('collection'));
      } catch {
        if (app.currentScreen === 'hub' && button.isConnected) await appDialog({title:t('engagement_report_title'),message:t('error_network')});
      } finally { button.disabled = false; }
    } else act(action, last);
  };
  showScreen('hub', app);
  root.scrollTop = 0;
  app.audio.setMusicMode('menu'); app.audio.startMusic();
}
