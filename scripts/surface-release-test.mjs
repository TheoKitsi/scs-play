/** Real navigation plus explicitly seeded state-gallery fixtures. Production
 * gameplay is separately covered by presentation/reward/streak/smoke gates. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

// Composited translation can report 44 CSS px as 43.999996. Keep checking
// painted geometry (not just offset size), with 0.001 CSS-px rounding tolerance.
function hasFullTouchTarget({ width, height, layoutWidth, layoutHeight }) {
  return layoutWidth >= 44 && layoutHeight >= 44 && width >= 44 - 0.001 && height >= 44 - 0.001;
}

export async function runSurfaceReview({ out = process.env.SCS_REVIEW_OUT || '', only = process.env.SCS_REVIEW_VIEW || '' } = {}) {
  const server = await startStaticServer({ root: '.', port: 0 });
  const browser = await chromium.launch({ headless: true });
  const views = [{ name: 'phone', width: 412, height: 915 }, { name: 'small', width: 360, height: 640 }, { name: 'desktop', width: 1440, height: 900 }];
  try {
    for (const view of views.filter(view => !only || view.name === only)) {
      const context = await browser.newContext({ viewport: view, deviceScaleFactor: 1, isMobile: view.width < 768, hasTouch: view.width < 768, locale: 'de-DE', serviceWorkers: 'block' });
      await context.addInitScript(() => {
        localStorage.setItem('scsQa', '1'); localStorage.setItem('scsQaPerfTier', 'high');
        globalThis.__surfaceErrors = [];
        addEventListener('error', e => { if (e.message) globalThis.__surfaceErrors.push(e.message); });
        addEventListener('unhandledrejection', e => globalThis.__surfaceErrors.push(String(e.reason?.stack || e.reason)));
      });
      const page = await context.newPage();
      const nativeDialogs = [];
      page.on('dialog', async dialog => { nativeDialogs.push(dialog.type()); await dialog.dismiss(); });
      const dir = out ? resolve(out, view.name) : '';
      if (dir) mkdirSync(dir, { recursive: true });
      let shots = 0;
      const shot = async name => {
        await page.waitForTimeout(400);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${view.name}/${name}: page overflow`);
        if (dir) await page.screenshot({ path: resolve(dir, `${name}.png`), animations: 'disabled' });
        shots++;
      };
      const home = async () => {
        await page.evaluate(async () => { const { showHome } = await import('/js/screens/HomeScreen.js'); showHome(); });
        await page.locator('#home.active').waitFor();
      };
      const back = async screen => { await page.locator(`#${screen} .btn-back-bottom`).click(); await page.locator('#home.active').waitFor(); };
      const appState = (fn, arg) => page.evaluate(fn, arg);
      try {
        await page.goto(server.baseUrl, { waitUntil: 'networkidle' });
        await page.locator('#btnGuest').waitFor({ state: 'visible' });
        await shot('01-auth');
        await page.evaluate(async () => { const { t } = await import('/js/i18n.js'); document.querySelector('#authError').textContent = t('error_network'); });
        await shot('01-auth-error');
        await page.evaluate(() => { document.querySelector('#authError').textContent = ''; });
        await page.locator('#btnGuest').click();
        await page.waitForTimeout(950);
        if (await page.locator('.onboarding-overlay.active').count()) await shot('02-onboarding');
        for (let i = 0; i < 3; i++) {
          const button = page.locator('.onboarding-overlay.active .onboarding-btn-ok');
          if (!await button.isVisible()) break;
          await button.click(); await page.waitForTimeout(450);
        }
        await shot('03-home');
        await page.locator('#homeLivesBadge').click();
        await page.waitForFunction(() => document.activeElement.id === 'appDialogConfirm');
        assert.match(await page.locator('#appDialogMessage').textContent(), /Endlos/);
        await shot('04-reserve-lives');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.activeElement.id === 'homeLivesBadge');
        await page.locator('#btnAllModes').click();
        assert.equal(await page.locator('.mode-choice-task').count(), 10);
        assert.ok(await page.locator('.mode-choice--locked .line-icon').count());
        await shot('05-catalog');
        await page.locator('.mode-picker-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
        await shot('06-catalog-bottom');
        await page.locator('#btnCloseModes').click();

        await page.locator('#btnLeaderboard').click(); await shot('07-records-empty');
        await page.locator('#lbModeSelect').selectOption('mathe');
        assert.equal(await page.locator('#lbModeSelect').inputValue(), 'mathe');
        await back('leaderboard');
        await appState(async () => {
          const { default: app } = await import('/js/appState.js');
          app.save.data.scores_klassik = [12000, 8000, 4000, 2000].map((score, i) => ({ score, playType: 'blitz', accuracy: 98 - i, streak: 40 - i, date: new Date(Date.now() - i * 3600000).toISOString() }));
          app.save.data.displayName = 'Ein besonders langer lokaler Spielername';
        });
        await page.locator('#btnLeaderboard').click(); await page.locator('#lbModeSelect').selectOption('klassik');
        assert.equal(await page.locator('.score-row').count(), 4); await shot('08-records-filled');
        await back('leaderboard');

        await page.locator('#btnAchievements').click(); await shot('09-achievements-focus');
        await page.locator('.ach-tab[data-filter="earned"]').click(); await shot('10-achievements-empty');
        await appState(async () => {
          const { default: app } = await import('/js/appState.js');
          const { generateAchievements } = await import('/js/achievements/AchievementSystem.js');
          app.save.data.achievements = [generateAchievements()[0].id];
        });
        await page.locator('.ach-tab[data-filter="all"]').click(); await shot('11-achievements-archive');
        await back('achievements');

        await page.locator('#btnStore').click(); await shot('12-shop-unaffordable');
        assert.equal(await page.locator('[data-item-id="neon"] .unlock-requirement').textContent(), 'Ab Level 4', 'Cosmetic requirements use the same one-based level display as the profile');
        await back('store');
        await appState(async () => { const { default: app } = await import('/js/appState.js'); const { CONFIG } = await import('/js/config.js'); app.save.data.fire = 5000; app.save.data.level = 20; app.save.data.totalXP = CONFIG.LEVEL_THRESHOLDS[20] + 30000; });
        await page.locator('#btnStore').click();
        const buy = page.locator('.btn-fire-buy:not([disabled])').first();
        const item = await buy.getAttribute('data-id');
        const cost = Number(await buy.getAttribute('data-cost'));
        await buy.click(); await page.waitForFunction(() => document.activeElement.id === 'appDialogCancel');
        await shot('13-shop-confirm');
        await page.keyboard.press('Escape');
        assert.equal(await appState(async () => (await import('/js/appState.js')).default.save.getFireBalance()), 5000);
        await buy.click();
        await page.waitForFunction(() => document.activeElement.id === 'appDialogCancel');
        await page.goBack();
        await page.locator('#appDialog').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#store.active').count(), 1, 'Back cancels the dialog before navigating away');
        assert.equal(await appState(async () => (await import('/js/appState.js')).default.save.getFireBalance()), 5000);
        await buy.click(); await page.locator('#appDialogConfirm').click();
        await page.waitForFunction(id => document.querySelector(`[data-item-id="${id}"] .btn-active`), item);
        assert.equal(await appState(async () => (await import('/js/appState.js')).default.save.getFireBalance()), 5000 - cost);
        await page.waitForTimeout(2100); await shot('14-shop-owned');
        await page.locator('#shopTabTrails').click(); await shot('15-shop-trails');
        await back('store');
        await appState(async () => { const { default: app } = await import('/js/appState.js'); await app.save.setActiveTheme('default'); });
        await home();

        await page.locator('#homeAvatar').click(); await shot('16-avatar');
        const image = await page.evaluate(() => {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
          const ctx = canvas.getContext('2d'); ctx.fillStyle = '#7C3AED'; ctx.fillRect(0, 0, 64, 64); ctx.fillStyle = '#C4CEDD'; ctx.fillRect(12, 12, 40, 40);
          return canvas.toDataURL().split(',')[1];
        });
        await page.locator('#avatarFileInput').setInputFiles({ name: 'review.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
        await page.locator('#btnAvatarRemovePhoto').waitFor({ state: 'visible' }); await shot('17-avatar-photo');
        await page.locator('#btnAvatarRemovePhoto').click();
        assert.equal(await appState(async () => (await import('/js/appState.js')).default.save.getAvatar().photo), undefined);
        await page.locator('#avatarFileInput').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid image data') });
        await page.waitForFunction(() => document.querySelector('#avatarUploadStatus').textContent.includes('lesbare'));
        await shot('17-avatar-error'); await page.locator('#btnAvatarSave').click();

        await page.locator('#btnSettings').click(); await shot('18-settings');
        await page.locator('#toggleDepth').check();
        await page.locator('#toggleMotion').check();
        await page.waitForFunction(() => document.querySelector('#depthStatus').textContent.includes('reduzierte'));
        await shot('19-settings-reduced');
        await page.locator('#toggleMotion').uncheck();
        await page.locator('#settings .screen-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
        await shot('20-settings-bottom');
        await page.locator('#btnEngagementReport').click(); await shot('21-analysis-empty');
        await back('engagementReport');
        // Explicit fixture: renderer coverage, not a claim about analytics accuracy.
        await appState(async () => {
          const { default: app } = await import('/js/appState.js');
          app.engagement.computeEngagementScore = () => ({ score: 62, label: 'engagement_solid', signals: { totalSessions: 12, totalGames: 40, firstSeen: new Date().toISOString(), activeDaysPerWeek: 4, avgSessionMin: 8, avgScoreTrend: .12, retryRate: .75, quitRate: .1, modesPlayed: 6, feedbackCount: 0 }, subscores: { retention: .6, sessionLen: .7, scoreTrend: .8, retryRate: .75, quitRate: .9, exploration: .6 } });
        });
        await page.locator('#btnSettings').click(); await page.locator('#btnEngagementReport').click();
        assert.doesNotMatch(await page.locator('.er-score-label').textContent(), /Spaß|fun|Engagement/);
        await shot('22-analysis-filled'); await back('engagementReport');

        await page.locator('#btnWheel').click(); await shot('23-wheel');
        await page.locator('#btnWheelSpin').click();
        await page.locator('.wheel-result-card.revealed').waitFor({ timeout: 12000 });
        await shot('24-wheel-result');
        assert.equal(await page.locator('#btnWheelSpin').isDisabled(), true);
        await page.locator('#btnWheelClose').click();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await appState(async () => {
          const { default: app } = await import('/js/appState.js');
          app.save.data.wheelBonusSpinUnlockedDate = new Date().toISOString().slice(0, 10);
          (await import('/js/screens/WheelScreen.js')).updateWheelCard();
        });
        await page.locator('#btnWheel').click(); await page.locator('#btnWheelSpin').click();
        await page.locator('.wheel-result-card.revealed').waitFor({ timeout: 1500 });
        assert.equal(await appState(async () => (await import('/js/appState.js')).default.save.data.wheelSpinsToday), 2);
        await shot('24-wheel-reduced'); await page.locator('#btnWheelClose').click();
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        // The original prize/once-per-day rules remain in force.
        await page.locator('#btnWheel').click(); assert.equal(await page.locator('#btnWheelSpin').isDisabled(), true);
        await page.locator('#btnWheelClose').click();

        await page.locator('#btnPlay').click(); await page.locator('#tutorial.active').waitFor();
        assert.equal(await page.locator('.tutorial-slide:not(.active)').evaluateAll(slides => slides.every(slide => slide.inert)), true, 'Hidden tutorial controls are not reachable by keyboard');
        await shot('25-tutorial-1');
        await page.locator('#btnTutorialNext').click(); await shot('26-tutorial-2');
        await page.locator('[data-tutorial-dir="ul"]').focus(); await page.keyboard.press('Enter');
        await page.waitForTimeout(950); await shot('27-tutorial-3');
        await page.locator('#btnTutorialNext').click(); await shot('28-tutorial-4');
        await page.locator('#btnTutorialNext').click();
        await page.waitForFunction(() => globalThis.__SCS_QA__.gameState()?.stimulusId != null);
        await shot('29-game');
        await page.evaluate(async () => {
          const { default: app } = await import('/js/appState.js');
          app.game.onEndlessLifeEarned(5);
          app.game.onEndlessMiss(4);
          app.game.onStreakProtected(10);
        });
        assert.equal(await page.locator('#gameNotice').getAttribute('data-kind'), 'streak');
        assert.equal(await page.locator('#game .flash-overlay,#game .confetti-piece').count(), 0, 'Life/streak presentation does not allocate full-screen celebration layers');
        await shot('29-peripheral-status');
        await page.locator('#btnPause').click(); await shot('30-pause');
        await page.locator('#btnPauseSettings').click();
        assert.match(await page.locator('#settings .btn-back-bottom').textContent(), /Spiel/);
        await page.locator('#settings .btn-back-bottom').click();
        await page.locator('#btnResume').click();
        await page.evaluate(() => globalThis.__SCS_QA__.forceGameOver());
        await page.locator('#results.active').waitFor(); await shot('31-results-continue');
        assert.equal(await page.locator('#resContinueDesc').isVisible(), true, 'Available continuation explains its actual time bonus');
        await page.locator('#btnResContinueNo').click();
        await page.locator('#resNormalBtns').waitFor({ state: 'visible' }); await shot('32-results-empty');
        assert.equal(await page.locator('#resXPSection').isVisible(), false);
        assert.equal(await page.locator('#resAccuracy').textContent(), '—');
        await page.locator('#btnHome').click();
        await page.evaluate(async () => {
          const { default: app } = await import('/js/appState.js');
          app.save.data.lives = 0;
          await (await import('/js/screens/ResultsScreen.js')).showResults(app.lastResultStats, true);
        });
        await page.locator('#resContinue').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#btnResContinueUse').isVisible(), false);
        assert.equal(await page.locator('#resContinueDesc').isVisible(), false, 'No time bonus is advertised without a reserve life');
        assert.equal(await page.locator('#resContinueDesc').textContent(), '');
        assert.match(await page.locator('#resSummary').textContent(), /Keine Vorratsleben/);
        await shot('32-results-no-reserve');
        await page.evaluate(async () => {
          const { default: app } = await import('/js/appState.js');
          app.save.data.lives = 2;
          await (await import('/js/screens/ResultsScreen.js')).showResults(app.lastResultStats, true);
        });
        await page.locator('#btnResContinueUse').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#resContinueDesc').isVisible(), true, 'The bonus description is restored for a later eligible continuation');
        await shot('32-results-reserve-restored');
        await home();

        const sharing = await page.evaluate(async () => {
          const { shareScore } = await import('/js/services/ShareService.js');
          const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');
          const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
          let copies = 0;
          try {
            Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('User cancelled', 'AbortError'); } });
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { copies++; } } });
            await shareScore({ mode: 'klassik', playType: 'blitz', score: 100, accuracy: 90, streak: 2 });
            return copies;
          } finally {
            if (shareDescriptor) Object.defineProperty(navigator, 'share', shareDescriptor); else delete navigator.share;
            if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor); else delete navigator.clipboard;
          }
        });
        assert.equal(sharing, 0, 'Cancelling native sharing must not copy or open another dialog');
        await page.evaluate(async () => {
          const { shareScore } = await import('/js/services/ShareService.js');
          const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share');
          const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
          const exec = document.execCommand;
          Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard unavailable'); } } });
          document.execCommand = () => false;
          globalThis.__shareFallbackToasts = [];
          globalThis.__shareReviewCompletion = shareScore({ mode: 'klassik', playType: 'blitz', score: 100, accuracy: 90, streak: 2 }, () => ({
            achievementToast: message => globalThis.__shareFallbackToasts.push(message),
          })).finally(() => {
            document.execCommand = exec;
            if (shareDescriptor) Object.defineProperty(navigator, 'share', shareDescriptor); else delete navigator.share;
            if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor); else delete navigator.clipboard;
          });
        });
        await page.locator('#appDialogCopy').waitFor({ state: 'visible' });
        assert.deepEqual(await page.evaluate(() => globalThis.__shareFallbackToasts), [], 'Manual copying has one dialog and no duplicate toast behind it');
        const shareText = await page.locator('#appDialogCopy').inputValue();
        assert.match(shareText, /Farben/);
        assert.doesNotMatch(shareText, /KLASSIK|\bavg\b/);
        await page.waitForFunction(() => document.activeElement.id === 'appDialogConfirm');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'appDialogCopy', 'Tab wraps within the dialog');
        await shot('32-share-fallback');
        await page.keyboard.press('Escape');
        await page.evaluate(() => globalThis.__shareReviewCompletion);
        // Representative success, record, daily and competition result fixtures.
        for (const [name, playType, daily] of [['complete', 'blitz', false], ['record', 'blitz', false], ['daily', 'blitz', true], ['competition', 'competition', false]]) {
          await appState(async ({ playType, daily, name }) => {
            const { showResults } = await import('/js/screens/ResultsScreen.js');
            await showResults({ roundId: `surface-${name}`, mode: 'klassik', playType, isDaily: daily, score: name === 'record' ? 16000 : 4500, rawScore: 4300, total: 30, correct: 28, accuracy: 93, streak: 14, avgReaction: 350, bestReactionTime: 220, streakBonus: 100, accBonus: 100, duration: 30, elapsed: 30, competitionWon: playType === 'competition', competitionLevel: 0, competitionStars: 2, competitionTarget: 3000 });
          }, { playType, daily, name });
          await page.locator('#resNormalBtns').waitFor({ state: 'visible' }); await shot(`33-result-${name}`);
          await page.locator('#resDetails > summary').click(); await shot(`34-details-${name}`);
          await page.locator('#btnHome').click();
        }
        await page.evaluate(async () => {
          const { default: app } = await import('/js/appState.js');
          const { showResults } = await import('/js/screens/ResultsScreen.js');
          await showResults(app.lastResultStats);
        });
        await page.locator('#resNormalBtns').waitFor({ state: 'visible' });
        await page.locator('#resDetails > summary').click();
        await page.evaluate(async () => {
          const { maybeShowFeedback } = await import('/js/helpers/microFeedback.js');
          maybeShowFeedback('sampling', { mode: 'klassik', sessionGame: 10 });
        });
        await page.locator('#microFeedback.active').waitFor();
        assert.equal(await page.locator('#resDetailsBody #microFeedback').count(), 1, 'Survey stays inside explicit round details');
        assert.equal(await page.locator('#microFeedback').evaluate(el => getComputedStyle(el).position), 'static', 'Survey must never float over replay controls');
        await page.locator('#microFeedback').scrollIntoViewIfNeeded(); await shot('36-feedback');
        await page.locator('#microFeedback .mf-skip').click();
        await page.locator('#btnHome').click();
        for (const theme of ['neon', 'ocean', 'sunset', 'forest', 'cosmic', 'retro', 'crystal']) {
          await page.evaluate(async theme => { const { applyTheme } = await import('/js/services/ThemeService.js'); applyTheme(theme); }, theme);
          await shot(`35-theme-${theme}`);
        }
        await page.evaluate(async () => (await import('/js/services/ThemeService.js')).applyTheme('default'));
        await page.evaluate(async () => (await import('/js/services/EffectsService.js')).getBodyFx().achievementToast('Design freigeschaltet'));
        await shot('36-notice');
        await page.evaluate(() => document.querySelector('.achievement-toast')?.click());
        const installTargets = await page.evaluate(() => {
          dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
          const button = document.querySelector('#btnDismissInstall');
          const animation = document.querySelector('#pwaInstallBanner').getAnimations().find(item => item.animationName === 'pwaSlideIn');
          const time = animation?.currentTime;
          const wasRunning = animation?.playState === 'running';
          const transform = button.style.transform;
          const measure = () => {
            const { width, height } = button.getBoundingClientRect();
            return { width, height, layoutWidth: button.offsetWidth, layoutHeight: button.offsetHeight };
          };
          try {
            // Exercise the real fractional-translation frame, not only the
            // settled layout. No production timers or animation rules change.
            if (animation) { animation.pause(); animation.currentTime = 247; }
            const animated = measure();
            button.style.transform = 'scale(.99)';
            return { animated, undersized: measure() };
          } finally {
            button.style.transform = transform;
            if (animation) {
              animation.currentTime = time;
              if (wasRunning) animation.play();
            }
          }
        });
        assert.ok(hasFullTouchTarget(installTargets.animated), `Animated installation dismissal is full-size: ${JSON.stringify(installTargets.animated)}`);
        assert.equal(hasFullTouchTarget(installTargets.undersized), false, `An actually scaled-down target must still fail: ${JSON.stringify(installTargets.undersized)}`);
        await page.locator('#pwaInstallBanner').waitFor({ state: 'visible' }); await shot('36-install');
        const settledTarget = await page.locator('#btnDismissInstall').evaluate(el => {
          const { width, height } = el.getBoundingClientRect();
          return { width, height, layoutWidth: el.offsetWidth, layoutHeight: el.offsetHeight };
        });
        assert.ok(hasFullTouchTarget(settledTarget), `Settled installation dismissal is full-size: ${JSON.stringify(settledTarget)}`);
        await page.locator('#btnDismissInstall').click();
        await page.evaluate(() => dispatchEvent(new Event('offline'))); await shot('36-offline');
        await page.evaluate(() => dispatchEvent(new Event('online')));
        await page.locator('#btnSettings').click(); await page.locator('#selectLang').selectOption('en'); await shot('37-settings-en');
        assert.match(await page.locator('.legal-links a').first().getAttribute('href'), /lang=en/);
        await back('settings'); await shot('38-home-en');
        if (view.width < 768) {
          await page.setViewportSize({ width: view.height, height: view.width });
          assert.equal(await page.locator('#landscapeWarning').isVisible(), false, 'Landscape must not block the home screen');
          await shot('38-landscape');
          await page.locator('#btnSettings').click();
          assert.equal(await page.locator('#settings.active').count(), 1);
          assert.equal(await page.locator('#landscapeWarning').isVisible(), false, 'Settings stay operable in landscape');
          await shot('38-landscape-settings');
          await back('settings');
          await page.setViewportSize({ width: view.width, height: view.height });
        }
        assert.deepEqual(nativeDialogs, [], 'No browser alert/confirm/prompt may interrupt the UI');
        assert.deepEqual(await page.evaluate(() => globalThis.__surfaceErrors), []);

        for (const file of ['privacy-policy.html', 'terms-of-service.html']) {
          for (const lang of ['de', 'en']) {
            await page.goto(`${server.baseUrl}/${file}?lang=${lang}`, { waitUntil: 'networkidle' });
            assert.equal(await page.locator('article:not([hidden])').getAttribute('lang'), lang);
            assert.equal(await page.locator('article:not([hidden]) h1').count(), 1);
            await shot(`39-${file}-${lang}`);
          }
        }
        console.log(`PASS ${view.name}: ${shots} surface states, real navigation, dialog cancellation/purchase, keyboard tutorial, photos, filter, preferences, rewards and bilingual legal pages`);
      } catch (error) {
        if (dir) await page.screenshot({ path: resolve(dir, 'failure.png') });
        console.error(view.name, await page.evaluate(() => ({ errors: globalThis.__surfaceErrors, screen: document.querySelector('.screen.active')?.id })));
        throw error;
      } finally { await context.close(); }
    }
  } finally { await browser.close(); await server.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runSurfaceReview();
