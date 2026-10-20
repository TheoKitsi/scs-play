/** Compiled, deterministic presentation fixtures, NOT earned progression/FPS.
 * Identical frozen playheads/seeds support honest before/after pictures.
 * Real natural-round and 100-answer gates remain mandatory independently. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const baseline = process.argv.includes('--baseline');
const server = process.env.SCS_BASE ? null : await startStaticServer({ root: process.env.SCS_ARENA_ROOT || 'docs', port: 0 });
const base = process.env.SCS_BASE || server.baseUrl;
const out = process.env.SCS_REVIEW_OUT && resolve(process.env.SCS_REVIEW_OUT, 'arena');
if (out) mkdirSync(out, { recursive: true });
const reports = [];
const modes = (process.env.SCS_ARENA_MODES || 'klassik,beginner,expert,mathe,wissen,memo,sequenz,stroop,fokus,chaos').split(',');

try {
  for (const engine of (process.env.SCS_BROWSERS || 'chromium').split(',')) {
    const browser = await ({ chromium, firefox, webkit })[engine].launch();
    try {
      for (const viewport of [{ width: 360, height: 640 }, { width: 1440, height: 900 }]) {
        for (const mode of modes) {
          const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'de-DE', serviceWorkers: 'block',
            hasTouch: viewport.width < 768, ...(engine === 'firefox' ? {} : { isMobile: viewport.width < 768 }) });
          try {
            await context.addInitScript(() => {
              localStorage.setItem('scsQa', '1'); localStorage.setItem('scsQaPerfTier', 'high');
              localStorage.setItem('scs_save:guest', JSON.stringify({ settings: { tutorialDone: true, sound: false, music: false },
                onboardingCompleted: true }));
              globalThis.__watchedDirections = [];
              new MutationObserver(records => {
                for (const record of records) {
                  if (record.target.matches?.('#game .sequenz-flash') && !record.oldValue?.includes('sequenz-flash')) __watchedDirections.push(record.target.dataset.dir);
                }
              }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(base, { waitUntil: 'networkidle' });
            await page.locator('#btnGuest').click();
            await page.locator('#home.active').waitFor();
            await page.waitForTimeout(1000);
            for (let i = 0; i < 3; i++) {
              const hint = page.locator('.onboarding-overlay.active .onboarding-btn-ok');
              if (!await hint.isVisible()) break;
              await hint.click(); await page.waitForTimeout(400);
            }
            const time = new Date('2026-10-19T12:00:00Z');
            await page.clock.install({ time });
            await page.clock.pauseAt(new Date(time.getTime() + 1000));
            // GameEngine seeds mulberry32 from Date.now(), independently of
            // decorative Math.random. Pin that seed too; timers/performance
            // still advance. This is an explicit presentation fixture only.
            await page.clock.setFixedTime(time);
            // Constant fixture RNG isolates task choice from decorative RNG
            // consumption between versions; never used in the real-play gate.
            await page.evaluate(mode => { Math.random = () => .37; __SCS_QA__.setGameSelection(mode, 'endless'); document.querySelector('#btnPlay').click(); }, mode);
            if (await page.locator('#modeInstructionOverlay.active').count()) await page.evaluate(() => document.querySelector('#btnStartAfterInstruction').click());
            let started = false;
            let sawWatch = false;
            for (let i = 0; i < 100; i++) {
              await page.evaluate(() => {
                document.querySelector('#modeInstructionOverlay.active #btnStartAfterInstruction')?.click();
                document.querySelector('#tutorial.active #btnTutorialSkip')?.click();
              });
              await page.clock.runFor(100);
              if (!baseline && mode === 'memo' && await page.locator('#resonanceStage[data-phase="watch"]').count()) sawWatch = true;
              started = await page.evaluate(mode => __SCS_QA__.gameState().running &&
                (mode === 'sequenz' ? document.querySelector('.sequenz-flash') != null : __SCS_QA__.gameState().stimulusId != null), mode);
              if (started) break;
            }
            assert.ok(started, `${mode}: real start/countdown reaches a live task`);
            // CSS entry fades use the browser animation clock, not the mocked
            // JS clock. Settle only construction/cover fades in BOTH builds;
            // never hide overlays or finish essential watched-pad flashes.
            await page.evaluate(() => {
              for (const animation of document.querySelector('#game').getAnimations({ subtree: true })) {
                if (animation instanceof CSSTransition || ['memoCoverPop', 'memoRevealPulse', 'stimulusReveal'].includes(animation.animationName)) animation.finish();
              }
            });
            const geometry = await page.evaluate(() => {
              const rect = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
              const targets = [...document.querySelectorAll('#game .corner-shape,#centerPlatform')].filter(el => el.offsetParent);
              return targets.map(rect);
            });
            reports.push({ engine, viewport, mode, geometry, state: await page.evaluate(() => __SCS_QA__.gameState()),
              task: await page.evaluate(() => ({ text: document.querySelector('#centerShape').textContent,
                label: document.querySelector('#centerPlatform').getAttribute('aria-label'),
                faces: [...document.querySelectorAll('#game [data-material-face]')].map(el => el.getAttribute('fill')),
                silhouettes: [...document.querySelectorAll('#game [data-material-face]')].map(el => el.innerHTML),
                arrows: [...document.querySelectorAll('#centerShape .direction-icon path')].map(el => [el.getAttribute('d'), el.getAttribute('transform')]) })) });
            if (out) await page.screenshot({ path: resolve(out, `${engine}-${viewport.width}-${mode}.png`) });
            if (!baseline) {
              const view = await page.evaluate(() => ({ phase: document.querySelector('#resonanceStage').dataset.phase,
                mode: document.querySelector('#game').dataset.arenaMode,
                read: getComputedStyle(document.querySelector('#centerShape')).opacity,
                overlay: document.querySelectorAll('#rushText,#comboText,.fever-overlay').length,
                label: document.querySelector('#arenaPhaseLabel').textContent }));
              assert.equal(view.mode, mode);
              assert.equal(view.overlay, 0, 'No central WATCH/GO or fever celebration obscures tasks');
              assert.ok(view.phase && view.label);
              if (mode === 'memo') {
                assert.equal(sawWatch, true, 'Memo watch status exists for its full real preview');
                assert.equal(view.phase, 'recall');
                assert.equal(await page.locator('#game .corner-shape.memo-covered').count(), 4);
              }
              if (mode === 'sequenz') {
                assert.equal(view.phase, 'watch');
                await page.emulateMedia({ reducedMotion: 'reduce' });
                await page.clock.runFor(20);
                assert.ok(await page.locator('#game .sequenz-flash').evaluate(el => parseFloat(getComputedStyle(el).outlineWidth) >= 3), 'Reduced motion retains the essential watched-pad cue');
                await page.emulateMedia({ reducedMotion: 'no-preference' });
                for (let i = 0; i < 100 && !await page.locator('#resonanceStage[data-phase="recall"]').count(); i++) await page.clock.runFor(100);
                assert.equal(await page.locator('#resonanceStage[data-phase="recall"]').count(), 1);
                const watched = await page.evaluate(() => __watchedDirections);
                assert.equal(watched.length, 3, 'Watch cues remain distinct, including repeated directions');
                for (const direction of watched) {
                  await page.clock.runFor(180);
                  await page.evaluate(dir => document.querySelector(`#game .corner-shape[data-dir="${dir}"]`).click(), direction);
                }
                await page.clock.runFor(40);
                assert.equal(await page.locator('#resonanceStage[data-phase="ready"]').count(), 1, 'Completion is not mislabeled as watching a sequence not yet shown');
              }
              if (mode !== 'sequenz') assert.equal(Number(view.read), 1);
              const state = await page.evaluate(() => __SCS_QA__.gameState());
              if (state.stimulusId != null) {
                await page.clock.runFor(mode === 'wissen' ? 1600 : 180);
                await page.evaluate(direction => document.querySelector(`#game .corner-shape[data-dir="${direction}"]`).click(), state.direction);
                const hit = await page.evaluate(() => ({ kind: document.querySelector('.corner-correct')?.dataset.impact,
                  state: __SCS_QA__.gameState() }));
                assert.equal(hit.state.correct, 1, `${mode}: a normal answer drives feedback ${JSON.stringify({ before: state, hit })}`);
                assert.ok(['good', 'perfect', 'bonus'].includes(hit.kind));
                if (mode === 'memo') {
                  const badge = await page.locator('#game .memo-covered.corner-correct').evaluate(el => {
                    const style = getComputedStyle(el, '::after');
                    return { left: style.left, top: style.top, right: style.right, bottom: style.bottom,
                      width: parseFloat(style.width), slot: el.clientWidth };
                  });
                  assert.equal(badge.left, '0px'); assert.equal(badge.right, '0px');
                  assert.equal(badge.top, '0px'); assert.equal(badge.bottom, '0px');
                  assert.ok(Math.abs(badge.width - badge.slot) <= 1, 'Covered-memory answer feedback stays centered, not in a conflicting corner badge');
                }
                await page.clock.runFor(500);
              }
              assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#game .corner-shape,#centerPlatform')].filter(el => el.offsetParent).map(el => {
                const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
              })), geometry, 'Phases/confirmation never move hit rectangles');
              if (mode === 'chaos') {
                const sizing = await page.locator('#game .chaos-rule-badge .ui-icon').evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
                assert.ok(sizing.width <= 16 && sizing.height <= 16, 'Compact rule icons must not inherit legacy 60px task sizing');
              }
              await page.setViewportSize({ width: 320, height: 568 });
              await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
              const reflow = await page.locator('#arenaPhase').evaluate(el => {
                const r = el.getBoundingClientRect();
                return r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
              });
              assert.ok(reflow, 'Enlarged phase status stays within a narrow viewport');
            }
            assert.deepEqual(errors, []);
          } finally { await context.close(); }
        }
        console.log(`PASS ${engine} ${viewport.width}: ${modes.length} ${baseline ? 'baseline' : 'compiled'} world fixtures, fixed hit geometry, state and readable tasks`);
      }
    } finally { await browser.close(); }
  }
  if (out) writeFileSync(resolve(out, 'fixtures.json'), JSON.stringify({ baseline, base, fixtureOnly: true, reports }, null, 2));
} finally { if (server) await server.close(); }
