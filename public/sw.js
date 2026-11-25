/* Super Smash Island PWA Service Worker */
const CACHE_VERSION = 'ssi-pwa-v2';
const APP_CACHE = `${CACHE_VERSION}-app`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
const CDN_HOSTS = new Set([
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
]);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(CORE_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('ssi-pwa-') && ![APP_CACHE, RUNTIME_CACHE].includes(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (error) {
    const cached = await cache.match(request) || await caches.match(fallbackUrl || request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html').catch(() => caches.match('./index.html')));
    return;
  }

  if (url.origin === self.location.origin) {
    // Only cache real static files. API, login, account, ranking and live-match
    // requests are left untouched so offline data can never replace fresh server data.
    if (/\.(?:html|js|mjs|css|json|png|jpe?g|webp|svg|ico|woff2?|ttf|otf|mp3|ogg|wav)$/i.test(url.pathname)) {
      event.respondWith(cacheFirst(request));
    }
    return;
  }

  // Cache only the game's known public CDN dependencies. WebSocket traffic is not intercepted.
  if (CDN_HOSTS.has(url.hostname)) event.respondWith(networkFirst(request));
});
