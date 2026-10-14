'use strict';
// ---------------- the library, the lab and the meeting room; walking inside every room ----------------
// The agents stay at their desks in the office. A room shows who is doing that thing right now (measured from
// their state): reading or browsing in the library, running commands in the lab, working with helpers in the
// meeting room. You walk in like in the office (arrows/WASD or a click), Enter next to someone opens them,
// and the elevator door in the corner takes you back.

// --- walking in a room: its floor, where you arrive, the door back ---
const ROOM_WALK = {
  library: { x: 20, y: 150, w: 600, h: 228, door: { x: 26, y: 186 } },
  lab: { x: 20, y: 140, w: 600, h: 238, door: { x: 26, y: 176 } },
  meeting: { x: 20, y: 150, w: 600, h: 228, door: { x: 26, y: 186 } },
  terrace: { x: 20, y: 186, w: 600, h: 192, door: { x: 26, y: 222 } },
  servers: { x: 20, y: 200, w: 600, h: 178, door: { x: 26, y: 236 } },
  trophy: { x: 20, y: 290, w: 600, h: 88, door: { x: 26, y: 326 } },
};
const vme = { x: 0, y: 0, path: [], flip: false, moving: false, room: '' };
let vTag = null, vHint = null, vLastHint = '';
const roomWalk = () => (trophyView && playerOn && ROOM_WALK[viewName]) || null;
function roomUpdate(dt) {
  const F = roomWalk(); if (!F) { if (vTag) vTag.hidden = vHint.hidden = true; return; }
  if (vme.room !== viewName) Object.assign(vme, { x: F.door.x + 22, y: F.door.y - 6, path: [], room: viewName }); // in through the door
  let dx = 0, dy = 0; const k = c => keysDown.has(c);
  if (k('ArrowLeft') || k('a')) dx--; if (k('ArrowRight') || k('d')) dx++; if (k('ArrowUp') || k('w')) dy--; if (k('ArrowDown') || k('s')) dy++;
  vme.moving = false;
  const clamp = p => ({ x: Math.max(F.x, Math.min(F.x + F.w - 16, p.x)), y: Math.max(F.y, Math.min(F.y + F.h - 24, p.y)) });
  if (dx || dy) {
    vme.path = []; const len = Math.hypot(dx, dy), step = PLAYER_SPEED * (k('Shift') ? 2 : 1) * dt;
    Object.assign(vme, clamp({ x: vme.x + dx / len * step, y: vme.y + dy / len * step })); vme.moving = true; if (dx) vme.flip = dx < 0;
  } else if (vme.path.length) {
    const w = vme.path[0], ddx = w.x - vme.x, ddy = w.y - vme.y, d = Math.hypot(ddx, ddy), step = PLAYER_SPEED * 1.4 * dt;
    if (d <= step) { vme.x = w.x; vme.y = w.y; vme.path.shift(); } else { vme.x += ddx / d * step; vme.y += ddy / d * step; if (Math.abs(ddx) > .5) vme.flip = ddx < 0; }
    vme.moving = true;
  }
  if (vme.moving) { const rc = cv.getBoundingClientRect(), py = rc.top + vme.y * S; if (py > innerHeight - 80) scrollBy({ top: py - (innerHeight - 160) }); else if (py < 130) scrollBy({ top: py - 190 }); } // the page follows you
  if (!vTag) { vTag = document.createElement('span'); vHint = document.createElement('span'); vTag.className = 'me-tag'; vHint.className = 'me-hint'; overlay.append(vTag, vHint); }
  vTag.hidden = false; vTag.textContent = T.walk.you; vTag.style.left = (vme.x + 8) * S + 'px'; vTag.style.top = (vme.y - 4) * S + 'px';
  const n = roomNear(), label = n ? n.label : '';
  vHint.hidden = !n; if (label !== vLastHint) { vLastHint = label; vHint.innerHTML = `<b>Enter ↵</b> ${esc(label)}`; }
  if (n) { vHint.style.left = (vme.x + 8) * S + 'px'; vHint.style.top = (vme.y + 30) * S + 'px'; }
}
// what Enter does where you stand: talk to the agent next to you, or take the door back
function roomNear() {
  const F = roomWalk(); if (!F) return null;
  const c = { x: vme.x + 8, y: vme.y + 12 };
  let best = null;
  for (const h of viewHits) if (h.id) { const d = Math.hypot(h.x + h.w / 2 - c.x, h.y + h.h / 2 - c.y); if (d < 30 && (!best || d < best.d)) best = { d, h }; }
  if (best) { const p = data.people.find(x => x.id === best.h.id); if (p) return { label: T.walk.talk(best.h.who || p.name), run: () => { setView(null); showPerson(p.id); } }; }
  if (Math.hypot(F.door.x + 8 - c.x, F.door.y - c.y) < 26) return { label: T.places.back, run: () => setView(null) };
  return null;
}
// you, drawn last in the room, and the elevator door you came in through
function drawRoomWalker(t) {
  const F = roomWalk(); if (!F) return;
  const d = F.door; r(d.x - 4, d.y - 30, 26, 32, PAL.ink); r(d.x - 2, d.y - 28, 10, 28, '#9aa3b0'); r(d.x + 9, d.y - 28, 10, 28, '#9aa3b0'); r(d.x + 8, d.y - 28, 1, 28, '#5a6270');
  r(d.x + 2, d.y - 37, 14, 8, '#1b1d2e'); r(d.x + 5, d.y - 35, 3, 1, '#feae34'); r(d.x + 6, d.y - 36, 1, 1, '#feae34'); r(d.x + 10, d.y - 33, 3, 1, '#feae34'); r(d.x + 11, d.y - 32, 1, 1, '#feae34'); // the lift's ▲▼
  ctx.fillStyle = 'rgba(255,216,77,.35)'; ctx.fillRect(vme.x + 1, vme.y + 21, 14, 3);
  Art.drawStanding(vme.x, vme.y, youLook(), t, vme.moving); if (typeof drawOutfit === 'function') drawOutfit(vme.x, vme.y - 2);
}
document.addEventListener('keydown', e => {
  if (!roomWalk() || !reportEl.hidden) return;
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea') return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === 'Shift') keysDown.add('Shift');
  if (key.startsWith('Arrow') || (!e.metaKey && !e.ctrlKey && !e.altKey && key.length === 1 && 'wasd'.includes(key))) { keysDown.add(key); e.preventDefault(); e.stopImmediatePropagation(); }
  if (e.key === 'Enter') { const n = roomNear(); if (n) { e.preventDefault(); n.run(); } }
}, true);
overlay.addEventListener('click', e => {
  const F = roomWalk(); if (!F || e.target.closest('button,.tag')) return;
  const rc = overlay.getBoundingClientRect(), x = (e.clientX - rc.left) / S - 8, y = (e.clientY - rc.top) / S - 14;
  vme.path = [{ x: Math.max(F.x, Math.min(F.x + F.w - 16, x)), y: Math.max(F.y, Math.min(F.y + F.h - 24, y)) }];
});

