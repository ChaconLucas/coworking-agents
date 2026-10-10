'use strict';
// ---------------- more places: the terrace, the server room, the elevator panel; weather indoors; photo frames ----------------
let viewHits = [];

// ---- the terrace: agents whose turn ended hang out on the roof, under the real sky ----
function drawTerrace(t) {
  const Wt = TROPHY_W, Ht = TROPHY_H, hits = [];
  const hr = new Date().getHours() + new Date().getMinutes() / 60, sky = Art.skyFor(styleHour(qs.get('hour') ? Number(qs.get('hour')) : hr));
  // sky gradient and the skyline
  for (let y = 0; y < 170; y++) { const k = y / 170; r(0, y, Wt, 1, k < .5 ? sky.top : sky.bot); }
  if (sky.phase === 'night') for (let i = 0; i < 60; i++) { const h = hash('ts' + i); r(h % Wt, (h >>> 9) % 120, 1, 1, ((t / 800 + i) | 0) % 5 ? '#ffffff' : '#8b9bb4'); }
  else if (sky.phase === 'day') { r(Wt - 90, 26, 18, 18, '#ffe08a'); r(Wt - 86, 22, 10, 26, '#ffe08a'); }
  else { r(70, 120, 40, 20, '#ffd27a'); r(76, 114, 28, 6, '#ffd27a'); }
  for (let x = 0; x < Wt; x += 14) {
    const h = 30 + hash('sky' + x) % 70, c = sky.phase === 'night' ? '#141629' : sky.phase === 'day' ? '#7f93ad' : '#5a3a5a';
    r(x, 170 - h, 13, h, c);
    for (let yy = 170 - h + 4; yy < 166; yy += 6) for (let xx = 2; xx < 12; xx += 4) if (sky.phase !== 'day' && hash(x + ':' + yy + ':' + xx + ((t / 9000) | 0)) % 3 === 0) r(x + xx, yy, 2, 2, '#feae34');
  }
  // the deck: wooden planks, a railing, string lights, plants, a grill, a telescope, lounge chairs
  for (let y = 170; y < Ht; y += 8) { r(0, y, Wt, 8, (y / 8) % 2 ? '#9c6a44' : '#a8754c'); for (let x = (y * 7) % 40; x < Wt; x += 40) r(x, y, 1, 8, '#7a5236'); }
  r(0, 166, Wt, 6, '#5a3a28'); for (let x = 0; x < Wt; x += 12) r(x, 150, 2, 18, '#5a3a28'); r(0, 150, Wt, 3, '#6b4a33');
  for (let x = 6, i = 0; x < Wt; x += 16, i++) { const y = 14 + Math.round(Math.abs(Math.sin(x / 60)) * 12); r(x, y, 1, 1, '#2a1d16'); r(x, y + 1, 3, 3, ((t / 400 + i) | 0) % 4 ? ['#ffd84d', '#ff6ec7', '#2ce8f5'][i % 3] : '#5a4a3a'); }
  for (let x = 0; x < Wt; x++) r(x, 14 + Math.round(Math.abs(Math.sin(x / 60)) * 12), 1, 1, '#2a1d16');
  for (const px of [18, Wt - 34]) { Art.drawPlant(px, 186, true); Art.drawPlant(px, 300, true); }
  // grill with smoke
  r(Wt - 120, 196, 30, 16, PAL.ink); r(Wt - 119, 197, 28, 6, '#3a3a40'); r(Wt - 117, 198, 24, 1, '#e43b44'); r(Wt - 112, 212, 2, 14, PAL.ink); r(Wt - 100, 212, 2, 14, PAL.ink);
  for (let i = 0; i < 3; i++) { const k = ((t / 1400 + i / 3) % 1); r(Wt - 108 + Math.round(Math.sin(k * 6 + i) * 4), 192 - Math.round(k * 26), 3, 3, `rgba(220,220,230,${(.5 - k * .5).toFixed(2)})`); }
  // telescope
  r(110, 200, 2, 22, PAL.ink); r(104, 222, 14, 2, PAL.ink); r(104, 196, 18, 5, '#c0cbdc'); r(120, 195, 4, 7, '#8b9bb4');
  // the people: agents whose turn ended (measured), relaxing on lounge chairs
  const relaxing = (data ? data.people : []).filter(p => !p.leaving && p.state === 'idle').slice(0, 8);
  relaxing.forEach((p, i) => {
    const x = 170 + (i % 4) * 80, y = 230 + Math.floor(i / 4) * 70;
    r(x - 6, y + 16, 30, 8, '#e8e2d6'); r(x - 6, y + 16, 30, 2, '#ffffff'); r(x - 6, y + 24, 2, 6, PAL.ink); r(x + 22, y + 24, 2, 6, PAL.ink); // lounge chair
    Art.drawFront(x, y - 2, look(p.id), t, { legs: Art.LEGS_SIT, legsKey: 'sit' });
    r(x + 18, y + 8, 6, 6, PAL.ink); r(x + 19, y + 9, 4, 4, '#ff6ec7'); r(x + 20, y + 6, 1, 3, '#63c74d'); // a drink
    hits.push({ x: x - 6, y: y - 4, w: 30, h: 34, id: p.id, title: `${p.name} · ${p.title || ''}` });
  });
  if (!relaxing.length) { r(Wt / 2 - 70, 250, 140, 14, '#00000044'); pixText(Wt / 2 - 52, 254, 'NOBODY ON BREAK', '#f4ecd8'); }
  r(Wt / 2 - 40, Ht - 22, 80, 14, PAL.ink); r(Wt / 2 - 39, Ht - 21, 78, 12, '#d9a441'); pixText(Wt / 2 - 26, Ht - 18, 'ROOFTOP', '#3b2418');
  viewHits = hits;
}

