/** First-round reward budgets and disclosure, exercised through the real game.
 * Run after build:prod; SCS_BASE also supports the published release. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const externalBase = process.env.SCS_BASE || '';
const screenshot = process.argv.find(arg => arg.startsWith('--screenshot='))?.slice('--screenshot='.length);

async function enterHome(context, base) {
  await context.addInitScript(() => {
    localStorage.setItem('scsQa', '1');
    addEventListener('error', event => { if (event.message) console.error(event.message); });
    addEventListener('unhandledrejection', event => console.error(String(event.reason?.stack || event.reason)));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('#auth.active, #home.active', { timeout: 15000 });
  const guest = page.locator('#btnGuest');
  if (await guest.isVisible()) await guest.click();
  await page.waitForSelector('#home.active');
  return { page, errors };
}

async function startRound(page) {
  await page.evaluate(() => {
    globalThis.__SCS_QA__.setGameSelection('klassik', 'blitz');
    document.querySelector('#btnPlay').click();
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const running = await page.evaluate(() => {
      if (document.querySelector('#tutorial.active')) document.querySelector('#btnTutorialSkip')?.click();
      return globalThis.__SCS_QA__.gameState()?.running;
    });
    if (running) return;
    await page.waitForTimeout(100);
  }
  throw new Error('First round did not start');
}

async function finishPrompt(page) {
  await page.waitForSelector('#results.active');
  await page.locator('#btnResContinueNo').click();
  await page.waitForSelector('#resNormalBtns', { state: 'visible' });
}

async function run() {
  const server = externalBase ? null : await startStaticServer({ root: 'docs', port: 0 });
  let browser;
  try {
    const base = externalBase || server.baseUrl + '/';
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: 'de-DE', viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
    const { page, errors } = await enterHome(context, base);
    const before = await page.evaluate(() => globalThis.__SCS_QA__.progressionState());
    let maxToasts = 0;
    await page.exposeFunction('recordRewardToasts', count => { maxToasts = Math.max(maxToasts, count); });
    await page.evaluate(() => {
      const observe = () => globalThis.recordRewardToasts(document.querySelectorAll('.achievement-toast').length);
      new MutationObserver(observe).observe(document.body, { childList: true, subtree: true });
    });
    await startRound(page);
    const deadline = Date.now() + 70000;
    let answered = null;
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => globalThis.__SCS_QA__.gameState());
      if (!state.running) break;
      if (state.stimulusId != null && state.stimulusId !== answered) {
        await page.waitForTimeout(220);
        answered = await page.evaluate(id => {
          const current = globalThis.__SCS_QA__.gameState();
          if (current.stimulusId !== id) return null;
          document.querySelector(`.corner-shape[data-dir="${current.direction}"]`)?.click();
          return id;
        }, state.stimulusId);
      } else await page.waitForTimeout(60);
    }
    await page.waitForSelector('#results.active');
    const preview = await page.evaluate(() => globalThis.__SCS_QA__.progressionState());
    assert.equal(preview.xp, before.xp, 'Continue preview must not award progression');
    assert.equal(preview.progression.qualifiedRounds, 0);
    assert.equal(await page.locator('#resXPSection').isVisible(), false, 'Continue preview cannot present unearned XP');
    await finishPrompt(page);
    await page.waitForTimeout(6500);
    const result = await page.evaluate(() => globalThis.__SCS_QA__.progressionState());
    assert.ok(result.xp >= 20 && result.xp <= 30, `First real Blitz round must earn 20–30 XP, received ${result.xp}`);
    assert.equal(result.level, 0);
    assert.equal(result.achievements.length, 0);
    assert.equal(result.masteryTier, 0);
    assert.equal(result.progression.qualifiedRounds, 1);
    assert.equal(result.quests.quests.length, 1);
    assert.ok(result.quests.quests[0].progress <= 1);
    assert.equal(result.quests.quests[0].claimed, false);
    assert.equal(result.seasonPass, null);
    assert.ok(result.fire - before.fire <= 3);
    assert.equal(maxToasts, 0, 'No immediate or deferred achievement/reward toast flood on a first round');
    assert.equal(await page.locator('#resMilestone').isVisible(), false);
    assert.equal(await page.locator('#resDetails').getAttribute('open'), null);
    assert.equal(await page.locator('#resModeLevelInfo').isVisible(), false);
    assert.equal(await page.locator('#resAccuracy').isVisible(), true);
    assert.equal(await page.locator('#resAvgReaction').isVisible(), true);
    assert.equal(await page.locator('#resXPBar').isVisible(), true);
    const layout = await page.evaluate(() => ({
      buttons: document.querySelector('#resNormalBtns').getBoundingClientRect().bottom,
      viewport: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    assert.ok(layout.buttons <= layout.viewport && !layout.overflow, 'The lean result and replay buttons must fit a small phone');
    if (screenshot) await page.screenshot({ path: screenshot });
    await page.locator('#resDetails > summary').click();
    await page.waitForSelector('#resMasteryInsights');
    assert.equal(await page.locator('#resDailyGoal').isVisible(), true);
    assert.equal(await page.locator('.results-mastery .mastery-tier-name').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS actual first round: bounded XP, no level/rank/goal cascade, quiet result, opt-in details');
    await page.locator('#btnHome').click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#home.active');
    assert.equal((await page.evaluate(() => globalThis.__SCS_QA__.progressionState())).xp, result.xp);
    await context.close();

    const emptyContext = await browser.newContext({ locale: 'en-US', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const empty = await enterHome(emptyContext, base);
    await startRound(empty.page);
    await empty.page.evaluate(() => globalThis.__SCS_QA__.forceGameOver());
    await finishPrompt(empty.page);
    await empty.page.waitForTimeout(1500);
    const emptyResult = await empty.page.evaluate(() => globalThis.__SCS_QA__.progressionState());
    assert.equal(emptyResult.xp, 0);
    assert.equal(emptyResult.progression.qualifiedRounds, 0);
    assert.equal(emptyResult.quests.quests[0].progress, 0);
    assert.equal(emptyResult.achievements.length, 0);
    assert.equal(await empty.page.locator('#resMilestone').isVisible(), false);
    assert.deepEqual(empty.errors, []);
    console.log('PASS empty first round: no free rewards or completed goals');
    await emptyContext.close();

    const oldContext = await browser.newContext({ locale: 'de-DE', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    await oldContext.addInitScript(() => {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('scs_save:guest', JSON.stringify({
        totalXP: 5000, level: 5, gamesPlayed: 100, fire: 400, lives: 7, lastLoginDate: today,
        achievements: ['score_any_5000', 'streak_any_20', 'games_total_5'],
        modeMastery: { klassik: { totalGames: 5, zone300: 20, bestFlawless: 20 } },
        seasonPass: { startDate: today, points: 80, claimedStages: [0, 1] },
        dailyQuests: { date: today, quests: [{ id: 'old', target: 1, progress: 1, claimed: true }] },
      }));
    });
    const migrated = await enterHome(oldContext, base);
    const old = await migrated.page.evaluate(() => globalThis.__SCS_QA__.progressionState());
    assert.equal(old.xp, 5000);
    assert.equal(old.fire, 400);
    assert.equal(old.lives, 7);
    assert.ok(old.masteryTier > 0);
    assert.equal(old.quests.quests.length, 1);
    assert.equal(old.quests.quests[0].claimed, true);
    await migrated.page.locator('#btnAchievements').click();
    await migrated.page.locator('.ach-tab[data-filter="earned"]').click();
    await migrated.page.locator('.ach-legacy-archive > summary').click();
    await migrated.page.waitForSelector('.ach-legacy-list li');
    assert.ok((await migrated.page.locator('.ach-legacy-list').textContent()).includes('5.000'));
    assert.deepEqual(migrated.errors, []);
    console.log('PASS existing profile: balances, earned ranks/awards and claims survive migration');
    await oldContext.close();
    console.log('Reward release tests passed.');
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