// --- drawing helpers shared by the three rooms ---
const plain = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); // the pixel font has no accents
const roomName = (x, y, txt) => { const s = plain(txt).slice(0, 12), w = s.length * 4 + 4; r(x + 8 - w / 2, y, w, 7, '#000000aa'); pixText(x + 10 - w / 2, y + 1, s, '#f4ecd8'); };
const roomSign = (x, y, txt, bg, fg) => { txt = plain(txt); const w = txt.length * 4 + 12; r(x - w / 2 - 2, y - 2, w + 4, 13, PAL.ink); r(x - w / 2, y, w, 9, bg); pixText(x - w / 2 + 6, y + 2, txt, fg); };
const roomEmpty = (Wt, Ht, txt) => { txt = plain(txt); const w = txt.length * 4 + 16; r(Wt / 2 - w / 2, Ht - 46, w, 14, '#00000066'); pixText(Wt / 2 - w / 2 + 8, Ht - 42, txt, '#f4ecd8'); };
const doingOf = p => (p.doing ? `${p.doing.tool || ''} ${p.doing.what || ''}`.trim() : '');

// ---- the library: tall shelves, reading tables with green lamps; who is reading files or browsing the web ----
function drawLibrary(t) {
  const Wt = TROPHY_W, Ht = TROPHY_H, hits = [], L = T.places;
  r(0, 0, Wt, 132, '#3b2a22'); for (let x = 0; x < Wt; x += 32) r(x, 0, 1, 132, '#2e2019');
  const COLORS = ['#a8434f', '#3b5dc9', '#63c74d', '#feae34', '#7a5cff', '#2ce8f5', '#e8e2d6', '#b55088'];
  for (let i = 0; i < 6; i++) {
    const sx = 14 + i * 104, sw = 96; r(sx - 3, 8, sw + 6, 122, '#5a3a28'); r(sx, 10, sw, 118, '#2b1d16');
    for (let s = 0; s < 4; s++) {
      const by = 14 + s * 29; r(sx, by + 24, sw, 4, '#6b4a33');
      for (let x = sx + 2, n = 0; x < sx + sw - 4; n++) { const h = hash(`bk${i}:${s}:${n}`), bw = 3 + h % 3, bh = 16 + (h >>> 3) % 7; r(x, by + 24 - bh, bw, bh, COLORS[(h >>> 6) % COLORS.length]); r(x, by + 24 - bh + 3, bw, 1, '#00000033'); x += bw + ((h >>> 9) % 4 === 0 ? 2 : 0); }
    }
  }
  r(0, 132, Wt, Ht - 132, '#8a5a3c');
  for (let y = 132; y < Ht; y += 8) for (let x = ((y / 8) % 2) * 12; x < Wt; x += 24) { r(x, y, 12, 8, '#93613f'); r(x, y + 7, 24, 1, '#6e4630'); }
  r(150, 180, 340, 170, '#6e2433'); r(156, 186, 328, 158, '#8e3242'); for (let x = 166; x < 474; x += 12) r(x, 192, 6, 2, '#c9667a'), r(x, 336, 6, 2, '#c9667a');
  roomSign(Wt / 2, 136, L.library.toUpperCase(), '#1b1622', '#ffd84d');
  // a globe and an armchair in the corners
  r(586, 300, 14, 14, '#3b8bff'); r(590, 302, 6, 4, '#63c74d'); r(592, 314, 2, 10, '#c9a34a'); r(586, 324, 14, 3, '#6b4a33');
  r(560, 180, 34, 30, '#7a2e3a'); r(560, 176, 34, 8, '#a8434f'); r(556, 184, 6, 24, '#a8434f'); r(592, 184, 6, 24, '#a8434f');
  // reading tables, two seats each, filled by who is reading (files) or browsing (web) right now
  const tables = [[120, 210], [300, 210], [480, 210], [120, 300], [300, 300], [480, 300]];
  const readers = (data ? data.people : []).filter(p => !p.leaving && ['read', 'web'].includes(p.state)).slice(0, 12);
  readers.forEach((p, i) => {
    const [tx, ty] = tables[i >> 1], sx = tx + (i % 2 ? 46 : 8), sy = ty - 22;
    Art.drawFront(sx, sy, look(p.id), t, { legs: Art.LEGS_SIT, legsKey: 'sit' });
    hits.push({ x: sx - 2, y: sy - 4, w: 20, h: 34, id: p.id, title: `${p.name} · ${T.states[p.state] || p.state}${doingOf(p) ? '\n' + doingOf(p) : ''}` });
  });
  for (const [tx, ty] of tables) {
    r(tx - 2, ty - 2, 80, 20, PAL.ink); r(tx, ty, 76, 16, '#6b4a33'); r(tx, ty, 76, 3, '#8a6a4a'); r(tx + 4, ty + 16, 3, 12, '#4a3324'); r(tx + 69, ty + 16, 3, 12, '#4a3324');
    r(tx + 34, ty - 12, 2, 12, '#c9a34a'); r(tx + 28, ty - 16, 14, 5, '#2f8f4e'); r(tx + 30, ty - 11, 10, 2, '#ffe9a0'); // the green banker's lamp
    r(tx + 8, ty + 4, 12, 7, '#f4ecd8'); r(tx + 54, ty + 4, 12, 7, '#f4ecd8');
  }
  readers.forEach((p, i) => { const [tx, ty] = tables[i >> 1]; roomName(tx + (i % 2 ? 46 : 8), ty + 30, p.name); });
  if (!readers.length) roomEmpty(Wt, Ht, L.noReaders);
  viewHits = hits; drawRoomWalker(t);
}

