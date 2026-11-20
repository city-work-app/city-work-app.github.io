const CACHE_NAME = 'kineplus-v83';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles7.css',
  '/premium.css',
  '/js/kstore.js',
  '/js/data.js',
  '/js/content.js',
  '/js/quiz.js',
  '/js/ui.js',
  '/js/premium.js',
  '/site.webmanifest',
  '/apple-touch-icon.png',
  '/favicon-96x96.png',
  '/favicon.svg',
  '/favicon.ico'
];

// Install : mise en cache des assets statiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate : suppression des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : cache-first pour assets statiques, réseau pour Supabase
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne jamais intercepter les requêtes Supabase (sync en temps réel)
  if (url.hostname.includes('supabase.co')) return;
  // Ne pas intercepter les CDN externes (fonts, supabase-js…)
  if (url.hostname !== self.location.hostname) return;

  // 14 nov. 2026 : la page elle-même (index.html) vient d'abord du réseau, le cache ne sert que hors connexion.
  // Ainsi un seul rechargement suffit après une mise en ligne (les fichiers modifiés ont un nouveau ?v=).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', clone));
        }
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Mettre en cache les nouvelles ressources valides
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
