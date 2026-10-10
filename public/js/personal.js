'use strict';
// ---------------- personalise: name, floor, walls, rooms, desks, windows, sky, light, mascot, accent, plants, radio, you ----------------
// Saved in progress.json (prog.style, prog.officeName, prog.mascot). Every option changes what is drawn.
const STYLE = {
  floor: ['wood', 'darkwood', 'carpet', 'concrete', 'tiles', 'checker', 'marble', 'grass'],
  wall: { cream: ['#ead4aa', '#d9bd8f'], white: ['#f2efe8', '#dcd8cf'], mint: ['#cfe8d8', '#b4d6c0'], sky: ['#cfe3f2', '#b4cfe4'], lavender: ['#ddd3ee', '#c6b9e0'], peach: ['#f5d3c0', '#e6baa2'], olive: ['#c9c99a', '#b0b07e'], navy: ['#3a4566', '#2f3955'], charcoal: ['#3a3a40', '#2e2e34'], brick: ['#b86a4f', '#a25a42'] },
  rooms: { classic: ['#6b5a7a', '#5a6b7a', '#5a7a6b', '#7a6b5a', '#7a5a62', '#5f6f8a', '#6f8a5f'], pastel: ['#a99bc0', '#9bb3c0', '#9bc0ae', '#c0b39b', '#c09ba8', '#a8b8d8', '#b8d8a8'], dark: ['#3a3048', '#30404a', '#304a3e', '#4a4030', '#4a3038', '#343e52', '#3e5234'], neon: ['#6a2a8a', '#1e5a8a', '#1e8a5a', '#8a6a1e', '#8a1e5a', '#2a3a9a', '#3a9a2a'], mono: ['#5a5a62', '#62625a', '#5a625a', '#625a5a', '#5a5a5a', '#6a6a72', '#72726a'] },
  desk: { wood: ['#c37a55', '#dc9a6c', '#9c5a3e', '#7a4430'], white: ['#e8e4dc', '#ffffff', '#c8c2b6', '#a8a296'], black: ['#3a3640', '#4e4a56', '#2a2630', '#1e1a24'], pink: ['#e88aa8', '#f4a8c0', '#c06a88', '#a0506e'], oak: ['#d9b47a', '#ecc890', '#b8935a', '#946f40'] },
  view: ['city', 'beach', 'mountains', 'forest', 'space'],
  sky: ['auto', 'day', 'sunset', 'night'],
  light: ['natural', 'warm', 'cool', 'neon'],
  accent: { orange: '#d97757', blue: '#3b82f6', green: '#22a06b', purple: '#8b5cf6', pink: '#e8579a', gold: '#d9a441' },
  plants: ['normal', 'jungle'],
  station: ['auto', 'lofi', 'upbeat', 'retro'],
};
const MASCOTS = ['cat', 'dog', 'robot', 'fox', 'penguin', 'bunny'];
// the chosen value of an option (an old "floor/wall" theme string still counts)
function opt(k) {
  const s = prog.style || {}, legacy = String(prog.theme || '').split('/'), list = STYLE[k], keys = Array.isArray(list) ? list : Object.keys(list);
  const v = s[k] || (k === 'floor' ? legacy[0] : k === 'wall' ? legacy[1] : '');
  return keys.includes(v) ? v : keys[0];
}
function setOpt(k, v) { prog.style = { ...(prog.style || {}), [k]: v }; saveProgress(); achAdd('themesTried', k + ':' + v); achBump('decorate'); applyAccent(); }

// palette swaps before drawing: walls and desks live in the shared palette
const DESK0 = { deskTop: PAL.deskTop, deskLight: PAL.deskLight, deskFront: PAL.deskFront, deskDark: PAL.deskDark };
function applyTheme() {
  const w = STYLE.wall[opt('wall')]; PAL.wall = w[0]; PAL.wallShade = w[1];
  const d = opt('desk') === 'wood' ? [DESK0.deskTop, DESK0.deskLight, DESK0.deskFront, DESK0.deskDark] : STYLE.desk[opt('desk')];
  [PAL.deskTop, PAL.deskLight, PAL.deskFront, PAL.deskDark] = d;
}
const roomHues = () => STYLE.rooms[opt('rooms')];
function applyAccent() { try { document.documentElement.style.setProperty('--accent', STYLE.accent[opt('accent')]); } catch {} }
applyAccent();
// the sky can be pinned: always day, always sunset, always night
function styleHour(h) { const s = opt('sky'); return s === 'day' ? 12 : s === 'sunset' ? 18.5 : s === 'night' ? 23 : h; }
// the room's light: a soft tint on top of everything (before the lights and glows)
function lightTint() {
  const l = opt('light');
  if (l === 'warm') { ctx.fillStyle = 'rgba(255,170,90,.07)'; ctx.fillRect(0, 0, W, H); }
  if (l === 'cool') { ctx.fillStyle = 'rgba(110,160,255,.07)'; ctx.fillRect(0, 0, W, H); }
  if (l === 'neon') { ctx.fillStyle = 'rgba(200,80,255,.08)'; ctx.fillRect(0, 0, W, H); }
}

