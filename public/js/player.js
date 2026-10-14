'use strict';
// ---------------- you, walking around the office (Gather-style) ----------------
// Arrow keys move you; a click on the floor walks you there through the doors. Walls stop you except at
// doors. Near an agent, a prop or a door, Enter does the thing (talk, open the tab, enter the trophy room).
let playerOn = store.get('player', true) !== false;
const me = { x: 0, y: 0, path: [], flip: false, ready: false, moving: false };
const keysDown = new Set();
const PLAYER_SPEED = 70;

// rooms you can't walk through, each with its door(s). You collide by your feet (the bottom middle of your sprite),
// so walls stop you where they are drawn; a door lets your feet through.
const FEET_X = 8, FEET_Y = 21;
const feet = p => ({ x: p.x + FEET_X, y: p.y + FEET_Y });
function solidRooms() {
  const out = rooms.map(R => ({ x: R.x, y: R.y, w: R.w, h: R.h, doors: [{ x: R.doorX + 9, y: R.y + R.h, side: 'bottom' }], gap: 9 }));
  if (game) out.push({ x: game.x, y: game.y, w: game.w, h: game.h, doors: game.doors, gap: 9 });
  for (const P of places) out.push({ x: P.x, y: P.y, w: P.w, h: P.h, doors: P.doors, gap: 9 });
  if (wing && spots) { // the right wing: the glass meeting room and the rest room open on the corridor, the servers don't
    out.push({ x: RX - 2, y: wing.meet, w: RW + 4, h: 98, doors: [{ x: RX - 2, y: wing.meet + 41, side: 'left' }], gap: 8 });
    out.push({ x: RX - 4, y: wing.nap, w: RW + 8, h: 80, doors: [{ x: RX - 4, y: wing.nap + 37, side: 'left' }], gap: 8 });
    out.push({ x: RX - 2, y: wing.servers - 4, w: RW + 4, h: 58, doors: [], gap: 0 });
  }
  return out;
}
const inside = (R, p) => p.x > R.x && p.x < R.x + R.w && p.y > R.y && p.y < R.y + R.h;
const roomOf = p => { const f = feet(p); return solidRooms().find(R => inside(R, f)) || null; };
// a step from a to b is blocked when your feet cross a room's wall anywhere but its door, or leave the floor
function blocked(a, b) {
  const roomsNow = solidRooms();
  for (const dx of [-5, 0, 5]) { // your feet are about 10 px wide: both sides stop at a wall, not only the middle
    const fa = { x: a.x + FEET_X + dx, y: a.y + FEET_Y }, fb = { x: b.x + FEET_X + dx, y: b.y + FEET_Y };
    for (const R of roomsNow) {
      if (inside(R, fa) === inside(R, fb)) continue;
      const through = R.doors.some(d => (d.side === 'top' || d.side === 'bottom') ? Math.abs(fb.x - d.x) <= R.gap + 5 && Math.abs(fb.y - d.y) <= 8 : Math.abs(fb.y - d.y) <= R.gap && Math.abs(fb.x - d.x) <= 8);
      if (!through) return true;
    }
  }
  const fb = feet(b);
  return fb.x < 8 || fb.x > W - 8 || fb.y < TOP + 4 || fb.y > H - 2;
}
// [inside, outside] of the door of R closest to a point, as positions for you (top-left of the sprite)
function doorPoints(R, near) {
  const d = R.doors.slice().sort((p, q) => Math.hypot(p.x - near.x, p.y - near.y) - Math.hypot(q.x - near.x, q.y - near.y))[0];
  const at = (x, y) => ({ x: x - FEET_X, y: y - FEET_Y });
  return d.side === 'bottom' ? [at(d.x, d.y - 8), at(d.x, d.y + 8)] : d.side === 'top' ? [at(d.x, d.y + 8), at(d.x, d.y - 8)] : d.side === 'right' ? [at(d.x - 8, d.y), at(d.x + 8, d.y)] : [at(d.x + 8, d.y), at(d.x - 8, d.y)];
}
// path through doors: out of my room, along the corridor, into the target's room
function planWalk(to) {
  const from = { x: me.x, y: me.y }, A = roomOf(from), B = roomOf(to);
  if (A === B || (A && B && A.x === B.x && A.y === B.y)) return [to];
  const path = [];
  if (A) { const [i, o] = doorPoints(A, B ? { x: B.x + B.w / 2, y: B.y + B.h / 2 } : feet(to)); path.push(i, o); }
  const start = path.length ? path[path.length - 1] : from;
  const endDoor = B ? doorPoints(B, feet(start)) : null, entry = endDoor ? endDoor[1] : to;
  path.push({ x: CX - 2 - FEET_X, y: start.y }, { x: CX - 2 - FEET_X, y: entry.y });
  if (B) path.push(endDoor[1], endDoor[0]);
  path.push(to);
  return path;
}

