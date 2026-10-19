/** Compiled UI, no seeded progress or modified clocks. Root-font enlargement
 * is a layout stress test, not a claim of physical system-text/TalkBack QA.
 * SCS_BROWSERS=chromium,firefox,webkit expands the default Chromium gate. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const server = process.env.SCS_BASE ? null : await startStaticServer({ root: 'docs', port: 0 });
const base = process.env.SCS_BASE || server.baseUrl;
const engines = { chromium, firefox, webkit };

async function enter(page) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('#btnGuest').click();
  await page.locator('#home.active').waitFor();
  await page.waitForTimeout(1000);
  for (let i = 0; i < 3; i++) {
    const hint = page.locator('.onboarding-overlay.active .onboarding-btn-ok');
    if (!await hint.isVisible()) break;
    await hint.click(); await page.waitForTimeout(450);
  }
}

async function noClippedText(page, selector, label) {
  const result = await page.locator(selector).evaluate(root => {
    const clipped = [];
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (!el.getClientRects().length || el.closest('[hidden],[aria-hidden="true"],.sr-only')) continue;
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        let scrollableY = false;
        for (let parent = el; parent && parent !== document.body; parent = parent.parentElement) {
          const css = getComputedStyle(parent), box = parent.getBoundingClientRect();
          if (/auto|scroll/.test(css.overflowY) && parent.scrollHeight > parent.clientHeight + 1) scrollableY = true;
          const x = /hidden|clip/.test(css.overflowX) && (rect.left < box.left - 2 || rect.right > box.right + 2);
          const y = !scrollableY && /hidden|clip/.test(css.overflowY) && (rect.top < box.top - 2 || rect.bottom > box.bottom + 2);
          if (x || y) { clipped.push({ text: node.textContent.trim(), by: parent.id || parent.className, axis: x ? 'x' : 'y' }); break; }
        }
      }
    }
    return { clipped, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  assert.deepEqual(result.clipped, [], `${label}: text must reflow or scroll, not be clipped`);
  assert.equal(result.pageOverflow, false, `${label}: no page overflow`);
}

async function makeContext(browser, engine, viewport, lang = 'de') {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1024, ...(engine === 'firefox' ? {} : { isMobile: viewport.width < 1024 }), locale: `${lang}-${lang === 'de' ? 'DE' : 'US'}`, serviceWorkers: 'block' });
  await context.addInitScript(() => {
    localStorage.setItem('scsQa', '1'); localStorage.setItem('scsQaPerfTier', 'high');
    globalThis.__usabilityErrors = [];
    addEventListener('error', event => { if (event.message) globalThis.__usabilityErrors.push(event.message); });
    addEventListener('unhandledrejection', event => globalThis.__usabilityErrors.push(String(event.reason?.stack || event.reason)));
  });
  return context;
}

try {
  for (const engine of (process.env.SCS_BROWSERS || 'chromium').split(',')) {
    assert.ok(engines[engine], `Unknown browser: ${engine}`);
    const browser = await engines[engine].launch({ headless: true });
    try {
      for (const view of [
        { width: 320, height: 568, font: 16, lang: 'de' },
        { width: 320, height: 568, font: 32, lang: 'en' },
        { width: 360, height: 640, font: 32, lang: 'de' },
        { width: 1440, height: 900, font: 32, lang: 'en' },
        { width: 915, height: 412, font: 16, lang: 'de' },
        { width: 823, height: 390, font: 32, lang: 'en' },
      ]) {
        const label = `${engine} ${view.width}×${view.height} ${view.font}px ${view.lang}`;
        const context = await makeContext(browser, engine, view, view.lang);
        const page = await context.newPage();
        const errors = [], externalFonts = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFonts.push(request.url()); });
        const out = process.env.SCS_REVIEW_OUT ? resolve(process.env.SCS_REVIEW_OUT, `usability-${engine}`, `${view.width}-${view.font}-${view.lang}`) : '';
        if (out) mkdirSync(out, { recursive: true });
        const shot = async name => { if (out) await page.screenshot({ path: resolve(out, `${name}.png`), animations: 'disabled' }); };
        try {
          await enter(page);
          await page.evaluate(size => { document.documentElement.style.fontSize = `${size}px`; }, view.font);
          await page.waitForTimeout(250);
          assert.equal(await page.locator('#landscapeWarning').isVisible(), false, `${label}: home never orientation-blocked`);
          await noClippedText(page, '#home', `${label}/home`);
          await shot('home');
          await page.locator('#btnAllModes').click();
          await noClippedText(page, '#modePicker', `${label}/catalog`);
          assert.equal(await page.locator('.mode-choice .mode-artwork').count(), 10);
          assert.equal(await page.locator('.mode-choice').evaluateAll(choices => new Set(choices.map(el => el.querySelector('.mode-art-base').getAttribute('d'))).size), 10, 'Each mode has distinct illustrated silhouette');
          await page.locator('[data-mode-choice="wissen"]').click();
          await page.waitForTimeout(400);
          await noClippedText(page, '#home', `${label}/locked-mode`);
          await page.locator('#btnSettings').click();
          assert.equal(await page.locator('#landscapeWarning').isVisible(), false);
          if (view.width >= 1200) assert.ok(await page.locator('#settings>.screen-content').evaluate(el => el.getBoundingClientRect().width) >= 1000, 'Desktop settings must actually use the intended wide layout, not lose to selector specificity');
          for (const section of ['settingsAudio', 'settingsProfile', 'settingsDisplay']) {
            await page.locator(`[data-settings-section="${section}"]`).click();
            assert.equal(await page.evaluate(() => document.activeElement.parentElement.id), section, `${label}: section shortcut moves focus`);
          }
          await noClippedText(page, '#settings', `${label}/settings`);
          await shot('settings');
          await page.locator('#settings .btn-back-bottom').click();
          await page.locator('#btnStore').click();
          if (view.width >= 1200) assert.ok(await page.locator('#store>.screen-content').evaluate(el => el.getBoundingClientRect().width) >= 1000, 'Desktop shop must use its wider two-column layout');
          await noClippedText(page, '#store', `${label}/shop`);
          await page.locator('[data-preview-id="sunset"] .unlock-preview-label').waitFor({ state: 'visible' });
          await page.locator('[data-preview-id="sunset"]').click();
          await page.locator('#btnCloseDesignPreview').waitFor({ state: 'visible' });
          await noClippedText(page, '#designPreviewOverlay', `${label}/preview`);
          await shot('preview');
          await page.locator('#btnCloseDesignPreview').click();
          assert.equal(await page.locator('#designPreviewOverlay').isVisible(), false);
          await page.locator('#store .btn-back-bottom').click();
          for (const [button, screen] of [['#btnLeaderboard', 'leaderboard'], ['#btnAchievements', 'achievements']]) {
            await page.locator(button).click();
            await noClippedText(page, `#${screen}`, `${label}/${screen}`);
            await shot(screen);
            await page.locator(`#${screen} .btn-back-bottom`).click();
          }
          assert.deepEqual(externalFonts, []);
          assert.equal(await page.evaluate(async () => {
            const fonts = await Promise.all(['400 32px Outfit', '700 32px Outfit', '500 32px "Space Grotesk"', '700 32px "Space Grotesk"'].map(font => document.fonts.load(font, 'Größe Weiß')));
            const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 80;
            const ctx = canvas.getContext('2d');
            const density = font => {
              ctx.clearRect(0, 0, 300, 80); ctx.font = font; ctx.fillText('Settings', 0, 50);
              const bytes = ctx.getImageData(0, 0, 300, 80).data;
              let pixels = 0; for (let i = 3; i < bytes.length; i += 4) if (bytes[i] > 127) pixels++;
              return pixels;
            };
            return fonts.every(faces => faces.length > 0 && faces.every(face => face.status === 'loaded')) &&
              density('700 32px Outfit') > density('400 32px Outfit') * 1.2 &&
              density('700 32px "Space Grotesk"') > density('500 32px "Space Grotesk"') * 1.1;
          }), true, `${label}: local font decoding AND actually distinct regular/bold raster weights`);
          assert.deepEqual(errors, []);
          assert.deepEqual(await page.evaluate(() => globalThis.__usabilityErrors), []);
          console.log(`PASS ${label}: reflow, locked art, landscape menus, section focus, visible preview and local fonts`);
        } finally { await context.close(); }
      }

      // Real spin limits/payouts, deterministic prize choice only; never alter
      // currency, progress or clocks. Each independent guest gets one base spin.
      for (const finish of ['skip', 'motion', 'escape', 'back']) {
        const context = await makeContext(browser, engine, { width: 412, height: 915 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await enter(page);
          await page.locator('#btnWheel').click();
          const before = await page.evaluate(() => { Math.random = () => .01; return JSON.parse(localStorage.getItem('scs_save:guest')).lives; });
          await page.locator('#btnWheelSpin').click();
          await page.locator('#btnWheelSkip').waitFor({ state: 'visible' });
          assert.equal(await page.locator('#btnWheelSpin').isDisabled(), true);
          if (finish === 'motion') await page.emulateMedia({ reducedMotion: 'reduce' });
          else if (finish === 'skip') await page.locator('#btnWheelSkip').click();
          else if (finish === 'escape') await page.keyboard.press('Escape');
          else await page.goBack();
          await page.locator('#wheelResultCard.revealed').waitFor({ timeout: 2000 });
          await page.waitForFunction(() => !document.querySelector('#btnWheelClose').disabled);
          const after = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('scs_save:guest'));
            return { lives: data.lives, spins: data.wheelSpinsToday, animations: document.querySelector('#wheelPointer').getAnimations().filter(a => a.playState === 'running').length };
          });
          assert.equal(after.lives, before + 1, `${engine}/${finish}: already-picked prize awarded exactly once`);
          assert.equal(after.spins, 1);
          assert.equal(after.animations, 0);
          assert.equal(await page.locator('#btnWheelSpin').isDisabled(), true);
          const angle = await page.locator('#wheelCanvas').getAttribute('style');
          await page.waitForTimeout(100);
          assert.equal(await page.locator('#wheelCanvas').getAttribute('style'), angle, 'No stray animation frame after finish');
          await page.locator('#btnWheelClose').click();
          await page.locator('#home.active').waitFor();
          await page.waitForFunction(() => !history.state?.scsWheel);
          await page.locator('#btnWheel').click();
          assert.equal(await page.locator('#btnWheelSpin').isDisabled(), true, 'Reopening must preserve the used spin');
          await page.goBack();
          await page.locator('#wheelOverlay').waitFor({ state: 'hidden' });
          assert.equal(await page.locator('#home.active').count(), 1, 'Back from an idle root wheel stays in the app');
          assert.deepEqual(errors, []);
          assert.deepEqual(await page.evaluate(() => globalThis.__usabilityErrors), []);
          console.log(`PASS ${engine}: ${finish} ends wheel without reroll, duplicate reward or stranded animation`);
        } finally { await context.close(); }
      }

      const context = await makeContext(browser, engine, { width: 412, height: 915 });
      const page = await context.newPage();
      try {
        await enter(page);
        await page.locator('#btnStore').click();
        await page.locator('[data-preview-id="ocean"]').click();
        await page.locator('#btnPlayDesignDemo').click();
        assert.ok(await page.locator('#designPreviewScene').evaluate(el => el.getAnimations({ subtree: true }).length) > 0);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => document.querySelector('#btnPlayDesignDemo').disabled && document.querySelector('#designPreviewScene').getAnimations({ subtree: true }).length === 0);
        await page.keyboard.press('Escape');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.locator('[data-preview-id="ocean"]').click();
        await page.locator('#btnPlayDesignDemo').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#designPreviewScene').evaluate(el => el.getAnimations({ subtree: true }).length), 0);
        await page.locator('#store .btn-back-bottom').click();
        await page.locator('#btnPlay').click();
        await page.waitForFunction(() => {
          document.querySelector('#tutorial.active #btnTutorialSkip')?.click();
          document.querySelector('#modeInstructionOverlay.active #btnStartAfterInstruction')?.click();
          return globalThis.__SCS_QA__?.gameState()?.stimulusId != null;
        }, null, { timeout: 15000 });
        await page.locator('#btnPause').click();
        const names = await page.evaluate(() => ({ center: document.querySelector('#centerPlatform').getAttribute('aria-label'), corners: [...document.querySelectorAll('#game .corner-shape')].filter(el => el.offsetParent).map(el => el.getAttribute('aria-label')) }));
        assert.match(names.center, /^Farbe: /);
        assert.equal(new Set(names.corners).size, 4);
        assert.ok(names.corners.every(name => /^(Oben|Unten) (links|rechts):/.test(name) && !/square|Quadrat/.test(name)));
        const pausedState = await page.evaluate(() => ({ state: globalThis.__SCS_QA__.gameState(), rects: [...document.querySelectorAll('#game .corner-shape')].filter(el => el.offsetParent).map(el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }) }));
        await page.locator('#btnPauseSettings').click();
        await page.locator('#toggleColorblind').check();
        await page.locator('#selectLang').selectOption('en');
        await page.locator('#settings .btn-back-bottom').click();
        await page.locator('#pauseOverlay.active').waitFor();
        const refreshed = await page.evaluate(() => ({ state: globalThis.__SCS_QA__.gameState(), center: document.querySelector('#centerPlatform').getAttribute('aria-label'), targets: [...document.querySelectorAll('#game .corner-shape')].filter(el => el.offsetParent).map(el => { const r = el.getBoundingClientRect(); return { color: el.dataset.color, label: el.getAttribute('aria-label'), rect: [r.x, r.y, r.width, r.height] }; }) }));
        assert.equal(refreshed.state.stimulusId, pausedState.state.stimulusId, 'Changing presentation must not create/skip an item');
        assert.equal(refreshed.state.correct, pausedState.state.correct);
        assert.equal(refreshed.state.paused, true);
        assert.deepEqual(refreshed.targets.map(target => target.rect), pausedState.rects, 'Palette/language refresh must preserve every hit area');
        assert.deepEqual(refreshed.targets.map(target => target.color).sort(), ['#FF6348', '#A55EEA', '#A4B0BE', '#18DCFF'].sort());
        assert.match(refreshed.center, /^Color: (coral|violet|gray|cyan)$/);
        assert.ok(refreshed.targets.every(target => /^(Upper|Lower) (left|right): (coral|violet|gray|cyan)$/.test(target.label)), 'Global localization must not replace rich target names with direction-only labels');
        await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
        await noClippedText(page, '#pauseOverlay', `${engine}/large-text-pause`);
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
        await page.locator('#btnResume').click();
        await page.setViewportSize({ width: 915, height: 412 });
        if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
          await page.waitForFunction(() => globalThis.__SCS_QA__.gameState().paused);
          assert.equal(await page.locator('#btnPauseSettings').isVisible(), true, 'Rotating a narrow arena pauses instead of blocking the escape controls');
          await page.locator('#btnPauseSettings').click();
          assert.equal(await page.locator('#landscapeWarning').isVisible(), false);
          await page.locator('[data-settings-section="settingsAudio"]').click();
          await page.locator('#settings .btn-back-bottom').click();
        }
        await page.setViewportSize({ width: 412, height: 915 });
        if (await page.locator('#pauseOverlay.active').isVisible()) await page.locator('#btnResume').click();
        // Explicit end-state fixture, separate from naturally earned rounds.
        await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; globalThis.__SCS_QA__.forceGameOver(); });
        await page.locator('#results.active').waitFor();
        await page.waitForTimeout(500);
        await noClippedText(page, '#results', `${engine}/large-text-results`);
        assert.deepEqual(await page.evaluate(() => globalThis.__usabilityErrors), []);
        console.log(`PASS ${engine}: bounded/cancelled demo, localized live color names, portrait-arena pause safety and enlarged pause/results`);
      } finally { await context.close(); }
    } finally { await browser.close(); }
  }
} finally { if (server) await server.close(); }