function drawThemedFloor(W, H, top) {
  const f = opt('floor');
  if (f === 'wood') return Art.drawFloor(W, H, top);
  if (f === 'darkwood') { Art.drawFloor(W, H, top); ctx.fillStyle = 'rgba(40,20,10,.45)'; ctx.fillRect(0, top, W, H - top); return; }
  if (f === 'carpet') { r(0, top, W, H - top, '#5a6b8a'); for (let y = top; y < H; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < W; x += 4) r(x, y, 1, 1, '#677a9c'); return; }
  if (f === 'concrete') {
    r(0, top, W, H - top, '#9a9a96');
    for (let i = 0; i < W * (H - top) / 900; i++) { const h = hash('cc' + i); r(h % W, top + (h >>> 9) % (H - top), 1 + h % 2, 1, h % 3 ? '#8c8c88' : '#a8a8a4'); }
    for (let x = 0; x < W; x += 64) r(x, top, 1, H - top, '#85857f'); for (let y = top; y < H; y += 64) r(0, y, W, 1, '#85857f');
    return;
  }
  if (f === 'tiles') { for (let y = top; y < H; y += 12) for (let x = 0; x < W; x += 12) r(x, y, 12, 12, ((x + y) / 12) % 2 ? '#e8e2d6' : '#cfc6b4'); return; }
  if (f === 'checker') { for (let y = top; y < H; y += 10) for (let x = 0; x < W; x += 10) r(x, y, 10, 10, ((x + y) / 10) % 2 ? '#2a2a30' : '#e8e4dc'); return; }
  if (f === 'marble') { for (let y = top; y < H; y += 20) for (let x = 0; x < W; x += 20) { r(x, y, 20, 20, ((x + y) / 20) % 2 ? '#efe9dd' : '#ddd5c5'); const h = hash('mb' + x + ':' + y); r(x + h % 14, y + (h >>> 5) % 14, 5, 1, '#c9c0ae'); } return; }
  // grass: an indoor lawn
  r(0, top, W, H - top, '#4f8f3a'); for (let i = 0; i < W * (H - top) / 60; i++) { const h = hash('gr' + i); r(h % W, top + (h >>> 9) % (H - top), 1, 2, h % 3 ? '#5fa046' : '#3f7a2e'); }
}

// what you see through the windows (drawn over the bottom of each window)
function drawWindowView(x, y, w, h, sky, i) {
  const v = opt('view'), night = sky.phase === 'night';
  if (v === 'city') return; // the default skyline
  r(x, y + h - 10, w, 10, sky.bot); // hide the default buildings
  if (v === 'beach') { r(x, y + h - 10, w, 5, night ? '#1e3a5a' : '#2f8fd0'); r(x, y + h - 5, w, 5, night ? '#8a7a5a' : '#ecd9a0'); for (let k = 0; k < w; k += 9) r(x + k + ((i * 3) % 9), y + h - 9, 4, 1, '#ffffff88'); }
  if (v === 'mountains') { for (let k = 0; k < w; k++) { const m = Math.abs(((k + i * 13) % 24) - 12); r(x + k, y + h - 12 + Math.round(m / 2), 1, 12 - Math.round(m / 2), night ? '#2a2f4a' : '#6a7a9a'); if (m < 3) r(x + k, y + h - 12 + Math.round(m / 2), 1, 2, '#ffffff'); } }
  if (v === 'forest') { for (let k = 0; k < w; k += 6) { const t2 = 6 + hash('tr' + i + k) % 5; r(x + k + 2, y + h - 3, 1, 3, '#5a3a20'); for (let q = 0; q < t2; q++) r(x + k + 2 - Math.floor(q / 2), y + h - 3 - t2 + q, Math.floor(q / 2) * 2 + 1, 1, night ? '#1e3a28' : '#2f7a3b'); } }
  if (v === 'space') { r(x, y, w, h, '#0b0b1e'); for (let k = 0; k < 10; k++) { const hh = hash('sp' + i + k); r(x + hh % w, y + (hh >>> 8) % h, 1, 1, '#ffffff'); } r(x + w - 16, y + h - 14, 10, 10, '#b55088'); r(x + w - 18, y + h - 10, 14, 2, '#e8a0c8'); }
}

