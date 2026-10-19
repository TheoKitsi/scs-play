/** Compiled round lifecycle. Natural timeout/continuation and normal inputs;
 * explicit early-end fixtures are used only for cancellation/empty/reduced UI. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const server = process.env.SCS_BASE ? null : await startStaticServer({ root: 'docs', port: 0 });
const base = process.env.SCS_BASE || server.baseUrl;
const engines = { chromium, firefox, webkit };
const out = process.env.SCS_REVIEW_OUT ? resolve(process.env.SCS_REVIEW_OUT, 'round-finale') : '';
if (out) mkdirSync(out, { recursive: true });

async function enter(context) {
  await context.addInitScript(() => {
    localStorage.setItem('scsQa', '1');
    globalThis.__finaleErrors = [];
    addEventListener('error', event => { if (event.message) __finaleErrors.push(event.message); });
    addEventListener('unhandledrejection', event => __finaleErrors.push(String(event.reason?.stack || event.reason)));
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('#btnGuest').click();
  await page.locator('#home.active').waitFor();
  await page.waitForTimeout(1000);
  for (let n = 0; n < 3; n++) {
    const hint = page.locator('.onboarding-overlay.active .onboarding-btn-ok');
    if (!await hint.isVisible()) break;
    await hint.click(); await page.waitForTimeout(450);
  }
  await page.evaluate(() => {
    globalThis.__finaleTrace = { cues: [], resultVisits: 0 };
    let phase = '';
    new MutationObserver(() => {
      const current = document.querySelector('#game').dataset.roundPhase || '';
      if (current && current !== phase) __finaleTrace.cues.push({ phase: current, active: document.querySelector('.screen.active')?.id,
        running: __SCS_QA__.gameState().running, score: __SCS_QA__.gameState().score,
        label: document.querySelector('#roundCueLabel').textContent,
        rects: [...document.querySelectorAll('#game .corner-shape')].filter(el => el.offsetParent).map(el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }) });
      phase = current;
    }).observe(document.querySelector('#game'), { subtree: true, attributes: true, attributeFilter: ['data-round-phase', 'hidden'] });
    addEventListener('scs:screenchange', ({ detail }) => { if (detail.id === 'results') __finaleTrace.resultVisits++; });
  });
  return page;
}

async function start(page, fixtureMode = null) {
  if (fixtureMode) {
    // Explicit renderer/lifecycle fixture, not an earned mode unlock. The QA
    // selection hook does not repaint the real home's locked-mode carousel.
    await page.evaluate(mode => { __SCS_QA__.setGameSelection(mode); document.querySelector('#btnPlay').click(); }, fixtureMode);
  } else await page.locator('#btnPlay').click();
  await page.waitForFunction(() => {
    document.querySelector('#tutorial.active #btnTutorialSkip')?.click();
    document.querySelector('#modeInstructionOverlay.active #btnStartAfterInstruction')?.click();
    return __SCS_QA__.gameState()?.stimulusId != null;
  }, null, { timeout: 15000 });
}

async function answers(page, count) {
  let last = null;
  for (let n = 0; n < count; n++) {
    await page.waitForFunction(id => {
      const state = __SCS_QA__.gameState();
      return state.running && state.stimulusId != null && state.stimulusId !== id;
    }, last);
    const state = await page.evaluate(() => __SCS_QA__.gameState());
    last = state.stimulusId;
    await page.waitForTimeout(180);
    await page.locator(`#game .corner-shape[data-dir="${state.direction}"]`).click();
  }
}

async function noErrors(page) { assert.deepEqual(await page.evaluate(() => __finaleErrors), []); }

try {
  for (const engine of (process.env.SCS_BROWSERS || 'chromium').split(',')) {
    assert.ok(engines[engine]);
    const browser = await engines[engine].launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true,
      ...(engine === 'firefox' ? {} : { isMobile: true }), locale: 'de-DE', serviceWorkers: 'block' });
    try {
      const page = await enter(context);
      await start(page);
      const rects = await page.locator('#game .corner-shape').evaluateAll(els => els.filter(el => el.offsetParent).map(el => {
        const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
      }));
      await answers(page, 12);
      await page.locator('#results.active[data-result-state="continue"]').waitFor({ timeout: 65000 });
      const preview = await page.evaluate(() => ({ state: __SCS_QA__.gameState(), trace: __finaleTrace,
        display: document.querySelector('#resScore').dataset.finalScore,
        inert: document.querySelector('#resPhase3').inert,
        balance: __SCS_QA__.progressionState().lives }));
      assert.equal(preview.trace.cues.length, 1);
      assert.equal(preview.trace.cues[0].active, 'game', 'Finale must start before navigation');
      assert.equal(preview.trace.cues[0].running, false, 'No scoring grace during presentation');
      assert.equal(preview.trace.cues[0].label, 'Zeit abgelaufen');
      assert.deepEqual(preview.trace.cues[0].rects, rects, 'Ending never transforms the target buttons');
      assert.equal(Number(preview.display), preview.state.score, 'Continue shows the raw score, not already-awarded bonuses');
      assert.equal(preview.inert, false);
      assert.equal(await page.locator('#btnResContinueUse').isVisible(), true, 'No animation gate on decisions');
      if (out) await page.screenshot({ path: resolve(out, `${engine}-continue.png`) });
      await page.locator('#btnResContinueNo').click();
      await page.waitForFunction(() => document.querySelector('#results').dataset.resultState !== 'continue');
      assert.equal(await page.evaluate(() => __finaleTrace.resultVisits), 1, 'Decline updates the same result card');
      assert.equal(await page.evaluate(() => __finaleTrace.cues.length), 1, 'Decline does not play a second ending');
      assert.equal(await page.locator('#btnOneMore').isVisible(), true);
      assert.equal(await page.locator('.game-over-flash,.game-over-text').count(), 0);
      await page.waitForTimeout(450);
      const reference = await page.evaluate(() => JSON.parse(localStorage.getItem('scs_save:guest')).modeMastery.klassik.bestRuns);
      assert.ok(reference['v1:blitz:30'], 'A naturally completed, unextended run is saved as a scoped reference');
      if (out) await page.screenshot({ path: resolve(out, `${engine}-complete.png`) });

      // Use the existing practice engine, not a secretly modified scoring round.
      await page.locator('#resDetails > summary').click();
      const earned = await page.evaluate(() => __SCS_QA__.progressionState());
      await page.locator('#btnPracticeResult').click();
      await page.waitForFunction(() => __SCS_QA__.gameState()?.practice && __SCS_QA__.gameState()?.stimulusId != null, null, { timeout: 15000 });
      assert.equal(await page.locator('#practiceLabel').isVisible(), true);
      assert.equal(await page.locator('#btnStopPractice').isVisible(), true);
      const heldItem = await page.evaluate(() => __SCS_QA__.gameState().stimulusId);
      await page.waitForTimeout(1700);
      assert.equal(await page.evaluate(() => __SCS_QA__.gameState().stimulusId), heldItem, 'Practice waits for an answer instead of replacing the task');
      await answers(page, 2);
      await page.locator('#btnStopPractice').click();
      await page.locator('#home.active').waitFor();
      const afterPractice = await page.evaluate(() => __SCS_QA__.progressionState());
      assert.equal(afterPractice.xp, earned.xp);
      assert.equal(afterPractice.progression.qualifiedRounds, earned.progression.qualifiedRounds);
      assert.equal(afterPractice.lives, earned.lives);

      await page.locator('#btnSettings').click();
      await page.locator('#toggleBestRun').check();
      await page.locator('#settings .btn-back-bottom').click();
      await start(page);
      await page.locator('#bestRunComparison').waitFor({ state: 'visible' });
      assert.match(await page.locator('#bestRunComparison').textContent(), /Bestlauf/);
      assert.equal(await page.locator('#pbProximity').evaluate(el => el.classList.contains('visible')), false, 'Only one comparison system is shown');
      const comparisonGeometry = await page.locator('#bestRunComparison').evaluate(el => {
        const a = el.getBoundingClientRect();
        return [...document.querySelectorAll('#game .corner-shape,#centerPlatform')].filter(target => target.offsetParent).every(target => {
          const b = target.getBoundingClientRect();
          return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
        });
      });
      assert.equal(comparisonGeometry, true, 'Comparison stays outside all answer areas');
      if (out) await page.screenshot({ path: resolve(out, `${engine}-comparison.png`) });
      await answers(page, 3);
      await page.locator('#results.active[data-result-state="continue"]').waitFor({ timeout: 65000 });
      const lives = await page.evaluate(() => __SCS_QA__.progressionState().lives);
      await page.evaluate(() => { document.querySelector('#btnResContinueUse').click(); document.querySelector('#btnResContinueUse').click(); });
      await page.waitForFunction(() => __SCS_QA__.gameState().continued && __SCS_QA__.gameState().running, null, { timeout: 10000 });
      assert.equal(await page.evaluate(() => __SCS_QA__.progressionState().lives), lives - 1, 'Double activation consumes one life');
      assert.equal(await page.locator('#bestRunComparison').isVisible(), false, 'No ghost comparison after extending a round');
      const correctBefore = await page.evaluate(() => __SCS_QA__.gameState().correct);
      await answers(page, 2);
      assert.ok(await page.evaluate(n => __SCS_QA__.gameState().correct >= n + 2, correctBefore), 'Real controls work again after presentation cleanup');
      await page.locator('#results.active').waitFor({ timeout: 35000 });
      assert.equal(await page.locator('#resContinue').isVisible(), false);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('scs_save:guest')).modeMastery.klassik.bestRuns), reference, 'An extended run never replaces the comparison reference');
      await noErrors(page);
      console.log(`PASS ${engine}: natural end, one finale, raw→bonus settlement, immediate actions, scoped optional comparison, practice and single-charge continuation with restored input`);

      await page.locator('#btnHome').click();
      await start(page);
      await page.evaluate(() => __SCS_QA__.forceGameOver());
      await page.waitForFunction(() => document.querySelector('#game').hasAttribute('data-round-phase'));
      await page.goBack();
      await page.locator('#home.active').waitFor();
      await page.waitForTimeout(650);
      assert.equal(await page.locator('#results.active').count(), 0, 'Back cancels the pending end navigation');
      assert.equal(await page.locator('#roundCue').isVisible(), false);
      await noErrors(page);
      console.log(`PASS ${engine}: Back during the ending cannot reopen stale results`);

      // Explicit lifecycle fixtures: no progress/achievement claim is made.
      await start(page, 'memo');
      await page.locator('#game .corner-shape.memo-covered').first().waitFor();
      await page.evaluate(() => __SCS_QA__.forceGameOver());
      await page.locator('#results.active[data-result-state="continue"]').waitFor();
      await page.locator('#btnResContinueUse').click();
      await page.waitForFunction(() => __SCS_QA__.gameState().continued && __SCS_QA__.gameState().running);
      assert.equal(await page.locator('#game .corner-shape.memo-covered').count(), 4, 'Continuation must not reveal covered Memo targets');
      assert.equal(await page.locator('#bestRunComparison').isVisible(), false, 'An extended run without a reference must not show a pending-reference prompt');
      await page.locator('#btnPause').click();
      await page.locator('#btnPauseQuit').click();
      await start(page, 'klassik');
      await page.evaluate(() => __SCS_QA__.forceGameOver());
      await page.locator('#results.active[data-result-state="continue"]').waitFor();
      const beforeReadyCancel = await page.evaluate(() => __SCS_QA__.progressionState().lives);
      await page.evaluate(() => {
        const observer = new MutationObserver(() => {
          if (document.querySelector('#game').dataset.roundPhase === 'ready') { observer.disconnect(); history.back(); }
        });
        observer.observe(document.querySelector('#game'), { attributes: true, attributeFilter: ['data-round-phase'] });
      });
      await page.locator('#btnResContinueUse').click();
      await page.locator('#home.active').waitFor();
      await page.waitForFunction(n => __SCS_QA__.progressionState().lives === n, beforeReadyCancel);
      await page.waitForTimeout(650);
      assert.equal(await page.locator('#game.active').count(), 0, 'Cancelling readiness cannot start a paid round later');
      await noErrors(page);
      console.log(`PASS ${engine}: covered Memo continuation, no-reference extension and readiness cancellation/refund`);

      const reducedContext = await browser.newContext({ viewport: { width: 320, height: 568 }, locale: 'en-US', serviceWorkers: 'block', reducedMotion: 'reduce' });
      try {
        await reducedContext.addInitScript(() => localStorage.setItem('scs_save:guest', JSON.stringify({ lives: 0, lastLoginDate: new Date().toISOString().slice(0, 10), settings: { tutorialDone: true } })));
        const reduced = await enter(reducedContext);
        await start(reduced);
        await reduced.evaluate(() => __SCS_QA__.forceGameOver());
        await reduced.locator('#results.active').waitFor();
        assert.equal(await reduced.locator('#resContinue').isVisible(), false, 'No continuation offer without a reserve life');
        assert.equal(await reduced.locator('#roundCue').isVisible(), false, 'Reduced motion does not wait for the decorative hold');
        assert.equal(await reduced.locator('#btnOneMore').isVisible(), true);
        assert.equal(await reduced.evaluate(() => __SCS_QA__.progressionState().xp), 0, 'An empty result still earns nothing');
        assert.equal(await reduced.locator('#resScore').textContent(), '—');
        await reduced.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
        assert.equal(await reduced.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await noErrors(reduced);
        console.log(`PASS ${engine}: empty/no-life result, reduced motion, immediate actions and enlarged English layout`);
      } finally { await reducedContext.close(); }
    } finally { await context.close(); await browser.close(); }
  }
} finally { if (server) await server.close(); }
