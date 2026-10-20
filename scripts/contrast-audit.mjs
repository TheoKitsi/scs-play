#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════
 * SCS Play — Contrast Audit Script (v2.0)
 * ═══════════════════════════════════════════════════════
 *
 * Checks all defined token combinations against WCAG 2.2 rules:
 *   • Normal text:  ≥ 4.5:1  (SC 1.4.3 AA)
 *   • Large text:   ≥ 3.0:1  (SC 1.4.3 AA)
 *   • Enhanced:     ≥ 7.0:1  (SC 1.4.6 AAA)
 *   • UI / non-text: ≥ 3.0:1 (SC 1.4.11)
 *
 * Run:  node scripts/contrast-audit.mjs
 * Exit code 1 on any failure → usable as CI gate.
 */

import { readFileSync } from 'node:fs';

// Read production tokens so the gate cannot silently audit an older palette.
const tokenCss = readFileSync(new URL('../css/partials/01-tokens.css', import.meta.url), 'utf8');
const themeCss = readFileSync(new URL('../css/partials/09-extensions.css', import.meta.url), 'utf8');
function cssColor(css, name, fallback) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6}|#[0-9a-f]{3})(?=[;\\s])`, 'i'));
  if (match) return match[1];
  if (fallback) return fallback;
  throw new Error(`Missing contrast token: --${name}`);
}

// ─── Inline WCAG helpers ───
function sRGBtoLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance({ r, g, b }) {
  return 0.2126 * sRGBtoLinear(r)
       + 0.7152 * sRGBtoLinear(g)
       + 0.0722 * sRGBtoLinear(b);
}

function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}

