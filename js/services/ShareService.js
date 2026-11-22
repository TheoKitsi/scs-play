/* ═══════════════════════════════════════
   SCS Play — Share Service
   Web Share API + Capacitor Share + clipboard fallback.
    Localized round ticket with a compact text fallback.
   ═══════════════════════════════════════ */
import { t, getLanguage } from '../i18n.js';
import { appDialog } from '../helpers/appDialog.js';

function generateShareText(stats) {
  const mode = (stats.mode || 'klassik').toLowerCase();
  const modeName = t(`mode_${mode}`);
  const playType = stats.playType || 'classic';
  const score = Number(stats.score || 0).toLocaleString(getLanguage());
  const acc = stats.accuracy || 0;
  const streak = stats.streak || 0;
  const lines = [
    `SCS PLAY  /  ${modeName} · ${t(`play_${playType}`)}`,
    `${score} ${t('share_pts')}`,
    `${t('accuracy')}: ${acc}% · ${t('streak_label')}: ${streak}×`,
  ];

  /* Mode-specific highlight */
  if (stats.avgReaction && stats.avgReaction < 500) lines.push(`${t('avg_reaction')}: ${stats.avgReaction} ms`);
  if (stats.isPerfectRound) lines.push(`✨ ${t('share_perfect_round')}`);
  if (streak >= 20) lines.push(`🔥 ${t('share_insane_streak', { n: streak })}`);

  lines.push('');
  lines.push(t('share_challenge'));

  return lines.join('\n');
}

export async function shareScore(stats, getBodyFx) {
  if (!stats) return;
  const text = generateShareText(stats);
  const title = t('share_title') || 'SCS Play';
  const copiedMsg = `📋 ${t('share_copied')}`;

  function _showToast(msg) {
    try {
      const bodyFx = typeof getBodyFx === 'function' ? getBodyFx() : null;
      if (bodyFx && bodyFx.achievementToast) { bodyFx.achievementToast(msg); return; }
    } catch (_) {}
    // Fallback: simple DOM toast
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position:'fixed',bottom:'80px',left:'50%',transform:'translateX(-50%)',
      background:'rgba(15,23,42,0.95)',color:'#fff',padding:'10px 20px',
      borderRadius:'12px',fontSize:'0.9rem',fontWeight:'700',zIndex:'9999',
      boxShadow:'0 4px 16px rgba(0,0,0,0.3)',transition:'opacity 0.3s'
    });
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 2000);
  }

  function _fallbackCopy(str) {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove();
    return ok;
  }

  const strategies = [
    { test: () => window.Capacitor?.Plugins?.Share,
      run:  async () => { await window.Capacitor.Plugins.Share.share({ title, text, dialogTitle: title }); } },
    { test: () => navigator.share,
      run: async () => {
        let file;
        if (navigator.canShare && typeof File === 'function' &&
            navigator.canShare({files:[new File([], 'scs-play.png', {type:'image/png'})]})) {
          try { file = await (await import('../renderers/scorePostcard.js')).scorePostcard(stats); } catch { /* Text works without canvas. */ }
        }
        const payload = file && navigator.canShare({files:[file]}) ? {title,text,files:[file]} : {title,text};
        await navigator.share(payload);
      } },
    { test: () => navigator.clipboard?.writeText,
      run:  async () => { await navigator.clipboard.writeText(text); _showToast(copiedMsg); } },
    { test: () => true,
      run:  async () => { if (_fallbackCopy(text)) { _showToast(copiedMsg); return; } throw new Error('execCommand failed'); } }
  ];

  for (const s of strategies) {
    if (!s.test()) continue;
    try { await s.run(); return; } catch (error) {
      if (error?.name === 'AbortError') return; // Dismissing native sharing is not a failure.
      /* Unsupported/failed sharing may fall through to the next strategy. */
    }
  }

  // The manual-copy dialog is the complete fallback, not a second notification.
  await appDialog({ title: t('share_title'), message: t('share_copy_prompt'), copyText: text });
}
