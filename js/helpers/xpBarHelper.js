import { t } from '../i18n.js';
import app from '../appState.js';
import { $ } from './dom.js';

export function updateXPBar() {
  const { save } = app;
  if (!save) return;

  const prog = save.getXPProgress();
  const bar = $('#xpBarFill');
  const levelNum = $('#xpLevelNum');
  const title = $('#xpTitle');
  const numbers = $('#xpNumbers');
  const percent = $('#xpPercent');

  const pct = isFinite(prog.pct) ? prog.pct : 0;
  if (bar) bar.style.width = `${pct * 100}%`;
  if (levelNum) levelNum.textContent = `${t('level')} ${save.getLevel() + 1}`;
  if (title) title.textContent = save.getLevelName();
  if (numbers) {
    const cur = isFinite(prog.current) ? prog.current : 0;
    const need = isFinite(prog.needed) ? prog.needed : 0;
    numbers.textContent = `${cur.toLocaleString()} / ${need.toLocaleString()} XP`;
  }
  if (percent) percent.textContent = `${Math.round(pct * 100)}%`;
}