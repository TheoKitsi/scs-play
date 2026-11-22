import { CONFIG } from '../config.js';

export function rememberPlay(save, activity) {
  if (save.getSetting('lastPlay') !== activity) save.setSetting('lastPlay', activity).catch(() => {});
}

export function lastArcade(save) {
  const [mode, type] = String(save.getSetting('lastPlay') || '').split(':');
  if (!CONFIG.MODE_ORDER.includes(mode) || !save.isModeUnlocked(mode) ||
      !['blitz','classic','endless','competition'].includes(type) ||
      (type === 'competition' && !save.isCompetitionUnlocked()) || (mode === 'sequenz' && type !== 'endless')) return null;
  return { mode, type };
}
