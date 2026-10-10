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
  lastHits = ''; lastLayoutKey = ''; renderAll();
}
const TROPHY_W = 560, TROPHY_H = 340;
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
function drawTrophyRoom(t) {
  const Wt = TROPHY_W, Ht = TROPHY_H, st = achState(), hits = [], cx = Wt / 2;
  // back wall: burgundy damask over dark wood wainscoting, gold crown moulding
  r(0, 0, Wt, 104, '#4a1b2b');
  for (let y = 8; y < 74; y += 10) for (let x = (y / 10) % 2 ? 6 : 0; x < Wt; x += 12) { r(x + 2, y, 2, 1, '#6a2a3e'); r(x + 1, y + 1, 4, 1, '#6a2a3e'); r(x + 2, y + 2, 2, 1, '#6a2a3e'); }
  r(0, 0, Wt, 4, '#d9a441'); r(0, 4, Wt, 1, '#8a6420');
  r(0, 74, Wt, 30, '#3b2418'); for (let x = 0; x < Wt; x += 28) { r(x + 3, 78, 22, 22, '#4a2e1f'); r(x + 3, 78, 22, 1, '#5a3a28'); }
  r(0, 72, Wt, 3, '#d9a441');
  // floor: polished marble checker with a soft reflection band
  for (let y = 104; y < Ht; y += 18) for (let x = 0; x < Wt; x += 18) { r(x, y, 18, 18, ((x + y) / 18) % 2 ? '#efe9dd' : '#d8d0c0'); r(x + 3, y + 4, 4, 1, '#ffffff66'); }
  r(0, 104, Wt, 2, '#2a1810');
  // brass plaque
  r(cx - 46, 8, 92, 13, PAL.ink); r(cx - 45, 9, 90, 11, '#d9a441'); r(cx - 45, 9, 90, 1, '#ffd84d'); pixText(cx - 23, 12, 'HALL OF FAME', '#3b2418');
  drawChandelier(cx - 150, 26, t); drawChandelier(cx + 150, 26, t);
  // two tall glass cabinets with lit shelves: every achievement not on the centre stage
  const legends = st.filter(a => a.tier >= 5);
  const stage = (legends.length ? legends : st.slice().sort((a, b) => b.tier - a.tier || b.progress - a.progress).slice(0, 3)).slice(0, 5);
  const rest = st.filter(a => !stage.includes(a)).sort((a, b) => b.tier - a.tier || a.id.localeCompare(b.id));
  const cab = (x, list, off) => {
    const w = 168, y = 24, h = 150;
    r(x - 4, y - 6, w + 8, h + 14, '#2a1810'); r(x - 3, y - 5, w + 6, 4, '#5a3a28'); r(x - 4, y + h + 4, w + 8, 4, '#d9a441');
    r(x, y, w, h, '#2b1d26');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,220,160,.22)'); g.addColorStop(1, 'rgba(255,220,160,.04)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
    for (let s = 0; s < 4; s++) {
      const sy = y + 34 + s * 37;
      r(x + 2, sy, w - 4, 2, '#cfe8ff88'); r(x + 2, sy + 2, w - 4, 1, '#00000055');
      for (let j = 0; j < 7; j++) {
        const a = list[off + s * 7 + j]; if (!a) continue;
        const tx = x + 14 + j * 23, k = a.tier >= 4 ? 2 : 2;
        drawTrophyCup(tx, sy - 18, k, Math.max(1, a.tier), t, off + s * 7 + j, !a.tier);
        hits.push({ x: tx - 10, y: sy - 22, w: 20, h: 24, a });
      }
    }
    drawGlass(x, y, w, h, '#d9a441');
  };
  cab(12, rest, 0); cab(Wt - 180, rest, 28);
  // centre stage: spotlights, a marble plinth, a big glass case with the legends; the crown under a dome
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const sx of [cx - 46, cx, cx + 46]) { const g = ctx.createLinearGradient(sx, 0, sx, 210); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(1, 'rgba(255,240,200,.16)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 3, 0); ctx.lineTo(sx + 3, 0); ctx.lineTo(sx + 30, 210); ctx.lineTo(sx - 30, 210); ctx.fill(); }
  ctx.restore();
  r(cx - 86, 206, 172, 16, '#b8ae9a'); r(cx - 86, 206, 172, 2, '#ffffff'); r(cx - 78, 196, 156, 12, '#d8d0c0'); r(cx - 78, 196, 156, 2, '#ffffff');
  r(cx - 90, 221, 180, 4, '#00000030');
  const bx = cx - 74, by = 96, bw = 148, bh = 100;
  r(bx - 3, by - 4, bw + 6, 4, '#d9a441'); r(bx - 3, by + bh, bw + 6, 3, '#d9a441'); r(bx - 3, by, 3, bh, '#d9a441'); r(bx + bw, by, 3, bh, '#d9a441');
  r(bx, by + bh - 14, bw, 14, '#7a1f33'); r(bx, by + bh - 14, bw, 1, '#a3283a');                              // velvet base inside
  const n = stage.length, big = n <= 4 ? 4 : 3;
  stage.forEach((a, i) => {
    const off = i - (n - 1) / 2, ax = Math.round(cx + off * (big === 4 ? 34 : 28)), top = by + bh - 14 - (i === Math.floor(n / 2) ? 8 : 4);
    r(ax - 8, top, 16, by + bh - 14 - top, '#a3283a'); r(ax - 8, top, 16, 1, '#c94a5a');
    const k = a.tier >= 5 ? big : big - 1;
    if (a.tier >= 5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(ax, top - 16, 0, ax, top - 16, 26); g.addColorStop(0, 'rgba(255,110,199,.35)'); g.addColorStop(1, 'rgba(255,110,199,0)'); ctx.fillStyle = g; ctx.fillRect(ax - 26, top - 42, 52, 52); ctx.restore(); }
    drawTrophyCup(ax, top - k * 7 - Math.max(2, k), k, Math.max(1, a.tier), t, i, !a.tier);
    if (a.tier >= 5) for (let q = 0; q < 3; q++) { const ang = t / 500 + q * 2.1 + i; r(Math.round(ax + Math.cos(ang) * 15), Math.round(top - 16 + Math.sin(ang) * 10), 1, 1, '#ffffff'); }
    hits.push({ x: ax - 15, y: top - 36, w: 30, h: 38, a });
  });
  drawGlass(bx, by, bw, bh, '#ffd84d');
  if (prog.super) { // the crown, under a glass dome on top of the case
    const dx = cx, dy = by - 22;
    r(dx - 9, dy + 12, 18, 6, '#d9a441'); r(dx - 8, dy + 4, 16, 8, '#ffd84d'); r(dx - 8, dy, 3, 4, '#ffd84d'); r(dx - 1, dy - 2, 3, 6, '#ffd84d'); r(dx + 5, dy, 3, 4, '#ffd84d');
    r(dx - 1, dy + 6, 2, 2, '#e43b44'); r(dx - 6, dy + 6, 2, 2, '#2ce8f5'); r(dx + 4, dy + 6, 2, 2, '#63c74d');
    drawGlass(dx - 12, dy - 6, 24, 18, '#ffd84d');
    hits.push({ x: dx - 12, y: dy - 6, w: 24, h: 24, title: `${T.ach.superName} · ${T.ach.superDone}` });
  }
  // plaques on the plinth: tiers reached and legends
  const got = st.reduce((x, a) => x + a.tier, 0), all = st.reduce((x, a) => x + a.max, 0);
  pixText(cx - 70, 211, `${got}/${all}`, '#3b2418'); { const lg = `${legends.length} LEGEND`; pixText(cx + 70 - lg.length * 4, 211, lg, '#a3283a'); }
  // red carpet and velvet ropes
  r(cx - 26, 225, 52, Ht - 225, '#a3283a'); r(cx - 26, 225, 2, Ht - 225, '#d9a441'); r(cx + 24, 225, 2, Ht - 225, '#d9a441');
  for (const px of [cx - 100, cx - 40, cx + 40, cx + 100]) { r(px - 1, 228, 3, 18, '#d9a441'); r(px - 2, 226, 5, 3, '#ffd84d'); r(px - 3, 245, 7, 2, '#8a6420'); }
  for (const [a2, b2] of [[cx - 100, cx - 40], [cx + 40, cx + 100]]) for (let x = a2; x <= b2; x++) { const k = (x - a2) / (b2 - a2); r(x, 231 + Math.round(Math.sin(k * Math.PI) * 6), 1, 2, '#a3283a'); }
  // the way out at the bottom
  r(cx - 22, Ht - 6, 44, 6, '#2a1810');
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
  try { drawTrophyCup(32, 10, 6, Math.max(1, a.tier), performance.now(), 0, !a.tier || hidden); } finally { ctx = prev; Art.setCtx(prev); }
  trophyCard.hidden = false;
}
trophyCard.addEventListener('click', e => { if (e.target === trophyCard) trophyCard.hidden = true; });
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!trophyCard.hidden) { trophyCard.hidden = true; return; } if (trophyView && reportEl.hidden) setTrophyView(false); });
