import { CONFIG } from '../config.js';
import { shapeSVG } from './shapes.js';
import { arenaWorld } from './arenaWorld.js';
import { directionIcon } from './icons.js';
import { MATERIAL_ASSETS } from '../engine/materialAssets.js';

/** A small, dependency-free scene used by both mode selection surfaces. */
export function modePreview(mode, colorblind = false, defer = false) {
  mode = arenaWorld(mode).id;
  const colors = CONFIG.COLORS[colorblind ? 'colorblind' : 'normal'];
  const shapes = mode === 'klassik' ? ['square', 'square', 'square', 'square']
    : ['circle', 'square', 'triangle', 'star'];
  const tiles = shapes.map((shape, i) => `<span class="preview-object preview-object--${i + 1}">${shapeSVG(shape, colors[i], 48)}</span>`).join('');
  const labels = {
    klassik: `${tiles}<span class="preview-sample">${shapeSVG('square', colors[3], 48)}</span>`,
    mathe: '<span class="preview-equation">2 × 4<span>= ?</span></span>',
    wissen: '<span class="preview-question">?<span>···</span></span>',
    memo: '<span class="preview-recall">?</span>',
    sequenz: '<span class="preview-sequence"><i>1</i><i>2</i><i>3</i></span>',
    stroop: `<span class="preview-ink" style="color:${colors[1]}">Aa</span>`,
    fokus: `<span class="preview-arrows">${directionIcon('←')}<b>${directionIcon('→')}</b>${directionIcon('←')}</span>`,
  };
  const content = labels[mode] || tiles;
  return `<span class="mode-preview mode-preview--${mode}" data-world-family="${arenaWorld(mode).family}" aria-hidden="true">
    <span class="mode-material"><img ${defer ? 'data-src' : 'src'}="${MATERIAL_ASSETS.decks[mode]}" alt="" loading="lazy" decoding="async" width="768" height="1024"></span>${content}
  </span>`;
}
