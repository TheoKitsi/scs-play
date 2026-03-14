/* ═══════════════════════════════════════════════
   SCS Play — Capacitor Build Script
   Copies web assets into www/ for Capacitor sync
   Usage: node scripts/build-cap.mjs
   ═══════════════════════════════════════════════ */
import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const www = resolve(root, 'www');

// Clean previous build
if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

// Copy web assets (everything except node_modules, android, www, scripts, .git)
const exclude = new Set(['node_modules', 'android', 'www', '.git', 'scripts', 'package.json', 'package-lock.json', 'capacitor.config.json']);

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

copyDir(root, www);
console.log('✓ Web assets copied to www/');
