/* ═══════════════════════════════════════
   SCS Play — Shape SVG Renderer
   Generates inline SVG for all 12 game shapes.
   ═══════════════════════════════════════ */

let paintId = 0;

/**
 * Generate an SVG string for a game shape.
 * @param {string} shape - circle|square|triangle|star|diamond|hexagon|pentagon|cross|heart|crescent|arrow|bolt
 * @param {string} color - Fill color (hex)
 * @param {number} size  - Width/height in px
 * @param {string|null} bonus - 'golden' | 'diamond' | null
 * @returns {string} SVG markup. The main face retains the exact answer color;
 * neutral light and a shallow extrusion add volume without changing its hue.
 */
export function shapeSVG(shape, color, size = 48, bonus = null) {
  const s = size, h = s / 2, r = h - 2;
  const glow = '';
  /* All geometry shares the same neutral bevel; bonus identity is a separate
     badge, never a gold/blue outline that could confuse color sorting. */
  const stroke = 'none';
  const sw = 0;

  let inner = '';
  switch (shape) {
    case 'circle':
      inner = `<circle cx="${h}" cy="${h}" r="${r}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    case 'square':
      inner = `<rect x="4" y="4" width="${s-8}" height="${s-8}" rx="${s * .12}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    case 'triangle': {
      const pts = `${h},4 ${s-4},${s-4} 4,${s-4}`;
      inner = `<polygon points="${pts}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    }
    case 'star': {
      let pts = '';
      for (let i = 0; i < 5; i++) {
        const aO = (i * 72 - 90) * Math.PI / 180;
        const aI = ((i * 72) + 36 - 90) * Math.PI / 180;
        pts += `${h + r * Math.cos(aO)},${h + r * Math.sin(aO)} `;
        pts += `${h + r * 0.45 * Math.cos(aI)},${h + r * 0.45 * Math.sin(aI)} `;
      }
      inner = `<polygon points="${pts.trim()}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    }
    case 'diamond': {
      const pts = `${h},4 ${s-4},${h} ${h},${s-4} 4,${h}`;
      inner = `<polygon points="${pts}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    }
    case 'hexagon': {
      let pts = '';
      for (let i = 0; i < 6; i++) { const a = (i*60-30)*Math.PI/180; pts += `${h+r*Math.cos(a)},${h+r*Math.sin(a)} `; }
      inner = `<polygon points="${pts.trim()}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    }
    case 'pentagon': {
      let pts = '';
      for (let i = 0; i < 5; i++) { const a = (i*72-90)*Math.PI/180; pts += `${h+r*Math.cos(a)},${h+r*Math.sin(a)} `; }
      inner = `<polygon points="${pts.trim()}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    }
    case 'cross': {
      const w = r * 0.38, l = 4, rr = s - 4;
      inner = `<polygon points="${h-w},${l} ${h+w},${l} ${h+w},${h-w} ${rr},${h-w} ${rr},${h+w} ${h+w},${h+w} ${h+w},${rr} ${h-w},${rr} ${h-w},${h+w} ${l},${h+w} ${l},${h-w} ${h-w},${h-w}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    }
    case 'heart': {
      const p = `M${h} ${s*0.82} C${s*0.15} ${s*0.55},${s*0.08} ${s*0.25},${s*0.28} ${s*0.15} C${s*0.42} ${s*0.08},${h} ${s*0.22},${h} ${s*0.32} C${h} ${s*0.22},${s*0.58} ${s*0.08},${s*0.72} ${s*0.15} C${s*0.92} ${s*0.25},${s*0.85} ${s*0.55},${h} ${s*0.82}Z`;
      inner = `<path d="${p}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    }
    case 'crescent': {
      inner = `<path d="M${h+r*0.2},${4} A${r},${r} 0 1,0 ${h+r*0.2},${s-4} A${r*0.6},${r*0.6} 0 1,1 ${h+r*0.2},${4}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    }
    case 'arrow': {
      const w2 = r * 0.3;
      inner = `<polygon points="${4},${h-w2} ${h},${h-w2} ${h},${4} ${s-4},${h} ${h},${s-4} ${h},${h+w2} ${4},${h+w2}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    }
    case 'bolt': {
      inner = `<polygon points="${h+r*0.15},${4} ${h-r*0.45},${h+1} ${h+r*0.15},${h+1} ${h-r*0.15},${s-4} ${h+r*0.45},${h-1} ${h-r*0.15},${h-1}" fill="${color}" stroke="${stroke}" stroke-width="${sw}" ${glow}/>`;
      break;
    }
  }
  const id = `shape-light-${++paintId}`;
  const geometry = inner.replace(/ fill="[^"]*"| stroke="[^"]*"| stroke-width="[^"]*"/g, '');
  /* The reference enamel square has a real edge profile instead of a broad
     plastic gradient. Its entire middle (including the three colour probes)
     is still the exact task colour. All twelve silhouette semantics survive. */
  const enamel = shape === 'square' ? `<path d="M${s * .18} 6 H${s * .72} Q${s - 6} 6 ${s - 6} ${s * .25}" fill="none" stroke="#fff" stroke-opacity=".48" stroke-width=".7" stroke-linecap="round"/><path d="M6 ${s * .3} V${s * .72}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width=".65"/><path d="M${s * .22} ${s - 5} H${s * .78}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.1"/>` : '';
  return `<svg class="material-shape" viewBox="0 0 ${s} ${s + 3}" width="${s}" height="${s}" aria-hidden="true" focusable="false"${bonus ? ` data-bonus="${bonus}"` : ''} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#fff" stop-opacity="${shape === 'square' ? '.42' : '.24'}"/>
        <stop offset="${shape === 'square' ? '.15' : '.18'}" stop-color="#fff" stop-opacity="0"/><stop offset=".84" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/>
      </linearGradient>
    </defs>
    <g fill="${color}" transform="translate(0 1.25)">${geometry}</g>
    <g fill="#000" opacity=".26" transform="translate(0 1.25)">${geometry}</g>
    <g data-material-face="" fill="${color}">${geometry}</g>
    <g data-shape-light="" fill="url(#${id})" stroke="url(#${id})" stroke-width=".85" stroke-linejoin="round">${geometry}</g>
    ${enamel}
  </svg>`;
}
