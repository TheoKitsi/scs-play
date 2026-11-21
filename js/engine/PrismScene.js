import Phaser from 'phaser';
import { PRISM_COLORS } from '../game/prism/levels.js';
import { linkedCrystals, PrismSimulation, tracePulse } from '../game/prism/PrismSimulation.js';
import { renderSurface } from './renderSurface.js';
import { MATERIAL_ASSETS } from './materialAssets.js';
import { createStudioMaterial, preloadStudioMaterial } from './studioMaterial.js';
import { prismArchitecture } from './studioArchitecture.js';

const ink = 0x101d31;
const colorOf = key => PRISM_COLORS[key]?.hex || 0x78efc0;

function symbol(g, x, y, color, size, fill) {
  g.fillStyle(fill, 1);
  if (color === 'amber') g.fillCircle(x, y, size * 0.8);
  else if (color === 'violet') g.fillTriangle(x, y - size, x + size, y + size * 0.75, x - size, y + size * 0.75);
  else g.fillPoints([{ x, y: y - size }, { x: x + size * 0.8, y }, { x, y: y + size }, { x: x - size * 0.8, y }], true);
}

/** Phaser owns drawing/input only. Rules and progress never depend on sprites. */
class PrismScene extends Phaser.Scene {
  constructor(level, callbacks, policy) {
    super('prism-arena');
    this.simulation = new PrismSimulation(level);
    this.callbacks = callbacks;
    this.policy = policy;
    this.aim = { x: 210, y: 120 };
    this.accumulator = 0;
    this.impacts = [];
    this.clock = 0;
    this.frozen = false;
    this.crystals = new Map();
    this.growth = new Map();
    this.sprouting = new Map();
    this.completion = null;
  }

  preload() {
    preloadStudioMaterial(this);
    this.load.image('prism-terrace', MATERIAL_ASSETS.gardens[this.simulation.level.zone]);
    this.load.spritesheet('prism-crystals', MATERIAL_ASSETS.crystals, { frameWidth: 160, frameHeight: 192 });
  }

  create() {
    this.drawLandscape();
    this.objects = this.add.graphics().setDepth(2);
    this.propsFallback = this.add.graphics().setDepth(2);
    this.objectMarks = this.add.graphics().setDepth(5);
    this.staticSolids = prismArchitecture(this.simulation.level);
    this.launchSymbol = this.add.graphics().setDepth(5);
    this.guide = this.add.graphics().setDepth(5);
    this.pulse = this.add.graphics().setDepth(6);
    this.effects = this.add.graphics().setDepth(7);
    const light = this.textures.createCanvas('prism-radiance', 128, 128), ctx = light.getContext();
    const fade = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    fade.addColorStop(0, '#ffffffa0'); fade.addColorStop(.25, '#ffffff35'); fade.addColorStop(1, '#ffffff00');
    ctx.fillStyle = fade; ctx.fillRect(0, 0, 128, 128); light.refresh();
    this.restoredLight = this.add.image(210, 260, 'prism-radiance').setDisplaySize(570, 740).setTint(0xb4ffe0).setDepth(1).setAlpha(0);
    this.pulseLight = this.add.image(0, 0, 'prism-radiance').setDepth(3).setVisible(false);
    this.crystalSymbols = this.add.graphics().setDepth(5);
    this.crystalFallback = this.add.graphics().setDepth(4);
    this.solidActive = false;
    this.solid = createStudioMaterial(this, ready => {
      if (ready === this.solidActive) return;
      this.solidActive = ready;
      this.solidChanged = true;
      const parent = this.game.canvas.parentElement;
      if (parent) {
        if (ready) parent.dataset.studioRenderer = 'mesh-ggx';
        else delete parent.dataset.studioRenderer;
      }
      this.syncSolidSymbols();
    }, 4, 'garden');
    this.drawObjects();
    this.drawGuide();
    let origin = null;
    this.input.on('pointerdown', pointer => {
      if (this.frozen || this.simulation.phase !== 'ready') return;
      origin = { x: pointer.x, y: pointer.y };
      this.setAim(pointer.positionToCamera(this.cameras.main));
    });
    this.input.on('pointermove', pointer => {
      if (origin && pointer.isDown) this.setAim(pointer.positionToCamera(this.cameras.main));
    });
    this.input.on('pointerup', pointer => {
      const start = origin;
      origin = null;
      const scale = this.cameras.main.zoom;
      if (start && Math.hypot(pointer.x - start.x, pointer.y - start.y) / scale >= 14) this.fire();
    });
    this.input.on('gameout', () => { origin = null; });
    this.cancelPointer = () => { origin = null; };
    this.game.canvas.addEventListener('pointercancel', this.cancelPointer);
    this.game.canvas.addEventListener('webglcontextlost', this.callbacks.contextLost);
    this.events.once('shutdown', () => {
      this.game.canvas.removeEventListener('pointercancel', this.cancelPointer);
      this.game.canvas.removeEventListener('webglcontextlost', this.callbacks.contextLost);
      this.impacts.length = 0;
      this.endCompletion(false);
    });
    this.onRendered = () => {
      // The first render list can still contain the now-hidden baked sprites.
      // Paint the new visibility/symbol state once before sleeping, rather than
      // leaving old artwork over the mesh until the next aim/pause interaction.
      const changed = this.solidChanged;
      this.solidChanged = false;
      if (changed && !this.frozen) return;
      if (!this.needsFrames()) this.game.loop.sleep();
    };
    this.game.events.on(Phaser.Core.Events.POST_RENDER, this.onRendered);
    this.events.once('shutdown', () => this.game.events.off(Phaser.Core.Events.POST_RENDER, this.onRendered));
    this.resizeSurface?.();
    this.callbacks.ready(this);
    this.notify();
  }

