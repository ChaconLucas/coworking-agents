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
  r(x - 2, y, 3, h + 2, PAL.ink); r(x - 2, y + h, w + 4, 3, PAL.ink); r(x + w - 1, y, 3, h + 2, PAL.ink);
  // doorways: the carpet runs through each gap, with wooden jambs
  for (const d of G.doors) {
    if (d.side === 'right') { r(x + w - 1, d.y - 9, 3, 18, '#2f4f5a'); r(x + w - 1, d.y - 9, 3, 1, '#8f553f'); r(x + w - 1, d.y + 8, 3, 1, '#8f553f'); }
    else { const yy = d.side === 'top' ? y - 2 : y + h; r(d.x - 9, yy, 18, d.side === 'top' ? 12 : 3, '#2f4f5a'); r(d.x - 9, yy, 1, d.side === 'top' ? 12 : 3, '#8f553f'); r(d.x + 8, yy, 1, d.side === 'top' ? 12 : 3, '#8f553f'); }
  }
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
  placePlayerTag();
  lastHits = ''; lastLayoutKey = ''; renderAll();
}
const TROPHY_W = 640, TROPHY_H = 400;
function drawTrophyCup(x, y, size, tier, t, i, locked) {
  const c = locked ? '#2b2636' : TIER_COLOR[tier], d = locked ? '#221e2c' : Art.shade(TIER_COLOR[tier], .7), lt = locked ? '#2b2636' : Art.shade(TIER_COLOR[tier], 1.25), k = size;
  r(x - k * 3, y, k * 6, k * 4, PAL.ink); r(x - k * 3 + 1, y + 1, k * 6 - 2, k * 4 - 2, c);                // cup
  r(x - k * 3 + 1, y + k * 3, k * 6 - 2, Math.max(1, k - 1), d);                                            // lower shade
  r(x - k * 4, y + 1, k, k * 2, PAL.ink); r(x + k * 3, y + 1, k, k * 2, PAL.ink);                            // handles
  r(x - k * 4 + 1, y + 2, Math.max(1, k - 1), Math.max(1, k * 2 - 2), c); r(x + k * 3, y + 2, Math.max(1, k - 1), Math.max(1, k * 2 - 2), c);
  r(x - Math.max(1, k / 2), y + k * 4, Math.max(2, k), k * 2, d);                                            // stem
  r(x - k * 2, y + k * 6, k * 4, Math.max(2, k), PAL.ink); r(x - k * 2 + 1, y + k * 6, k * 4 - 2, Math.max(1, k - 1), d); // base
  if (!locked) {
    r(x - k * 2, y + 2, Math.max(1, k - 1), k * 2, lt); r(x - k * 2, y + 2, 1, k * 2, '#ffffffcc');            // shine
    const s = ((t / 140) | 0) + i * 5; if (s % 14 < 2) { r(x + k * 2, y - 3, 1, 3, '#ffffff'); r(x + k * 2 - 1, y - 2, 3, 1, '#ffffff'); }
  } else if (k >= 2) pixText(x - 1, y + k, '?', '#4a4258');
}
// glass: a pane with a frame, a faint tint and two diagonal reflections
function drawGlass(x, y, w, h, frame) {
  ctx.fillStyle = 'rgba(190, 225, 255, .10)'; ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  for (const [o, ww] of [[.15, 10], [.32, 4], [.7, 7]]) { ctx.beginPath(); const sx = x + w * o; ctx.moveTo(sx, y); ctx.lineTo(sx + ww, y); ctx.lineTo(sx + ww - h * .6, y + h); ctx.lineTo(sx - h * .6, y + h); ctx.fill(); }
  ctx.restore();
  r(x - 1, y - 1, w + 2, 1, frame); r(x - 1, y + h, w + 2, 1, frame); r(x - 1, y, 1, h, frame); r(x + w, y, 1, h, frame);
}
function drawChandelier(x, y, t) {
  r(x, 0, 1, y, '#8a6420');
  r(x - 14, y, 29, 3, '#d9a441'); r(x - 10, y + 3, 21, 2, '#b07d2a');
  for (let k = -2; k <= 2; k++) { const cx = x + k * 6; r(cx, y - 4, 1, 4, '#f4ecd8'); r(cx, y - 6 - (((t / 180 + k) | 0) % 2), 1, 2, '#ffd27a'); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, 46); g.addColorStop(0, 'rgba(255,210,122,.35)'); g.addColorStop(1, 'rgba(255,210,122,0)'); ctx.fillStyle = g; ctx.fillRect(x - 46, y - 46, 92, 92);
  ctx.restore();
}
// a different award per tier: bronze cup, silver cup with a star, gold cup with a gem, a diamond crystal,
// a winged legend trophy with a flame. k scales it; locked ones are dark silhouettes.
function drawAward(x, y, tier, k, t, i, locked) {
  // y is the bottom of the award (it stands on whatever is below)
  if (locked || tier < 1) {
    r(x - k * 3, y - k * 9, k * 6, k * 5, '#2b2636'); r(x - k, y - k * 4, k * 2, k * 2, '#2b2636'); r(x - k * 2, y - k * 2, k * 4, k * 2, '#2b2636');
    if (k >= 2) pixText(x - 1, y - k * 8, '?', '#4a4258');
    return;
  }
  const c = TIER_COLOR[tier], d = Art.shade(c, .68), lt = Art.shade(c, 1.3), ink = PAL.ink;
  if (tier === 4) { // diamond: a faceted crystal on a small stand
    r(x - k * 2, y - k * 2, k * 4, k * 2, ink); r(x - k * 2 + 1, y - k * 2 + 1, k * 4 - 2, k * 2 - 1, '#4a5a7a');
    for (let row = 0; row < k * 8; row++) { const half = row < k * 3 ? Math.round(row * 1.2) + 1 : Math.round((k * 8 - row) * .75) + 1, yy = y - k * 2 - k * 8 + row; r(x - half - 1, yy, half * 2 + 2, 1, ink); r(x - half, yy, half * 2, 1, row < k * 3 ? lt : row % 3 ? c : d); }
    r(x - 1, y - k * 9, 1, k * 3, '#ffffff'); const s = ((t / 120) | 0) + i * 7; if (s % 12 < 2) { r(x + k * 2, y - k * 10, 1, 3, '#fff'); r(x + k * 2 - 1, y - k * 10 + 1, 3, 1, '#fff'); }
    return;
  }
  // cups (bronze, silver, gold) and the legend
  const tall = tier >= 3 ? 1 : 0, top = y - k * (9 + tall * 2);
  r(x - k * 2, y - k * 2, k * 4, k * 2, ink); r(x - k * 2 + 1, y - k * 2 + 1, k * 4 - 2, k * 2 - 1, d);              // base
  r(x - Math.max(1, k / 2), y - k * (4 + tall), Math.max(2, k), k * (2 + tall), d);                                   // stem
  r(x - k * 3, top, k * 6, k * 5, ink); r(x - k * 3 + 1, top + 1, k * 6 - 2, k * 5 - 2, c); r(x - k * 3 + 1, top + k * 4 - 1, k * 6 - 2, Math.max(1, k - 1), d);
  r(x - k * 4, top + 1, k, k * 2 + 1, ink); r(x + k * 3, top + 1, k, k * 2 + 1, ink);                                 // handles
  r(x - k * 2, top + 2, Math.max(1, k - 1), k * 3, lt); r(x - k * 2, top + 2, 1, k * 3, '#ffffffcc');                // shine
  if (tier === 2) { r(x, top + k * 2 - 1, 1, 3, '#ffffff'); r(x - 1, top + k * 2, 3, 1, '#ffffff'); }                 // silver: a star
  if (tier === 3) { r(x - 1, top + k * 2 - 1, 3, 3, ink); r(x, top + k * 2, 1, 1, '#e43b44'); }                        // gold: a ruby
  if (tier >= 5) { // legend: wings and a flame
    for (let w2 = 0; w2 < 3; w2++) { r(x - k * 4 - (w2 + 1) * k, top + w2 * k, k, k * 3 - w2 * k, lt); r(x + k * 4 + w2 * k, top + w2 * k, k, k * 3 - w2 * k, lt); }
    const fl = ((t / 110) | 0) % 3;
    r(x - k, top - k * 2, k * 2, k * 2, '#feae34'); r(x - Math.max(1, k / 2), top - k * 3 - fl, Math.max(1, k), k + fl, '#ffd84d'); r(x, top - k * 3 - fl - 1, 1, 1, '#ffffff');
  }
  const s = ((t / 140) | 0) + i * 5; if (s % 14 < 2) { r(x + k * 2, top - 3, 1, 3, '#ffffff'); r(x + k * 2 - 1, top - 2, 3, 1, '#ffffff'); }
}
// a marble pedestal with a glass dome and a nameplate strip in the tier colour
function drawPedestal(x, y, w, h, tier) {
  r(x - w / 2, y, w, h, PAL.ink); r(x - w / 2 + 1, y + 1, w - 2, h - 1, '#e8e2d6'); r(x - w / 2 + 1, y + 1, w - 2, 2, '#ffffff');
  r(x - w / 2 - 2, y - 2, w + 4, 3, PAL.ink); r(x - w / 2 - 1, y - 2, w + 2, 2, '#f4efe4');
  r(x - w / 2 + 3, y + h - 6, w - 6, 3, tier ? TIER_COLOR[tier] : '#8b9bb4');
}
function drawDome(x, y, w, h) {
  ctx.fillStyle = 'rgba(200, 230, 255, .12)'; ctx.fillRect(x - w / 2, y - h + 4, w, h - 4); ctx.fillRect(x - w / 2 + 2, y - h + 1, w - 4, 3);
  r(x - w / 2, y - h + 4, 1, h - 4, '#ffffff88'); r(x + w / 2 - 1, y - h + 4, 1, h - 4, '#ffffff55'); r(x - w / 2 + 2, y - h + 1, w - 4, 1, '#ffffff88');
  r(x - w / 2 + 3, y - h + 6, 1, h - 12, '#ffffffaa');
}
function drawTrophyRoom(t) {
  const Wt = TROPHY_W, Ht = TROPHY_H, st = achState(), hits = [], cx = Wt / 2, sorted = st.slice().sort((a, b) => b.tier - a.tier || b.progress - a.progress);
  // ---- back wall: damask, wainscoting, gold mouldings ----
  r(0, 0, Wt, 150, '#3f1626');
  for (let y = 10; y < 108; y += 10) for (let x = (y / 10) % 2 ? 6 : 0; x < Wt; x += 12) { r(x + 2, y, 2, 1, '#5a2236'); r(x + 1, y + 1, 4, 1, '#5a2236'); r(x + 2, y + 2, 2, 1, '#5a2236'); }
  r(0, 0, Wt, 5, '#d9a441'); r(0, 5, Wt, 1, '#8a6420');
  r(0, 112, Wt, 38, '#3b2418'); for (let x = 0; x < Wt; x += 30) { r(x + 3, 116, 24, 30, '#4a2e1f'); r(x + 3, 116, 24, 1, '#5e3c2a'); }
  r(0, 109, Wt, 3, '#d9a441');
  // ---- centre: a stained-glass arch, the crown on a tall pedestal under a dome ----
  const ax = cx - 46;
  r(ax - 4, 8, 100, 104, '#d9a441'); r(ax, 12, 92, 100, '#1b1d2e');
  const glass = ['#e43b44', '#ffd84d', '#2ce8f5', '#63c74d', '#b55088', '#3b5dc9'];
  for (let y = 0; y < 98; y += 8) for (let x = 0; x < 90; x += 8) { const h2 = hash('sg' + x + ':' + y); r(ax + 1 + x, 13 + y, 7, 7, glass[h2 % glass.length] + (((t / 900 + h2) | 0) % 5 === 0 ? 'ff' : 'b0')); }
  for (let x = ax; x < ax + 92; x += 8) r(x, 12, 1, 100, '#1b1d2e'); for (let y = 12; y < 112; y += 8) r(ax, y, 92, 1, '#1b1d2e');
  r(ax + 46 - 1, 12, 2, 100, '#d9a441'); r(ax, 60, 92, 2, '#d9a441');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createLinearGradient(0, 112, 0, 260); lg.addColorStop(0, 'rgba(255,220,170,.22)'); lg.addColorStop(1, 'rgba(255,220,170,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(ax, 112); ctx.lineTo(ax + 92, 112); ctx.lineTo(ax + 140, 260); ctx.lineTo(ax - 48, 260); ctx.fill(); ctx.restore();
  // ---- four lit niches with columns: the legends ----
  const legends = sorted.filter(a => a.tier >= 5), niches = [cx - 230, cx - 132, cx + 132, cx + 230];
  niches.forEach((nx, i) => {
    r(nx - 30, 18, 60, 94, PAL.ink); r(nx - 28, 20, 56, 92, '#2a1018');
    r(nx - 26, 30, 52, 82, '#5a2a1a'); r(nx - 22, 24, 44, 6, '#5a2a1a'); r(nx - 16, 21, 32, 3, '#5a2a1a'); // arch
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(nx, 70, 0, nx, 70, 40); g.addColorStop(0, 'rgba(255,200,120,.45)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(nx - 30, 22, 60, 90); ctx.restore();
    for (const cxx of [nx - 33, nx + 30]) { r(cxx, 14, 5, 98, '#e8e2d6'); r(cxx, 14, 5, 3, '#d9a441'); r(cxx, 109, 5, 3, '#d9a441'); r(cxx + 1, 18, 1, 90, '#ffffff'); }
    const a = legends[i];
    drawPedestal(nx, 92, 26, 18, a ? 5 : 0);
    if (a) { drawAward(nx, 90, 5, 3, t, i, false); hits.push({ x: nx - 24, y: 30, w: 48, h: 80, a }); }
    else { pixText(nx - 1, 70, '?', '#7a5040'); }
  });
  // ---- floor: marble with perspective lines, the red carpet ----
  for (let y = 150; y < Ht; y += 16) for (let x = 0; x < Wt; x += 16) { r(x, y, 16, 16, ((x + y) / 16) % 2 ? '#efe9dd' : '#ddd5c5'); r(x + 3, y + 3, 5, 1, '#ffffff77'); }
  r(0, 150, Wt, 3, '#2a1810');
  r(cx - 24, 186, 48, Ht - 186, '#a3283a'); r(cx - 24, 186, 2, Ht - 186, '#d9a441'); r(cx + 22, 186, 2, Ht - 186, '#d9a441');
  // crown pedestal (in front of the arch)
  drawPedestal(cx, 156, 40, 30, prog.super ? 5 : 0);
  if (prog.super) {
    const dx = cx, dy = 130;
    r(dx - 12, dy + 14, 24, 8, '#d9a441'); r(dx - 11, dy + 4, 22, 10, '#ffd84d'); r(dx - 11, dy - 2, 4, 6, '#ffd84d'); r(dx - 2, dy - 5, 4, 9, '#ffd84d'); r(dx + 7, dy - 2, 4, 6, '#ffd84d');
    r(dx - 1, dy + 7, 3, 3, '#e43b44'); r(dx - 8, dy + 7, 3, 3, '#2ce8f5'); r(dx + 6, dy + 7, 3, 3, '#63c74d');
    hits.push({ x: dx - 16, y: dy - 8, w: 32, h: 32, title: `${T.ach.superName} · ${T.ach.superDone}` });
  } else pixText(cx - 1, 140, '?', '#8a7a6a');
  drawDome(cx, 154, 34, 32);
  // ---- front: individual domes on pedestals for the next best (diamond, gold, silver), in two curved rows ----
  const front = sorted.filter(a => a.tier >= 1 && !legends.slice(0, 4).includes(a)).slice(0, 16);
  front.forEach((a, i) => {
    const side = i % 2 ? 1 : -1, j = Math.floor(i / 2), row = j < 4 ? 0 : 1, col = j % 4;
    const px = Math.round(cx + side * (64 + col * 36 + row * 18)), py = row ? 300 : 240 - Math.round(col * 4);
    drawPedestal(px, py, 22, 22, a.tier);
    drawAward(px, py - 2, a.tier, 2, t, i, false);
    drawDome(px, py, 26, 30);
    hits.push({ x: px - 13, y: py - 30, w: 26, h: 52, a });
  });
  // ---- side glass cabinets: everything else (bronze, still locked) ----
  const restA = sorted.filter(a => !front.includes(a) && !legends.slice(0, 4).includes(a));
  const cab = (x, list) => {
    const w = 64, y = 160, h = 170;
    r(x - 3, y - 4, w + 6, h + 8, '#2a1810'); r(x, y, w, h, '#2b1d26');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,220,160,.2)'); g.addColorStop(1, 'rgba(255,220,160,.03)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
    list.forEach((a, i) => {
      const sx = x + 10 + (i % 3) * 22, sy = y + 30 + Math.floor(i / 3) * 28;
      if (i % 3 === 0) { r(x + 2, sy + 1, w - 4, 2, '#cfe8ff88'); }
      drawAward(sx, sy, a.tier, 1, t, i, !a.tier);
      hits.push({ x: sx - 9, y: sy - 16, w: 18, h: 18, a });
    });
    drawGlass(x, y, w, h, '#d9a441');
  };
  cab(8, restA.slice(0, Math.ceil(restA.length / 2))); cab(Wt - 72, restA.slice(Math.ceil(restA.length / 2)));
  // velvet ropes along the carpet
  for (const px of [cx - 40, cx + 40]) for (const py of [200, 260, 320]) { r(px - 1, py, 3, 16, '#d9a441'); r(px - 2, py - 2, 5, 3, '#ffd84d'); r(px - 3, py + 15, 7, 2, '#8a6420'); }
  for (const px of [cx - 40, cx + 40]) for (const [a2, b2] of [[200, 260], [260, 320]]) for (let y = a2 + 2; y < b2; y++) { const k = (y - a2) / (b2 - a2); r(px + Math.round(Math.sin(k * Math.PI) * 4) * (px < cx ? -1 : 1), y, 2, 1, '#a3283a'); }
  // chandeliers and the brass plaque
  drawChandelier(cx - 180, 24, t); drawChandelier(cx + 180, 24, t);
  r(cx - 50, Ht - 34, 100, 15, PAL.ink); r(cx - 49, Ht - 33, 98, 13, '#d9a441'); r(cx - 49, Ht - 33, 98, 1, '#ffd84d'); pixText(cx - 23, Ht - 29, 'HALL OF FAME', '#3b2418');
  const got = st.reduce((x, a) => x + a.tier, 0), all = st.reduce((x, a) => x + a.max, 0);
  pixText(cx - 70, Ht - 12, `${got}/${all}`, '#8a6420'); { const l2 = `${legends.length} LEGEND`; pixText(cx + 70 - l2.length * 4, Ht - 12, l2, '#a3283a'); }
  trophyHits = hits;
}
// clicking a trophy: a card with the trophy large, its tier and how far the next one is
const trophyCard = document.createElement('div');
trophyCard.className = 'trophy-card'; trophyCard.hidden = true;
document.body.appendChild(trophyCard);
function showTrophy(a) {
  const A = T.ach, hidden = a.secret && !a.tier, info = hidden ? { name: '???', desc: () => A.secret } : A.list[a.id];
  trophyCard.innerHTML = `<div class="tc-box"><canvas width="64" height="64"></canvas><div><b>${esc(info.name)}</b><small style="color:${TIER_COLOR[a.tier]}">${esc(a.tier ? A.tiers[a.tier] : A.locked)}</small>
    <p>${esc(info.desc(a.next || a.steps[a.max - 1]))}</p>${hidden ? '' : `<div class="ach-bar" style="--c:${TIER_COLOR[Math.max(1, a.tier)]}"><i style="width:${(a.progress * 100).toFixed(1)}%"></i></div>
    <div class="ach-foot"><span class="pips">${a.steps.map((s, i) => `<i style="background:${i < a.tier ? TIER_COLOR[i + 1] : 'transparent'}" title="${esc(A.tiers[i + 1])}: ${esc(fmtStep(a, s))}"></i>`).join('')}</span><span>${a.next ? `${esc(fmtStep(a, a.value))} / ${esc(fmtStep(a, a.next))}` : esc(A.maxed)}</span></div>`}</div></div>`;
  const c = trophyCard.querySelector('canvas'), prev = ctx; ctx = c.getContext('2d'); Art.setCtx(ctx);
  try { drawAward(32, 62, Math.max(1, a.tier), 5, performance.now(), 0, !a.tier || hidden); } finally { ctx = prev; Art.setCtx(prev); }
  trophyCard.hidden = false;
}
trophyCard.addEventListener('click', e => { if (e.target === trophyCard) trophyCard.hidden = true; });
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!trophyCard.hidden) { trophyCard.hidden = true; return; } if (trophyView && reportEl.hidden) setTrophyView(false); });
