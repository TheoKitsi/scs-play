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
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.querySelector('#home')?.classList.add('active');
  });
  await page.waitForTimeout(300);
}

async function scan(page, label) {
  const failures = await page.evaluate((screenLabel) => {
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
  }, label);

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
  failures.push(...await scan(page, 'home'));

  for (const [button, label] of [['#btnLeaderboard', 'leaderboard'], ['#btnAchievements', 'achievements'], ['#btnSettings', 'settings'], ['#btnStore', 'store']]) {
    await forceHome(page);
    if (await clickIfPresent(page, button, 900)) failures.push(...await scan(page, label));
  }

  await forceHome(page);
  if (await clickIfPresent(page, '#btnPlay', 1200)) {
    if (await page.locator('#tutorial.active').isVisible({ timeout: 1000 }).catch(() => false)) await clickIfPresent(page, '#btnTutorialSkip', 1200);
    await page.waitForFunction(() => document.querySelector('#game')?.classList.contains('active'), null, { timeout: 5000 });
    await page.waitForTimeout(4200);
    failures.push(...await scan(page, 'game'));
    await page.evaluate(() => globalThis.__SCS_QA__?.forceGameOver());
    await page.waitForFunction(() => document.querySelector('#results')?.classList.contains('active'), null, { timeout: 5000 });
    await page.waitForTimeout(1200);
    failures.push(...await scan(page, 'results'));
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