  drawLandscape() {
    if (this.textures.exists('prism-terrace')) {
      this.add.image(210, 280, 'prism-terrace').setDisplaySize(420, 560);
      return;
    }
    // A single generated sky texture, no downloads, shaders or runtime asset probe.
    const texture = this.textures.createCanvas('prism-sky', 420, 560);
    const ctx = texture.getContext();
    const sky = ctx.createLinearGradient(0, 0, 420, 560);
    sky.addColorStop(0, '#152b42'); sky.addColorStop(0.55, '#102236'); sky.addColorStop(1, '#0b1729');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 420, 560); texture.refresh();
    this.add.image(210, 280, 'prism-sky');
    const g = this.add.graphics();
    // Cloud banks sit behind the playable architecture.
    g.fillStyle(0x9cc8da, 0.035);
    for (const [x, y, w, h] of [[36, 75, 135, 30], [350, 100, 150, 32], [75, 460, 180, 36]]) g.fillEllipse(x, y, w, h);
    g.fillStyle(0x050d1b, 0.35); g.fillEllipse(216, 500, 356, 80);
    g.fillStyle(0x163543); g.fillPoints([{ x: 22, y: 65 }, { x: 398, y: 65 }, { x: 398, y: 484 }, { x: 315, y: 550 }, { x: 112, y: 550 }, { x: 22, y: 490 }], true);
    g.fillStyle(0x214752); g.fillRoundedRect(20, 30, 380, 489, 32);
    g.fillStyle(0x223544); g.fillRoundedRect(26, 27, 368, 479, 28);
    g.lineStyle(1, 0x86b9b4, 0.16); g.strokeRoundedRect(26, 27, 368, 479, 28);
    // Etched tiles, kept low contrast so colour/symbol faces stay dominant.
    g.lineStyle(1, 0xa9d2ce, 0.045);
    for (let x = 55; x < 390; x += 52) g.lineBetween(x, 53, x, 482);
    for (let y = 66; y < 490; y += 52) g.lineBetween(42, y, 378, y);
    g.lineStyle(2, 0x78efc0, 0.12); g.lineBetween(52, 485, 368, 485);
    g.fillStyle(0x3a6961); g.fillTriangle(32, 489, 64, 500, 32, 512); g.fillTriangle(388, 470, 365, 504, 390, 496);
    for (const x of [40, 380]) {
      g.fillStyle(0x407d70, 0.65); g.fillEllipse(x, 56, 24, 12);
      g.fillStyle(0x65b58d, 0.7); g.fillEllipse(x - 3, 51, 16, 9);
    }
  }

  drawObjects() {
    const g = this.objects.clear(), s = this.simulation;
    const bodies = this.propsFallback.clear(), marks = this.objectMarks.clear();
    const fallback = this.crystalFallback.clear();
    for (const wall of s.level.walls) {
      bodies.fillStyle(0x0a1728, 0.7); bodies.fillRoundedRect(wall.x, wall.y + 8, wall.width, wall.height, 6);
      bodies.fillStyle(0x536271); bodies.fillRoundedRect(wall.x, wall.y, wall.width, wall.height, 6);
      marks.lineStyle(2, 0x90a2ae, 0.6); marks.lineBetween(wall.x + 7, wall.y + 3, wall.x + wall.width - 7, wall.y + 3);
    }
    for (const gate of s.gates) {
      bodies.fillStyle(0xa1b4c5); bodies.fillRoundedRect(gate.x - 4, gate.y - 4, 9, gate.height + 8, 3);
      bodies.fillRoundedRect(gate.x + gate.width - 5, gate.y - 4, 9, gate.height + 8, 3);
      if (!gate.open) {
        g.fillStyle(0xf7a8b8, 0.18); g.fillRect(gate.x + 5, gate.y, gate.width - 10, gate.height);
        g.lineStyle(2, 0xf7a8b8, 0.85); g.lineBetween(gate.x + 5, gate.y + gate.height / 2, gate.x + gate.width - 5, gate.y + gate.height / 2);
      }
    }
    // Engraved connection previews express adjacency, not the next action.
    const crystals = s.nodes.filter(n => n.kind === 'crystal');
    const barriers = [...s.level.walls, ...s.gates.filter(gate => !gate.open)];
    for (let i = 0; i < crystals.length; i++) for (let j = i + 1; j < crystals.length; j++) {
      const a = crystals[i], b = crystals[j];
      if (linkedCrystals(a, b, s.level, barriers)) {
        g.lineStyle(2, colorOf(a.color), a.active && b.active ? 0.65 : 0.14);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    for (const node of s.nodes) {
      const { x, y } = node, color = colorOf(node.color);
      if (node.kind === 'mirror') {
        const sign = node.slope === '/' ? -1 : 1;
        bodies.lineStyle(14, 0x05121f, 0.38); bodies.lineBetween(x - 42 + 3, y - 42 * sign + 6, x + 42 + 3, y + 42 * sign + 6);
        bodies.lineStyle(11, 0x24404c); bodies.lineBetween(x - 42, y - 42 * sign + 2, x + 42, y + 42 * sign + 2);
        bodies.lineStyle(9, 0x88a8ae); bodies.lineBetween(x - 42, y - 42 * sign, x + 42, y + 42 * sign);
        bodies.lineStyle(5, 0xc4e2dc); bodies.lineBetween(x - 40, y - 40 * sign - 1, x + 40, y + 40 * sign - 1);
        bodies.lineStyle(1.2, 0xf2fff5); bodies.lineBetween(x - 39, y - 39 * sign - 3, x + 39, y + 39 * sign - 3);
        // The actual reflecting line stays at the simulation's exact axis.
        // Silvered glass in its mounting channel. The softbox reflection is
        // split by the bevel, rather than a uniform white bar along the rail.
        for (const [a, b, tint, alpha] of [[-39,-24,0xc7eceb,.72],[-24,-16,0xf8fff7,.95],[-16,14,0x7499a7,.8],[14,37,0xb4d6d8,.6]]) {
          marks.lineStyle(4, tint, alpha);
          marks.lineBetween(x + a, y + a * sign - 1, x + b, y + b * sign - 1);
        }
        marks.lineStyle(1.4, 0xf2fff5, .9); marks.lineBetween(x - 42, y - 42 * sign, x + 42, y + 42 * sign);
        for (const dx of [-42, 42]) {
          bodies.fillStyle(0x223b45); bodies.fillCircle(x + dx, y + dx * sign + 1, 5);
          bodies.fillStyle(0xb6c7b8); bodies.fillCircle(x + dx - 1, y + dx * sign - 1, 3.2);
          bodies.lineStyle(1, 0x40585c); bodies.lineBetween(x + dx - 2, y + dx * sign - 1, x + dx, y + dx * sign - 1);
        }
      } else if (node.kind === 'paint') {
        bodies.fillStyle(ink); bodies.fillCircle(x, y + 4, 27);
        marks.fillStyle(ink); marks.fillCircle(x, y, 19);
        marks.lineStyle(5, color, 0.8); marks.strokeCircle(x, y, 23);
        marks.lineStyle(1, 0xffffff, 0.6); marks.strokeCircle(x, y, 28);
        symbol(marks, x, y, node.color, 7, color);
      } else if (node.kind === 'switch') {
        bodies.fillStyle(0x091722, 0.7); bodies.fillCircle(x, y + 6, 25);
        marks.fillStyle(node.active ? 0x78efc0 : 0x38596a); marks.fillCircle(x, y, 23);
        marks.lineStyle(2, 0xb4e4d8, 0.9); marks.strokeCircle(x, y, 23);
        marks.fillStyle(node.active ? ink : 0xecfaf5); marks.fillPoints([{ x: x + 2, y: y - 13 }, { x: x - 9, y: y + 2 }, { x: x - 1, y: y + 2 }, { x: x - 4, y: y + 13 }, { x: x + 9, y: y - 2 }, { x: x + 1, y: y - 2 }], true);
      } else {
        if (this.textures.exists('prism-crystals')) {
          let crystal = this.crystals.get(node.id);
          if (!crystal) {
            crystal = this.add.image(x, y, 'prism-crystals').setOrigin(.5, 80 / 192).setDisplaySize(80, 96).setDepth(4);
            this.crystals.set(node.id, crystal);
            const growth = this.add.image(x + 19, y + 15, 'prism-crystals', 7).setOrigin(.5, 145 / 192).setScale(.27).setDepth(3).setVisible(false);
            this.growth.set(node.id, growth);
          }
          crystal.setFrame(({ mint: 0, amber: 2, violet: 4 })[node.color] + Number(node.active));
          const growth = this.growth.get(node.id);
          if (node.active && !growth.visible && !this.policy.reduced) this.sprouting.set(node.id, this.clock);
          if (!node.active) this.sprouting.delete(node.id);
          growth.setVisible(node.active).setScale(this.sprouting.has(node.id) ? .001 : .27);
          continue;
        }
        // Readable faceted fallback if a texture cannot be decoded. Geometry,
        // colour/symbol and gameplay never depend on the asset request.
        fallback.fillStyle(0x091522, 0.7); fallback.fillEllipse(x, y + 20, 46, 16);
        fallback.fillStyle(color, node.active ? .9 : .7); fallback.fillPoints([{ x, y: y - 25 }, { x: x + 18, y: y - 4 }, { x: x + 14, y: y + 16 }, { x, y: y + 25 }, { x: x - 17, y: y + 13 }, { x: x - 19, y: y - 5 }], true);
        fallback.fillStyle(0xffffff, .2); fallback.fillTriangle(x, y - 25, x - 19, y - 5, x + 2, y);
        symbol(fallback, x, y + 1, node.color, 8, node.active ? 0xf1fff8 : color);
      }
    }
    const solidKey = crystals.map(node => Number(node.active)).join('');
    if (solidKey !== this.solidKey) {
      this.solid.setObjects([...this.staticSolids, ...crystals.flatMap(node => [
        { kind: 'ring', x: node.x, y: node.y + 17, w: 43, h: 21, color: 0x6b807b, finish: 'alloy', roughness: .34, metallic: .65 },
        { kind: 'crystal', x: node.x, y: node.y, w: 37, h: 51, color: colorOf(node.color), roughness: node.active ? .19 : .24, metallic: .02, emission: node.active ? .45 : .02 },
      ])]);
      this.solidKey = solidKey;
    }
    this.solid.setEnabled(this.policy.tier === 'high');
    this.syncSolidSymbols();
    const { x, y } = s.level.launch;
    this.restoredLight?.setAlpha(crystals.filter(n => n.active).length / Math.max(1, crystals.length) * .12);
    if (this.textures.exists('prism-crystals')) {
      if (!this.launcher) this.launcher = this.add.image(x, y, 'prism-crystals', 6).setOrigin(.5, 107 / 192).setDisplaySize(90, 108).setDepth(4);
      this.drawLaunchSymbol();
      return;
    }
    bodies.fillStyle(0x071421); bodies.fillEllipse(x, y + 6, 64, 22);
    bodies.fillStyle(0x4a6673); bodies.fillEllipse(x, y, 58, 22);
    bodies.lineStyle(2, 0xc9eee0, 0.55); bodies.strokeEllipse(x, y - 2, 54, 20);
    bodies.fillStyle(colorOf(s.color), 0.12); bodies.fillCircle(x, y - 5, 23);
    this.drawLaunchSymbol();
  }

  drawLaunchSymbol() {
    const { x, y } = this.simulation.level.launch, g = this.launchSymbol.clear();
    if (this.solidActive) { g.fillStyle(ink); g.fillCircle(x, y - 2, 14); }
    symbol(g, x, y - 2, this.simulation.color, 11, colorOf(this.simulation.color));
  }

  setAim(aim) {
    if (!this.guide || this.frozen || this.simulation.phase !== 'ready') return;
    this.aim = { x: Phaser.Math.Clamp(aim.x, 26, 394), y: Phaser.Math.Clamp(aim.y, 26, 485) };
    this.drawGuide();
    this.callbacks.aim(this.aim);
    this.requestRender();
  }

  rotateAim(degrees) {
    const start = this.simulation.level.launch;
    const angle = Phaser.Math.Clamp(Math.atan2(this.aim.x - start.x, start.y - this.aim.y) + degrees * Math.PI / 180, -1.25, 1.25);
    this.setAim({ x: start.x + Math.sin(angle) * 170, y: start.y - Math.cos(angle) * 170 });
  }

  drawGuide() {
    const g = this.guide.clear();
    if (this.simulation.phase !== 'ready') return;
    const path = tracePulse(this.simulation, this.aim);
    if (!path) return;
    let remaining = 580;
    for (const segment of path.segments.slice(0, 3)) {
      const len = Math.min(segment.length, remaining);
      const dx = (segment.end.x - segment.start.x) / segment.length, dy = (segment.end.y - segment.start.y) / segment.length;
      g.fillStyle(colorOf(segment.color), 0.6);
      for (let t = 15; t < len; t += 14) g.fillCircle(segment.start.x + dx * t, segment.start.y + dy * t, 1.7);
      remaining -= len;
      if (remaining <= 0) break;
    }
    g.lineStyle(1, 0xf1fff8, 0.65); g.strokeCircle(this.aim.x, this.aim.y, 7);
  }

  selectColor(color) {
    if (!this.objects || this.frozen || !this.simulation.selectColor(color)) return;
    this.drawObjects(); this.drawGuide(); this.notify();
    this.requestRender();
  }

  fire() {
    if (!this.objects || this.frozen || !this.simulation.fire(this.aim)) return false;
    this.accumulator = 0;
    this.drawGuide(); this.notify();
    this.callbacks.signal({ kind: 'launch', color: this.simulation.color });
    this.requestRender();
    return true;
  }

  undo() {
    if (this.frozen || !this.simulation.undo()) return;
    this.impacts.length = 0; this.effects.clear(); this.pulse.clear();
    this.drawObjects(); this.drawGuide(); this.notify();
    this.requestRender();
  }

  notify() { this.callbacks.state(this.simulation.snapshot()); }

  update(_time, delta) {
    if (this.frozen) return;
    const dt = Math.min(delta, 75) / 1000;
    this.clock += dt;
    if (this.simulation.phase === 'flying') {
      this.accumulator = Math.min(this.accumulator + dt, 0.1);
      let changed = false;
      while (this.accumulator >= 1 / 120) {
        this.accumulator -= 1 / 120;
        for (const event of this.simulation.step(1 / 120)) {
          changed = true;
          if (['activate', 'switch', 'paint', 'reflect'].includes(event.kind) && !this.policy.reduced) {
            this.impacts.push({ ...event, born: this.clock });
            if (this.impacts.length > this.policy.maxImpacts) this.impacts.shift();
          }
          this.callbacks.signal(event);
        }
      }
      this.drawFlight();
      if (changed) { this.drawObjects(); this.drawGuide(); this.notify(); }
    }
    if (this.impacts.length) this.drawImpacts();
    for (const [id, born] of this.sprouting) {
      const t = Math.min(1, (this.clock - born) / .5);
      this.growth.get(id).setScale(.27 * (1 - (1 - t) ** 3));
      if (t >= 1) this.sprouting.delete(id);
    }
    if (this.completion) {
      const t = Math.min(1, (this.clock - this.completion.born) / .72);
      this.restoredLight.setAlpha(.12 + Math.sin(t * Math.PI) * .12);
      if (t >= 1) this.endCompletion(true);
    }
  }

  drawFlight() {
    const g = this.pulse.clear(), f = this.simulation.flight;
    this.pulseLight.setVisible(false);
    this.solid.setLight(0, 0, 100, 0);
    if (this.simulation.phase !== 'flying' || !f) return;
    const distance = f.elapsed * 600;
    const segment = f.segments.find(s => distance >= s.distance && distance <= s.distance + s.length);
    if (!segment) return;
    const t = (distance - segment.distance) / segment.length;
    const x = segment.start.x + (segment.end.x - segment.start.x) * t;
    const y = segment.start.y + (segment.end.y - segment.start.y) * t;
    const color = colorOf(segment.color);
    if (!this.policy.reduced) this.solid.setLight(x, y, 48, 4, color);
    const trail = Math.min(38, distance - segment.distance);
    if (!this.policy.reduced && this.policy.tier === 'high') {
      // A grazing pool follows the actual ray across the floor; it turns at
      // the mirror and takes its new hue only after crossing a colour ring.
      this.pulseLight.setPosition(x + 2, y + 5).setTint(color).setDisplaySize(104, 40)
        .setRotation(Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x)).setAlpha(.72).setVisible(true);
    }
    g.lineStyle(9, color, 0.07); g.lineBetween(x, y, x - (segment.end.x - segment.start.x) / segment.length * trail, y - (segment.end.y - segment.start.y) / segment.length * trail);
    g.lineStyle(5, color, 0.28); g.lineBetween(x, y, x - (segment.end.x - segment.start.x) / segment.length * trail, y - (segment.end.y - segment.start.y) / segment.length * trail);
    g.fillStyle(color, 0.15); g.fillCircle(x, y, 18);
    g.fillStyle(color); g.fillCircle(x, y, 8);
    g.fillStyle(0xf6fff6); g.fillCircle(x - 1, y - 2, 3);
  }

  drawImpacts() {
    const g = this.effects.clear();
    this.impacts = this.impacts.filter(p => this.clock - p.born < 0.45);
    for (const p of this.impacts) {
      const progress = (this.clock - p.born) / 0.45;
      const color = colorOf(p.color);
      g.lineStyle(2 * (1 - progress), color, (1 - progress) * 0.75);
      if (p.kind === 'reflect') {
        const mirror = this.simulation.nodes.find(n => n.id === p.id);
        const slope = mirror.slope === '/' ? -1 : 1;
        const dx = Math.min(32, 6 + progress * 40);
        const left = Math.max(mirror.x - 42, p.x - dx), right = Math.min(mirror.x + 42, p.x + dx);
        for (const [width, alpha, tint] of [[8, .19, color], [2, .95, 0xf3fff9]]) {
          g.lineStyle(width, tint, alpha * (1 - progress));
          g.lineBetween(left, mirror.y + (left - mirror.x) * slope, right, mirror.y + (right - mirror.x) * slope);
        }
      } else if (p.kind === 'activate') {
        g.strokeEllipse(p.x, p.y + 17, 34 + 18 * progress, 13 + 7 * progress);
      } else g.strokeCircle(p.x, p.y, 12 + progress * 36);
      if (p.from) {
        const source = this.simulation.nodes.find(n => n.id === p.from);
        if (source) {
          g.lineStyle(8, color, (1 - progress) * .08); g.lineBetween(source.x, source.y, p.x, p.y);
          g.lineStyle(2, color, (1 - progress) * .8); g.lineBetween(source.x, source.y, p.x, p.y);
          const travel = Math.min(1, progress * 3);
          g.fillStyle(0xf1fff6, (1 - progress) * .9); g.fillCircle(source.x + (p.x - source.x) * travel, source.y + (p.y - source.y) * travel, 2);
        }
      }
      if (p.kind === 'paint' && this.policy.tier === 'high') for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5, radius = 18 + progress * 38;
        g.fillStyle(color, 1 - progress); g.fillCircle(p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius, 2 * (1 - progress));
      }
    }
  }

  setPolicy(policy) {
    this.policy = policy;
    this.solid?.setEnabled(policy.tier === 'high');
    const limit = policy.tier === 'low' ? 30 : 60;
    if (this.game?.loop.fpsLimit !== limit) this.game?.loop.setFPSLimit(limit);
    if (policy.reduced) {
      this.impacts.length = 0; this.effects?.clear(); this.sprouting.clear();
      for (const growth of this.growth.values()) growth.setScale(.27);
    }
    if (policy.reduced) this.endCompletion(true);
    this.pulseLight?.setVisible(false);
    this.resizeSurface?.();
    this.requestRender();
  }

  setPaused(paused) {
    this.frozen = paused;
    this.cancelPointer?.();
    this.accumulator = 0;
    if (paused) this.game?.loop.sleep();
    else this.requestRender();
  }

  syncSolidSymbols() {
    this.crystalSymbols.clear();
    this.crystalFallback.setVisible(!this.solidActive);
    this.propsFallback.setVisible(!this.solidActive);
    this.launcher?.setVisible(!this.solidActive);
    this.drawLaunchSymbol();
    for (const [id, image] of this.crystals) image.setVisible(!this.solidActive);
    if (this.solidActive) for (const node of this.simulation.nodes) if (node.kind === 'crystal') {
      this.crystalSymbols.fillStyle(0x102735, .95); this.crystalSymbols.fillCircle(node.x, node.y + 13, 8.5);
      symbol(this.crystalSymbols, node.x, node.y + 13, node.color, 7, node.active ? 0xf0fff3 : colorOf(node.color));
    }
  }

  needsFrames() {
    return !this.frozen && (this.simulation.phase === 'flying' || this.impacts.length > 0 || this.sprouting.size > 0 || Boolean(this.completion));
  }

  requestRender() {
    if (!this.frozen && this.game?.isBooted && !document.hidden && !this.game.loop.running) {
      this.game.loop.resetDelta(); this.game.loop.wake();
    }
  }

  presentCompletion() {
    if (this.policy.reduced || document.hidden) { this.settle(); return Promise.resolve(true); }
    return new Promise(resolve => {
      this.completion = { born: this.clock, resolve };
      this.requestRender();
    });
  }

  endCompletion(completed = true) {
    if (!this.completion) return;
    const { resolve } = this.completion;
    this.completion = null;
    if (completed) this.settle();
    resolve(completed);
  }

  settle() {
    this.impacts.length = 0;
    this.effects?.clear(); this.pulse?.clear();
    this.pulseLight?.setVisible(false);
    this.sprouting.clear();
    for (const growth of this.growth.values()) growth.setScale(.27);
    if (this.simulation.phase === 'won') this.restoredLight?.setAlpha(.12);
    this.setPaused(true);
  }
}

