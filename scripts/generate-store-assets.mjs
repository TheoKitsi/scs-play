import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const assets = [
  ['icon-512.svg', 'store-icon-512.png', 512, 512],
  ['feature-graphic.svg', 'feature-graphic-1024x500.png', 1024, 500],
];

const browser = await chromium.launch({ headless: true });
try {
  for (const [source, output, width, height] of assets) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.resolve('img', source)).href);
    await page.screenshot({ path: path.resolve('img', output), omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
