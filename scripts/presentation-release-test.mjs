import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

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
    return document.querySelector('#game.active') && state?.running && (mode === 'sequenz' || state.stimulusId != null);
  }, mode, { timeout: 15000, polling: 150 });
  await page.waitForTimeout(180);
}

async function review(viewport) {
  const label = `${viewport.width}×${viewport.height}`;
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
          noHint: !document.querySelector('#resonanceStage').dataset.confirmedDirection && !document.querySelector('#game').dataset.resonanceTarget,
          labelFont: parseFloat(getComputedStyle(document.querySelector('.hud-label')).fontSize),
        };
      });
      assert.ok(layout.withinViewport && layout.separated && layout.centerAligned && layout.uniqueIds && layout.noHint && layout.labelFont >= 12, `${label} ${mode}: ${JSON.stringify(layout)}`);
      assert.equal(layout.targetCount, mode === 'expert' ? 8 : 4);

      if (mode === 'klassik') {
        const confirmation = await page.evaluate(() => {
          const game = document.querySelector('#game');
          const before = game.getBoundingClientRect();
          const state = globalThis.__SCS_QA__.gameState();
          document.querySelector(`.corner-shape[data-dir="${state.direction}"]`).click();
          return { direction: state.direction, confirmation: document.querySelector('#resonanceStage').dataset.confirmedDirection, shift: Math.abs(game.getBoundingClientRect().x - before.x), correct: globalThis.__SCS_QA__.gameState().correct };
        });
        assert.equal(confirmation.confirmation, confirmation.direction);
        assert.equal(confirmation.correct, 1);
        assert.equal(confirmation.shift, 0, `${label}: no screen shake on hit`);
      }
      if (mode !== modes.at(-1)) {
        await page.evaluate(() => document.querySelector('#btnPauseQuit').click());
        await page.locator('#home.active').waitFor();
      }
    }
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
    console.log(`PASS ${label}: catalog, themes, forms, motion, 10 mode layouts, feedback, results, English/colorblind/low tier`);
  } finally {
    await context.close();
  }
}

try {
  await Promise.all([{ width: 360, height: 640 }, { width: 412, height: 915 }, { width: 1440, height: 900 }].map(review));
  console.log('Presentation release tests passed.');
} finally {
  await browser.close();
  if (server) await server.close();
}
