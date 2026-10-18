let timer = null;
let priority = -1;

/** One bounded status line, outside the stimulus/targets. It never schedules
 * game logic, injects styles or queues celebration animations. */
export function showGameNotice(text, { kind = 'info', duration = 1000, importance = 0 } = {}) {
  const notice = document.getElementById('gameNotice');
  if (!notice || (notice.classList.contains('visible') && importance < priority)) return;
  clearTimeout(timer);
  priority = importance;
  notice.textContent = text;
  notice.dataset.kind = kind;
  notice.classList.add('visible');
  timer = setTimeout(clearGameNotice, duration);
}

export function clearGameNotice() {
  clearTimeout(timer);
  timer = null;
  priority = -1;
  const notice = document.getElementById('gameNotice');
  if (!notice) return;
  notice.classList.remove('visible');
  notice.textContent = '';
  delete notice.dataset.kind;
}
