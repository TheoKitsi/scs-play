/* ═══════════════════════════════════════
   SCS Play — Engagement Report Screen
   Renders the engagement dashboard with
   score visualization, signal cards,
   feedback summary, chart, and export.
   ═══════════════════════════════════════ */

import { t }                from '../i18n.js';
import { $, showScreen }    from '../helpers/dom.js';
import { escHTML }          from '../helpers/dom.js';
import app                   from '../appState.js';

/* ═══════ Helper: color class for a 0-1 score ═══════ */
function barClass(pct) {
  if (pct >= 0.75) return 'er-bar-green';
  if (pct >= 0.55) return 'er-bar-yellow';
  if (pct >= 0.35) return 'er-bar-orange';
  return 'er-bar-red';
}

function scoreColor(score) {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  if (score >= 40) return '#FF9F43';
  return 'var(--danger, #EF4444)';
}

function labelText(label) {
  const map = {
    engagement_high: t('er_high') || 'Klar Spass!',
    engagement_solid: t('er_solid') || 'Solides Engagement',
    engagement_mixed: t('er_mixed') || 'Gemischte Signale',
    engagement_low: t('er_low') || 'Wenig Engagement',
    not_enough_data: t('er_no_data') || 'Nicht genug Daten'
  };
  return map[label] || label;
}

/* ═══════ Render ═══════ */
export function showEngagementReport() {
  const { engagement } = app;
  showScreen('engagementReport', app);

  if (!engagement) {
    renderNoData(t('er_not_init') || 'Engagement-Tracker nicht initialisiert');
    return;
  }

  const result = engagement.computeEngagementScore();
  const { score, label, signals, subscores } = result;

  if (score === null) {
    renderNoData(labelText(label));
    return;
  }

  renderSummary(signals);
  renderScoreCircle(score, label);
  renderSignals(signals, subscores);
  renderFeedback(signals);
  renderDailyChart(engagement);
  bindExport(engagement);
}

/* ─── No data state ─── */
function renderNoData(msg) {
  const el = $('#erScoreCircle');
  if (el) el.innerHTML = `<div class="er-no-data"><span class="er-no-data-icon">&#x1F4CA;</span>${escHTML(msg)}<br><small>${t('er_play_more') || 'Spiele ein paar Runden, um Daten zu sammeln.'}</small></div>`;
  ['erSummary', 'erSignals', 'erFeedback', 'erDailyChart'].forEach(id => {
    const e = $(`#${id}`);
    if (e) e.innerHTML = '';
  });
}

