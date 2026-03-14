/* ═══════════════════════════════════════
   SCS Play — Contrast Utility
   WCAG 2.2 contrast checking + readable color picking.
   ═══════════════════════════════════════ */

/**
 * Parse any CSS color string to {r, g, b, a} (0-255 for rgb, 0-1 for a).
 * Supports: #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba().
 */
export function parseColor(str) {
  if (!str || typeof str !== 'string') return null;
  str = str.trim();

  // #RGB or #RRGGBB or #RRGGBBAA
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    if (hex.length === 4) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };

  return null;
}

/**
 * sRGB → linear channel  (WCAG 2.x formula)
 */
function sRGBtoLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance (WCAG 2.x)
 * @param {{r:number, g:number, b:number}} color – 0-255
 * @returns {number} 0–1
 */
export function relativeLuminance({ r, g, b }) {
  return 0.2126 * sRGBtoLinear(r)
       + 0.7152 * sRGBtoLinear(g)
       + 0.0722 * sRGBtoLinear(b);
}

/**
 * WCAG contrast ratio between two opaque colors.
 * @returns {number} 1 – 21
 */
export function computeContrast(fg, bg) {
  const c1 = typeof fg === 'string' ? parseColor(fg) : fg;
  const c2 = typeof bg === 'string' ? parseColor(bg) : bg;
  if (!c1 || !c2) return 0;

  const L1 = relativeLuminance(c1);
  const L2 = relativeLuminance(c2);
  const lighter = Math.max(L1, L2);
  const darker  = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Composite a semi-transparent foreground over an opaque background.
 * Useful for rgba() glass surfaces where the effective color depends on the bg behind.
 * @param {{r,g,b,a}} fg  – RGBA foreground
 * @param {{r,g,b}}   bg  – opaque background underneath
 * @returns {{r:number, g:number, b:number}} – the flattened opaque color
 */
export function compositeAlpha(fg, bg) {
  const a = fg.a ?? 1;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
  };
}

/**
 * Pick the first candidate color that meets the target contrast ratio on `bg`.
 * Falls back to #fff or #000 if none of the candidates pass.
 * @param {string} bg         – CSS color string for the background
 * @param {string[]} candidates – ordered list of CSS color strings to try
 * @param {number} [minRatio=4.5] – required contrast ratio
 * @returns {string} – the first passing candidate, or a safe fallback
 */
export function pickReadableOnColor(bg, candidates, minRatio = 4.5) {
  const bgC = typeof bg === 'string' ? parseColor(bg) : bg;
  if (!bgC) return '#ffffff';

  for (const c of candidates) {
    if (computeContrast(c, bgC) >= minRatio) return c;
  }

  // Fallback: pick black or white, whichever contrasts more
  return computeContrast('#ffffff', bgC) >= computeContrast('#000000', bgC)
    ? '#ffffff'
    : '#000000';
}
