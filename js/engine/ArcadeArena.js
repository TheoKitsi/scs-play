import Phaser from 'phaser';
import { arenaWorld } from '../renderers/arenaWorld.js';
import { renderSurface } from './renderSurface.js';
import { MATERIAL_ASSETS } from './materialAssets.js';
import { createStudioMaterial, preloadStudioMaterial } from './studioMaterial.js';
import { arcadeFrame } from './studioArchitecture.js';

/* Hybrid engine stage: Phaser owns architecture, stations, energy and contact
   animation. The DOM remains authoritative for readable task faces, ARIA and
   stationary input rectangles. No question, answer or RNG data is accepted. */
const palette = { floor: 0x142939, edge: 0x3e666c, rail: 0x86b9b4, mint: 0x9befcc, gold: 0xffd58c, ink: 0x091724 };
const STEPS = { calm: 0, flow: 1, charged: 2, surge: 3, fever: 4 };
// Static instrument finishes only. No question, covered symbol or next answer.
const FINISHES = Object.freeze({ klassik: 'ceramic', beginner: 'ceramic', expert: 'alloy', mathe: 'slate', wissen: 'slate',
  memo: 'satin', sequenz: 'alloy', stroop: 'satin', fokus: 'alloy', chaos: 'ceramic' });
const SURFACES = Object.freeze({ ceramic: { roughness: .38, metallic: .08 }, alloy: { roughness: .29, metallic: .7 },
  slate: { roughness: .72, metallic: .04 }, satin: { roughness: .48, metallic: .18 } });
// Physical silhouettes of the ten instruments, in logical pixels. The camera,
// DOM hit areas, stimuli and task palette are independent of these dimensions.
// [key radius, display radius, key depth, display depth, anodized rim tint]
const INSTRUMENT = {
  klassik:[15,36,9,13,0xa48873], beginner:[26,18,11,12,0xa69ac3],
  expert:[8,Infinity,9,14,0x74949e], mathe:[7,11,7,9,0x7f9d95],
  wissen:[12,22,8,10,0xb39a70], memo:[10,19,12,12,0xb29aa9],
  sequenz:[23,32,14,9,0x7d98b6], stroop:[12,10,7,10,0x8e969c],
  fokus:[Infinity,Infinity,8,12,0x96a69a], chaos:[18,22,10,14,0xa89890],
};
function bevelTint(floor, rim) {
  return [16,8,0].reduce((acc,shift)=>acc | Math.round(((floor>>shift)&255)*.57 + ((rim>>shift)&255)*.43)<<shift,0);
}
const deckTint = floor => {
  const lift = shift => Math.min(255, ((floor >> shift) & 255) + 28);
  return (lift(16) << 16) | (lift(8) << 8) | lift(0);
};

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

function energyRails(g, l, r, cy, level, ink, colors) {
  // Quantized and peripheral, never a direction hint.
  for (const xx of [l + 4, r - 4]) for (let i = 0; i < 5; i++) {
    g.lineStyle(2, i <= level ? ink : colors.rail, i <= level ? 0.7 : 0.16);
    g.lineBetween(xx, cy + 30 - i * 13, xx, cy + 23 - i * 13);
  }
}

class ArcadeScene extends Phaser.Scene {
  constructor(owner) { super('arcade-world'); this.owner = owner; this.impacts = []; this.clock = 0; this.lastFlash = null; this.acceptedHits = 0; }

  preload() {
    this.load.image('material-deck', MATERIAL_ASSETS.decks[this.owner.world.id]);
    preloadStudioMaterial(this);
  }

