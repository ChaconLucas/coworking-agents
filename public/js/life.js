'use strict';
// ---------------- life in the office: breaks, lunch, games, celebrations, desk details, night shift ----------------
// Everything here dresses up a measured state, never invents one: coffee and celebrations follow a long
// task that ended, lunch and games are for agents already idle, the phone rings for a real request.
const nowHour = () => qs.get('hour') ? Number(qs.get('hour')) : new Date().getHours() + new Date().getMinutes() / 60;
const isLunch = () => { const h = nowHour(); return h >= 12 && h < 13.5; };

// ---- long tasks: when a session worked 30+ min and finished, it goes for a coffee; 10+ min, it celebrates ----
const busySince = new Map(), coffeeUntil = new Map(), celebrate = new Map();
function noteLife(p, before) {
  const busy = s => !['idle', 'asleep', 'needs_you', 'waiting'].includes(s);
  if (busy(p.state) && !busySince.has(p.id)) busySince.set(p.id, Date.now() - ((p.doing && p.doing.for) || 0));
  if (before && busy(before) && p.state === 'idle' && busySince.has(p.id)) {
    const took = Date.now() - busySince.get(p.id);
    if (took >= 10 * 60000) { celebrate.set(p.id, Date.now()); achBump('celebrations'); }
    if (took >= 30 * 60000) coffeeUntil.set(p.id, Date.now() + 90000);
  }
  if (!busy(p.state)) busySince.delete(p.id);
}
const celebrating = id => { const at = celebrate.get(id); return at && Date.now() - at < 5000 ? Date.now() - at : 0; };
function celebrateJump(id, t) { const k = celebrating(id); return k ? -Math.abs(Math.round(Math.sin(k / 120) * 4)) : 0; }

// ---- extra spots for idle agents: foosball and the water cooler (in the dev corner, when there's room) ----
let devSpots = null; // foosball and water cooler spots, set by drawGameRoom each frame
function lifeAssign(lounge, assign) {
  // lounge = idle agents not yet placed; coffee first for whoever just finished a long task
  const rest = [];
  for (const c of lounge) {
    if ((coffeeUntil.get(c.p.id) || 0) > Date.now() && !assign.has(c.p.id)) { const s = spots.coffee.find(s => ![...assign.values()].includes(s)); if (s) { assign.set(c.p.id, s); continue; } }
    rest.push(c);
  }
  if (devSpots && devSpots.foos && rest.length >= 2) { assign.set(rest[0].p.id, devSpots.foos[0]); assign.set(rest[1].p.id, devSpots.foos[1]); rest.splice(0, 2); }
  if (devSpots && devSpots.cooler && rest.length >= 2) { assign.set(rest[0].p.id, devSpots.cooler[0]); assign.set(rest[1].p.id, devSpots.cooler[1]); rest.splice(0, 2); }
  return rest;
}

