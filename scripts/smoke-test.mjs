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
  const homeA11y = await page.evaluate(() => ({
    selectedPlayType: document.querySelector('.play-type-btn.selected')?.getAttribute('aria-pressed'),
    inactiveScreensInert: [...document.querySelectorAll('.screen:not(.active)')].every(screen => screen.inert),
    historyScreen: history.state?.scsScreen,
  }));
  assert(homeA11y.selectedPlayType === 'true', 'Selected play type exposes its state');
  assert(homeA11y.inactiveScreensInert, 'Inactive screens are removed from keyboard navigation');
  assert(homeA11y.historyScreen === 'home', 'Browser history tracks the active screen');

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
  const gameControlsAccessible = await page.evaluate(() =>
    [...document.querySelectorAll('#game .corner-shape')].every(corner => corner.tagName === 'BUTTON' && corner.getAttribute('aria-label'))
  );
  assert(gameControlsAccessible, 'Game targets are labelled keyboard controls');

  const centerBeforeClimax = await page.locator('#centerPlatform').boundingBox();
  await page.evaluate(() => document.querySelector('#game')?.classList.add('action-climax', 'action-climax-peak'));
  await page.waitForTimeout(250);
  const centerDuringClimax = await page.locator('#centerPlatform').boundingBox();
  await page.evaluate(() => document.querySelector('#game')?.classList.remove('action-climax', 'action-climax-peak'));
  const centerDelta = centerBeforeClimax && centerDuringClimax
    ? Math.hypot(
      centerBeforeClimax.x + centerBeforeClimax.width / 2 - centerDuringClimax.x - centerDuringClimax.width / 2,
      centerBeforeClimax.y + centerBeforeClimax.height / 2 - centerDuringClimax.y - centerDuringClimax.height / 2
    )
    : Infinity;
  assert(centerDelta < 1.5, 'Center stimulus stays centered during climax animation');

  // ─── 5) Pause and Resume ───
  console.log('\n5. Pause/Resume');
  await clickSel('#btnPause', 600);
  assert(await hasActiveClass('#pauseOverlay', 2000), 'Pause overlay visible');

  await clickSel('#btnPauseSettings', 600);
  assert(await hasActiveClass('#settings', 2000), 'Pause Settings opens settings');
  await clickSel('#settings .btn-back-bottom', 600);
  assert(await hasActiveClass('#game', 2000), 'Visible Settings Back returns to game');
  assert(await hasActiveClass('#pauseOverlay', 2000), 'Visible Settings Back reopens pause overlay');

  await clickSel('#btnPauseSettings', 600);
  assert(await hasActiveClass('#settings', 2000), 'Pause Settings can reopen without stale modal state');
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await page.waitForTimeout(600);
  assert(await hasActiveClass('#game', 2000), 'Browser Back returns from Settings to game');
  assert(await hasActiveClass('#pauseOverlay', 2000), 'Browser Back reopens pause overlay');
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

  // ─── 8b) Leaving during Game Over must not reopen Results ───
  console.log('\n8b. Cancel stale Game Over transition');
  await clickSel('#btnPlay', 1500);
  assert(await hasActiveClass('#game', 5000), 'Game screen starts for stale-transition check');
  await page.waitForTimeout(4500);
  await page.evaluate(() => {
    globalThis.__SCS_QA__.forceGameOver();
    document.querySelector('#btnPauseQuit')?.click();
  });
  await page.waitForTimeout(1000);
  assert(await hasActiveClass('#home', 2000), 'Quit remains on home after a pending game-over transition');
  assert(!await hasActiveClass('#results', 300), 'Old game-over transition cannot reopen results');

  // ─── 8c) Incompatible mode switch clears prior game presentation ───
  console.log('\n8c. Memo to Chaos transition cleanup');
  await page.evaluate(() => globalThis.__SCS_QA__.setGameSelection('memo'));
  await clickSel('#btnPlay', 300);
  if (await visible('#modeInstructionOverlay', 1000)) {
    await clickSel('#btnStartAfterInstruction', 300);
  }
  assert(await hasActiveClass('#game', 3000), 'Memo game screen starts');
  await page.waitForTimeout(4500);
  assert(await page.evaluate(() => document.body.classList.contains('mode-memo')), 'Memo mode class is active');
  await page.evaluate(() => document.querySelector('#btnPauseQuit')?.click());
  assert(await hasActiveClass('#home', 3000), 'Memo quit returns home');
  await page.evaluate(() => globalThis.__SCS_QA__.setGameSelection('chaos'));
  await clickSel('#btnPlay', 300);
  if (await visible('#modeInstructionOverlay', 1000)) {
    await clickSel('#btnStartAfterInstruction', 300);
  }
  assert(await hasActiveClass('#game', 3000), 'Chaos game screen starts after Memo');
  await page.waitForTimeout(4500);
  const cleanModeSwitch = await page.evaluate(() => ({
    chaosActive: document.body.classList.contains('mode-chaos'),
    memoInactive: !document.body.classList.contains('mode-memo'),
    memoCornersCleared: !document.querySelector('.corner-shape.memo-covered, .corner-shape.memo-revealing'),
    memoHudCleared: !document.querySelector('#memoHUD, #memoGhostRacer'),
  }));
  assert(cleanModeSwitch.chaosActive && cleanModeSwitch.memoInactive, 'Chaos replaces the Memo body mode');
  assert(cleanModeSwitch.memoCornersCleared && cleanModeSwitch.memoHudCleared, 'Memo presentation is cleared before Chaos');
  await page.evaluate(() => globalThis.__SCS_QA__.triggerChaosRuleSwitch());
  assert(await visible('.chaos-rule-banner', 1000), 'Chaos rule switch banner appears');
  await page.evaluate(() => document.querySelector('#btnPauseQuit')?.click());
  assert(await hasActiveClass('#home', 3000), 'Chaos quit returns home');
  assert(!await page.locator('.chaos-rule-banner').count(), 'Chaos rule switch banner is removed on quit');

  // ─── 8d) Leaving Sequenz during watch clears timed feedback ───
  console.log('\n8d. Sequenz watch to Math transition cleanup');
  await page.evaluate(() => globalThis.__SCS_QA__.setGameSelection('sequenz', 'endless'));
  await clickSel('#btnPlay', 300);
  if (await visible('#modeInstructionOverlay', 1000)) {
    await clickSel('#btnStartAfterInstruction', 300);
  }
  assert(await hasActiveClass('#game', 3000), 'Sequenz game screen starts');
  await page.waitForTimeout(4500);
  assert(await page.evaluate(() => document.body.classList.contains('mode-sequenz')), 'Sequenz mode class is active during watch');
  await page.evaluate(() => document.querySelector('#btnPauseQuit')?.click());
  assert(await hasActiveClass('#home', 3000), 'Sequenz quit returns home during watch');
  await page.evaluate(() => globalThis.__SCS_QA__.setGameSelection('mathe'));
  await clickSel('#btnPlay', 300);
  if (await visible('#modeInstructionOverlay', 1000)) {
    await clickSel('#btnStartAfterInstruction', 300);
  }
  assert(await hasActiveClass('#game', 3000), 'Math game screen starts after Sequenz');
  await page.waitForTimeout(4500);
  const cleanSequenzSwitch = await page.evaluate(() => ({
    mathActive: document.body.classList.contains('mode-mathe'),
    sequenzInactive: !document.body.classList.contains('mode-sequenz'),
    noFlash: !document.querySelector('.corner-shape.sequenz-flash'),
    noSequenzHud: !document.querySelector('#sequenzHUD, .sequenz-record-pop'),
    noSequenzCenter: !document.querySelector('.sequenz-round-display'),
  }));
  assert(cleanSequenzSwitch.mathActive && cleanSequenzSwitch.sequenzInactive, 'Math replaces the Sequenz body mode');
  assert(cleanSequenzSwitch.noFlash && cleanSequenzSwitch.noSequenzHud && cleanSequenzSwitch.noSequenzCenter, 'Sequenz watch feedback is cleared before Math');
  await page.evaluate(() => document.querySelector('#btnPauseQuit')?.click());
  assert(await hasActiveClass('#home', 3000), 'Math quit returns home');

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
  await clickSel('#btnEngagementReport', 1000);
  const reportState = await page.evaluate(() => {
    const report = document.querySelector('#engagementReport');
    const exports = document.querySelector('#erExportButtons');
    return {
      active: report?.classList.contains('active'),
      validEmptyState: !report?.classList.contains('no-data') || (exports?.hidden && getComputedStyle(exports).display === 'none'),
    };
  });
  assert(reportState.active, 'Engagement report opens');
  assert(reportState.validEmptyState, 'Empty report hides unavailable export actions');
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
  const storeSemantics = await page.evaluate(() => ({
    selectedTab: document.querySelector('.shop-tab.selected')?.getAttribute('aria-selected'),
    activeControlIsButton: document.querySelector('.unlock-item.active-item .btn-active')?.tagName === 'BUTTON',
  }));
  assert(storeSemantics.selectedTab === 'true', 'Store tab exposes its selected state');
  assert(!storeSemantics.activeControlIsButton, 'Active store item is status, not a dead button');
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

  // ─── 13) Progressive Home feed ───
  console.log('\n13. Progressive Home');
  if (!await visible('#home', 1000)) {
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.querySelector('#home')?.classList.add('active');
    });
    await page.waitForTimeout(400);
  }
  const homeState = await page.evaluate(() => {
    const visiblePlayTypes = [...document.querySelectorAll('.play-type-btn')]
      .filter(btn => getComputedStyle(btn).display !== 'none' && btn.getBoundingClientRect().height > 0).length;
    const sheet = document.querySelector('#homeBottomSheet');
    const quests = document.querySelector('#dailyQuestsPanel');
    const season = document.querySelector('#seasonPassCard');
    return {
      essentials: Boolean(document.querySelector('#dailyCard') && document.querySelector('#wheelCard')),
      progressionDetached: Boolean(quests && season && getComputedStyle(quests).display === 'none' && getComputedStyle(season).display === 'none'),
      visiblePlayTypes,
      fitsViewport: Boolean(sheet && sheet.scrollHeight <= sheet.clientHeight + 2),
    };
  });
  assert(homeState.essentials, 'Home keeps daily challenge and wheel');
  assert(homeState.progressionDetached, 'Quest and season details stay off the focused dashboard');
  assert(homeState.visiblePlayTypes <= 3, `Visible play types reduced (${homeState.visiblePlayTypes})`);
  assert(homeState.fitsViewport, 'Home dashboard fits without scrolling');

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
