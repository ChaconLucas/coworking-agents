'use strict';
// ---------------- collection & fun: the weekly paper, pets, the shop, party mode, the group photo, your reply times ----------------

// ---- your reply times: from a request appearing to it being answered, per day (kept in this browser) ----
let replies = store.get('replies', {});
if (!replies || typeof replies !== 'object') replies = {};
function noteReply(ms) {
  const k = new Date().toISOString().slice(0, 10), d = replies[k] || (replies[k] = { n: 0, total: 0, best: 0 });
  d.n++; d.total += ms; d.best = d.best ? Math.min(d.best, ms) : ms;
  for (const old of Object.keys(replies).sort().slice(0, -30)) delete replies[old];
  store.set('replies', replies);
}
const fmtDur = ms => { const s = Math.round(ms / 1000); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 3600)}h${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}`; };
function repliesHtml() {
  const R = T.replies, k = new Date().toISOString().slice(0, 10), d = replies[k];
  const all = Object.values(replies), best = all.reduce((m, x) => x.best && (!m || x.best < m) ? x.best : m, 0);
  if (!d || !d.n) return `<h3>${esc(R.title)}</h3><p class="note">${esc(R.none)}</p>`;
  return `<h3>${esc(R.title)}</h3><div class="ltiles">${[[fmtDur(d.total / d.n), R.avg], [fmtDur(d.best), R.bestToday], [String(d.n), R.count], [best ? fmtDur(best) : '—', R.record]].map(([v, l]) => `<div class="ltile" style="--c:#feae34"><div class="ltop"><span>${esc(l)}</span></div><b>${esc(v)}</b></div>`).join('')}</div>`;
}

// ---- the weekly paper: headlines written from the last 7 days of measured history ----
function renderPaper() {
  const P = T.paper, body = reportEl.querySelector('.report-body'), u = usageData, days = (u && u.days) || {};
  const keys = Object.keys(days).sort().slice(-7), week = keys.map(k => ({ k, ...days[k] }));
  const hrs = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${(m / 60) | 0}h${String(m % 60).padStart(2, '0')}` : `${m}min`; };
  const loc = lang === 'pt' ? 'pt-BR' : 'en', dayName = k => new Date(k + 'T12:00:00').toLocaleDateString(loc, { weekday: 'long' });
  if (!week.length) { body.innerHTML = tabsHtml() + `<p class="note">${esc(u && u.scanning ? T.usage.scanning : P.empty)}</p>`; return; }
  const total = week.reduce((n, d) => n + d.activeMs, 0), tools = week.reduce((n, d) => n + d.tools, 0), out = week.reduce((n, d) => n + (d.output || 0), 0);
  const best = week.reduce((m, d) => d.activeMs > m.activeMs ? d : m, week[0]);
  const night = week.filter(d => new Date(d.first).getHours() < 5).length, both = week.filter(d => (d.agents || []).length >= 2).length;
  const top = u.month && u.month.top && u.month.top[0], live = top && data && data.people.find(p => p.id === top.id);
  const st = achState(), legends = st.filter(a => a.tier >= 5).length;
  const story = (h, p) => `<article><h4>${esc(h)}</h4><p>${esc(p)}</p></article>`;
  const today = new Date().toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  body.innerHTML = tabsHtml() + `<div class="paper">
    <header><small>${esc(today)}</small><h2>${esc(P.name)}</h2><small>${esc(P.edition(keys.length))}</small></header>
    <div class="lead"><h3>${esc(P.headline(hrs(total)))}</h3><p>${esc(P.leadText(fmtK(tools), fmtK(out), keys.length))}</p></div>
    <div class="cols">
      ${story(P.bestDay(dayName(best.k)), P.bestDayText(hrs(best.activeMs), fmtK(best.tools)))}
      ${top ? story(P.star((live && live.name) || top.title || top.id.slice(0, 8)), P.starText(hrs(top.activeMs), fmtK(top.tools))) : ''}
      ${night ? story(P.owls, P.owlsText(night)) : story(P.sleep, P.sleepText)}
      ${both ? story(P.duo, P.duoText(both)) : ''}
      ${story(P.trophies, P.trophiesText(st.reduce((n, a) => n + a.tier, 0), legends, coins()))}
      ${(() => { const k = new Date().toISOString().slice(0, 10), d = replies[k]; return d && d.n ? story(P.replies, P.repliesText(fmtDur(d.total / d.n), fmtDur(d.best))) : ''; })()}
    </div>
    <footer>${esc(P.footer)}</footer></div>`;
}

