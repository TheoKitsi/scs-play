/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SCS Play â€” Service Worker
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const CACHE = 'scs-v60';
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

/* â•â•â•â•â•â•â• Push Notification Handlers â•â•â•â•â•â•â• */
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'SCS Play';
  const options = {
    body: data.body || 'Komm zurÃ¼ck und schlage deinen Rekord!',
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
