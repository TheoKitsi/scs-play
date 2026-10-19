import { CONFIG } from '../config.js';
import { shapeSVG } from './shapes.js';

let paintId = 0;

/** Static, inert shop scene. Uses the real theme tokens and trail definitions;
 * never applies a theme to the profile, starts a game or allocates a canvas. */
export function designPreview(type, id, themeId = 'default', colorblind = false, trailId = 'default') {
  const theme = type === 'themes' ? id : themeId;
  const safeTheme = CONFIG.THEMES.some(item => item.id === theme) ? theme : 'default';
  const trail = CONFIG.TRAILS.find(item => item.id === (type === 'trails' ? id : trailId)) || CONFIG.TRAILS[0];
  const colors = CONFIG.COLORS[colorblind ? 'colorblind' : 'normal'];
  const rainbow = trail.id === 'rainbow' ? `design-trace-${++paintId}` : '';
  return `<span class="design-preview theme-${safeTheme}" data-preview-trail="${trail.id}" aria-hidden="true">
    <svg viewBox="0 0 240 156" focusable="false">
      ${rainbow ? `<defs><linearGradient id="${rainbow}"><stop stop-color="#FF4757"/><stop offset=".4" stop-color="#2ED573"/><stop offset=".7" stop-color="#18DCFF"/><stop offset="1" stop-color="#A55EEA"/></linearGradient></defs>` : ''}
      <path class="design-architecture" d="M24 45V25H70M170 25H216V45M24 112V132H70M170 132H216V112"/>
      <path class="design-trace" d="${trail.id === 'electric' ? 'M120 84 99 96 84 91 62 116 35 119' : 'M120 84Q90 114 35 119'}" fill="none" stroke="${rainbow ? `url(#${rainbow})` : trail.color || colors[2]}" stroke-width="${trail.width}" stroke-linecap="round"/>
      <rect class="design-accent" x="18" y="13" width="204" height="2" rx="1"/>
      <rect class="design-accent" x="100" y="139" width="40" height="4" rx="2"/>
    </svg>
    ${colors.slice(0, 4).map((color, i) => `<span class="design-slot design-slot--${i}">${shapeSVG('square', color, 32)}</span>`).join('')}
    <span class="design-plinth"></span>
    <span class="design-object">${shapeSVG('square', colors[2], 48)}</span>
  </span>`;
}
