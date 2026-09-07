import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const server = await startStaticServer({ root: '.', port: 0 });
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async baseUrl => {
    const cancelledRafs = [];
    const nativeCancelAnimationFrame = window.cancelAnimationFrame;
    window.cancelAnimationFrame = id => {
      cancelledRafs.push(id);
      nativeCancelAnimationFrame(id);
    };

    const { EffectsManager } = await import(`${baseUrl}/js/effects.js`);
    const container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '600px';
    document.body.appendChild(container);

    const effects = new EffectsManager(container);
    effects.lowPerf = false;

    effects.shake(1000, 4);
    const shakeRafId = effects._shakeRafId;
    effects.screenPulse();
    const pulseRafId = effects._screenPulseRafId;

    effects.hitStop(1000);
    effects.ripple(10, 10);
    effects.startAmbient();
    effects._particlesSimple(20, 20, '#fff', 1);
    effects.scorePop(30, 30, '10');
    effects.flash('#fff', 500);
    effects.absorb(0, 0, 10, 10, '#fff');
    effects.dangerZone(true);
    effects.confetti(2, 1000);
    effects.screenTransition();

    const ownedNodes = [...effects._ownedNodes];
    const pools = [effects._simplePool, effects._scorePopPool, effects._flashPool, effects._absorbPool];
    effects.cleanup();

    const cleanupState = {
      shakeCancelledByPulse: cancelledRafs.includes(shakeRafId),
      pulseScheduled: pulseRafId !== null,
      pulseCancelledByCleanup: cancelledRafs.includes(pulseRafId),
      hitStopRemoved: !container.classList.contains('hit-stop-active'),
      transformCleared: container.style.transform === '',
      nodesRemoved: ownedNodes.every(el => !el.isConnected),
      trackingCleared: effects._ownedNodes.size === 0,
      poolRefsCleared: [effects._simplePool, effects._scorePopPool, effects._flashPool, effects._absorbPool]
        .every(pool => pool === null),
      poolWorkCleared: pools.flat().every(el => el._showRafId === null && el._hideTimeout === null),
    };

    // Reusing a slot must cancel its previous hide timer. The fourth flash wraps to slot zero.
    effects.flash('#111', 1);
    effects.flash('#222', 1);
    effects.flash('#333', 1);
    const reusedSlot = effects._flashPool[0];
    const oldHideTimeout = reusedSlot._hideTimeout;
    effects.flash('#444', 300);
    const replacementHideTimeout = reusedSlot._hideTimeout;
    await new Promise(resolve => setTimeout(resolve, 150));

    const reuseState = {
      timerReplaced: oldHideTimeout !== replacementHideTimeout,
      reusedSlotStillVisible: reusedSlot.style.display !== 'none',
    };

    effects.cleanup();
    container.remove();
    return { cleanupState, reuseState };
  }, server.baseUrl);

  for (const [name, value] of Object.entries(result.cleanupState)) {
    assert.equal(value, true, `Cleanup invariant failed: ${name}`);
  }
  for (const [name, value] of Object.entries(result.reuseState)) {
    assert.equal(value, true, `Pool reuse invariant failed: ${name}`);
  }

  console.log('Effects lifecycle regression tests passed.');
} finally {
  await browser.close();
  await server.close();
}
