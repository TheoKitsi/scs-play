import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const scope = 'https://example.test/scs-play/';
const musicUrl = new URL('audio/music/menu.mp3', scope).href;
const bytes = Uint8Array.from({ length: 10 }, (_, i) => i);

function worker({ entries = new Map(), network = async () => new Response('network'), failOpen = false, failPut = false } = {}) {
  const listeners = new Map();
  const stored = [];
  const deleted = [];
  const focused = [];
  const opened = [];
  const calls = [];
  const cacheNames = [];
  const precached = [];
  const key = request => request.url || String(request);
  const cache = {
    async match(request) { return entries.get(key(request))?.clone(); },
    async put(request, response) {
      if (failPut) throw new Error('Quota exceeded');
      stored.push({ url: key(request), status: response.status });
      entries.set(key(request), response.clone());
    },
    async addAll(requests) { precached.push(...requests); },
  };
  const clients = {
    async claim() { calls.push('claim'); },
    async matchAll() {
      return [
        { url: 'https://example.test/another-app/index.html', focus: () => focused.push('other') },
        { url: scope, focus: () => focused.push('game') },
      ];
    },
    async openWindow(url) { opened.push(url); },
  };
  runInNewContext(source, {
    URL, Headers, Request, Response,
    self: {
      location: { origin: new URL(scope).origin },
      registration: { scope },
      clients,
      skipWaiting: async () => calls.push('skipWaiting'),
      addEventListener: (type, callback) => listeners.set(type, callback),
    },
    clients,
    caches: {
      async open(name) {
        cacheNames.push(name);
        if (failOpen) throw new Error('Storage unavailable');
        return cache;
      },
      async keys() { return ['scs-v0', 'scs-v60', ...cacheNames, 'another-app-cache']; },
      async delete(name) { deleted.push(name); },
    },
    fetch: network,
  }, { filename: 'sw.js' });
  async function dispatch(type, properties = {}) {
    let response;
    const pending = [];
    listeners.get(type)({
      ...properties,
      respondWith: value => { response = value; },
      waitUntil: value => pending.push(value),
    });
    const result = await response;
    await Promise.all(pending);
    return result;
  }
  return { dispatch, stored, deleted, focused, opened, calls, cacheNames, precached };
}

function cachedMusic() {
  return new Map([[musicUrl, new Response(bytes, {
    headers: { 'content-type': 'audio/mpeg', 'content-length': '10', 'content-encoding': 'gzip' },
  })]]);
}

for (const [range, start, end] of [
  ['bytes=0-3', 0, 3], ['bytes=4-', 4, 9], ['bytes=-3', 7, 9],
  ['bytes=-20', 0, 9], ['bytes=7-99', 7, 9],
]) {
  const sw = worker({ entries: cachedMusic(), network: async () => { throw new Error('Offline'); } });
  const response = await sw.dispatch('fetch', { request: new Request(musicUrl, { headers: { range } }) });
  assert.equal(response.status, 206, `Cached ${range} must be playable partial content, including offline`);
  assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/10`);
  assert.equal(response.headers.get('content-length'), String(end - start + 1));
  assert.equal(response.headers.get('content-encoding'), null, 'Decoded cache bodies must not advertise compression');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes.slice(start, end + 1));
  assert.equal(sw.stored.length, 0, 'A partial response must not overwrite the complete track');
}

for (const range of ['bytes=10-', 'bytes=7-4', 'bytes=-0', 'bytes=-', 'bytes=99999999999999999999-', 'bytes=0-1,4-5']) {
  const sw = worker({ entries: cachedMusic() });
  const response = await sw.dispatch('fetch', { request: new Request(musicUrl, { headers: { range } }) });
  assert.equal(response.status, 416, `Invalid or unsatisfiable ${range} must not return corrupt audio`);
  assert.equal(response.headers.get('content-range'), 'bytes */10');
  assert.equal((await response.arrayBuffer()).byteLength, 0);
}

{
  const sw = worker({ entries: new Map([[musicUrl, new Response(new Uint8Array())]]) });
  const response = await sw.dispatch('fetch', { request: new Request(musicUrl, { headers: { range: 'bytes=0-' } }) });
  assert.equal(response.status, 416, 'An empty cached file has no valid byte range');
}

{
  const sw = worker({ network: async () => new Response(bytes.slice(0, 4), {
    status: 206, headers: { 'content-range': 'bytes 0-3/10' },
  }) });
  const response = await sw.dispatch('fetch', { request: new Request(musicUrl, { headers: { range: 'bytes=0-3' } }) });
  assert.equal(response.status, 206, 'An uncached server range must be passed through successfully');
  assert.equal(sw.stored.length, 0, 'Cache API cannot store partial network responses');
}

for (const storageFailure of [{ failPut: true }, { failOpen: true }]) {
  const sw = worker(storageFailure);
  const response = await sw.dispatch('fetch', { request: new Request(musicUrl) });
  assert.equal(response.status, 200, 'Unavailable storage must not break a successful network request');
  assert.equal(await response.text(), 'network');
}

{
  const sw = worker({ entries: cachedMusic(), network: async () => { throw new Error('Offline'); } });
  const response = await sw.dispatch('fetch', { request: new Request(musicUrl) });
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes, 'Cached non-range assets remain usable offline');
}

{
  const indexUrl = new URL('index.html', scope).href;
  const sw = worker({ entries: new Map([[indexUrl, new Response('<h1>SCS Play</h1>')]]), network: async () => { throw new Error('Offline'); } });
  const response = await sw.dispatch('fetch', { request: {
    url: new URL('missing-screen', scope).href, method: 'GET', headers: new Headers(), mode: 'navigate',
  } });
  assert.equal(await response.text(), '<h1>SCS Play</h1>', 'Offline navigation must use this game\'s cached app shell');
}

for (const request of [
  new Request('https://external.test/api'),
  new Request('https://example.test/another-app/index.html'),
  new Request(musicUrl, { method: 'POST' }),
]) {
  assert.equal(await worker().dispatch('fetch', { request }), undefined, 'Unrelated requests must bypass the game cache');
}

{
  const sw = worker();
  await sw.dispatch('install');
  assert.deepEqual(sw.calls, ['skipWaiting'], 'Installation must await precaching and activation handoff');
  assert.ok(sw.precached.length > 0 && sw.precached.every(request => request.cache === 'reload'), 'A new release must not precache stale entry files from the HTTP cache');
  await sw.dispatch('activate');
  assert.deepEqual(sw.deleted, ['scs-v0', 'scs-v60'], 'Cache cleanup must preserve the current cache and other apps');
  assert.ok(!sw.deleted.includes(sw.cacheNames[0]));
  assert.equal(sw.calls.at(-1), 'claim', 'Activation must await taking control of game clients');
}

{
  const sw = worker();
  await sw.dispatch('notificationclick', { notification: { close() {}, data: {} } });
  assert.deepEqual(sw.focused, ['game'], 'Notifications must focus the existing root game URL, not another app\'s index.html');
  assert.equal(sw.opened.length, 0, 'An already open game should not create another tab');
}

console.log('Service worker regression tests passed.');