export function createPrismArena(parent, level, callbacks, policy) {
  const scene = new PrismScene(level, callbacks, policy);
  const surface = () => renderSurface(parent.clientWidth || 420, parent.clientHeight || 560, scene.policy.tier, devicePixelRatio);
  const size = surface();
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: size.width, height: size.height,
    backgroundColor: '#102236', transparent: false, banner: false,
    render: { antialias: true, roundPixels: false, powerPreference: 'low-power' },
    scale: { mode: Phaser.Scale.NONE },
    input: { activePointers: 1, keyboard: false, windowEvents: true },
    audio: { noAudio: true }, // The app owns its one audio graph and preferences.
    fps: { target: 60, limit: policy.tier === 'low' ? 30 : 60, smoothStep: false },
    scene: [scene],
    callbacks: { postBoot: game => {
      game.canvas.setAttribute('role', 'img');
      game.canvas.setAttribute('aria-hidden', 'true'); // Equivalent named controls live in the DOM.
    } },
  });
  let resizeFrame = 0, disposed = false;
  scene.resizeSurface = () => {
    if (disposed || !game.isBooted || !scene.cameras?.main) return;
    const size = surface();
    if (game.scale.width !== size.width || game.scale.height !== size.height) game.scale.resize(size.width, size.height);
    scene.cameras.main.setViewport(0, 0, size.width, size.height).setOrigin(0, 0).setZoom(size.width / 420);
    scene.requestRender();
  };
  const scheduleResize = () => {
    if (!resizeFrame && !disposed) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; scene.resizeSurface(); });
  };
  const observer = new ResizeObserver(scheduleResize);
  observer.observe(parent);
  window.addEventListener('resize', scheduleResize, { passive: true });
  return { game, scene, destroy() {
    if (disposed) return;
    disposed = true; observer.disconnect();
    window.removeEventListener('resize', scheduleResize);
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    scene.endCompletion(false);
    game.loop.wake(); game.destroy(true);
  } };
}