// ---- dev corner items: foosball, water cooler, aquarium, pool table ----
function drawFoosball(x, y, t, playing) {
  r(x + 2, y + 22, 40, 3, '#00000030');
  r(x - 1, y - 1, 42, 22, PAL.ink); r(x, y, 40, 20, '#6b4a33'); r(x + 2, y + 2, 36, 16, '#2f8f46');
  r(x + 19, y + 2, 2, 16, '#ffffff66'); r(x + 2, y + 8, 2, 4, '#ffffff'); r(x + 36, y + 8, 2, 4, '#ffffff');
  for (let k = 0; k < 4; k++) { const rx = x + 7 + k * 9, off = playing ? Math.round(Math.sin(t / 150 + k) * 2) : 0; r(rx, y - 3, 1, 26, '#c0cbdc'); for (let m = 0; m < 2; m++) r(rx - 1, y + 5 + m * 7 + off, 3, 3, k % 2 ? '#e43b44' : '#3b5dc9'); }
  if (playing) { const bx = x + 4 + Math.round((Math.sin(t / 260) + 1) * 15), by = y + 9 + Math.round(Math.sin(t / 170) * 5); r(bx, by, 2, 2, '#ffffff'); }
  r(x + 3, y + 20, 3, 6, PAL.ink); r(x + 34, y + 20, 3, 6, PAL.ink);
}
function drawCooler(x, y, t) {
  r(x, y + 10, 10, 16, PAL.ink); r(x + 1, y + 11, 8, 14, '#e8e8f0'); r(x + 2, y + 15, 3, 2, '#3b5dc9');
  r(x + 1, y - 1, 8, 12, PAL.ink); r(x + 2, y, 6, 10, '#7fd3f5aa'); r(x + 3, y + 2 + ((t / 900) | 0) % 6, 1, 1, '#ffffff');
}
function drawAquarium(x, y, t, glows) {
  r(x - 1, y - 1, 32, 22, PAL.ink); r(x, y, 30, 20, '#1e6fa8'); r(x, y, 30, 3, '#4fa3d8'); r(x, y + 16, 30, 4, '#c9a86b');
  for (let k = 0; k < 3; k++) r(x + 4 + k * 9, y + 10, 1, 6, '#2f8f46'), r(x + 5 + k * 9, y + 12, 1, 4, '#3a8f46');
  const owned = typeof prog !== 'undefined' ? achCount('fishFed') : 0;
  for (let i = 0; i < 3 + Math.min(3, owned); i++) { const fx = x + 2 + Math.round((Math.sin(t / (900 + i * 170) + i) + 1) * 12), fy = y + 4 + (i * 3) % 10, dir = Math.cos(t / (900 + i * 170) + i) > 0; r(fx, fy, 3, 2, ['#feae34', '#ff6ec7', '#ffd84d', '#ffffff', '#e43b44', '#63c74d'][i]); r(dir ? fx - 1 : fx + 3, fy, 1, 2, '#f77622'); }
  if (((t / 400) | 0) % 5 === 0) r(x + 22, y + 3 + ((t / 100) | 0) % 10, 1, 1, '#ffffffaa');
  r(x + 2, y + 21, 26, 6, '#6b4a33'); r(x + 2, y + 21, 26, 1, '#8f6a4a');
  glows.push({ x: x + 15, y: y + 10, r: 24, c: '#2ce8f5' });
}
function drawPool(x, y) {
  r(x + 2, y + 26, 56, 3, '#00000030');
  r(x - 1, y - 1, 58, 28, PAL.ink); r(x, y, 56, 26, '#6b4a33'); r(x + 3, y + 3, 50, 20, '#1f7a4a');
  for (const [hx, hy] of [[3, 3], [27, 3], [51, 3], [3, 21], [27, 21], [51, 21]]) r(x + hx, y + hy, 2, 2, PAL.ink);
  [['#ffffff', 12, 12], ['#e43b44', 34, 10], ['#ffd84d', 38, 13], ['#3b5dc9', 36, 16], ['#1b1622', 41, 12]].forEach(([c, bx, by]) => r(x + bx, y + by, 2, 2, c));
  r(x + 2, y + 26, 3, 5, PAL.ink); r(x + 51, y + 26, 3, 5, PAL.ink);
}

