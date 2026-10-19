import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

// Source-level callback instrumentation; all answers still use real DOM input.
const server = await startStaticServer({ root: '.', port: 0 });
const browser = await chromium.launch({ headless: true });

async function review(viewport, mode = 'klassik') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(() => {
    localStorage.setItem('scsQa', '1');
    localStorage.setItem('scsQaPerfTier', 'high');
    globalThis.__buzzes = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: pattern => { globalThis.__buzzes.push(pattern); return true; } });
    let seed = 1337;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  try {
    await page.goto(server.baseUrl, { waitUntil: 'networkidle' });
    await page.locator('#btnGuest').waitFor({ state: 'visible' });
    await page.evaluate(() => document.querySelector('#btnGuest').click());
    await page.locator('#home.active').waitFor();
    await page.evaluate(mode => {
      // Include a realistic gesture-navigation inset even on the short phone.
      document.body.style.setProperty('--gesture-nav-inset', '34px');
      globalThis.__SCS_QA__.setGameSelection(mode, 'endless');
      document.querySelector('#btnPlay').click();
    }, mode);
    await page.waitForFunction(() => {
      if (document.querySelector('#tutorial.active')) document.querySelector('#btnTutorialSkip')?.click();
      return globalThis.__SCS_QA__?.gameState()?.stimulusId != null;
    }, null, { timeout: 15000, polling: 100 });

    const result = await page.evaluate(async base => {
      const { default: app } = await import(`${base}/js/appState.js`);
      const game = app.game;
      const counters = { combo: 0, shuffle: 0, rush: 0, cooldown: 0 };
      const problems = [];
      const gaps = [];
      const energies = new Set();
      let impacts = 0;
      const originalImpact = app.audio.gameImpact;
      app.audio.gameImpact = function (...args) { impacts++; return originalImpact.apply(this, args); };
      let answers = 0, inputAt = null, lastAnswerAt = null, timer = null, ended = false;
      const original = Object.fromEntries(['onSpawn', 'onResult', 'onComboMilestone', 'onCornerShuffle', 'onRush', 'onFeverEnd'].map(key => [key, game[key]]));
      const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return await new Promise((resolve, reject) => {
        const watchdog = setTimeout(() => finish(new Error(`Stalled at ${answers} answers`)), 60000);
        function finish(error) {
          if (ended) return;
          ended = true;
          clearTimeout(watchdog); clearTimeout(timer);
          Object.assign(game, original);
          app.audio.gameImpact = originalImpact;
          if (error) reject(error);
          else resolve({ counters, problems, gaps, answers, impacts, energies: [...energies], wrong: game.wrong,
            dynamicComboStyles: Boolean(document.querySelector('#combo-milestone-kf')),
            centerCelebrations: document.querySelectorAll('.combo-milestone,.shuffle-explain,.rush-warning').length,
            noticeCount: document.querySelectorAll('#gameNotice').length });
        }
        for (const [key, event] of [['onComboMilestone', 'combo'], ['onCornerShuffle', 'shuffle'], ['onRush', 'rush'], ['onFeverEnd', 'cooldown']]) {
          game[key] = (...args) => { counters[event]++; original[key]?.(...args); };
        }
        game.onResult = result => {
          const beforeBuzz = globalThis.__buzzes.length;
          original.onResult?.(result);
          if (globalThis.__buzzes.length - beforeBuzz !== 1) problems.push('answer must produce one consolidated haptic');
          if (!result.correct) return finish(new Error('A scripted correct answer was lost'));
          answers++;
          lastAnswerAt = inputAt;
        };
        const inspectAndAnswer = item => requestAnimationFrame(() => {
          if (ended) return;
          try {
            const center = document.querySelector('#centerShape');
            const stage = document.querySelector('#resonanceStage');
            energies.add(stage.dataset.energy);
            if (stage.dataset.confirmedDirection) problems.push('previous answer hint survived into the next stimulus');
            if (document.querySelector('.fever-overlay')) problems.push('legacy full-screen fever overlay must not stack on stage lighting');
            if (!center.querySelector('.material-shape')) problems.push('missing material on first frame');
            if (Number(getComputedStyle(center).opacity) < .99) problems.push('stimulus fades in instead of being readable on first frame');
            if (lastAnswerAt != null) { gaps.push(performance.now() - lastAnswerAt); lastAnswerAt = null; }
            const notice = document.querySelector('#gameNotice');
            if (notice.classList.contains('visible')) {
              const r = notice.getBoundingClientRect();
              const targets = [document.querySelector('#centerPlatform'), ...document.querySelectorAll('.corner-shape')].filter(el => el.offsetParent !== null);
              if (targets.some(el => intersects(r, el.getBoundingClientRect()))) problems.push('notice overlaps stimulus/target');
            }
            if (answers >= 100) return finish();
            timer = setTimeout(() => {
              if (game.currentShape?.stimulusId !== item.stimulusId) return finish(new Error('Next symbol replaced before input'));
              inputAt = performance.now();
              const beforeBuzz = globalThis.__buzzes.length;
              document.querySelector(`.corner-shape[data-dir="${item.direction}"]`).click();
              if (globalThis.__buzzes.length - beforeBuzz !== 1) problems.push('menu/phase buzz overwrote the answer impact');
            }, 110);
          } catch (error) { finish(error); }
        });
        game.onSpawn = item => { original.onSpawn?.(item); inspectAndAnswer(item); };
        inspectAndAnswer(game.currentShape);
      });
    }, server.baseUrl);

    assert.equal(result.answers, 100);
    assert.equal(result.wrong, 0);
    assert.equal(result.impacts, 100, 'Exactly one material sound event per accepted answer');
    for (const energy of ['calm', 'flow', 'fever']) assert.ok(result.energies.includes(energy), `${energy} must appear in real gameplay`);
    assert.deepEqual(result.problems, []);
    for (const event of ['combo', 'shuffle', 'rush', 'cooldown']) assert.ok(result.counters[event] > 0, `${event} must be exercised`);
    assert.ok(Math.max(...result.gaps) < 1000, 'No multi-second blank field in the real UI');
    assert.equal(result.dynamicComboStyles, false);
    assert.equal(result.centerCelebrations, 0);
    assert.equal(result.noticeCount, 1);
    await page.evaluate(() => document.querySelector('#btnPauseQuit').click());
    assert.equal(await page.locator('#gameNotice').textContent(), '');
    assert.deepEqual(errors, []);
    console.log(`PASS ${mode} ${viewport.width}×${viewport.height}: 100 flawless answers, single sound/haptic, peripheral energy, first-frame visibility, unobstructed targets; max painted successor gap ${Math.round(Math.max(...result.gaps))}ms`);
  } finally {
    await context.close();
  }
}

try {
  await Promise.all([
    review({ width: 360, height: 640 }),
    review({ width: 412, height: 915 }),
    review({ width: 360, height: 640 }, 'expert'),
  ]);
  console.log('Streak presentation tests passed.');
} finally {
  await browser.close();
  await server.close();
}
