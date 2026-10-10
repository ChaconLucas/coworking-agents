'use strict';
// ---------------- scene ----------------
let wallGlows = [];
function drawWall(t, sky) {
  r(0, 0, W, TOP - 6, PAL.wall);
  for (let x = 0; x < W; x += 24) r(x, 0, 1, TOP - 6, PAL.wallShade);
  r(0, 0, W, 3, PAL.wallTrim); r(0, 3, W, 1, PAL.ink2);
  r(0, TOP - 8, W, 2, PAL.wallShade); r(0, TOP - 6, W, 5, PAL.base); r(0, TOP - 6, W, 1, '#8f553f'); r(0, TOP - 1, W, 1, PAL.ink);
  const nWin = Math.max(1, Math.floor((CX - 30) / 74));
  // the third window slot becomes the dev corner of the wall: neon </> and two posters
  for (let i = 0; i < nWin; i++) {
    const wx = 16 + i * 74;
    if (i === 2 && nWin >= 4) { Art.drawNeon(wx + 9, 10, t, wallGlows); Art.drawPoster(wx - 4, 28 - 8, 0); Art.drawPoster(wx + 34, 28 - 8, 2); }
    else if (i === 5) Art.drawPoster(wx + 14, 12, 1);
    else Art.drawWindow(wx, 9, 48, 30, sky, t, i);
  }
  boardBox = { x: RX - 14, y: 8, w: 56, h: 30 };
  Art.drawWhiteboard(boardBox.x, boardBox.y, boardBox.w, boardBox.h, counts(), t);
  Art.drawClock(RX + 58, 20);
  hallBox = { x: RX + 74, y: 7, w: 72, h: 32 };
  Art.drawCork(hallBox.x, hallBox.y, hallBox.w, hallBox.h, data ? Object.values(data.credentials || {}).flatMap(c => c.topSkills || []).sort((a, b) => b.count - a.count) : []);
  // light switch on the wall, by the door: click it to turn the ceiling lights on/off
  switchBox = { x: 4, y: 20, w: 8, h: 12 };
  r(4, 20, 8, 12, PAL.ink); r(5, 21, 6, 10, '#f4ecd8'); r(5, 21, 6, 1, '#ffffff');
  r(7, 22, 2, 8, '#c0cbdc'); r(7, lightsOn ? 22 : 26, 2, 4, lightsOn ? '#63c74d' : '#8b9bb4');
  return nWin;
}
let switchBox = null;