// ---- the lab: benches of screens with scrolling output; who is running commands, tests or builds ----
function drawLab(t) {
  const Wt = TROPHY_W, Ht = TROPHY_H, hits = [], L = T.places;
  r(0, 0, Wt, 124, '#d8dde6'); r(0, 118, Wt, 6, '#aab3c2'); for (let x = 0; x < Wt; x += 40) r(x, 0, 1, 118, '#c7cdd8');
  r(0, 124, Wt, Ht - 124, '#9aa3b0'); for (let y = 124; y < Ht; y += 16) for (let x = ((y / 16) % 2) * 16; x < Wt; x += 32) r(x, y, 16, 16, '#a7b0bd');
  // the CI wall: a big screen with pipeline stages
  const runners = (data ? data.people : []).filter(p => !p.leaving && ['terminal', 'mcp'].includes(p.state)).slice(0, 12);
  r(170, 14, 300, 84, PAL.ink); r(174, 18, 292, 76, '#0c1410');
  pixText(184, 24, L.pipeline, '#62ff7a');
  ['BUILD', 'TEST', 'LINT', 'DEPLOY'].forEach((s, i) => { const on = runners.length && ((t / 600 + i) | 0) % 4 !== 3; r(184 + i * 70, 44, 60, 16, on ? '#1f7a48' : '#1b2a22'); pixText(190 + i * 70, 49, s, on ? '#d8ffe0' : '#3a5a48'); });
  for (let i = 0; i < 4; i++) r(184, 70 + i * 5, 40 + (hash('ci' + i + ((t / 900) | 0)) % 240), 2, '#2c6b44');
  roomSign(Wt / 2, 128, L.lab.toUpperCase(), '#1b1622', '#62ff7a');
  // shelves of equipment on the side walls
  for (const sx of [24, 506]) { r(sx, 20, 110, 90, '#c7cdd8'); for (let s = 0; s < 3; s++) { r(sx, 44 + s * 28, 110, 3, '#7a8494'); for (let k = 0; k < 5; k++) r(sx + 6 + k * 21, 30 + s * 28, 14, 14, ['#3b5dc9', '#e43b44', '#63c74d', '#feae34', '#7a5cff'][(k + s) % 5]); } }
  // benches: four stations each; an agent at a station sees its own output scroll on the screen
  const benches = [190, 270, 350];
  runners.forEach((p, i) => {
    const b = benches[(i / 4) | 0], sx = 100 + (i % 4) * 130, sy = b - 26;
    Art.drawFront(sx + 20, sy, look(p.id), t, { legs: Art.LEGS_SIT, legsKey: 'sit' });
    hits.push({ x: sx + 18, y: sy - 4, w: 20, h: 34, id: p.id, title: `${p.name} · ${T.states[p.state] || p.state}${doingOf(p) ? '\n' + doingOf(p) : ''}` });
  });
  for (const b of benches) {
    r(84, b - 2, 516, 18, PAL.ink); r(86, b, 512, 14, '#e8ecf2'); r(86, b, 512, 3, '#ffffff'); r(94, b + 14, 4, 14, '#7a8494'); r(586, b + 14, 4, 14, '#7a8494');
    for (let k = 0; k < 4; k++) {
      const sx = 100 + k * 130, i = benches.indexOf(b) * 4 + k, busy = !!runners[i];
      r(sx + 48, b - 22, 40, 22, PAL.ink); r(sx + 50, b - 20, 36, 18, busy ? '#0c1410' : '#1b1d2e');
      if (busy) for (let l = 0; l < 4; l++) r(sx + 52, b - 18 + l * 4, 6 + (hash('o' + i + l + ((t / 300) | 0)) % 28), 2, l === 3 ? '#62ff7a' : '#2c6b44');
      r(sx + 64, b, 4, 2, '#7a8494');
    }
  }
  runners.forEach((p, i) => roomName(100 + (i % 4) * 130 + 20, benches[(i / 4) | 0] + 18, p.name));
  if (!runners.length) roomEmpty(Wt, Ht, L.noRunners);
  viewHits = hits; drawRoomWalker(t);
}

