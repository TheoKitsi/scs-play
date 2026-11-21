/* Real timed controls in all ten engine-backed arcade modes. The existing QA
   selector chooses otherwise locked modes; it never assigns a score or win. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium, firefox, webkit } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';
import { MATERIAL_ASSETS } from '../js/engine/materialAssets.js';

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
          // Scene creation and the first POST_RENDER are separate, especially
          // on the capped low tier. Require an actual paint before sampling it.
          await page.waitForFunction(() => {
            const stage = __SCS_QA__.arcadeRendererState();
            return __SCS_QA__.gameState().running && stage?.ready && stage.targets > 0 && stage.renderedFrames > 0;
          }, null, { timeout: 15000 });
          if (mode !== 'mathe') await page.waitForFunction(() => {
            const solid = __SCS_QA__.arcadeRendererState()?.solid;
            return solid?.draws > 0 || solid?.error;
          });
          const renderer = await page.evaluate(() => __SCS_QA__.arcadeRendererState());
          assert.equal(renderer.mode, mode); assert.equal(renderer.live, true);
          assert.equal(renderer.targets, mode === 'expert' ? 8 : 4);
          assert.ok(renderer.renderedFrames > 0, 'The engine must paint the real stage');
          assert.equal(renderer.fpsLimit, mode === 'mathe' ? 30 : 60);
          assert.equal(renderer.palette.floor, await page.locator('#game').evaluate(el => Number.parseInt(getComputedStyle(el).getPropertyValue('--surface').trim().slice(1), 16)), 'Engine architecture uses the selected theme, not a fixed substitute palette');
          assert.ok(renderer.pixels <= 1024 * 1536);
          assert.equal(renderer.material, true, `${mode}: the authored material must be loaded`);
          assert.equal(renderer.materialFile, MATERIAL_ASSETS.decks[mode]);
          assert.equal(await page.locator('#game').getAttribute('data-arena-material'), mode);
          assert.equal(renderer.solid.enabled, mode !== 'mathe');
          if (mode !== 'mathe') {
            assert.equal(renderer.solid.model, 'mesh-ggx');
            assert.equal(renderer.solid.error, null);
            assert.equal(renderer.solid.finish, 'normal-roughness-atlas');
            assert.equal(renderer.solid.resources.textureBytes, 512 * 128 * 4);
            assert.equal(renderer.solid.objects, renderer.targets + 2);
            assert.deepEqual(renderer.solid.kinds, { frame: 1, station: renderer.targets + 1 }, 'One real perimeter frame supplements the same task stations');
            assert.ok(renderer.solid.triangles <= 3500);
          }
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
            assert.ok(await page.locator('#game .memo-covered').evaluateAll(nodes => nodes.every(el => [...el.children].every(child => getComputedStyle(child).opacity === '0'))), 'A material skin cannot expose hidden Memo contents');
          }
          if (mode === 'stroop') {
            await page.waitForSelector('.stroop-display');
            assert.equal(await page.locator('.stroop-display').evaluate(el => getComputedStyle(el).textShadow), 'none', 'Ink is readable without the legacy neon halo');
            assert.equal(await page.locator('.stroop-display').evaluate(el => {
              const swatch = document.createElement('span'); swatch.style.backgroundColor = getComputedStyle(document.body).getPropertyValue('--bg');
              return getComputedStyle(el).backgroundColor === swatch.style.backgroundColor;
            }), true, 'The exact ink sits on an opaque theme-background plate, never on a specular 3D highlight');
            assert.ok(await page.locator('#game [data-content="stroop"]').evaluateAll(nodes => nodes.every(el => el.style.backgroundColor === getComputedStyle(el).backgroundColor)), 'All answer swatches retain their exact assigned background colour');
          }
          if (mode === 'sequenz') {
            // Observe the live cue and its computed style in one browser task;
            // automation must not inspect the same target after its cue ended.
            const cue = await (await page.waitForFunction(() => {
              const el = document.querySelector('#game .sequenz-flash');
              if (!el) return false;
              const style = getComputedStyle(el);
              return { width: parseFloat(style.outlineWidth), style: style.outlineStyle, color: style.outlineColor, class: el.className };
            })).jsonValue();
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
             const solidOffset = await page.evaluate(() => __SCS_QA__.arcadeRendererState().solid.stageOffset);
             assert.ok(Math.abs(solidOffset[0] - depth.x) < .00001 && Math.abs(solidOffset[1] - depth.y) < .00001, 'The physical frame follows the same bounded architecture offset, not the input targets');
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
          assert.equal(await page.evaluate(() => __SCS_QA__.arcadeRendererState().effects), 0, 'Accepted hits keep every material deck cached');
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
          assert.equal(await page.locator('#game').getAttribute('data-arena-material'), null, 'The material skin is disposed with its renderer');
          receipts.push({ browser: name, mode, renderer, fixedGeometry: true, realInput: true });
          assert.deepEqual(errors, [], `${name}/${mode}: no runtime errors`);
          console.log(`PASS ${name}/${mode}: engine stage, real input, fixed targets, pause, motion and disposal${mode === 'klassik' ? ', depth and graphics fallback' : ''}`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
  await writeFile(resolve(out, 'arcade-engine-receipts.json'), JSON.stringify(receipts, null, 2));
} finally { await server?.close(); }
