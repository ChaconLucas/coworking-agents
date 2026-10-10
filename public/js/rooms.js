'use strict';
// ---------------- the game room (a real room under the team rooms) and the trophy room (its own screen) ----------------

// ---- game room: walls, carpet, a door to the corridor; games and the things that open each report tab ----
// geometry comes from the floor plan (floorStates[i].game); spots are fixed so agents can walk to them
let gameBox = null, gameHits = [];
function gameSpots(G) {
  if (!G) return null;
  const mid = G.y + 58;
  return {
    foos: [{ x: G.x + 54, y: mid, zone: 'lounge', pose: 'stand' }, { x: G.x + 112, y: mid, zone: 'lounge', pose: 'stand', flip: true }],
    cooler: [{ x: G.x + G.w - 64, y: G.y + 22, zone: 'lounge', pose: 'stand' }, { x: G.x + G.w - 38, y: G.y + 22, zone: 'lounge', pose: 'stand', flip: true }],
  };
}
function drawGameRoom(G, t, glows) {
  gameHits = [];
  if (!G) { gameBox = null; devSpots = null; return; }
  gameBox = G;
  const { x, y, w, h } = G, hit = (b, attr, title) => gameHits.push({ ...b, attr, title });
  // floor: dark teal carpet with a diamond pattern
  r(x, y, w, h, '#2f4f5a');
  for (let yy = 4; yy < h; yy += 8) for (let xx = (yy / 8) % 2 ? 4 : 0; xx < w; xx += 8) r(x + xx, y + yy, 2, 2, '#365b67');
  // walls (the top one has a face), door on the right wall to the corridor
  r(x - 2, y - 2, w + 4, 3, PAL.ink); r(x - 2, y + 1, w + 4, 8, PAL.wall); r(x - 2, y + 9, w + 4, 1, PAL.wallShade);
  r(x - 2, y, 3, h + 2, PAL.ink); r(x - 2, y + h, w + 4, 3, PAL.ink);
  r(x + w - 1, y, 3, G.doorY - y - 9, PAL.ink); r(x + w - 1, G.doorY + 9, 3, y + h - G.doorY - 9, PAL.ink);
  r(x + w - 1, G.doorY - 9, 3, 1, '#8f553f'); r(x + w - 1, G.doorY + 8, 3, 1, '#8f553f');
  // left: two arcades and a bookshelf on the wall
  Art.drawArcade(x + 8, y + 6, t, glows); Art.drawArcade(x + 30, y + 6, t, glows);
  // wall centre: notice board (today's files) and the newspaper rack (the weekly paper)
  const nb = x + Math.round(w * .32);
  drawNoticeBoard(nb, y + 2);
  drawPaperRack(nb + 52, y + 12, t);
  hit({ x: nb + 50, y: y + 8, w: 18, h: 26 }, 'data-tab="paper"', T.paper.tab);
  // the golden door to the trophy room, top right
  const dx = x + w - 104;
  drawTrophyDoor(dx, y + 1, t, glows);
  hit({ x: dx - 2, y, w: 34, h: 32 }, 'data-trophyroom="1"', T.trophy.enter);
  // water cooler between the door and the corner
  drawCooler(x + w - 52, y + 6, t);
  // middle row: foosball, pool table, aquarium
  const playing = layout.filter(c => c.actor && c.actor.mode === 'lounge' && c.actor.spot && devSpots && devSpots.foos && devSpots.foos.some(s => s.x === c.actor.spot.x && s.y === c.actor.spot.y)).length >= 2;
  drawFoosball(x + 64, y + 52, t, playing);
  if (w >= 360) drawPool(x + Math.round(w / 2) - 10, y + 50);
  if (w >= 300) drawAquarium(x + w - 46, y + 56, t, glows);
  // bottom: bean bags, the vending machine (shop), an easel (customise), the guestbook (history)
  Art.drawBeanBag(x + 8, y + h - 26, '#b55088'); Art.drawBeanBag(x + 30, y + h - 24, '#0099db');
  const bx = x + Math.round(w * .3);
  drawVending(bx, y + h - 40, t, glows); hit({ x: bx - 1, y: y + h - 41, w: 22, h: 38 }, 'data-tab="shop"', T.shop.title);
  drawEasel(bx + 32, y + h - 34); hit({ x: bx + 30, y: y + h - 35, w: 18, h: 30 }, 'data-tab="office"', T.office.tab);
  drawGuestbook(bx + 58, y + h - 26); hit({ x: bx + 56, y: y + h - 28, w: 16, h: 22 }, 'data-tab="feed"', T.feed.title);
  Art.drawPlant(x + w - 18, y + h - 22, true);
  devSpots = gameSpots(G);
}
function drawPaperRack(x, y, t) {
  r(x - 1, y - 1, 16, 22, PAL.ink); r(x, y, 14, 20, '#6b4a33'); r(x + 1, y + 2, 12, 7, '#f4ecd8'); r(x + 1, y + 11, 12, 7, '#f4ecd8');
  r(x + 2, y + 3, 8, 1, '#2a1d27'); r(x + 2, y + 5, 10, 1, '#8a7a6a'); r(x + 2, y + 12, 8, 1, '#2a1d27'); r(x + 2, y + 14, 10, 1, '#8a7a6a');
}
function drawTrophyDoor(x, y, t, glows) {
  r(x - 1, y, 32, 31, PAL.ink); r(x, y + 1, 30, 30, '#b07d2a');
  r(x + 2, y + 6, 12, 24, '#d9a441'); r(x + 16, y + 6, 12, 24, '#d9a441'); r(x + 13, y + 16, 1, 3, '#8a6420'); r(x + 16, y + 16, 1, 3, '#8a6420');
  r(x + 2, y + 2, 26, 3, '#2b2336'); pixText(x + 4, y + 2, 'TROPHY', '#ffd84d');
  const s = ((t / 160) | 0) % 9; r(x + 4 + s * 3, y + 8 + (s % 3) * 6, 1, 1, '#ffffff');
  glows.push({ x: x + 15, y: y + 16, r: 26, c: '#ffd84d' });
}
function drawVending(x, y, t, glows) {
  r(x - 1, y - 1, 22, 38, PAL.ink); r(x, y, 20, 36, '#3b5dc9'); r(x + 2, y + 2, 12, 24, '#1b1622');
  for (let row = 0; row < 4; row++) for (let k = 0; k < 3; k++) r(x + 3 + k * 4, y + 4 + row * 6, 3, 3, ['#ffd84d', '#e43b44', '#63c74d', '#ff6ec7'][(row + k) % 4]);
  r(x + 15, y + 4, 4, 6, '#c0cbdc'); r(x + 16, y + 12, 2, 2, '#ffd84d'); r(x + 2, y + 29, 12, 4, '#14141c');
  r(x + 1, y - 6, 18, 6, PAL.ink); pixText(x + 3, y - 5, 'SHOP', ((t / 600) | 0) % 2 ? '#ffd84d' : '#ffffff');
  glows.push({ x: x + 10, y: y + 14, r: 18, c: '#2ce8f5' });
}
function drawEasel(x, y) {
  r(x + 2, y + 12, 1, 18, '#6b4a33'); r(x + 13, y + 12, 1, 18, '#6b4a33'); r(x + 7, y + 14, 1, 16, '#6b4a33');
  r(x - 1, y - 1, 18, 15, PAL.ink); r(x, y, 16, 13, '#f4ecd8');
  r(x + 2, y + 2, 5, 4, '#ff6ec7'); r(x + 7, y + 5, 6, 5, '#2ce8f5'); r(x + 4, y + 8, 4, 3, '#ffd84d');
}
function drawGuestbook(x, y) {
  r(x + 5, y + 8, 3, 12, PAL.ink); r(x + 2, y + 19, 9, 2, PAL.ink);
  r(x - 1, y - 1, 15, 10, PAL.ink); r(x, y, 13, 8, '#e43b44'); r(x + 1, y + 1, 5, 6, '#f4ecd8'); r(x + 7, y + 1, 5, 6, '#f4ecd8');
  r(x + 2, y + 2, 3, 1, '#8a7a6a'); r(x + 8, y + 2, 3, 1, '#8a7a6a'); r(x + 2, y + 4, 3, 1, '#8a7a6a'); r(x + 8, y + 4, 3, 1, '#8a7a6a');
}

