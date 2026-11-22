import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const server = await startStaticServer({ root: 'docs', port: 0 });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('scsQa', '1'));
  const touch = await page.context().newCDPSession(page);
  async function stroke(dx, dy) {
    await page.locator('#pwArena .pw-loading').waitFor({ state: 'detached' });
    const r = await page.locator('#pwArena canvas').boundingBox();
    const x = r.x + r.width / 2, y = r.y + r.height * 508 / 560;
    for (const [type, scale] of [['touchStart',0],['touchMove',.5],['touchMove',1],['touchEnd',1]]) {
      await touch.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x:x + dx*scale, y:y + dy*scale }] });
    }
    await page.locator('#pwNext:not(:disabled)').waitFor();
  }
  await page.goto(server.baseUrl);
  await page.waitForSelector('#pwArena canvas');
  await stroke(0, -40);
  await page.setViewportSize({width:320,height:568});
  await page.evaluate(()=>{document.documentElement.style.fontSize='24px';});
  const next = await page.locator('#pwNext').boundingBox();
  assert.ok(next.y >= 0 && next.y + next.height <= 568 && next.height >= 44, 'Next stays in view at 150% text');
  await page.setViewportSize({width:360,height:640});
  await page.reload();
  await page.locator('#hub [data-action=resume]').tap();
  await page.waitForSelector('#pwArena canvas');
  assert.match(await page.locator('.pw-level-heading').innerText(), /Hinter dem Stein/);
  await stroke(10, -40);
  await page.locator('#pwNext').tap();
  await page.locator('#pwQuickColors').tap();
  await page.waitForFunction(() => globalThis.__SCS_QA__.gameState().stimulusId != null);
  const task = await page.evaluate(() => __SCS_QA__.gameState());
  const target = page.locator(`#game .corner-shape[data-dir="${task.direction}"]`);
  const r = await target.boundingBox();
  assert.ok(r.width >= 88 && r.y > 320 && r.y + r.height < 640, 'Thumb controls in the lower half of the phone');
  await target.tap();
  await page.waitForFunction(() => __SCS_QA__.gameState().correct > 0);
  const missed = await (await page.waitForFunction(id=>{
    const state = __SCS_QA__.gameState();
    if (!state.direction || state.stimulusId === id) return false;
    const buttons = [...document.querySelectorAll('#game .corner-shape')].filter(b=>b.offsetParent);
    const picked = buttons.find(b=>b.dataset.dir!==state.direction);
    return {dir:picked.dataset.dir, picked:picked.getAttribute('aria-label'),
      correct:buttons.find(b=>b.dataset.dir===state.direction).getAttribute('aria-label')};
  },task.stimulusId)).jsonValue();
  await page.locator(`#game .corner-shape[data-dir="${missed.dir}"]`).tap();
  await page.locator('#results.active #btnOneMore').waitFor({ timeout: 50000 });
  await page.locator('#resDetails summary').tap();
  assert.equal(await page.locator('#reviewChoice').innerText(),missed.picked);
  assert.equal(await page.locator('#reviewSolution').innerText(),missed.correct);
  await page.locator('#resDetails summary').tap();
  await page.locator('#btnOneMore').tap();
  await page.waitForFunction(() => __SCS_QA__.gameState().running && document.querySelector('#game.active[data-quick-colors]'));
  assert.deepEqual(errors, []);
  console.log('PASS: fresh short touch stroke, saved bloom, mirror, timed one-thumb round and replay at 360×640');
} finally { await browser.close(); await server.close(); }
