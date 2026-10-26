import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const externalBase = process.env.SCS_BASE || '';
const server = externalBase ? null : await startStaticServer({ root: 'docs', port: 0 });
const base = externalBase || server.baseUrl;
const browser = await chromium.launch({ headless: true });
const modes = ['klassik', 'beginner', 'expert', 'mathe', 'wissen', 'memo', 'sequenz', 'stroop', 'fokus', 'chaos'];

async function startGame(page, mode) {
  await page.evaluate(mode => {
    globalThis.__SCS_QA__.setGameSelection(mode, mode === 'sequenz' ? 'endless' : 'blitz');
    document.querySelector('#btnPlay').click();
  }, mode);
  await page.waitForFunction(mode => {
    if (document.querySelector('#tutorial.active')) document.querySelector('#btnTutorialSkip')?.click();
    if (document.querySelector('#modeInstructionOverlay.active')) document.querySelector('#btnStartAfterInstruction')?.click();
    const state = globalThis.__SCS_QA__.gameState();
    return document.querySelector('#game.active') && state?.running && (mode === 'sequenz' || state.stimulusId != null)
      && globalThis.__SCS_QA__.arcadeRendererState()?.ready;
  }, mode, { timeout: 15000, polling: 150 });
  await page.waitForTimeout(180);
}

