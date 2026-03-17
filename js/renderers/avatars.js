/* ═══════════════════════════════════════
   SCS Play — Avatar SVG Renderer
   Generates inline SVG for 16 avatar icons
   + helper to render avatar as HTML (SVG or photo).
   ═══════════════════════════════════════ */
import { CONFIG } from '../config.js';
import { safeSrc } from '../helpers/dom.js';

/**
 * Generate an SVG string for an avatar icon.
 * @param {string} icon  - Icon name from CONFIG.AVATAR_ICONS
 * @param {string} color - Fill color (hex)
 * @param {number} size  - Width/height in px
 * @returns {string} SVG markup
 */
export function avatarSVG(icon, color, size = 40) {
  const s = size, h = s / 2, r = h - 2;
  let inner = '';

  switch (icon) {
    case 'circle':
      inner = `<circle cx="${h}" cy="${h}" r="${r}" fill="${color}"/>`;
      break;
    case 'star': {
      let pts = '';
      for (let i = 0; i < 5; i++) {
        const aO = (i * 72 - 90) * Math.PI / 180;
        const aI = ((i * 72) + 36 - 90) * Math.PI / 180;
        pts += `${h + r * Math.cos(aO)},${h + r * Math.sin(aO)} `;
        pts += `${h + r * 0.45 * Math.cos(aI)},${h + r * 0.45 * Math.sin(aI)} `;
      }
      inner = `<polygon points="${pts.trim()}" fill="${color}"/>`;
      break;
    }
    case 'hexagon': {
      let pts = '';
      for (let i = 0; i < 6; i++) { const a = (i * 60 - 30) * Math.PI / 180; pts += `${h + r * Math.cos(a)},${h + r * Math.sin(a)} `; }
      inner = `<polygon points="${pts.trim()}" fill="${color}"/>`;
      break;
    }
    case 'diamond':
      inner = `<polygon points="${h},4 ${s - 4},${h} ${h},${s - 4} 4,${h}" fill="${color}"/>`;
      break;
    case 'heart': {
      const p = `M${h} ${s * 0.82} C${s * 0.15} ${s * 0.55},${s * 0.08} ${s * 0.25},${s * 0.28} ${s * 0.15} C${s * 0.42} ${s * 0.08},${h} ${s * 0.22},${h} ${s * 0.32} C${h} ${s * 0.22},${s * 0.58} ${s * 0.08},${s * 0.72} ${s * 0.15} C${s * 0.92} ${s * 0.25},${s * 0.85} ${s * 0.55},${h} ${s * 0.82}Z`;
      inner = `<path d="${p}" fill="${color}"/>`;
      break;
    }
    case 'bolt':
      inner = `<polygon points="${h + r * 0.15},4 ${h - r * 0.45},${h + 1} ${h + r * 0.15},${h + 1} ${h - r * 0.15},${s - 4} ${h + r * 0.45},${h - 1} ${h - r * 0.15},${h - 1}" fill="${color}"/>`;
      break;
    case 'crown': {
      const b = s * 0.75, t2 = s * 0.2, m = s * 0.45;
      inner = `<polygon points="4,${b} ${s * 0.2},${t2} ${s * 0.35},${m} ${h},${t2} ${s * 0.65},${m} ${s * 0.8},${t2} ${s - 4},${b}" fill="${color}"/>
        <rect x="4" y="${b}" width="${s - 8}" height="${s * 0.12}" rx="2" fill="${color}"/>`;
      break;
    }
    case 'shield':
      inner = `<path d="M${h},4 L${s - 4},${s * 0.2} L${s - 4},${s * 0.5} C${s - 4},${s * 0.75} ${h},${s - 4} ${h},${s - 4} C${h},${s - 4} 4,${s * 0.75} 4,${s * 0.5} L4,${s * 0.2} Z" fill="${color}"/>`;
      break;
    case 'flame':
      inner = `<path d="M${h},4 C${s * 0.7},${s * 0.2} ${s - 4},${s * 0.45} ${s * 0.7},${s * 0.7} C${s * 0.8},${s * 0.85} ${s * 0.6},${s - 4} ${h},${s * 0.8} C${s * 0.4},${s - 4} ${s * 0.2},${s * 0.85} ${s * 0.3},${s * 0.7} C4,${s * 0.45} ${s * 0.3},${s * 0.2} ${h},4Z" fill="${color}"/>`;
      break;
    case 'leaf':
      inner = `<path d="M${h},4 C${s * 0.8},${s * 0.15} ${s - 4},${s * 0.5} ${h},${s - 4} C4,${s * 0.5} ${s * 0.2},${s * 0.15} ${h},4Z" fill="${color}"/>
        <line x1="${h}" y1="${s * 0.3}" x2="${h}" y2="${s * 0.85}" stroke="rgba(0,0,0,0.2)" stroke-width="1.5"/>`;
      break;
    case 'moon':
      inner = `<path d="M${h + r * 0.2},4 A${r},${r} 0 1,0 ${h + r * 0.2},${s - 4} A${r * 0.6},${r * 0.6} 0 1,1 ${h + r * 0.2},4" fill="${color}"/>`;
      break;
    case 'sun': {
      const ir = r * 0.55;
      inner = `<circle cx="${h}" cy="${h}" r="${ir}" fill="${color}"/>`;
      for (let i = 0; i < 8; i++) {
        const a = (i * 45) * Math.PI / 180;
        const x1 = h + ir * 1.2 * Math.cos(a), y1 = h + ir * 1.2 * Math.sin(a);
        const x2 = h + r * Math.cos(a), y2 = h + r * Math.sin(a);
        inner += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
      }
      break;
    }
    case 'drop':
      inner = `<path d="M${h},4 C${h},4 ${s - 4},${s * 0.55} ${h},${s - 4} C4,${s * 0.55} ${h},4 ${h},4Z" fill="${color}"/>`;
      break;
    case 'gem': {
      const t3 = s * 0.3, b2 = s * 0.85;
      inner = `<polygon points="${h},4 ${s - 4},${t3} ${s * 0.75},${t3} ${h},${b2} ${s * 0.25},${t3} 4,${t3}" fill="${color}"/>
        <polygon points="${s * 0.25},${t3} ${h},${t3 * 1.1} ${s * 0.75},${t3} ${h},${b2}" fill="rgba(255,255,255,0.2)"/>`;
      break;
    }
    case 'paw': {
      const pad = r * 0.4;
      inner = `<ellipse cx="${h}" cy="${h + r * 0.2}" rx="${pad}" ry="${pad * 0.85}" fill="${color}"/>`;
      const toes = [[-0.45, -0.3], [-0.15, -0.55], [0.15, -0.55], [0.45, -0.3]];
      toes.forEach(([ox, oy]) => {
        inner += `<circle cx="${h + r * ox}" cy="${h + r * oy}" r="${r * 0.18}" fill="${color}"/>`;
      });
      break;
    }
    case 'rocket':
      inner = `<path d="M${h},4 C${s * 0.65},${s * 0.15} ${s * 0.7},${s * 0.5} ${s * 0.65},${s * 0.7} L${s * 0.35},${s * 0.7} C${s * 0.3},${s * 0.5} ${s * 0.35},${s * 0.15} ${h},4Z" fill="${color}"/>
        <circle cx="${h}" cy="${s * 0.4}" r="${r * 0.15}" fill="rgba(255,255,255,0.4)"/>
        <polygon points="${s * 0.35},${s * 0.65} ${s * 0.2},${s - 4} ${s * 0.35},${s * 0.78}" fill="${color}" opacity="0.7"/>
        <polygon points="${s * 0.65},${s * 0.65} ${s * 0.8},${s - 4} ${s * 0.65},${s * 0.78}" fill="${color}" opacity="0.7"/>`;
      break;
    default:
      inner = `<circle cx="${h}" cy="${h}" r="${r}" fill="${color}"/>`;
  }

  return `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

/**
 * Render an avatar as HTML — shows uploaded photo or SVG icon.
 * @param {object} avatar - { icon, colorIndex, photo? }
 * @param {number} size   - Display size in px
 * @returns {string} HTML markup
 */
export function avatarHTML(avatar, size = 18) {
  if (avatar.photo) {
    return `<img src="${safeSrc(avatar.photo)}" alt="Avatar" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover">`;
  }
  const color = CONFIG.COLORS.normal[avatar.colorIndex] || CONFIG.COLORS.normal[0];
  return avatarSVG(avatar.icon, color, size);
}
