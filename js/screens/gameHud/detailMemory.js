import { CONFIG } from '../../config.js';

const views = new WeakMap();

function mount(host) {
  const panel = host.ownerDocument.createElement('div');
  panel.className = 'memory-readout';
  panel.innerHTML = '<strong></strong><span></span><i class="memory-track"></i>';
  host.replaceChildren(panel);
  const [title, note, track] = panel.children;
  // A focus description gives the phase/count without interrupting each tap.
  note.id = 'memoryProgressNote';
  host.parentElement.querySelector('#centerPlatform')?.setAttribute('aria-describedby',note.id);
  const view = { panel, title, note, track };
  views.set(host, view);
  return view;
}

// Only published totals and accepted-input counts belong here. In particular
// the track has no per-pad colours, direction history or pending step.
export function updateMemory(root, game, phase, lang, retry = false) {
  const mode = game.mode;
  if (mode !== 'memo' && mode !== 'sequenz') return;
  const host = root.querySelector('#modeDetail');
  if (!host) return;
  let view = views.get(host);
  if (view?.panel.parentNode !== host) view = mount(host);

  const de = lang === 'de';
  const memo = mode === 'memo';
  const total = memo ? CONFIG.MEMO_REVEAL_EVERY : game._seqPattern?.length || 0;
  const n = Math.min(total, Math.max(0, (memo ? game._memoCorrectSinceReveal : game._seqInputIndex) || 0));
  if (retry || phase === 'watch' || memo) view.retry = retry;
  const state = view.retry ? 'retry' : phase === 'watch' ? 'watch' : memo ? 'recall'
    : total > 0 && n === total ? 'complete' : phase === 'ready' ? 'ready' : 'recall';
  const key = `${mode}:${state}:${lang}:${total}:${n}`;
  if (view.key === key) return;
  view.key = key;

  let title, note;
  if (memo) {
    title = state === 'watch' ? (de ? 'Plätze einprägen' : 'Remember the positions')
      : (de ? 'Wo war das Symbol?' : 'Where was the symbol?');
    note = state === 'watch' ? (de ? 'Vier offene Karten' : 'Four cards face up')
      : (de ? `Noch ${total - n} Richtige bis zum Aufdecken` : `Next reveal: ${total - n} more correct`);
  } else if (state === 'retry') {
    title = de ? 'Noch einmal' : 'Try again';
    note = `${n} / ${total} ${de ? 'richtig' : 'correct'}`;
  } else if (state === 'watch') {
    title = de ? 'Aufleuchten merken' : 'Watch the flashes';
    note = de ? 'Noch nicht tippen' : 'Wait before tapping';
  } else if (state === 'recall') {
    title = de ? 'Folge nachtippen' : 'Tap in order';
    note = `${n} / ${total} ${de ? 'richtig' : 'correct'}`;
  } else if (state === 'complete') {
    title = de ? 'Folge geschafft' : 'Sequence complete';
    note = `${total} / ${total} ${de ? 'richtig' : 'correct'}`;
  } else {
    title = de ? 'Gleich geht’s los' : 'Get ready';
    note = de ? 'Auf das Signal warten' : 'Wait for the signal';
  }
  if (view.panel.dataset.mode !== mode) view.panel.dataset.mode = mode;
  if (view.panel.dataset.state !== state) view.panel.dataset.state = state;
  if (view.title.textContent !== title) view.title.textContent = title;
  if (view.note.textContent !== note) view.note.textContent = note;
  const fill = total && (state === 'recall' || state === 'complete' || state === 'retry') ? n / total : 0;
  if (view.total !== total) {
    view.track.style.setProperty('--memory-slots', String(Math.max(1, total)));
    view.total = total;
  }
  if (view.fill !== fill) {
    view.track.style.setProperty('--memory-fill', `${100 * fill}%`);
    view.fill = fill;
  }
}
