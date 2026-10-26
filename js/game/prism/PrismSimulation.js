/* Render-independent ray collisions and a fixed-step flight simulation.
   No DOM, random values, wall clock, storage, or engine timers. */
const EPS = 0.03;
const SPEED = 600;
const BOUNDS = { left: 25, right: 395, top: 25, bottom: 536 };
const cross = (a, b) => a.x * b.y - a.y * b.x;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const point = (a, d, t) => ({ x: a.x + d.x * t, y: a.y + d.y * t });

function raySegment(origin, direction, a, b) {
  const v = sub(b, a), delta = sub(a, origin), den = cross(direction, v);
  if (Math.abs(den) < 1e-8) return Infinity;
  const t = cross(delta, v) / den, u = cross(delta, direction) / den;
  return t > EPS && u >= 0 && u <= 1 ? t : Infinity;
}

function rayCircle(origin, direction, node, radius) {
  const delta = sub(origin, node);
  const b = delta.x * direction.x + delta.y * direction.y;
  const c = delta.x * delta.x + delta.y * delta.y - radius * radius;
  const det = b * b - c;
  if (det < 0) return Infinity;
  const t = -b - Math.sqrt(det);
  return t > EPS ? t : Infinity;
}

function rectEdges(rect) {
  const { x, y, width: w, height: h } = rect;
  return [[{ x, y }, { x: x + w, y }], [{ x: x + w, y }, { x: x + w, y: y + h }],
    [{ x: x + w, y: y + h }, { x, y: y + h }], [{ x, y: y + h }, { x, y }]];
}

function obstructed(a, b, barriers) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const d = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  return barriers.some(rect => rectEdges(rect).some(([p, q]) => raySegment(a, d, p, q) < length - EPS));
}

function chainFrom(first, state, gatesOpen) {
  const found = [{ node: first, depth: 0 }], visited = new Set([first.id]);
  const barriers = [...state.level.walls, ...state.gates.filter(g => !g.open && !gatesOpen)];
  for (let i = 0; i < found.length; i++) {
    const { node, depth } = found[i];
    for (const next of state.nodes) {
      if (next.kind !== 'crystal' || next.active || visited.has(next.id) || next.color !== first.color) continue;
      if (Math.hypot(next.x - node.x, next.y - node.y) <= state.level.chainRadius && !obstructed(node, next, barriers)) {
        visited.add(next.id);
        found.push({ node: next, depth: depth + 1, from: node.id });
      }
    }
  }
  return found;
}

/** Read-only full trajectory. Preview and live flight use identical geometry. */
export function tracePulse(state, aim, color = state.color) {
  const start = state.level.launch;
  const length = Math.hypot(aim.x - start.x, aim.y - start.y);
  if (!Number.isFinite(length) || length < 12 || aim.y >= start.y - 8) return null;
  let direction = { x: (aim.x - start.x) / length, y: (aim.y - start.y) / length };
  let origin = { ...start }, distance = 0, gatesOpen = false, previous = null;
  const segments = [], events = [], passed = new Set();
  const bounds = rectEdges({ x: BOUNDS.left, y: BOUNDS.top, width: BOUNDS.right - BOUNDS.left, height: BOUNDS.bottom - BOUNDS.top });
  for (let iteration = 0; iteration < 18 && distance < 2400; iteration++) {
    let hit = { t: Infinity, kind: 'edge' };
    const candidate = (t, kind, node) => { if (t < hit.t) hit = { t, kind, node }; };
    for (const [a, b] of bounds) candidate(raySegment(origin, direction, a, b), 'edge');
    for (const rect of [...state.level.walls, ...state.gates.filter(g => !g.open && !gatesOpen)]) {
      for (const [a, b] of rectEdges(rect)) candidate(raySegment(origin, direction, a, b), 'wall');
    }
    for (const node of state.nodes) {
      if (node.active || node.id === previous || passed.has(node.id)) continue;
      if (node.kind === 'mirror') {
        const sign = node.slope === '/' ? -1 : 1;
        candidate(raySegment(origin, direction, { x: node.x - 42, y: node.y - 42 * sign }, { x: node.x + 42, y: node.y + 42 * sign }), 'mirror', node);
      } else candidate(rayCircle(origin, direction, node, node.kind === 'paint' ? 23 : 20), node.kind, node);
    }
    if (!Number.isFinite(hit.t)) break;
    const end = point(origin, direction, hit.t);
    segments.push({ start: { ...origin }, end, color, distance, length: hit.t });
    distance += hit.t;
    const at = distance / SPEED;
    if (hit.kind === 'mirror') {
      const sign = hit.node.slope === '/' ? -1 : 1;
      direction = { x: sign * direction.y, y: sign * direction.x };
      events.push({ kind: 'reflect', id: hit.node.id, x: end.x, y: end.y, at, color });
      previous = hit.node.id;
    } else if (hit.kind === 'paint') {
      color = hit.node.color;
      passed.add(hit.node.id);
      events.push({ kind: 'paint', id: hit.node.id, x: end.x, y: end.y, at, color });
    } else if (hit.kind === 'switch') {
      passed.add(hit.node.id);
      gatesOpen = true;
      events.push({ kind: 'switch', id: hit.node.id, x: hit.node.x, y: hit.node.y, at, color });
    } else {
      if (hit.kind === 'crystal' && hit.node.color === color) {
        for (const { node, depth, from } of chainFrom(hit.node, state, gatesOpen)) {
          events.push({ kind: 'activate', id: node.id, x: node.x, y: node.y, at: at + depth * 0.1, color, depth, from });
        }
      } else events.push({ kind: hit.kind === 'crystal' ? 'mismatch' : 'miss', x: end.x, y: end.y, at, color });
      break;
    }
    origin = point(end, direction, EPS * 2);
  }
  const duration = Math.max(distance / SPEED, ...events.map(event => event.at)) + 0.18;
  return { segments, events: events.sort((a, b) => a.at - b.at), duration };
}

