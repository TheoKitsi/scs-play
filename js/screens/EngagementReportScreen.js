/* ═══════════════════════════════════════
   SCS Play — Engagement Report Screen
   Renders the engagement dashboard with
   score visualization, signal cards,
   feedback summary, chart, and export.
   ═══════════════════════════════════════ */

import { t, getLanguage } from '../i18n.js';
import { $, showScreen, escHTML } from '../helpers/dom.js';
import { CONFIG } from '../config.js';
import app                   from '../appState.js';

function scoreColor(score) {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  if (score >= 40) return '#FF9F43';
  return 'var(--danger, #EF4444)';
}

function labelText(label) {
  const map = {
    engagement_high: t('er_high'),
    engagement_solid: t('er_solid'),
    engagement_mixed: t('er_mixed'),
    engagement_low: t('er_low'),
    not_enough_data: t('er_no_data')
  };
  return map[label] || label;
}

/* ═══════ Render ═══════ */
export function showEngagementReport(onBrowse = () => window.dispatchEvent(new Event('scs:show-home'))) {
  const { engagement } = app;
  showScreen('engagementReport', app);
  $('#engagementReport .er-content').scrollTop = 0;
  $('#engagementReport')?.classList.remove('no-data');

  if (!engagement) {
    renderNoData(t('er_not_init'), undefined, onBrowse);
    return;
  }

  const result = engagement.computeEngagementScore();
  const { score, label, signals } = result;

  if (score === null) {
    renderNoData(labelText(label), signals.totalGames, onBrowse);
    return;
  }

  renderSummary(signals);
  renderScoreCircle(score, label);
  renderSignals(signals);
  renderFeedback(signals);
  renderDailyChart(engagement);
  $('#erExportButtons')?.removeAttribute('hidden');
  bindExport(engagement);
}

/* ─── No data state ─── */
function renderNoData(msg, rounds, onBrowse) {
  $('#engagementReport')?.classList.add('no-data');
  const el = $('#erScoreCircle');
  if (el) {
    el.innerHTML = `<div class="er-no-data">
      ${rounds === undefined ? '' : `<span class="catalog-eyebrow">${t('er_games')} · ${rounds} / 3</span>`}
      ${rounds === undefined ? '' : `<span class="er-baseline" aria-hidden="true">${Array.from({length:3}, (_,i)=>`<i class="${i < rounds ? 'filled' : ''}"></i>`).join('')}</span>`}
      <h3>${escHTML(msg)}</h3><p>${t('er_play_more')}</p>
      <button type="button" class="btn btn-primary" id="btnErPlayNow">${t('play')} →</button></div>`;
    el.querySelector('#btnErPlayNow')?.addEventListener('click', onBrowse);
  }
  ['erSummary', 'erSignals', 'erFeedback', 'erDailyChart'].forEach(id => {
    const e = $(`#${id}`);
    if (e) e.innerHTML = '';
  });
  $('#erExportButtons')?.setAttribute('hidden', '');
}

/* ─── Summary header ─── */
function renderSummary(signals) {
  const el = $('#erSummary');
  if (!el) return;
  const since = signals.firstSeen ? new Date(signals.firstSeen).toLocaleDateString(getLanguage()) : '—';
  el.innerHTML = `<div><strong>${signals.totalGames}</strong><span>${t('er_games')}</span></div>
    <div><strong>${signals.totalSessions}</strong><span>${t('er_sessions_unit')}</span></div>
    <small>${t('er_since')} ${since}</small>`;
}

/* ─── Big score circle (SVG ring) ─── */
function renderScoreCircle(score, label) {
  const el = $('#erScoreCircle');
  if (!el) return;

  const r = 60;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = scoreColor(score);

  el.innerHTML = `
    <div class="er-score-ring">
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle class="ring-bg" cx="70" cy="70" r="${r}"/>
        <circle class="ring-fill" cx="70" cy="70" r="${r}"
          stroke="${color}"
          stroke-dasharray="${circ}"
          stroke-dashoffset="${circ}"/>
      </svg>
      <span class="er-score-num">${score}</span>
    </div>
    <span class="er-score-label">${t('er_activity')} · ${escHTML(labelText(label))}</span>`;

  /* Animate ring fill */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = el.querySelector('.ring-fill');
      if (fill) fill.style.strokeDashoffset = offset;
    });
  });
}