function contrast(fg, bg) {
  const L1 = luminance(parseHex(fg));
  const L2 = luminance(parseHex(bg));
  const lighter = Math.max(L1, L2);
  const darker  = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function compositeRgba(fgHex, alpha, bgHex) {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  const r = Math.round(fg.r * alpha + bg.r * (1 - alpha));
  const g = Math.round(fg.g * alpha + bg.g * (1 - alpha));
  const b = Math.round(fg.b * alpha + bg.b * (1 - alpha));
  return '#' + [r,g,b].map(c => c.toString(16).padStart(2,'0')).join('');
}

// ─── Token Definitions ───
// Opaque resolved colors for each theme mode.
// For rgba surfaces, we composite against the mode's --bg.

const DARK = {
  bg:            cssColor(tokenCss, 'bg'),
  surface:       cssColor(tokenCss, 'surface'),
  card:          cssColor(tokenCss, 'card'),
  surfaceElev:   cssColor(tokenCss, 'surface-elevated'),
  text:          cssColor(tokenCss, 'text'),
  textDim:       cssColor(tokenCss, 'text-dim'),
  textMuted:     cssColor(tokenCss, 'text-muted'),
  textOnSurface: cssColor(tokenCss, 'text-on-surface'),
  textOnSurfDim: cssColor(tokenCss, 'text-on-surface-dim'),
  iconOnSurface: cssColor(tokenCss, 'icon-on-surface'),
  iconOnSurfVar: cssColor(tokenCss, 'icon-on-surface-variant'),
  primary:       cssColor(tokenCss, 'primary'),
  primaryGlow:   cssColor(tokenCss, 'primary-glow'),
  onPrimary:     cssColor(tokenCss, 'on-primary'),
  accent:        cssColor(tokenCss, 'accent'),
  success:       cssColor(tokenCss, 'success'),
  warning:       cssColor(tokenCss, 'warning'),
  error:         cssColor(tokenCss, 'error'),
  gold:          cssColor(tokenCss, 'gold'),
  diamond:       cssColor(tokenCss, 'diamond'),
  info:          cssColor(tokenCss, 'info'),
};

const LIGHT = {
  bg:            '#f0f0f5',
  surface:       '#ffffff',
  card:          compositeRgba('#ffffff', 0.85, '#f0f0f5'),
  surfaceElev:   compositeRgba('#ffffff', 0.95, '#f0f0f5'),
  text:          '#1a1a2e',
  textDim:       '#4a4a5a',      // updated from #555
  textMuted:     '#5a5a70',      // updated from #6B6B80
  textOnSurface: '#1a1a2e',
  textOnSurfDim: '#4a4a5a',
  iconOnSurface: '#3a3a50',
  iconOnSurfVar: '#555568',
  primaryText:   '#4a3ab5',
  primary:       '#7C3AED',
  primaryGlow:   '#9D4EDD',
  accent:        '#EC4899',
  success:       '#0D8F65',      // darkened for light bg
  warning:       '#B45309',      // darkened for light bg
  error:         '#C53030',      // darkened for light bg
  gold:          '#9A7209',      // darkened for light bg
  info:          '#0369A1',      // darkened for light bg
};

// ─── Checks ───
// Format: { label, fg, bg, min, type }
// type: 'text' (normal ≥4.5), 'largeText' (≥3), 'ui' (≥3), 'enhanced' (≥7)

const checks = [
  // ══════════════════════════════════════
  //   DARK MODE
  // ══════════════════════════════════════

  // Text on backgrounds
  { label: 'Dark: --text on --bg',              fg: DARK.text,         bg: DARK.bg,         min: 7,   type: 'enhanced' },
  { label: 'Dark: --text-dim on --bg',           fg: DARK.textDim,      bg: DARK.bg,         min: 4.5, type: 'text' },
  { label: 'Dark: --text-muted on --bg',         fg: DARK.textMuted,    bg: DARK.bg,         min: 4.5, type: 'text' },
  { label: 'Dark: --text on --surface',          fg: DARK.text,         bg: DARK.surface,    min: 4.5, type: 'text' },
  { label: 'Dark: --text-dim on --surface',      fg: DARK.textDim,      bg: DARK.surface,    min: 4.5, type: 'text' },
  { label: 'Dark: --text on --card',             fg: DARK.text,         bg: DARK.card,       min: 4.5, type: 'text' },
  { label: 'Dark: --text-dim on --card',         fg: DARK.textDim,      bg: DARK.card,       min: 4.5, type: 'text' },
  { label: 'Dark: --text on --surfaceElev',      fg: DARK.text,         bg: DARK.surfaceElev,min: 4.5, type: 'text' },

  // Semantic on-surface tokens
  { label: 'Dark: --text-on-surface on --surface',     fg: DARK.textOnSurface, bg: DARK.surface,    min: 4.5, type: 'text' },
  { label: 'Dark: --text-on-surface-dim on --surface',  fg: DARK.textOnSurfDim, bg: DARK.surface,    min: 4.5, type: 'text' },
  { label: 'Dark: --icon-on-surface on --surface',      fg: DARK.iconOnSurface, bg: DARK.surface,    min: 3,   type: 'ui' },
  { label: 'Dark: --icon-on-surface-var on --surface',  fg: DARK.iconOnSurfVar, bg: DARK.surface,    min: 3,   type: 'ui' },
  { label: 'Dark: --text-on-surface on --card',         fg: DARK.textOnSurface, bg: DARK.card,       min: 4.5, type: 'text' },
  { label: 'Dark: --icon-on-surface on --card',         fg: DARK.iconOnSurface, bg: DARK.card,       min: 3,   type: 'ui' },

  // UI colors on bg
  { label: 'Dark: --primary-glow on --bg',       fg: DARK.primaryGlow,  bg: DARK.bg,         min: 3,   type: 'ui' },
  { label: 'Dark: --accent on --bg',             fg: DARK.accent,       bg: DARK.bg,         min: 3,   type: 'ui' },
  { label: 'Dark: --success on --bg',            fg: DARK.success,      bg: DARK.bg,         min: 3,   type: 'ui' },
  { label: 'Dark: --error on --bg',              fg: DARK.error,        bg: DARK.bg,         min: 3,   type: 'ui' },
  { label: 'Dark: --warning on --bg',            fg: DARK.warning,      bg: DARK.bg,         min: 3,   type: 'ui' },
  { label: 'Dark: --gold on --bg',               fg: DARK.gold,         bg: DARK.bg,         min: 3,   type: 'ui' },
  { label: 'Dark: --diamond on --bg',            fg: DARK.diamond,      bg: DARK.bg,         min: 3,   type: 'ui' },
  { label: 'Dark: --info on --bg',               fg: DARK.info,         bg: DARK.bg,         min: 3,   type: 'ui' },

  // Text on colored buttons
  { label: 'Dark: #fff on --primary',            fg: '#ffffff',         bg: DARK.primary,    min: 4.5, type: 'text' },
  { label: 'Dark: #fff on --accent',             fg: '#ffffff',         bg: DARK.accent,     min: 3,   type: 'largeText' },
  { label: 'Dark: #fff on --error',              fg: '#ffffff',         bg: DARK.error,      min: 3,   type: 'largeText' },

  // Game screen (dark bg #12122a)
  { label: 'Dark: --text on game-bg (#12122a)',  fg: DARK.text,         bg: '#12122a',       min: 4.5, type: 'text' },
  { label: 'Dark: --text-dim on game-bg',        fg: DARK.textDim,      bg: '#12122a',       min: 4.5, type: 'text' },
  { label: 'Dark: auth placeholder on auth input', fg: compositeRgba(DARK.text, 0.68, compositeRgba('#0F172A', 0.4, DARK.bg)), bg: compositeRgba('#0F172A', 0.4, DARK.bg), min: 4.5, type: 'text' },
  { label: 'Dark: disabled button text on disabled bg', fg: DARK.textOnSurfDim, bg: compositeRgba('#ffffff', 0.06, DARK.bg), min: 4.5, type: 'text' },

  // ══════════════════════════════════════
  //   LIGHT MODE
  // ══════════════════════════════════════

  // Text on backgrounds
  { label: 'Light: --text on --bg',              fg: LIGHT.text,        bg: LIGHT.bg,        min: 7,   type: 'enhanced' },
  { label: 'Light: --text-dim on --bg',          fg: LIGHT.textDim,     bg: LIGHT.bg,        min: 4.5, type: 'text' },
  { label: 'Light: --text-muted on --bg',        fg: LIGHT.textMuted,   bg: LIGHT.bg,        min: 4.5, type: 'text' },
  { label: 'Light: --text on --surface',         fg: LIGHT.text,        bg: LIGHT.surface,   min: 4.5, type: 'text' },
  { label: 'Light: --text-dim on --surface',     fg: LIGHT.textDim,     bg: LIGHT.surface,   min: 4.5, type: 'text' },
  { label: 'Light: --text-muted on --surface',   fg: LIGHT.textMuted,   bg: LIGHT.surface,   min: 4.5, type: 'text' },
  { label: 'Light: --text on --card',            fg: LIGHT.text,        bg: LIGHT.card,      min: 4.5, type: 'text' },
  { label: 'Light: --text on --surfaceElev',     fg: LIGHT.text,        bg: LIGHT.surfaceElev,min:4.5, type: 'text' },

  // Semantic on-surface tokens
  { label: 'Light: --text-on-surface on --surface',     fg: LIGHT.textOnSurface, bg: LIGHT.surface,   min: 4.5, type: 'text' },
  { label: 'Light: --text-on-surface-dim on --surface',  fg: LIGHT.textOnSurfDim, bg: LIGHT.surface,   min: 4.5, type: 'text' },
  { label: 'Light: --icon-on-surface on --surface',      fg: LIGHT.iconOnSurface, bg: LIGHT.surface,   min: 3,   type: 'ui' },
  { label: 'Light: --icon-on-surface-var on --surface',  fg: LIGHT.iconOnSurfVar, bg: LIGHT.surface,   min: 3,   type: 'ui' },
  { label: 'Light: --text-on-surface on --bg',           fg: LIGHT.textOnSurface, bg: LIGHT.bg,        min: 4.5, type: 'text' },
  { label: 'Light: --icon-on-surface on --bg',           fg: LIGHT.iconOnSurface, bg: LIGHT.bg,        min: 3,   type: 'ui' },

  // Specialized text colors
  { label: 'Light: --primary-text on --bg',      fg: LIGHT.primaryText, bg: LIGHT.bg,        min: 4.5, type: 'text' },
  { label: 'Light: --primary-text on --surface',  fg: LIGHT.primaryText, bg: LIGHT.surface,   min: 4.5, type: 'text' },

  // UI colors on light bg
  { label: 'Light: --gold on --bg',              fg: LIGHT.gold,        bg: LIGHT.bg,        min: 3,   type: 'ui' },
  { label: 'Light: --primary on --bg',           fg: LIGHT.primary,     bg: LIGHT.bg,        min: 3,   type: 'ui' },
  { label: 'Light: --accent on --bg',            fg: LIGHT.accent,      bg: LIGHT.bg,        min: 3,   type: 'ui' },
  { label: 'Light: --success on --bg',           fg: LIGHT.success,     bg: LIGHT.bg,        min: 3,   type: 'ui' },
  { label: 'Light: --error on --bg',             fg: LIGHT.error,       bg: LIGHT.bg,        min: 3,   type: 'ui' },
  { label: 'Light: --warning on --bg',           fg: LIGHT.warning,     bg: LIGHT.bg,        min: 3,   type: 'ui' },
  { label: 'Light: --info on --bg',              fg: LIGHT.info,        bg: LIGHT.bg,        min: 3,   type: 'ui' },

  // Text on colored buttons (light)
  { label: 'Light: #fff on --primary',           fg: '#ffffff',         bg: LIGHT.primary,   min: 4.5, type: 'text' },
  { label: 'Light: #fff on --error',             fg: '#ffffff',         bg: LIGHT.error,     min: 3,   type: 'largeText' },
  { label: 'Light: #fff on --success',           fg: '#ffffff',         bg: LIGHT.success,   min: 3,   type: 'largeText' },

  // Game screen (light bg #e4e4f0)
  { label: 'Light: --text on game-bg (#e4e4f0)', fg: LIGHT.text,        bg: '#e4e4f0',       min: 4.5, type: 'text' },
  { label: 'Light: --text-dim on game-bg',       fg: LIGHT.textDim,     bg: '#e4e4f0',       min: 4.5, type: 'text' },

  // Store / avatar card surfaces
  { label: 'Light: --text on store-card',        fg: LIGHT.text,        bg: compositeRgba('#ffffff', 0.85, '#f0f0f5'), min: 4.5, type: 'text' },
  { label: 'Light: --text-dim on store-card',    fg: LIGHT.textDim,     bg: compositeRgba('#ffffff', 0.85, '#f0f0f5'), min: 4.5, type: 'text' },
];

const THEMES = [...themeCss.matchAll(/body\.theme-([a-z]+)\s*\{([^}]+)\}/g)].map(([, id, css]) => ({
  id,
  ...Object.fromEntries(['bg', 'surface', 'card', 'primary', 'accent', 'success', 'warning', 'info'].map(name => [name, cssColor(css, name)])),
  onPrimary: cssColor(css, 'on-primary', DARK.onPrimary),
}));

