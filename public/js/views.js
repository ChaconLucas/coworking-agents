'use strict';
// ---------------- more places: the terrace, the server room, the elevator panel; weather indoors; photo frames ----------------
let viewHits = [];

// ---- the rooftop: a garden terrace over the city; agents whose turn ended relax here ----
function skyStops(phase) {
  return phase === 'night' ? ['#0b0f24', '#18204a', '#2a3466'] : phase === 'dawn' ? ['#3a3a7a', '#f77622', '#ffd27a'] : phase === 'dusk' ? ['#2a2a6a', '#b55088', '#f7a23a'] : ['#3a9ad9', '#7fc8f0', '#c8ecff'];
}
function drawTerrace(t) {
  const Wt = TROPHY_W, Ht = TROPHY_H, hits = [], HZ = 170;
  const hr = new Date().getHours() + new Date().getMinutes() / 60, sky = Art.skyFor(styleHour(qs.get('hour') ? Number(qs.get('hour')) : hr)), night = sky.phase === 'night', day = sky.phase === 'day';
  // sky: three-stop gradient, sun or moon, stars, clouds, a plane, birds
  const st = skyStops(sky.phase);
  for (let y = 0; y < HZ; y++) { const k = y / HZ, c = k < .55 ? st[0] : k < .85 ? st[1] : st[2]; r(0, y, Wt, 1, c); }
  for (let y = 0; y < HZ; y += 2) { const k = y / HZ; ctx.fillStyle = `rgba(255,255,255,${(k * .06).toFixed(3)})`; ctx.fillRect(0, y, Wt, 2); }
  if (night) { for (let i = 0; i < 90; i++) { const h = hash('ts' + i); r(h % Wt, (h >>> 9) % 130, 1, 1, ((t / 700 + i) | 0) % 6 ? '#ffffff' : '#6b7a9c'); }
    const mx = Wt - 110, my = 34; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(mx, my, 0, mx, my, 40); g.addColorStop(0, 'rgba(255,250,220,.25)'); g.addColorStop(1, 'rgba(255,250,220,0)'); ctx.fillStyle = g; ctx.fillRect(mx - 40, my - 40, 80, 80); ctx.restore();
    r(mx - 8, my - 8, 16, 16, '#f4ecd8'); r(mx - 10, my - 5, 20, 10, '#f4ecd8'); r(mx - 3, my - 4, 3, 3, '#d8cfb8'); r(mx + 3, my + 2, 2, 2, '#d8cfb8'); }
  else if (day) { const sx = Wt - 120, sy = 40; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60); g.addColorStop(0, 'rgba(255,240,180,.5)'); g.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = g; ctx.fillRect(sx - 60, sy - 60, 120, 120); ctx.restore(); r(sx - 10, sy - 10, 20, 20, '#fff2b0'); r(sx - 12, sy - 6, 24, 12, '#fff2b0'); }
  else { const sx = sky.phase === 'dawn' ? 120 : Wt - 140; r(sx - 18, HZ - 26, 36, 16, '#ffd27a'); r(sx - 14, HZ - 32, 28, 6, '#ffd27a'); r(sx - 8, HZ - 36, 16, 4, '#ffd27a'); }
  if (!night) for (let i = 0; i < 4; i++) { const cx = ((t / (90 + i * 30) + i * 180) % (Wt + 120)) - 60, cy = 20 + i * 22, c = day ? '#ffffff' : '#f4c0d0'; r(cx, cy, 40, 8, c); r(cx + 8, cy - 5, 22, 6, c); r(cx + 26, cy - 3, 12, 4, c); ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect(cx, cy + 6, 40, 2); }
  { const px = ((t / 25) % (Wt + 80)) - 40, py = 52; r(px, py, 10, 2, night ? '#8b9bb4' : '#ffffff'); r(px + 3, py - 2, 3, 6, night ? '#8b9bb4' : '#ffffff'); if (((t / 400) | 0) % 2) r(px + 10, py, 1, 1, '#e43b44'); }
  if (day) for (let i = 0; i < 3; i++) { const bx = ((t / 18 + i * 40) % (Wt + 40)) - 20, by = 70 + i * 6 + Math.round(Math.sin(t / 300 + i) * 2), w = ((t / 150 + i) | 0) % 2; r(bx, by, 1, 1, '#2a2a3a'); r(bx - 2, by - w, 2, 1, '#2a2a3a'); r(bx + 1, by - w, 2, 1, '#2a2a3a'); }
  // the city in three layers: far (faded), middle, near (detailed: windows, water tanks, antennas)
  const layer = (seed, base, minH, varH, color, win, step, detail) => {
    for (let x = -6; x < Wt; x += step) {
      const h = minH + hash(seed + x) % varH, w = step - 1 - hash(seed + 'w' + x) % 3, top = base - h;
      r(x, top, w, h, color);
      if (detail) { if (hash(seed + 'a' + x) % 4 === 0) { r(x + w / 2, top - 10, 1, 10, color); if (((t / 600 + x) | 0) % 2) r(x + w / 2, top - 11, 1, 1, '#ff4d57'); } if (hash(seed + 't' + x) % 5 === 0) { r(x + 3, top - 6, 7, 6, color); r(x + 4, top - 8, 5, 2, color); } }
      if (win) for (let yy = top + 3; yy < base - 2; yy += 4) for (let xx = 2; xx < w - 2; xx += 3) { const lit = night ? hash(seed + x + ':' + yy + ':' + xx + ((t / 12000) | 0)) % 3 === 0 : day ? hash(seed + x + ':' + yy + xx) % 9 === 0 : hash(seed + x + yy + xx) % 4 === 0; if (lit) r(x + xx, yy, 1, 2, night ? '#feae34' : day ? '#bfe0ff' : '#ffd27a'); }
    }
  };
  layer('far', HZ, 30, 60, night ? '#1a2045' : day ? '#a9c4dc' : '#7a4a6a', false, 11, false);
  layer('mid', HZ, 20, 70, night ? '#141a38' : day ? '#8aa4bf' : '#5a3a5a', true, 15, true);
  // the parapet and a glass railing
  r(0, HZ, Wt, 10, '#6b5a4a'); r(0, HZ, Wt, 2, '#8a7a6a'); ctx.fillStyle = 'rgba(200,230,255,.18)'; ctx.fillRect(0, HZ - 18, Wt, 18); for (let x = 0; x < Wt; x += 40) r(x, HZ - 18, 2, 18, '#c0cbdc'); r(0, HZ - 19, Wt, 2, '#c0cbdc');
  // the deck: planks with depth, a stone path
  for (let y = HZ + 10; y < Ht; y += 7) { const k = (y - HZ) / (Ht - HZ); r(0, y, Wt, 7, (y / 7 | 0) % 2 ? '#a6754c' : '#b07f54'); r(0, y + 6, Wt, 1, '#8a5e3c'); for (let x = (y * 11) % 50; x < Wt; x += Math.round(50 + k * 20)) r(x, y, 1, 6, '#8a5e3c'); }
  for (let i = 0; i < 10; i++) { const y = HZ + 24 + i * 22, w = 22 + i * 2; r(Wt / 2 - w / 2, y, w, 10, '#c9c0ae'); r(Wt / 2 - w / 2, y, w, 2, '#e0d8c6'); }
  // a pergola with crossing string lights
  for (const px of [40, Wt - 44]) { r(px, 30, 5, HZ + 70, '#6b4a33'); r(px + 1, 30, 1, HZ + 70, '#8a6a4a'); }
  r(40, 28, Wt - 80, 5, '#6b4a33'); r(40, 28, Wt - 80, 1, '#8a6a4a');
  for (const [x0, x1, sag] of [[44, Wt - 44, 30], [44, Wt / 2, 18], [Wt / 2, Wt - 44, 18]]) for (let x = x0, i = 0; x < x1; x += 2, i++) { const k = (x - x0) / (x1 - x0), y = 33 + Math.round(Math.sin(k * Math.PI) * sag); r(x, y, 1, 1, '#2a1d16'); if (i % 7 === 0) { const c = ['#ffd84d', '#ff6ec7', '#2ce8f5', '#ffffff'][(i / 7) % 4 | 0], on = ((t / 500 + i) | 0) % 5; r(x - 1, y + 1, 3, 3, on ? c : '#5a4a3a'); if (on && night) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = c + '30'; ctx.fillRect(x - 4, y - 2, 9, 9); ctx.restore(); } } }
  // a plunge pool with shimmering water and loungers
  const poolX = 70, poolY = HZ + 40;
  r(poolX - 3, poolY - 3, 126, 66, '#e8e2d6'); r(poolX, poolY, 120, 60, '#2f8fd0'); r(poolX, poolY, 120, 4, '#1e6fa8');
  for (let i = 0; i < 14; i++) { const h = hash('pw' + i), x = poolX + 4 + h % 112, y = poolY + 6 + (h >>> 8) % 50; if (((t / 300 + i) | 0) % 3) r(x, y, 6, 1, '#9fd3ff'); }
  r(poolX + 110, poolY - 8, 2, 12, '#c0cbdc'); r(poolX + 104, poolY - 8, 8, 2, '#c0cbdc');
  // the bar on the right: counter, bottles, stools, a neon sign
  const bx = Wt - 200, by = HZ + 30;
  r(bx, by + 18, 140, 24, '#5a3a28'); r(bx, by + 16, 140, 4, '#8a6a4a'); r(bx, by + 18, 140, 2, '#3a2418');
  r(bx + 4, by - 14, 132, 26, '#3a2418'); for (let i = 0; i < 14; i++) r(bx + 8 + i * 9, by - 10 + (i % 2) * 2, 4, 10 - (i % 2) * 2, ['#63c74d', '#ffd84d', '#e43b44', '#2ce8f5', '#b55088'][i % 5]);
  r(bx + 36, by - 32, 68, 14, '#1b1d2e'); const on = ((t / 140) | 0) % 37 !== 0; pixText(bx + 42, by - 28, 'ROOF BAR', on ? '#ff6ec7' : '#5a2a48'); if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,110,199,.12)'; ctx.fillRect(bx + 30, by - 36, 80, 22); ctx.restore(); }
  const stools = [0, 1, 2, 3, 4].map(i => ({ x: bx + 10 + i * 26, y: by + 44 }));
  for (const s2 of stools) { r(s2.x + 2, s2.y + 8, 2, 10, PAL.ink); r(s2.x - 2, s2.y + 6, 10, 3, '#e43b44'); }
  // umbrella tables in the middle
  const tables = [{ x: 220, y: HZ + 110 }, { x: Wt - 290, y: HZ + 110 }, { x: 250, y: HZ + 180 }];
  for (const tb of tables) { r(tb.x, tb.y + 16, 24, 4, '#e8e2d6'); r(tb.x + 11, tb.y - 30, 2, 46, '#c0cbdc'); r(tb.x - 14, tb.y - 36, 52, 8, '#e43b44'); r(tb.x - 8, tb.y - 40, 40, 4, '#e43b44'); for (let k = 0; k < 4; k++) r(tb.x - 14 + k * 13, tb.y - 36, 6, 8, '#ffffff'); }
  // a fire pit (glows at night), potted palms, lanterns
  const fx = Wt / 2 + 80, fy = HZ + 150; r(fx - 14, fy, 28, 10, '#6b6a66'); r(fx - 12, fy + 2, 24, 6, '#3a3a40');
  for (let i = 0; i < 5; i++) { const fl = ((t / 90 + i) | 0) % 3; r(fx - 8 + i * 4, fy - 4 - fl * 2, 3, 6 + fl * 2, i % 2 ? '#feae34' : '#e43b44'); }
  if (!day) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 50); g.addColorStop(0, 'rgba(255,150,60,.35)'); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(fx - 50, fy - 50, 100, 100); ctx.restore(); }
  for (const [px, py] of [[16, HZ + 20], [Wt - 30, HZ + 20], [16, Ht - 60], [Wt - 30, Ht - 60]]) { r(px, py + 20, 14, 12, '#c96f4a'); for (let k = 0; k < 5; k++) r(px + 6 - k * 3, py + 6 - k, 2, 16 + k, '#3a8f46'), r(px + 6 + k * 3, py + 6 - k, 2, 16 + k, '#3a8f46'); r(px + 6, py, 2, 22, '#6b4a33'); }
  // the people: agents whose turn ended (measured), at the bar, the tables and the pool
  const relaxing = (data ? data.people : []).filter(p => !p.leaving && p.state === 'idle').slice(0, 11);
  const seats = [...stools.map(s2 => ({ x: s2.x - 4, y: s2.y - 14, pose: 'back' })), ...tables.flatMap(tb => [{ x: tb.x - 14, y: tb.y - 4, pose: 'front' }, { x: tb.x + 22, y: tb.y - 4, pose: 'front' }]), { x: poolX + 20, y: poolY + 66, pose: 'front' }, { x: poolX + 70, y: poolY + 66, pose: 'front' }];
  relaxing.forEach((p, i) => {
    const s2 = seats[i]; if (!s2) return;
    if (s2.pose === 'back') Art.drawSeatedBack(s2.x, s2.y, look(p.id), t, {}); else Art.drawFront(s2.x, s2.y, look(p.id), t, { legs: Art.LEGS_SIT, legsKey: 'sit' });
    hits.push({ x: s2.x - 2, y: s2.y - 4, w: 20, h: 32, id: p.id, title: `${p.name} · ${p.title || ''}` });
  });
  if (!relaxing.length) { r(Wt / 2 - 66, Ht - 40, 132, 14, '#00000055'); pixText(Wt / 2 - 58, Ht - 36, lang === 'pt' ? 'NINGUEM DE FOLGA' : 'NOBODY ON BREAK', '#f4ecd8'); }
  if (!day) { ctx.fillStyle = 'rgba(10,12,40,.25)'; ctx.fillRect(0, HZ, Wt, Ht - HZ); } // evening light on the deck
  viewHits = hits;
}

