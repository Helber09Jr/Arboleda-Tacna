const CACHE_NAME = 'arboleda-v3';
const STATIC_CACHE = 'arboleda-static-v3';
const RUNTIME_CACHE = 'arboleda-runtime-v3';

// Archivos estáticos que queremos cachear agresivamente
const urlsToCache = [
  '/',
  '/index.html',
  '/carta.html',
  '/reservas.html',
  '/admin.html',
  '/imagenes/logo-arboleda.png',
  '/imagenes/hero-fondo.jpg'
];

// Archivos dinámicos que NO deben cachearse (intentar siempre red)
const networkFirstPatterns = [
  '/js/',
  '/css/',
  'googleapis.com',
  'firebasestorage.googleapis.com',
  'firestore.googleapis.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE)
        .then(cache => cache.addAll(urlsToCache)),
      // Pre-cache CSS y JS con versión
      caches.open('arboleda-v3')
    ])
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Para archivos JS y CSS: network-first (intenta red primero)
  if (networkFirstPatterns.some(pattern => url.pathname.includes(pattern) || url.origin.includes(pattern))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return caches.match(request);
          }
          // Cachear la respuesta nueva si es exitosa
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE)
            .then(cache => cache.put(request, responseToCache));
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // Para imágenes y otros archivos: cache-first
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) return response;
          return fetch(request)
            .then(response => {
              if (!response || response.status !== 200) return response;
              const responseToCache = response.clone();
              caches.open(STATIC_CACHE)
                .then(cache => cache.put(request, responseToCache));
              return response;
            });
        })
        .catch(() => {
          // Fallback si no hay conexión
          return new Response('Sin conexión', { status: 503 });
        })
    );
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => {
            // Eliminar caches viejos
            return !['arboleda-v3', 'arboleda-static-v3', 'arboleda-runtime-v3'].includes(cacheName);
          })
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});