  create() {
    this.architecture = this.add.container();
    this.deck = this.textures.exists('material-deck') ? this.add.image(0, 0, 'material-deck') : null;
    if (this.deck && this.game.renderer.type === Phaser.CANVAS) {
      // Canvas rendering ignores sprite tint. Bake this one theme operation
      // once, preserving source alpha; never show an untinted white deck.
      const source = this.textures.get('material-deck').getSourceImage();
      const texture = this.textures.createCanvas('theme-deck', source.width, source.height), ctx = texture.getContext();
      ctx.drawImage(source, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `#${deckTint(this.owner.palette.floor).toString(16).padStart(6, '0')}`;
      ctx.fillRect(0, 0, source.width, source.height);
      ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(source, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; texture.refresh();
      this.deck.setTexture('theme-deck');
    }
    if (this.deck) this.architecture.add(this.deck);
    this.structure = this.add.graphics();
    this.architecture.add(this.structure);
    this.stations = this.add.graphics();
    this.energy = this.add.graphics().setDepth(1);
    this.response = this.add.graphics();
    this.solid = createStudioMaterial(this, ready => {
      if (ready) this.owner.root.dataset.arenaSolid = 'mesh-ggx';
      else delete this.owner.root.dataset.arenaSolid;
    });
    this.owner.boot(this);
  }

  redraw() {
    const { geometry: geo, world, energy, phase, palette } = this.owner;
    if (!geo || !this.architecture) return;
    const g = this.structure.clear(), p = this.stations.clear();
    const rails = this.energy.clear();
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
    const l = x - w / 2, r = x + w / 2;
    if (this.deck) {
      this.deck.setPosition(x, cy).setDisplaySize(w + 12, h + 25).setTint(deckTint(palette.floor)).setAlpha(.66);
      if (this.solidGeometry !== geo) {
        const [keyRadius,faceRadius,keyDepth,faceDepth,rim] = INSTRUMENT[world.id];
        this.solid.setObjects([arcadeFrame(x, cy, w + 12, h + 25, bevelTint(deckTint(palette.floor),rim)),
          ...[...targets, { ...c, dir: 'center' }].map(t => ({ kind: 'station', x: t.x, y: t.y, w: t.w, h: t.h,
            r: Math.min(t.w/2,t.h/2,t.dir === 'center' ? faceRadius : keyRadius), z:t.dir === 'center' ? faceDepth : keyDepth,
            color: t.dir === 'center' ? palette.edge : deckTint(palette.floor),
            finish: FINISHES[world.id], ...SURFACES[FINISHES[world.id]] }))]);
        this.solidGeometry = geo;
      }
      this.solid.setEnabled(this.owner.tier === 'high');
      this.solid.setLight(geo.width * .2, geo.height * .2, 220, 1.5);
      energyRails(rails, l, r, cy, level, ink, palette);
      return;
    } else {
      g.fillStyle(0x060f1c, 0.4); g.fillEllipse(x, bottom + 18, w * 0.95, 38);
      g.fillStyle(palette.edge); g.fillPoints(polygon(x, cy + 9, w, h, world.id === 'beginner' ? 35 : 18), true);
      g.fillStyle(palette.floor); g.fillPoints(polygon(x, cy, w, h, world.id === 'beginner' ? 35 : 18), true);
      g.lineStyle(1, palette.edge, 0.8); g.strokePoints(polygon(x, cy, w, h, world.id === 'beginner' ? 35 : 18), true);
    }
    if (world.family === 'think') {
      g.lineStyle(1, palette.rail, 0.045);
      for (let xx = l + 15; xx < r - 10; xx += 32) g.lineBetween(xx, top + 14, xx, bottom - 14);
      for (let yy = top + 20; yy < bottom - 10; yy += 32) g.lineBetween(l + 14, yy, r - 14, yy);
    }
    g.lineStyle(1.5, palette.rail, 0.23);
    switch (world.id) {
      case 'klassik':
        // The baked deck owns the surface, bevel and engraving. No second
        // chassis is painted behind the DOM faces of the material reference.
        if (!this.deck) for (const yy of [top + 12, bottom - 12]) { g.lineBetween(l + 28, yy, x - 30, yy); g.lineBetween(x + 30, yy, r - 28, yy); }
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
    // Legacy architecture/stations are only the unavailable-art fallback.
    for (const t of [...targets, { ...c, dir: 'center' }]) {
      const inset = t.dir === 'center' ? 7 : 5;
      p.fillStyle(palette.ink, 0.8); p.fillRoundedRect(t.x - t.w / 2 - inset, t.y - t.h / 2 + 8, t.w + inset * 2, t.h + inset * 2, 15);
      p.lineStyle(1, palette.rail, 0.3); p.strokeRoundedRect(t.x - t.w / 2 - inset, t.y - t.h / 2 - inset, t.w + inset * 2, t.h + inset * 2, 15);
    }
    energyRails(rails, l, r, cy, level, ink, palette);
  }

  hit(direction, quality) {
    const t = this.owner.geometry?.targets.find(t => t.dir === direction);
    if (!t || !this.owner.live) return;
    this.acceptedHits++;
    // The baked reference deck stays cached on contact: its existing local SVG
    // press/outline confirms the hit without repainting a high-DPI texture for
    // 180ms on every answer. Phase/geometry/depth changes still wake the stage.
    // Unavailable-art fallbacks retain their bounded engine response.
    if (this.deck || this.owner.reduced || this.owner.tier !== 'high') return;
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
    root, world: arenaWorld(mode), live, energy, phase, geometry, tier: document.body.dataset.perfMode || 'high',
    palette: themePalette(root),
    reduced: document.body.hasAttribute('data-reduced-motion'),
    requestRender,
    boot(value) {
      if (destroyed) return;
      clearTimeout(startupTimer); startupTimer = null;
      scene = value; root.dataset.arcadeEngine = 'ready';
      if (scene.deck) root.dataset.arenaMaterial = owner.world.id;
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
    const size = renderSurface(box.width, box.height, owner.tier, devicePixelRatio);
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
    if (owner.tier !== 'high') scene?.solid?.setEnabled(false);
    if (scene) { scene.impacts.length = 0; scene.response.clear(); }
    if (game?.isBooted) game.loop.setFPSLimit(owner.tier === 'low' ? 30 : 60);
    scheduleMeasure();
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
    layer.remove(); delete root.dataset.arcadeEngine; delete root.dataset.arenaMaterial;
    delete root.dataset.arenaSolid;
  }

  const observer = new ResizeObserver(scheduleMeasure); observer.observe(root);
  function resetDepth() {
    if (depthFrame) cancelAnimationFrame(depthFrame);
    depthFrame = 0;
    if (scene && (scene.architecture.x || scene.architecture.y)) {
      scene.architecture.setPosition(0, 0);
      scene.energy.setPosition(0, 0); scene.solid?.setStageOffset(0, 0);
      scene.solid?.setLight((geometry?.width || 0) * .2, (geometry?.height || 0) * .2, 220, 1.5);
      requestRender();
    }
  }
  root.addEventListener('pointermove', event => {
    if (!depthEnabled || !live || owner.reduced || owner.tier !== 'high' || event.isPrimary === false || !geometry) return;
    depthX = Math.max(-4, Math.min(4, (event.clientX / geometry.width * 2 - 1) * 4));
    depthY = Math.max(-3, Math.min(3, (event.clientY / geometry.height * 2 - 1) * 3));
    if (!depthFrame) depthFrame = requestAnimationFrame(() => {
      depthFrame = 0;
      if (scene && live) {
        scene.architecture.setPosition(depthX, depthY);
        scene.energy.setPosition(depthX, depthY); scene.solid?.setStageOffset(depthX, depthY);
        scene.solid?.setLight(geometry.width * .3 + depthX * 30, geometry.height * .25 + depthY * 30, 140, 1.2);
        requestRender();
      }
    });
  }, { signal: listeners.signal, passive: true });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) root.addEventListener(type, resetDepth, { signal: listeners.signal, passive: true });
  window.addEventListener('scs:arenadepth', ({ detail }) => { depthEnabled = detail.enabled; resetDepth(); }, { signal: listeners.signal });
  for (const type of ['resize', 'orientationchange']) window.addEventListener(type, scheduleMeasure, { signal: listeners.signal, passive: true });
  for (const type of ['scs:motionpreference', 'scs:perftier']) window.addEventListener(type, policy, { signal: listeners.signal });
  window.addEventListener('scs:screenchange', ({ detail }) => {
    if (detail.id !== 'game') activity(false);
    if (['home', 'hub', 'auth', 'prism', 'results'].includes(detail.id)) destroy();
  }, { signal: listeners.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) activity(false); }, { signal: listeners.signal });
  const box = root.getBoundingClientRect();
  const size = renderSurface(box.width || innerWidth, box.height || innerHeight, owner.tier, devicePixelRatio);
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
      material: Boolean(scene?.deck),
      solid: scene?.solid?.snapshot() || null,
      materialFile: scene?.deck ? MATERIAL_ASSETS.decks[owner.world.id] : null,
      palette: { ...owner.palette },
      depth: { x: scene?.architecture.x || 0, y: scene?.architecture.y || 0 }, flash: scene?.lastFlash?.target.dir || null }; },
    destroy,
  };
}
