'use strict';
// the notices page (GitHub Pages, HTTPS): subscribes this phone to push and hands the subscription back to the office
// on the home Wi-Fi through the #fragment of a plain link (an HTTPS page cannot call the office's local address).
// The office's key and the way back arrive in the #fragment too, so GitHub never sees them.
const P = T.pushPage, msg = document.getElementById('msg'), actions = document.getElementById('actions');
const LAN = /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)[0-9.]+(:\d+)?\/\?t=[0-9a-f]{32}$/;
document.getElementById('title').textContent = P.title; document.getElementById('note').textContent = P.note;
const say = (t, ok) => { msg.textContent = t; msg.className = ok ? 'ok' : ''; };
const button = (label, fn, ghost) => { const b = document.createElement('button'); b.className = 'btn' + (ghost ? ' ghost' : ''); b.textContent = label; b.onclick = fn; actions.appendChild(b); return b; };
const link = (label, href, ghost) => { const a = document.createElement('a'); a.className = 'btn' + (ghost ? ' ghost' : ''); a.textContent = label; a.href = href; actions.appendChild(a); };

// key and way back: from the link, kept for when the app is opened from its icon
const h = new URLSearchParams(location.hash.slice(1));
// opened from a notice: straight on to the office panel (only a local address with its code)
const goOn = () => { const g = new URLSearchParams(location.hash.slice(1)).get('go') || ''; if (/^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)[0-9.]+(:\d+)?\/\?t=[0-9a-f]{32}$/.test(g)) { history.replaceState(null, '', location.pathname); location.href = g; return true; } return false; };
addEventListener('hashchange', goOn);
// or left by the notice tap (the service worker keeps it for a minute)
const LANGO = /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)[0-9.]+(:\d+)?\/\?t=[0-9a-f]{32}$/;
const pending = async () => { try { const c = await caches.open('cw'), r = await c.match('go'); if (!r) return false; await c.delete('go'); const g = await r.json(); if (Date.now() - g.at < 60000 && LANGO.test(g.url)) { location.href = g.url; return true; } } catch {} return false; };
document.addEventListener('visibilitychange', () => { if (!document.hidden) pending(); });
let key = h.get('k') || '', back = h.get('b') || '';
if (/^[A-Za-z0-9_-]{80,100}$/.test(key) && LAN.test(back)) { try { localStorage.setItem('cw.push', JSON.stringify({ key, back })); } catch {} }
else { try { const s = JSON.parse(localStorage.getItem('cw.push') || '{}'); key = s.key || ''; back = s.back || ''; } catch {} }
if (!/^[A-Za-z0-9_-]{80,100}$/.test(key) || !LAN.test(back)) { key = ''; back = ''; }

const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const raw = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
// what the phone reports, shown under a refusal so it can be told apart: asked and refused, or never asked
const fresh = !!h.get('k'); // arrived through the office's link (the app opened from its own icon keeps it only if iOS saved it)
const diag = before => { const v = /OS (\d+)_(\d+)/.exec(navigator.userAgent), perm = 'Notification' in window ? Notification.permission : 'none'; document.getElementById('note').textContent = `${P.note} · ${before || perm} → ${perm} · ${matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'tab'}/${navigator.standalone ? 'home' : 'no-home'} · ${fresh ? 'link' : 'icon'} · iOS ${v ? v[1] + '.' + v[2] : '?'} · v${VERSION}`; };
const blocked = before => { say(P.denied); diag(before); actions.textContent = ''; button(P.retry, () => show().catch(() => say(P.error))); };
const handBack = sub => { say(P.sending); location.href = back + '#push=' + encodeURIComponent(JSON.stringify(sub)); };

async function show() {
  actions.textContent = '';
  if (ios && !standalone) return say(P.install);
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return say(P.unsupported);
  // refused before ever asking, right after the office's link: this is the office app's in-app browser, not a home-screen app
  if (Notification.permission === 'denied' && ios && fresh) { say(P.inApp); return diag('denied'); }
  if (Notification.permission === 'denied') return blocked('denied');
  const reg = await navigator.serviceWorker.register('sw.js?v=3'); reg.update().catch(() => {});
  const sub = await reg.pushManager.getSubscription().catch(() => null);
  if (sub && Notification.permission === 'granted') {
    say(P.ready, true);
    if (back) { link(P.open, back); button(P.finish, () => handBack(sub.toJSON()), true); }
    return;
  }
  if (!key) return say(P.nolink);
  say(T.phone.pushHow);
  button(P.start, async () => {
    try {
      const before = Notification.permission;
      if (await Notification.requestPermission() !== 'granted') return blocked(before);
      const r = await navigator.serviceWorker.ready;
      const s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw(key) });
      handBack(s.toJSON());
    } catch { say(P.error); }
  });
}
const VERSION = 3;
if (!goOn()) pending().then(went => went || show().then(() => diag(), () => { say(P.error); diag(); }));
