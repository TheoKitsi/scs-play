/* ═══════════════════════════════════════
   SCS Play — Auth Screen
   Google, Apple, Email & Guest login.
   ═══════════════════════════════════════ */
import { t }                from '../i18n.js';
import { $, setText }       from '../helpers/dom.js';
import app                  from '../appState.js';

export function bindAuth(showHome) {
  const { auth } = app;

  // When Firebase isn't configured, hide cloud-auth UI once auth init completes
  auth.onAuthStateChanged(() => {
    if (!auth.fbReady) {
      $('#btnGoogle')?.closest('.auth-buttons')?.classList.add('hidden');
      $('#btnShowEmail')?.closest('.auth-form-toggle')?.classList.add('hidden');
      $('#authEmailForm')?.classList.add('hidden');
    }
  });

  $('#btnGoogle')?.addEventListener('click', async () => {
    try { await auth.signInWithGoogle?.(); showHome(); }
    catch { setText('#authError', t('auth_error')); }
  });

  $('#btnApple')?.addEventListener('click', async () => {
    try { await auth.signInWithApple?.(); showHome(); }
    catch { setText('#authError', t('auth_error')); }
  });

  $('#btnEmail')?.addEventListener('click', async () => {
    const email = $('#inputEmail')?.value;
    const pw    = $('#inputPassword')?.value;
    if (!email || !pw) return;
    try {
      await auth.signInWithEmail?.(email, pw);
      showHome();
    } catch {
      try { await auth.registerWithEmail?.(email, pw, email.split('@')[0]); showHome(); }
      catch { setText('#authError', t('auth_error')); }
    }
  });

  $('#btnGuest')?.addEventListener('click', async () => {
    try { await auth.signInAsGuest?.(); showHome(); }
    catch { setText('#authError', t('auth_error')); }
  });

  $('#btnShowEmail')?.addEventListener('click', () => {
    const form = $('#authEmailForm');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  });
}
