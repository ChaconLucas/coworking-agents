// makes the office installable as an app; nothing is cached on purpose (everything is live and private)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { if (e.request.mode === 'navigate') e.respondWith(fetch(e.request)); });
