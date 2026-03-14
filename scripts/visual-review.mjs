/**
 * SCS Play — Visual UI Review Script
 * Takes screenshots of all screens on multiple device viewports.
 * Uses #id selectors for robustness (language-independent).
 * Run: node scripts/visual-review.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const DEVICES = {
  'galaxy-s25': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S936B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  },
  'small-android': {
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-A127F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  },
};

const BASE = 'http://localhost:3000';
const OUT = 'screenshots';

async function screenshotAll(deviceName, deviceConfig) {
  const dir = `${OUT}/${deviceName}`;
  mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(deviceConfig);
  const page = await context.newPage();

  const shot = async (name) => {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
    console.log(`  [${deviceName}] ${name}`);
  };

  const click = async (sel) => {
    const el = page.locator(sel);
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(800);
      return true;
    }
    console.log(`    SKIP: ${sel} not visible`);
    return false;
  };

  const goHome = async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500); // boot animation
    await click('#btnGuest'); // "Play Now" / "Jetzt Spielen"
  };

  // ─── 1) Boot / Auth Screen ───
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await shot('01-boot-auth');

  // ─── 2) Enter Home Screen ───
  await click('#btnGuest');
  await shot('02-home-top');

  // Scroll home content to see game modes
  await page.evaluate(() => {
    const home = document.querySelector('#home');
    if (home) home.scrollTop = 200;
  });
  await shot('02-home-mid');

  await page.evaluate(() => {
    const home = document.querySelector('#home');
    if (home) home.scrollTop = home.scrollHeight;
  });
  await shot('02-home-bottom');

  const goBack = async () => {
    // Try btn-back-bottom, then use JS to show home directly
    const backBtn = page.locator('.btn-back-bottom:visible').first();
    if (await backBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(600);
    } else {
      // Force show home screen via JS
      await page.evaluate(() => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const home = document.querySelector('#home');
        if (home) home.classList.add('active');
      });
      await page.waitForTimeout(400);
    }
  };

  const navTo = async (btnId, screenId) => {
    // First ensure we're on home screen
    const homeActive = await page.evaluate(() =>
      document.querySelector('#home')?.classList.contains('active')
    );
    if (!homeActive) {
      await page.evaluate(() => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.querySelector('#home')?.classList.add('active');
      });
      await page.waitForTimeout(400);
    }
    // Click the button via JS dispatch
    const clicked = await page.evaluate((id) => {
      const btn = document.querySelector(id);
      if (btn) { btn.click(); return true; }
      return false;
    }, btnId);
    if (clicked) {
      await page.waitForTimeout(800);
      return true;
    }
    console.log(`    SKIP: ${btnId} not found in DOM`);
    return false;
  };

  // ─── 3) Leaderboard Screen ───
  if (await navTo('#btnLeaderboard', '#leaderboard')) {
    await shot('03-leaderboard');
    await goBack();
  }

  // ─── 4) Achievements Screen ───
  if (await navTo('#btnAchievements', '#achievements')) {
    await shot('04-achievements');
    await page.evaluate(() => {
      const el = document.querySelector('#achievements .screen-content') || document.querySelector('#achievements');
      if (el) el.scrollTop = el.scrollHeight;
    });
    await shot('04-achievements-scrolled');
    await goBack();
  }

  // ─── 5) Store Screen ───
  if (await navTo('#btnStore', '#store')) {
    await shot('05-store');
    await page.evaluate(() => {
      const el = document.querySelector('#store .screen-content') || document.querySelector('#store');
      if (el) el.scrollTop = el.scrollHeight;
    });
    await shot('05-store-scrolled');
    await goBack();
  }

  // ─── 6) Settings Screen ───
  if (await navTo('#btnSettings', '#settings')) {
    await shot('06-settings-top');
    await page.evaluate(() => {
      const el = document.querySelector('#settings .screen-content') || document.querySelector('#settings');
      if (el) el.scrollTop = el.scrollHeight / 2;
    });
    await shot('06-settings-mid');
    await page.evaluate(() => {
      const el = document.querySelector('#settings .screen-content') || document.querySelector('#settings');
      if (el) el.scrollTop = el.scrollHeight;
    });
    await shot('06-settings-bottom');
    await goBack();
  }

  // ─── 7) Avatar Screen ───
  {
    const avatarEl = page.locator('#home img').first();
    if (await avatarEl.isVisible({ timeout: 1000 }).catch(() => false)) {
      await avatarEl.click();
      await page.waitForTimeout(800);
      const avatarActive = await page.evaluate(() =>
        document.querySelector('#avatar')?.classList.contains('active')
      );
      if (avatarActive) {
        await shot('07-avatar');
        await goBack();
      }
    }
  }

  // ─── 8) Start a game (Colors/Blitz) ───
  {
    // Ensure home is active first
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.querySelector('#home')?.classList.add('active');
    });
    await page.waitForTimeout(400);

    const played = await page.evaluate(() => {
      const btn = document.querySelector('#btnPlay');
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (played) {
      await page.waitForTimeout(1500);
      await shot('08-game-countdown');
      await page.waitForTimeout(4000);
      await shot('08-game-active');

      // ─── 9) Pause overlay ───
      const paused = await page.evaluate(() => {
        const btn = document.querySelector('#btnPause');
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (paused) {
        await page.waitForTimeout(500);
        await shot('09-pause-overlay');

        // ─── 10) Quit game → Results ───
        const quit = await page.evaluate(() => {
          const btn = document.querySelector('#btnPauseQuit');
          if (btn) { btn.click(); return true; }
          return false;
        });
        if (quit) {
          await page.waitForTimeout(1500);
          await shot('10-results');
        }
      }
    }
  }

  // ─── 11) Tutorial (if accessible) ───
  await goHome();
  const tutBtn = page.locator('#btnTutorial, [data-screen="tutorial"]');
  if (await tutBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await tutBtn.click();
    await page.waitForTimeout(800);
    await shot('11-tutorial');
  }

  await context.close();
  await browser.close();
}

async function main() {
  console.log('SCS Play Visual Review — Starting...\n');
  for (const [name, config] of Object.entries(DEVICES)) {
    console.log(`\nDevice: ${name} (${config.viewport.width}x${config.viewport.height})`);
    await screenshotAll(name, config);
  }
  console.log('\nDone! Screenshots saved to:', OUT);
}

main().catch(console.error);
