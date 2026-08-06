// Runtime cache for RAÍZ's static build output.
//
// The game is fully procedural (no texture/model assets to precache), so
// this caches whatever the browser actually requests instead of a
// hand-maintained precache manifest. New installs park in "waiting" until
// the page opts in via SKIP_WAITING (see src/core/pwa.js) — a deploy should
// never swap the running app out from under a player mid-session.

const CACHE = 'raiz-runtime-v1';

self.addEventListener('install', () => {
  // Stay in "waiting"; the page decides when to activate.
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(req.mode === 'navigate' ? networkFirst(req) : staleWhileRevalidate(req));
});

async function networkFirst(req){
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(req))
      || (await cache.match(self.registration.scope, { ignoreSearch: true }))
      || Response.error();
  }
}

async function staleWhileRevalidate(req){
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => cached);
  return cached || network;
}
