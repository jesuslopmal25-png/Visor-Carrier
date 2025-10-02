const VERSION = 'v1.0.0';

// Archivos “core” que queremos offline desde el principio
const CORE = [
  './Visor%20Carrier.html',
  './config.js',
  './data.js',
  './components_index.js',
  './matrix_totals.js',
  './Imagenes/logo.png',
  './manifest.webmanifest'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open('core-' + VERSION)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => !k.endsWith(VERSION))
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Estrategias:
// - Core: cache-first
// - Imágenes/PDF: stale-while-revalidate (cachea lo que se vaya abriendo)
// - Resto: network-first con fallback a caché
self.addEventListener('fetch', evt => {
  const req = evt.request;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;

  // Core
  if (sameOrigin && CORE.some(p => url.pathname.endsWith(p.replace('./','/')))) {
    evt.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }

  // Imágenes y PDFs del mismo origen (incluye /Imagenes y /Carrier Planos 2021/)
  const isImage = req.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname);
  const isPDF   = /\.pdf$/i.test(url.pathname);

  if (sameOrigin && (isImage || isPDF)) {
    evt.respondWith(
      caches.open('assets-' + VERSION).then(async cache => {
        const cached = await cache.match(req);
        const fetcher = fetch(req).then(r => {
          if (r && r.ok) cache.put(req, r.clone());
          return r;
        });
        return cached || fetcher;
      })
    );
    return;
  }

  // Resto
  evt.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});