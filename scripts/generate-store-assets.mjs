import path from 'node:path';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';

const assets = [
  ['icon-512.svg', 'store-icon-512.png', 512, 512],
  ['feature-graphic.svg', 'feature-graphic-1024x500.png', 1024, 500],
];

const master = readFileSync('img/icon-512.svg', 'utf8');
writeFileSync('img/icon-192.svg', master.replace('width="512" height="512"', 'width="192" height="192"'));
const browser = await chromium.launch({ headless: true });
try {
  for (const [source, output, width, height] of assets) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    // Inline the SVG for deterministic local rendering (file: origins cannot
    // reliably resolve the feature illustration's external <use>).
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${readFileSync(path.resolve('img', source), 'utf8').replace('href="icon-512.svg#brand-mark"', '')}`);
    if (source === 'feature-graphic.svg') {
      await page.evaluate(svg => {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const instance = document.querySelector('use');
        const art = document.importNode(doc.querySelector('#brand-mark'), true);
        document.querySelector('defs').append(...[...doc.querySelectorAll('linearGradient[gradientUnits]')].map(el => document.importNode(el, true)));
        art.setAttribute('transform', instance.getAttribute('transform'));
        instance.replaceWith(art);
      }, master);
    }
    await page.screenshot({ path: path.resolve('img', output), omitBackground: true });
    await page.close();
  }
  if (process.argv.includes('--android')) {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.setContent(master);
    const { defs, mark } = await page.evaluate(() => ({ defs: document.querySelector('defs').outerHTML, mark: document.querySelector('#brand-mark').outerHTML }));
    await page.goto('about:blank');
    const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 864 864">${defs}<g transform="translate(176 176)">${mark}</g></svg>`;
    const image = svg => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const render = async (file, width, height, svg, style = '') => {
      await page.setViewportSize({ width, height });
      await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:100vw;height:100vh;${style}}</style><img src="${image(svg)}">`);
      await page.locator('img').evaluate(el => el.decode());
      await page.screenshot({ path: file, omitBackground: true });
    };
    const res = 'android/app/src/main/res';
    // Keep the cut-glass planes of the adaptive vector, the
    // themed one-colour silhouette, and the Android 12 splash in lockstep.
    const paths = await page.evaluate(svg => {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      return [...doc.querySelectorAll('#brand-mark > path')].map(el => {
        const fill = el.getAttribute('fill');
        const g = fill.startsWith('url(') && doc.querySelector(fill.slice(4, -1));
        const gradient = g && `<aapt:attr name="android:fillColor"><gradient android:type="linear" android:startX="${g.getAttribute('x1')}" android:startY="${g.getAttribute('y1')}" android:endX="${g.getAttribute('x2')}" android:endY="${g.getAttribute('y2')}">${[...g.children].map(s => `<item android:offset="${s.getAttribute('offset') || '0'}" android:color="${s.getAttribute('stop-color')}"/>`).join('')}</gradient></aapt:attr>`;
        return { d: el.getAttribute('d'), fill, gradient, ink: el.hasAttribute('data-ink') };
      });
    }, master);
    for (const [file, monochrome] of [['ic_launcher_foreground', false], ['ic_launcher_monochrome', true]]) {
      const nodes = paths.filter(p => !monochrome || p.ink)
        .map(p => p.gradient && !monochrome ? `        <path android:pathData="${p.d}">${p.gradient}</path>` :
          `        <path android:fillColor="${monochrome ? '#FFFFFF' : p.fill}" android:pathData="${p.d}"/>`).join('\n');
      writeFileSync(path.join(res, 'drawable', `${file}.xml`), `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated from img/icon-512.svg by npm run brand:generate. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android" xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <group android:scaleX="0.125" android:scaleY="0.125" android:translateX="22" android:translateY="22">
${nodes}
    </group>
</vector>
`);
    }
    for (const [density, size] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
      const folder = path.join(res, `mipmap-${density}`);
      await render(path.join(folder, 'ic_launcher.png'), size, size, master);
      await render(path.join(folder, 'ic_launcher_round.png'), size, size, master, 'border-radius:50%;background:#080C14');
      const adaptive = Math.round(size * 108 / 48);
      await render(path.join(folder, 'ic_launcher_foreground.png'), adaptive, adaptive, foreground);
    }
    // Preserve each existing splash's resolution; replace only its placeholder art.
    for (const folder of readdirSync(res).filter(name => /^drawable(?:-(?:land|port)-\w+)?$/.test(name))) {
      const file = path.join(res, folder, 'splash.png');
      const bytes = readFileSync(file);
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
      const density = ({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })[folder.split('-').at(-1)] || 1;
      const size = 192 * density;
      const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#080C14"/><svg x="${(width - size) / 2}" y="${(height - size) / 2}" width="${size}" height="${size}" viewBox="0 0 864 864">${defs}<circle cx="432" cy="432" r="254" fill="none" stroke="#465367" stroke-width="4"/><g transform="translate(176 176)">${mark}</g></svg></svg>`;
      await render(file, width, height, splash);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
