/* ═══════════════════════════════════════
   SCS Play — Service Worker
   ═══════════════════════════════════════ */
const CACHE = 'scs-v38';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
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
  './css/partials/11-light-theme.css',
  './css/partials/12-polish-v18-v19.css',
  './manifest.json',
  './img/icon-192.svg',
  './img/icon-512.svg',
  /* ─── Core JS ─── */
  './js/app.js',
  './js/appState.js',
  './js/config.js',
  './js/i18n.js',
  './js/input.js',
  './js/audio.js',
  './js/effects.js',
  './js/auth.js',
  './js/save.js',
  /* ─── Helpers ─── */
  './js/helpers/dom.js',
  './js/helpers/haptics.js',
  './js/helpers/microFeedback.js',
  './js/helpers/engagementTracker.js',
  /* ─── Renderers ─── */
  './js/renderers/shapes.js',
  './js/renderers/avatars.js',
  /* ─── Game ─── */
  './js/game/GameEngine.js',
  /* ─── Services ─── */
  './js/services/AdService.js',
  './js/services/ThemeService.js',
  './js/services/ShareService.js',
  /* ─── Screens ─── */
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
  /* ─── Achievements ─── */
  './js/achievements/AchievementSystem.js'
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
  /* Stale-while-revalidate: serve cache immediately, update in background */
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(response => {
          if (response && response.status === 200) {
            cache.put(e.request, response.clone());
          }
          return response;
        }).catch(() => null);
        return cached || fetchPromise || caches.match('./index.html');
      })
    )
  );
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