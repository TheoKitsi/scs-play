import { CONFIG } from '../config.js';
import { shapeSVG } from './shapes.js';

/** A small, dependency-free scene used by both mode selection surfaces. */
export function modePreview(mode, colorblind = false) {
  const colors = CONFIG.COLORS[colorblind ? 'colorblind' : 'normal'];
  const shapes = mode === 'klassik' ? ['square', 'square', 'square', 'square']
    : ['circle', 'square', 'triangle', 'star'];
  const tiles = shapes.map((shape, i) => `<span class="preview-object preview-object--${i + 1}">${shapeSVG(shape, colors[i], 48)}</span>`).join('');
  const labels = {
    mathe: '<span class="preview-equation">2 × 4<span>= ?</span></span>',
    wissen: '<span class="preview-question">?<span>···</span></span>',
    memo: '<span class="preview-recall">?</span>',
    sequenz: '<span class="preview-sequence"><i>1</i><i>2</i><i>3</i></span>',
    stroop: `<span class="preview-ink" style="color:${colors[1]}">Aa</span>`,
    fokus: '<span class="preview-arrows">← <b>→</b> ←</span>',
    chaos: '<span class="preview-switch">⇄</span>',
  };
  const content = labels[mode] || tiles;
  return `<span class="mode-preview mode-preview--${mode}" aria-hidden="true">
    <span class="preview-orbit"></span><span class="preview-plinth"></span>${content}
    <span class="preview-tick preview-tick--left"></span><span class="preview-tick preview-tick--right"></span>
  </span>`;
}