function updatePlayer(dt) {
  if (!playerOn || !data || trophyView) { placePlayerTag(); if (typeof gatherFollow === 'function') gatherFollow(); return; } // leaving Gather resets the camera
  if (!me.ready || me.y > H) { Object.assign(me, { x: CX - 8, y: H - 24, ready: true }); }
  let dx = 0, dy = 0;
  const k = c => keysDown.has(c);
  if (k('ArrowLeft') || k('a')) dx--; if (k('ArrowRight') || k('d')) dx++; if (k('ArrowUp') || k('w')) dy--; if (k('ArrowDown') || k('s')) dy++;
  me.moving = false;
  if (dx || dy) {
    me.path = [];
    const len = Math.hypot(dx, dy), step = PLAYER_SPEED * (keysDown.has('Shift') ? 2 : 1) * dt, nx = me.x + dx / len * step, ny = me.y + dy / len * step;
    // slide along walls: try both axes, then each one
    if (!blocked(me, { x: nx, y: ny })) { me.x = nx; me.y = ny; me.moving = true; }
    else if (!blocked(me, { x: nx, y: me.y })) { me.x = nx; me.moving = true; }
    else if (!blocked(me, { x: me.x, y: ny })) { me.y = ny; me.moving = true; }
    if (dx) me.flip = dx < 0;
  } else if (me.path.length) {
    let step = PLAYER_SPEED * 1.4 * dt;
    while (step > 0 && me.path.length) {
      const w = me.path[0], ddx = w.x - me.x, ddy = w.y - me.y, d = Math.hypot(ddx, ddy);
      if (d <= step) { me.x = w.x; me.y = w.y; step -= d; me.path.shift(); }
      else { me.x += ddx / d * step; me.y += ddy / d * step; if (Math.abs(ddx) > .5) me.flip = ddx < 0; step = 0; }
    }
    me.moving = true;
  }
  if (me.moving && !(typeof gatherActive === 'function' && gatherActive())) followPlayer();
  placePlayerTag();
  if (typeof gatherFollow === 'function') gatherFollow();
}
// the page scrolls to keep you on screen
function followPlayer() {
  const rc = cv.getBoundingClientRect(), py = rc.top + me.y * S, bar = 130;
  if (py > innerHeight - 80) scrollBy({ top: py - (innerHeight - 160), behavior: 'auto' });
  else if (py < bar) scrollBy({ top: py - bar - 60, behavior: 'auto' });
}
function drawPlayer(t, movers) {
  if (!playerOn || !data || trophyView) return;
  const lk = youLook();
  movers.push({ y: me.y, draw: () => {
    ctx.fillStyle = 'rgba(255,216,77,.35)'; ctx.fillRect(me.x + 1, me.y + 21, 14, 3); // a ring at your feet
    Art.drawStanding(me.x, me.y, lk, t, me.moving); drawOutfit(me.x, me.y - 2);
  } });
}

