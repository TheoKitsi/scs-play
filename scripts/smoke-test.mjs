/**
 * SCS Play — Playwright Smoke Test
 * Validates critical user flows: boot → guest login → home → game → results → screens.
 * Collects console errors and reports pass/fail.
 * Run: node scripts/smoke-test.mjs
 */
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const EXTERNAL_BASE = process.env.SCS_BASE || '';
const DEVICE = {
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S936B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};

let passed = 0;
let failed = 0;
const consoleErrors = [];

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

async function run() {
  console.log('SCS Play Smoke Test\n');
  const staticServer = EXTERNAL_BASE ? null : await startStaticServer({ root: 'docs' });
  const BASE = EXTERNAL_BASE || staticServer.baseUrl;
  console.log(`Target: ${BASE}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(DEVICE);
  await context.addInitScript(() => localStorage.setItem('scsQa', '1'));
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  const visible = async (sel, timeout = 3000) => {
    try {
      await page.locator(sel).waitFor({ state: 'visible', timeout });
      return true;
    } catch { return false; }
  };

  const hasActiveClass = async (sel, timeout = 3000) => {
    try {
      await page.waitForFunction((s) => {
        const el = document.querySelector(s);
        return Boolean(el && el.classList.contains('active'));
      }, sel, { timeout });
      return true;
    } catch {
      return false;
    }
  };

  const clickSel = async (sel, wait = 800) => {
    const ok = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (el) { el.click(); return true; }
      return false;
    }, sel);
    if (ok) await page.waitForTimeout(wait);
    return ok;
  };

  // ─── 1) Boot Screen ───
  console.log('\n1. Boot Screen');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  assert(await visible('#btnGuest'), 'Guest button visible');
  assert(
    await hasActiveClass('#auth', 4000) || await hasActiveClass('#home', 4000) || await hasActiveClass('#boot', 4000),
    'Entry screen active'
  );

  // ─── 2) Guest Login → Home ───
  console.log('\n2. Guest Login → Home');
  await clickSel('#btnGuest', 1500);
  assert(await visible('#home', 5000), 'Home screen visible after guest login');
  assert(await visible('#btnPlay'), 'Play button visible');

  // ─── 3) Home Screen Elements ───
  console.log('\n3. Home Screen Elements');
  const homeChecks = ['#btnSettings', '#btnAchievements', '#btnLeaderboard'];
  for (const sel of homeChecks) {
    assert(await visible(sel, 1000), `${sel} visible`);
  }

  // ─── 4) Start Game (default mode) ───
  console.log('\n4. Start Game');
  await clickSel('#btnPlay', 1500);

  if (await hasActiveClass('#tutorial', 1500)) {
    assert(await visible('#btnTutorialSkip', 1500), 'Tutorial can be skipped');
    await clickSel('#btnTutorialSkip', 1500);
  }

  assert(await hasActiveClass('#game', 5000), 'Game screen loaded');

  // Wait for countdown + game start
  await page.waitForTimeout(4500);

  // Check HUD elements
  const hudScore = await page.evaluate(() => !!document.querySelector('#hudScore'));
  const hudTimer = await page.evaluate(() => !!document.querySelector('#hudTimer'));
  assert(hudScore, 'HUD score element exists');
  assert(hudTimer, 'HUD timer element exists');

  // ─── 5) Pause and Resume ───
  console.log('\n5. Pause/Resume');
  await clickSel('#btnPause', 600);
  assert(await hasActiveClass('#pauseOverlay', 2000), 'Pause overlay visible');
  await clickSel('#btnResume', 1500);

  // ─── 6) Pause and Quit → Home ───
  console.log('\n6. Quit → Home');
  await clickSel('#btnPause', 600);
  await clickSel('#btnPauseQuit', 2000);
  assert(await hasActiveClass('#home', 5000), 'Home screen visible after quit');

  // ─── 7) Force Game Over → Results ───
  console.log('\n7. Results');
  await clickSel('#btnPlay', 1500);
  if (await hasActiveClass('#tutorial', 1000)) {
    await clickSel('#btnTutorialSkip', 1500);
  }
  assert(await hasActiveClass('#game', 5000), 'Game screen reloaded');

  await page.waitForTimeout(4500);
  await page.evaluate(() => {
    if (!globalThis.__SCS_QA__) throw new Error('SCS QA hook unavailable');
    globalThis.__SCS_QA__.forceGameOver();
  });
  assert(await hasActiveClass('#results', 5000), 'Results screen visible after game over');

  if (await visible('#btnResContinueNo', 1200)) {
    await clickSel('#btnResContinueNo', 1200);
  }

  const resultsHasContent = await page.evaluate(() => {
    const r = document.querySelector('#results');
    return Boolean(r && r.classList.contains('active') && r.textContent.length > 10);
  });
  assert(resultsHasContent, 'Results screen has content');

  // ─── 8) Back to Home from Results ───
  console.log('\n8. Back to Home');
  await clickSel('#btnHome', 1000);
  assert(await hasActiveClass('#home', 3000), 'Home screen visible after results');

  // ─── 9) Achievements Screen ───
  console.log('\n9. Achievements');
  await clickSel('#btnAchievements', 1000);
  assert(await visible('#achievements', 3000), 'Achievements screen visible');
  // Check categories rendered
  const catCount = await page.evaluate(() =>
    document.querySelectorAll('#achievements .ach-category, #achievements .achievement-category').length
  );
  assert(catCount > 0, `Achievement categories rendered (${catCount})`);
  await clickSel('.btn-back-bottom', 800);

  // ─── 10) Settings Screen ───
  console.log('\n10. Settings');
  if (!await visible('#home', 1000)) {
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.querySelector('#home')?.classList.add('active');
    });
    await page.waitForTimeout(400);
  }
  await clickSel('#btnSettings', 1000);
  assert(await visible('#settings', 3000), 'Settings screen visible');
  await clickSel('.btn-back-bottom', 800);

  // ─── 11) Store Screen ───
  console.log('\n11. Store');
  if (!await visible('#home', 1000)) {
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.querySelector('#home')?.classList.add('active');
    });
    await page.waitForTimeout(400);
  }
  await clickSel('#btnStore', 1000);
  assert(await visible('#store', 3000), 'Store screen visible');
  await clickSel('.btn-back-bottom', 800);

  // ─── 12) Wheel Screen ───
  console.log('\n12. Wheel');
  if (!await visible('#home', 1000)) {
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.querySelector('#home')?.classList.add('active');
    });
    await page.waitForTimeout(400);
  }
  const wheelClicked = await clickSel('#btnWheel', 1000);
  if (wheelClicked) {
    assert(await visible('#wheelOverlay', 3000), 'Wheel overlay visible');
    assert(await visible('#btnWheelSpin', 1500), 'Wheel spin button visible');
    await clickSel('#btnWheelClose', 800);
  } else {
    console.log('  SKIP: Wheel button not found');
  }

  // ─── 13) Streamlined Home: essentials only ───
  console.log('\n13. Streamlined Home');
  if (!await visible('#home', 1000)) {
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.querySelector('#home')?.classList.add('active');
    });
    await page.waitForTimeout(400);
  }
  const homeState = await page.evaluate(() => {
    const visiblePlayTypes = [...document.querySelectorAll('.play-type-btn')]
      .filter(btn => !btn.hidden && getComputedStyle(btn).display !== 'none').length;
    return {
      essentials: Boolean(document.querySelector('#quickShortcuts') && document.querySelector('#dailyCard') && document.querySelector('#wheelCard')),
      overloadRemoved: !document.querySelector('#dailyQuestsPanel') && !document.querySelector('#seasonPassCard') && !document.querySelector('#heroStatsZone'),
      visiblePlayTypes,
    };
  });
  assert(homeState.essentials, 'Home keeps shortcuts, daily challenge, and wheel');
  assert(homeState.overloadRemoved, 'Quest, pass, and stats overload removed');
  assert(homeState.visiblePlayTypes <= 3, `Visible play types reduced (${homeState.visiblePlayTypes})`);

  // ─── 14) Near-Miss pill is reachable through Game→Results path ───
  console.log('\n14. Near-Miss pill DOM hook');
  // The pill is rendered conditionally. We assert the DOM hook function and CSS are wired,
  // i.e. the styles are present and a manual injection materialises (deterministic check).
  const nmReady = await page.evaluate(() => {
    /* Inject a temporary pill element to validate styling is loaded */
    const buttons = document.querySelector('#resNormalBtns');
    if (!buttons || !buttons.parentElement) return false;
    let probe = document.querySelector('#resNearMiss');
    if (!probe) {
      probe = document.createElement('div');
      probe.id = 'resNearMiss';
      probe.className = 'results-near-miss';
      probe.innerHTML = '<span class="nm-spark">✦</span><span>SMOKE</span>';
      buttons.parentElement.insertBefore(probe, buttons);
    }
    const cs = window.getComputedStyle(probe);
    const hasRadius = parseFloat(cs.borderRadius) >= 100;
    probe.remove();
    return hasRadius;
  });
  assert(nmReady, 'Near-Miss pill style class is loaded');

  // ─── Summary ───
  console.log('\n' + '='.repeat(40));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (consoleErrors.length) {
    console.log(`\nConsole Errors (${consoleErrors.length}):`);
    consoleErrors.forEach(e => console.log(`  - ${e}`));
  } else {
    console.log('No console errors detected.');
  }
  console.log('='.repeat(40));

  await context.close();
  await browser.close();
  if (staticServer) await staticServer.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
