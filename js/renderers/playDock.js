import { getLanguage } from '../i18n.js';

export function playDock(current) {
  const de = getLanguage() === 'de';
  const items = [['play',de?'Spielen':'Play'],['worlds',de?'Welten':'Worlds'],['collection',de?'Sammlung':'Collection']];
  return `<nav class="play-dock" aria-label="${de?'Hauptnavigation':'Main navigation'}">${items.map(([id,label]) =>
    `<button type="button" data-action="${id}" ${current === id ? 'aria-current="page"' : ''}><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#dock-${id}"/></svg>${label}</button>`).join('')}</nav>`;
}
