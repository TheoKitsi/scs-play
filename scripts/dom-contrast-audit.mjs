#!/usr/bin/env node
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

async function clickIfPresent(page, selector, wait = 700) {
  const clicked = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.click();
    return true;
  }, selector);
  if (clicked) await page.waitForTimeout(wait);
  return clicked;
}

async function forceHome(page) {
  await page.evaluate(() => {
    if (!document.querySelector('#home.active')) document.querySelector('.screen.active .btn-back-bottom')?.click();
  });
  await page.waitForSelector('#home.active');
  await page.waitForTimeout(400);
}

async function scan(page, label, endRound = false) {
  const failures = await page.evaluate(({ screenLabel, endRound }) => {
    // Take a real end-cue DOM snapshot in the same task that starts it, without
    // lengthening the production hold or racing CI/browser command latency.
    if (endRound) globalThis.__SCS_QA__.forceGameOver();
    function parseRgb(value) {
      const match = String(value).match(/rgba?\(([^)]+)\)/i);
      if (!match) return null;
      const parts = match[1].split(',').map(part => Number(part.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
    }
    function blend(fg, bg) {
      const a = fg.a + bg.a * (1 - fg.a);
      if (!a) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a),
        g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a),
        b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a),
        a,
      };
    }
    function linear(channel) {
      const s = channel / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    function luminance(color) {
      return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
    }
    function contrast(fg, bg) {
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }
    function hasDirectText(el) {
      return [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0);
    }
    function selectorFor(el) {
      if (el.id) return `#${el.id}`;
      const classes = [...el.classList].slice(0, 3).join('.');
      return `${el.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`;
    }
    function effectiveBackground(el) {
      let color = { r: 3, g: 0, b: 20, a: 1 };
      const chain = [];
      for (let node = el; node && node.nodeType === Node.ELEMENT_NODE; node = node.parentElement) chain.push(node);
      chain.reverse().forEach(node => {
        const bg = parseRgb(getComputedStyle(node).backgroundColor);
        if (bg && bg.a > 0) color = blend(bg, color);
      });
      return color;
    }

    const failures = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!hasDirectText(el)) continue;
      if (el.closest('.sr-only,[aria-hidden="true"],[hidden],template,script,style')) continue;
      if (el.matches(':disabled,.disabled') || el.closest(':disabled,.disabled')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const opacity = Number(style.opacity || 1);
      if (opacity <= 0.05) continue;
      const color = parseRgb(style.color);
      if (!color) continue;
      const fontSize = parseFloat(style.fontSize || '16');
      if (fontSize < 10) continue;
      const fontWeight = Number(style.fontWeight) || (style.fontWeight === 'bold' ? 700 : 400);
      const min = fontSize >= 24 || (fontSize >= 18.5 && fontWeight >= 700) ? 3 : 4.5;
      const bg = effectiveBackground(el);
      const fg = opacity < 1 ? blend({ ...color, a: color.a * opacity }, bg) : color;
      const ratio = contrast(fg, bg);
      if (ratio + Number.EPSILON < min) {
        failures.push({
          screen: screenLabel,
          selector: selectorFor(el),
          text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 80),
          ratio: Number(ratio.toFixed(2)),
          required: min,
        });
      }
    }
    return failures.slice(0, 40);
  }, { screenLabel: label, endRound });

  if (failures.length) {
    console.error(`\n${label}: ${failures.length} contrast failures`);
    failures.forEach(failure => {
      console.error(`  ${failure.ratio}:1 < ${failure.required}:1 ${failure.selector} "${failure.text}"`);
    });
  } else {
    console.log(`PASS ${label}`);
  }
  return failures;
}

