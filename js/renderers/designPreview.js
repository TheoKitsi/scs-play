import { CONFIG } from '../config.js';
import { shapeSVG } from './shapes.js';
import { MATERIAL_ASSETS } from '../engine/materialAssets.js';

// A sampled Klassik drag, from the centre to the matching lower-left key.
// Widths, active colours, fingertip and particle types follow Effects._drawTrail.
function trailSample(trail, taskColor, phone) {
  const color = trail.id === 'rainbow' ? 'hsl(3,90%,60%)' : trail.color || taskColor;
  const startY = phone ? 49 : 84, endX = phone ? 62 : 35, endY = phone ? 176 : 119;
  const path = `M120 ${startY} Q${phone ? 100 : 88} ${(startY + endY) / 2} ${endX} ${endY}`;
  const flecks = trail.id === 'fire' || trail.id === 'stardust' ? [0,1,2,3,4,5].map(i => {
    const u = (i + 1) / 7;
    const x = endX + (120 - endX) * u, y = endY + (startY - endY) * u - (i % 3) * 2;
    return `<circle cx="${x}" cy="${y}" r="${1 + (i % 3) * .4}" fill="${trail.id === 'stardust' ? '#FFE08080' : i % 2 ? '#FF440060' : '#FFD70050'}"/>`;
  }).join('') : '';
  return `<g class="design-trace" style="color:${color}" fill="none" stroke-linecap="round">
    <g class="design-bloom">
      <path d="${path}" stroke="currentColor" stroke-width="${20 + 2 * trail.width}" opacity=".145"/>
      <path d="${path}" stroke="currentColor" stroke-width="${8 + trail.width}" opacity=".31"/>
    </g>
    <path d="${path}" stroke="currentColor" stroke-width="${trail.width}"/>
    <g class="design-flecks">${flecks}</g>
    <circle cx="${endX}" cy="${endY}" r="9" fill="currentColor" opacity=".15"/>
    <circle cx="${endX}" cy="${endY}" r="3.5" fill="currentColor"/><circle cx="${endX}" cy="${endY}" r="1.7" fill="white"/>
  </g>`;
}

/** Static, inert shop scene. Uses the real theme tokens and trail definitions;
 * never applies a theme to the profile, starts a game or allocates a canvas. */
export function designPreview(type, id, themeId = 'default', colorblind = false, trailId = 'default') {
  const theme = type === 'themes' ? id : themeId;
  const safeTheme = CONFIG.THEMES.some(item => item.id === theme) ? theme : 'default';
  const trail = CONFIG.TRAILS.find(item => item.id === (type === 'trails' ? id : trailId)) || CONFIG.TRAILS[0];
  const colors = CONFIG.COLORS[colorblind ? 'colorblind' : 'normal'];
  return `<span class="design-preview theme-${safeTheme}" data-design-type="${type === 'themes' ? 'themes' : 'trails'}" data-preview-trail="${trail.id}" aria-hidden="true">
    <span class="design-material"><img src="${MATERIAL_ASSETS.decks.klassik}" width="768" height="1024" alt="" loading="lazy" decoding="async"></span>
    ${colors.slice(0, 4).map((color, i) => `<span class="design-slot design-slot--${i}" style="--target-color:${color}">${shapeSVG('square', color, 32)}</span>`).join('')}
    <span class="design-plinth"></span>
    <svg class="design-wide-route" viewBox="0 0 240 156" focusable="false">
      <path class="design-rail" d="M9 58v5m0 4v5m0 4v5m0 4v5m0 4v5 M231 58v5m0 4v5m0 4v5m0 4v5m0 4v5"/>
      ${trailSample(trail, colors[2], false)}
    </svg>
    <svg class="design-phone-route" viewBox="0 0 240 204" focusable="false">
      <path class="design-rail" d="M8 83v4m0 4v4m0 4v4m0 4v4m0 4v4 M232 83v4m0 4v4m0 4v4m0 4v4m0 4v4"/>
      ${trailSample(trail, colors[2], true)}
    </svg>
    <span class="design-object">${shapeSVG('square', colors[2], 48)}</span>
  </span>`;
}
