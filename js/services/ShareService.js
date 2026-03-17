/* ═══════════════════════════════════════
   SCS Play — Share Service
   Web Share API + Capacitor Share + clipboard fallback.
   Viral-optimized emoji share cards.
   ═══════════════════════════════════════ */
import { t } from '../i18n.js';

/* ── Emoji helpers ── */
const MODE_EMOJI = {
  klassik: '🔴🟢🔵🟡', beginner: '🟢🔵🟡🔴',
  expert: '🔷🔶◆●', ultra: '🏆👑',
  mathe: '🔢➕', worte: '📝✨', memo: '🧠💭',
  sequenz: '🔔🎵', stroop: '🎨🖌️', fokus: '🎯👁️', chaos: '🌀🔄'
};
const PLAY_EMOJI  = { classic: '⏱', blitz: '⚡', endless: '♾️', competition: '🏅' };

function _accuracyBar(pct) {
  const filled = Math.round(pct / 10);
  return '🟩'.repeat(filled) + '⬛'.repeat(10 - filled);
}

function _tierEmoji(score, accuracy) {
  if (accuracy >= 95 && score >= 5000) return '👑';
  if (accuracy >= 85 && score >= 3000) return '🏆';
  if (accuracy >= 70 && score >= 1500) return '⭐';
  return '🎮';
}

function generateShareText(stats) {
  const mode = (stats.mode || 'klassik').toLowerCase();
  const modeName = (stats.mode || 'KLASSIK').toUpperCase();
  const playType = stats.playType || 'classic';
  const score = stats.score ? stats.score.toLocaleString() : '0';
  const acc = stats.accuracy || 0;
  const streak = stats.streak || 0;
  const tier = _tierEmoji(stats.score || 0, acc);
  const modeE = MODE_EMOJI[mode] || '🎮';
  const playE = PLAY_EMOJI[playType] || '⏱';

  const bar = _accuracyBar(acc);

  const lines = [
    `${tier} SCS PLAY ${modeE}`,
    ``,
    `${playE} ${modeName} · ${score} ${t('share_pts')}`,
    `🔥 Streak ${streak}x · 🎯 ${acc}%`,
    bar,
  ];

  /* Mode-specific highlight */
  if (stats.avgReaction && stats.avgReaction < 500) lines.push(`⚡ ${stats.avgReaction}ms avg`);
  if (stats.isPerfectRound) lines.push(`✨ ${t('share_perfect_round')}`);
  if (streak >= 20) lines.push(`🔥 ${t('share_insane_streak', { n: streak })}`);

  lines.push('');
  lines.push(`${t('share_challenge')} 👀`);
  lines.push('#SCSPlay');

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

  // 1. Capacitor Share
  if (window.Capacitor?.Plugins?.Share) {
    try {
      await window.Capacitor.Plugins.Share.share({
        title: title, text: text, dialogTitle: title
      });
      return;
    } catch (e) { console.warn('Capacitor share failed:', e); }
  }

  // 2. Web Share API (only works in secure contexts with user gesture)
  if (navigator.share) {
    try { await navigator.share({ title: title, text: text }); return; }
    catch (e) { console.warn('Web Share failed:', e); }
  }

  // 3. Clipboard API
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      _showToast(copiedMsg);
      return;
    } catch (e) { console.warn('Clipboard API failed:', e); }
  }

  // 4. execCommand fallback
  if (_fallbackCopy(text)) {
    _showToast(copiedMsg);
    return;
  }

  // 5. Last resort — show text to manually copy
  _showToast(`⚠️ ${t('share_unavailable')}`);
  prompt(t('share_copy_prompt'), text);
}