/* ─── Signal cards ─── */
function renderSignals(signals) {
  const el = $('#erSignals');
  if (!el) return;

  const cards = [
    {
      title: t('er_retention'),
      value: `${signals.activeDaysPerWeek} ${t('er_days_week')}`
    },
    {
      title: t('er_sessions'),
      value: `\u00d8 ${signals.avgSessionMin} min`
    },
    {
      title: t('er_score_trend'),
      value: `${signals.avgScoreTrend >= 0 ? '+' : ''}${(signals.avgScoreTrend * 100).toFixed(1)}%`
    },
    {
      title: t('er_retry'),
      value: `${(signals.retryRate * 100).toFixed(0)}%`
    },
    {
      title: t('er_quits'),
      value: `${(signals.quitRate * 100).toFixed(0)}%`
    },
    {
      title: t('er_modes'),
      value: `${signals.modesPlayed} / ${CONFIG.MODE_ORDER.length}`
    }
  ];

  el.innerHTML = cards.map(c => {
    return `
      <div class="er-signal-card">
        <span class="er-signal-title">${escHTML(c.title)}</span>
        <span class="er-signal-value">${escHTML(c.value)}</span>
      </div>`;
  }).join('');
}

/* ─── Feedback summary ─── */
function renderFeedback(signals) {
  const el = $('#erFeedback');
  if (!el) return;

  if (signals.feedbackCount === 0) {
    el.innerHTML = `
      <span class="er-feedback-title">${t('er_feedback')}</span>
      <div class="er-feedback-row"><span class="er-feedback-label">${t('er_no_feedback')}</span></div>`;
    return;
  }

  const emojis = ['\u{1F610}', '\u{1F642}', '\u{1F60A}', '\u{1F60D}'];
  const ratingEmoji = signals.avgRating >= 3.5 ? emojis[3] : signals.avgRating >= 2.5 ? emojis[2] : signals.avgRating >= 1.5 ? emojis[1] : emojis[0];

  el.innerHTML = `
    <span class="er-feedback-title">${t('er_feedback')}</span>
    <div class="er-feedback-row">
      <span class="er-feedback-label">${t('er_avg_rating')}</span>
      <span>${ratingEmoji} ${signals.avgRating} / 4</span>
    </div>
    <div class="er-feedback-row">
      <span class="er-feedback-label">${t('er_entries')}</span>
      <span>${signals.feedbackCount}</span>
    </div>
    <div class="er-feedback-row">
      <span class="er-feedback-label">${t('er_skip_rate')}</span>
      <span>${(signals.skipRate * 100).toFixed(0)}%</span>
    </div>`;
}

/* ─── Daily games bar chart (pure CSS) ─── */
function renderDailyChart(engagement) {
  const el = $('#erDailyChart');
  if (!el) return;

  const dailyCounts = engagement.getDailyGameCounts(14);
  const maxCount = Math.max(1, ...dailyCounts.map(([, c]) => c));
  const formatDate = iso => new Date(`${iso}T12:00:00`).toLocaleDateString(getLanguage(), {day:'numeric',month:'short'});

  el.innerHTML = `
    <span class="er-chart-title">${t('er_daily_games')}</span>
    <div class="er-chart-bars" aria-hidden="true">
      ${dailyCounts.map(([, count]) => `<div class="er-chart-bar" style="height:${(count / maxCount) * 100}%"></div>`).join('')}
    </div>
    <div class="er-range">${[dailyCounts.at(0), dailyCounts.at(-1)].filter(Boolean).map(([d])=>`<span>${formatDate(d)}</span>`).join('')}</div>
    <details class="er-days"><summary>${getLanguage() === 'de' ? 'Tageswerte' : 'Daily totals'}</summary>
      <dl>${dailyCounts.map(([d,c])=>`<div><dt>${formatDate(d)}</dt><dd>${c}</dd></div>`).join('')}</dl>
    </details>`;
}

/* ─── Export buttons ─── */
function bindExport(engagement) {
  const btnText = $('#btnErCopyText');
  const btnJSON = $('#btnErExportJSON');

  if (btnText) {
    btnText.onclick = async () => {
      const text = engagement.exportText();
      try {
        await navigator.clipboard.writeText(text);
        const bodyFx = app.bodyFx || (typeof app.effects?.achievementToast === 'function' ? app.effects : null);
        const msg = t('er_copied');
        if (bodyFx && typeof bodyFx.achievementToast === 'function') {
          bodyFx.achievementToast(msg);
        }
      } catch {
        /* Fallback: create temp textarea */
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    };
  }

  if (btnJSON) {
    btnJSON.onclick = () => {
      const data = engagement.exportJSON();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scs-engagement-report-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  }
}
