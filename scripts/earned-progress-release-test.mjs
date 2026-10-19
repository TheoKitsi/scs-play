/** Six naturally timed rounds on a new guest profile. No injected scores,
 * rewards, achievements, dates, clocks or forced game-over callbacks. The QA
 * hook is read-only here: it identifies the stimulus for real DOM answers. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const externalBase = process.env.SCS_BASE || '';
const server = externalBase ? null : await startStaticServer({ root: 'docs', port: 0 });
const base = externalBase || server.baseUrl;
const out = process.env.SCS_REVIEW_OUT ? resolve(process.env.SCS_REVIEW_OUT, 'earned-progress') : '';
if (out) mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'de-DE', viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
await context.addInitScript(() => {
  localStorage.setItem('scsQa', '1');
  addEventListener('error', event => { if (event.message) console.error('[earned-progress]', event.message); });
  addEventListener('unhandledrejection', event => console.error('[earned-progress]', String(event.reason?.stack || event.reason)));
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && message.text().startsWith('[earned-progress]')) errors.push(message.text());
});
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('scs_save:guest') || 'null'));
const snapshot = async name => {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, name);
  if (out) await page.screenshot({ path: resolve(out, `${name}.png`), animations: 'disabled' });
};

async function enterHome(reload = false) {
  if (reload) await page.reload({ waitUntil: 'networkidle' });
  else await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('#auth.active, #home.active').waitFor();
  if (await page.locator('#btnGuest').isVisible()) await page.locator('#btnGuest').click();
  await page.locator('#home.active').waitFor();
  await page.waitForTimeout(950);
  for (let i = 0; i < 3; i++) {
    const hint = page.locator('.onboarding-overlay.active .onboarding-btn-ok');
    if (!await hint.isVisible()) break;
    await hint.click(); await page.waitForTimeout(450);
  }
}

async function waitForRound() {
  await page.waitForFunction(() => {
    if (document.querySelector('#tutorial.active')) document.querySelector('#btnTutorialSkip')?.click();
    if (document.querySelector('#modeInstructionOverlay.active')) document.querySelector('#btnStartAfterInstruction')?.click();
    const state = globalThis.__SCS_QA__?.gameState();
    return Boolean(document.querySelector('#game.active') && state?.running && !state.paused && state.stimulusId != null);
  }, null, { timeout: 15000 });
}

async function playUntilNaturalEnd(reaction) {
  return page.evaluate(async reaction => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const deadline = performance.now() + 70000;
    let answered = null, inputs = 0;
    while (performance.now() < deadline) {
      const state = globalThis.__SCS_QA__.gameState();
      if (!state.running) return { inputs, elapsed: state.elapsed, total: state.total, correct: state.correct };
      if (state.paused) throw new Error('Unexpected pause in the naturally timed round');
      if (state.stimulusId != null && state.stimulusId !== answered) {
        await sleep(reaction);
        const fresh = globalThis.__SCS_QA__.gameState();
        if (!fresh.running || fresh.stimulusId !== state.stimulusId) continue;
        const target = document.querySelector(`.corner-shape[data-dir="${fresh.direction}"]`);
        if (!target) throw new Error('Missing answer target');
        target.click();
        answered = fresh.stimulusId;
        inputs++;
      } else await sleep(20);
    }
    throw new Error('Natural round timer failed to complete within 70 seconds');
  }, reaction);
}

function assertRestored(before, after) {
  assert.equal(after.gamesPlayed, before.gamesPlayed);
  assert.deepEqual(after.scores_klassik, before.scores_klassik);
  assert.deepEqual(after.scores_beginner, before.scores_beginner);
  assert.deepEqual(after.progression, before.progression, 'Round receipts and earned counters survive a reload');
  assert.deepEqual(after.achievements, before.achievements);
  if (after.lastLoginDate === before.lastLoginDate) {
    for (const key of ['totalXP', 'level', 'fire', 'lives']) assert.equal(after[key], before[key], `Reload preserves ${key}`);
  } else {
    // A real midnight crossing may legitimately grant the next login reward.
    for (const key of ['totalXP', 'level', 'fire', 'lives']) assert.ok(after[key] >= before[key], `No ${key} loss across midnight`);
  }
}

try {
  await enterHome();
  const initial = await saved();
  assert.equal(initial?.gamesPlayed || 0, 0);
  const rounds = [];
  for (let round = 1; round <= 6; round++) {
    if (round === 6) {
      const beforeReload = await saved();
      await enterHome(true);
      assertRestored(beforeReload, await saved());
      await page.locator('#btnAllModes').click();
      await page.locator('[data-mode-choice="beginner"]').click();
    }
    const before = await saved();
    await page.locator('#btnPlay').click();
    await waitForRound();
    const result = await playUntilNaturalEnd([260, 230, 200, 170, 140, 220][round - 1]);
    assert.ok(result.elapsed >= 29 && result.correct >= 10, `Round ${round} is earned through a full timer and actual answers`);
    await page.locator('#results.active').waitFor();
    const preview = await saved();
    assert.equal(preview.progression.qualifiedRounds, round - 1, 'The continuation preview is not a second reward');
    assert.equal(preview.totalXP, before.totalXP);
    if (round === 2) {
      const reserve = before.lives;
      await page.locator('#btnResContinueUse').click();
      await waitForRound();
      assert.equal((await saved()).lives, reserve - 1, 'Real continuation consumes exactly one reserve life');
      const extended = await playUntilNaturalEnd(200);
      assert.ok(extended.elapsed >= 44 && extended.correct > result.correct, 'Continuation really extends the same round');
      await page.locator('#results.active').waitFor();
    } else {
      await page.locator('#btnResContinueNo').click();
    }
    await page.locator('#resNormalBtns').waitFor({ state: 'visible' });
    await page.waitForFunction(expected => {
      const data = JSON.parse(localStorage.getItem('scs_save:guest') || 'null');
      return data?.gamesPlayed === expected && data.progression?.qualifiedRounds === expected;
    }, round);
    const data = await saved();
    assert.equal(data.progression.recentRounds.length, round);
    assert.equal(new Set(data.progression.recentRounds.map(item => item.id)).size, round, 'No duplicate round receipts');
    assert.ok(data.progression.recentRounds.every(item => item.result.qualified));
    assert.ok(data.totalXP > before.totalXP, 'Qualified play earns genuine XP');
    const mode = round === 6 ? 'beginner' : 'klassik';
    const entry = [...data[`scores_${mode}`]].sort((a, b) => b.date.localeCompare(a.date))[0];
    assert.ok(entry.score > 0 && entry.total >= 10 && entry.correct >= 10 && entry.elapsed >= 29);
    rounds.push({ round, mode, score: entry.score, correct: entry.correct, total: entry.total, elapsed: entry.elapsed, xp: data.totalXP, achievements: [...data.achievements] });
    await page.waitForTimeout(2500);
    await snapshot(`round-${round}-${mode}`);
    await page.locator('#btnHome').click();
    // Re-enter via the ordinary home command rather than altering engine state.
    await page.locator('#home.active').waitFor();
  }

  const earned = await saved();
  assert.equal(earned.scores_klassik.length, 5);
  assert.equal(earned.scores_beginner.length, 1);
  assert.equal(earned.progression.modeRounds.klassik, 5);
  assert.equal(earned.progression.modeRounds.beginner, 1);
  assert.ok(earned.totalXP >= 120 && earned.level >= 1, 'The profile level is genuinely earned');
  assert.ok(earned.achievements.includes('games_total_5'), 'The five-round milestone is earned, not seeded');

  await page.locator('#btnLeaderboard').click();
  await page.locator('#lbModeSelect').selectOption('klassik');
  await page.locator('.lb-filter-btn[data-filter="blitz"]').click();
  assert.equal(await page.locator('.score-row').count(), 5);
  assert.deepEqual(await page.locator('.score-big').allTextContents().then(values => values.map(value => Number(value.replace(/\D/g, '')))), earned.scores_klassik.map(item => item.score));
  await snapshot('records-earned');
  await page.locator('#leaderboard .btn-back-bottom').click();
  await page.locator('#btnAchievements').click();
  await page.locator('.ach-tab[data-filter="earned"]').click();
  assert.ok(await page.locator('.ach-node.earned').count() > 0);
  assert.match(await page.locator('#achievements').textContent(), /5 gespielte Runden/);
  const milestoneHeader = page.locator('.ach-cat-header[data-cat="milestones"]');
  const precisionHeader = page.locator('.ach-cat-header[data-cat="precision"]');
  assert.equal(await milestoneHeader.isVisible(), true);
  assert.equal(await precisionHeader.isVisible(), true, 'Other earned categories remain reachable while one is expanded');
  await snapshot('achievements-earned');
  await precisionHeader.click();
  await page.locator('.ach-category[data-cat="precision"] .ach-node.earned').first().waitFor({ state: 'visible' });
  assert.equal(await milestoneHeader.isVisible(), true, 'Opening precision does not hide the milestones header');
  assert.equal(await page.locator('.ach-category.expanded').count(), 1, 'The accordion still opens only one body');
  await snapshot('achievements-earned-precision');
  await page.locator('#achievements .btn-back-bottom').click();
  await page.locator('#btnSettings').click();
  await page.locator('#btnEngagementReport').click();
  await page.locator('#engagementReport.active .er-signal-card').first().waitFor({ state: 'visible' });
  assert.equal(await page.locator('#engagementReport').evaluate(el => el.classList.contains('no-data')), false);
  assert.ok(await page.locator('.er-signal-card').count() >= 6);
  assert.equal(await page.locator('#erExportButtons').isVisible(), true);
  assert.doesNotMatch(await page.locator('.er-score-label').textContent(), /Spaß|fun|Engagement/);
  await snapshot('analysis-earned');
  await page.locator('#engagementReport .btn-back-bottom').click();
  const beforeReload = await saved();
  await enterHome(true);
  assertRestored(beforeReload, await saved());
  await snapshot('profile-restored');
  assert.deepEqual(errors, []);
  if (out) writeFileSync(resolve(out, 'earned-rounds.json'), JSON.stringify(rounds, null, 2));
  console.log('PASS six naturally timed rounds in Colors/Shapes, real reserve-life continuation, earned level/milestone/records/analysis and two reloads; no seeded progression or clock overrides');
} finally {
  await context.close();
  await browser.close();
  if (server) await server.close();
}
