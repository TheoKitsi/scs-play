import Phaser from 'phaser';
import { arenaWorld } from '../renderers/arenaWorld.js';

/* Hybrid engine stage: Phaser owns architecture, stations, energy and contact
   animation. The DOM remains authoritative for readable task faces, ARIA and
   stationary input rectangles. No question, answer or RNG data is accepted. */
const palette = { floor: 0x142939, edge: 0x3e666c, rail: 0x86b9b4, mint: 0x9befcc, gold: 0xffd58c, ink: 0x091724 };
const STEPS = { calm: 0, flow: 1, charged: 2, surge: 3, fever: 4 };

function themePalette(root) {
  // Read once at mount, not in an answer/frame callback. Themes affect neutral
  // architecture only; exact task palettes and success colours stay intact.
  const style = getComputedStyle(root);
  const token = (key, fallback) => {
    const value = style.getPropertyValue(key).trim();
    return /^#[\da-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fallback;
  };
  const floor = token('--surface', palette.floor), rail = token('--primary-glow', palette.rail);
  const mix = shift => Math.round(((floor >> shift) & 255) * .75 + ((rail >> shift) & 255) * .25);
  return { ...palette, floor, rail, ink: token('--bg', palette.ink), edge: (mix(16) << 16) | (mix(8) << 8) | mix(0) };
}

function polygon(x, y, w, h, cut = 15) {
  const c = Math.min(cut, w / 4, h / 4);
  return [{ x: x - w / 2 + c, y: y - h / 2 }, { x: x + w / 2 - c, y: y - h / 2 },
    { x: x + w / 2, y: y - h / 2 + c }, { x: x + w / 2, y: y + h / 2 - c },
    { x: x + w / 2 - c, y: y + h / 2 }, { x: x - w / 2 + c, y: y + h / 2 },
    { x: x - w / 2, y: y + h / 2 - c }, { x: x - w / 2, y: y - h / 2 + c }];
}

class ArcadeScene extends Phaser.Scene {
  constructor(owner) { super('arcade-world'); this.owner = owner; this.impacts = []; this.clock = 0; this.lastFlash = null; this.acceptedHits = 0; }

  create() {
    this.architecture = this.add.graphics();
    this.stations = this.add.graphics();
    this.response = this.add.graphics();
    this.owner.boot(this);
  }

