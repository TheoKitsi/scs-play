/**
 * Split monolithic style.css into logical partials.
 * Run: node scripts/split-css.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC  = join(ROOT, 'css', 'style.css');
const DEST = join(ROOT, 'css', 'partials');

// Read source
const lines = readFileSync(SRC, 'utf8').split('\n');
const total = lines.length;
console.log(`Read ${total} lines from style.css`);

// Section definitions: [filename, startLine (1-indexed), endLine (1-indexed)]
const sections = [
  ['01-tokens.css',         1,    99],
  ['02-base.css',           100,  217],
  ['03-boot-auth.css',      218,  499],
  ['04-home.css',           500,  1068],
  ['05-game.css',           1069, 1870],
  ['06-overlays.css',       1871, 2516],
  ['07-effects.css',        2517, 2698],
  ['08-patches-v7-v9.css',  2699, 3370],
  ['09-extensions.css',     3371, 3782],
  ['10-micro-modes.css',    3783, 4322],
  ['11-light-theme.css',    4323, 4833],
  ['12-polish-v18-v19.css', 4834, total],
];

// Create partials dir
mkdirSync(DEST, { recursive: true });

// Write each partial
for (const [name, start, end] of sections) {
  const slice = lines.slice(start - 1, end); // convert to 0-indexed
  const content = slice.join('\n').trim() + '\n';
  writeFileSync(join(DEST, name), content, 'utf8');
  console.log(`  ✓ ${name} — lines ${start}–${end} (${end - start + 1} lines)`);
}

// Generate new style.css with @import statements
const imports = sections
  .map(([name]) => `@import url('partials/${name}');`)
  .join('\n');

const mainCSS = `/* ═══════════════════════════════════════════
   SCS Play — CSS Architecture
   Split into logical partials for fast dev.
   ═══════════════════════════════════════════ */

${imports}
`;

writeFileSync(SRC, mainCSS, 'utf8');
console.log(`\n✓ style.css replaced with ${sections.length} @import statements`);
console.log('Done!');