// ---- trophy room: its own screen; the best trophies on a lit dais in the middle, the rest on the walls ----
let trophyView = false, trophyHits = [];
function setTrophyView(on) {
  trophyView = on;
  document.body.classList.toggle('trophy-view', on);
  if (on) { achBump('trophyVisits'); camera(null); selected = null; renderPanel(); scrollTo(0, 0); }
  lastHits = ''; lastLayoutKey = ''; renderAll();
}
const TROPHY_W = 480, TROPHY_H = 300;
function drawTrophyCup(x, y, size, tier, t, i, locked) {
  const c = locked ? '#3a3448' : TIER_COLOR[tier], d = locked ? '#2b2636' : Art.shade(TIER_COLOR[tier], .7), k = size;
  r(x - k * 3, y, k * 6, k * 4, PAL.ink); r(x - k * 3 + 1, y + 1, k * 6 - 2, k * 4 - 2, c);         // cup
  r(x - k * 4, y + 1, k, k * 2, PAL.ink); r(x + k * 3, y + 1, k, k * 2, PAL.ink);                       // handles
  r(x - k * 4 + 1, y + 2, Math.max(1, k - 1), k * 2 - 2, c); r(x + k * 3, y + 2, Math.max(1, k - 1), k * 2 - 2, c);
  r(x - Math.max(1, k / 2), y + k * 4, Math.max(2, k), k * 2, d);                                       // stem
  r(x - k * 2, y + k * 6, k * 4, Math.max(2, k), PAL.ink); r(x - k * 2 + 1, y + k * 6, k * 4 - 2, Math.max(1, k - 1), d); // base
  if (!locked) {
    r(x - k * 2, y + 2, Math.max(1, k - 1), k * 2, '#ffffffaa');                                        // shine
    const s = ((t / 140) | 0) + i * 5; if (s % 14 < 2) { r(x + k * 2, y - 3, 1, 3, '#ffffff'); r(x + k * 2 - 1, y - 2, 3, 1, '#ffffff'); }
  } else pixText(x - 1, y + k, '?', '#5a5068');
}
function drawTrophyRoom(t) {
  const Wt = TROPHY_W, Ht = TROPHY_H, st = achState(), hits = [];
  // marble floor, dark velvet walls, gold trim
  for (let y = 70; y < Ht; y += 16) for (let x = 0; x < Wt; x += 16) r(x, y, 16, 16, ((x + y) / 16) % 2 ? '#e8e2d6' : '#d6cfc0');
  r(0, 0, Wt, 70, '#3b1f3f'); for (let x = 0; x < Wt; x += 12) r(x, 0, 6, 70, '#43244a');
  r(0, 66, Wt, 4, '#d9a441'); r(0, 70, Wt, 1, '#8a6420');
  // red carpet from the entrance to the dais
  r(Wt / 2 - 22, 150, 44, Ht - 150, '#a3283a'); r(Wt / 2 - 22, 150, 2, Ht - 150, '#d9a441'); r(Wt / 2 + 20, 150, 2, Ht - 150, '#d9a441');
  // banners
  for (const bx of [40, Wt - 64]) { r(bx, 6, 24, 40, '#a3283a'); r(bx, 44, 12, 6, '#a3283a'); r(bx + 12, 44, 12, 4, '#a3283a'); r(bx + 8, 14, 8, 8, '#d9a441'); }
  pixText(Wt / 2 - 38, 8, 'HALL OF FAME', '#ffd84d');
  // the dais: legends in an arc, the super crown on top when unlocked
  const legends = st.filter(a => a.tier >= 5), cx = Wt / 2, dy = 118;
  r(cx - 90, dy + 28, 180, 10, '#8a6420'); r(cx - 84, dy + 22, 168, 8, '#b07d2a'); r(cx - 76, dy + 16, 152, 8, '#d9a441');
  // spotlights from the ceiling on the dais
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const sx of [cx - 50, cx, cx + 50]) { const g = ctx.createLinearGradient(sx, 0, sx, dy + 30); g.addColorStop(0, 'rgba(255,240,200,.0)'); g.addColorStop(1, 'rgba(255,240,200,.18)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 4, 0); ctx.lineTo(sx + 4, 0); ctx.lineTo(sx + 26, dy + 30); ctx.lineTo(sx - 26, dy + 30); ctx.fill(); }
  ctx.restore();
  if (prog.super) {
    const k = ((t / 300) | 0) % 2;
    r(cx - 10, dy - 40, 20, 10, '#ffd84d'); r(cx - 10, dy - 46, 4, 6, '#ffd84d'); r(cx - 2, dy - 50, 4, 10, '#ffd84d'); r(cx + 6, dy - 46, 4, 6, '#ffd84d');
    r(cx - 1, dy - 36, 2, 2, '#e43b44'); r(cx - 7, dy - 36, 2, 2, '#2ce8f5'); r(cx + 5, dy - 36, 2, 2, '#63c74d');
    if (k) r(cx + 9, dy - 52, 1, 3, '#ffffff');
    hits.push({ x: cx - 12, y: dy - 52, w: 24, h: 24, title: `${T.ach.superName} · ${T.ach.superDone}` });
  }
  const show = legends.length ? legends : st.slice().sort((a, b) => b.tier - a.tier || b.progress - a.progress).slice(0, 3);
  const arc = show.slice(0, 7), n = arc.length;
  arc.forEach((a, i) => {
    // each trophy on its own pedestal standing on the dais; the middle one is the tallest
    const off = i - (n - 1) / 2, ax = Math.round(cx + off * 30), ped = 14 - Math.round(Math.abs(off) * 3), top = dy + 16 - ped, big = a.tier >= 5, k = big ? 3 : 2;
    r(ax - 9, top, 18, ped, PAL.ink); r(ax - 8, top + 1, 16, ped - 1, '#e8e2d6'); r(ax - 8, top + 1, 16, 2, '#ffffff'); r(ax - 8, top + ped - 2, 16, 1, '#c9c0ae');
    if (big) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(ax, top - 12, 0, ax, top - 12, 22); g.addColorStop(0, 'rgba(255,110,199,.35)'); g.addColorStop(1, 'rgba(255,110,199,0)'); ctx.fillStyle = g; ctx.fillRect(ax - 22, top - 34, 44, 44); ctx.restore(); }
    drawTrophyCup(ax, top - k * 7 - Math.max(2, k), k, Math.max(1, a.tier), t, i, !a.tier);
    if (big) for (let q = 0; q < 3; q++) { const ang = t / 500 + q * 2.1 + i; r(Math.round(ax + Math.cos(ang) * 14), Math.round(top - 12 + Math.sin(ang) * 9), 1, 1, '#ffffff'); }
    hits.push({ x: ax - 14, y: top - 30, w: 28, h: 30 + ped, a });
  });
  // wall shelves: every other achievement, best tiers first, small cups; locked ones as silhouettes
  const rest = st.filter(a => !arc.includes(a)).sort((a, b) => b.tier - a.tier || a.id.localeCompare(b.id));
  const shelves = [[14, 82], [14, 128], [14, 174], [Wt - 154, 82], [Wt - 154, 128], [Wt - 154, 174]];
  let k2 = 0;
  for (const [sx, sy] of shelves) {
    r(sx - 2, sy + 30, 144, 4, '#6b4a33'); r(sx - 2, sy + 34, 144, 1, PAL.ink);
    for (let j = 0; j < 7 && k2 < rest.length; j++, k2++) {
      const a = rest[k2], tx = sx + 10 + j * 20;
      drawTrophyCup(tx, sy + 12, 1, Math.max(1, a.tier), t, k2, !a.tier);
      hits.push({ x: tx - 9, y: sy + 6, w: 18, h: 24, a });
    }
  }
  // the entrance (back to the office) at the bottom of the carpet
  r(cx - 18, Ht - 8, 36, 8, PAL.ink); r(cx - 16, Ht - 7, 32, 7, '#6b4a33');
  // counters on the wall: tiers and legends
  const got = st.reduce((n2, a) => n2 + a.tier, 0), all = st.reduce((n2, a) => n2 + a.max, 0);
  pixText(10, 52, `${got}/${all}`, '#ffd84d'); pixText(Wt - 10 - String(legends.length).length * 4 - 8, 52, `${legends.length} L`, '#ff6ec7');
  trophyHits = hits;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape' && trophyView && reportEl.hidden) setTrophyView(false); });