// ---- pets unlocked by achievements: a dog at 8 achievements at gold or better, a parrot at 16 ----
const goldCount = () => achState().filter(a => a.tier >= 3).length;
const dog = { x: 0, y: 0, tx: 0, ty: 0, until: 0, ready: false };
function drawPets(t, movers) {
  const g = goldCount();
  if (g >= 8 && prog.mascot !== 'dog') {
    if (!dog.ready) { Object.assign(dog, { x: RX + 30, y: TOP + 92, tx: RX + 30, ty: TOP + 92, ready: true }); }
    const dx = dog.tx - dog.x, dy = dog.ty - dog.y, d = Math.hypot(dx, dy);
    if (d > 1) { dog.x += dx / d * .6; dog.y += dy / d * .6; dog.flip = dx < 0; }
    else if (Date.now() > dog.until) { dog.tx = RX + 10 + Math.random() * (RW - 30); dog.ty = TOP + 80 + Math.random() * 20; dog.until = Date.now() + 4000 + Math.random() * 6000; }
    const moving = d > 1;
    movers.push({ y: dog.y, draw: () => drawDog(dog.x, dog.y, t, dog.flip, moving) });
  }
  if (g >= 16) drawParrot(RX + RW - 30, TOP - 26, t);
}
function drawDog(x, y, t, flip, moving) {
  const f = moving ? ((t / 120) | 0) % 2 : 0, c = '#c98f5a', d = '#8a5a3a';
  ctx.save(); if (flip) { ctx.translate(x * 2 + 14, 0); ctx.scale(-1, 1); }
  r(x, y + 3, 10, 5, PAL.ink); r(x + 1, y + 4, 8, 3, c);
  r(x + 8, y, 6, 6, PAL.ink); r(x + 9, y + 1, 4, 4, c); r(x + 12, y + 2, 1, 1, PAL.ink); r(x + 13, y + 4, 1, 1, PAL.ink); r(x + 9, y, 2, 2, d);
  r(x + 1, y + 7, 2, 3 - f, PAL.ink); r(x + 7, y + 7, 2, 2 + f, PAL.ink);
  r(x - 2, y + 2 + (((t / 150) | 0) % 2), 3, 1, d); // the tail wags
  ctx.restore();
}
function drawParrot(x, y, t) {
  r(x, y + 12, 12, 1, '#6b4a33'); r(x + 5, y + 13, 1, 6, '#6b4a33');
  const bob = ((t / 600) | 0) % 2;
  r(x + 3, y + 3 + bob, 6, 9, PAL.ink); r(x + 4, y + 4 + bob, 4, 7, '#e43b44'); r(x + 4, y + 9 + bob, 4, 2, '#3b5dc9'); r(x + 4, y + 7 + bob, 4, 1, '#ffd84d');
  r(x + 8, y + 5 + bob, 2, 2, '#feae34'); r(x + 6, y + 5 + bob, 1, 1, '#ffffff');
}

