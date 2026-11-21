/* Reproducible offline artwork, using the already installed browser as a
   rasterizer. No downloaded art, AI service or runtime generation. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { drawMaterialArt } from './lib/material-art.mjs';
import { studioFinishPng } from './lib/studio-finish.mjs';
import { MATERIAL_ASSETS } from '../js/engine/materialAssets.js';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const jobs = [...Object.entries(MATERIAL_ASSETS.decks).map(([mode, file]) => ({ file, kind: 'deck', mode })),
    ...MATERIAL_ASSETS.gardens.map((file, zone) => ({ file, kind: 'garden', zone })),
    ...MATERIAL_ASSETS.islands.map((file, zone) => ({ file, kind: 'island', zone })),
    { file: MATERIAL_ASSETS.crystals, kind: 'crystals' }];
  await mkdir(resolve('img/materials'), { recursive: true });
  const finish = studioFinishPng();
  await writeFile(resolve(MATERIAL_ASSETS.finishes), finish);
  console.log(`${MATERIAL_ASSETS.finishes}: 512×128 straight RGBA data, ${(finish.length / 1024).toFixed(1)} KiB`);
  for (const { file, ...art } of jobs) {
    const result = await page.evaluate(drawMaterialArt, art);
    const bytes = Buffer.from(result.data.split(',')[1], 'base64');
    await writeFile(resolve(file), bytes);
    console.log(`${file}: ${result.width}×${result.height}, ${(bytes.length / 1024).toFixed(1)} KiB`);
  }
} finally { await browser.close(); }