// ---- the server room: one rack per open session, its LEDs blinking with the session's real state ----
function drawServers(t) {
  const Wt = TROPHY_W, Ht = TROPHY_H, hits = [];
  r(0, 0, Wt, Ht, '#11131c');
  for (let y = 0; y < Ht; y += 20) for (let x = 0; x < Wt; x += 20) { r(x, y, 20, 1, '#1a1d2a'); r(x, y, 1, 20, '#1a1d2a'); } // raised floor tiles
  for (let x = 30; x < Wt; x += 120) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, 0, 0, x, 0, 120); g.addColorStop(0, 'rgba(60,140,255,.18)'); g.addColorStop(1, 'rgba(60,140,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 120, 0, 240, 140); ctx.restore(); }
  const people = (data ? data.people : []).filter(p => !p.leaving).slice(0, 18);
  const ledOf = s => s === 'needs_you' ? '#ff4d57' : s === 'waiting' ? '#feae34' : s === 'asleep' ? '#2a3050' : s === 'idle' ? '#3b5dc9' : '#62ff7a';
  people.forEach((p, i) => {
    const col = i % 6, row = Math.floor(i / 6), x = 30 + col * 100, y = 40 + row * 116;
    r(x - 2, y - 2, 64, 96, PAL.ink); r(x, y, 60, 92, '#2a2f45'); r(x, y, 60, 4, agentOf(p).color);
    const busy = !['idle', 'asleep'].includes(p.state), speed = p.state === 'asleep' ? 0 : busy ? 90 : 700;
    for (let u = 0; u < 8; u++) {
      const uy = y + 8 + u * 10; r(x + 4, uy, 52, 8, '#1b1d2e'); r(x + 4, uy, 52, 1, '#3a4058');
      for (let l = 0; l < 6; l++) { const on = speed && hash(p.id + u + ':' + l + ':' + ((t / speed) | 0)) % 3 !== 0; r(x + 8 + l * 4, uy + 3, 2, 2, on ? ledOf(p.state) : '#20243a'); }
      r(x + 38, uy + 2, 14, 4, '#11131c');
    }
    // a throughput bar: output tokens today (measured), relative to the busiest session
    const out = (p.today && p.today.outTokens) || 0, max = Math.max(1, ...people.map(q => (q.today && q.today.outTokens) || 0));
    r(x + 62, y + 92 - Math.round(out / max * 88), 3, Math.round(out / max * 88), ledOf(p.state));
    const nm = String(p.name).toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 12);
    r(x - 2, y + 96, 64, 9, '#1b1d2e'); pixText(x + 30 - nm.length * 2, y + 98, nm, '#c0cbdc');
    hits.push({ x: x - 2, y: y - 2, w: 68, h: 108, id: p.id, title: `${p.name} · ${T.states[p.state] || p.state} · ${fmtK(out)} ${T.usage.outShort}` });
  });
  if (!people.length) pixText(Wt / 2 - 30, Ht / 2, 'NO SESSIONS', '#c0cbdc');
  r(Wt / 2 - 44, Ht - 20, 88, 14, PAL.ink); r(Wt / 2 - 43, Ht - 19, 86, 12, '#3b5dc9'); pixText(Wt / 2 - 30, Ht - 16, 'SERVER ROOM', '#ffffff');
  viewHits = hits;
}