/* ─── Summary header ─── */
function renderSummary(signals) {
  const el = $('#erSummary');
  if (!el) return;
  const since = signals.firstSeen ? signals.firstSeen.slice(0, 10) : '?';
  el.innerHTML = `${t('er_basis') || 'Datengrundlage'}: <strong>${signals.totalSessions}</strong> Sessions, <strong>${signals.totalGames}</strong> ${t('er_games') || 'Spiele'}, ${t('er_since') || 'seit'} ${since}`;
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
      <svg viewBox="0 0 140 140">
        <circle class="ring-bg" cx="70" cy="70" r="${r}"/>
        <circle class="ring-fill" cx="70" cy="70" r="${r}"
          stroke="${color}"
          stroke-dasharray="${circ}"
          stroke-dashoffset="${circ}"/>
      </svg>
      <span class="er-score-num">${score}</span>
    </div>
    <span class="er-score-label">${escHTML(labelText(label))}</span>`;

  /* Animate ring fill */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = el.querySelector('.ring-fill');
      if (fill) fill.style.strokeDashoffset = offset;
    });
  });
}

/* ─── Signal cards ─── */
function renderSignals(signals, subscores) {
  const el = $('#erSignals');
  if (!el) return;

  const cards = [
    {
      title: t('er_retention') || 'R\u00fcckkehr',
      value: `${signals.activeDaysPerWeek} ${t('er_days_week') || 'T/Wo.'}`,
      pct: subscores.retention
    },
    {
      title: t('er_sessions') || 'Sessions',
      value: `\u00d8 ${signals.avgSessionMin} Min.`,
      pct: subscores.sessionLen
    },
    {
      title: t('er_learning') || 'Lernkurve',
      value: `${signals.avgScoreTrend >= 0 ? '\u2197 +' : '\u2198 '}${(signals.avgScoreTrend * 100).toFixed(1)}%`,
      pct: subscores.scoreTrend
    },
    {
      title: t('er_retry') || 'Retry',
      value: `${(signals.retryRate * 100).toFixed(0)}%`,
      pct: subscores.retryRate
    },
    {
      title: t('er_quits') || 'Abbr\u00fcche',
      value: `${(signals.quitRate * 100).toFixed(0)}%`,
      pct: subscores.quitRate
    },
    {
      title: t('er_modes') || 'Modi',
      value: `${signals.modesPlayed} / 11`,
      pct: subscores.exploration
    }
  ];

  el.innerHTML = cards.map(c => {
    const pctRound = Math.round((c.pct || 0) * 100);
    const cls = barClass(c.pct || 0);
    return `
      <div class="er-signal-card">
        <span class="er-signal-title">${escHTML(c.title)}</span>
        <span class="er-signal-value">${escHTML(c.value)}</span>
        <div class="er-signal-bar"><div class="er-signal-bar-fill ${cls}" style="width:${pctRound}%"></div></div>
        <span class="er-signal-pct">${pctRound}%</span>
      </div>`;
  }).join('');
}

/* ─── Feedback summary ─── */
function renderFeedback(signals) {
  const el = $('#erFeedback');
  if (!el) return;

  if (signals.feedbackCount === 0) {
    el.innerHTML = `
      <span class="er-feedback-title">${t('er_feedback') || 'Spieler-Feedback'}</span>
      <div class="er-feedback-row"><span class="er-feedback-label">${t('er_no_feedback') || 'Noch kein Feedback gesammelt'}</span></div>`;
    return;
  }

  const emojis = ['\u{1F610}', '\u{1F642}', '\u{1F60A}', '\u{1F60D}'];
  const ratingEmoji = signals.avgRating >= 3.5 ? emojis[3] : signals.avgRating >= 2.5 ? emojis[2] : signals.avgRating >= 1.5 ? emojis[1] : emojis[0];

  el.innerHTML = `
    <span class="er-feedback-title">${t('er_feedback') || 'Spieler-Feedback'}</span>
    <div class="er-feedback-row">
      <span class="er-feedback-label">${t('er_avg_rating') || 'Durchschnitt'}</span>
      <span>${ratingEmoji} ${signals.avgRating} / 4</span>
    </div>
    <div class="er-feedback-row">
      <span class="er-feedback-label">${t('er_entries') || 'Eintr\u00e4ge'}</span>
      <span>${signals.feedbackCount}</span>
    </div>
    <div class="er-feedback-row">
      <span class="er-feedback-label">${t('er_skip_rate') || 'Skip-Rate'}</span>
      <span>${(signals.skipRate * 100).toFixed(0)}%</span>
    </div>`;
}

/* ─── Daily games bar chart (pure CSS) ─── */
function renderDailyChart(engagement) {
  const el = $('#erDailyChart');
  if (!el) return;

  const dailyCounts = engagement.getDailyGameCounts(14);
  const maxCount = Math.max(1, ...dailyCounts.map(([, c]) => c));

  el.innerHTML = `
    <span class="er-chart-title">${t('er_daily_games') || 'Spiele / Tag (14 Tage)'}</span>
    <div class="er-chart-bars">
      ${dailyCounts.map(([date, count]) => {
        const heightPct = Math.max(2, (count / maxCount) * 100);
        const dayLabel = date.slice(8, 10) + '.' + date.slice(5, 7);
        return `<div class="er-chart-bar" style="height:${heightPct}%"><span class="er-chart-bar-label">${dayLabel}</span></div>`;
      }).join('')}
    </div>`;
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
        const msg = t('er_copied') || 'In Zwischenablage kopiert!';
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