// ---- the shop: coins buy decor; bought items appear in the office (progress.json keeps them) ----
const SHOP = [
  { id: 'plants', price: 150, icon: '🪴' },
  { id: 'rug', price: 200, icon: '🟪' },
  { id: 'neon', price: 300, icon: '☕' },
  { id: 'lamps', price: 250, icon: '💡' },
  { id: 'disco', price: 500, icon: '🪩' },
  { id: 'statue', price: 800, icon: '🗽' },
  { id: 'piano', price: 1200, icon: '🎹' },
  { id: 'fountain', price: 2000, icon: '⛲' },
];
const owns = id => prog.owned.includes(id);
function buy(id) {
  const it = SHOP.find(x => x.id === id);
  if (!it || owns(id) || coins() < it.price) return;
  prog.spent += it.price; prog.owned.push(id); saveProgress(); achBump('purchases');
  toast(`<b>${esc(T.shop.bought)}</b>${esc(T.shop.items[id].name)}`, 'ok'); playTune('trophy');
  renderReport();
}
function renderShop() {
  const S2 = T.shop, body = reportEl.querySelector('.report-body'), c = coins();
  body.innerHTML = tabsHtml() + `<div class="wallet"><span class="coin"></span><b>${c.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en')}</b> ${esc(T.ach.coins)}<span class="note">${esc(S2.sub)}</span></div>
    <div class="shop">${SHOP.map(it => { const has = owns(it.id), can = c >= it.price; return `<div class="item ${has ? 'owned' : ''}"><span class="ach-ico">${it.icon}</span><div><b>${esc(S2.items[it.id].name)}</b><p>${esc(S2.items[it.id].desc)}</p>
      ${has ? `<small class="ok">${esc(S2.owned)}</small>` : `<button class="btn small" data-buy="${it.id}" ${can ? '' : 'disabled'}><span class="coin"></span> ${it.price}</button>`}</div></div>`; }).join('')}</div>`;
}
reportEl.addEventListener('click', e => { const b = e.target.closest('[data-buy]'); if (b) buy(b.dataset.buy); });

// bought items, drawn in fixed places (floor items before the people, so people walk in front)
function drawShopFloor(t, glows) {
  if (owns('plants')) for (let y = TOP + 140; y < H - 40; y += 150) Art.drawPlant(CX - 20, y, true);
  if (owns('lamps')) for (const lx of [RX + 4, RX + RW - 12]) { r(lx + 3, wing.ping - 4, 2, 14, PAL.ink); r(lx, wing.ping - 8, 8, 5, '#ffd84d'); glows.push({ x: lx + 4, y: wing.ping - 6, r: 22, c: '#ffd84d' }); }
  if (owns('statue')) { const m = usageData && usageData.month && usageData.month.top && usageData.month.top[0], x = RX + RW - 26, y = wing.ping + 34;
    r(x - 1, y + 16, 18, 8, PAL.ink); r(x, y + 17, 16, 6, '#8b9bb4'); if (m) { const lk = Art.look(m.id); Art.drawStanding(x, y - 6, { ...lk, s: '#ffd84d', S: '#d9a441', h: '#d9a441', H: '#b07d2a', c: '#ffd84d', C: '#d9a441', p: '#d9a441' }, 0, false); } glows.push({ x: x + 8, y: y + 6, r: 18, c: '#ffd84d' }); }
  if (owns('piano')) { const x = RX + RW - 44, y = wing.copa + 20; r(x - 1, y - 1, 24, 12, PAL.ink); r(x, y, 22, 10, '#1b1622'); for (let k = 0; k < 7; k++) r(x + 1 + k * 3, y + 6, 2, 4, '#ffffff'); }
  if (owns('fountain')) { const x = CX - 12, y = H - 70; r(x - 1, y + 8, 26, 10, PAL.ink); r(x, y + 9, 24, 8, '#8b9bb4'); r(x + 2, y + 10, 20, 5, '#4fa3d8'); r(x + 11, y, 2, 10, '#c0cbdc'); for (let i = 0; i < 4; i++) { const k = ((t / 500 + i / 4) % 1); r(x + 12 + Math.round(Math.cos(i * 1.6) * k * 8), y - 2 + Math.round(k * k * 12) - 4, 1, 1, '#9fd3ff'); } }
}
function drawShopWall(t, glows) {
  if (owns('neon')) { const on = ((t / 130) | 0) % 41 !== 0, x = RX + 150 > W - 40 ? RX + 2 : RX + 150; r(x - 1, 2, 30, 7, '#1b1d2e'); pixText(x + 1, 3, 'COFFEE', on ? '#ff6ec7' : '#5a2a48'); if (on) glows.push({ x: x + 13, y: 5, r: 20, c: '#ff6ec7' }); }
  if (owns('disco')) { const x = CX, y = TOP + 4; r(x, TOP - 6, 1, 6, '#c0cbdc'); r(x - 3, y, 7, 7, '#c0cbdc'); for (let i = 0; i < 6; i++) r(x - 3 + (i * 2 + ((t / 150) | 0)) % 7, y + (i % 3) * 2, 1, 1, ['#ff6ec7', '#2ce8f5', '#ffd84d'][i % 3]); if (partyUntil > Date.now()) glows.push({ x, y: y + 3, r: 60, c: ['#ff6ec7', '#2ce8f5', '#ffd84d'][((t / 300) | 0) % 3] }); }
}