// ---- the meeting room: a long table; an agent and the helpers it called sit together ----
function drawMeetingRoom(t) {
  const Wt = TROPHY_W, Ht = TROPHY_H, hits = [], L = T.places;
  r(0, 0, Wt, 130, '#2a3446'); for (let x = 0; x < Wt; x += 80) { r(x, 0, 3, 130, '#1b2230'); ctx.fillStyle = 'rgba(160,200,255,.08)'; ctx.fillRect(x + 6, 6, 70, 118); }
  r(0, 130, Wt, Ht - 130, '#4a5468'); for (let y = 130; y < Ht; y += 6) r(0, y, Wt, 1, '#434c5e');
  // the whiteboard and a screen
  r(60, 16, 220, 96, PAL.ink); r(63, 19, 214, 90, '#f4f4f0');
  pixText(74, 26, L.plan, '#3b5dc9'); for (let i = 0; i < 5; i++) { r(74, 40 + i * 12, 6, 6, i < 3 ? '#63c74d' : '#c0cbdc'); r(86, 42 + i * 12, 60 + (hash('wb' + i) % 110), 2, '#5a6270'); }
  r(360, 20, 220, 90, PAL.ink); r(363, 23, 214, 84, '#0c1830'); pixText(374, 30, L.helpersNow, '#7fb3e6');
  roomSign(Wt / 2, 134, L.meeting.toUpperCase(), '#1b1622', '#7fb3e6');
  // who meets: every agent working with helpers, then its helpers next to it
  const leads = (data ? data.people : []).filter(p => !p.leaving && (p.subagents || []).length);
  const seats = []; for (let i = 0; i < 7; i++) seats.push({ x: 130 + i * 56, y: 192, back: false }); for (let i = 0; i < 7; i++) seats.push({ x: 130 + i * 56, y: 268, back: true });
  const crowd = []; for (const p of leads) { crowd.push({ p, lead: true }); for (const a of p.subagents) crowd.push({ p, a }); }
  crowd.slice(0, seats.length).forEach((c, i) => {
    const s = seats[i], lk = look(c.a ? c.p.id + ':' + c.a.id : c.p.id);
    if (s.back) Art.drawSeatedBack(s.x, s.y, lk, t, {}); else Art.drawFront(s.x, s.y, lk, t, { legs: Art.LEGS_SIT, legsKey: 'sit' });
    hits.push({ x: s.x - 2, y: s.y - 4, w: 20, h: 32, id: c.p.id, who: c.a ? `${c.a.type} (${c.p.name})` : c.p.name, title: c.a ? `🤖 ${c.a.type}: ${c.a.description || ''}${c.a.doing ? '\n' + c.a.doing : ''}\n← ${c.p.name}` : `${c.p.name} · ${T.states[c.p.state] || c.p.state}` });
  });
  r(112, 214, 416, 50, PAL.ink); r(114, 216, 412, 46, '#6b4a33'); r(114, 216, 412, 4, '#8a6a4a'); for (let i = 0; i < 6; i++) r(140 + i * 66, 228, 14, 9, '#f4ecd8');
  crowd.slice(0, seats.length).forEach((c, i) => { const s = seats[i]; roomName(s.x, s.back ? s.y + 30 : s.y - 12, c.a ? c.a.type : c.p.name); });
  if (crowd.length) pixText(374, 46, L.meetCount(leads.length, crowd.length - leads.length), '#d8e6ff');
  if (!crowd.length) roomEmpty(Wt, Ht, L.noMeeting);
  viewHits = hits; drawRoomWalker(t);
}
