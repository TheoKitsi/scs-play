import { EffectsManager } from '../effects.js';
import app from '../appState.js';

export function getBodyFx() {
  if (!app.bodyFx) app.bodyFx = new EffectsManager(document.body);
  app.bodyFx.setReduced(Boolean(app.save?.getSetting?.('reducedMotion')));
  return app.bodyFx;
}