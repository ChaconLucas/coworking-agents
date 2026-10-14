'use strict';
// ---------------- the library, the lab and the waiting room on the office floor; walking inside the elevator rooms ----------------
// The agents stay at their desks. Walk into one of the three rooms under the game room and it shows who is doing that
// right now (measured from their state): reading or browsing (library), running commands (lab), waiting on you
// (waiting room). Enter next to someone opens them. The rooftop, trophy and server rooms can be walked in too.

// --- walking in a room: its floor, where you arrive, the door back ---
const ROOM_WALK = {
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


// ---- the three rooms on the office floor ----
const PLACE_STATES = { library: ['read', 'web'], lab: ['terminal', 'mcp'], waiting: ['needs_you', 'waiting'] };
let placeHits = [];
const placeOf = name => places.find(P => P.name === name);
function drawPlaceRooms(t, movers) {
  placeHits = [];
  for (const P of places) {
    const { x, y, w, h } = P, d = P.doors[0], L = T.places;
    // floor, walls with the door gap on top, a sign
    const floorC = P.name === 'library' ? ['#8a5a3c', '#93613f'] : P.name === 'lab' ? ['#9aa3b0', '#a7b0bd'] : ['#5a4a6e', '#64547a'];
    r(x, y, w, h, floorC[0]); for (let yy = y; yy < y + h; yy += 8) for (let xx = x + ((yy - y) / 8 % 2) * 8; xx < x + w; xx += 16) r(xx, yy, 8, 8, floorC[1]);
    r(x - 2, y - 2, w + 4, 3, PAL.ink); r(x - 2, y, 2, h + 2, PAL.ink); r(x + w, y, 2, h + 2, PAL.ink); r(x - 2, y + h, w + 4, 2, PAL.ink);
    r(d.x - 9, y - 2, 18, 3, floorC[1]); r(d.x - 9, y + 1, 18, 3, '#00000033'); // the open door
    if (P.name === 'library') { // shelves along the back wall, two reading tables with green lamps
      for (let i = 0; i < Math.floor((w - 12) / 34); i++) { const sx = x + 6 + i * 34; if (Math.abs(sx + 15 - d.x) < 22) continue; r(sx, y + 6, 30, 26, '#5a3a28'); for (let sh = 0; sh < 2; sh++) for (let k = 0; k < 6; k++) { const hh = hash(`pl${P.x}${i}${sh}${k}`); r(sx + 2 + k * 5, y + 8 + sh * 12 + (hh % 3), 4, 10 - (hh % 3), ['#a8434f', '#3b5dc9', '#63c74d', '#feae34', '#7a5cff', '#2ce8f5'][hh % 6]); } }
      for (const tx of [x + w * .18, x + w * .58]) { r(tx, y + 70, w * .26, 12, '#6b4a33'); r(tx, y + 70, w * .26, 2, '#8a6a4a'); r(tx + w * .13 - 1, y + 62, 2, 8, '#c9a34a'); r(tx + w * .13 - 5, y + 59, 10, 4, '#2f8f4e'); }
    } else if (P.name === 'lab') { // a CI screen on the back wall, two benches of monitors
      r(x + w / 2 - 40, y + 6, 80, 24, PAL.ink); r(x + w / 2 - 38, y + 8, 76, 20, '#0c1410'); pixText(x + w / 2 - 34, y + 11, 'CI', '#62ff7a');
      ['B', 'T', 'L'].forEach((c, i) => { const on = ((t / 600 + i) | 0) % 3 !== 2; r(x + w / 2 - 20 + i * 18, y + 18, 14, 7, on ? '#1f7a48' : '#1b2a22'); });
      for (const by of [y + 58, y + 92]) { r(x + 10, by, w - 20, 8, '#e8ecf2'); r(x + 10, by, w - 20, 2, '#ffffff'); for (let k = 0; k < 3; k++) { const mx = x + 22 + k * (w - 44) / 3; r(mx, by - 10, 16, 10, PAL.ink); r(mx + 1, by - 9, 14, 8, '#0c1410'); r(mx + 3, by - 7, 4 + hash('lm' + k + by + ((t / 400) | 0)) % 9, 1, '#62ff7a'); } }
    } else { // the waiting room: two phone booths with a red light, a bench
      for (const bx of [x + 10, x + w - 34]) { r(bx, y + 8, 24, 44, '#3a2a4a'); r(bx + 2, y + 12, 20, 38, '#8fc7ff55'); r(bx + 8, y + 6, 8, 3, ((t / 400) | 0) % 2 ? '#ff4d57' : '#5a0f16'); }
      r(x + w * .25, y + 88, w * .5, 6, '#6b4a33'); r(x + w * .25, y + 94, 3, 8, '#4a3324'); r(x + w * .75 - 3, y + 94, 3, 8, '#4a3324');
    }
    const label = plain(L[P.name]), lw = label.length * 4 + 8; r(x + 6, y + h - 12, lw, 9, '#00000088'); pixText(x + 10, y + h - 10, label, '#f4ecd8');
    // inside, you see who is doing this right now (the agents themselves stay at their desks)
    const here = playerOn && me.ready && me.x + 8 > x && me.x + 8 < x + w && me.y + 12 > y && me.y + 12 < y + h;
    const who = (data ? data.people : []).filter(p => !p.leaving && PLACE_STATES[P.name].includes(p.state));
    if (!here) { if (who.length) { const n = String(who.length); r(x + w - 18, y + h - 13, 14, 11, PAL.ink); r(x + w - 17, y + h - 12, 12, 9, P.name === 'waiting' ? '#e43b44' : '#1b1622'); pixText(x + w - 14 - (n.length - 1) * 2, y + h - 10, n, '#ffffff'); } continue; }
    const cols = Math.max(1, Math.floor((w - 20) / 34)), seats = [];
    for (let i = 0; i < who.length && seats.length < cols * 2; i++) seats.push({ x: x + 14 + (i % cols) * 34, y: y + (i < cols ? 44 : 78) - 4 });
    who.slice(0, seats.length).forEach((p, i) => {
      const st = seats[i], lk = look(p.id);
      movers.push({ y: st.y, draw: () => { Art.drawFront(st.x, st.y, lk, t, { legs: Art.LEGS_SIT, legsKey: 'sit' }); const nm = plain(p.name).slice(0, 8), nw = nm.length * 4 + 4; r(st.x + 8 - nw / 2, st.y + 26, nw, 7, '#000000aa'); pixText(st.x + 10 - nw / 2, st.y + 27, nm, '#f4ecd8'); } });
      placeHits.push({ x: st.x, y: st.y, id: p.id, name: p.name, need: P.name === 'waiting' });
    });
    if (!who.length) { const e = plain(L['no_' + P.name]), ew = e.length * 4 + 8; r(x + w / 2 - ew / 2, y + h / 2 - 5, ew, 10, '#00000088'); pixText(x + w / 2 - ew / 2 + 4, y + h / 2 - 3, e, '#f4ecd8'); }
  }
}
// a click on someone you see in one of these rooms opens them
overlay.addEventListener('click', e => {
  if (trophyView || !placeHits.length) return;
  const rc = overlay.getBoundingClientRect(), x = (e.clientX - rc.left) / S, y = (e.clientY - rc.top) / S;
  const h = placeHits.find(h => x >= h.x && x <= h.x + 16 && y >= h.y - 2 && y <= h.y + 26); if (!h) return;
  e.stopImmediatePropagation(); h.need && typeof openTalk === 'function' ? openTalk(h.id) : showPerson(h.id);
}, true);
