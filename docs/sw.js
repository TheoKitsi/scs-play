/* ═══════════════════════════════════════
   SCS Play — Service Worker
   ═══════════════════════════════════════ */
const CACHE = 'scs-v53';
const ASSETS = [
  './',
  './index.html',
  './privacy-policy.html',
  './terms-of-service.html',
  './css/style.bundle.css',
  './js/app.bundle.js',
  './manifest.json',
  './img/icon-192.svg',
  './img/icon-512.svg',
  './audio/music/tracks.json',
  './audio/music/menu.mp3',
  './audio/music/classic.mp3',
  './audio/music/endless.mp3',
  './audio/music/blitz.mp3',
  './audio/music/competition.mp3'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  /* Skip caching for Firebase, external APIs, and non-GET requests */
  if (e.request.method !== 'GET' ||
      url.includes('firebaseio.com') ||
      url.includes('googleapis.com/identitytoolkit') ||
      url.includes('firestore.googleapis.com') ||
      url.includes('cloudfunctions.net') ||
      url.includes('firebase.googleapis.com')) {
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request);
    if (cached) {
      e.waitUntil(fetch(e.request).then(response => {
        if (response?.ok) return cache.put(e.request, response.clone());
      }).catch(() => {}));
      return cached;
    }
    try {
      const response = await fetch(e.request);
      if (response?.ok) await cache.put(e.request, response.clone());
      return response;
    } catch {
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }
  })());
});

/* ═══════ Push Notification Handlers ═══════ */
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
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url.includes('index.html') && 'focus' in client) return client.focus();
      }
      return clients.openWindow(e.notification.data?.url || './');
    })
  );
});