// ---- desk details ----
// the plant on a desk grows with the session's age and wilts when it has been asleep for a day
function drawGrowingPlant(x, y, p) {
  if (!p) return Art.drawPlant(x, y, false);
  const days = (data.now - p.startedAt) / 864e5, wilted = p.state === 'asleep' && data.now - (p.since || data.now) > 864e5;
  const leaf = wilted ? '#8a7a3a' : '#3a8f46', leaf2 = wilted ? '#6b5a2a' : '#63c74d';
  r(x + 1, y + 7, 8, 5, PAL.ink); r(x + 2, y + 8, 6, 4, '#c96f4a'); r(x + 2, y + 8, 6, 1, '#e08a5f');
  const hgt = days < 1 ? 2 : days < 3 ? 4 : days < 7 ? 6 : 8;
  if (wilted) { r(x + 4, y + 8 - hgt, 1, hgt, leaf); r(x + 5, y + 8 - hgt, 3, 1, leaf2); r(x + 7, y + 9 - hgt, 1, 2, leaf2); return; }
  r(x + 4, y + 8 - hgt, 2, hgt, leaf);
  for (let k = 0; k < hgt; k += 2) { r(x + 2, y + 7 - k, 2, 1, leaf2); r(x + 6, y + 6 - k, 2, 1, leaf2); }
  if (days >= 7) { r(x + 4, y + 6 - hgt, 2, 2, '#ff6ec7'); r(x + 4, y + 6 - hgt, 1, 1, '#ffd84d'); }
}
function drawDeskLife(p, g, t, atDesk) {
  const { dx, dy, dw, px, py } = g, f = (t / 120) | 0;
  // a week-old session (each week) gets a cake on the day
  const days = (data.now - p.startedAt) / 864e5;
  if (days >= 7 && days % 7 < 1) {
    const cx = dx + 18, cy = dy - 5;
    r(cx - 1, cy + 1, 12, 5, PAL.ink); r(cx, cy + 2, 10, 3, '#f4dfc6'); r(cx, cy + 2, 10, 1, '#ff6ec7');
    r(cx + 4, cy - 2, 1, 3, '#2ce8f5'); if (f % 3) r(cx + 4, cy - 4, 1, 2, '#ffd84d');
  }
  // uncommitted work piles up as paper on the desk; a commit clears it
  const dirty = (p.git && p.git.dirty) || 0;
  for (let k = 0; k < Math.min(4, Math.floor(dirty / 4)); k++) { const hx = dx + dw - 46 + k * 5, hy = dy - 2 - (k % 2); r(hx - 1, hy - 1, 7, 4, PAL.ink); r(hx, hy, 5, 2, k % 2 ? '#ffffff' : '#e8e0c8'); r(hx + 1, hy, 3, 1, '#c0b89a'); }
  // a request waiting more than 2 minutes: the desk phone rings
  if ((p.state === 'needs_you' || p.state === 'waiting') && p.doing && p.doing.for > 120000) {
    const ring = f % 6 < 3, hx = dx + dw - 22 + (ring ? (f % 2 ? 1 : -1) : 0), hy = dy - 3;
    r(hx - 1, hy - 1, 9, 6, PAL.ink); r(hx, hy, 7, 4, '#e43b44'); r(hx + 1, hy - 2, 5, 2, PAL.ink); r(hx + 2, hy - 2, 3, 1, '#e43b44');
    if (ring) { r(hx - 3, hy - 3, 1, 2, '#ffd84d'); r(hx + 9, hy - 3, 1, 2, '#ffd84d'); r(hx - 4, hy, 1, 1, '#ffd84d'); r(hx + 10, hy, 1, 1, '#ffd84d'); }
  }
  // a badge on the partition with the branch (readable when the camera flies in)
  if (p.branch && p.branch !== 'HEAD' && p.repo) {
    const b = String(p.branch.split('/').pop()).toUpperCase().replace(/[^A-Z0-9\-.]/g, '').slice(0, 7);
    r(px + 3, py + 19, b.length * 4 + 3, 8, PAL.ink); r(px + 4, py + 20, b.length * 4 + 1, 6, '#f4ecd8'); r(px + 4, py + 20, b.length * 4 + 1, 1, agentOf(p).color);
    pixText(px + 5, py + 21, b, '#2a1d27');
  }
  // a long task just ended: confetti over the desk
  const k = celebrating(p.id);
  if (k) for (let i = 0; i < 14; i++) { const h = hash('cel' + p.id + i), ax = dx + dw / 2 + Math.cos(i) * (k / 40) * ((h % 5) / 4 + .5), ay = dy - 30 + (k / 1000) * 30 + Math.sin(i) * (k / 60); r(ax, ay, 2, 1, TIER_COLOR[1 + h % 5]); }
}
// a room where everyone is deep in work hangs a do-not-disturb sign on its door
function drawRoomLife(R, t) {
  const live = R.people.filter(p => !p.leaving);
  if (!live.length || !live.every(p => !['idle', 'asleep', 'needs_you', 'waiting'].includes(p.state))) return;
  const x = R.doorX + 4, y = R.y + R.h - 9;
  r(x + 4, y - 3, 1, 3, '#8b7a5a'); r(x - 1, y - 1, 12, 8, PAL.ink); r(x, y, 10, 6, '#e43b44'); r(x + 2, y + 2, 6, 2, '#ffffff');
}

