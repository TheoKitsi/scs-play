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
const smallPhone = { width: 320, height: 568 };

// Run on the live task at the frozen playhead, before feedback replaces it.
// Compare rendered lines, not the bounds of full-screen scenery/wrappers.
async function checkPhoneTask(page, mode, phase) {
  const issues = await page.evaluate(({ mode, phase, smallPhone }) => {
    const game = document.querySelector('#game.active');
    const issues = [];
    if (innerWidth !== smallPhone.width || innerHeight !== smallPhone.height) issues.push(`Unexpected viewport: ${innerWidth}×${innerHeight}`);
    const visible = el => el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const pads = [...game.querySelectorAll('.corner-shape')].filter(visible);
    if (pads.length !== (mode === 'expert' ? 8 : 4)) issues.push(`${pads.length} visible pads`);
    const center = game.querySelector('#centerPlatform');
    const controls = mode === 'memo' && phase === 'watch' ? pads : [...pads, center];
    const name = el => el.dataset.dir || el.id || el.tagName;
    const outside = (a, b) => a.left < b.left - 1 || a.right > b.right + 1 || a.top < b.top - 1 || a.bottom > b.bottom + 1;
    const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      if (outside(r, viewport) || r.width < 44 || r.height < 44) issues.push(`${name(el)} lacks an on-screen 44px target`);
      // Watch is a visual cue, not an open answer window.
      if (phase === 'watch') continue;
      for (const [x, y] of [[.5, .5], [.25, .5], [.75, .5], [.5, .25], [.5, .75]]) {
        const hit = document.elementFromPoint(r.left + x * r.width, r.top + y * r.height);
        if (!el.contains(hit)) { issues.push(`${name(el)} blocked at ${x},${y} by ${hit ? name(hit) : 'nothing'}`); break; }
      }
    }

    // A pointer-transparent caption can still cover an answer. A wrapped quiz
    // line can extend beyond its decorative plinth without actually clipping.
    // Measure each text fragment against its clipping ancestors and other tasks.
    const copy = [...game.querySelectorAll('#deckInstruction, #modeDetail, #gameNotice, #modeRuleLabel, #arenaPhaseLabel')];
    if (!game.querySelector('#modeDetail')) issues.push('Missing shared #modeDetail host');
    // Status may intentionally share the plinth with a sequence counter. Its
    // text must clear the actual glyphs/shape, not an empty part of the plinth.
    const occupied = pads.map(root => ({ root, r: root.getBoundingClientRect() }));
    if (controls.includes(center)) {
      for (const svg of center.querySelectorAll('#centerShape svg')) {
        if (visible(svg)) occupied.push({ root: center, r: svg.getBoundingClientRect() });
      }
    }
    for (const root of [...controls, ...copy]) {
      let hasText = false;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node; (node = walker.nextNode());) {
        const el = node.parentElement;
        if (!node.textContent.trim() || el.closest('svg,.sr-only') || !visible(el)) continue;
        // An accessible-only instruction can coexist with its visual readout.
        let clippedAway = false;
        for (let p = el; p && p !== game; p = p.parentElement) {
          if (getComputedStyle(p).clipPath === 'inset(50%)') { clippedAway = true; break; }
        }
        if (clippedAway) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (!r.width || !r.height) continue;
          hasText = true;
          const label = `${name(root)} "${node.textContent.trim()}"`;
          if (outside(r, viewport)) issues.push(`${label} outside viewport`);
          for (let parent = el; parent && parent !== game; parent = parent.parentElement) {
            const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
            if ((/hidden|clip|auto|scroll/.test(style.overflowX) && (r.left < box.left - 1 || r.right > box.right + 1)) ||
                (/hidden|clip|auto|scroll/.test(style.overflowY) && (r.top < box.top - 1 || r.bottom > box.bottom + 1))) {
              issues.push(`${label} clipped by ${name(parent)}`); break;
            }
          }
          for (const other of occupied) {
            if (root !== other.root && !root.contains(other.root) && !other.root.contains(root) && overlaps(r, other.r)) {
              issues.push(`${label} overlaps ${name(other.root)}`);
            }
          }
          occupied.push({ root, r });
        }
      }
      if (mode === 'wissen' && controls.includes(root) && !hasText) issues.push(`${name(root)} has no visible quiz text`);
    }
    return issues;
  }, { mode, phase, smallPhone });
  assert.deepEqual(issues, [], `${mode}/${phase} at 320×568: task must remain readable and reachable`);
}

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
            await page.goto(`${base}?view=arcade`, { waitUntil: 'networkidle' });
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
             // Engine/module download is real asynchronous work, not part of
             // the fixture's virtual countdown budget. Do not race cold WebKit.
             await page.waitForSelector('#game.active,#tutorial.active');
            if (await page.locator('#modeInstructionOverlay.active').count()) await page.evaluate(() => document.querySelector('#btnStartAfterInstruction').click());
            let started = false;
            let sawWatch = false;
            for (let i = 0; i < 100; i++) {
              await page.evaluate(() => {
                document.querySelector('#modeInstructionOverlay.active #btnStartAfterInstruction')?.click();
                document.querySelector('#tutorial.active #btnTutorialSkip')?.click();
              });
              await page.clock.runFor(100);
              if (!baseline && !sawWatch && mode === 'memo' && await page.locator('#resonanceStage[data-phase="watch"]').count()) {
                sawWatch = true;
                if (viewport.width === 360) {
                  await page.setViewportSize(smallPhone);
                  await checkPhoneTask(page, mode, 'watch');
                  await page.setViewportSize(viewport);
                }
              }
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
              const phone = viewport.width === 360;
              if (phone) {
                await page.setViewportSize(smallPhone);
                await checkPhoneTask(page, mode, view.phase);
              }
              const answer = async dir => {
                const pad = page.locator(`#game .corner-shape[data-dir="${dir}"]`);
                if (!phone) return pad.evaluate(el => el.click());
                // Coordinate input has no force, scroll, or auto-retry. An
                // intercepting overlay must receive the touch if one exists.
                const r = await pad.boundingBox();
                await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
              };
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
                if (phone) await checkPhoneTask(page, mode, 'recall');
                const watched = await page.evaluate(() => __watchedDirections);
                assert.equal(watched.length, 3, 'Watch cues remain distinct, including repeated directions');
                for (const direction of watched) {
                  await page.clock.runFor(180);
                  await answer(direction);
                }
                await page.clock.runFor(40);
                assert.equal(await page.locator('#resonanceStage[data-phase="ready"]').count(), 1, 'Completion is not mislabeled as watching a sequence not yet shown');
              }
              if (mode !== 'sequenz') assert.equal(Number(view.read), 1);
              const state = await page.evaluate(() => __SCS_QA__.gameState());
              if (state.stimulusId != null) {
                await page.clock.runFor(mode === 'wissen' ? 1600 : 180);
                await answer(state.direction);
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
              if (phone) await page.setViewportSize(viewport);
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
        console.log(`PASS ${engine} ${viewport.width}: ${modes.length} world fixtures, fixed hit geometry, state and readable tasks${!baseline && viewport.width === 360 ? '; 320×568 touch answers and task clearance' : ''}`);
      }
    } finally { await browser.close(); }
  }
  if (out) writeFileSync(resolve(out, 'fixtures.json'), JSON.stringify({ baseline, base, fixtureOnly: true, reports }, null, 2));
} finally { if (server) await server.close(); }