// ---- the elevator panel: floors, the terrace, the server room, the trophy room ----
const liftEl = document.createElement('div');
liftEl.className = 'trophy-card'; liftEl.hidden = true;
document.body.appendChild(liftEl);
function openElevator() {
  const E = T.elevator, btn = (attr, label, on) => `<button class="lift-btn ${on ? 'on' : ''}" ${attr}>${esc(label)}</button>`;
  liftEl.innerHTML = `<div class="tc-box lift-box"><div><b>⇅ ${esc(E.title)}</b><p>${esc(E.sub)}</p><div class="lift-grid">
    ${btn('data-go="terrace"', E.terrace, viewName === 'terrace')}
    ${btn('data-go="trophy"', E.trophy, viewName === 'trophy')}
    ${floors.map((f, i) => btn(`data-go-floor="${i}"`, floors.length > 1 ? E.floor(i + 1) : E.office, !trophyView && floor === i)).reverse().join('')}
    ${btn('data-go="servers"', E.servers, viewName === 'servers')}
  </div></div></div>`;
  liftEl.hidden = false; achBump('lifts');
}
liftEl.addEventListener('click', e => {
  if (e.target === liftEl) { liftEl.hidden = true; return; }
  const g = e.target.closest('[data-go]'), f = e.target.closest('[data-go-floor]');
  if (g) { liftEl.hidden = true; elevatorAt = Date.now(); setView(g.dataset.go); }
  if (f) { liftEl.hidden = true; elevatorAt = Date.now(); setView(null); goFloor(Number(f.dataset.goFloor)); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !liftEl.hidden) liftEl.hidden = true; });

// ---- weather indoors: umbrellas by the elevator when it rains, coats on the rack in winter ----
function drawIndoorWeather(x, y) {
  const rain = weather && (weather.kind === 'rain' || weather.kind === 'storm'), cold = season() === 'winter';
  if (rain) { r(x, y + 8, 10, 14, PAL.ink); r(x + 1, y + 9, 8, 12, '#8b9bb4'); for (const [dx, c] of [[1, '#e43b44'], [4, '#3b5dc9'], [7, '#ffd84d']]) { r(x + dx, y - 2, 2, 11, PAL.ink); r(x + dx - 1, y - 4, 4, 3, c); } }
  if (cold) { const cx = x + 14; r(cx + 4, y - 6, 2, 28, '#6b4a33'); r(cx, y - 6, 10, 2, '#6b4a33'); r(cx - 2, y - 4, 6, 12, '#a3283a'); r(cx + 6, y - 4, 6, 10, '#3b5dc9'); r(cx + 1, y + 20, 8, 2, '#6b4a33'); }
}

// ---- photos you took, framed on the game room wall (kept in this browser) ----
let photoImgs = [];
function loadPhotos() { photoImgs = (store.get('photos', []) || []).slice(-4).map(src => { const i = new Image(); i.src = src; return i; }); }
loadPhotos();
function savePhotoThumb() {
  const src = document.getElementById('cv'), c = document.createElement('canvas'); c.width = 48; c.height = 30;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, src.width, Math.min(src.height, src.width * .62), 0, 0, 48, 30);
  const list = (store.get('photos', []) || []).concat(c.toDataURL('image/png')).slice(-4);
  store.set('photos', list); loadPhotos();
}
function drawPhotoWall(x, y) {
  photoImgs.forEach((img, i) => {
    const fx = x + i * 22, fy = y + (i % 2) * 2;
    r(fx - 1, fy - 1, 20, 14, '#6b4a33'); r(fx, fy, 18, 12, '#f4ecd8');
    if (img.complete && img.naturalWidth) { ctx.imageSmoothingEnabled = false; ctx.drawImage(img, fx + 1, fy + 1, 16, 10); }
  });
}
