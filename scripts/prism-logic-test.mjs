import assert from 'node:assert/strict';
import { PrismSimulation, tracePulse } from '../js/game/prism/PrismSimulation.js';
import { PRISM_LEVELS } from '../js/game/prism/levels.js';
import { prismProgress, savePrismWin } from '../js/services/PrismProgress.js';
import { PRISM_SOLUTIONS } from './lib/prism-solutions.mjs';
import { prismChallengeUrl } from '../js/helpers/prismLink.js';

function resolve(sim) { for (let i = 0; i < 1200 && sim.phase === 'flying'; i++) sim.step(1 / 120); }
const data = { totalXP: 2500, fire: 81, achievements: ['old-award'], scores_klassik: [{ score: 5123 }] };
const original = JSON.stringify(data);
const save = { data, async withBatch(fn) { const before = structuredClone(this.data); try { await fn(); if (this.fail) throw new Error('Storage full'); } catch (e) { this.data = before; throw e; } } };
assert.equal(prismProgress(data).unlocked, 0);
assert.equal(prismChallengeUrl('first-light', 'http://127.0.0.1:3000/game/?private=hidden#old'), 'http://127.0.0.1:3000/game/?prism=first-light');
assert.equal(prismChallengeUrl('light-weaver', 'https://localhost/index.html', true), 'https://theokitsi.github.io/scs-play/?prism=light-weaver');
assert.equal(JSON.stringify(data), original, 'Reading progress never changes the old save');

for (const [index, level] of PRISM_LEVELS.entries()) {
  const sim = new PrismSimulation(level), signals = [];
  const before = JSON.stringify(sim.snapshot());
  const aim = PRISM_SOLUTIONS[index][0];
  assert.deepEqual(tracePulse(sim, aim), tracePulse(sim, aim), 'Deterministic previews');
  assert.equal(JSON.stringify(sim.snapshot()), before, 'Preview cannot spend shots/reveal progress');
  assert.equal(sim.fire({ x: NaN, y: 0 }), false);
  assert.equal(sim.fire({ x: 210, y: 530 }), false);
  for (const action of PRISM_SOLUTIONS[index]) {
    if (action.color) assert.equal(sim.selectColor(action.color), true);
    assert.equal(sim.fire(action), true, `${level.id}: launch`);
    assert.equal(sim.fire(action), false, 'Duplicate launch never spends twice');
    assert.equal(sim.selectColor('amber'), false, 'Cannot retune a pulse in flight');
    for (let frame = 0; frame < 1200 && sim.phase === 'flying'; frame++) signals.push(...sim.step(1 / 120));
  }
  assert.equal(sim.phase, 'won', `${level.id} has a real authored solution: ${JSON.stringify(sim.snapshot())}`);
  assert.equal(sim.shots, level.par, `${level.id}: par matches solution`);
  assert.equal(sim.stars, 3);
  assert.equal(sim.undo(), false, 'Settled success is immutable');
  assert.equal(await savePrismWin(save, sim), true);
  const first = JSON.stringify(save.data);
  assert.equal(await savePrismWin(save, sim), true);
  assert.equal(JSON.stringify(save.data), first, 'Repeated settlement is idempotent');
  assert.equal(new Set(signals.filter(e => e.kind === 'activate').map(e => e.id)).size, level.nodes.filter(n => n.kind === 'crystal').length);
  console.log(`PASS ${String(index + 1).padStart(2, '0')} ${level.id}: ${sim.shots} pulse(s), 3 stars`);
}
assert.equal(prismProgress(save.data).completed, 12);
assert.equal(prismProgress(save.data).stars, 36);
const { prism: _prism, ...legacy } = save.data;
assert.equal(JSON.stringify(legacy), original, 'Arcade progress, currency and awards survive unchanged');

const miss = new PrismSimulation(PRISM_LEVELS[0]);
miss.fire({ x: 30, y: 450 }); resolve(miss);
assert.equal(miss.phase, 'ready');
assert.equal(miss.undo(), true); assert.equal(miss.shots, 0);
assert.equal(miss.undo(), false);
for (let i = 0; i < 3; i++) { assert.equal(miss.fire({ x: 30, y: 450 }), true); resolve(miss); }
assert.equal(miss.phase, 'lost'); assert.equal(miss.stars, 0); assert.equal(miss.fire({ x: 210, y: 170 }), false);
assert.equal(miss.undo(), true); assert.equal(miss.shots, 2); assert.equal(miss.phase, 'ready');

const switching = new PrismSimulation(PRISM_LEVELS[8]);
switching.fire({ x: 210, y: 145 }); resolve(switching);
assert.equal(switching.nodes.some(n => n.active), false, 'A closed gate blocks energy');
switching.undo(); switching.fire({ x: 115, y: 338 }); resolve(switching);
assert.ok(switching.gates.every(g => g.open));
switching.undo(); assert.ok(switching.gates.every(g => !g.open), 'Undo restores switches and barriers');

const mismatched = new PrismSimulation(PRISM_LEVELS[2]);
mismatched.fire({ x: 290, y: 180 }); resolve(mismatched);
assert.ok(mismatched.nodes.every(n => !n.active), 'Mismatched colours cannot activate crystals');
assert.equal(mismatched.selectColor('invalid'), false);

const corrupt = prismProgress({ prism: { version: 1, levels: { 'first-light': { stars: 999, bestShots: -1 }, 'world-awake': { stars: 2, bestShots: 3 }, invented: { stars: 3, bestShots: 1 } } } });
assert.equal(corrupt.unlocked, 0); assert.equal(corrupt.completed, 1);
const locked = new PrismSimulation(PRISM_LEVELS[11]);
for (const action of PRISM_SOLUTIONS[11]) { locked.fire(action); resolve(locked); }
assert.equal(await savePrismWin({ data: {} }, locked), false, 'Free-play cannot unlock campaign levels');

save.fail = true;
const beforeFailure = JSON.stringify(save.data);
assert.equal(await savePrismWin(save, miss), false, 'Non-winning results are ineligible');
const won = new PrismSimulation(PRISM_LEVELS[0]); won.fire({ x: 210, y: 170 }); resolve(won);
await assert.rejects(() => savePrismWin(save, won), /Storage full/);
assert.equal(JSON.stringify(save.data), beforeFailure, 'Failed persistence rolls back the result transaction');
console.log('PASS preview purity, collision rules, undo/failure, migration, replay and storage rollback');