// more plants: a jungle along the corridor and in the corners of each room
function drawExtraPlants() {
  if (opt('plants') !== 'jungle') return;
  for (let y = TOP + 30; y < H - 30; y += 70) Art.drawPlant(CX + 9, y, y % 140 < 70);
  for (const R of rooms) { Art.drawPlant(R.x + 2, R.y + R.h - 24, false); Art.drawPlant(R.x + R.w - 12, R.y + R.h - 24, true); }
}

// the mascot takes the cat's place and behaviour (visits, petting)
function drawMascot(x, y, mode, t, flip) { return drawCritter(MASCOTS.includes(prog.mascot) ? prog.mascot : 'cat', x, y, mode, t, flip); }
function drawCritter(m, x, y, mode, t, flip) {
  const f = ((t / 300) | 0) % 2, ink = PAL.ink, walk = mode === 'walk', sleep = mode === 'sleep';
  if (m === 'cat') return Art.drawCat(x, y, mode, t, flip);
  if (m === 'dog') return drawDog(x, y, t, flip, walk);
  ctx.save(); if (flip) { ctx.translate(x * 2 + 12, 0); ctx.scale(-1, 1); }
  if (m === 'robot') {
    const eye = sleep ? '#3a4566' : '#62ff7a';
    r(x + 1, y + 1, 10, 9, ink); r(x + 2, y + 2, 8, 7, '#c0cbdc'); r(x + 3, y + 4, 6, 2, '#1b1622'); r(x + 6, y + 4, 2, 2, eye);
    r(x + 5, y - 2, 1, 3, ink); r(x + 5, y - 3, 1, 1, f ? '#e43b44' : '#5a1f2a'); r(x + 2, y + 10, 8, 2, ink); if (walk) r(x + 3 + f * 2, y + 10, 2, 1, '#8b9bb4');
  } else if (m === 'fox') {
    r(x, y + 4, 10, 5, ink); r(x + 1, y + 5, 8, 3, '#e8762a'); r(x + 7, y + 1, 6, 6, ink); r(x + 8, y + 2, 4, 4, '#e8762a'); r(x + 8, y, 1, 2, ink); r(x + 11, y, 1, 2, ink);
    r(x + 11, y + 4, 2, 1, '#ffffff'); r(x + 10, y + 3, 1, 1, sleep ? '#e8762a' : ink); r(x - 4, y + 4 + f, 5, 3, '#e8762a'); r(x - 4, y + 4 + f, 2, 3, '#ffffff');
    r(x + 1, y + 8, 2, 2 + (walk ? f : 0), ink); r(x + 7, y + 8, 2, 2 + (walk ? 1 - f : 0), ink);
  } else if (m === 'penguin') {
    r(x + 2, y, 8, 11, ink); r(x + 4, y + 3, 4, 7, '#ffffff'); r(x + 5, y + 2, 1, 1, sleep ? ink : '#ffffff'); r(x + 7, y + 4, 2, 1, '#feae34');
    r(x + 3, y + 11, 2, 1, '#feae34'); r(x + 7, y + 11, 2, 1, '#feae34'); if (walk) r(x + (f ? 1 : 10), y + 5, 1, 3, ink);
  } else { // bunny
    r(x + 2, y + 4, 9, 6, ink); r(x + 3, y + 5, 7, 4, '#f4ecd8'); r(x + 7, y, 2, 5, ink); r(x + 9, y - 1, 2, 6, ink); r(x + 8, y + 1, 1, 3, '#ff9ccf');
    r(x + 9, y + 6, 1, 1, sleep ? '#f4ecd8' : ink); r(x + 1, y + 6, 2, 2, '#ffffff'); r(x + 3, y + 10, 2, 1 + (walk ? f : 0), ink); r(x + 8, y + 10, 2, 1 + (walk ? 1 - f : 0), ink);
  }
  ctx.restore();
}

