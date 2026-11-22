/* ═══════════════════════════════════════
   SCS Play — Leaderboard Screen
   Filtered score lists with modes + play types.
   ═══════════════════════════════════════ */
import { getLanguage, t }   from '../i18n.js';
import { $, $$, showScreen, escHTML } from '../helpers/dom.js';
import { CONFIG } from '../config.js';
import { getUnlockLevel } from '../helpers/modeUnlockHelper.js';
import { modePreview } from '../renderers/modePreview.js';
import app                   from '../appState.js';

let lbFilter = 'blitz';
let lbMode = 'klassik';
let _lbInitialized = false;

function relativeDate(isoStr) {
  if (!isoStr) return '';
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  if (isNaN(then)) return '';
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t('just_now');
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} d`;
  return new Date(isoStr).toLocaleDateString(getLanguage());
}

function renderLeaderboard() {
  const { save } = app;
  const scores = save.getScores(lbMode).filter(s => (s.playType || 'blitz') === lbFilter);
  const list = $('#scoreList');
  if (!list) return;
  list.scrollTop = 0;
  const topic = `${t(`mode_${lbMode}`)} · ${t(`play_${lbFilter}`)}`;
  const rule = !save.isModeUnlocked(lbMode) ? t('mode_locked', { n:getUnlockLevel(lbMode) })
    : lbMode === 'sequenz' && lbFilter !== 'endless' ? t('sequenz_endless_only')
    : lbFilter === 'competition' && !save.isCompetitionUnlocked() ? t('play_competition_locked') : '';

  if (scores.length === 0) {
    list.innerHTML = `
      <div class="lb-empty-state">
        <div class="records-preview">${modePreview(lbMode, app.colorblind)}</div>
        <small class="catalog-eyebrow">${topic}</small>
        <h3>${t('lb_no_scores')}</h3>
        <p class="lb-empty-hint">${rule || t('lb_play_hint')}</p>
        ${rule ? '' : `<button type="button" class="btn btn-primary lb-play-now" id="btnLbPlayNow">${t('lb_play_now')}</button>`}
      </div>`;
    const playBtn = list.querySelector('#btnLbPlayNow');
    if (playBtn) playBtn.onclick = () => window.dispatchEvent(new CustomEvent('scs:play-record-mode',{detail:{mode:lbMode,type:lbFilter}}));
    return;
  }

  const medalLabels = [t('medal_place_1'), t('medal_place_2'), t('medal_place_3')];

  list.innerHTML = `<div class="records-caption"><strong>${topic}</strong><span>${scores.length} ${t('er_games')}</span></div>` + scores.map((s, i) => {
    const medal = `<span class="lb-rank-num"${i < 3 ? ` aria-label="${medalLabels[i]}"` : ''}>${String(i + 1).padStart(2, '0')}</span>`;
    const relDate = relativeDate(s.date);

    return `
      <div class="score-row ${i < 3 ? 'top-' + (i + 1) : ''} own-score">
        ${medal}
         <div class="score-info">
            <span class="score-name">${relDate ? `${relDate} · ` : ''}${s.isDaily ? t('daily_challenge_short') : escHTML(save.data?.displayName || t('lb_me'))}</span>
            <span class="score-detail">${s.accuracy == null ? '—' : `${Number(s.accuracy)}%`} · ${t('combo')} ${Number(s.streak) || 0}</span>
        </div>
        <div class="score-big score-big-own">
           ${Number(s.score).toLocaleString(getLanguage())}
        </div>
      </div>`;
  }).join('');
}

export function showLeaderboard() {
  const { audio } = app;
  showScreen('leaderboard', app);
  if (!_lbInitialized) {
    lbFilter = app.selectedPlayType || 'blitz';
    lbMode = app.selectedMode || 'klassik';
    _lbInitialized = true;
  }

  const modeSelect = $('#lbModeSelect');
  modeSelect.innerHTML = CONFIG.MODE_ORDER.map(mode => `<option value="${mode}">${t(`mode_${mode}`)}</option>`).join('');
  if (!CONFIG.MODE_ORDER.includes(lbMode)) lbMode = 'klassik';
  modeSelect.value = lbMode;
  modeSelect.onchange = () => { lbMode = modeSelect.value; renderLeaderboard(); audio.tap(); };

  $$('.lb-filter-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.filter === lbFilter);
    btn.setAttribute('aria-pressed', String(btn.dataset.filter === lbFilter));
    btn.onclick = () => { lbFilter = btn.dataset.filter; $$('.lb-filter-btn').forEach(b => { b.classList.toggle('selected', b === btn); b.setAttribute('aria-pressed', String(b === btn)); }); renderLeaderboard(); audio.tap(); };
  });

  renderLeaderboard();
}
