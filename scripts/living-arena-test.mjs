import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { shapeSVG } from '../js/renderers/shapes.js';
import { arenaWorld, arenaBlueprint } from '../js/renderers/arenaWorld.js';
import { startStaticServer } from './lib/static-server.mjs';

const shapes = ['circle', 'square', 'triangle', 'star', 'diamond', 'hexagon', 'pentagon', 'cross', 'heart', 'crescent', 'arrow', 'bolt'];
const palette = ['#FF4757', '#3742FA', '#2ED573', '#FFA502', '#FF6348', '#A55EEA', '#A4B0BE', '#18DCFF'];
const modes = ['klassik', 'beginner', 'expert', 'mathe', 'wissen', 'memo', 'sequenz', 'stroop', 'fokus', 'chaos'];
assert.equal(new Set(modes.map(mode => arenaWorld(mode).path)).size, 10, 'Each advertised mode has its own static architecture');
assert.equal(arenaWorld('toString').id, 'klassik', 'Unknown/inherited keys must use a safe world');
assert.equal(arenaWorld('algebra').family, 'think');
for (const mode of modes) assert.equal(/<text|<animate|<filter/.test(arenaBlueprint(mode)), false, 'Worlds contain no task answers or animated SVG paint');
for (const shape of shapes) {
  const svg = shapeSVG(shape, palette[0], 64);
  assert.ok(svg.includes('data-material-face="" fill="#FF4757"'));
  assert.equal(/<filter|<animate|<image/.test(svg), false, 'Materials must not add blur, a frame loop or external assets');
}

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stageMarkup = html.slice(html.indexOf('<div id="resonanceStage"'), html.indexOf('<!-- HUD -->'));
const server = await startStaticServer({ root: '.', port: 0 });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.route('**/arena-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <link rel="stylesheet" href="css/style.css"><body data-perf-mode="high">
    <div id="game" class="screen active">${stageMarkup}
      <button class="corner-shape" data-dir="ul">${shapeSVG('circle', '#FF4757', 48)}</button>
      <button id="centerPlatform" class="center-platform"><span id="centerShape" class="center-shape">${shapeSVG('circle', '#FF4757', 100)}</span></button>
    </div>` }));
  await page.goto(`${server.baseUrl}/arena-fixture`, { waitUntil: 'networkidle' });
  const lifecycle = await page.evaluate(async base => {
    const { livingArena } = await import(`${base}/js/helpers/livingArena.js`);
    livingArena.configure('klassik');
    const stage = document.querySelector('#resonanceStage');
    const signal = stage.querySelector('.arena-signal');
    const corner = document.querySelector('.corner-shape');
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const running = () => stage.getAnimations({ subtree: true }).filter(a => a.playState === 'running');
    const ambient = () => running().filter(a => a.animationName === 'arena-light-drift');
    const supportedKeys = ['offset', 'computedOffset', 'easing', 'composite', 'opacity', 'transform'];
    const compositorOnly = animations => animations.every(a => a.effect.getKeyframes().every(k => Object.keys(k).every(key => supportedKeys.includes(key))));
    let requestedGeometry = 0;
    const coordinates = () => { requestedGeometry++; return { x: -120, y: -160 }; };
    const nodeCount = stage.querySelectorAll('*').length;
    livingArena.setActive(true);
    await nextFrame();
    const highLights = ambient().length;
    const lightsCompositorOnly = compositorOnly(ambient());
    const boundedTextures = [...stage.querySelectorAll('.arena-light')].every(el => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width <= 151 && r.height <= 440 && style.filter === 'none' && style.pointerEvents === 'none';
    });
    const noPreAnswerHint = !stage.dataset.confirmedDirection && signal.getAnimations().length === 0;
    let styleWrites = 0;
    const observer = new MutationObserver(records => { styleWrites += records.length; });
    observer.observe(stage, { subtree: true, attributes: true });
    await nextFrame(); await nextFrame(); await nextFrame();
    observer.disconnect();
    const noFrameWrites = styleWrites === 0;

    const rect = () => {
      const r = corner.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    };
    const before = rect();
    livingArena.confirm('ul', coordinates);
    corner.classList.add('corner-correct');
    const firstImpulse = signal.getAnimations()[0];
    const committedDirection = stage.dataset.confirmedDirection;
    const hitAnimations = [...running(), ...corner.getAnimations({ subtree: true })];
    const hitCompositorOnly = compositorOnly(hitAnimations);
    const invalidHitProperties = hitAnimations.flatMap(a => a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(key => !supportedKeys.includes(key))));
    await nextFrame();
    const hitTargetStable = before.every((value, i) => value === rect()[i]);
    for (let i = 0; i < 100; i++) livingArena.confirm('ul', coordinates);
    const boundedImpulse = signal.getAnimations().length <= 1 && firstImpulse.playState === 'idle' && nodeCount === stage.querySelectorAll('*').length;
    livingArena.clearConfirmation();
    const nextSpawnNeutral = !stage.dataset.confirmedDirection && signal.getAnimations().length === 0;
    corner.classList.remove('corner-correct');

    const tier = value => {
      document.body.dataset.perfMode = value;
      window.dispatchEvent(new CustomEvent('scs:perftier', { detail: { tier: value } }));
    };
    tier('mid');
    requestedGeometry = 0;
    livingArena.confirm('ul', coordinates);
    const midIsStatic = ambient().length === 0 && signal.getAnimations().length === 0 && requestedGeometry === 0;
    tier('high');
    livingArena.confirm('ul', coordinates);
    const cancelledOnTierChange = signal.getAnimations()[0];
    tier('low');
    corner.classList.add('corner-correct');
    await nextFrame();
    const lowStopsWork = !stage.hasAttribute('data-live') && running().length === 0
      && cancelledOnTierChange.playState === 'idle' && corner.getAnimations({ subtree: true }).length === 0;
    corner.classList.remove('corner-correct');
    tier('high');
    document.body.setAttribute('data-reduced-motion', '');
    window.dispatchEvent(new CustomEvent('scs:motionpreference'));
    livingArena.confirm('ul', coordinates);
    await nextFrame();
    const reducedStopsWork = !stage.hasAttribute('data-live') && running().length === 0 && signal.getAnimations().length === 0;
    const reducedState = { live: stage.hasAttribute('data-live'), animations: running().map(a => ({ name: a.animationName, property: a.transitionProperty, target: a.effect.target?.className, timing: a.effect.getTiming() })) };
    document.body.removeAttribute('data-reduced-motion');
    window.dispatchEvent(new CustomEvent('scs:motionpreference'));

    document.querySelector('#game').dataset.modeWorld = 'think';
    const quietReadingWorld = ambient().length === 0;
    delete document.querySelector('#game').dataset.modeWorld;
    livingArena.confirm('ul', coordinates);
    livingArena.setActive(false);
    const pauseStopsWork = !stage.hasAttribute('data-live') && !stage.dataset.confirmedDirection && running().length === 0;
    livingArena.setActive(true);
    let hidden = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
    const hiddenStopsWork = !stage.hasAttribute('data-live') && running().length === 0;
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    const resumed = stage.hasAttribute('data-live') && ambient().length === 2;
    delete document.hidden;
    livingArena.reset();
    const resetClean = running().length === 0 && !stage.hasAttribute('data-live') && !stage.dataset.confirmedDirection;
    observer.observe(stage, { subtree: true, attributes: true });
    styleWrites = 0;
    window.dispatchEvent(new CustomEvent('scs:perftier'));
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => setTimeout(resolve, 300));
    observer.disconnect();
    const noLateWork = styleWrites === 0;
    for (let i = 0; i < 20; i++) { livingArena.setActive(true); livingArena.reset(); }
    return { highLights, lightsCompositorOnly, boundedTextures, noPreAnswerHint, committedDirection,
      hitCompositorOnly, invalidHitProperties, noFrameWrites, hitTargetStable, boundedImpulse, nextSpawnNeutral, midIsStatic, lowStopsWork,
      reducedStopsWork, reducedState, quietReadingWorld, pauseStopsWork, hiddenStopsWork, resumed, resetClean, noLateWork,
      fixedNodes: stage.querySelectorAll('*').length <= nodeCount };
  }, server.baseUrl);
  assert.equal(lifecycle.highLights, 2);
  assert.equal(lifecycle.committedDirection, 'ul');
  for (const [key, value] of Object.entries(lifecycle)) {
    if (typeof value === 'boolean') assert.equal(value, true, `${key}: ${JSON.stringify({ invalidHitProperties: lifecycle.invalidHitProperties, reduced: lifecycle.reducedState })}`);
  }
  console.log('PASS Living Arena: two bounded compositor lights, single recycled impulse, stable targets, no hints, pause/visibility/tier/motion cleanup');

  const depth = await page.evaluate(async base => {
    const { livingArena } = await import(`${base}/js/helpers/livingArena.js`);
    const stage = document.querySelector('#resonanceStage');
    const field = document.querySelector('#game');
    const plane = stage.querySelector('.arena-scenery');
    const rects = () => [...document.querySelectorAll('.corner-shape,#centerPlatform')].map(el => {
      const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
    });
    const queue = new Map();
    const nativeRaf = window.requestAnimationFrame, nativeCancel = window.cancelAnimationFrame;
    let id = 0;
    window.requestAnimationFrame = callback => { queue.set(++id, callback); return id; };
    window.cancelAnimationFrame = key => queue.delete(key);
    const move = (x = 100000, y = -100000) => field.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, isPrimary: true, bubbles: true }));
    const flush = () => { const work = [...queue.values()]; queue.clear(); work.forEach(fn => fn(performance.now())); };
    const tier = value => { document.body.dataset.perfMode = value; window.dispatchEvent(new CustomEvent('scs:perftier')); };
    const results = {};
    try {
      tier('high');
      livingArena.configure('klassik'); livingArena.setActive(true);
      move();
      results.optInOnly = queue.size === 0 && plane.style.transform === '';
      const states = [];
      for (const [streak, fever] of [[0, false], [5, false], [15, false], [30, false], [30, true], [0, false]]) {
        livingArena.setEnergy(streak, fever); states.push(stage.dataset.energy);
      }
      results.stages = states.join(',') === 'calm,flow,charged,surge,fever,calm';
      const artwork = plane.innerHTML;
      let writes = 0;
      const observer = new MutationObserver(records => { writes += records.length; });
      observer.observe(stage, { subtree: true, attributes: true, childList: true });
      for (let i = 0; i < 100; i++) livingArena.setEnergy(0, false);
      await Promise.resolve(); observer.disconnect();
      results.phaseDiffing = writes === 0 && plane.innerHTML === artwork;
      livingArena.setDepthEnabled(true);
      const before = rects();
      const originalRect = Element.prototype.getBoundingClientRect;
      let reads = 0;
      Element.prototype.getBoundingClientRect = function () { reads++; return originalRect.call(this); };
      try {
        for (let i = 0; i < 100; i++) move();
        results.coalesced = queue.size === 1;
        flush();
        results.noLayoutReads = reads === 0;
      } finally { Element.prototype.getBoundingClientRect = originalRect; }
      // Validate computed geometry rather than browser-specific serialization.
      const matrix = new DOMMatrix(getComputedStyle(plane).transform);
      results.bounded = Math.abs(matrix.m41) <= 4 && Math.abs(matrix.m42) <= 3 && matrix.m41 !== 0;
      results.fixedTargets = JSON.stringify(before) === JSON.stringify(rects()) && getComputedStyle(stage).transform === 'none';
      const correction = document.querySelector('.corner-shape');
      correction.classList.add('show-correct');
      results.fixedCorrection = JSON.stringify(before) === JSON.stringify(rects());
      correction.classList.remove('show-correct');
      move(); livingArena.setActive(false);
      results.pauseCancels = queue.size === 0 && plane.style.transform === '';
      move(); results.pausedUnbound = queue.size === 0;
      livingArena.setActive(true); move(); tier('mid');
      results.midCancels = queue.size === 0 && plane.style.transform === '';
      move(); results.midUnbound = queue.size === 0;
      tier('high'); move();
      document.body.setAttribute('data-reduced-motion', '');
      window.dispatchEvent(new CustomEvent('scs:motionpreference'));
      results.motionCancels = queue.size === 0 && plane.style.transform === '';
      document.body.removeAttribute('data-reduced-motion');
      window.dispatchEvent(new CustomEvent('scs:motionpreference'));
      move();
      let hidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      document.dispatchEvent(new Event('visibilitychange'));
      results.hiddenCancels = queue.size === 0 && plane.style.transform === '';
      move(); results.hiddenUnbound = queue.size === 0;
      hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
      move(); livingArena.setDepthEnabled(false);
      results.optOutCancels = queue.size === 0 && plane.style.transform === '';
      move(); results.optOutUnbound = queue.size === 0;
      livingArena.configure('mathe');
      livingArena.setEnergy(7, false); const first = stage.dataset.energy;
      livingArena.setEnergy(8, false); const second = stage.dataset.energy;
      livingArena.setEnergy(18, false); const third = stage.dataset.energy;
      results.readingPace = `${first},${second},${third}` === 'calm,flow,charged';
      livingArena.setDepthEnabled(true); move(); livingArena.reset();
      move(); results.resetUnbound = queue.size === 0 && plane.style.transform === '' && !stage.dataset.world && !stage.dataset.energy;
      livingArena.configure('memo', true);
      livingArena.reset();
      results.cancelBeforeStart = !stage.dataset.world && !stage.dataset.energy && plane.childElementCount === 0;
      return results;
    } finally {
      livingArena.reset();
      window.requestAnimationFrame = nativeRaf; window.cancelAnimationFrame = nativeCancel;
    }
  }, server.baseUrl);
  for (const [key, value] of Object.entries(depth)) assert.equal(value, true, key);
  console.log('PASS ten distinct static worlds, diffed five-stage energy, opt-in/coalesced ±4/3px background depth, zero layout reads, stable hit areas and lifecycle cancellation');

  const rendered = await page.evaluate(async ({ base, palette, shapes }) => {
    const { shapeSVG } = await import(`${base}/js/renderers/shapes.js`);
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 67;
    const ctx = canvas.getContext('2d');
    const samples = [];
    for (const color of palette) {
      const image = new Image();
      image.src = `data:image/svg+xml,${encodeURIComponent(shapeSVG('square', color, 64))}`;
      await image.decode();
      ctx.clearRect(0, 0, 64, 67);
      ctx.drawImage(image, 0, 0, 64, 67);
      samples.push([...ctx.getImageData(32, 32, 1, 1).data]);
    }
    const silhouettes = [];
    for (const shape of shapes) {
      const image = new Image();
      image.src = `data:image/svg+xml,${encodeURIComponent(shapeSVG(shape, palette[0], 64))}`;
      await image.decode();
      ctx.clearRect(0, 0, 64, 67);
      ctx.drawImage(image, 0, 0, 64, 67);
      const pixels = ctx.getImageData(0, 0, 64, 67).data;
      silhouettes.push(pixels.filter((value, i) => i % 4 === 3 && value > 0).length);
    }
    return { samples, silhouettes };
  }, { base: server.baseUrl, palette, shapes });
  palette.forEach((color, i) => assert.deepEqual(rendered.samples[i], [...color.slice(1).match(/../g).map(hex => parseInt(hex, 16)), 255], `${color}: center face keeps its exact answer color`));
  shapes.forEach((shape, i) => assert.ok(rendered.silhouettes[i] > 100, `${shape}: actual SVG rasterization retains the silhouette`));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const osMotion = await page.evaluate(async base => {
    const { livingArena } = await import(`${base}/js/helpers/livingArena.js`);
    livingArena.setActive(true);
    livingArena.confirm('ul', () => ({ x: 100, y: 100 }));
    const stage = document.querySelector('#resonanceStage');
    const result = !stage.hasAttribute('data-live') && stage.querySelector('.arena-signal').getAnimations().length === 0;
    livingArena.reset();
    return result;
  }, server.baseUrl);
  assert.equal(osMotion, true, 'OS motion reduction must work even before the body flag updates');
  assert.deepEqual(errors, []);
  console.log('PASS all 12 material silhouettes, exact normal/colorblind face colors, OS reduced motion');
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
