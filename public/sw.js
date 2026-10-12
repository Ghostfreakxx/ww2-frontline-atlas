// Frontline Atlas service worker.
// - Map geography, fonts and icons: cached on install, then stale-while-revalidate (fast cold starts).
// - Next.js build assets (content-hashed): cache-first.
// - Pages: network-first, falling back to the cached copy when the network is down.
// - /api (session sync, live stream): never touched by the service worker.
const VERSION = 'atlas-v2';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const PRECACHE = [
  '/presenter',
  '/display',
  '/editor',
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/geo/land.json',
  '/geo/lakes.json',
  '/geo/rivers.json',
  '/geo/relief.json',
  '/geo/relief.png',
  '/geo/relief-small.png',
  '/geo/fronts.json',
  '/geo/territory-1939-09-01.json',
  '/geo/territory-1939-10-06.json',
  '/geo/territory-1940-07-01.json',
  '/geo/territory-1941-06-22.json',
  '/geo/territory-1942-11-11.json',
  '/geo/territory-1943-09-09.json',
  '/geo/territory-1944-09-15.json',
];
const MAX_ASSETS = 300;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) =>
      // One missing file must not block installation.
      Promise.all(PRECACHE.map((url) => c.add(new Request(url, { cache: 'reload' })).catch(() => {}))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function staleWhileRevalidate(request, event) {
  const c = await caches.open(SHELL);
  const cached = await c.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok) c.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(fresh);
    return cached;
  }
  return fresh;
}

async function cacheFirst(request) {
  const c = await caches.open(ASSETS);
  const cached = await c.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    await c.put(request, res.clone());
    trim(ASSETS, MAX_ASSETS);
  }
  return res;
}

async function networkFirstPage(request) {
  const c = await caches.open(SHELL);
  // Pages are cached by path only: query strings carry session codes, the hash carries the key.
  const key = new URL(request.url).pathname;
  try {
    const res = await fetch(request);
    if (res.ok) c.put(key, res.clone());
    return res;
  } catch {
    return (await c.match(key)) || (await c.match('/presenter')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') return event.respondWith(networkFirstPage(request));
  if (url.pathname.startsWith('/_next/static/')) return event.respondWith(cacheFirst(request));
  if (/^\/(geo|fonts|icons)\//.test(url.pathname) || url.pathname === '/manifest.webmanifest') return event.respondWith(staleWhileRevalidate(request, event));
});