  redraw() {
    const { geometry: geo, world, energy, phase, palette } = this.owner;
    if (!geo || !this.architecture) return;
    const g = this.architecture.clear(), p = this.stations.clear();
    const { center: c, targets } = geo;
    const x = geo.width / 2, y = c.y;
    const left = Math.min(...targets.map(t => t.x - t.w / 2), c.x - c.w / 2) - 12;
    const right = Math.max(...targets.map(t => t.x + t.w / 2), c.x + c.w / 2) + 12;
    const top = Math.min(...targets.map(t => t.y - t.h / 2), c.y - c.h / 2) - 15;
    const bottom = Math.max(...targets.map(t => t.y + t.h / 2), c.y + c.h / 2) + 18;
    const w = Math.min(geo.width - 24, right - left), h = bottom - top;
    const cy = (top + bottom) / 2;
    const ink = phase === 'fever' ? palette.gold : palette.mint;
    const level = STEPS[energy] || 0;
    g.fillStyle(0x060f1c, 0.4); g.fillEllipse(x, bottom + 18, w * 0.95, 38);
    g.fillStyle(palette.edge); g.fillPoints(polygon(x, cy + 9, w, h, world.id === 'beginner' ? 35 : 18), true);
    g.fillStyle(palette.floor); g.fillPoints(polygon(x, cy, w, h, world.id === 'beginner' ? 35 : 18), true);
    g.lineStyle(1, palette.edge, 0.8); g.strokePoints(polygon(x, cy, w, h, world.id === 'beginner' ? 35 : 18), true);
    const l = x - w / 2, r = x + w / 2;
    if (world.family === 'think') {
      g.lineStyle(1, palette.rail, 0.045);
      for (let xx = l + 15; xx < r - 10; xx += 32) g.lineBetween(xx, top + 14, xx, bottom - 14);
      for (let yy = top + 20; yy < bottom - 10; yy += 32) g.lineBetween(l + 14, yy, r - 14, yy);
    }
    g.lineStyle(1.5, palette.rail, 0.23);
    switch (world.id) {
      case 'klassik':
        for (const yy of [top + 12, bottom - 12]) { g.lineBetween(l + 28, yy, x - 30, yy); g.lineBetween(x + 30, yy, r - 28, yy); }
        for (let i = 0; i < 8; i++) { g.lineBetween(l + 6, cy - 42 + i * 12, l + 12, cy - 42 + i * 12); g.lineBetween(r - 12, cy - 42 + i * 12, r - 6, cy - 42 + i * 12); }
        break;
      case 'beginner':
        g.strokePoints(polygon(x, cy, w - 16, h - 16, 32), true);
        for (const t of targets) { g.lineStyle(1, palette.rail, 0.18); g.strokeCircle(t.x, t.y, Math.max(t.w, t.h) * 0.64); }
        break;
      case 'expert': {
        const radius = Math.max(c.w / 2 + 26, Math.min(w, h) * 0.41);
        g.lineStyle(1, palette.rail, 0.18); g.strokeEllipse(x, y, radius * 2, Math.min(h - 30, radius * 2.3));
        for (let i = 0; i < 32; i++) {
          const a = i * Math.PI / 16;
          g.lineBetween(x + Math.cos(a) * (radius - 4), y + Math.sin(a) * (radius - 4), x + Math.cos(a) * (radius + (i % 4 ? 2 : 7)), y + Math.sin(a) * (radius + (i % 4 ? 2 : 7)));
        }
        break;
      }
      case 'mathe':
        for (let i = 0; i < 12; i++) g.lineBetween(l + 14, top + 24 + i * (h - 48) / 11, l + (i % 3 ? 19 : 25), top + 24 + i * (h - 48) / 11);
        g.strokeRoundedRect(l + 7, top + 7, w - 14, h - 14, 12);
        break;
      case 'wissen':
        g.beginPath(); g.moveTo(x, top + 22); g.lineTo(x, bottom - 20); g.strokePath();
        for (let i = 0; i < 5; i++) { g.lineBetween(l + 20, top + 23 + i * 7, l + 48, top + 23 + i * 7); g.lineBetween(r - 48, bottom - 23 - i * 7, r - 20, bottom - 23 - i * 7); }
        break;
      case 'memo':
        g.strokeRoundedRect(l + 7, top + 7, w - 14, Math.max(18, h * 0.1), 7);
        g.strokeRoundedRect(l + 7, bottom - 7 - Math.max(18, h * 0.1), w - 14, Math.max(18, h * 0.1), 7);
        break;
      case 'sequenz':
        for (const t of targets) { g.strokePoints(polygon(t.x, t.y, t.w + 19, t.h + 19, 12), true); }
        break;
      case 'stroop':
        for (const yy of [top + 10, top + 16, bottom - 10, bottom - 16]) g.lineBetween(l + 24, yy, r - 24, yy);
        break;
      case 'fokus':
        for (const offset of [19, 26]) g.strokeEllipse(x, y, c.w + offset * 2, c.h + offset * 2);
        break;
      case 'chaos':
        for (let i = 0; i < 6; i++) { const xx = l + 26 + i * (w - 52) / 5; g.strokePoints(polygon(xx, top + 11, 10, 6, 2), true); g.strokePoints(polygon(xx, bottom - 11, 10, 6, 2), true); }
        break;
    }
    // Neutral stations are game objects. Task faces remain crisp DOM overlays.
    for (const t of [...targets, { ...c, dir: 'center' }]) {
      const inset = t.dir === 'center' ? 7 : 5;
      p.fillStyle(palette.ink, 0.8); p.fillRoundedRect(t.x - t.w / 2 - inset, t.y - t.h / 2 + 8, t.w + inset * 2, t.h + inset * 2, 15);
      p.lineStyle(1, palette.rail, 0.3); p.strokeRoundedRect(t.x - t.w / 2 - inset, t.y - t.h / 2 - inset, t.w + inset * 2, t.h + inset * 2, 15);
    }
    // Energy is quantized and peripheral, never a direction hint.
    for (const xx of [l + 4, r - 4]) for (let i = 0; i < 5; i++) {
      g.lineStyle(2, i <= level ? ink : palette.rail, i <= level ? 0.7 : 0.16);
      g.lineBetween(xx, cy + 30 - i * 13, xx, cy + 23 - i * 13);
    }
  }