async function review(viewport) {
  const label = `${viewport.width}×${viewport.height}`;
  const out = process.env.SCS_REVIEW_OUT ? resolve(process.env.SCS_REVIEW_OUT, `modes-${viewport.width}`) : '';
  if (out) mkdirSync(out, { recursive: true });
  const context = await browser.newContext({
    viewport, deviceScaleFactor: 2, locale: 'de-DE',
    isMobile: viewport.width < 768, hasTouch: viewport.width < 768,
  });
  await context.addInitScript(() => {
    localStorage.setItem('scsQa', '1');
    localStorage.setItem('scsQaPerfTier', 'high');
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('#btnGuest').waitFor({ state: 'visible' });
    await page.locator('#btnGuest').click();
    await page.locator('#home.active').waitFor();
    await page.waitForTimeout(1000);
    for (let i = 0; i < 3; i++) {
      const hint = page.locator('.onboarding-overlay.active .onboarding-btn-ok');
      if (!await hint.isVisible()) break;
      await hint.click();
      await page.waitForTimeout(500);
    }

    const home = await page.evaluate(() => {
      const button = document.querySelector('#btnPlay');
      const r = button.getBoundingClientRect();
      return {
        reachable: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('#btnPlay') === button,
        hintFont: parseFloat(getComputedStyle(document.querySelector('.play-type-sub')).fontSize),
        hintVisible: getComputedStyle(document.querySelector('.play-type-sub')).display !== 'none',
        sheetFits: document.querySelector('#homeBottomSheet').scrollHeight <= document.querySelector('#homeBottomSheet').clientHeight + 2,
      };
    });
    assert.ok(home.reachable && home.sheetFits && home.hintVisible && home.hintFont >= 12, `${label}: readable, reachable home`);

    await page.locator('#btnAllModes').click();
    assert.equal(await page.locator('[data-mode-choice]').count(), 10, `${label}: complete catalog`);
    assert.equal(await page.evaluate(() => document.querySelector('#appMain').inert), true, `${label}: modal isolates background`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement.id === 'btnAllModes');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'btnAllModes', `${label}: modal restores focus`);
    await page.locator('#btnAllModes').click();
    await page.locator('[data-mode-choice="expert"]').click();
    assert.equal(await page.locator('#btnPlay').isDisabled(), true, `${label}: locked selection cannot start another mode`);
    await page.locator('#btnAllModes').click();
    await page.locator('[data-mode-choice="beginner"]').click();
    assert.equal(await page.locator('#btnPlay').isEnabled(), true);
    assert.equal(await page.locator('.hero-slide[data-pos="current"]').getAttribute('data-mode'), 'beginner');

    const themes = await page.evaluate(() => {
      const result = {};
      for (const theme of ['default', 'ocean', 'forest', 'neon', 'sunset', 'cosmic', 'retro', 'crystal']) {
        document.body.className = document.body.className.replace(/\btheme-\w+/g, '').trim();
        if (theme !== 'default') document.body.classList.add(`theme-${theme}`);
        result[theme] = {
          home: getComputedStyle(document.querySelector('#home')).backgroundColor,
          action: getComputedStyle(document.querySelector('#btnPlay')).backgroundImage,
          game: getComputedStyle(document.querySelector('#game')).backgroundColor,
        };
      }
      document.body.className = document.body.className.replace(/\btheme-\w+/g, '').trim();
      return result;
    });
    for (const [theme, styles] of Object.entries(themes)) {
      if (theme === 'default') continue;
      assert.notEqual(styles.home, themes.default.home, `${label}: ${theme} home surface`);
      assert.notEqual(styles.game, themes.default.game, `${label}: ${theme} game surface`);
      assert.notEqual(styles.action, themes.default.action, `${label}: ${theme} action`);
    }

    await page.locator('#btnSettings').click();
    await page.waitForTimeout(500);
    const controls = await page.evaluate(() => {
      const slider = document.querySelector('#rangeSfxVolume').getBoundingClientRect();
      const row = document.querySelector('#rangeSfxVolume').closest('label').getBoundingClientRect();
      return { sliderHeight: slider.height, sliderWidth: slider.width, rowWidth: row.width, selectHeight: document.querySelector('#selectLang').getBoundingClientRect().height };
    });
    assert.ok(controls.sliderHeight >= 44 && controls.selectHeight >= 44 && controls.sliderWidth >= controls.rowWidth - 36, `${label}: full-size form controls`);
    assert.equal(await page.locator('#toggleDepth').isChecked(), false, `${label}: background depth is opt-in`);
    await page.locator('#toggleDepth').check();
    await page.waitForFunction(() => Object.values(localStorage).some(value => {
      try { return JSON.parse(value)?.settings?.arenaDepth === true; } catch { return false; }
    }));
    await page.locator('#rangeSfxVolume').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#sfxVolumeValue').textContent(), '5%');
    assert.equal(await page.locator('#rangeSfxVolume').getAttribute('aria-valuetext'), '5%');
    await page.locator('#toggleSound').uncheck();
    assert.equal(await page.locator('#rangeSfxVolume').isDisabled(), true);
    await page.locator('#toggleSound').check();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#toggleMotion').check();
    await page.locator('#toggleMotion').uncheck();
    assert.ok(await page.evaluate(() => document.body.hasAttribute('data-reduced-motion')), `${label}: OS reduced motion survives toggle`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => !document.body.hasAttribute('data-reduced-motion'));
    await page.locator('#settings .btn-back-bottom').click();

    const worldPaths = new Set();
    for (const mode of modes) {
      await startGame(page, mode);
      const layout = await page.evaluate(() => {
        const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        const overlaps = (a, b) => a.x < b.right - 1 && a.right > b.x + 1 && a.y < b.bottom - 1 && a.bottom > b.y + 1;
        const targets = [...document.querySelectorAll('#game .corner-shape')].filter(e => getComputedStyle(e).display !== 'none').map(rect);
        const center = rect(document.querySelector('#centerPlatform'));
        const hud = rect(document.querySelector('.hud-scores'));
        const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
        return {
          targetCount: targets.length,
          withinViewport: targets.every(r => r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.width >= 48 && r.height >= 48),
          separated: targets.every((r, i) => !overlaps(r, center) && !overlaps(r, hud) && targets.slice(i + 1).every(other => !overlaps(r, other))),
          centerAligned: Math.abs(center.x + center.width / 2 - innerWidth / 2) < 1,
          uniqueIds: new Set(ids).size === ids.length,
          ambientDots: document.querySelectorAll('#game .ambient-particle').length,
          world: document.querySelector('#resonanceStage').dataset.world,
          worldPath: document.querySelector('#resonanceStage .arena-blueprint path')?.getAttribute('d'),
          noHint: !document.querySelector('#resonanceStage').dataset.confirmedDirection && !document.querySelector('#game').dataset.resonanceTarget,
          localPaints: [...document.querySelectorAll('#game .material-shape')].every(svg => ['fill', 'stroke'].every(attribute => {
            const ref = svg.querySelector('[data-shape-light]')?.getAttribute(attribute)?.match(/^url\(#(.+)\)$/)?.[1];
            return Boolean(ref && svg.contains(document.getElementById(ref)));
          })),
          labelFont: parseFloat(getComputedStyle(document.querySelector('.hud-label')).fontSize),
        };
      });
      assert.ok(layout.withinViewport && layout.separated && layout.centerAligned && layout.uniqueIds && layout.localPaints && layout.noHint && layout.labelFont >= 12, `${label} ${mode}: ${JSON.stringify(layout)}`);
      assert.equal(layout.targetCount, mode === 'expert' ? 8 : 4);
      assert.equal(layout.ambientDots, 0, `${label}: studio lights replace, not stack on, floating dots`);
      assert.equal(layout.world, mode);
      assert.ok(layout.worldPath);
      worldPaths.add(layout.worldPath);

      if (mode === 'klassik') {
        const depth = await page.evaluate(async () => {
          const targets = [...document.querySelectorAll('.corner-shape,#centerPlatform')];
          const rects = () => targets.map(el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
          const before = JSON.stringify(rects());
          document.querySelector('#game').dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth, clientY: innerHeight, isPrimary: true }));
          await new Promise(resolve => requestAnimationFrame(resolve));
          const depth = __SCS_QA__.arcadeRendererState().depth;
          return { moved: depth.x !== 0 || depth.y !== 0, fixed: before === JSON.stringify(rects()), depth };
        });
        assert.ok(depth.moved && depth.fixed, `${label}: saved depth setting moves only background architecture`);
        assert.ok(Math.abs(depth.depth.x) <= 4 && Math.abs(depth.depth.y) <= 3);
        const confirmation = await page.evaluate(() => {
          const game = document.querySelector('#game');
          const before = game.getBoundingClientRect();
          const state = globalThis.__SCS_QA__.gameState();
          document.querySelector(`.corner-shape[data-dir="${state.direction}"]`).click();
          return { direction: state.direction, stimulusId: state.stimulusId, confirmation: document.querySelector('#resonanceStage').dataset.confirmedDirection, shift: Math.abs(game.getBoundingClientRect().x - before.x), correct: globalThis.__SCS_QA__.gameState().correct };
        });
        assert.equal(confirmation.confirmation, confirmation.direction);
        assert.equal(confirmation.correct, 1);
        assert.equal(confirmation.shift, 0, `${label}: no screen shake on hit`);
        await page.evaluate(() => document.querySelector('#btnPause').click());
        assert.equal(await page.locator('#resonanceStage').getAttribute('data-live'), null, `${label}: arena stops with gameplay`);
        assert.equal(await page.locator('.arena-scenery').evaluate(el => el.style.transform), '', `${label}: pause clears optional depth`);
        assert.deepEqual(await page.evaluate(() => __SCS_QA__.arcadeRendererState().depth), { x: 0, y: 0 }, `${label}: pause resets engine architecture`);
        assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().loopRunning), false);
        await page.evaluate(() => document.querySelector('#btnResume').click());
        assert.notEqual(await page.locator('#resonanceStage').getAttribute('data-live'), null, `${label}: arena resumes with gameplay`);
        if (viewport.width < 768) {
          // A just-answered stimulus can remain in the snapshot until its
          // scheduled successor. A non-null ID alone is not a new answer window.
          await page.waitForFunction(previous => {
            const state = globalThis.__SCS_QA__.gameState();
            return state.running && !state.paused && state.stimulusId != null && state.stimulusId !== previous;
          }, confirmation.stimulusId);
          await page.waitForTimeout(120);
          const gesture = await page.evaluate(() => {
            const state = globalThis.__SCS_QA__.gameState();
            const center = el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
            return { from: center(document.querySelector('#centerPlatform')), to: center(document.querySelector(`.corner-shape[data-dir="${state.direction}"]`)), correct: state.correct };
          });
          const cdp = await context.newCDPSession(page);
          try {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [gesture.from] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (gesture.from.x + gesture.to.x) / 2, y: (gesture.from.y + gesture.to.y) / 2 }] });
            await page.waitForTimeout(40);
            assert.ok(await page.evaluate(() => {
              const depth = __SCS_QA__.arcadeRendererState().depth;
              return depth.x !== 0 || depth.y !== 0;
            }), `${label}: native touch reaches optional engine depth`);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [gesture.to] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await page.waitForFunction(before => globalThis.__SCS_QA__.gameState().correct === before + 1, gesture.correct, { timeout: 1500 });
            assert.equal(await page.evaluate(() => globalThis.__SCS_QA__.gameState().correct), gesture.correct + 1, `${label}: depth cannot interfere with real touch answers`);
            assert.equal(await page.locator('.arena-scenery').evaluate(el => el.style.transform), '', `${label}: release returns scenery to neutral`);
            assert.deepEqual(await page.evaluate(() => __SCS_QA__.arcadeRendererState().depth), { x: 0, y: 0 }, `${label}: release resets engine depth`);
          } finally { await cdp.detach(); }
        }
      }
      if (out) {
        // Capture only after input assertions: screenshot encoding must not
        // consume the answer window or race a timeout into a fresh stimulus.
        await page.waitForFunction(mode => mode === 'sequenz' || globalThis.__SCS_QA__.gameState().stimulusId != null, mode);
        await page.screenshot({ path: resolve(out, `${mode}.png`), animations: 'disabled' });
      }
      if (mode !== modes.at(-1)) {
        await page.evaluate(() => document.querySelector('#btnPauseQuit').click());
        await page.locator('#home.active').waitFor();
      }
    }
    assert.equal(worldPaths.size, 10, `${label}: all ten modes have distinct architecture`);
    await page.evaluate(() => { globalThis.__SCS_QA__.setContinued(true); globalThis.__SCS_QA__.forceGameOver(); });
    await page.locator('#results.active').waitFor();
    await page.waitForTimeout(1400);
    const results = await page.evaluate(() => ({
      stats: getComputedStyle(document.querySelector('.results-grid')).gridTemplateColumns.split(' ').length,
      actions: getComputedStyle(document.querySelector('.results-buttons')).gridTemplateColumns.split(' ').length,
      oldDirection: document.querySelector('#resonanceStage').dataset.confirmedDirection,
    }));
    assert.equal(results.stats, 2);
    assert.equal(results.actions, 2);
    assert.equal(results.oldDirection, undefined);

    await page.locator('#btnHome').click();
    await page.locator('#btnSettings').click();
    await page.locator('#toggleColorblind').check();
    await page.locator('#toggleMotion').check();
    await page.locator('#selectLang').selectOption('en');
    await page.locator('#settings .btn-back-bottom').click();
    await page.evaluate(() => { document.body.dataset.perfMode = 'low'; });
    await startGame(page, 'klassik');
    const reduced = await page.evaluate(() => ({
      motion: document.body.hasAttribute('data-reduced-motion'),
      animationMs: parseFloat(getComputedStyle(document.querySelector('#centerShape')).animationDuration) * 1000,
      material: Boolean(document.querySelector('#centerShape .material-shape')),
      neutral: !document.querySelector('#resonanceStage').dataset.confirmedDirection,
      color: document.querySelector('#centerShape g[fill]')?.getAttribute('fill'),
    }));
    assert.ok(reduced.motion && reduced.animationMs <= 1 && reduced.material && reduced.neutral, `${label}: reduced-motion low tier preserves the stimulus`);
    assert.ok(['#FF6348', '#A55EEA', '#A4B0BE', '#18DCFF'].includes(reduced.color), `${label}: colorblind material palette`);
    await page.evaluate(() => document.querySelector('#btnPauseQuit').click());
    assert.deepEqual(errors, [], `${label}: runtime errors`);
    console.log(`PASS ${label}: catalog, themes, forms, motion, 10 worlds, persisted/native depth with fixed targets, feedback, results, English/colorblind/low tier`);
  } finally {
    await context.close();
  }
}

try {
  // Each viewport owns a real CDP touch device and a live answer deadline.
  // Do not run competing touch/screenshot sessions against one browser at once.
  for (const viewport of [{ width: 360, height: 640 }, { width: 412, height: 915 }, { width: 1440, height: 900 }]) await review(viewport);
  console.log('Presentation release tests passed.');
} finally {
  await browser.close();
  if (server) await server.close();
}