// ---- party mode (hidden): three quick clicks on the </> neon sign ----
let partyUntil = 0, neonClicks = [];
let neonFlash = 0;
function neonClick() {
  const now = Date.now(); neonClicks = neonClicks.filter(t => now - t < 1500).concat(now);
  neonFlash = now; beep(neonClicks.length >= 2); achBump('neon');
  if (neonClicks.length < 3) toast(`<b>&lt;/&gt;</b>${esc(T.neonHint(3 - neonClicks.length))}`, '');
  if (neonClicks.length >= 3) { neonClicks = []; partyUntil = now + 10000; achBump('parties'); confettiAt = now; playTune('trophy'); checkAchievements(); }
}
const partying = () => partyUntil > Date.now();
function partyLights(t) {
  if (!partying()) return;
  const c = ['rgba(255,110,199,.16)', 'rgba(44,232,245,.16)', 'rgba(255,216,77,.16)', 'rgba(99,199,77,.16)'][((t / 250) | 0) % 4];
  ctx.fillStyle = c; ctx.fillRect(0, 0, W, H);
}
const partyBounce = (id, t) => partying() ? -Math.abs(Math.round(Math.sin(t / 110 + hash(id) % 7) * 3)) : 0;

// ---- group photo: the office canvas as a PNG ----
function groupPhoto() {
  const cv = document.getElementById('cv');
  achBump('photos');
  cv.toBlob(b => {
    if (!b) return;
    const a = document.createElement('a'), d = new Date();
    a.href = URL.createObjectURL(b); a.download = `coworking-agents-${d.toISOString().slice(0, 10)}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.png`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`<b>${esc(T.photo.saved)}</b>${esc(a.download)}`, 'ok');
  }, 'image/png');
}

// the Persian rug: under the pool table in the game room (drawn with the room, before the furniture)
function drawPersianRug(x, y, w, h) {
  for (let k = 0; k < w; k += 2) { r(x + k, y - 3, 1, 3, '#f4ecd8'); r(x + k, y + h, 1, 3, '#f4ecd8'); }     // fringe
  r(x - 1, y - 1, w + 2, h + 2, PAL.ink); r(x, y, w, h, '#7a1f33');
  r(x + 2, y + 2, w - 4, h - 4, '#d9a441'); r(x + 3, y + 3, w - 6, h - 6, '#7a1f33');                       // gold border
  for (let k = 6; k < w - 6; k += 6) { r(x + k, y + 4, 2, 2, '#3b5dc9'); r(x + k, y + h - 6, 2, 2, '#3b5dc9'); } // border motif
  r(x + 6, y + 7, w - 12, h - 14, '#a3283a');                                                                  // field
  const cx = x + w / 2, cy = y + h / 2;
  for (let q = 0; q < 8; q++) { r(cx - 8 + q, cy - q / 2, 16 - q * 2, 1, '#d9a441'); r(cx - 8 + q, cy + q / 2, 16 - q * 2, 1, '#d9a441'); } // medallion
  r(cx - 3, cy - 1, 6, 2, '#3b5dc9'); r(cx - 1, cy - 2, 2, 4, '#f4ecd8');
  for (const [dx, dy] of [[10, 10], [w - 14, 10], [10, h - 14], [w - 14, h - 14]]) { r(x + dx, y + dy, 4, 4, '#d9a441'); r(x + dx + 1, y + dy + 1, 2, 2, '#3b5dc9'); } // corners
}
