/* ═══════════════════════════════════════════════
   SCS Play — Dev Build Script
   Copies web assets into docs/ (unbundled)
   Usage: node scripts/build-cap.mjs
   ═══════════════════════════════════════════════ */
import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const out = resolve(root, 'docs');

// Clean previous build
if (existsSync(out)) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Copy web assets (everything except node_modules, android, docs, scripts, .git)
const exclude = new Set(['node_modules', 'android', 'www', 'docs', '.git', '.github', '.gitignore', 'scripts', 'package.json', 'package-lock.json', 'capacitor.config.json']);

import { readdirSync, statSync, copyFileSync } from 'fs';

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    // Only exclude at root level
    if (src === root && exclude.has(entry)) continue;
    const srcPath = resolve(src, entry);
    const destPath = resolve(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(root, out);
console.log('✓ Web assets copied to docs/');
