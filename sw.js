/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SCS Play â€” Service Worker
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const CACHE = 'scs-v61';
const ASSETS = [
  './',
  './index.html',
  './privacy-policy.html',
  './terms-of-service.html',
  './css/style.css',
  './css/partials/00-perf-tokens.css',
  './css/partials/01-tokens.css',
  './css/partials/02-base.css',
  './css/partials/03-boot-auth.css',
  './css/partials/04-home.css',
  './css/partials/05-game.css',
  './css/partials/06-overlays.css',
  './css/partials/07-effects.css',
  './css/partials/08-patches-v7-v9.css',
  './css/partials/09-extensions.css',
  './css/partials/10-micro-modes.css',
  './css/partials/11-mode-mastery.css',
  './css/partials/12-polish-v18-v19.css',
  './css/partials/13-mobile-2026.css',
  './manifest.json',
  './img/icon-192.svg',
  './img/icon-512.svg',
  './audio/music/tracks.json',
  './audio/music/menu.mp3',
  './audio/music/classic.mp3',
  './audio/music/endless.mp3',
  './audio/music/blitz.mp3',
  './audio/music/competition.mp3',
  /* â”€â”€â”€ Core JS â”€â”€â”€ */
  './js/app.js',
  './js/appState.js',
  './js/config.js',
  './js/i18n.js',
  './js/input.js',
  './js/audio.js',
  './js/effects.js',
  './js/auth.js',
  './js/save.js',
  /* â”€â”€â”€ Helpers â”€â”€â”€ */
  './js/helpers/dom.js',
  './js/helpers/haptics.js',
  './js/helpers/microFeedback.js',
  './js/helpers/engagementTracker.js',
  './js/helpers/onboardingHints.js',
  /* â”€â”€â”€ Renderers â”€â”€â”€ */
  './js/renderers/shapes.js',
  './js/renderers/avatars.js',
  /* â”€â”€â”€ Game â”€â”€â”€ */
  './js/game/GameEngine.js',
  './js/game/ModeMastery.js',
  /* â”€â”€â”€ Services â”€â”€â”€ */
  './js/services/ThemeService.js',
  './js/services/ShareService.js',
  /* â”€â”€â”€ Screens â”€â”€â”€ */
  './js/screens/BootScreen.js',
  './js/screens/AuthScreen.js',
  './js/screens/HomeScreen.js',
  './js/screens/TutorialScreen.js',
  './js/screens/GameScreen.js',
  './js/screens/ResultsScreen.js',
  './js/screens/LeaderboardScreen.js',
  './js/screens/AchievementsScreen.js',
  './js/screens/SettingsScreen.js',
  './js/screens/StoreScreen.js',
  './js/screens/AvatarScreen.js',
  './js/screens/EngagementReportScreen.js',
  './js/screens/WheelScreen.js',
  /* â”€â”€â”€ Achievements â”€â”€â”€ */
  './js/achievements/AchievementSystem.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => /^scs-v\d+$/.test(k) && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Media elements request byte ranges, including when the file is cached.
   Return actual partial content so Chromium/Safari can load and seek MP3s offline. */
async function rangeResponse(request, cached) {
  const body = await cached.arrayBuffer();
  const size = body.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(request.headers.get('range').trim());
  let start = match?.[1] ? Number(match[1]) : 0;
  let end = match?.[2] ? Number(match[2]) : size - 1;
  if (match && !match[1] && match[2]) {
    const suffix = Number(match[2]);
    start = Number.isSafeInteger(suffix) && suffix > 0 ? Math.max(0, size - suffix) : size;
    end = size - 1;
  }
  const headers = new Headers(cached.headers);
  headers.delete('content-encoding');
  headers.delete('transfer-encoding');
  headers.set('accept-ranges', 'bytes');
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) || start >= size || end < start) {
    headers.set('content-range', `bytes */${size}`);
    headers.set('content-length', '0');
    return new Response(null, { status: 416, statusText: 'Range Not Satisfiable', headers });
  }
  end = Math.min(end, size - 1);
  headers.set('content-range', `bytes ${start}-${end}/${size}`);
  headers.set('content-length', String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers });
}

async function storeResponse(cache, request, response) {
  /* Cache.put rejects 206 responses. Storage failure must not turn a successful
     network response into a failed asset request. */
  if (!cache || !response.ok || response.status === 206) return;
  try { await cache.put(request, response.clone()); } catch {}
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  /* This worker owns only this game's GET requests, not other sites/apps. */
  if (e.request.method !== 'GET' ||
      url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) {
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE).catch(() => null);
    const cached = cache ? await cache.match(e.request).catch(() => null) : null;
    if (cached) {
      if (e.request.headers.has('range') && cached.status === 200) {
        return rangeResponse(e.request, cached);
      }
      e.waitUntil(fetch(e.request).then(response => {
        return storeResponse(cache, e.request, response);
      }).catch(() => {}));
      return cached;
    }
    try {
      const response = await fetch(e.request);
      await storeResponse(cache, e.request, response);
      return response;
    } catch {
      if (e.request.mode === 'navigate' && cache) {
        const fallback = await cache.match(new URL('index.html', self.registration.scope)).catch(() => null);
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});

/* â•â•â•â•â•â•â• Push Notification Handlers â•â•â•â•â•â•â• */
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'SCS Play';
  const options = {
    body: data.body || 'Komm zurück und schlage deinen Rekord!',
    icon: './img/icon-192.svg',
    badge: './img/icon-192.svg',
    vibrate: [100, 50, 100],
    data: { url: data.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(new URL(e.notification.data?.url || './', self.registration.scope).href);
    })
  );
});