// ---- elevator at the bottom of the corridor: doors open for arrivals and departures ----
let elevatorAt = 0;
function drawElevator(t) {
  const x = CX - 12, y = H - 26, open = Math.max(0, 1 - Math.abs(Date.now() - elevatorAt - 1200) / 1200);
  r(x - 2, y - 4, 28, 30, PAL.ink); r(x - 1, y - 3, 26, 2, '#8b9bb4');
  const gap = Math.round(open * 10);
  r(x, y, 24, 26, '#1b1622');
  r(x, y, 12 - gap, 26, '#c0cbdc'); r(x + 12 + gap, y, 12 - gap, 26, '#c0cbdc');
  r(x + 11 - gap, y, 1, 26, '#8b9bb4'); r(x + 12 + gap, y, 1, 26, '#8b9bb4');
  r(x + 9, y - 3, 6, 1, open ? '#63c74d' : '#e43b44');
  // punch clock beside it
  const cx = x + 28, cy = y + 2;
  r(cx - 1, cy - 1, 10, 13, PAL.ink); r(cx, cy, 8, 11, '#8b9bb4'); r(cx + 1, cy + 1, 6, 4, '#0c1410'); r(cx + 2, cy + 2, 1, 1, '#62ff7a'); r(cx + 4, cy + 2, 2, 1, '#62ff7a');
  r(cx + 2, cy + 7, 4, 3, '#f4ecd8');
  clockBox = { x: cx - 1, y: cy - 1, w: 10, h: 13 };
}
let clockBox = null;

// ---- night janitor and the Friday pizza: walkers added to the frame ----
function extraWalkers(t) {
  const out = [], h = nowHour(), d = qs.get('date') ? new Date(new Date().getFullYear(), ...qs.get('date').split('-').map((v, i) => i ? Number(v) : Number(v) - 1)) : new Date();
  const live = data ? data.people.filter(p => !p.leaving) : [], working = live.filter(p => !['idle', 'asleep', 'needs_you', 'waiting'].includes(p.state)).length;
  if ((h >= 1 && h < 5) && working === 0) {
    // mops up and down the corridor, slowly
    const k = (t / 40000) % 2, y = TOP + 20 + (k < 1 ? k : 2 - k) * (H - TOP - 60), x = CX + 2;
    out.push({ y, draw: () => { Art.drawStanding(x, y, JANITOR, t, true); r(x + 15, y + 8, 1, 14, '#8b7a5a'); r(x + 12, y + 22, 7, 2, '#c0cbdc'); r(x - 8, y + 18, 7, 6, PAL.ink); r(x - 7, y + 19, 5, 4, '#3b5dc9'); } });
  }
  if (d.getDay() === 5 && h >= 18 && working > 0) {
    // the pizza arrives: from the elevator up the corridor to the kitchen, every 10 minutes
    const k = (Date.now() / 1000) % 600;
    if (k < 40) { const go = k < 20, s = go ? k / 20 : 1 - (k - 20) / 20, y = H - 30 - s * (H - 30 - TOP - 70), x = CX - 6 + (s > .9 ? (s - .9) * 300 : 0);
      out.push({ y, draw: () => { Art.drawStanding(x, y, PIZZA_GUY, t, true); if (go) { r(x + 2, y + 9, 12, 3, PAL.ink); r(x + 3, y + 9, 10, 2, '#c99a4a'); } } }); }
  }
  return out;
}
const JANITOR = { ...Art.look('night-janitor'), c: '#3b5dc9', C: '#2a428f', style: 'short' };
const PIZZA_GUY = { ...Art.look('pizza-guy'), c: '#e43b44', C: '#a82a32', h: '#e43b44', H: '#a82a32', style: 'short' };

// lunch: idle agents in the lounge hold a sandwich instead of a mug
function drawFoodInHand(a, t) { const x = a.x + (a.flip ? -2 : 13), y = a.y + 10; r(x - 1, y - 1, 7, 5, PAL.ink); r(x, y, 5, 1, '#e8c170'); r(x, y + 1, 5, 1, '#63c74d'); r(x, y + 2, 5, 1, '#e8c170'); }

// funny thought bubbles for agents idle a long time (one at a time, changes every 15s)
function idleThought() {
  if (!data) return null;
  const long = layout.filter(c => c.actor && c.p.state === 'idle' && data.now - (c.p.since || data.now) > 20 * 60000);
  if (!long.length) return null;
  const slot = Math.floor(Date.now() / 15000), c = long[slot % long.length], lines = T.thoughts;
  return { c, text: lines[(slot + hash(c.p.id)) % lines.length] };
}