function drawShafts(sky, nWin) {
  if (sky.phase === 'night') return;
  ctx.save();
  ctx.fillStyle = sky.phase === 'day' ? 'rgba(255,246,214,0.08)' : 'rgba(255,180,120,0.08)';
  for (let i = 0; i < nWin; i++) {
    const x = 16 + i * 74;
    ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x + 48, TOP); ctx.lineTo(x + 80, TOP + 80); ctx.lineTo(x + 32, TOP + 80); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// a repository's room seen from above: carpet in the repo color, walls, door and sign
const ROOM_BUILD_MS = 1100, SITE_MS = 3400;
// work sites queued while drawing desks, painted on top of everything at the end of the frame
let sites = [];
// a boarded-up, dusty work site over a rectangle; k goes 0→1 (closed → work → clean reveal)
function drawSite(S0, t) {
  const { x, y, w, h, k } = S0;
  const cover = k < .12 ? k / .12 : k > .82 ? Math.max(0, 1 - (k - .82) / .18) : 1;
  if (cover <= 0) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalAlpha = cover;
  r(x, y, w, h, 'rgba(58, 36, 26, .82)');
  // plywood planks sliding across in both directions
  for (let i = 0, yy = y + 3; yy < y + h - 4; i++, yy += 9) {
    const dir = i % 2 ? -1 : 1, speed = 26 + (i * 7) % 14, len = 26 + (hash('pl' + i) % 18);
    const off = ((t / 1000 * speed + i * 41) % (w + len + 20));
    const px = dir > 0 ? x - len + off : x + w - off;
    r(px, yy, len, 6, '#2a1d27'); r(px + 1, yy + 1, len - 2, 4, i % 3 ? '#c99a5b' : '#b6844a');
    r(px + 1, yy + 1, len - 2, 1, '#e0b878'); r(px + 3, yy + 3, 1, 1, '#5d3a28'); r(px + len - 4, yy + 3, 1, 1, '#5d3a28');
  }
  // big drifting dust clouds
  for (let i = 0; i < 26; i++) {
    const hh = hash('du' + i), life = ((t / 1000 * (0.4 + (hh % 5) / 10)) + (hh % 100) / 100) % 1;
    const cx = x + (hh % w) + Math.sin(t / 700 + i) * 4, cy = y + h - life * (h + 10), rad = 3 + (hh >>> 4) % 5;
    ctx.globalAlpha = cover * (1 - life) * .7;
    r(cx - rad, cy - rad + 1, rad * 2, rad * 2 - 2, '#d9c4a3'); r(cx - rad + 1, cy - rad, rad * 2 - 2, rad * 2, '#e8d8bc');
  }
  ctx.globalAlpha = cover;
  // caution tape: around the edge and an X across, plus a warning sign
  const tape = (sx, sy, len, vertical) => { for (let o = 0; o < len; o += 6) { const c = (o / 6) % 2 ? '#2a1d27' : '#feae34'; vertical ? r(sx, sy + o, 3, 6, c) : r(sx + o, sy, 6, 3, c); } };
  tape(x, y, w, false); tape(x, y + h - 3, w, false); tape(x, y, h, true); tape(x + w - 3, y, h, true);
  for (let s = 0; s < Math.min(w, h); s += 3) { r(x + s * (w / Math.min(w, h)), y + s * (h / Math.min(w, h)), 3, 3, (s / 3) % 4 < 2 ? '#feae34' : '#2a1d27'); r(x + w - 3 - s * (w / Math.min(w, h)), y + s * (h / Math.min(w, h)), 3, 3, (s / 3) % 4 < 2 ? '#feae34' : '#2a1d27'); }
  const sx = x + w / 2 - 9, sy = y + h / 2 - 8;
  r(sx, sy, 18, 16, '#2a1d27'); r(sx + 1, sy + 1, 16, 14, '#feae34'); r(sx + 8, sy + 3, 2, 7, '#2a1d27'); r(sx + 8, sy + 11, 2, 2, '#2a1d27');
  ctx.restore();
  // the reveal: sparkles as the boards come down
  if (k > .82) for (let i = 0; i < 8; i++) { const hh = hash('sk' + i + x); if (((t / 120) | 0) % 3 === i % 3) { const px = x + hh % w, py = y + (hh >>> 6) % h; r(px, py - 2, 1, 5, '#fff'); r(px - 2, py, 5, 1, '#fff'); } }
}
function drawRoom(R0, t) {
  // being built or extended: the walls slide from the old rectangle (or the door) to the new one
  let R = R0;
  const age = R0.anim ? Date.now() - R0.anim.at : Infinity;
  if (age < ROOM_BUILD_MS) {
    const k = 1 - Math.pow(1 - age / ROOM_BUILD_MS, 3), F = R0.anim.from, lerp = (a, b) => Math.round(a + (b - a) * k);
    R = { ...R0, x: lerp(F.x, R0.x), y: lerp(F.y, R0.y), w: Math.max(18, lerp(F.w, R0.w)), h: Math.max(6, lerp(F.h, R0.h)) };
    R.doorX = R.x + Math.round(R.w / 2) - 9;
  }
  drawRoomShell(R, t);
  if (age < ROOM_BUILD_MS + 400) drawRoomWork(R, t, Math.min(1, age / ROOM_BUILD_MS));
}
// scaffolding along the walls and dust while a room is under construction
function drawRoomWork(R, t, k) {
  const f = (t / 90) | 0;
  for (let x = R.x; x < R.x + R.w; x += 10) { r(x, R.y - 6, 1, 8, '#feae34'); r(x, R.y + R.h - 2, 1, 8, '#feae34'); }
  r(R.x, R.y - 6, R.w, 1, '#feae34'); r(R.x, R.y + R.h + 5, R.w, 1, '#feae34');
  for (let i = 0; i < 18; i++) { const h = hash('rd' + i + R.name + ((f / 2) | 0)); r(R.x + h % R.w, R.y + (h >>> 7) % Math.max(1, R.h), 2, 2, i % 2 ? 'rgba(230,210,180,.6)' : 'rgba(255,255,255,.45)'); }
  if (k < 1) for (let i = 0; i < 3; i++) { const h = hash('rs' + i + f); r(R.x + R.w - 2 + (h % 4), R.y + (h >>> 5) % Math.max(1, R.h), 1, 3, '#feae34'); }
}
function drawRoomShell(R, t) {
  const h = hash(R.name), hue = ['#6b5a7a', '#5a6b7a', '#5a7a6b', '#7a6b5a', '#7a5a62', '#5f6f8a', '#6f8a5f'][h % 7];
  r(R.x, R.y, R.w, R.h, hue);
  for (let yy = 2; yy < R.h; yy += 3) for (let xx = (yy % 6) ? 1 : 3; xx < R.w; xx += 4) r(R.x + xx, R.y + yy, 1, 1, shade(hue, .9));
  // walls: the top one has a face (gives height), sides and bottom are thin, door in the bottom middle
  r(R.x - 2, R.y - 2, R.w + 4, 3, PAL.ink); r(R.x - 2, R.y + 1, R.w + 4, 6, PAL.wall); r(R.x - 2, R.y + 7, R.w + 4, 1, PAL.wallShade);
  r(R.x - 2, R.y, 3, R.h + 2, PAL.ink); r(R.x + R.w - 1, R.y, 3, R.h + 2, PAL.ink);
  r(R.x - 2, R.y + R.h, R.doorX - R.x + 2, 3, PAL.ink); r(R.doorX + 18, R.y + R.h, R.x + R.w - R.doorX - 16, 3, PAL.ink);
  r(R.doorX, R.y + R.h, 18, 3, '#8f553f'); r(R.doorX, R.y + R.h, 1, 3, PAL.ink2); r(R.doorX + 17, R.y + R.h, 1, 3, PAL.ink2);
  // sign (the text comes from HTML, crisp)
  r(R.x + 4, R.y + 1, 6, 5, agentRoomColor(R)); 
}
function agentRoomColor(R) {
  if (R.people.some(p => p.state === 'needs_you' || p.state === 'waiting')) return PAL.red;
  if (R.people.some(p => !['idle', 'asleep'].includes(p.state))) return PAL.green;
  return '#8b9bb4';
}

// the box a newcomer carries in: their computer, a mug and a plant sticking out
function drawCarriedBox(x, y) {
  r(x - 2, y + 10, 20, 12, PAL.ink); r(x - 1, y + 11, 18, 10, '#b97c48'); r(x - 1, y + 15, 18, 1, '#8f553f');
  r(x + 2, y + 6, 10, 6, PAL.ink); r(x + 3, y + 7, 8, 4, '#1e2233'); r(x + 4, y + 8, 4, 1, '#3ddc84');
  r(x + 13, y + 6, 2, 5, PAL.leaf); r(x + 15, y + 7, 1, 4, PAL.leafLight);
}

// build-in animation for a new desk: scaffold dust and sparks while the furniture rises from the floor
function drawConstruction(x, y, k, t) {
  const f = (t / 90) | 0;
  for (let i = 0; i < 14; i++) {
    const h = hash('dust' + i + x), px = x + 8 + (h % (CELL_W - 16)), py = y + 20 + ((h >>> 6) % 50) - Math.round(k * 10);
    r(px, py, 2, 2, i % 3 ? 'rgba(220,200,170,.55)' : 'rgba(255,255,255,.4)');
  }
  for (let i = 0; i < 4; i++) if ((f + i) % 3 === 0) { const h = hash('sp' + i + f); r(x + 10 + h % (CELL_W - 20), y + 30 + (h >>> 5) % 30, 1, 3, '#feae34'); }
  r(x + 6, y + 70, CELL_W - 12, 2, '#feae34'); for (let i = 0; i < CELL_W - 12; i += 8) r(x + 6 + i, y + 70, 4, 2, PAL.ink); // caution tape
}

function drawDesk(d, t, clashing, lights, glows, sky) {
  const { x, y } = d, p = d.cell ? d.cell.p : d.p, f = (t / 140) | 0, seed = hash(p ? p.id : 'empty' + x + y) % 997;
  // a newcomer's desk is built first: it rises from the floor over the first second
  const born = p && arrivals.get(p.id), build = born ? Math.min(1, (Date.now() - born) / SITE_MS) : 1;
  // leaving: once they've walked off, the desk sinks into dust (demolition) and is gone
  if (p && p.leaving) {
    const away = d.cell && d.cell.actor && d.cell.actor.mode !== 'desk';
    const k = away ? Math.min(1, Math.max(0, (Date.now() - p.leaving - 2400) / SITE_MS)) : 0;
    if (k >= .5) { sites.push({ x: x + 2, y: y + 2, w: CELL_W - 4, h: CELL_H - 8, k }); return; } // gone under the boards
    if (k > 0) { drawDeskBody(d, t, false, lights, glows, sky, p, f, seed); sites.push({ x: x + 2, y: y + 2, w: CELL_W - 4, h: CELL_H - 8, k }); return; }
  }
  if (build < 1) {
    // under construction: boarded up and dusty; the finished desk is revealed when the boards come down
    if (build > .5) drawDeskBody(d, t, clashing, lights, glows, sky, p, f, seed);
    sites.push({ x: x + 2, y: y + 2, w: CELL_W - 4, h: CELL_H - 8, k: build });
    return;
  }
  drawDeskBody(d, t, clashing, lights, glows, sky, p, f, seed);
}

function drawDeskBody(d, t, clashing, lights, glows, sky, p, f, seed) {
  const { x, y } = d;
  const cell = d.cell;
  const a = cell && cell.actor;
  const atDesk = !!(a && a.mode === 'desk');
  const st = p ? p.state : 'asleep';
  // divider
  const px = x + 6, py = y + 2, pw = CELL_W - 12, ph = 28;
  r(px + 2, py + ph + 1, pw, 2, '#00000022');
  r(px - 1, py - 1, pw + 2, ph + 2, clashing && f % 4 < 2 ? PAL.red : PAL.ink);
  r(px, py, pw, ph, PAL.fabric);
  for (let yy = 3; yy < ph; yy += 2) for (let xx = (yy % 4) ? 1 : 3; xx < pw; xx += 4) r(px + xx, py + yy, 1, 1, PAL.fabricDot);
  r(px, py, pw, 2, PAL.alu); r(px, py + 2, pw, 1, PAL.aluDark);
  if (cell) {
    const certs = certsOf(p), fit = Math.floor((pw - 8) / 13);
    cell.certs = [];
    certs.slice(0, fit).forEach((c, i) => {
      const cx = px + 5 + i * 13, cy = py + 6 + (i % 2) * 3;
      Art.drawCertificate(cx, cy, certColor(c), c.kind === 'badge');
      cell.certs.push({ c, x: cx, y: cy, w: 11, h: 9 });
    });
    cell.extraCerts = Math.max(0, certs.length - fit);
  }
  // monitor: off at an empty desk, screensaver if the person stepped away
  const mw = 34, mh = 20, mx = x + CELL_W / 2 - mw / 2, my = y + 18;
  const screen = !p ? 'asleep' : atDesk ? st : (st === 'asleep' ? 'asleep' : 'idle');
  r(mx - 2, my - 2, mw + 4, mh + 4, PAL.ink); r(mx - 1, my - 1, mw + 2, mh + 2, PAL.bezel); r(mx - 1, my - 1, mw + 2, 1, PAL.bezelLight);
  Art.drawScreen(mx, my, mw, mh, screen, t, seed);
  r(mx + mw / 2 - 2, my + mh + 2, 4, 3, PAL.ink); r(mx + mw / 2 - 6, my + mh + 4, 12, 2, PAL.ink);
  const glow = Art.SCREEN_GLOW[screen];
  if (glow) { glows.push({ x: mx + mw / 2, y: my + mh / 2, r: 30, c: glow }); lights.push({ x: mx + mw / 2, y: my + mh, r: 26 }); }
  // desk
  const dx = x + 14, dy = y + 42, dw = CELL_W - 28;
  r(dx + 2, dy + 18, dw, 6, '#00000026');
  r(dx - 1, dy - 1, dw + 2, 20, PAL.ink);
  r(dx, dy, dw, 9, PAL.deskTop); r(dx, dy, dw, 1, PAL.deskLight); r(dx, dy + 9, dw, 9, PAL.deskFront); r(dx, dy + 9, dw, 1, PAL.deskDark);
  r(dx + 3, dy + 18, 3, 6, PAL.ink); r(dx + dw - 6, dy + 18, 3, 6, PAL.ink);
  r(x + CELL_W / 2 - 10, dy + 2, 20, 4, PAL.ink); r(x + CELL_W / 2 - 9, dy + 2, 18, 3, '#c0cbdc'); r(x + CELL_W / 2 - 9, dy + 4, 18, 1, '#8b9bb4');
  r(x + CELL_W / 2 + 13, dy + 3, 3, 3, PAL.ink); r(x + CELL_W / 2 + 13, dy + 3, 2, 2, '#c0cbdc');
  // dev desk extras, fixed per person: side monitor, rubber duck, sticky notes on the partition
  if (p && seed % 4 === 1) Art.drawSideMonitor(mx + mw + 6, my + 2, t, seed);
  if (p && seed % 5 === 0) Art.drawDuck(x + CELL_W / 2 + 18, dy + 1);
  if (seed % 3 !== 2) Art.drawStickies(px + pw - 22, py + 18, seed);
  const item = seed % 3;
  if (item === 0) { const on = !!p && sky.phase !== 'day'; Art.drawLamp(dx + 2, dy - 10, on); if (on) lights.push({ x: dx + 6, y: dy + 2, r: 40 }); }
  else if (item === 1) Art.drawPlant(dx + 1, dy - 12, false);
  else { r(dx + 3, dy + 1, 12, 6, PAL.ink); r(dx + 4, dy + 1, 10, 5, PAL.paper); r(dx + 5, dy + 2, 8, 1, PAL.paperLine); r(dx + 6, dy, 10, 5, PAL.ink); r(dx + 7, dy, 8, 4, '#ffffff'); }
  if (!p) { Art.drawEmptyChair(d.chair.x, d.chair.y); return; }
  const mugX = dx + dw - 12;
  r(mugX, dy, 6, 6, PAL.ink); r(mugX + 1, dy + 1, 4, 4, Art.SHIRT[(seed >> 2) % Art.SHIRT.length]); r(mugX + 5, dy + 2, 2, 2, PAL.ink);
  if (atDesk && st !== 'asleep' && f % 8 < 5) r(mugX + 2, dy - 3 - (f % 3), 1, 2, '#ffffff99');
  const ag = agentOf(p).color;
  r(dx + dw - 30, dy + 11, 16, 5, PAL.ink); r(dx + dw - 29, dy + 12, 14, 3, ag); r(dx + dw - 27, dy + 13, 10, 1, '#ffffffaa');
  const cx = d.chair.x, cy = d.chair.y;
  if (!atDesk) { Art.drawEmptyChair(cx, cy); return; }
  Art.drawChairBase(cx, cy + 24);
  const lk = look(p.id);
  if (st === 'needs_you' || st === 'waiting') {
    Art.drawChairBack(cx, cy + 8);
    Art.drawFront(cx, cy - 2, lk, t, { legs: Art.LEGS_SIT, legsKey: 'sit', wave: st === 'needs_you', mouth: st === 'needs_you' ? 'open' : 'flat' });
  } else if (st === 'asleep') { Art.drawSleeping(cx, cy, lk, t); Art.drawChairBack(cx, cy + 14); }
  else { Art.drawSeatedBack(cx, cy, lk, t, { typing: st === 'edit' || st === 'terminal', reading: st === 'read' }); Art.drawChairBack(cx, cy + 14); }
  cell.interns = [];
}

// fills the floor left empty under the rooms: arcade, bookshelves, an architecture board, plants
function drawDevCorner(t, glows) {
  const top = rooms.reduce((m, R) => Math.max(m, R.y + R.h), TOP) + 18;
  if (H - top < 50) return;
  const y = top + Math.min(20, (H - top - 46) / 2);
  let x = 16;
  const items = [
    w => { Art.drawArcade(x, y, t, glows); return 26; },
    w => { Art.drawArcade(x, y, t, glows); return 30; },
    w => { Art.drawBookshelf(x, y + 4, 44, 26); return 52; },
    w => { Art.drawDiagramBoard(x, y + 2); return 40; },
    w => { Art.drawPlant(x, y + 12, true); return 26; },
    w => { Art.drawBookshelf(x, y + 4, 44, 26); return 52; },
    w => { Art.drawBeanBag(x, y + 16, '#3b5dc9'); return 30; },
    w => { Art.drawPlant(x, y + 12, true); return 26; },
  ];
  for (const draw of items) { if (x > CX - 40) break; x += draw(); }
}

let napBox = null;
function drawWing(t, lights, glows, pingPlaying, meeting) {
  r(CX - 6, TOP, 1, H - TOP, '#00000018');
  // kitchen with tiled floor
  Art.drawTile(RX - 4, TOP, RW + 8, 104, '#e8dcc8', '#d9c9ae');
  Art.drawCounter(RX + 22, TOP - 8, 60);
  Art.drawCoffeeMachine(RX + 2, TOP - 16, t, true);
  Art.drawFridge(RX + RW - 20, TOP - 22);
  Art.drawPlant(RX + RW - 40, TOP - 6, false);
  lights.push({ x: RX + 10, y: TOP, r: 22 }); glows.push({ x: RX + 10, y: TOP - 6, r: 14, c: '#2ce8f5' });
  Art.drawRug(RX + 4, TOP + 70, 92, 26);
  Art.drawSofa(RX + 10, TOP + 46, 78);
  Art.drawRoundTable(RX + 108, TOP + 70);
  Art.drawPizza(RX + 111, TOP + 70);
  Art.drawBeanSack(RX + 84, TOP + 18);
  Art.drawCupStack(RX + 74, TOP - 6);
  Art.drawStool(RX + 100, TOP + 82); Art.drawStool(RX + 126, TOP + 82);
  // ping-pong
  Art.drawPingPong(RX + 34, wing.ping + 20, 80, 30, t, pingPlaying);
  // glass meeting room
  const my = wing.meet;
  r(RX - 2, my, RW + 4, 98, '#4f5c7a');
  for (let yy = 2; yy < 98; yy += 3) for (let xx = (yy % 6) ? 1 : 3; xx < RW + 4; xx += 4) r(RX - 2 + xx, my + yy, 1, 1, '#465270');
  Art.drawGlassWall(RX - 2, my, RW + 4, 98, null);
  r(RX - 2, my + 32, 4, 18, '#4f5c7a'); // door on the corridor side
  Art.drawTV(RX + 8, my + 8, 18, 12, t, meeting);
  if (meeting) glows.push({ x: RX + 17, y: my + 14, r: 20, c: '#feae34' });
  lights.push({ x: RX + RW / 2, y: my + 46, r: 46 });
  // rest room: closed, door on the corridor side, lights always off (see drawScene)
  const ny = wing.nap;
  Art.drawRug(RX + 2, ny + 22, RW - 4, 50);
  Art.drawBookshelf(RX + 104, ny + 8, 40, 22);
  for (const [i, sp] of spots.nap.entries()) Art.drawBeanBag(sp.x - 2, sp.y + 2, ['#b55088', '#0099db', '#feae34'][i]);
  Art.drawPlant(RX + 4, ny + 6, false);
  r(RX - 4, ny - 2, RW + 8, 3, PAL.ink); r(RX - 4, ny + 1, RW + 8, 5, PAL.wall); r(RX - 4, ny + 6, RW + 8, 1, PAL.wallShade); // top wall
  r(RX - 4, ny - 2, 3, 30, PAL.ink); r(RX - 4, ny + 46, 3, 34, PAL.ink); // left wall, door gap at ny+28..46
  r(RX - 4, ny + 28, 3, 1, '#8f553f'); r(RX - 4, ny + 45, 3, 1, '#8f553f');
  r(RX + RW + 1, ny - 2, 3, 82, PAL.ink); r(RX - 4, ny + 78, RW + 8, 3, PAL.ink); // right and bottom walls
  napBox = { x: RX - 1, y: ny + 1, w: RW + 2, h: 77 };
  // server corner under the nap area
  const sy = wing.servers;
  r(RX - 2, sy - 4, RW + 4, 58, '#1b1d2e');
  for (let yy = 0; yy < 58; yy += 4) for (let xx = (yy % 8) ? 0 : 2; xx < RW + 4; xx += 4) r(RX - 2 + xx, sy - 4 + yy, 1, 1, '#23263a');
  for (let k = 0; k < 5; k++) Art.drawServerRack(RX + 4 + k * 28, sy, t, glows, 'rack' + k);
  lights.push({ x: RX + RW / 2, y: sy + 22, r: 50 });
  Art.drawPlant(RX + 4, ny - 2, false);
}

let meetInfo = { people: [], subTotal: 0, shown: 0 };
function drawMeeting(t, meetPeople) {
  const top = meetPeople.filter(m => m.spot.pose === 'sit'), bot = meetPeople.filter(m => m.spot.pose === 'back'), standing = meetPeople.filter(m => m.spot.pose === 'stand');
  for (const m of standing) Art.drawStanding(m.spot.x, m.spot.y, m.lk, t, false);
  for (const m of top) { Art.drawChairBack(m.spot.x, m.spot.y + 8); Art.drawFront(m.spot.x, m.spot.y - 2, m.lk, t, { legs: Art.LEGS_SIT, legsKey: 'sit' }); }
  Art.drawMeetingTable(RX + 24, wing.meet + 38, 104, 14);
  for (const m of bot) { Art.drawSeatedBack(m.spot.x, m.spot.y, m.lk, t, {}); Art.drawChairBack(m.spot.x, m.spot.y + 14); }
}

function drawPaddle(a, t) {
  const swing = ((t / 700) | 0) % 2 === (a.spot.flip ? 1 : 0);
  const hx = a.spot.flip ? a.x - 3 : a.x + 15, hy = a.y + (swing ? 9 : 13);
  r(hx, hy, 5, 5, PAL.ink); r(hx + 1, hy + 1, 3, 3, PAL.red); r(hx + 2, hy + 5, 1, 2, '#6e3f31');
}
function drawMugInHand(a, t) {
  const f = (t / 140) | 0;
  r(a.x + 12, a.y + 14, 5, 5, PAL.ink); r(a.x + 13, a.y + 15, 3, 3, PAL.white);
  if (f % 8 < 5) r(a.x + 14, a.y + 11 - (f % 3), 1, 2, '#ffffffaa');
}

// a little robot vacuum patrols the corridor and the dev corner
const robot = { x: 0, y: 0, k: 0, ready: false };
function updateRobot(dt) {
  const devY = rooms.reduce((m, R) => Math.max(m, R.y + R.h), TOP) + 10;
  const path = [{ x: CX - 5, y: TOP + 16 }, { x: CX - 5, y: Math.min(H - 14, devY) }, { x: 14, y: Math.min(H - 14, devY) }, { x: CX - 5, y: Math.min(H - 14, devY) }];
  if (!robot.ready) { Object.assign(robot, path[0], { ready: true }); }
  const w = path[robot.k % path.length], dx = w.x - robot.x, dy = w.y - robot.y, d = Math.hypot(dx, dy), step = 16 * dt;
  if (d <= step) { robot.x = w.x; robot.y = w.y; robot.k++; } else { robot.x += dx / d * step; robot.y += dy / d * step; }
}
function drawRobot(t) {
  const x = Math.round(robot.x), y = Math.round(robot.y), on = ((t / 400) | 0) % 2;
  r(x, y + 5, 11, 2, '#00000030');
  r(x, y, 11, 6, PAL.ink); r(x + 1, y, 9, 5, '#d9d9e0'); r(x + 2, y + 1, 7, 1, '#ffffff'); r(x + 3, y + 3, 5, 1, '#8b9bb4');
  r(x + 8, y + 1, 1, 1, on ? '#63c74d' : '#2a5a2a');
}

function drawScene(t, dt) {
  const now = Date.now();
  const hr = new Date().getHours() + new Date().getMinutes() / 60;
  const sky = Art.skyFor(qs.get('hour') ? Number(qs.get('hour')) : hr);
  updateActors(dt, now);
  updateCat(dt, t);
  updateRobot(dt);
  const lights = [], glows = [];
  Art.drawFloor(W, H, TOP);
  wallGlows = glows;
  const nWin = drawWall(t, sky);
  drawShafts(sky, nWin);
  // corridor runner rug with plants along it
  r(CX - 8, TOP, 16, H - TOP, '#6e2f3f'); r(CX - 6, TOP, 12, H - TOP, '#8e3e52');
  for (let y = TOP + 6; y < H; y += 10) { r(CX - 1, y, 2, 4, '#c96f84'); r(CX - 5, y + 5, 1, 1, '#c96f84'); r(CX + 4, y + 5, 1, 1, '#c96f84'); }
  for (let y = TOP + 70; y < H - 30; y += 150) Art.drawPlant(CX + 9, y, false);
  if (sky.phase !== 'night') for (let i = 0; i < nWin; i++) lights.push({ x: 40 + i * 74, y: TOP + 20, r: 60 });
  const arrived = z => layout.filter(c => c.actor && c.actor.mode === z);
  const meet = arrived('meet').map(c => ({ spot: c.actor.spot, lk: look(c.p.id), label: c.p.name, lead: true }));
  const used = new Set(meet.map(m => m.spot));
  const freeSeats = [...spots.meetTop, ...spots.meetBot, ...spots.meetStand].filter(s => !used.has(s));
  let subTotal = 0;
  for (const c of arrived('meet')) for (const s of c.p.subagents || []) {
    subTotal++;
    const seat = freeSeats.shift();
    if (seat) meet.push({ spot: seat, lk: look(s.id + c.p.id), label: s.type, title: `${s.type}${s.description ? ': ' + s.description : ''}${s.doing ? ' — ' + s.doing : ''} (${c.p.name})` });
  }
  meetInfo = { people: meet, subTotal, shown: meet.filter(m => !m.lead).length };
  drawWing(t, lights, glows, arrived('ping').length >= 2, meet.length > 0);
  drawMeeting(t, meet);
  for (const R of rooms) drawRoom(R, t);
  drawDevCorner(t, glows);
  const cs = clashSet();
  sites = [];
  for (const d of desks) drawDesk(d, t, !!d.p && cs.has(d.p.id), lights, glows, sky);
  for (const s of sites) drawSite(s, t);
  const movers = [];
  for (const c of layout) {
    const a = c.actor;
    if (!a || a.mode === 'desk' || a.mode === 'meet' || a.mode === 'gone') continue;
    const lk = look(c.p.id);
    if (a.mode === 'walk') movers.push({ y: a.y, draw: () => { Art.drawStanding(a.x, a.y, lk, t, true); if (a.carry) drawCarriedBox(a.x, a.y); } });
    else if (a.mode === 'nap') movers.push({ y: a.y, draw: () => Art.drawLying(a.x, a.y, lk, t) });
    else if (a.spot && a.spot.pose === 'sit') movers.push({ y: a.y, draw: () => Art.drawFront(a.x, a.y, lk, t, { legs: Art.LEGS_SIT, legsKey: 'sit', mug: true }) });
    else movers.push({ y: a.y, draw: () => { Art.drawStanding(a.x, a.y, lk, t, false); if (a.mode === 'ping') drawPaddle(a, t); else if (a.mode === 'lounge') drawMugInHand(a, t); } });
  }
  movers.push({ y: cat.y, draw: () => Art.drawCat(cat.x, cat.y, cat.mode, t, cat.flip) });
  movers.push({ y: robot.y, draw: () => drawRobot(t) });
  movers.sort((a, b) => a.y - b.y).forEach(m => m.draw());
  // ceiling lights: every room and shared area is lit, except the nap corner (it's a rest room)
  if (lightsOn) {
    for (const R of rooms) lights.push({ x: R.x + R.w / 2, y: R.y + R.h / 2, r: Math.max(R.w, R.h) * .8 });
    for (const zy of [wing.copa + 50, wing.ping + 35, wing.meet + 48, wing.servers + 24]) lights.push({ x: RX + RW / 2, y: zy, r: 90 });
    for (let y = TOP + 40; y < H; y += 120) lights.push({ x: CX, y, r: 70 });
    const devTop = rooms.reduce((m, R) => Math.max(m, R.y + R.h), TOP) + 30;
    if (devTop < H) lights.push({ x: CX / 2, y: devTop + 20, r: CX / 2 });
  }
  Art.applyLight(W, H, sky, lights, glows, lightsOn);
  // the rest room keeps its lights off, day or night
  if (napBox) { ctx.fillStyle = 'rgba(8, 8, 26, .55)'; ctx.fillRect(napBox.x, napBox.y, napBox.w, napBox.h); }
  for (const c of layout) {
    const st = c.p.state, a = c.actor;
    if (!a) continue;
    if (a.mode === 'nap') { Art.bubble(a.x + 16, a.y - 14, 'zz', t); continue; }
    if (a.mode !== 'desk') continue;
    const long = c.p.doing && c.p.doing.for > 60000 && !['needs_you', 'waiting'].includes(st);
    const bk = st === 'needs_you' ? 'need' : st === 'waiting' ? 'wait' : long ? 'clock' : st === 'thinking' ? 'think' : st === 'asleep' ? 'zz' : null;
    if (bk) Art.bubble(c.chair.x + 13, c.chair.y - 15, bk, t);
  }
}