export class PrismSimulation {
  constructor(level) {
    this.level = level;
    this.nodes = level.nodes.map(node => ({ ...node, active: false }));
    this.gates = level.gates.map(g => ({ ...g, open: false }));
    this.color = level.colors[0];
    this.shots = 0;
    this.phase = 'ready';
    this.flight = null;
    this.history = [];
  }

  selectColor(color) {
    if (this.phase !== 'ready' || !this.level.colors.includes(color)) return false;
    this.color = color;
    return true;
  }

  fire(aim) {
    if (this.phase !== 'ready' || this.shots >= this.level.shots) return false;
    const path = tracePulse(this, aim);
    if (!path) return false;
    this.history.push({ nodes: this.nodes.map(n => ({ ...n })), gates: this.gates.map(g => ({ ...g })), shots: this.shots, color: this.color });
    this.shots++;
    this.phase = 'flying';
    this.flight = { ...path, elapsed: 0, nextEvent: 0 };
    return true;
  }

  step(seconds) {
    if (this.phase !== 'flying' || !Number.isFinite(seconds) || seconds <= 0) return [];
    const f = this.flight, emitted = [];
    f.elapsed += seconds;
    while (f.nextEvent < f.events.length && f.events[f.nextEvent].at <= f.elapsed) {
      const event = f.events[f.nextEvent++];
      const node = this.nodes.find(n => n.id === event.id);
      if (event.kind === 'activate' && node) node.active = true;
      if (event.kind === 'switch' && node) {
        node.active = true;
        this.gates.forEach(g => { g.open = true; });
      }
      emitted.push(event);
    }
    if (f.elapsed >= f.duration) {
      this.phase = this.nodes.filter(n => n.kind === 'crystal').every(n => n.active) ? 'won'
        : this.shots >= this.level.shots ? 'lost' : 'ready';
      emitted.push({ kind: 'settled', phase: this.phase });
    }
    return emitted;
  }

  undo() {
    if (this.phase === 'flying' || this.phase === 'won' || !this.history.length) return false;
    Object.assign(this, this.history.pop());
    this.phase = 'ready';
    this.flight = null;
    return true;
  }

  get stars() { return this.phase === 'won' ? Math.max(1, 3 - Math.max(0, this.shots - this.level.par)) : 0; }

  snapshot() {
    return { level: this.level.id, phase: this.phase, color: this.color, shots: this.shots, stars: this.stars,
      nodes: this.nodes.map(n => ({ ...n })), gates: this.gates.map(g => ({ ...g })), canUndo: this.history.length > 0 && this.phase !== 'flying' && this.phase !== 'won' };
  }
}