// ---- the server room: two rows of glass racks, a NOC wall with live numbers, cold aisle, cable trays ----
function drawServers(t) {
  const Wt = TROPHY_W, Ht = TROPHY_H, hits = [], people = (data ? data.people : []).filter(p => !p.leaving);
  const ledOf = s => s === 'needs_you' ? '#ff4d57' : s === 'waiting' ? '#feae34' : s === 'asleep' ? '#2a3050' : s === 'idle' ? '#3b8bff' : '#62ff7a';
  // room: dark walls with acoustic panels, a raised floor with vents, blue strip lights
  r(0, 0, Wt, 140, '#151a28'); for (let x = 0; x < Wt; x += 32) { r(x + 2, 8, 28, 120, '#1a2032'); r(x + 2, 8, 28, 1, '#232a40'); }
  r(0, 138, Wt, 3, '#2ce8f5'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(44,232,245,.08)'; ctx.fillRect(0, 128, Wt, 24); ctx.restore();
  for (let y = 141; y < Ht; y += 18) for (let x = 0; x < Wt; x += 18) { r(x, y, 18, 18, (x + y) % 36 ? '#1c2132' : '#20263a'); r(x, y, 18, 1, '#2a3148'); r(x, y, 1, 18, '#2a3148'); }
  for (let x = 96; x < Wt - 96; x += 36) { r(x, 268, 18, 18, '#11141f'); for (let k = 0; k < 4; k++) r(x + 2, 270 + k * 4, 14, 1, '#2a3148'); } // cold-aisle vents
  for (let i = 0; i < 12; i++) { const h = hash('mist' + i), k = ((t / 2200 + i / 12) % 1); r(100 + h % (Wt - 200), 280 - Math.round(k * 40), 2, 1, `rgba(180,230,255,${(.35 - k * .35).toFixed(2)})`); }
  // cable trays overhead with cables dropping to the racks
  r(0, 22, Wt, 4, '#3a4058'); r(0, 22, Wt, 1, '#5a6280');
  // racks: a back row (smaller) and a front row (bigger); each rack is a session
  const rack = (p, x, y, w, h, i) => {
    const busy = !['idle', 'asleep'].includes(p.state), speed = p.state === 'asleep' ? 0 : busy ? 80 : 600, c = ledOf(p.state);
    r(x - 2, y - 2, w + 4, h + 4, '#0b0a0e'); r(x, y, w, h, '#232a40'); r(x, y, w, 3, agentOf(p).color);
    const units = Math.floor((h - 10) / 7);
    for (let u = 0; u < units; u++) { const uy = y + 6 + u * 7; r(x + 3, uy, w - 6, 5, '#141826'); r(x + 3, uy, w - 6, 1, '#2a3148'); for (let l = 0; l < Math.floor((w - 16) / 3); l++) { const lit = speed && hash(p.id + u + ':' + l + ':' + ((t / speed) | 0)) % 3 !== 0; r(x + 5 + l * 3, uy + 2, 2, 2, lit ? c : '#1e2236'); } }
    ctx.fillStyle = 'rgba(200,230,255,.06)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.moveTo(x + w * .2, y); ctx.lineTo(x + w * .35, y); ctx.lineTo(x + w * .15, y + h); ctx.lineTo(x, y + h); ctx.fill(); // glass door
    const blink = p.state === 'needs_you' ? ((t / 300) | 0) % 2 : 1; r(x + w / 2 - 2, y - 6, 4, 4, blink ? c : '#2a3050'); if (blink && p.state !== 'asleep') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = c + '33'; ctx.fillRect(x + w / 2 - 8, y - 12, 16, 16); ctx.restore(); }
    r(x + w / 2, 26, 1, y - 32, ['#e43b44', '#ffd84d', '#3b5dc9', '#63c74d'][i % 4]); // cable from the tray
    const nm = String(p.name).toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, Math.floor(w / 4));
    r(x, y + h + 3, w, 8, '#11141f'); pixText(x + w / 2 - nm.length * 2, y + h + 5, nm, '#c0cbdc');
    hits.push({ x: x - 2, y: y - 8, w: w + 4, h: h + 20, id: p.id, title: `${p.name} · ${T.states[p.state] || p.state} · ${fmtK((p.today && p.today.outTokens) || 0)} ${T.usage.outShort}` });
  };
  const back = people.slice(0, 8), front = people.slice(8, 14);
  back.forEach((p, i) => rack(p, 40 + i * 72, 118, 44, 80, i));
  front.forEach((p, i) => rack(p, 30 + i * 100, 238, 60, 110, i + 8));
  // the NOC wall: three big screens with live numbers
  const working = people.filter(p => !['idle', 'asleep', 'needs_you', 'waiting'].includes(p.state)).length, need = people.filter(p => p.state === 'needs_you' || p.state === 'waiting');
  const scr = (x, w) => { r(x - 3, 34, w + 6, 66, '#0b0a0e'); r(x, 37, w, 60, '#071018'); ctx.fillStyle = 'rgba(44,232,245,.06)'; for (let y = 37; y < 97; y += 2) ctx.fillRect(x, y, w, 1); };
  scr(170, 90); scr(275, 90); scr(380, 90);
  pixText(176, 41, 'SESSIONS', '#2ce8f5'); gText(ctx, 176, 52, people.length, '#62ff7a', 4); pixText(176, 86, `${working} WORKING`, '#62ff7a');
  pixText(281, 41, 'OUTPUT TODAY', '#2ce8f5');
  { const top = people.slice().sort((a, b) => ((b.today && b.today.outTokens) || 0) - ((a.today && a.today.outTokens) || 0)).slice(0, 8), max = Math.max(1, ...top.map(p => (p.today && p.today.outTokens) || 0));
    top.forEach((p, i) => { const h = Math.max(1, Math.round(((p.today && p.today.outTokens) || 0) / max * 38)); r(281 + i * 10, 92 - h, 7, h, agentOf(p).color); }); }
  pixText(386, 41, 'ALERTS', need.length ? '#ff4d57' : '#2ce8f5');
  if (need.length) need.slice(0, 5).forEach((p, i) => { if (((t / 500) | 0) % 2 || i) r(386, 52 + i * 8, 3, 3, '#ff4d57'); pixText(392, 52 + i * 8, String(p.name).toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 13), '#ffb0b0'); });
  else { pixText(386, 58, 'ALL SYSTEMS', '#62ff7a'); pixText(386, 66, 'NOMINAL', '#62ff7a'); }
  // a sysadmin desk, a fire extinguisher, a warning stripe
  r(Wt - 110, 300, 80, 6, '#3a4058'); r(Wt - 104, 306, 3, 30, '#2a3148'); r(Wt - 40, 306, 3, 30, '#2a3148'); r(Wt - 96, 286, 24, 14, '#0b0a0e'); r(Wt - 94, 288, 20, 10, '#2ce8f5'); r(Wt - 64, 294, 6, 6, '#e8e2d6');
  r(14, 160, 8, 18, '#e43b44'); r(15, 156, 6, 4, '#2a2a30'); r(16, 164, 4, 6, '#ffffff');
  for (let x = 0; x < Wt; x += 16) r(x, Ht - 6, 8, 6, '#ffd84d'), r(x + 8, Ht - 6, 8, 6, '#1b1622');
  if (!people.length) pixText(Wt / 2 - 30, 200, 'NO SESSIONS', '#c0cbdc');
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
