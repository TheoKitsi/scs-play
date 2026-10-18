import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

// Deterministic work/resource limits, not machine-dependent FPS assertions.
const server = await startStaticServer({ root: '.', port: 0 });
const browser = await chromium.launch({ headless: true });

async function fixture() {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.route('**/performance-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><style>body{margin:0}#field{position:relative;width:400px;height:600px}button{position:absolute;width:60px;height:60px}#centerPlatform{left:170px;top:270px}</style><div id="field"><canvas></canvas><button class="corner-shape" data-dir="ul" style="left:10px;top:10px">A</button><button class="corner-shape" data-dir="ur" style="left:320px;top:10px">B</button><button id="centerPlatform">C</button></div>',
  }));
  await page.goto(`${server.baseUrl}/performance-fixture`);
  return { context, page };
}

try {
  const { context, page } = await fixture();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const work = await page.evaluate(async base => {
    const { EffectsManager } = await import(`${base}/js/effects.js`);
    const { SwipeHandler } = await import(`${base}/js/input.js`);
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
    document.body.dataset.perfMode = 'high';
    const container = document.querySelector('#field');
    const canvas = container.querySelector('canvas');
    const fx = new EffectsManager(container);
    fx.initTrailCanvas(canvas);
    const highPixels = canvas.width * canvas.height;
    fx.particles(100, 100, '#ffffff', 100);
    const particles = [...fx._activeParticles];
    const bounded = particles.length === 16;
    const compositorOnly = particles.every(p => p.animation && p.animation.effect.getKeyframes().every(k =>
      Object.keys(k).every(key => ['offset', 'computedOffset', 'easing', 'composite', 'opacity', 'transform'].includes(key))
      && !k.transform.includes('NaN')));
    let styleWrites = 0;
    const observer = new MutationObserver(records => { styleWrites += records.length; });
    observer.observe(container, { subtree: true, attributes: true, attributeFilter: ['style'] });
    await nextFrame(); await nextFrame(); await nextFrame();
    observer.disconnect();
    particles.forEach(p => p.animation.finish());
    await new Promise(resolve => setTimeout(resolve, 50));
    const recycled = fx._activeParticles.length === 0 && fx._particlePool.length === 16;

    fx.startAmbient();
    const highAmbient = fx._ambientEls.length;
    fx.trailStart(100, 100, '#ffffff');
    let draws = 0;
    const draw = fx._drawTrail.bind(fx);
    fx._drawTrail = () => { draws++; draw(); };
    for (let i = 0; i < 100; i++) fx.trailMove(100 + i / 10, 100 + i / 10);
    await nextFrame();
    const coalesced = draws === 1 && fx._trailPoints.length <= 60;
    const bounds = fx._trailBounds;
    const boundedClear = bounds.w * bounds.h < 400 * 600 / 4;
    fx._clearTrailCanvas();
    const pixels = fx._ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const noTrailGhosts = !pixels.some((value, index) => index % 4 === 3 && value !== 0);
    const changeTier = tier => {
      document.body.dataset.perfMode = tier;
      window.dispatchEvent(new CustomEvent('scs:perftier', { detail: { tier } }));
    };
    changeTier('mid');
    const midPixels = canvas.width * canvas.height;
    const midAmbient = fx._ambientEls.length;
    fx.particles(100, 100, '#ffffff', 100);
    const midBounded = fx._activeParticles.length <= 8;
    changeTier('low');
    const lowPixels = canvas.width * canvas.height;
    const lowStopsWork = fx.lowPerf && fx._ambientEls.length === 0 && fx._activeParticles.length === 0;
    fx.trailStart(100, 100, '#ffffff');
    fx.trailMove(110, 110);
    window.dispatchEvent(new CustomEvent('scs:motionpreference', { detail: { reduced: true } }));
    const motionStopsWork = fx.reduced && !fx._trailActive && !fx._trailDrawRaf && !fx._trailPoints.length;
    fx.particles(100, 100, '#ffffff', 10);
    fx.confetti(20);
    const reducedEmitsNothing = fx._activeParticles.length === 0 && !document.querySelector('.confetti-piece');
    fx.cleanup();
    const cleanup = container.getAnimations({ subtree: true }).length === 0 && fx._ownedNodes.size === 0;

    const input = new SwipeHandler(container);
    input.bind();
    const corner = container.querySelector('[data-dir="ul"]');
    let reads = 0;
    const rect = corner.getBoundingClientRect.bind(corner);
    corner.getBoundingClientRect = () => { reads++; return rect(); };
    const first = input._hitTestCorner(30, 30);
    for (let i = 0; i < 100; i++) input._hitTestCorner(30, 30);
    const cachedInput = first === 'ul' && reads === 1;
    corner.style.top = '150px';
    window.dispatchEvent(new Event('resize'));
    const resizedInput = input._hitTestCorner(30, 170) === 'ul' && input._hitTestCorner(30, 30) === null && reads === 2;
    input.unbind();
    return { bounded, compositorOnly, styleWrites, recycled, highAmbient, midAmbient, coalesced, boundedClear,
      highPixels, midPixels, lowPixels, noTrailGhosts, midBounded, lowStopsWork, motionStopsWork, reducedEmitsNothing, cleanup, cachedInput, resizedInput };
  }, server.baseUrl);
  for (const key of ['bounded', 'compositorOnly', 'recycled', 'coalesced', 'boundedClear', 'noTrailGhosts', 'midBounded', 'lowStopsWork', 'motionStopsWork', 'reducedEmitsNothing', 'cleanup', 'cachedInput', 'resizedInput']) {
    assert.equal(work[key], true, key);
  }
  assert.equal(work.styleWrites, 0, 'Particles must not rewrite DOM styles on every frame');
  assert.equal(work.highAmbient, 4);
  assert.equal(work.midAmbient, 2);
  assert.equal(work.midPixels, work.highPixels * .5625, 'Mid-tier canvas allocation');
  assert.equal(work.lowPixels, work.highPixels / 4, 'Low-tier canvas allocation');
  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS bounded compositor particles, pooled cleanup, coalesced/dirty-region trails, tier budgets, cached/resized hit targets');

  for (const pinned of [false, true]) {
    const { context, page } = await fixture();
    const governor = await page.evaluate(async ({ base, pinned }) => {
      Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
      localStorage.setItem('scs_perf_tier', 'low'); // Obsolete decisions must not become a permanent quality setting.
      if (pinned) { localStorage.setItem('scsQa', '1'); localStorage.setItem('scsQaPerfTier', 'high'); }
      const queue = new Map();
      let id = 0, now = 100;
      window.requestAnimationFrame = callback => { queue.set(++id, callback); return id; };
      window.cancelAnimationFrame = key => queue.delete(key);
      const advance = (dt, count) => {
        for (let i = 0; i < count; i++) {
          now += dt;
          const callbacks = [...queue.values()]; queue.clear();
          callbacks.forEach(callback => callback(now));
        }
      };
      const perf = await import(`${base}/js/helpers/perfMode.js`);
      perf.initPerfMode();
      const idle = queue.size === 0 && document.body.dataset.perfMode === 'high';
      perf.setGameplayPerformanceActive(true);
      advance(1000 / 60, 200);
      const fastStaysHigh = document.body.dataset.perfMode === 'high';
      perf.setGameplayPerformanceActive(false);
      const paused = queue.size === 0;
      perf.setGameplayPerformanceActive(true);
      let hidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      document.dispatchEvent(new Event('visibilitychange'));
      advance(300, 20);
      const backgroundSuspended = queue.size === 0 && document.body.dataset.perfMode === 'high';
      hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
      advance(300, 20); // These stalls were previously ignored entirely (>250ms).
      const finalTier = document.body.dataset.perfMode;
      const settled = queue.size === 0;
      return { idle, fastStaysHigh, paused, backgroundSuspended, finalTier, settled };
    }, { base: server.baseUrl, pinned });
    assert.ok(governor.idle && governor.fastStaysHigh && governor.paused && governor.backgroundSuspended && governor.settled);
    assert.equal(governor.finalTier, pinned ? 'high' : 'low');
    await context.close();
  }
  console.log('PASS governor idle/pause budgets, sustained severe stalls, session-scoped decisions, pinned QA tier');
  console.log('Performance release tests passed.');
} finally {
  await browser.close();
  await server.close();
}
