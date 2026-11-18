const CACHE = 'moneta-shell-v2';
const ICON_PREFIX = '/icons/';
const APP_SHELL = ['/icons/moneta-192.png', '/icons/moneta-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('moneta-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.hostname.endsWith('.supabase.co') || /\/(rest|auth|functions)\/v1\//.test(url.pathname)) return;
  // Navigations, finance pages, and API calls stay network-only.
  if (
    request.mode === 'navigate' ||
    (!url.pathname.startsWith(ICON_PREFIX) && url.pathname !== '/manifest.webmanifest')
  ) return;

  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  }));
});
