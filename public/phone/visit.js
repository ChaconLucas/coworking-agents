'use strict';
// a visit: the office picture (drawn without names) refreshed every few seconds, how many are working, and when the link ends
const V = T.visit, img = document.getElementById('frame'), statusEl = document.getElementById('status'), msg = document.getElementById('msg');
img.alt = V.alt;
async function tick() {
  const r = await fetch('info').then(x => (x.ok ? x.json() : null)).catch(() => null);
  if (!r) { msg.textContent = V.ended; statusEl.textContent = ''; img.hidden = true; return clearInterval(timer); }
  statusEl.textContent = V.status(r.working, r.total);
  msg.textContent = r.frameAt ? V.until(new Date(r.until).toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en', { hour: '2-digit', minute: '2-digit' })) : V.waiting;
  if (r.frameAt) img.src = 'frame.png?' + r.frameAt;
}
const timer = setInterval(tick, 5000); tick();
