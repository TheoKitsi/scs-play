/* ═══════════════════════════════════════════════
   SCS Play — Production Build Script
   Bundles + minifies JS & CSS, copies to www/
   Usage: node scripts/build-prod.mjs
   ═══════════════════════════════════════════════ */
import { mkdirSync, rmSync, existsSync, readdirSync, statSync,
         copyFileSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const www  = resolve(root, 'www');

// Clean previous build
if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

// ── 1. Bundle JS ──
const jsResult = await esbuild.build({
  entryPoints: [resolve(root, 'js/app.js')],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'esm',
  target: ['es2020'],
  outfile: resolve(www, 'js/app.bundle.js'),
  external: [
    'https://www.gstatic.com/firebasejs/*'  // Firebase loaded from CDN
  ],
  metafile: true,
});

// ── 2. Bundle CSS ──
const cssResult = await esbuild.build({
  entryPoints: [resolve(root, 'css/style.css')],
  bundle: true,
  minify: true,
  outfile: resolve(www, 'css/style.bundle.css'),
  metafile: true,
});

// ── 3. Copy static assets ──
const skip = new Set([
  'node_modules', 'android', 'www', '.git', 'scripts',
  'package.json', 'package-lock.json', 'capacitor.config.json',
  'js', 'css'  // handled by esbuild
]);

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    if (src === root && skip.has(entry)) continue;
    const srcPath  = resolve(src, entry);
    const destPath = resolve(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(root, www);

// ── 4. Rewrite index.html to use bundled files ──
let html = readFileSync(resolve(www, 'index.html'), 'utf8');
html = html.replace(
  '<link rel="stylesheet" href="css/style.css">',
  '<link rel="stylesheet" href="css/style.bundle.css">'
);
html = html.replace(
  '<script type="module" src="js/app.js"></script>',
  '<script type="module" src="js/app.bundle.js"></script>'
);
writeFileSync(resolve(www, 'index.html'), html);

// ── 5. Rewrite sw.js to cache bundles instead of individual modules ──
let sw = readFileSync(resolve(www, 'sw.js'), 'utf8');
const bundledAssets = `const ASSETS = [
  './',
  './index.html',
  './css/style.bundle.css',
  './js/app.bundle.js',
  './manifest.json',
  './img/icon-192.svg',
  './img/icon-512.svg'
];`;
sw = sw.replace(/const ASSETS\s*=\s*\[[\s\S]*?\];/, bundledAssets);
writeFileSync(resolve(www, 'sw.js'), sw);

// ── 5. Report sizes ──
const jsSize  = statSync(resolve(www, 'js/app.bundle.js')).size;
const cssSize = statSync(resolve(www, 'css/style.bundle.css')).size;

console.log(`✓ JS  bundled: ${(jsSize / 1024).toFixed(1)} KB (minified)`);
console.log(`✓ CSS bundled: ${(cssSize / 1024).toFixed(1)} KB (minified)`);
console.log('✓ Production build complete → www/');
