'use strict';
// ---------------- floor plan ----------------
// Each repository is a room with its agents' desks; rooms sit in rows on the left.
// On the right, a shared wing: kitchen, ping-pong, meeting room and nap corner.
// With many rooms, the office gains floors (each floor has its own shared wing).
const TOP = 58, CELL_W = 100, CELL_H = 96, RW = 148, ROOM_PAD = 6, ROOM_HEAD = 14, SHELF_GAP = 14, MAX_SHELVES = 4, ROOM_MAX = 9, MAX_PER_FLOOR = 24;
const cv = document.getElementById('cv');
const mainCtx = cv.getContext('2d');
let ctx = mainCtx; // switched to the thumbnail canvas while drawing another floor
Art.setCtx(ctx);
const overlay = document.getElementById('overlay');
let S = 3, W = 480, H = 300, CX = 320, RX = 330;
let game = null, data = null, selected = null, layout = [], desks = [], rooms = [], floors = [], floor = 0, spots = null, hallBox = null, boardBox = null, wing = null, floorStates = [], building = false;

function rawRoomKey(p) {
  if (p.repo && p.repo.name) return p.repo.name;
  const base = (p.cwd || '').split('/').filter(Boolean).pop();
  return base ? '~' + base : '—';
}
// sticky: a quick `cd` elsewhere doesn't move anyone; they change rooms after a minute in the new place
const ROOM_STICK_MS = 60000;
const stickyRoom = new Map();
function roomKey(p) {
  const now = Date.now(), raw = rawRoomKey(p);
  let s = stickyRoom.get(p.id);
  if (!s) { s = { key: raw, pending: null, since: 0 }; stickyRoom.set(p.id, s); }
  if (raw === s.key) s.pending = null;
  else if (s.pending !== raw) { s.pending = raw; s.since = now; }
  else if (now - s.since > ROOM_STICK_MS) { s.key = raw; s.pending = null; }
  return s.key;
}

