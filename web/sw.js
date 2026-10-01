const CACHE = 'face-v3';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/camera.js', 'js/recognizer.js', 'js/storage.js', 'manifest.webmanifest', 'icons/icon.svg'];
const put = (req, r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; };

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  e.respondWith(u.origin === location.origin
    ? fetch(e.request, { cache: 'no-cache' }).then(r => put(e.request, r)).catch(() => caches.match(e.request))
    : caches.match(e.request).then(hit => hit || fetch(e.request).then(r => put(e.request, r))));
});