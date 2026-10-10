'use strict';
// ---------------- personalise: office name, floor and wall theme, mascot (saved in progress.json) ----------------
const FLOORS = ['wood', 'carpet', 'concrete', 'tiles'];
const WALLS = { cream: ['#ead4aa', '#d9bd8f'], mint: ['#cfe8d8', '#b4d6c0'], lavender: ['#ddd3ee', '#c6b9e0'], navy: ['#3a4566', '#2f3955'], brick: ['#b86a4f', '#a25a42'] };
const MASCOTS = ['cat', 'dog', 'robot'];
const theme = () => { const [f, w] = String(prog.theme || '').split('/'); return { floor: FLOORS.includes(f) ? f : 'wood', wall: WALLS[w] ? w : 'cream' }; };

// the wall colours live in the shared palette: swap them before drawing
function applyTheme() {
  const w = WALLS[theme().wall];
  Art.PAL.wall = w[0]; Art.PAL.wallShade = w[1];
}
function drawThemedFloor(W, H, top) {
  const f = theme().floor;
  if (f === 'wood') return Art.drawFloor(W, H, top);
  if (f === 'carpet') {
    r(0, top, W, H - top, '#5a6b8a');
    for (let y = top; y < H; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < W; x += 4) r(x, y, 1, 1, '#677a9c');
  } else if (f === 'concrete') {
    r(0, top, W, H - top, '#9a9a96');
    for (let i = 0; i < W * (H - top) / 900; i++) { const h = hash('cc' + i); r(h % W, top + (h >>> 9) % (H - top), 1 + h % 2, 1, h % 3 ? '#8c8c88' : '#a8a8a4'); }
    for (let x = 0; x < W; x += 64) r(x, top, 1, H - top, '#85857f');
    for (let y = top; y < H; y += 64) r(0, y, W, 1, '#85857f');
  } else {
    for (let y = top; y < H; y += 12) for (let x = 0; x < W; x += 12) r(x, y, 12, 12, ((x + y) / 12) % 2 ? '#e8e2d6' : '#cfc6b4');
  }
}

// the mascot takes the cat's place and behaviour (visits, petting)
function drawMascot(x, y, mode, t, flip) {
  const m = MASCOTS.includes(prog.mascot) ? prog.mascot : 'cat';
  if (m === 'cat') return Art.drawCat(x, y, mode, t, flip);
  if (m === 'dog') return drawDog(x, y, t, flip, mode === 'walk');
  // a little robot: rolls when walking, antenna blinks, sleeps with its eye off
  const f = ((t / 300) | 0) % 2, eye = mode === 'sleep' ? '#3a4566' : '#62ff7a';
  r(x + 1, y + 1, 10, 9, PAL.ink); r(x + 2, y + 2, 8, 7, '#c0cbdc'); r(x + 3, y + 4, 6, 2, '#1b1622'); r(x + (flip ? 3 : 6), y + 4, 2, 2, eye);
  r(x + 5, y - 2, 1, 3, PAL.ink); r(x + 5, y - 3, 1, 1, f ? '#e43b44' : '#5a1f2a');
  r(x + 2, y + 10, 8, 2, PAL.ink); if (mode === 'walk') r(x + 3 + f * 2, y + 10, 2, 1, '#8b9bb4');
}

// the office name on a plaque above the elevator and in the top bar
function drawNamePlaque() {
  const name = (prog.officeName || '').toUpperCase().replace(/[^A-Z0-9 \-!.#+]/g, '').slice(0, 14);
  if (!name) return;
  const w = name.length * 4 + 6, x = CX - w / 2, y = H - 40;
  r(x - 1, y - 1, w + 2, 9, PAL.ink); r(x, y, w, 7, '#d9a441'); r(x, y, w, 1, '#ffd84d');
  pixText(x + 3, y + 1, name, '#2a1d27');
}

// the tab: name, floor, wall, mascot
function renderOffice() {
  const O = T.office, body = reportEl.querySelector('.report-body'), th = theme(), m = MASCOTS.includes(prog.mascot) ? prog.mascot : 'cat';
  const opt = (group, val, cur, label) => `<button class="opt ${val === cur ? 'on' : ''}" data-opt="${group}" data-val="${val}">${esc(label)}</button>`;
  body.innerHTML = tabsHtml() + `<p class="sub">${esc(O.sub)}</p>
    <h3>${esc(O.name)}</h3><div class="office-name"><input id="office-name" maxlength="14" value="${esc(prog.officeName || '')}" placeholder="${esc(O.namePh)}"><button class="btn small" data-save-name>${esc(O.save)}</button></div>
    <h3>${esc(O.floor)}</h3><div class="opts">${FLOORS.map(f => opt('floor', f, th.floor, O.floors[f])).join('')}</div>
    <h3>${esc(O.wall)}</h3><div class="opts">${Object.keys(WALLS).map(w => `<button class="opt swatch ${w === th.wall ? 'on' : ''}" data-opt="wall" data-val="${w}"><i style="background:${WALLS[w][0]}"></i>${esc(O.walls[w])}</button>`).join('')}</div>
    <h3>${esc(O.mascot)}</h3><div class="opts">${MASCOTS.map(x => opt('mascot', x, m, O.mascots[x])).join('')}</div>`;
}
reportEl.addEventListener('click', e => {
  const o = e.target.closest('[data-opt]');
  if (o) {
    const th = theme();
    if (o.dataset.opt === 'floor') setProgress('theme', o.dataset.val + '/' + th.wall);
    if (o.dataset.opt === 'wall') setProgress('theme', th.floor + '/' + o.dataset.val);
    if (o.dataset.opt === 'mascot') setProgress('mascot', o.dataset.val);
    achBump('decorate'); renderOffice(); return;
  }
  if (e.target.closest('[data-save-name]')) { const v = document.getElementById('office-name').value.trim().slice(0, 14); setProgress('officeName', v); achBump('decorate'); renderOffice(); if (data) renderBar(); }
});
reportEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'office-name') reportEl.querySelector('[data-save-name]').click(); });
