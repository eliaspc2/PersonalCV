const BASE_CACHE = 'personalcv-static';
let cachedCacheName = null;
const PRECACHE_URLS = [
  '.',
  'index.html',
  'index2.html',
  'config.html',
  'css/styles.css',
  'js/cv-render.js',
  'js/config-ui.js',
  'js/auth-gate.js',
  'js/crypto-utils.js',
  'js/constants.js',
  'js/icon-set.js',
  'core/page-orchestrator.js',
  'core/page-context.js',
  'core/shadow-render.js',
  'core/preview-gesture.js',
  'pages/pages-registry.js',
  'pages/example.page.js',
  'pages/highlights.page.js',
  'pages/overview.page.js',
  'pages/foundation.page.js',
  'pages/development.page.js',
  'pages/mindset.page.js',
  'pages/now.page.js',
  'pages/contact.page.js',
  'validators/schema-validate.js',
  'validators/cv-consistency.js',
  'validators/error-messages.js',
  'schema/cv.schema.json',
  'data/cv.json',
  'data/site-config.json',
  'data/config.json',
  'assets/icons/favicon.ico',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/android-chrome-192x192.png',
  'assets/icons/android-chrome-512x512.png'
];

async function getVersion() {
  try {
    const configResp = await fetch('data/config.json', { cache: 'no-store' });
    if (configResp.ok) {
      const config = await configResp.json();
      if (config?.version) return config.version;
    }
  } catch (e) {
    // ignore
  }
  try {
    const cvResp = await fetch('data/cv.json', { cache: 'no-store' });
    if (cvResp.ok) {
      const cv = await cvResp.json();
      if (cv?.meta?.version) return cv.meta.version;
    }
  } catch (e) {
    // ignore
  }
  return '0';
}

async function getCacheName() {
  if (cachedCacheName) return cachedCacheName;
  const version = await getVersion();
  cachedCacheName = `${BASE_CACHE}-v${version}`;
  return cachedCacheName;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cacheName = await getCacheName();
      const cache = await caches.open(cacheName);
      await cache.addAll(PRECACHE_URLS);
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheName = await getCacheName();
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== cacheName && key.startsWith(BASE_CACHE)).map((key) => caches.delete(key)));
    })()
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isJson = url.pathname.endsWith('.json');
  const isDataJson = url.pathname.includes('/data/') || url.pathname.includes('/schema/');

  if (event.request.mode === 'navigate') {
    if (url.pathname.endsWith('/config.html') || url.pathname.endsWith('config.html')) {
      event.respondWith(
        fetch(event.request).then((response) => {
          const responseClone = response.clone();
          getCacheName().then((cacheName) => caches.open(cacheName).then((cache) => cache.put(event.request, responseClone)));
          return response;
        }).catch(() => caches.match(event.request))
      );
      return;
    }
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  if (isJson && isDataJson) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const responseClone = response.clone();
        getCacheName().then((cacheName) => caches.open(cacheName).then((cache) => cache.put(event.request, responseClone)));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  if (url.pathname.includes('/pages/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
    );
    return;
  }
  if (url.pathname.includes('/core/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }
  if (url.pathname.includes('/js/')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const responseClone = response.clone();
        getCacheName().then((cacheName) => caches.open(cacheName).then((cache) => cache.put(event.request, responseClone)));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  if (url.pathname.includes('/assets/photos/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const responseClone = response.clone();
          getCacheName().then((cacheName) => caches.open(cacheName).then((cache) => cache.put(event.request, responseClone)));
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const responseClone = response.clone();
        getCacheName().then((cacheName) => caches.open(cacheName).then((cache) => cache.put(event.request, responseClone)));
        return response;
      });
    })
  );
});
