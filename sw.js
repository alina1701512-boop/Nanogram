// Service worker игры. Стратегия разная для разных файлов:
// - index.html (сама игра) — «сеть, а если не вышло — кэш»: если человек
//   онлайн, он всегда получает свежую версию; офлайн — то, что успело
//   закэшироваться в прошлый раз. Кэшировать игру «навсегда» вслепую было бы
//   удобно для офлайна, но подловило бы человека на старой сломанной версии
//   при каждом обновлении.
// - иконки и манифест — «кэш, а если нет — сеть»: они почти не меняются,
//   грузить их заново на каждый запуск незачем.
//
// CACHE_NAME нужно поднимать на единицу при заметных изменениях в списке
// файлов ниже — activate() сам вычистит всё старое.
const CACHE_NAME = 'nanogram-v2';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './js/main.js',
  './js/ui.js',
  './js/renderer.js',
  './js/input-handler.js',
  './js/game-state.js',
  './js/puzzles.js',
  './js/puzzle-generator.js',
  './js/solver.js',
  './js/storage.js',
  './js/palette.js',
  './js/sound.js',
  './js/haptics.js',
  './js/confetti.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isShellDoc = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/';

  if (isShellDoc) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      return res;
    }))
  );
});
