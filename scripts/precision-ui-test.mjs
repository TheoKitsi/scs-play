/** Compiled-build coverage for the shared art direction and inert shop previews.
 * CSS theme fixtures do not write save data. Wheel spins use real guest rules. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const server = process.env.SCS_BASE ? null : await startStaticServer({ root: 'docs', port: 0 });
const base = process.env.SCS_BASE || server.baseUrl;
const browser = await chromium.launch({ headless: true });
const themes = ['default', 'neon', 'ocean', 'sunset', 'forest', 'cosmic', 'retro', 'crystal'];
const trails = ['default', 'fire', 'ice', 'rainbow', 'electric', 'stardust'];
try {
  for (const view of [{ width: 412, height: 915 }, { width: 360, height: 640 }, { width: 1440, height: 900 }]) {
    const reduced = view.width === 360;
    const context = await browser.newContext({ viewport: view, deviceScaleFactor: 2, locale: 'de-DE', isMobile: view.width < 768, hasTouch: view.width < 768, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => {
      localStorage.setItem('scsQa', '1');
      localStorage.setItem('scsQaPerfTier', 'high');
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      globalThis.__wheelPaints = 0;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas.id === 'wheelCanvas') globalThis.__wheelPaints++;
        return clear.apply(this, args);
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const out = process.env.SCS_REVIEW_OUT ? resolve(process.env.SCS_REVIEW_OUT, `precision-${view.width}`) : '';
    if (out) mkdirSync(out, { recursive: true });
    const shot = async name => { if (out) await page.screenshot({ path: resolve(out, `${name}.png`), animations: 'disabled' }); };
    const balances = () => page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('scs_save:guest'));
      return Object.fromEntries(['fire', 'lives', 'totalXP', 'purchases', 'activeTheme', 'activeTrail', 'settings'].map(key => [key, data[key]]));
    });
    try {
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.locator('#btnGuest').click();
      await page.locator('#home.active').waitFor();
      await page.waitForTimeout(1000);
      for (let i = 0; i < 3; i++) {
        const hint = page.locator('.onboarding-overlay.active .onboarding-btn-ok');
        if (!await hint.isVisible()) break;
        await hint.click(); await page.waitForTimeout(450);
      }
      await page.locator('#btnStore').click();
      await page.locator('#store.active').waitFor();
      const before = await balances();
      const expected = await page.evaluate(themes => {
        const original = document.body.className;
        const results = {};
        try {
          for (const id of themes) {
            document.body.className = original.replace(/\btheme-\w+/g, '').trim();
            if (id !== 'default') document.body.classList.add(`theme-${id}`);
            const css = getComputedStyle(document.body);
            results[id] = ['--bg', '--surface', '--primary'].map(token => css.getPropertyValue(token).trim());
          }
        } finally { document.body.className = original; }
        return results;
      }, themes);
      for (const [type, ids] of [['themes', themes], ['trails', trails]]) {
        if (type === 'trails') await page.locator('#shopTabTrails').click();
        for (const id of ids) {
          const button = page.locator(`[data-preview-id="${id}"]`);
          await button.click();
          await page.locator('#designPreviewOverlay.active').waitFor();
          await page.waitForFunction(() => document.activeElement.id === 'btnCloseDesignPreview');
          const state = await page.locator('#designPreviewScene .design-preview').evaluate(el => {
            const css = getComputedStyle(el), rect = el.getBoundingClientRect();
            const close = document.querySelector('#btnCloseDesignPreview').getBoundingClientRect();
            return { palette: ['--bg', '--surface', '--primary'].map(token => css.getPropertyValue(token).trim()),
              isolated: document.querySelector('#appMain').inert, within: rect.x >= 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight,
              target: close.width >= 44 && close.height >= 44, static: el.getAnimations({ subtree: true }).length === 0,
              paints: [...el.querySelectorAll('[id]')].every(node => document.querySelectorAll(`[id="${node.id}"]`).length === 1) };
          });
          assert.deepEqual(state.palette, expected[type === 'themes' ? id : 'default'], `${type}/${id}: preview uses real theme declarations`);
          for (const key of ['isolated', 'within', 'target', 'static', 'paints']) assert.equal(state[key], true, `${view.width} ${type}/${id}: ${key}`);
          assert.match(await page.locator('#designPreviewTitle').textContent(), /^Vorschau:/);
          await page.keyboard.press('Tab');
          assert.equal(await page.evaluate(() => document.activeElement.id), reduced ? 'btnCloseDesignPreview' : 'btnPlayDesignDemo');
          if (id === 'ocean' || id === 'electric') await shot(`preview-${id}`);
          if (type === 'themes' && id === 'neon') await page.goBack();
          else await page.keyboard.press('Escape');
          await page.locator('#designPreviewOverlay').waitFor({ state: 'hidden' });
          await page.waitForFunction(id => document.activeElement?.dataset.previewId === id, id);
          assert.equal(await page.locator('#store.active').count(), 1, 'Back dismisses preview before navigating');
        }
      }
      assert.deepEqual(await balances(), before, 'Previewing locked/owned designs must not spend, equip or alter settings');
      await page.locator('#store .btn-back-bottom').click();
      await page.locator('#btnWheel').click();
      await page.locator('#wheelOverlay.active').waitFor();
      const painted = await page.evaluate(() => globalThis.__wheelPaints);
      assert.equal(await page.locator('#wheelCanvas').getAttribute('width'), '600', 'Wheel uses a capped 2x backing bitmap');
      assert.match(await page.locator('#wheelCanvas').getAttribute('aria-label'), /XP/);
      await page.locator('#btnWheelSpin').click();
      await page.locator('.wheel-result-card.revealed').waitFor({ timeout: reduced ? 1500 : 11000 });
      assert.equal(await page.evaluate(() => globalThis.__wheelPaints), painted, 'Normal and reduced-motion spinning transform the same bitmap without repaint');
      assert.equal(await page.locator('#btnWheelSpin').isDisabled(), true, 'The original one-spin rule is unchanged');
      await shot('wheel-result');
      await page.locator('#btnWheelClose').click();
      assert.deepEqual(errors, []);
      console.log(`PASS ${view.width}: 14 inert design previews, real theme parity, balances/locks, Escape/Back/focus, static geometry and cached ${reduced ? 'reduced-motion' : 'normal'} wheel`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  if (server) await server.close();
}
