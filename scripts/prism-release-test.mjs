/* Real compiled gameplay: no score assignments, engine hooks, fake wins,
   clock replacement or seeded campaign progress. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, firefox, webkit } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';
import { PRISM_LEVELS } from '../js/game/prism/levels.js';
import { PRISM_SOLUTIONS } from './lib/prism-solutions.mjs';

const qaRoot = process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, 'Temp/opencode') : resolve(tmpdir(), 'opencode');
const out = process.env.SCS_REVIEW_OUT || resolve(qaRoot, 'scs-prism-worlds');
const server = process.env.SCS_BASE ? null : await startStaticServer({ root: 'docs', port: 0 });
const base = process.env.SCS_BASE || server.baseUrl;
const receipts = [];
await mkdir(out, { recursive: true });

async function guest(page, url = base) {
  await page.goto(url, { waitUntil: 'networkidle' });
  if (await page.locator('#btnGuest').isVisible()) await page.locator('#btnGuest').click();
  await page.waitForSelector('#home.active, #prism.active');
}
async function open(page) {
  await page.locator('#btnPrism').click();
  await page.waitForSelector('.pw-map-view');
}
async function ready(page) {
  await page.waitForSelector('#pwArena canvas');
  await page.waitForFunction(() => !document.querySelector('#pwArena .pw-loading'));
  await page.waitForFunction(() => {
    const renderer = __SCS_QA__.prismRendererState();
    return renderer?.enabled && renderer.draws >= 2;
  });
  const renderer = await page.evaluate(() => __SCS_QA__.prismRendererState());
  assert.ok(renderer.kinds.crystal >= 1 && renderer.kinds.ring >= 2, 'Puzzle crystals and launcher use physical meshes');
  assert.ok(renderer.objects <= 32 && renderer.triangles <= 3500);
}
async function aim(page, action, touch = false) {
  const canvas = page.locator('#pwArena canvas');
  await canvas.scrollIntoViewIfNeeded();
  const b = await canvas.boundingBox();
  const p = { x: b.x + action.x / 420 * b.width, y: b.y + action.y / 560 * b.height };
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}
async function shoot(page, action, touch = false) {
  if (action.color) await page.locator(`[data-pw-color="${action.color}"]`).click();
  await aim(page, action, touch);
  await page.locator('#pwFire').click();
  await page.waitForFunction(() => document.querySelector('#pwDialog.active') || !document.querySelector('#pwFire')?.disabled);
}
async function dragShot(page, action) {
  const canvas = page.locator('#pwArena canvas');
  await canvas.scrollIntoViewIfNeeded();
  const b = await canvas.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 508 / 560 * b.height);
  await page.mouse.down();
  await page.mouse.move(b.x + action.x / 420 * b.width, b.y + action.y / 560 * b.height, { steps: 12 });
  await page.mouse.up();
  await page.waitForSelector('#pwNext:not(:disabled)');
}
async function stored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('scs_save:guest') || '{}').prism || null);
}

try {
  for (const name of (process.env.SCS_BROWSERS || 'chromium').split(',')) {
    const browser = await ({ chromium, firefox, webkit })[name].launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, locale: 'de-DE' });
    const errors = [];
    await context.addInitScript(() => {
      localStorage.setItem('scsQa', '1'); localStorage.setItem('scsQaPerfTier', 'high');
      window.addEventListener('error', e => console.error('[Prism runtime]', e.message));
      window.addEventListener('unhandledrejection', e => console.error('[Prism rejection]', String(e.reason?.stack || e.reason)));
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    try {
      await guest(page);
      await ready(page);
      assert.equal(await page.locator('#pwCrystals').innerText(), '0/3');
      const firstArena = await page.locator('#pwArena canvas').boundingBox();
      assert.ok(firstArena.width >= 360, 'The garden fills the phone width');
      await page.locator('#pwMenu').click();
      await page.locator('#hub [data-action=catalog]').click();
      assert.match(await page.locator('#prismEntryProgress').innerText(), /12/);
      assert.doesNotMatch(await page.locator('#btnPrismPlay').innerText(), /ENGINE/);
      // A real preference stays usable in-session when storage is unavailable,
      // with a visible retry instead of an unhandled rejected event listener.
      await page.locator('#btnSettings').click();
      await page.evaluate(() => {
        window.originalPreferenceWrite = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (key === 'scs_save:guest') throw new DOMException('Fixture storage full', 'QuotaExceededError');
          return window.originalPreferenceWrite.call(this, key, value);
        };
      });
      try {
        await page.locator('#toggleMotion').check();
        await page.waitForSelector('#settingsSaveNotice:not([hidden])');
        assert.equal(await page.evaluate(() => document.body.hasAttribute('data-reduced-motion')), true);
        assert.ok(await page.locator('#btnSettingsRetrySave').evaluate(el => {
          const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight;
        }), 'The save failure recovery action is actually in the viewport');
      } finally {
        await page.evaluate(() => { Storage.prototype.setItem = window.originalPreferenceWrite; delete window.originalPreferenceWrite; });
      }
      await page.screenshot({ path: resolve(out, `${name}-settings-save-retry.png`) });
      await page.locator('#btnSettingsRetrySave').click();
      await page.waitForSelector('#settingsSaveNotice', { state: 'hidden' });
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('scs_save:guest')).settings.reducedMotion), true);
      await page.locator('#toggleMotion').uncheck();
      await page.locator('#settings .btn-back-bottom').click();
      await open(page);
      assert.equal(await page.locator('[data-pw-level]:not(:disabled)').count(), 1, 'Only the first puzzle is unlocked');
      assert.equal(await page.locator('.pw-level-name').count(), 12, 'Every puzzle has a visible authored title');
      assert.deepEqual(await page.locator('.pw-world-art [data-pw-region]').evaluateAll(nodes => nodes.map(n => [Number(n.dataset.pwRegion), Number(n.dataset.restored)]).sort((a, b) => a[0] - b[0])), [[0, 0], [1, 0], [2, 0]], 'A fresh map has no invented restoration');
      await page.screenshot({ path: resolve(out, `${name}-map-new.png`) });
      await page.locator('#pwContinue').click(); await ready(page);
      await page.locator('#pwLeft').click();
      assert.ok(parseInt(await page.locator('#pwAimReadout').innerText()) < 0, 'Aim buttons report their actual angle');
      await page.locator('#pwRight').click();
      assert.equal(await page.locator('#pwAimReadout').innerText(), '0°');
      await page.screenshot({ path: resolve(out, `${name}-first-light.png`) });
      // Naturally miss, undo, pause and resume the very same untouched puzzle.
      await shoot(page, { x: 30, y: 450 }, true);
      assert.equal(await page.locator('#pwPulses').innerText(), '2');
      assert.equal(await page.locator('#pwCharge .charged').count(), 2);
      await page.locator('#pwUndo').click();
      assert.equal(await page.locator('#pwPulses').innerText(), '3');
      assert.equal(await page.locator('#pwCharge .charged').count(), 3, 'Undo restores the visible pulse reserve as well as the number');
      await page.locator('#pwPause').click();
      await page.waitForSelector('#pwResume');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#pwDialog', { state: 'hidden' });
      assert.equal(await page.locator('#pwPulses').innerText(), '3');
      await page.locator('#pwFire').focus();
      await page.keyboard.press('Escape');
      await page.waitForSelector('#pwResume');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#pwDialog', { state: 'hidden' });

      for (let index = 0; index < PRISM_LEVELS.length; index++) {
        await ready(page);
        if (index === 10) {
          const hint = page.locator('.pw-hint');
          assert.equal(await hint.locator('.pw-tip').isVisible(), false, 'Late puzzle does not disclose its route by default');
          await hint.locator('summary').press('Enter');
          assert.equal(await hint.locator('.pw-tip').isVisible(), true);
          await hint.locator('summary').press('Enter');
        }
        if (index === 2) {
          const before = await page.evaluate(() => __SCS_QA__.prismRendererState());
          for (const color of ['amber', 'mint']) {
            const draws = await page.evaluate(() => __SCS_QA__.prismRendererState().draws);
            await page.locator(`[data-pw-color="${color}"]`).click();
            await page.waitForFunction(draws => __SCS_QA__.prismRendererState().draws > draws, draws);
          }
          assert.equal(await page.evaluate(() => __SCS_QA__.prismRendererState().uploads), before.uploads, 'Colour choice updates its exact symbol, never rebuilds static architecture/crystals');
        }
        if ([0, 3, 4, 6, 8, 10, 11].includes(index)) {
          await page.waitForTimeout(180); // Settle only the real screen-entry fade; the untouched puzzle remains ready.
          await page.screenshot({ path: resolve(out, `${name}-architecture-${index + 1}.png`), scale: 'css' });
        }
        for (const action of PRISM_SOLUTIONS[index]) {
          if (index === 1) await dragShot(page, action);
          else await shoot(page, action, index < 3);
        }
        await page.waitForFunction(() => Boolean(document.querySelector('#pwNext:not(:disabled)'))).catch(async err => {
          throw new Error(`${PRISM_LEVELS[index].id}: ${await page.locator('#pwStatus').innerText()} (${await page.locator('#pwAimReadout').innerText()})`, { cause: err });
        });
        const save = await stored(page), level = PRISM_LEVELS[index];
        assert.equal(save.levels[level.id].stars, 3, `${name}: earned ${level.id}`);
        assert.equal(save.levels[level.id].bestShots, level.par);
        assert.equal(await page.locator(`.pw-result-art [data-pw-region="${level.zone}"]`).getAttribute('data-restored'), String(PRISM_LEVELS.slice(0, index + 1).filter(l => l.zone === level.zone).length), 'Result artwork reflects the genuinely earned region');
        assert.match(await page.locator('.pw-efficiency').innerText(), new RegExp(String(level.par)), 'The earned result explains pulse efficiency');
        if ([1, 4, 7, 10, 11].includes(index)) await page.screenshot({ path: resolve(out, `${name}-earned-${index + 1}.png`) });
        receipts.push({ browser: name, level: level.id, ...save.levels[level.id] });
        await page.locator('#pwNext').click();
      }
      await page.waitForSelector('.pw-map-view');
      assert.equal(await page.locator('.pw-level--done').count(), 12);
      assert.deepEqual(await page.locator('.pw-world-art [data-pw-region]').evaluateAll(nodes => nodes.map(n => Number(n.dataset.restored))), [4, 4, 4]);
      assert.deepEqual(await page.locator('.pw-region-heading [data-pw-region]').evaluateAll(nodes => nodes.map(n => Number(n.dataset.restored))), [4, 4, 4], 'Region cards and map share earned states');
      await page.screenshot({ path: resolve(out, `${name}-map-restored.png`) });
      const earned = JSON.stringify(await stored(page));
      // Replay cannot farm stars or mutate arcade currency.
      await page.locator('[data-pw-level="0"]').click(); await ready(page);
      await shoot(page, PRISM_SOLUTIONS[0][0]);
      await page.waitForFunction(() => Boolean(document.querySelector('#pwNext:not(:disabled)')));
      assert.equal(JSON.stringify(await stored(page)), earned);
      // Natural loss and undo do not consume reserve lives or award anything.
      await page.locator('#pwResultReplay').click(); await ready(page);
      for (let i = 0; i < 3; i++) await shoot(page, { x: 30, y: 450 });
      await page.waitForSelector('#pwResultUndo');
      await page.locator('#pwResultUndo').click();
      assert.equal(await page.locator('#pwPulses').innerText(), '1');
      await shoot(page, PRISM_SOLUTIONS[0][0]);
      await page.waitForSelector('#pwNext:not(:disabled)');
      assert.equal(JSON.stringify(await stored(page)), earned, 'A worse replay keeps the existing best');
      // Inject a storage failure, not a score/result. The win is still played.
      await page.locator('#pwResultReplay').click(); await ready(page);
      await page.evaluate(() => {
        window.prismOriginalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (key === 'scs_save:guest') throw new DOMException('Test storage full', 'QuotaExceededError');
          return window.prismOriginalSetItem.call(this, key, value);
        };
      });
      await shoot(page, PRISM_SOLUTIONS[0][0]);
      await page.waitForSelector('#pwRetrySave');
      assert.equal(await page.locator('#pwNext').isDisabled(), true);
      await page.evaluate(() => { Storage.prototype.setItem = window.prismOriginalSetItem; delete window.prismOriginalSetItem; });
      await page.locator('#pwRetrySave').click();
      await page.waitForSelector('#pwNext:not(:disabled)');
      assert.equal(JSON.stringify(await stored(page)), earned);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(JSON.stringify(await stored(page)), earned, 'Earned progress survives reload');
      await page.locator('#hub [data-action=worlds]').click();
      // Reflow: normal and doubled root text, narrow phone and wide desktop.
      for (const [width, height, font] of [[320, 640, 16], [360, 640, 32], [915, 412, 16], [1440, 900, 16]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(font => { document.documentElement.style.fontSize = `${font}px`; }, font);
        assert.ok(await page.evaluate(() => document.querySelector('#prism').scrollWidth <= innerWidth + 1), `${name}: map reflows at ${width}px / ${font}px`);
        await page.locator('[data-pw-level="4"]').click(); await ready(page);
        assert.ok(await page.evaluate(() => document.querySelector('#prism').scrollWidth <= innerWidth + 1), `${name}: game reflows at ${width}px / ${font}px`);
        if (width === 320) assert.ok(await page.locator('#pwFire').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight), 'Launch remains above the fold on a small phone');
        await page.screenshot({ path: resolve(out, `${name}-${width}-${font}.png`), fullPage: true });
        await page.locator('#pwBack').click();
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await page.setViewportSize({ width: 412, height: 915 });
      await page.locator('#pwBack').click();
      await page.locator('#hub [data-action=catalog]').click();
      await page.waitForSelector('#home.active');
      assert.match(await page.locator('#prismEntryProgress').innerText(), /36\/36/);
      assert.equal(await page.locator('#prismEntryArt [data-pw-region="2"]').getAttribute('data-restored'), '4', 'Home shares the final earned region');
      assert.equal(await page.locator('#prism canvas').count(), 0, 'Leaving releases the arena');
      // Previously earned data, but all visual state and code are loaded offline.
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      // Windows WebKit's context-level offline toggle fails navigation with
      // an internal browser error. For local tests cut the actual HTTP server
      // transport instead: the service worker must still supply every byte.
      if (name === 'webkit' && server) server.setNetworkAvailable(false);
      else await context.setOffline(true);
      await page.reload({ waitUntil: 'load' });
      await page.locator('#hub [data-action=resume]').click();
      await ready(page);
      assert.match(await page.locator('.pw-level-heading').innerText(), /01\s*\/\s*12/, 'Completed offline campaign replays directly from Home');
      await page.locator('#pwBack').click();
      await page.locator('[data-pw-level="4"]').click(); await ready(page);
      await shoot(page, PRISM_SOLUTIONS[4][0]);
      await page.waitForFunction(() => Boolean(document.querySelector('#pwNext:not(:disabled)')));
      assert.equal(JSON.stringify(await stored(page)), earned, 'Real offline replay is idempotent');
      if (name === 'webkit' && server) server.setNetworkAvailable(true);
      else await context.setOffline(false);

      // A shared late puzzle on a fresh profile is explicitly free play.
      const free = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'en-US' });
      await free.addInitScript(() => { localStorage.setItem('scsQa', '1'); localStorage.setItem('scsQaPerfTier', 'high'); });
      const shared = await free.newPage();
      shared.on('pageerror', e => errors.push(e.message));
      shared.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      await guest(shared, `${base}/?prism=light-weaver`);
      await ready(shared);
      assert.match(await shared.locator('.pw-level-heading').innerText(), /SHARED PUZZLE/);
      await shoot(shared, PRISM_SOLUTIONS[10][0]);
      await shared.waitForSelector('#pwNext');
      assert.equal(await stored(shared), null, 'Shared challenge cannot award campaign progress');
      assert.equal(await shared.locator('.pw-result-art [data-pw-region="2"]').getAttribute('data-restored'), '0', 'Shared wins never fake regional restoration');
      await free.close();
      assert.deepEqual(errors, [], `${name}: zero runtime/console errors`);
      console.log(`PASS ${name}: 12 genuinely completed levels, replay/reload/offline, touch, pause, reflow and shared challenge`);
    } finally { await context.close(); await browser.close(); }
  }
  await writeFile(resolve(out, 'earned-campaign.json'), JSON.stringify(receipts, null, 2));
} finally { await server?.close(); }
