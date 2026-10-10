/** Real-browser coverage for cached music, HTTP ranges, and offline app loading.
 * Run after build:prod; set SCS_BASE to test the published game instead. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startStaticServer } from './lib/static-server.mjs';

const EXTERNAL_BASE = process.env.SCS_BASE || '';

async function loadTrack(page, track) {
  const result = await page.evaluate(async name => {
    const audio = new Audio(`audio/music/${name}.mp3`);
    (globalThis.__pwaTestAudio ||= []).push(audio);
    audio.preload = 'metadata';
    const outcome = await new Promise(resolve => {
      const timer = setTimeout(() => resolve('timeout'), 15000);
      const finish = value => { clearTimeout(timer); resolve(value); };
      audio.addEventListener('loadedmetadata', () => finish('loaded'), { once: true });
      audio.addEventListener('error', () => finish('error'), { once: true });
      audio.load();
    });
    let playing = false;
    if (outcome === 'loaded') {
      await audio.play();
      await new Promise(resolve => setTimeout(resolve, 350));
      playing = !audio.paused && audio.currentTime > 0 && !audio.error;
      audio.pause();
    }
    return { outcome, playing, duration: Number.isFinite(audio.duration) ? audio.duration : 0, error: audio.error?.message };
  }, track);
  assert.equal(result.outcome, 'loaded', `${track} must decode through the service worker: ${result.error || result.outcome}`);
  assert.ok(result.duration > 0, `${track} must have usable audio metadata`);
  assert.ok(result.playing, `${track} must actually play, not fall back to a silent/failed media element`);
}

async function run() {
  const server = EXTERNAL_BASE ? null : await startStaticServer({ root: 'docs', port: 0 });
  let browser;
  try {
    const base = EXTERNAL_BASE || server.baseUrl + '/';
    browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    await context.addInitScript(() => localStorage.setItem('scsQa', '1'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`${message.text()} (${message.location().url})`);
    });

    await page.goto(new URL('privacy-policy.html', base).href, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await caches.open('qa-neighbor-app');
      await caches.open('scs-v0');
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30000 });
    const state = await page.evaluate(async () => ({
      cacheNames: await caches.keys(),
      tracks: (await (await fetch('audio/music/tracks.json')).json()).tracks,
    }));
    assert.ok(state.cacheNames.includes('qa-neighbor-app'), 'Updating the game must preserve neighboring app caches');
    assert.ok(!state.cacheNames.includes('scs-v0'), 'The new worker must retire old game caches');
    assert.ok(state.tracks.length > 0, 'The release must ship its music catalog');
    console.log('PASS scoped cache activation');

    const networkRange = await context.request.get(new URL('audio/music/menu.mp3', base).href, { headers: { Range: 'bytes=10-31' } });
    assert.equal(networkRange.status(), 206, 'The test server must reproduce GitHub Pages byte-range responses');
    assert.equal((await networkRange.body()).byteLength, 22);
    if (!EXTERNAL_BASE) {
      assert.equal((await context.request.get(new URL('%invalid', base).href)).status(), 400, 'Malformed URLs must not crash the QA server');
      assert.equal((await context.request.head(base)).status(), 200);
    }
    console.log('PASS real HTTP range responses');

    for (const track of state.tracks) {
      await loadTrack(page, track);
      console.log(`PASS cached music: ${track}`);
    }

    const ranges = await page.evaluate(async () => {
      const cacheName = (await caches.keys()).find(name => /^scs-v\d+$/.test(name));
      const cache = await caches.open(cacheName);
      const url = new URL('audio/music/menu.mp3', location.href).href;
      const original = new Uint8Array(await (await cache.match(url)).arrayBuffer());
      const partial = await fetch(url, { headers: { Range: 'bytes=10-31' } });
      const data = new Uint8Array(await partial.arrayBuffer());
      return {
        status: partial.status, header: partial.headers.get('content-range'),
        matches: data.length === 22 && data.every((byte, i) => byte === original[i + 10]),
      };
    });
    assert.equal(ranges.status, 206);
    assert.ok(ranges.header.startsWith('bytes 10-31/'));
    assert.ok(ranges.matches, 'Cached range bytes must match the original track exactly');
    console.log('PASS cached range content');

    const uncached = await page.evaluate(async () => {
      const cacheName = (await caches.keys()).find(name => /^scs-v\d+$/.test(name));
      const cache = await caches.open(cacheName);
      const url = new URL('audio/music/menu.mp3', location.href).href;
      await cache.delete(url);
      const partial = await fetch(url, { headers: { Range: 'bytes=10-31' } });
      await partial.arrayBuffer();
      const storedPartial = Boolean(await cache.match(url));
      const complete = await fetch(url);
      await complete.arrayBuffer();
      return { status: partial.status, storedPartial, restored: (await cache.match(url))?.status };
    });
    assert.equal(uncached.status, 206, 'Uncached partial responses must reach the browser');
    assert.equal(uncached.storedPartial, false, 'Partial network content must not poison the complete-file cache');
    assert.equal(uncached.restored, 200);
    console.log('PASS uncached range and full-file recovery');

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#btnGuest', { state: 'visible', timeout: 10000 });
    assert.ok(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'Offline reload must remain controlled by the worker');
    console.log('PASS offline app reload');
    for (const track of state.tracks) {
      await loadTrack(page, track);
      console.log(`PASS offline music: ${track}`);
    }
    assert.deepEqual(errors, [], `PWA release must not emit browser errors: ${errors.join('; ')}`);
    console.log('PWA release tests passed without browser errors.');
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