// the office name on a plaque above the elevator and in the top bar
function drawNamePlaque() {
  const name = (prog.officeName || '').toUpperCase().replace(/[^A-Z0-9 \-!.#+]/g, '').slice(0, 14);
  if (!name) return;
  const w = name.length * 4 + 6, x = CX - w / 2, y = H - 40;
  r(x - 1, y - 1, w + 2, 9, PAL.ink); r(x, y, w, 7, '#d9a441'); r(x, y, w, 1, '#ffd84d');
  pixText(x + 3, y + 1, name, '#2a1d27');
}

// the tab
function renderOffice() {
  const O = T.office, body = reportEl.querySelector('.report-body'), L = O.labels;
  const row = (k, values, swatch) => `<h3>${esc(O.groups[k])}</h3><div class="opts">${values.map(v => `<button class="opt ${swatch ? 'swatch' : ''} ${opt(k) === v ? 'on' : ''}" data-opt="${k}" data-val="${v}">${swatch ? `<i style="background:${swatch(v)}"></i>` : ''}${esc((L[k] && L[k][v]) || v)}</button>`).join('')}</div>`;
  const m = MASCOTS.includes(prog.mascot) ? prog.mascot : 'cat';
  body.innerHTML = tabsHtml() + `<div class="office-preview"><canvas id="office-preview"></canvas><small>${esc(O.preview)}</small></div><p class="sub">${esc(O.sub)}</p>
    <h3>${esc(O.name)}</h3><div class="office-name"><input id="office-name" maxlength="14" value="${esc(prog.officeName || '')}" placeholder="${esc(O.namePh)}"><button class="btn small" data-save-name>${esc(O.save)}</button></div>
    <h3>${esc(O.you)}</h3><div class="office-name"><span class="you-face" id="you-face"></span><button class="btn small" data-you-look>⚄ ${esc(O.youRoll)}</button></div>
    ${row('floor', STYLE.floor)}
    ${row('wall', Object.keys(STYLE.wall), v => STYLE.wall[v][0])}
    ${row('rooms', Object.keys(STYLE.rooms), v => STYLE.rooms[v][1])}
    ${row('desk', Object.keys(STYLE.desk), v => STYLE.desk[v][0])}
    ${row('view', STYLE.view)}
    ${row('sky', STYLE.sky)}
    ${row('light', STYLE.light)}
    <h3>${esc(O.groups.mascot)}</h3><div class="opts">${MASCOTS.map(x => `<button class="opt ${x === m ? 'on' : ''}" data-opt="mascot" data-val="${x}">${esc(L.mascot[x])}</button>`).join('')}</div>
    ${row('plants', STYLE.plants)}
    ${row('station', STYLE.station)}
    ${row('accent', Object.keys(STYLE.accent), v => STYLE.accent[v])}`;
  const face = document.getElementById('you-face'); if (face) face.appendChild(Art.portrait('you:' + (avatars.__you || 0)));
}
reportEl.addEventListener('click', e => {
  const o = e.target.closest('[data-opt]');
  if (o) { // live: mark the chosen button and refresh the preview, nothing else is redrawn
    if (o.dataset.opt === 'mascot') { setProgress('mascot', o.dataset.val); achAdd('themesTried', 'mascot:' + o.dataset.val); achBump('decorate'); }
    else setOpt(o.dataset.opt, o.dataset.val);
    reportEl.querySelectorAll(`[data-opt="${o.dataset.opt}"]`).forEach(b => b.classList.toggle('on', b === o));
    lastLayoutKey = ''; if (data && !building && !trophyView) drawScene(performance.now(), 0); updatePreview(); return;
  }
  if (e.target.closest('[data-you-look]')) { avatars.__you = (avatars.__you || 0) + 1; saveProgress(); achBump('avatars'); const f = document.getElementById('you-face'); if (f) { f.innerHTML = ''; f.appendChild(Art.portrait('you:' + avatars.__you)); } return; }
  if (e.target.closest('[data-save-name]')) { const v = document.getElementById('office-name').value.trim().slice(0, 14); setProgress('officeName', v); achBump('decorate'); if (data) renderBar(); updatePreview(); }
});
reportEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'office-name') reportEl.querySelector('[data-save-name]').click(); });

// live preview: a scaled copy of the office (which keeps drawing behind the modal), refreshed ~7 times a second
setInterval(() => updatePreview(), 150);
function updatePreview() {
  const pv = document.getElementById('office-preview');
  if (!pv || reportEl.hidden || reportTab !== 'office') return;
  const src = document.getElementById('cv'), crop = Math.min(src.height, Math.round(src.width * .42));
  const h = Math.round(Math.min(innerHeight * .3, 240)), w = Math.round(h * src.width / crop);
  pv.style.height = h + 'px'; pv.width = w; pv.height = h;
  const c = pv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(src, 0, 0, src.width, crop, 0, 0, pv.width, pv.height);
}
