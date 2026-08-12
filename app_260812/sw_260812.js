const CACHE_NAME = 'bookscan-260812-v1';
const ASSETS = [
  './',
  './index_260812.html',
  './style_260812.css',
  './app_260812.js',
  './manifest_260812.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('openbd.jp') || e.request.url.includes('script.google.com') || e.request.url.includes('cdn.jsdelivr.net')) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