// what's near you, and what Enter does there
function nearThing() {
  if (!playerOn || !data || trophyView) return null;
  const c = { x: me.x + 8, y: me.y + 12 }, near = (x, y, r2 = 22) => Math.hypot(x - c.x, y - c.y) < r2;
  for (const cell of layout) {
    const a = cell.actor; if (!a) continue;
    const ax = (a.mode === 'desk' ? cell.chair.x : a.x) + 8, ay = (a.mode === 'desk' ? cell.chair.y : a.y) + 12;
    if (near(ax, ay)) return { label: T.walk.talk(cell.p.name), run: () => (achBump('talks'), cell.p.state === 'needs_you' || cell.p.state === 'waiting' ? openTalk(cell.p.id) : showPerson(cell.p.id)) };
  }
  for (const g of gameHits) if (near(g.x + g.w / 2, g.y + g.h, 24)) return { label: g.title, run: () => { const m = /data-tab="(\w+)"/.exec(g.attr); if (m) openReport(m[1]); else if (/trophyroom/.test(g.attr)) setTrophyView(true); else if (/arcade/.test(g.attr)) openArcade(); } };
  if (typeof officeTips === 'function') { const o = officeTips(); for (const [b, tab, label] of [[boardBox, 'tasks', o.tasks], [costBox, 'usage', o.costs], [noticesBox, 'notices', o.notices], [historyBox, 'feed', o.history], [releaseBox, 'version', o.releases]]) if (b && near(b.x + b.w / 2, b.y + b.h + 14, 26)) return { label: label.split('\n')[0], run: () => openReport(tab) }; }
  for (const h of (typeof placeHits !== 'undefined' ? placeHits : [])) if (near(h.x + 8, h.y + 12, 22)) return { label: T.walk.talk(h.name), run: () => (h.need ? openTalk(h.id) : showPerson(h.id)) };
  if (radioBox && near(radioBox.x + 7, radioBox.y + 20, 26)) return { label: radioOn ? T.radio.on : T.radio.off, run: () => setRadio(!radioOn) };
  if (catBox && near(cat.x + 6, cat.y + 6, 18)) return { label: T.walk.pet, run: petCat };
  if (elevatorBox && near(elevatorBox.x + 14, elevatorBox.y + 30, 22)) return { label: T.elevator.title, run: openElevator };
  if (clockBox && near(clockBox.x + 5, clockBox.y + 14, 24)) return { label: T.clockIn, run: () => document.querySelector('[data-clock]') && document.querySelector('[data-clock]').click() };
  return null;
}
// the name tag and the Enter hint are two fixed elements moved every frame (no overlay rebuild)
const meTag = document.createElement('span'), meHint = document.createElement('span');
meTag.className = 'me-tag'; meHint.className = 'me-hint'; meTag.hidden = meHint.hidden = true;
overlay.appendChild(meTag); overlay.appendChild(meHint);
let lastHint = '';
function placePlayerTag() {
  const on = playerOn && data && !trophyView && me.ready;
  meTag.hidden = !on; if (!on) { meHint.hidden = true; return; }
  meTag.textContent = T.walk.you;
  meTag.style.left = (me.x + 8) * S + 'px'; meTag.style.top = (me.y - 4) * S + 'px';
  const n = nearThing(), label = n ? n.label.split('\n')[0] : '';
  meHint.hidden = !n;
  if (label !== lastHint) { lastHint = label; meHint.innerHTML = `<b>Enter ↵</b> ${esc(label)}`; }
  if (n) { meHint.style.left = (me.x + 8) * S + 'px'; meHint.style.top = (me.y + 30) * S + 'px'; }
}
const playerTag = () => '';

document.addEventListener('keydown', e => {
  if (!playerOn || trophyView || !reportEl.hidden || !searchEl.hidden) return;
  if (document.querySelector('.talk:not([hidden])')) return;
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea') return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === 'Shift') { if (!keysDown.has('Shift') && !e.repeat) achBump('sprints'); keysDown.add('Shift'); }
  if (key.startsWith('Arrow') || (!e.metaKey && !e.ctrlKey && !e.altKey && 'wasd'.includes(key) && key.length === 1)) {
    keysDown.add(key); e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) achBump('steps');
  }
  if (e.key === 'Enter') { const n = nearThing(); if (n) { e.preventDefault(); n.run(); } }
}, true);
document.addEventListener('keyup', e => { keysDown.delete(e.key); keysDown.delete(e.key.toLowerCase()); });
addEventListener('blur', () => keysDown.clear());
// a click on bare floor walks you there
overlay.addEventListener('click', e => {
  if (!playerOn || trophyView || e.target.closest('button,[data-id],[data-hall],.desk-hit,.hit,.tag')) return;
  const rc = overlay.getBoundingClientRect(), x = (e.clientX - rc.left) / S - 8, y = (e.clientY - rc.top) / S - 14;
  if (catBox && x + 8 >= catBox.x && x + 8 <= catBox.x + catBox.w && y + 14 >= catBox.y && y + 14 <= catBox.y + catBox.h) return; // that's petting
  if (y < TOP - 6) return;
  me.path = planWalk({ x, y }); achBump('steps');
});
function setPlayer(on) { playerOn = on; store.set('player', on); if (data) { lastLayoutKey = ''; renderAll(); renderBar(); renderOverlay(); } }