  hit(direction, quality) {
    const t = this.owner.geometry?.targets.find(t => t.dir === direction);
    if (!t || !this.owner.live) return;
    this.acceptedHits++;
    // Mid/low retain the existing local DOM contact cue without paying for
    // another series of full-canvas renders on a constrained device.
    if (this.owner.reduced || this.owner.tier !== 'high') return;
    this.impacts.push({ target: t, quality, born: this.clock });
    if (this.impacts.length > 2) this.impacts.shift();
    this.owner.requestRender();
  }

  update(_time, delta) {
    if (!this.owner.live) return;
    this.clock += Math.min(delta, 75) / 1000;
    const active = this.impacts.filter(p => this.clock - p.born < 0.18);
    if (!active.length && !this.impacts.length && !this.lastFlash) return;
    this.impacts = active;
    const g = this.response.clear();
    const c = this.owner.geometry?.center;
    if (!c) return;
    for (const p of active) {
      const t = (this.clock - p.born) / 0.18, a = 1 - t;
      const color = p.quality === 'bonus' ? palette.gold : palette.mint;
      g.lineStyle(2, color, a * 0.7);
      g.strokeRoundedRect(p.target.x - p.target.w / 2 - 8 - t * 5, p.target.y - p.target.h / 2 - 8 - t * 5, p.target.w + 16 + t * 10, p.target.h + 16 + t * 10, 15);
      if (this.owner.tier === 'high' && this.owner.world.family === 'sort') {
        const angle = Math.atan2(p.target.y - c.y, p.target.x - c.x);
        const distance = Math.hypot(p.target.x - c.x, p.target.y - c.y);
        const d = c.w / 2 + 14 + Math.max(0, distance - c.w / 2 - 32) * t;
        g.fillStyle(color, a * 0.65); g.fillCircle(c.x + Math.cos(angle) * d, c.y + Math.sin(angle) * d, 2.5);
      }
    }
    if (this.lastFlash) {
      const flash = this.lastFlash;
      if (this.clock >= flash.until) this.lastFlash = null;
      else { g.lineStyle(3, 0xe8fff2, 0.9); g.strokeRoundedRect(flash.target.x - flash.target.w / 2 - 8, flash.target.y - flash.target.h / 2 - 8, flash.target.w + 16, flash.target.h + 16, 15); }
    }
  }
}