function planFloors(people, leftW) {
  // group by repository; stable order by name
  const groups = new Map();
  for (const p of people) { const k = roomKey(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  const maxCols = Math.max(1, Math.floor((leftW - ROOM_PAD * 2) / CELL_W));
  // a room with more than 9 agents splits into several (api 1, api 2…) so no floor gets too long
  const chunks = [];
  for (const [name, ps] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (ps.length <= ROOM_MAX) { chunks.push([name, ps]); continue; }
    for (let k = 0; k < ps.length; k += ROOM_MAX) chunks.push([`${name} ${k / ROOM_MAX + 1}`, ps.slice(k, k + ROOM_MAX)]);
  }
  const list = chunks.map(([name, ps]) => {
    // rooms fit their team exactly: one desk per agent (new desks get built when someone arrives)
    const cols = Math.min(maxCols, Math.max(1, Math.min(3, ps.length))), seats = ps.length;
    return { name, people: ps, cols, seats, rows: Math.ceil(seats / cols), w: cols * CELL_W + ROOM_PAD * 2 };
  });
  // pack rooms into rows (shelves) and rows into floors
  const out = [];
  let cur = { shelves: [] }, shelf = null;
  for (const room of list) {
    // a new floor when the current one has no room left: too many shelves or too many people
    const onFloor = cur.shelves.reduce((n, sh) => n + sh.rooms.reduce((m, r) => m + r.people.length, 0), 0);
    if (cur.shelves.length && onFloor + room.people.length > MAX_PER_FLOOR) { out.push(cur); cur = { shelves: [] }; shelf = null; }
    if (!shelf || shelf.used + room.w > leftW) {
      if (cur.shelves.length >= MAX_SHELVES) { out.push(cur); cur = { shelves: [] }; }
      shelf = { rooms: [], used: 0 };
      cur.shelves.push(shelf);
    }
    shelf.rooms.push(room); shelf.used += room.w + 8;
  }
  if (cur.shelves.length || !out.length) out.push(cur);
  return out;
}

// last known rectangle of each room, to animate rooms being built or extended
const roomRects = new Map();
let roomsSeen = false;

function relayout() {
  const stage = document.getElementById('stage');
  const availW = Math.min((stage.clientWidth || document.documentElement.clientWidth - 32) - 4, 2400); // hidden (building view) measures 0
  // with several rooms, shrink the scale so two fit side by side; with just one, keep it big
  const groups = new Set((data ? data.people : []).map(roomKey)).size;
  const s0 = Math.max(1.6, Math.min(3, availW / (groups > 1 ? 840 : 520)));
  W = Math.max(480, Math.min(920, Math.floor(availW / s0)));
  CX = W - RW - 14; RX = CX + 10;
  const leftW = CX - 12;
  floors = planFloors(data ? data.people : [], leftW);
  if (floor >= floors.length) floor = floors.length - 1;
  // every floor (the building view draws the others as thumbnails)
  floorStates = floors.map((_, i) => buildFloor(i));
  // shared wing
  wing = { copa: TOP, ping: TOP + 112, meet: TOP + 184, nap: TOP + 290, servers: TOP + 378, bottom: TOP + 434 };
  spots = {
    sofa: [0, 1, 2, 3].map(i => ({ x: RX + 12 + i * 19, y: TOP + 50, zone: 'lounge', pose: 'sit' })),
    stools: [{ x: RX + 104, y: TOP + 56, zone: 'lounge', pose: 'stand' }, { x: RX + 126, y: TOP + 56, zone: 'lounge', pose: 'stand' }],
    coffee: [{ x: RX + 48, y: TOP + 14, zone: 'lounge', pose: 'stand' }, { x: RX + 66, y: TOP + 16, zone: 'lounge', pose: 'stand' }],
    ping: [{ x: RX + 8, y: wing.ping + 16, zone: 'ping', pose: 'stand' }, { x: RX + RW - 22, y: wing.ping + 16, zone: 'ping', pose: 'stand', flip: true }],
    meetTop: [0, 1, 2].map(i => ({ x: RX + 32 + i * 32, y: wing.meet + 16, zone: 'meet', pose: 'sit' })),
    meetBot: [0, 1, 2].map(i => ({ x: RX + 32 + i * 32, y: wing.meet + 54, zone: 'meet', pose: 'back' })),
    // overflow: standing along the walls of the glass room
    meetStand: [[RX + 4, 40], [RX + 128, 40], [RX + 4, 66], [RX + 128, 66], [RX + 16, 76], [RX + 116, 76], [RX + 66, 2], [RX + 92, 2]].map(([x, dy]) => ({ x, y: wing.meet + dy, zone: 'meet', pose: 'stand' })),
    nap: [{ x: RX + 8, y: wing.nap + 30 }, { x: RX + 46, y: wing.nap + 46 }, { x: RX + 84, y: wing.nap + 30 }].map(p => ({ ...p, zone: 'nap' })),
  };
  for (const f of floorStates) f.H = Math.max(f.bottom, wing.bottom) + 6;
  const now = Date.now();
  for (const f of floorStates) for (const R of f.rooms) {
    const prev = roomRects.get(R.name);
    const arrived = R.people.some(p => (arrivals.get(p.id) || 0) > now - 3000);
    if (!prev && roomsSeen && arrived) R.anim = { from: { x: R.doorX, y: R.y + R.h - 4, w: 18, h: 4 }, at: now, fresh: true };
    else if (prev && arrived && (prev.w !== R.w || prev.h !== R.h)) R.anim = { from: prev, at: now };
    roomRects.set(R.name, { x: R.x, y: R.y, w: R.w, h: R.h });
  }
  roomsSeen = !!(data && data.people.length);
  useFloor(floor);
  fitScale();
  renderFloors();
}

function buildFloor(i) {
  const rs = [], ds = [];
  let y = TOP + 4;
  for (const shelf of floors[i].shelves) {
    let x = 8, shelfH = 0;
    for (const room of shelf.rooms) {
      const h = ROOM_HEAD + room.rows * CELL_H + 4;
      const R = { ...room, x, y, h, doorX: x + Math.round(room.w / 2) - 9 };
      for (let k = 0; k < room.seats; k++) {
        const dx = x + ROOM_PAD + (k % room.cols) * CELL_W, dy = y + ROOM_HEAD + ((k / room.cols) | 0) * CELL_H;
        ds.push({ p: R.people[k] || null, room: R, x: dx, y: dy, chair: { x: dx + CELL_W / 2 - 8, y: dy + 38 }, aisle: dy + 72 });
      }
      rs.push(R);
      x += room.w + 8; shelfH = Math.max(shelfH, h);
    }
    y += shelfH + SHELF_GAP;
  }
  // the game room fills the width under the team rooms, door on its right wall to the corridor
  const GH = 128, game = { x: 8, y: y + 4, w: CX - 20, h: GH, doorY: y + 4 + GH / 2 };
  y += GH + SHELF_GAP + 4;
  const occupied = ds.filter(d => d.p);
  const lay = occupied.map(d => Object.assign({}, d));
  lay.forEach((c, k) => { occupied[k].cell = c; });
  return { rooms: rs, desks: ds, layout: lay, bottom: y, H: 0, game };
}

function useFloor(i) {
  const f = floorStates[i];
  rooms = f.rooms; desks = f.desks; layout = f.layout; H = f.H; game = f.game;
}

function fitScale() {
  const stage = document.getElementById('stage');
  const availW = Math.min((stage.clientWidth || document.documentElement.clientWidth - 32) - 4, 2400); // hidden (building view) measures 0
  // the trophy room is its own screen with a fixed size
  const w = trophyView ? TROPHY_W : W, h = trophyView ? TROPHY_H : H;
  S = Math.max(1.5, Math.floor(Math.min(availW / w, 4) * 4) / 4);
  cv.width = w; cv.height = h;
  cv.style.width = w * S + 'px'; cv.style.height = h * S + 'px';
  ctx.imageSmoothingEnabled = false;
  // small scale: the badge shows name and state; the title goes in the tooltip
  document.getElementById('office').classList.toggle('compact', S < 2.25);
}

// floor picker (only shown with more than one floor)
function renderFloors() {
  let bar = document.getElementById('floors');
  if (!bar) { bar = document.createElement('nav'); bar.id = 'floors'; bar.className = 'floors'; document.getElementById('stage').before(bar); bar.addEventListener('click', e => { if (e.target.closest('[data-building]')) return setBuilding(!building); const b = e.target.closest('[data-floor]'); if (b) goFloor(+b.dataset.floor); }); }
  if (floors.length < 2) { bar.hidden = true; if (building) setBuilding(false); return; }
  bar.hidden = false;
  // elevator panel: round lit buttons with the floor number, room names underneath
  bar.innerHTML = `<button class="lift-bld ${building ? 'on' : ''}" data-building="1"><svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M3 1h10v14H3zM5 3v2h2V3zm4 0v2h2V3zM5 7v2h2V7zm4 0v2h2V7zm-2 4v4h2v-4z"/></svg><span>${esc(T.building)}</span></button><span class="lift-sep"></span>` + floors.map((f, i) => {
    const ps = f.shelves.flatMap(s => s.rooms.flatMap(r => r.people));
    const need = ps.filter(p => p.state === 'needs_you' || p.state === 'waiting').length;
    const names = f.shelves.flatMap(s => s.rooms.map(r => r.name));
    return `<button class="lift ${i === floor && !building ? 'on' : ''}" data-floor="${i}" title="${esc(T.floor(i + 1) + ': ' + names.join(', '))}"><b>${i + 1}</b><span>${esc(names.slice(0, 2).join(' · '))}${names.length > 2 ? ' +' + (names.length - 2) : ''}</span>${need ? `<i class="dot">${need}</i>` : ''}</button>`;
  }).join('');
}

function goFloor(i) { if (i < 0 || i >= floors.length) return; floor = i; setBuilding(false); lastLayoutKey = ''; renderAll(); }
function floorOf(id) { return floors.findIndex(f => f.shelves.some(s => s.rooms.some(r => r.people.some(p => p.id === id)))); }
