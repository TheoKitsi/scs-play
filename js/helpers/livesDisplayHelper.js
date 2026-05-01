import app from '../appState.js';
import { $ } from './dom.js';

export function updateLivesDisplay() {
  const val = app.save.getLives();
  const hud = $('#homeLivesCount');
  const shop = $('#shopLivesCount');
  if (hud) hud.textContent = val;
  if (shop) shop.textContent = val;
}