export function createArcadeArena(root, mode, onContextLost, depthEnabled = false) {
  const layer = document.createElement('div');
  layer.className = 'arcade-engine-layer'; layer.setAttribute('aria-hidden', 'true');
  root.prepend(layer);
  let scene = null, game = null, destroyed = false, resizeFrame = 0;
  let startupTimer = null;
  let renderedFrames = 0;
  let directions = [], energy = 'calm', phase = 'calm', live = false, geometry = null;
  let depthFrame = 0, depthX = 0, depthY = 0;
  const listeners = new AbortController();
  const owner = {
    world: arenaWorld(mode), live, energy, phase, geometry, tier: document.body.dataset.perfMode || 'high',
    palette: themePalette(root),
    reduced: document.body.hasAttribute('data-reduced-motion'),
    requestRender,
    boot(value) {
      if (destroyed) return;
      clearTimeout(startupTimer); startupTimer = null;
      scene = value; root.dataset.arcadeEngine = 'ready';
      measure();
      scene.redraw();
      if (!live || document.hidden) game.loop.sleep();
    },
  };

  // The arcade simulation owns its own timers. Static architecture needs no
  // continuous engine loop; wake only for a changed scene or bounded feedback.
  function requestRender() {
    if (destroyed || !scene || !live || document.hidden || game.loop.running) return;
    game.loop.resetDelta();
    game.loop.wake();
  }

  function measure() {
    resizeFrame = 0;
    if (destroyed || !root.classList.contains('active')) return;
    const box = root.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const rect = el => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, w: r.width, h: r.height };
    };
    const center = root.querySelector('#centerPlatform');
    if (!center) return;
    geometry = { width: box.width, height: box.height, center: rect(center), targets: directions.flatMap(dir => {
      const el = root.querySelector(`.corner-shape[data-dir="${dir}"]`);
      return el?.offsetParent ? [{ dir, ...rect(el) }] : [];
    }) };
    owner.geometry = geometry;
    const size = surfaceSize(box);
    if (game?.isBooted && (game.scale.width !== size.width || game.scale.height !== size.height)) game.scale.resize(size.width, size.height);
    scene?.cameras.main.setViewport(0, 0, size.width, size.height).setOrigin(0, 0).setZoom(size.zoom);
    scene?.redraw();
    requestRender();
  }

  function scheduleMeasure() {
    resetDepth();
    if (!resizeFrame && !destroyed) resizeFrame = requestAnimationFrame(measure);
  }

  function activity(value) {
    if (destroyed) return;
    live = Boolean(value) && !document.hidden && root.classList.contains('active'); owner.live = live;
    if (!scene) return;
    if (live) { requestRender(); scheduleMeasure(); }
    else { resetDepth(); scene.impacts.length = 0; scene.lastFlash = null; scene.response.clear(); game.loop.sleep(); }
  }

  function policy() {
    if (destroyed) return;
    resetDepth();
    owner.tier = document.body.dataset.perfMode || 'high';
    owner.reduced = document.body.hasAttribute('data-reduced-motion');
    if (scene) { scene.impacts.length = 0; scene.response.clear(); }
    if (game?.isBooted) game.loop.setFPSLimit(owner.tier === 'low' ? 30 : 60);
    requestRender();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true; listeners.abort(); observer.disconnect();
    clearTimeout(startupTimer); startupTimer = null;
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resetDepth();
    scene?.impacts.splice(0); scene?.response.clear();
    game?.loop?.wake(); game?.destroy(true);
    live = false; owner.live = false; scene = game = null;
    layer.remove(); delete root.dataset.arcadeEngine;
  }

  const observer = new ResizeObserver(scheduleMeasure); observer.observe(root);
  function resetDepth() {
    if (depthFrame) cancelAnimationFrame(depthFrame);
    depthFrame = 0;
    if (scene && (scene.architecture.x || scene.architecture.y)) {
      scene.architecture.setPosition(0, 0);
      requestRender();
    }
  }
  root.addEventListener('pointermove', event => {
    if (!depthEnabled || !live || owner.reduced || owner.tier !== 'high' || event.isPrimary === false || !geometry) return;
    depthX = Math.max(-4, Math.min(4, (event.clientX / geometry.width * 2 - 1) * 4));
    depthY = Math.max(-3, Math.min(3, (event.clientY / geometry.height * 2 - 1) * 3));
    if (!depthFrame) depthFrame = requestAnimationFrame(() => {
      depthFrame = 0;
      if (scene && live) { scene.architecture.setPosition(depthX, depthY); requestRender(); }
    });
  }, { signal: listeners.signal, passive: true });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) root.addEventListener(type, resetDepth, { signal: listeners.signal, passive: true });
  window.addEventListener('scs:arenadepth', ({ detail }) => { depthEnabled = detail.enabled; resetDepth(); }, { signal: listeners.signal });
  for (const type of ['resize', 'orientationchange']) window.addEventListener(type, scheduleMeasure, { signal: listeners.signal, passive: true });
  for (const type of ['scs:motionpreference', 'scs:perftier']) window.addEventListener(type, policy, { signal: listeners.signal });
  window.addEventListener('scs:screenchange', ({ detail }) => {
    if (detail.id !== 'game') activity(false);
    if (['home', 'auth', 'prism', 'results'].includes(detail.id)) destroy();
  }, { signal: listeners.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) activity(false); }, { signal: listeners.signal });
  const box = root.getBoundingClientRect();
  function surfaceSize(box) {
    const width = box.width || innerWidth, height = box.height || innerHeight;
    const zoom = Math.min(1, 1024 / width, 1536 / height);
    return { width: Math.ceil(width * zoom), height: Math.ceil(height * zoom), zoom };
  }
  const size = surfaceSize(box);
  try {
    root.dataset.arcadeEngine = 'loading';
    // A failed asynchronous GPU boot must also release observers/listeners and
    // leave the fully playable DOM/SVG fallback, not a permanent loading layer.
    startupTimer = setTimeout(destroy, 10000);
    game = new Phaser.Game({ type: Phaser.AUTO, parent: layer, width: size.width, height: size.height,
      transparent: true, banner: false, render: { antialias: true, powerPreference: 'low-power' },
      input: { mouse: false, touch: false, keyboard: false, gamepad: false }, audio: { noAudio: true },
      fps: { target: 60, limit: owner.tier === 'low' ? 30 : 60, smoothStep: false }, scene: [new ArcadeScene(owner)],
      callbacks: { postBoot: instance => {
        instance.events.on(Phaser.Core.Events.POST_RENDER, () => {
          renderedFrames++;
          if (!destroyed && scene && (!live || (!scene.impacts.length && !scene.lastFlash))) instance.loop.sleep();
        });
        instance.canvas.addEventListener('webglcontextlost', event => {
          event.preventDefault(); activity(false); onContextLost?.(); queueMicrotask(destroy);
        }, { signal: listeners.signal });
      } },
    });
  } catch { destroy(); }

  return {
    setTargets(value) {
      if (directions.length === value.length && directions.every((dir, index) => dir === value[index])) return;
      directions = [...value]; scheduleMeasure();
    },
    setEnergy(value) { if (energy !== value) { energy = value; owner.energy = value; scene?.redraw(); requestRender(); } },
    setPhase(value) { if (phase !== value) { phase = value; owner.phase = value; scene?.redraw(); requestRender(); } },
    setActive: activity,
    clearFeedback() {
      if (scene && (scene.impacts.length || scene.lastFlash)) {
        scene.impacts.length = 0; scene.lastFlash = null; scene.response.clear(); requestRender();
      }
    },
    hit(direction, quality) { scene?.hit(direction, quality); },
    flash(direction, duration) {
      const target = geometry?.targets.find(t => t.dir === direction);
      if (scene && target && live) { scene.lastFlash = { target, until: scene.clock + duration / 1000 }; requestRender(); }
    },
    snapshot() { return { mode, backend: game?.renderer?.type === Phaser.WEBGL ? 'webgl' : 'canvas', ready: Boolean(scene) && !destroyed,
      live, phase, energy, targets: geometry?.targets.length || 0, hits: scene?.acceptedHits || 0, effects: scene?.impacts.length || 0,
      pixels: game?.canvas ? game.canvas.width * game.canvas.height : 0, loopRunning: Boolean(game?.loop.running),
      renderedFrames,
      tier: owner.tier, reduced: owner.reduced, fpsLimit: game?.loop.fpsLimit || 0,
      palette: { ...owner.palette },
      depth: { x: scene?.architecture.x || 0, y: scene?.architecture.y || 0 }, flash: scene?.lastFlash?.target.dir || null }; },
    destroy,
  };
}
