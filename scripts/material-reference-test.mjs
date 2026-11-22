/* Real compiled controls plus explicit density/tier/lifecycle fixtures.
   No assigned wins, clock overrides or seeded campaign progress. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { chromium, firefox, webkit } from 'playwright';
import { renderSurface } from '../js/engine/renderSurface.js';
import { MATERIAL_ASSETS, MATERIAL_FILES } from '../js/engine/materialAssets.js';
import { prismIsland, prismRegions } from '../js/renderers/prismIsland.js';
import { prismProgress } from '../js/services/PrismProgress.js';
import { PRISM_LEVELS } from '../js/game/prism/levels.js';
import { startStaticServer } from './lib/static-server.mjs';

for (const tier of ['high', 'mid', 'low']) for (const density of [1, 2, 3]) for (const [w, h] of [[208, 278], [412, 915], [1440, 900], [3840, 2160]]) {
  const size = renderSurface(w, h, tier, density);
  const cap = tier === 'low' ? 640 * 960 : tier === 'mid' ? 900 * 1200 : 1024 * 1536;
  assert.ok(size.width * size.height <= cap && size.width <= 3072 && size.height <= 3072);
  assert.ok(Math.abs(size.width / w - size.height / h) <= 1 / Math.min(w, h));
}
assert.equal(renderSurface(412, 915, 'high', 3).width, 824);
assert.ok(renderSurface(1440, 900, 'high', 2).width >= 1440, 'High-tier desktop is no longer upscaled from 1024px');
const assets = MATERIAL_FILES;
assert.equal(new Set(assets).size, 18);
for (const file of assets) assert.ok((await readFile(file)).length < 180 * 1024, `${file}: bounded original artwork`);
const worker = await readFile('docs/sw.js', 'utf8');
const sourceWorker = await readFile('sw.js', 'utf8');
for (const file of assets) for (const sw of [worker, sourceWorker]) assert.ok(sw.includes(`'./${file}'`), `${file} must work on the first offline engine launch`);
const hashes = await Promise.all(Object.values(MATERIAL_ASSETS.decks).map(async file => createHash('sha256').update(await readFile(file)).digest('hex')));
assert.equal(new Set(hashes).size, 10, 'Every arcade instrument has distinct baked artwork');

// Explicit persistence/renderer fixtures, not claimed campaign wins. Regional
// art must use valid level identities, not reassign aggregate counts in order.
const source = { prism: { version: 1, levels: { 'first-light': { stars: 0, bestShots: 1 }, 'world-awake': { stars: 3, bestShots: 3 } } } };
const before = JSON.stringify(source), late = prismProgress(source);
assert.deepEqual(prismRegions(late), [0, 0, 1]);
assert.equal(JSON.stringify(source), before, 'Artwork cannot mutate saved progress');
assert.match(prismIsland(late, 2), /data-restored="1"/);
assert.match(prismIsland(late, 0), /data-restored="0"/);
for (let count = 0; count <= 12; count++) {
  const progress = prismProgress({ prism: { version: 1, levels: Object.fromEntries(PRISM_LEVELS.slice(0, count).map(level => [level.id, { stars: 3, bestShots: level.par }])) } });
  assert.deepEqual(prismRegions(progress), [0, 1, 2].map(zone => PRISM_LEVELS.slice(0, count).filter(level => level.zone === zone).length));
}
console.log('PASS 18 bounded offline assets, ten distinct materials, canonical regional identities and pure artwork fixtures');

const qaRoot = process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, 'Temp/opencode') : resolve(tmpdir(), 'opencode');
const out = process.env.SCS_REVIEW_OUT || resolve(qaRoot, 'scs-luminous-reference');
await mkdir(out, { recursive: true });
const server = await startStaticServer({ root: 'docs', port: 0 });
const receipts = [];

async function contextFor(browser, spec = { width: 412, height: 915, dpr: 3 }, { forceCanvas = false, theme = 'default' } = {}) {
  const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, deviceScaleFactor: spec.dpr, locale: 'de-DE', hasTouch: true, serviceWorkers: 'block' });
  await context.addInitScript(({ forceCanvas, theme }) => {
    localStorage.setItem('scsQa', '1'); localStorage.setItem('scsQaPerfTier', 'high');
    localStorage.setItem('scs_save:guest', JSON.stringify({ activeTheme: theme, settings: { tutorialDone: true, sound: false, music: false } }));
    if (forceCanvas) {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /webgl/i.test(type) ? null : getContext.call(this, type, ...args); };
    }
    globalThis.materialDraws = 0;
    for (const api of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) if (api) for (const method of ['drawArrays', 'drawElements']) {
      const draw = api.prototype[method];
      api.prototype[method] = function (...args) { globalThis.materialDraws++; return draw.apply(this, args); };
    }
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      if (this.canvas.closest?.('#pwArena,.arcade-engine-layer')) globalThis.materialDraws++;
      return drawImage.apply(this, args);
    };
  }, { forceCanvas, theme });
  return context;
}
async function guest(page) {
  await page.goto(`${server.baseUrl}?view=arcade`, { waitUntil: 'networkidle' });
  await page.locator('#btnGuest').click(); await page.waitForSelector('#home.active');
}
async function ready(page) {
  await page.waitForFunction(() => document.querySelector('#pwArena canvas') && !document.querySelector('#pwArena .pw-loading'));
}
async function aim(page, x = 210, y = 170) {
  const canvas = page.locator('#pwArena canvas');
  await canvas.scrollIntoViewIfNeeded();
  const r = await canvas.boundingBox();
  await page.touchscreen.tap(r.x + x / 420 * r.width, r.y + y / 560 * r.height);
}
async function canvasSize(page) {
  return page.locator('#pwArena canvas').evaluate(canvas => {
    const r = canvas.getBoundingClientRect();
    return { width: canvas.width, height: canvas.height, cssWidth: r.width, cssHeight: r.height, dpr: devicePixelRatio };
  });
}
async function pixelDelta(page, before, after) {
  // Decode actual captures. PNG byte equality is not a portable pixel test;
  // permit only tiny channel rounding, never a changed crystal/lighting image.
  return page.evaluate(async images => {
    const decoded = await Promise.all(images.map(async data => {
      const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      return { width: image.width, height: image.height, pixels: ctx.getImageData(0, 0, image.width, image.height).data };
    }));
    if (decoded[0].width !== decoded[1].width || decoded[0].height !== decoded[1].height) throw new Error('Ready/resumed canvas sizes differ');
    let max = 0, mean = 0, maxBlockMean = 0;
    for (let i = 0; i < decoded[0].pixels.length; i++) {
      const error = Math.abs(decoded[0].pixels[i] - decoded[1].pixels[i]); max = Math.max(max, error); mean += error / decoded[0].pixels.length;
    }
    // CSS-sized captures downsample GPU edges differently in Firefox/WebKit.
    // Bound local 4×4 error too: a changed material patch cannot hide behind a
    // small whole-canvas average, while a few isolated AA channels may round.
    for (let y = 0; y < decoded[0].height; y += 4) for (let x = 0; x < decoded[0].width; x += 4) {
      let error = 0, channels = 0;
      for (let yy = y; yy < Math.min(y + 4, decoded[0].height); yy++) for (let xx = x; xx < Math.min(x + 4, decoded[0].width); xx++) for (let c = 0; c < 4; c++) {
        const i = (yy * decoded[0].width + xx) * 4 + c; error += Math.abs(decoded[0].pixels[i] - decoded[1].pixels[i]); channels++;
      }
      maxBlockMean = Math.max(maxBlockMean, error / channels);
    }
    return { max, mean, maxBlockMean, width: decoded[0].width, height: decoded[0].height };
  }, [before.toString('base64'), after.toString('base64')]);
}
async function idle(page, afterDraws = null) {
  // Observe the requested wake render before measuring its subsequent idle
  // period. Windows WebKit's actual resume paint arrived 553–663ms after the
  // click in diagnosis; an earlier quiet interval was not idle evidence yet.
  if (afterDraws !== null) await page.waitForFunction(before => globalThis.materialDraws > before, afterDraws, { timeout: 5000 });
  // Wake/resize is entitled to one render. Wait for a bounded quiet plateau,
  // not an assumed first-frame latency (Windows WebKit can wake much later).
  // A continuously rendering scene never reaches this condition and fails.
  await page.evaluate(() => { globalThis.materialIdleProbe = { draws: globalThis.materialDraws, since: performance.now() }; });
  await page.waitForFunction(() => {
    const probe = globalThis.materialIdleProbe;
    if (probe.draws !== globalThis.materialDraws) { probe.draws = globalThis.materialDraws; probe.since = performance.now(); }
    return performance.now() - probe.since >= 400;
  }, null, { polling: 50, timeout: 5000 });
  const before = await page.evaluate(() => globalThis.materialDraws);
  await page.waitForTimeout(220);
  assert.equal(await page.evaluate(() => globalThis.materialDraws), before, 'An unchanged ready/paused scene performs no WebGL draws');
}
async function win(page) {
  await aim(page); await page.locator('#pwFire').click();
  await page.waitForSelector('#pwNext:not(:disabled)');
}
async function restorationAction(page, action) {
  // Explicit DOM-event lifecycle fixtures at the real presentation boundary.
  // Sampling and dispatch share a browser task: slow automation cannot consume
  // the entire 720ms reveal between two IPC calls. Shots/wins still use actual
  // touch + launch controls, with no frozen/replaced game or renderer clock.
  return (await page.waitForFunction(action => {
    if (!document.querySelector('#prism[data-pw-finishing]')) return false;
    if (action === 'graphics') document.querySelector('#pwArena canvas').dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    else if (action === 'native') window.dispatchEvent(new Event('scs:native-pause'));
    else {
      const button = document.querySelector(action === 'skip' ? '#pwSkipReveal' : '#pwBack');
      const r = button.getBoundingClientRect();
      if (button.hidden || button.disabled || r.width < 44 || r.height < 44) throw new Error('The presentation action must be a visible, usable real control');
      button.click();
    }
    return true;
  }, action)).jsonValue();
}

try {
  for (const name of (process.env.SCS_BROWSERS || 'chromium').split(',')) {
    const browser = await ({ chromium, firefox, webkit })[name].launch();
    try {
      for (const spec of [{ width: 412, height: 915, dpr: 3 }, { width: 1440, height: 900, dpr: 2 }]) {
        const context = await contextFor(browser, spec);
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        try {
          await guest(page);
          assert.equal(await page.locator('#heroSlider .mode-material img[src]').count(), 1, 'Only the current home material is requested/decoded, not all ten hidden slides');
          await page.locator('#heroSlider .hero-slide[data-pos="current"] .mode-material img').evaluate(image => image.decode());
          await page.screenshot({ path: resolve(out, `${name}-home-${spec.width}.png`), scale: 'css' });
          await page.locator('#btnPrism').click(); await page.locator('#pwContinue').click(); await ready(page);
          const high = await canvasSize(page);
          assert.ok(high.width / high.cssWidth >= 1.8, `Prism high-DPI reference: ${JSON.stringify(high)}`);
          assert.ok(high.width * high.height <= 1024 * 1536);
           await idle(page, 0);
           await page.waitForSelector('#pwArena[data-studio-renderer="mesh-ggx"]');
           const initialArena = await page.locator('#pwArena canvas').screenshot({ scale: 'css' });
           await writeFile(resolve(out, `${name}-prism-initial-${spec.width}.png`), initialArena);
           await page.locator('#pwPause').click(); await idle(page);
          const pausedDraws = await page.evaluate(() => globalThis.materialDraws);
           await page.locator('#pwResume').click(); await idle(page, pausedDraws);
           const resumedArena = await page.locator('#pwArena canvas').screenshot({ scale: 'css' });
           await writeFile(resolve(out, `${name}-prism-resumed-${spec.width}.png`), resumedArena);
           const handoffDelta = await pixelDelta(page, initialArena, resumedArena);
           assert.ok(handoffDelta.maxBlockMean <= 1 && handoffDelta.mean <= .005,
             `Ready/resumed pixels match within local AA rounding, never retained baked sprites: ${JSON.stringify(handoffDelta)}`);
           const changedPatch = Buffer.from((await page.evaluate(async data => {
             const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
             const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
             const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
             const x = Math.floor(canvas.width / 2) - 4, y = Math.floor(canvas.height * 145 / 560) - 4;
             const patch = ctx.getImageData(x, y, 8, 8);
             for (let i = 0; i < patch.data.length; i++) if (i % 4 !== 3) patch.data[i] = Math.min(255, patch.data[i] + 12);
             ctx.putImageData(patch, x, y); return canvas.toDataURL('image/png');
           }, initialArena.toString('base64'))).split(',')[1], 'base64');
           const negativeControl = await pixelDelta(page, initialArena, changedPatch);
           assert.ok(negativeControl.maxBlockMean > 1, 'The same comparator rejects an explicitly altered 8×8 material patch; it cannot hide a sprite/mesh swap in the full-canvas mean');
          await page.screenshot({ path: resolve(out, `${name}-prism-${spec.width}.png`), scale: 'css' });
          // The camera's inverse transform, not the backing pixel coordinates,
          // supplies aiming. This earns the win at both 2x and capped 3x density.
          await aim(page); await page.locator('#pwFire').click();
          const reveal = await (await page.waitForFunction(() => document.querySelector('#prism[data-pw-finishing]') && {
            disabled: document.querySelector('#pwFire').disabled,
            dialogs: document.querySelectorAll('#pwDialog.active').length,
          })).jsonValue();
          assert.equal(reveal.disabled, true);
          assert.equal(reveal.dialogs, 0, 'The world remains visible during restoration');
          await page.waitForFunction(() => JSON.parse(localStorage.getItem('scs_save:guest')).prism?.levels?.['first-light']?.stars === 3);
          await page.screenshot({ path: resolve(out, `${name}-restoration-${spec.width}.png`), scale: 'css' });
          await page.waitForSelector('#pwNext:not(:disabled)');
          const earned = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('scs_save:guest')).prism));
          await idle(page);

          // Tier downgrade reallocates the backing surface, not the simulation.
          await page.locator('#pwResultReplay').click(); await ready(page);
          await page.evaluate(() => { document.body.dataset.perfMode = 'low'; window.dispatchEvent(new CustomEvent('scs:perftier')); });
          await page.waitForFunction(() => document.querySelector('#pwArena canvas').width <= document.querySelector('#pwArena').clientWidth);
          const low = await canvasSize(page); assert.ok(low.width < high.width);
          await win(page);
          assert.equal(await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('scs_save:guest')).prism)), earned, 'Density and replay never duplicate earned progress');

          if (spec.width === 412) {
            await page.locator('#pwResultReplay').click(); await ready(page);
            await aim(page); await page.locator('#pwFire').click(); await restorationAction(page, 'skip');
            await page.waitForSelector('#pwNext:not(:disabled)');
            await page.locator('#pwResultReplay').click(); await ready(page);
            await aim(page); await page.locator('#pwFire').click(); await restorationAction(page, 'back');
            await page.waitForSelector('.pw-map-view');
            await page.waitForTimeout(850);
            assert.equal(await page.locator('#pwDialog.active').count(), 0, 'Navigation cancels the pending completion, not the genuine win');
            assert.equal(await page.locator('#prism canvas').count(), 0);
            await page.locator('[data-pw-level="0"]').click(); await ready(page);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await win(page);
            assert.equal(await page.locator('#prism[data-pw-finishing]').count(), 0);
            await page.locator('#pwResultReplay').click(); await ready(page);
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            // Native suspension and graphics loss here are dispatched lifecycle
            // fixtures, not a claim of physical Android/GPU testing.
            await aim(page); await page.locator('#pwFire').click(); await restorationAction(page, 'native');
            await page.waitForSelector('#pwNext:not(:disabled)');
            assert.equal(await page.locator('#prism[data-pw-finishing]').count(), 0);
            await page.locator('#pwResultReplay').click(); await ready(page);
            await aim(page); await page.locator('#pwFire').click(); await restorationAction(page, 'graphics');
            await page.waitForSelector('#pwGraphicsRestart');
            await page.waitForTimeout(850);
            assert.equal(await page.locator('#pwNext').count(), 0, 'Cancelled completion cannot replace the graphics-recovery dialog');
            await page.locator('#pwGraphicsRestart').click(); await ready(page);
          } else { await page.locator('#pwResultReplay').click(); await ready(page); }

          await page.locator('#pwBack').click(); await page.locator('#pwBack').click();
          await page.evaluate(() => { document.body.dataset.perfMode = 'high'; window.dispatchEvent(new CustomEvent('scs:perftier')); __SCS_QA__.setGameSelection('klassik', 'endless'); });
          await page.locator('#btnPlay').click(); await page.waitForSelector('#game.active');
          if (await page.locator('#modeInstructionOverlay.active').count()) await page.locator('#btnStartAfterInstruction').click();
          await page.waitForFunction(() => __SCS_QA__.gameState().running && __SCS_QA__.gameState().direction && __SCS_QA__.arcadeRendererState()?.ready && __SCS_QA__.arcadeRendererState().targets === 4);
          const renderer = await page.evaluate(() => __SCS_QA__.arcadeRendererState());
          assert.equal(renderer.material, true); assert.ok(renderer.pixels <= 1024 * 1536);
          const surface = await page.locator('.arcade-engine-layer canvas').evaluate(c => ({ width: c.width, css: c.getBoundingClientRect().width }));
          assert.ok(surface.width >= surface.css, 'High-tier arcade does not upscale a lower-resolution canvas');
          await page.screenshot({ path: resolve(out, `${name}-farben-${spec.width}.png`), scale: 'css' });
          const rectangles = () => page.locator('#game .corner-shape,#centerPlatform').evaluateAll(nodes => nodes.filter(n => n.offsetParent).map(n => { const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
          const before = await rectangles();
          const previous = await page.evaluate(() => __SCS_QA__.gameState().stimulusId);
          const { state, point } = await page.evaluate(async previous => {
            const deadline = performance.now() + 5000;
            while (performance.now() < deadline) {
              const state = __SCS_QA__.gameState();
              if (state.direction && state.stimulusId !== previous) {
                const r = document.querySelector(`#game .corner-shape[data-dir="${state.direction}"]`).getBoundingClientRect();
                return { state, point: { x: r.x + r.width / 2, y: r.y + r.height / 2 } };
              }
              await new Promise(resolve => setTimeout(resolve, 16));
            }
            throw new Error('No fresh live arcade stimulus within the real-time fixture deadline');
          }, previous);
          // Native touch at the already verified stationary rectangle. Windows
          // WebKit's locator actionability path added ~950–1455ms before touchend
          // in diagnosis, sometimes targeting a successor instead. Direct touch
          // arrived at 104–114ms with this 100ms human-reaction fixture. No game
          // deadline or 50ms anti-cheat guard is replaced or relaxed.
          await page.waitForTimeout(100);
          await page.touchscreen.tap(point.x, point.y);
          await page.waitForFunction(correct => __SCS_QA__.gameState().correct > correct, state.correct);
          assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().effects), 0, 'The cached material reference uses its local SVG contact, not repeated full-texture engine passes');
          assert.deepEqual(await rectangles(), before);
          await page.locator('#btnPause').click(); await idle(page);
          assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().loopRunning), false);
          assert.deepEqual(errors, []);
           receipts.push({ browser: name, spec, high, low, handoffDelta, negativeControl, arcade: renderer, earned: true, fixedTargets: true, idleSleeps: true });
          console.log(`PASS ${name}/${spec.width}: density, real touch, sleep and restoration lifecycle`);
        } finally { await context.close(); }
      }

      // Explicit unavailable-art fixture: original ray/input semantics remain
      // playable even if a browser cannot decode the local textures.
      const context = await contextFor(browser);
      try {
        const page = await context.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/img/materials/*.webp', route => route.fulfill({ contentType: 'image/webp', body: Buffer.from('undecodable-art-fixture') }));
        await guest(page); await page.locator('#btnPrism').click(); await page.locator('#pwContinue').click(); await ready(page);
        await win(page); assert.deepEqual(errors, []);
        console.log(`PASS ${name}: undecodable-art fixture remains playable`);
      } finally { await context.close(); }
      const canvasContext = await contextFor(browser, undefined, { forceCanvas: true, theme: 'ocean' });
      try {
        const page = await canvasContext.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await guest(page); await page.evaluate(() => __SCS_QA__.setGameSelection('klassik', 'endless'));
        await page.locator('#btnPlay').click(); await page.waitForSelector('#game.active');
        if (await page.locator('#modeInstructionOverlay.active').count()) await page.locator('#btnStartAfterInstruction').click();
        await page.waitForFunction(() => __SCS_QA__.arcadeRendererState()?.ready && __SCS_QA__.arcadeRendererState().targets === 4 && __SCS_QA__.arcadeRendererState().renderedFrames > 0);
        assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().backend), 'canvas');
        assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().material), true);
        const pixel = await page.locator('.arcade-engine-layer canvas').evaluate(c => [...c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height * .68), 1, 1).data]);
        assert.ok(pixel[2] > pixel[0] + 5 && Math.max(...pixel.slice(0, 3)) < 120 && Math.abs(pixel[3] - 168) <= 1, `Canvas fallback keeps the ocean tint and translucent coastal deck: ${pixel}`);
        assert.deepEqual(errors, []);
        console.log(`PASS ${name}: Canvas-only ocean tint/pixel fixture`);
      } finally { await canvasContext.close(); }
      console.log(`PASS ${name}: material references, high-DPI/pixel budgets, camera-correct input, idle sleep, genuine win, restoration/skip/navigation/reduced-motion, tier reallocation and unavailable-art fallback`);
    } finally { await browser.close(); }
  }
  await writeFile(resolve(out, 'material-reference-receipts.json'), JSON.stringify(receipts, null, 2));
} finally { await server.close(); }