// ---- meeting TV: one bar per subagent in the room, coloured by what it's doing ----
function drawMeetingTV(x, y, w, h, t) {
  const subs = meetInfo.people.filter(m => !m.lead);
  if (!subs.length) return false;
  r(x - 2, y - 2, w + 4, h + 4, PAL.ink); r(x - 1, y - 1, w + 2, h + 2, PAL.bezel); r(x, y, w, h, '#101420');
  const n = Math.min(subs.length, 4), bh = Math.max(2, Math.floor((h - 2) / n) - 1);
  subs.slice(0, n).forEach((m, i) => {
    const k = (Math.sin(t / 400 + i * 1.7) + 1) / 2, len = 3 + Math.round(k * (w - 6));
    r(x + 1, y + 1 + i * (bh + 1), len, bh, ['#63c74d', '#2ce8f5', '#feae34', '#ff6ec7'][i % 4]);
  });
  tvBox = { x: x - 2, y: y - 2, w: w + 4, h: h + 4 };
  return true;
}
let tvBox = null;

// ---- notice board in the dev corner: today's most edited files as post-its (from the daily report) ----
let boardFiles = [], boardAt = 0;
function refreshBoardFiles() {
  if (Date.now() - boardAt < 2 * 60000) return;
  boardAt = Date.now();
  fetch('api/report').then(r => r.json()).then(j => { boardFiles = (j.topFiles || []).slice(0, 4); boardRows = j.rows || []; }).catch(() => {});
}
function drawNoticeBoard(x, y) {
  // a cork board: a calendar page with today's date, a note with how many files were edited today, and a
  // few pinned papers (the file names are in the tooltip; a click opens the daily report)
  refreshBoardFiles();
  r(x - 2, y - 2, 48, 32, '#6b4a33'); r(x - 1, y - 1, 46, 30, '#8f6a4a'); r(x, y, 44, 28, '#c98f5a');
  for (let k = 0; k < 40; k++) { const h = hash('cork' + k); r(x + h % 44, y + (h >>> 8) % 28, 1, 1, '#b97c48'); }
  // calendar page
  const d = new Date();
  r(x + 2, y + 3, 15, 18, PAL.ink); r(x + 3, y + 4, 13, 16, '#ffffff'); r(x + 3, y + 4, 13, 5, '#e43b44');
  const day = String(d.getDate()); pixText(x + 10 - day.length * 2, y + 12, day, '#2a1d27');
  r(x + 9, y + 2, 1, 2, '#c0cbdc');
  // the note: files edited today
  const n = boardRows.reduce((m, r2) => m + (r2.files || 0), 0);
  r(x + 20, y + 4, 13, 12, '#ffd84d'); r(x + 25, y + 3, 2, 2, '#e43b44'); const ns = String(Math.min(999, n)); pixText(x + 27 - ns.length * 2, y + 8, ns, '#2a1d27');
  // pinned papers with scribbles, one per top file
  boardFiles.slice(0, 3).forEach((f, i) => {
    const px = x + 34 + (i % 2) * 4, py = y + 3 + i * 8, c = ['#ffffff', '#9fd3ff', '#9fe3a0'][i];
    r(px, py, 8, 7, c); r(px + 3, py - 1, 2, 2, ['#3b5dc9', '#63c74d', '#ff6ec7'][i]);
    r(px + 1, py + 2, 5, 1, '#8a7a6a'); r(px + 1, py + 4, 4, 1, '#8a7a6a');
  });
  r(x + 20, y + 18, 12, 7, '#ff9ccf'); r(x + 25, y + 17, 2, 2, '#ffd84d'); r(x + 21, y + 20, 8, 1, '#a0507a'); r(x + 21, y + 22, 6, 1, '#a0507a');
  noticeBox = { x: x - 2, y: y - 2, w: 48, h: 32 };
}
let noticeBox = null;



// the punch clock reads the daily report (refreshed with the notice board): who started working today, and when
const clockIns = () => (boardRows || []).filter(x => x.first).sort((a, b) => a.first - b.first);
let boardRows = [];
