/** Source/raster consistency only. aapt/Gradle and a device remain separate checks. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const res = 'android/app/src/main/res';
const master = readFileSync('img/icon-512.svg', 'utf8');
assert.equal(readFileSync('img/icon-192.svg', 'utf8'), master.replace('width="512" height="512"', 'width="192" height="192"'), 'Both web icon sizes come from one master');
assert.equal(existsSync(`${res}/drawable-v24/ic_launcher_foreground.xml`), false, 'The Android robot must not override the SCS mark on API 24+');
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
assert.equal(config.android.backgroundColor, '#080C14');
assert.equal(config.plugins.SplashScreen.launchShowDuration, 0, 'No decorative minimum native launch wait');
const theme = readFileSync(`${res}/values/styles.xml`, 'utf8');
for (const name of ['windowSplashScreenBackground', 'windowSplashScreenAnimatedIcon', 'postSplashScreenTheme']) assert.ok(theme.includes(`name="${name}"`));
assert.ok(theme.includes('@drawable/scs_splash'));
const foreground = readFileSync(`${res}/drawable/ic_launcher_foreground.xml`, 'utf8');
const monochrome = readFileSync(`${res}/drawable/ic_launcher_monochrome.xml`, 'utf8');
for (const color of ['#FF4757', '#3742FA', '#2ED573', '#FFA502']) assert.ok(foreground.includes(color));
for (const source of [foreground, monochrome]) {
  assert.ok(source.includes('android:scaleX="0.125"') && source.includes('android:translateX="22"'), 'The mark fits inside the adaptive-icon safe zone');
}

const images = [{ file: 'img/store-icon-512.png', width: 512, height: 512, scale: 1, x: 0, y: 0 }, { file: 'img/feature-graphic-1024x500.png', width: 1024, height: 500 }];
for (const [density, size] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  for (const name of ['ic_launcher', 'ic_launcher_round']) images.push({ file: `${res}/mipmap-${density}/${name}.png`, width: size, height: size, scale: size / 512, x: 0, y: 0 });
  const adaptive = Math.round(size * 108 / 48);
  images.push({ file: `${res}/mipmap-${density}/ic_launcher_foreground.png`, width: adaptive, height: adaptive, scale: adaptive / 864, x: adaptive * 176 / 864, y: adaptive * 176 / 864 });
}
for (const folder of readdirSync(res).filter(name => /^drawable(?:-(?:land|port)-\w+)?$/.test(name))) {
  const file = `${res}/${folder}/splash.png`;
  const bytes = readFileSync(file);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const density = ({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })[folder.split('-').at(-1)] || 1;
  const size = 192 * density;
  images.push({ file, width, height, scale: size / 864, x: (width - size) / 2 + size * 176 / 864, y: (height - size) / 2 + size * 176 / 864, splash: true });
}
for (const image of images) {
  const data = readFileSync(image.file);
  assert.equal(data.readUInt32BE(16), image.width, image.file);
  assert.equal(data.readUInt32BE(20), image.height, image.file);
  image.src = `data:image/png;base64,${data.toString('base64')}`;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 108, height: 108 }, deviceScaleFactor: 3 });
  const pixels = await page.evaluate(async images => {
    const palette = [[130, 130, [255, 71, 87]], [382, 130, [55, 66, 250]], [130, 390, [46, 213, 115]], [382, 395, [255, 165, 2]]];
    const failures = [];
    for (const image of images) {
      const img = new Image(); img.src = image.src; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      if (image.splash) assertPixel(0, 0, [8, 12, 20], 0);
      if (image.scale) for (const [x, y, rgb] of palette) assertPixel(Math.round(image.x + x * image.scale), Math.round(image.y + y * image.scale), rgb, 20);
      function assertPixel(x, y, expected, tolerance) {
        const actual = [...ctx.getImageData(x, y, 1, 1).data];
        if (actual[3] !== 255 || expected.some((v, i) => Math.abs(actual[i] - v) > tolerance)) failures.push({ file: image.file, x, y, actual, expected });
      }
    }
    return failures;
  }, images);
  assert.deepEqual(pixels, [], 'Every legacy/adaptive raster and splash shows the SCS palette, not Capacitor placeholders');
  const native = await page.evaluate(({ foreground, monochrome }) => {
    const ns = 'http://schemas.android.com/apk/res/android';
    const parse = source => new DOMParser().parseFromString(source, 'application/xml');
    const doc = parse(foreground);
    if (doc.querySelector('parsererror') || parse(monochrome).querySelector('parsererror')) return { valid: false };
    const group = doc.querySelector('group');
    const attr = (el, key) => el.getAttributeNS(ns, key);
    const paint = color => color?.length === 9 ? `#${color.slice(3)}${color.slice(1, 3)}` : color || 'none';
    let defs = '', paths = '', id = 0;
    for (const path of group.querySelectorAll('path')) {
      const gradient = path.querySelector('gradient');
      let fill = paint(attr(path, 'fillColor'));
      if (gradient) {
        const name = `native-paint-${++id}`;
        defs += `<linearGradient id="${name}" gradientUnits="userSpaceOnUse" x1="${attr(gradient, 'startX')}" y1="${attr(gradient, 'startY')}" x2="${attr(gradient, 'endX')}" y2="${attr(gradient, 'endY')}">${[...gradient.querySelectorAll('item')].map(item => `<stop offset="${attr(item, 'offset')}" stop-color="${paint(attr(item, 'color'))}"/>`).join('')}</linearGradient>`;
        fill = `url(#${name})`;
      }
      paths += `<path d="${attr(path, 'pathData')}" fill="${fill}" stroke="${paint(attr(path, 'strokeColor'))}" stroke-width="${attr(path, 'strokeWidth') || 0}"/>`;
    }
    return { valid: true, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><defs>${defs}</defs><rect width="108" height="108" fill="#080C14"/><g transform="translate(22 22) scale(.125)">${paths}</g></svg>` };
  }, { foreground, monochrome });
  assert.equal(native.valid, true, 'Native source XML parses');
  await page.setContent(`<style>html,body{margin:0;background:#080C14}svg{display:block;width:108px;height:108px}</style>${native.svg}`);
  const bounds = await page.locator('g').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; });
  assert.ok(bounds.x >= 21 && bounds.y >= 21 && bounds.right <= 87 && bounds.bottom <= 87, `Native artwork stays in the safe zone: ${JSON.stringify(bounds)}`);
  const outsideSafeCircle = await page.evaluate(async svg => {
    const img = new Image(); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 108;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, 108, 108);
    const pixels = ctx.getImageData(0, 0, 108, 108).data;
    let outside = 0;
    for (let y = 0; y < 108; y++) for (let x = 0; x < 108; x++) {
      const i = (y * 108 + x) * 4;
      if (Math.hypot(x + .5 - 54, y + .5 - 54) > 33.5 && Math.abs(pixels[i] - 8) + Math.abs(pixels[i + 1] - 12) + Math.abs(pixels[i + 2] - 20) > 6) outside++;
    }
    return outside;
  }, native.svg);
  assert.equal(outsideSafeCircle, 0, 'Android circular masks must not crop the native mark');
  if (process.env.SCS_REVIEW_OUT) {
    const out = resolve(process.env.SCS_REVIEW_OUT, 'brand'); mkdirSync(out, { recursive: true });
    await page.screenshot({ path: resolve(out, 'native-vector-preview.png') });
  }
  console.log(`PASS branding: web icon master, ${images.length} rasters, dark native launch, four-color/adaptive/monochrome sources and native safe zone (not a device test)`);
} finally { await browser.close(); }