for (const theme of THEMES) {
  checks.push(
    { label: `Theme ${theme.id}: --text on --surface`, fg: DARK.text, bg: theme.surface, min: 4.5, type: 'text' },
    { label: `Theme ${theme.id}: --text-dim on --surface`, fg: DARK.textDim, bg: theme.surface, min: 4.5, type: 'text' },
    { label: `Theme ${theme.id}: --text-muted on --card`, fg: DARK.textMuted, bg: theme.card, min: 4.5, type: 'text' },
    { label: `Theme ${theme.id}: --primary on --bg`, fg: theme.primary, bg: theme.bg, min: 3, type: 'ui' },
    { label: `Theme ${theme.id}: --accent on --bg`, fg: theme.accent, bg: theme.bg, min: 3, type: 'ui' },
    { label: `Theme ${theme.id}: --success on --bg`, fg: theme.success, bg: theme.bg, min: 3, type: 'ui' },
    { label: `Theme ${theme.id}: --warning on --bg`, fg: theme.warning, bg: theme.bg, min: 3, type: 'ui' },
    { label: `Theme ${theme.id}: --info on --bg`, fg: theme.info, bg: theme.bg, min: 3, type: 'ui' },
    { label: `Theme ${theme.id}: primary button label`, fg: theme.onPrimary, bg: theme.primary, min: 4.5, type: 'text' },
    { label: `Theme ${theme.id}: primary gradient end`, fg: theme.onPrimary, bg: compositeRgba(theme.primary, .9, '#000000'), min: 4.5, type: 'text' },
  );
}

