/* Real timed controls in all ten engine-backed arcade modes. The existing QA
   selector chooses otherwise locked modes; it never assigns a score or win. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, firefox, webkit } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const modes = (process.env.SCS_ARCADE_MODES || 'klassik,beginner,expert,mathe,wissen,memo,sequenz,stroop,fokus,chaos').split(',');
const qaRoot = process.env.LOCALAPPDATA ? resolve(process.env.LOCALAPPDATA, 'Temp/opencode') : resolve(tmpdir(), 'opencode');
const out = process.env.SCS_REVIEW_OUT || resolve(qaRoot, 'scs-prism-arcade');
const server = process.env.SCS_BASE ? null : await startStaticServer({ root: 'docs', port: 0 });
const base = process.env.SCS_BASE || server.baseUrl;
const receipts = [];
await mkdir(out, { recursive: true });

try {
  for (const name of (process.env.SCS_BROWSERS || 'chromium').split(',')) {
    const browser = await ({ chromium, firefox, webkit })[name].launch();
    try {
      for (const mode of modes) {
        const context = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'de-DE', hasTouch: true, serviceWorkers: 'block' });
        const errors = [];
        try {
          await context.addInitScript(({ tier, depth, theme }) => {
            localStorage.setItem('scsQa', '1');
            localStorage.setItem('scsQaPerfTier', tier);
            localStorage.setItem('scs_save:guest', JSON.stringify({ activeTheme: theme, settings: { tutorialDone: true, sound: false, music: false, arenaDepth: depth } }));
            globalThis.arcadeWatched = [];
            new MutationObserver(records => {
              for (const r of records) if (r.target.matches?.('#game .sequenz-flash') && !r.oldValue?.includes('sequenz-flash')) arcadeWatched.push(r.target.dataset.dir);
            }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
            window.addEventListener('error', e => console.error('[Arcade engine]', e.message));
            window.addEventListener('unhandledrejection', e => console.error('[Arcade rejection]', String(e.reason?.stack || e.reason)));
          }, { tier: mode === 'mathe' ? 'low' : 'high', depth: mode === 'klassik', theme: mode === 'mathe' ? 'ocean' : 'default' });
          const page = await context.newPage();
          page.on('pageerror', e => errors.push(e.message));
          page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
          if (mode === 'sequenz') await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.goto(base, { waitUntil: 'networkidle' });
          await page.locator('#btnGuest').click(); await page.waitForSelector('#home.active');
          await page.evaluate(mode => __SCS_QA__.setGameSelection(mode, 'endless'), mode);
          if (mode === 'klassik') {
            // Hold the actual lazy request, then navigate normally. A late
            // engine download must not steal the settings screen or start twice.
            let release;
            const gate = new Promise(resolve => { release = resolve; });
            const requestSeen = page.waitForRequest('**/js/chunks/ArcadeArena-*.js');
            await page.route('**/js/chunks/ArcadeArena-*.js', async route => {
              await gate; await route.continue();
            });
            try {
              await page.locator('#btnPlay').click();
              await requestSeen;
              await page.locator('#btnPlay').click();
              await page.locator('#btnSettings').click();
            } finally { release(); }
            await page.waitForFunction(() => !document.querySelector('#btnPlay').hasAttribute('aria-busy'));
            assert.equal(await page.locator('#settings.active').count(), 1, 'Navigation cancels a pending game start');
            assert.equal(await page.locator('.arcade-engine-layer').count(), 0);
            await page.unroute('**/js/chunks/ArcadeArena-*.js');
            await page.locator('#settings .btn-back-bottom').click();
          }
          await page.locator('#btnPlay').click();
          await page.waitForSelector('#game.active');
          if (await page.locator('#modeInstructionOverlay.active').count()) await page.locator('#btnStartAfterInstruction').click();
          await page.waitForFunction(() => __SCS_QA__.gameState().running && __SCS_QA__.arcadeRendererState()?.ready && __SCS_QA__.arcadeRendererState().targets > 0);
          const renderer = await page.evaluate(() => __SCS_QA__.arcadeRendererState());
          assert.equal(renderer.mode, mode); assert.equal(renderer.live, true);
          assert.equal(renderer.targets, mode === 'expert' ? 8 : 4);
          assert.ok(renderer.renderedFrames > 0, 'The engine must paint the real stage');
          assert.equal(renderer.fpsLimit, mode === 'mathe' ? 30 : 60);
          assert.equal(renderer.palette.floor, await page.locator('#game').evaluate(el => Number.parseInt(getComputedStyle(el).getPropertyValue('--surface').trim().slice(1), 16)), 'Engine architecture uses the selected theme, not a fixed substitute palette');
          assert.ok(renderer.pixels <= 1024 * 1536);
          assert.equal(await page.locator('.arcade-engine-layer canvas').count(), 1);
          if (mode === 'mathe') {
            await page.waitForFunction(() => !__SCS_QA__.arcadeRendererState().loopRunning);
            const idleFrames = await page.evaluate(() => __SCS_QA__.arcadeRendererState().renderedFrames);
            await page.waitForTimeout(150);
            assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().renderedFrames), idleFrames, 'A static live stage has no idle render loop');
          }
          if (mode === 'memo') {
            await page.waitForSelector('#game .corner-shape.memo-covered');
            assert.ok((await page.locator('#game .memo-covered').evaluateAll(nodes => nodes.map(el => el.getAttribute('aria-label'))))
              .every(label => /verdeckt/i.test(label)), 'The engine never reveals a covered Memo target');
          }
          if (mode === 'sequenz') {
            await page.waitForSelector('#game .sequenz-flash');
            const cue = await page.locator('#game .sequenz-flash').evaluate(el => {
              const style = getComputedStyle(el);
              return { width: parseFloat(style.outlineWidth), style: style.outlineStyle, color: style.outlineColor, class: el.className };
            });
            assert.ok(cue.width >= 3, `Reduced motion keeps the necessary watch cue: ${JSON.stringify(cue)}`);
            await page.waitForFunction(() => __SCS_QA__.arcadeRendererState()?.phase === 'recall');
          }
          else await page.waitForFunction(() => __SCS_QA__.gameState().stimulusId != null);
          const geometry = await page.locator('#game .corner-shape,#centerPlatform').evaluateAll(nodes => nodes.filter(n => n.offsetParent).map(n => {
            const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
          }));
          if (mode === 'klassik') {
            // Explicit pointer-depth fixture; native Chromium touch is also
            // exercised independently by presentation-release-test.
            const depth = await page.evaluate(async () => {
              document.querySelector('#game').dispatchEvent(new PointerEvent('pointermove', { clientX: 400, clientY: 850, isPrimary: true }));
              await new Promise(resolve => requestAnimationFrame(resolve));
              return __SCS_QA__.arcadeRendererState().depth;
            });
            assert.ok(depth.x > 0 && Math.abs(depth.x) <= 4 && Math.abs(depth.y) <= 3, `Only architecture has bounded opt-in depth: ${JSON.stringify(depth)}`);
          }
          await page.screenshot({ path: resolve(out, `${name}-${mode}.png`) });
          if (mode === 'sequenz') {
            const watched = await page.evaluate(() => arcadeWatched);
            assert.ok(watched.length >= 3);
            for (const dir of watched) {
              await page.locator(`#game .corner-shape[data-dir="${dir}"]`).tap();
              await page.waitForTimeout(150);
            }
          } else {
            const state = await page.evaluate(() => __SCS_QA__.gameState());
            await page.waitForTimeout(mode === 'wissen' ? 1550 : 100);
            await page.locator(`#game .corner-shape[data-dir="${state.direction}"]`).tap();
          }
          await page.waitForFunction(() => __SCS_QA__.arcadeRendererState().hits > 0);
          assert.deepEqual(await page.locator('#game .corner-shape,#centerPlatform').evaluateAll(nodes => nodes.filter(n => n.offsetParent).map(n => {
            const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
          })), geometry, `${mode}: engine contact never moves an input rectangle`);
          await page.locator('#btnPause').click();
          assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().live), false);
          assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().loopRunning), false);
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.waitForFunction(() => __SCS_QA__.arcadeRendererState().reduced);
          assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().effects), 0);
          assert.deepEqual(await page.evaluate(() => __SCS_QA__.arcadeRendererState().depth), { x: 0, y: 0 });
          assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().loopRunning), false, 'Changing policy never wakes a paused engine');
          await page.locator('#btnResume').click();
          assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().live), true);
          if (mode === 'klassik') {
            // Explicit lifecycle fixture, not a claim of physical GPU failure.
            const before = await page.evaluate(() => __SCS_QA__.gameState());
            await page.locator('.arcade-engine-layer canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
            await page.waitForSelector('#pauseOverlay.active');
            await page.waitForSelector('.arcade-engine-layer', { state: 'detached' });
            assert.equal(await page.locator('#game').getAttribute('data-arcade-engine'), null);
            await page.locator('#btnResume').click();
            await page.waitForFunction(id => __SCS_QA__.gameState().stimulusId !== id, before.stimulusId);
            const fallback = await page.evaluate(() => __SCS_QA__.gameState());
            await page.waitForTimeout(120);
            await page.locator(`#game .corner-shape[data-dir="${fallback.direction}"]`).tap();
            await page.waitForFunction(count => __SCS_QA__.gameState().correct > count, fallback.correct);
          }
          await page.locator('#btnPause').click(); await page.locator('#btnPauseQuit').click();
          await page.waitForSelector('#home.active');
          assert.equal(await page.locator('.arcade-engine-layer').count(), 0);
          receipts.push({ browser: name, mode, renderer, fixedGeometry: true, realInput: true });
          assert.deepEqual(errors, [], `${name}/${mode}: no runtime errors`);
          console.log(`PASS ${name}/${mode}: engine stage, real input, fixed targets, pause, motion and disposal${mode === 'klassik' ? ', depth and graphics fallback' : ''}`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  await writeFile(resolve(out, 'arcade-engine-receipts.json'), JSON.stringify(receipts, null, 2));
} finally { await server?.close(); }
