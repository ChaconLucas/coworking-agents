'use strict';
// shows each notice the office sends (already decrypted by the phone) and opens the office panel when tapped
const LAN = /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)[0-9.]+(:\d+)?\/(\?t=[0-9a-f]{32})?$/;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch {}
  const jobs = [self.registration.showNotification(String(m.title || 'coworking-agents'), { body: String(m.body || ''), tag: String(m.tag || '') || undefined, icon: 'icon-192.png', data: { url: LAN.test(m.url || '') ? m.url : '' } })];
  if ('setAppBadge' in self.navigator) jobs.push((m.badge ? self.navigator.setAppBadge(Number(m.badge) || 0) : self.navigator.clearAppBadge()).catch(() => {}));
  e.waitUntil(Promise.all(jobs));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.openWindow(url));
});