// The brightest endpoints of the new panel/control materials, not just their
// opaque base colors. Normal-size captions must pass across the whole finish.
for (const theme of [{ id: 'default', ...DARK }, ...THEMES]) {
  for (const [material, bg] of [['panel', compositeRgba(DARK.text, .06, theme.card)], ['control', compositeRgba('#ffffff', .035, theme.card)],
    ['station', compositeRgba('#ffffff', .04, compositeRgba('#ffffff', .035, theme.card))]]) {
    checks.push({ label: `Material ${theme.id}: muted caption on ${material} highlight`, fg: DARK.textMuted, bg, min: 4.5, type: 'text' });
  }
}

// ─── Run ───
let failCount = 0;
let passCount = 0;

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║       SCS Play — WCAG Contrast Audit (v2.0)            ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

for (const chk of checks) {
  const ratio = contrast(chk.fg, chk.bg);
  const pass = ratio >= chk.min;
  const icon = pass ? '✅' : '❌';
  const ratioStr = ratio.toFixed(2) + ':1';
  const req = chk.min + ':1';
  const line = `${icon}  ${ratioStr.padStart(8)} (need ${req.padStart(5)})  ${chk.label}`;

  if (!pass) {
    failCount++;
    console.log('\x1b[31m' + line + '\x1b[0m');
  } else {
    passCount++;
    console.log(line);
  }
}

console.log(`\n── Summary: ${passCount} passed, ${failCount} failed out of ${checks.length} checks ──\n`);

if (failCount > 0) {
  console.log('\x1b[31m✗ CONTRAST AUDIT FAILED — fix the above issues before merging.\x1b[0m\n');
  process.exit(1);
} else {
  console.log('\x1b[32m✓ All contrast checks passed.\x1b[0m\n');
  process.exit(0);
}
