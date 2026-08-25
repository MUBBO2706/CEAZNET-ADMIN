self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Let the browser handle everything natively
  return;
});
