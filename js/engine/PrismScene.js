import Phaser from 'phaser';
import { PRISM_COLORS } from '../game/prism/levels.js';
import { PrismSimulation, tracePulse } from '../game/prism/PrismSimulation.js';

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
  }

  create() {
    this.drawLandscape();
    this.objects = this.add.graphics();
    this.guide = this.add.graphics();
    this.pulse = this.add.graphics();
    this.effects = this.add.graphics();
    this.drawObjects();
    this.drawGuide();
    let origin = null;
    this.input.on('pointerdown', pointer => {
      if (this.frozen || this.simulation.phase !== 'ready') return;
      origin = { x: pointer.x, y: pointer.y };
      this.setAim(pointer);
    });
    this.input.on('pointermove', pointer => {
      if (origin && pointer.isDown) this.setAim(pointer);
    });
    this.input.on('pointerup', pointer => {
      const start = origin;
      origin = null;
      if (start && Math.hypot(pointer.x - start.x, pointer.y - start.y) >= 14) this.fire();
    });
    this.input.on('gameout', () => { origin = null; });
    this.cancelPointer = () => { origin = null; };
    this.game.canvas.addEventListener('pointercancel', this.cancelPointer);
    this.game.canvas.addEventListener('webglcontextlost', this.callbacks.contextLost);
    this.events.once('shutdown', () => {
      this.game.canvas.removeEventListener('pointercancel', this.cancelPointer);
      this.game.canvas.removeEventListener('webglcontextlost', this.callbacks.contextLost);
      this.impacts.length = 0;
    });
    this.callbacks.ready(this);
    this.notify();
  }

  drawLandscape() {
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
    for (const wall of s.level.walls) {
      g.fillStyle(0x0a1728, 0.7); g.fillRoundedRect(wall.x, wall.y + 8, wall.width, wall.height, 6);
      g.fillStyle(0x536271); g.fillRoundedRect(wall.x, wall.y, wall.width, wall.height, 6);
      g.lineStyle(2, 0x90a2ae, 0.6); g.lineBetween(wall.x + 7, wall.y + 3, wall.x + wall.width - 7, wall.y + 3);
    }
    for (const gate of s.gates) {
      g.fillStyle(0xa1b4c5); g.fillRoundedRect(gate.x - 4, gate.y - 4, 9, gate.height + 8, 3);
      g.fillRoundedRect(gate.x + gate.width - 5, gate.y - 4, 9, gate.height + 8, 3);
      if (!gate.open) {
        g.fillStyle(0xf7a8b8, 0.18); g.fillRect(gate.x + 5, gate.y, gate.width - 10, gate.height);
        g.lineStyle(2, 0xf7a8b8, 0.85); g.lineBetween(gate.x + 5, gate.y + gate.height / 2, gate.x + gate.width - 5, gate.y + gate.height / 2);
      }
    }
    // Engraved connection previews express adjacency, not the next action.
    const crystals = s.nodes.filter(n => n.kind === 'crystal');
    for (let i = 0; i < crystals.length; i++) for (let j = i + 1; j < crystals.length; j++) {
      const a = crystals[i], b = crystals[j];
      if (a.color === b.color && Math.hypot(a.x - b.x, a.y - b.y) <= s.level.chainRadius) {
        g.lineStyle(2, colorOf(a.color), a.active && b.active ? 0.65 : 0.14);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    for (const node of s.nodes) {
      const { x, y } = node, color = colorOf(node.color);
      if (node.kind === 'mirror') {
        const sign = node.slope === '/' ? -1 : 1;
        g.lineStyle(14, 0x081622, 0.65); g.lineBetween(x - 42, y - 42 * sign + 5, x + 42, y + 42 * sign + 5);
        g.lineStyle(9, 0x6b8496); g.lineBetween(x - 42, y - 42 * sign, x + 42, y + 42 * sign);
        g.lineStyle(3, 0xd5f0f0); g.lineBetween(x - 38, y - 38 * sign - 1, x + 38, y + 38 * sign - 1);
        g.fillStyle(0x283a4a); g.fillCircle(x - 42, y - 42 * sign, 6); g.fillCircle(x + 42, y + 42 * sign, 6);
      } else if (node.kind === 'paint') {
        g.fillStyle(ink); g.fillCircle(x, y + 4, 27);
        g.lineStyle(5, color, 0.8); g.strokeCircle(x, y, 23);
        g.lineStyle(1, 0xffffff, 0.6); g.strokeCircle(x, y, 28);
        symbol(g, x, y, node.color, 7, color);
      } else if (node.kind === 'switch') {
        g.fillStyle(0x091722, 0.7); g.fillCircle(x, y + 6, 25);
        g.fillStyle(node.active ? 0x78efc0 : 0x38596a); g.fillCircle(x, y, 23);
        g.lineStyle(2, 0xb4e4d8, 0.9); g.strokeCircle(x, y, 23);
        g.fillStyle(node.active ? ink : 0xecfaf5); g.fillPoints([{ x: x + 2, y: y - 13 }, { x: x - 9, y: y + 2 }, { x: x - 1, y: y + 2 }, { x: x - 4, y: y + 13 }, { x: x + 9, y: y - 2 }, { x: x + 1, y: y - 2 }], true);
      } else {
        if (node.active) {
          g.fillStyle(color, 0.06); g.fillCircle(x, y, 38);
          g.lineStyle(1, color, 0.3); g.strokeCircle(x, y, 29);
          // A living sprout grows from every awakened energy station.
          g.lineStyle(3, 0x78bf96, 0.9); g.lineBetween(x, y + 22, x, y + 38);
          g.fillStyle(0x80d7a1); g.fillEllipse(x - 6, y + 29, 14, 6); g.fillEllipse(x + 6, y + 36, 14, 6);
        }
        g.fillStyle(0x091522, 0.7); g.fillEllipse(x, y + 20, 46, 16);
        g.fillStyle(node.active ? color : 0x3b5866); g.fillRoundedRect(x - 23, y - 13, 46, 37, 11);
        g.fillStyle(0x142b39); g.fillRoundedRect(x - 23, y - 20, 46, 37, 11);
        g.lineStyle(2, color, node.active ? 1 : 0.75); g.strokeRoundedRect(x - 23, y - 20, 46, 37, 11);
        symbol(g, x, y - 2, node.color, 13, color);
        if (node.active) symbol(g, x, y - 2, node.color, 6, 0xf1fff8);
      }
    }
    const { x, y } = s.level.launch;
    g.fillStyle(0x071421); g.fillEllipse(x, y + 6, 64, 22);
    g.fillStyle(0x4a6673); g.fillEllipse(x, y, 58, 22);
    g.lineStyle(2, 0xc9eee0, 0.55); g.strokeEllipse(x, y - 2, 54, 20);
    g.fillStyle(colorOf(s.color), 0.12); g.fillCircle(x, y - 5, 23);
    symbol(g, x, y - 5, s.color, 15, colorOf(s.color));
  }

  setAim(aim) {
    if (!this.guide || this.frozen || this.simulation.phase !== 'ready') return;
    this.aim = { x: Phaser.Math.Clamp(aim.x, 26, 394), y: Phaser.Math.Clamp(aim.y, 26, 485) };
    this.drawGuide();
    this.callbacks.aim(this.aim);
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
  }

  fire() {
    if (!this.objects || this.frozen || !this.simulation.fire(this.aim)) return false;
    this.accumulator = 0;
    this.drawGuide(); this.notify();
    this.callbacks.signal({ kind: 'launch', color: this.simulation.color });
    return true;
  }

  undo() {
    if (this.frozen || !this.simulation.undo()) return;
    this.impacts.length = 0; this.effects.clear(); this.pulse.clear();
    this.drawObjects(); this.drawGuide(); this.notify();
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
  }

  drawFlight() {
    const g = this.pulse.clear(), f = this.simulation.flight;
    if (this.simulation.phase !== 'flying' || !f) return;
    const distance = f.elapsed * 600;
    const segment = f.segments.find(s => distance >= s.distance && distance <= s.distance + s.length);
    if (!segment) return;
    const t = (distance - segment.distance) / segment.length;
    const x = segment.start.x + (segment.end.x - segment.start.x) * t;
    const y = segment.start.y + (segment.end.y - segment.start.y) * t;
    const color = colorOf(segment.color);
    const trail = Math.min(38, distance - segment.distance);
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
      g.strokeCircle(p.x, p.y, 12 + progress * 36);
      if (p.from) {
        const source = this.simulation.nodes.find(n => n.id === p.from);
        if (source) { g.lineStyle(3, color, 1 - progress); g.lineBetween(source.x, source.y, p.x, p.y); }
      }
      if (this.policy.tier === 'high') for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5, radius = 18 + progress * 38;
        g.fillStyle(color, 1 - progress); g.fillCircle(p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius, 2 * (1 - progress));
      }
    }
  }

  setPolicy(policy) {
    this.policy = policy;
    const limit = policy.tier === 'low' ? 30 : 60;
    if (this.game?.loop.fpsLimit !== limit) this.game?.loop.setFPSLimit(limit);
    if (policy.reduced) { this.impacts.length = 0; this.effects?.clear(); }
  }

  setPaused(paused) {
    this.frozen = paused;
    this.cancelPointer?.();
    this.accumulator = 0;
    if (paused) this.game?.loop.sleep();
    else this.game?.loop.wake();
  }

  settle() {
    this.impacts.length = 0;
    this.effects?.clear(); this.pulse?.clear();
    this.setPaused(true);
  }
}

export function createPrismArena(parent, level, callbacks, policy) {
  const scene = new PrismScene(level, callbacks, policy);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: 420, height: 560,
    backgroundColor: '#102236', transparent: false, banner: false,
    render: { antialias: true, roundPixels: false, powerPreference: 'low-power' },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 1, keyboard: false, windowEvents: true },
    audio: { noAudio: true }, // The app owns its one audio graph and preferences.
    fps: { target: 60, limit: policy.tier === 'low' ? 30 : 60, smoothStep: false },
    scene: [scene],
    callbacks: { postBoot: game => {
      game.canvas.setAttribute('role', 'img');
      game.canvas.setAttribute('aria-hidden', 'true'); // Equivalent named controls live in the DOM.
    } },
  });
  return { game, scene, destroy() { scene.setPaused(false); game.destroy(true); } };
}
