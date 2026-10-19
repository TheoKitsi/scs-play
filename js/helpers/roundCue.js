import { $ } from './dom.js';
import { CONFIG } from '../config.js';
import { modeArtwork } from '../renderers/modeArtwork.js';

let pending = null;

export function cancelRoundCue() {
  const cancelled = pending;
  if (cancelled) clearTimeout(cancelled.timer);
  pending = null;
  const cue = $('#roundCue');
  if (cue) cue.hidden = true;
  $('#game')?.removeAttribute('data-round-phase');
  document.querySelectorAll('#game .corner-shape,#centerPlatform,#btnPause').forEach(el => { el.inert = false; });
  cancelled?.cancel?.();
}

/** Presentation only: the engine has already stopped. No scoring/timer grace. */
export function showRoundCue(label, mode, complete, ready = false, cancel = null) {
  cancelRoundCue();
  const cue = $('#roundCue');
  if (!cue) return complete();
  $('#roundCueArt').innerHTML = modeArtwork(mode);
  $('#roundCueLabel').textContent = label;
  $('#game').dataset.roundPhase = ready ? 'ready' : 'ended';
  document.querySelectorAll('#game .corner-shape,#centerPlatform,#btnPause').forEach(el => { el.inert = true; });
  cue.hidden = false;
  cue.focus({ preventScroll: true });
  const entry = { timer: null, cancel, finish: () => {
    if (pending !== entry) return;
    clearTimeout(entry.timer);
    pending = null;
    cancelRoundCue();
    complete();
  } };
  pending = entry;
  const reduced = document.body.hasAttribute('data-reduced-motion') || document.hidden;
  entry.timer = setTimeout(entry.finish, reduced ? 0 : ready ? CONFIG.CONTINUE_READY_MS : CONFIG.GAME_OVER_TRANSITION_MS);
}

if (typeof window !== 'undefined') {
  window.addEventListener('scs:screenchange', ({ detail }) => { if (detail?.id !== 'game') cancelRoundCue(); });
  window.addEventListener('scs:motionpreference', ({ detail }) => { if (detail?.reduced) pending?.finish(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pending?.finish(); });
}