async function run() {
  const staticServer = EXTERNAL_BASE ? null : await startStaticServer({ root: 'docs' });
  const baseUrl = EXTERNAL_BASE || staticServer.baseUrl;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(DEVICE);
  await context.addInitScript(() => localStorage.setItem('scsQa', '1'));
  const page = await context.newPage();
  const failures = [];

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  failures.push(...await scan(page, 'auth'));

  await clickIfPresent(page, '#btnGuest', 1200);
  for (let i = 0; i < 3; i++) {
    if (!await page.locator('.onboarding-overlay.active .onboarding-btn-ok').isVisible()) break;
    await page.locator('.onboarding-overlay.active .onboarding-btn-ok').click();
    await page.waitForTimeout(500);
  }
  await clickIfPresent(page, '#btnAllModes', 500);
  failures.push(...await scan(page, 'mode catalog'));
  await clickIfPresent(page, '#btnCloseModes', 400);
  failures.push(...await scan(page, 'home'));
  await page.locator('#btnPrism').click();
  await page.waitForSelector('.pw-map-view');
  failures.push(...await scan(page, 'Prism world map'));
  await page.locator('#pwContinue').click();
  await page.waitForSelector('#pwArena canvas');
  await page.waitForFunction(() => !document.querySelector('#pwArena .pw-loading'));
  failures.push(...await scan(page, 'Prism arena and controls'));
  await page.locator('#pwFire').click();
  await page.waitForSelector('#pwNext:not(:disabled)');
  failures.push(...await scan(page, 'Prism earned result'));
  await page.locator('#pwNext').click();
  await page.waitForSelector('#pwArena canvas');
  await page.locator('#pwPause').click();
  failures.push(...await scan(page, 'Prism pause'));
  await page.keyboard.press('Escape');
  await page.locator('#pwBack').click();
  await page.locator('#pwBack').click();
  await page.waitForSelector('#home.active');
  await clickIfPresent(page, '#homeLivesBadge', 300);
  failures.push(...await scan(page, 'application dialog'));
  await page.keyboard.press('Escape');
  await clickIfPresent(page, '#btnWheel', 400);
  failures.push(...await scan(page, 'wheel'));
  await clickIfPresent(page, '#btnWheelClose', 300);
  await clickIfPresent(page, '#homeAvatar', 500);
  failures.push(...await scan(page, 'avatar'));
  await forceHome(page);

  for (const theme of ['neon', 'ocean', 'sunset', 'forest', 'cosmic', 'retro', 'crystal']) {
    await page.evaluate(theme => {
      document.body.className = document.body.className.replace(/\btheme-\w+/g, '').trim();
      document.body.classList.add(`theme-${theme}`);
    }, theme);
    failures.push(...await scan(page, `home / ${theme}`));
    await clickIfPresent(page, '#btnWheel', 200);
    failures.push(...await scan(page, `wheel / ${theme}`));
    await clickIfPresent(page, '#btnWheelClose', 200);
  }
  await page.evaluate(() => { document.body.className = document.body.className.replace(/\btheme-\w+/g, '').trim(); });

  for (const [button, label] of [['#btnLeaderboard', 'leaderboard'], ['#btnAchievements', 'achievements'], ['#btnSettings', 'settings'], ['#btnStore', 'store']]) {
    await forceHome(page);
    if (await clickIfPresent(page, button, 900)) failures.push(...await scan(page, label));
    if (label === 'settings') {
      await page.evaluate(() => {
        window.auditStorageWrite = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (key === 'scs_save:guest') throw new DOMException('Contrast fixture', 'QuotaExceededError');
          return window.auditStorageWrite.call(this, key, value);
        };
      });
      try {
        await page.locator('#toggleMotion').check();
        await page.locator('#settingsSaveNotice:not([hidden])').waitFor();
        failures.push(...await scan(page, 'settings save failure and retry'));
      } finally {
        await page.evaluate(() => { Storage.prototype.setItem = window.auditStorageWrite; delete window.auditStorageWrite; });
      }
      await page.locator('#btnSettingsRetrySave').click();
      await page.locator('#toggleMotion').uncheck();
    }
    if (label === 'store') {
      await page.locator('[data-preview-id="ocean"]').click();
      await page.locator('#designPreviewOverlay.active').waitFor();
      failures.push(...await scan(page, 'static design preview'));
      await page.keyboard.press('Escape');
    }
  }

  await forceHome(page);
  if (await clickIfPresent(page, '#btnPlay', 1200)) {
    if (await page.locator('#tutorial.active').isVisible({ timeout: 1000 }).catch(() => false)) await clickIfPresent(page, '#btnTutorialSkip', 1200);
    await page.waitForFunction(() => document.querySelector('#game')?.classList.contains('active'), null, { timeout: 5000 });
    await page.waitForTimeout(4200);
    failures.push(...await scan(page, 'game'));
    await clickIfPresent(page, '#btnPause', 300);
    failures.push(...await scan(page, 'pause'));
    await clickIfPresent(page, '#btnResume', 200);
    failures.push(...await scan(page, 'round completion cue', true));
    await page.waitForFunction(() => document.querySelector('#results')?.classList.contains('active'), null, { timeout: 5000 });
    await page.waitForTimeout(1200);
    failures.push(...await scan(page, 'results'));
    if (await page.locator('#btnResContinueNo').isVisible()) {
      await page.locator('#btnResContinueNo').click();
      await page.locator('#resNormalBtns').waitFor({ state: 'visible' });
      failures.push(...await scan(page, 'settled results'));
    }
  }

  for (const file of ['privacy-policy.html', 'terms-of-service.html']) {
    for (const lang of ['de', 'en']) {
      await page.goto(new URL(`${file}?lang=${lang}`, baseUrl).href, { waitUntil: 'networkidle' });
      failures.push(...await scan(page, `${file}/${lang}`));
    }
  }
  await context.close();
  await browser.close();
  if (staticServer) await staticServer.close();

  if (failures.length) {
    console.error(`\nDOM contrast audit failed: ${failures.length} failures.`);
    process.exit(1);
  }
  console.log('\nDOM contrast audit passed.');
}

run().catch(err => {
  console.error('DOM contrast audit crashed:', err);
  process.exit(1);
});
