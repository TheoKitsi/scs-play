/* ═══════════════════════════════════════
   SCS Play — Leaderboard Screen
   Filtered score lists with modes + play types.
   ═══════════════════════════════════════ */
import { t }                from '../i18n.js';
import { $, $$, showScreen } from '../helpers/dom.js';
import { avatarHTML }        from '../renderers/avatars.js';
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
  return new Date(isoStr).toLocaleDateString();
}

function renderLeaderboard() {
  const { save } = app;
  const scores = save.getScores(lbMode).filter(s => (s.playType || 'blitz') === lbFilter);
  const list = $('#scoreList');
  if (!list) return;

  if (scores.length === 0) {
    list.innerHTML = `
      <div class="lb-empty-state">
        <span class="lb-empty-icon">\uD83C\uDFC6</span>
        <p>${t('lb_no_scores') || 'Noch keine Eintr\u00e4ge'}</p>
        <p class="lb-empty-hint">${t('lb_play_hint') || 'Spiele eine Runde, um den ersten Eintrag zu setzen'}</p>
        <button class="btn btn-primary btn-sm lb-play-now" id="btnLbPlayNow">${t('lb_play_now') || 'Jetzt spielen!'}</button>
      </div>`;
    const playBtn = list.querySelector('#btnLbPlayNow');
    if (playBtn) playBtn.addEventListener('click', () => {
      import('./HomeScreen.js').then(m => m.showHome ? m.showHome() : null).catch(() => {});
    });
    return;
  }

  const avatar = save.getAvatar();
  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

  list.innerHTML = scores.slice(0, 20).map((s, i) => {
    const medal = i < 3 ? `<span class="lb-rank-icon">${medals[i]}</span>` : `<span class="lb-rank-num">#${i + 1}</span>`;
    const relDate = relativeDate(s.date);

    return `
      <div class="score-row ${i < 3 ? 'top-' + (i + 1) : ''} own-score" style="opacity:0; animation: popIn 0.4s var(--ease-out-soft) forwards; animation-delay: ${0.08 * i}s;">
        ${medal}
        <div class="score-avatar">${avatarHTML(avatar)}</div>
        <div class="score-info">
           <span class="score-name">${save.data?.displayName || t('lb_me')}</span>
           <span class="score-detail">${s.accuracy ?? '\u2014'}% \u00B7 ${s.streak ?? 0}\uD83D\uDD25 \u00B7 ${relDate}</span>
        </div>
        <div class="score-big score-big-own">
           ${s.score.toLocaleString()}
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

  $$('.lb-mode-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.mode === lbMode);
    btn.onclick = () => { lbMode = btn.dataset.mode; $$('.lb-mode-btn').forEach(b => b.classList.toggle('selected', b === btn)); renderLeaderboard(); audio.tap(); };
  });

  $$('.lb-filter-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.filter === lbFilter);
    btn.onclick = () => { lbFilter = btn.dataset.filter; $$('.lb-filter-btn').forEach(b => b.classList.toggle('selected', b === btn)); renderLeaderboard(); audio.tap(); };
  });

  renderLeaderboard();
}
