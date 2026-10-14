'use strict';
// ---------------- Gather mode: a closer camera that follows you, and a card when you walk up to someone ----------------
// On by default while you walk around (☰ → Settings → Camera follows you). The office is drawn bigger and the view
// slides with you; next to an agent a card shows what it is doing and what you asked last, with its buttons.
let gatherOn = qs.get('gather') === '0' ? false : store.get('gather', true) !== false && store.get('player', true) !== false; // ?gather=0 for the README screenshots (the whole office)
// zoom: − and + in the bar at the bottom (or the - and = keys, or pinch / ctrl + wheel); "fit" shows the whole office
const ZOOMS = ['fit', 1, 1.5, 2, 2.5, 3, 4];
let zoomI = ZOOMS.indexOf(store.get('zoom', 2)); if (zoomI < 0) zoomI = 4;
// Normal mode zooms too, without a character: "width" is the whole floor across the page; closer, you drag or scroll to look
const NZOOMS = ['width', 1.5, 2, 3, 4];
let zoomN = Math.max(0, NZOOMS.indexOf(store.get('zoomN', 'width')));
const gatherActive = () => gatherOn && playerOn && !trophyView && !building && !!data;
const placeView = () => !trophyView && !building && !!data;
const camActive = () => gatherActive() || (!gatherOn && zoomN > 0 && placeView()); // the camera moves the floor under the window
// how much bigger than the page-wide scale: "fit" makes the whole floor fit the window
function gatherZoom(w, h, s) {
  if (!gatherActive()) return !gatherOn && placeView() ? (zoomN ? NZOOMS[zoomN] : 1) : 1;
  const z = ZOOMS[zoomI]; if (z !== 'fit') return z;
  const st = document.getElementById('stage'), top = st.getBoundingClientRect().top + scrollY;
  return Math.min((st.clientWidth || innerWidth) / (w * s), Math.max(240, innerHeight - top - 8) / (h * s));
}
function setZoom(step) {
  if (!gatherOn) { // Normal mode: its own steps; the camera stays where you look (centred on the same spot)
    const i = Math.max(0, Math.min(NZOOMS.length - 1, zoomN + step)); if (i === zoomN) return;
    const st = document.getElementById('stage'), rc = st.getBoundingClientRect();
    const fx = camActive() && camX !== null ? (camX + st.clientWidth / 2) / (cv.width * S) : .5, fy = camActive() && camY !== null ? (camY + st.clientHeight / 2) / (cv.height * S) : Math.min(1, Math.max(0, (innerHeight / 2 - rc.top) / (cv.height * S)));
    zoomN = i; store.set('zoomN', NZOOMS[i]); lastLayoutKey = ''; renderAll(); zoomBar();
    camManual = true; camX = fx * cv.width * S - st.clientWidth / 2; camY = fy * cv.height * S - st.clientHeight / 2; gatherFollow();
    return;
  }
  const i = Math.max(0, Math.min(ZOOMS.length - 1, zoomI + step)); if (i === zoomI) return;
  zoomI = i; store.set('zoom', ZOOMS[i]); camX = camY = null; camManual = false; lastLayoutKey = ''; renderAll(); zoomBar();
}
// the bar at the bottom: Gather or Normal, and the zoom while in Gather
const zoomEl = document.createElement('div'); zoomEl.className = 'menu-zoom'; zoomEl.hidden = true; // a row in ☰ → Settings, under Gather mode
function zoomBar() {
  const G = T.gather, list = gatherOn ? ZOOMS : NZOOMS, i = gatherOn ? zoomI : zoomN, z = list[i]; zoomEl.hidden = false;
  zoomEl.innerHTML = `<span class="mz-l">${esc(G.zoom)}</span><button data-zoom="-1" title="${esc(G.out)}" ${i === 0 ? 'disabled' : ''}>−</button><span class="mz-z">${z === 'fit' || z === 'width' ? esc(G.fit) : z + '×'}</span><button data-zoom="1" title="${esc(G.in)}" ${i === list.length - 1 ? 'disabled' : ''}>+</button>${camManual && gatherOn ? `<button data-zoom-me title="${esc(G.backToMe)}">◎</button>` : ''}`;
}
zoomEl.addEventListener('click', e => {
  e.stopPropagation();
  if (e.target.closest('[data-zoom-me]')) { camManual = false; zoomBar(); return; }
  const b = e.target.closest('[data-zoom]'); if (b) setZoom(Number(b.dataset.zoom));
});
document.addEventListener('keydown', e => {
  if (!placeView() || e.metaKey || e.ctrlKey || e.altKey || !reportEl.hidden) return;
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea') return;
  if (e.key === '-' || e.key === '_') { setZoom(-1); e.preventDefault(); } else if (e.key === '=' || e.key === '+') { setZoom(1); e.preventDefault(); }
});
// moving the camera yourself: drag the floor, or scroll; it stays there until you walk (◎ brings it back to you)
let camX = null, camY = null, camManual = false, drag = null, dragged = false;
const clampCam = () => {
  const st = document.getElementById('stage'), vw = st.clientWidth, vh = st.clientHeight, ww = cv.width * S, wh = cv.height * S;
  camX = ww <= vw ? (ww - vw) / 2 : Math.max(0, Math.min(ww - vw, camX)); camY = wh <= vh ? (wh - vh) / 2 : Math.max(0, Math.min(wh - vh, camY));
  officeEl.style.transform = `translate(${-Math.round(camX)}px, ${-Math.round(camY)}px)`;
};
const lookAround = () => { if (!camManual) { camManual = true; zoomBar(); } clampCam(); if (!gatherOn) officeEl.style.transform = `translate(${-Math.round(camX)}px, ${-Math.round(camY)}px)`; };
overlay.addEventListener('pointerdown', e => {
  if (!camActive() || e.button !== 0 || e.target.closest('button,a,.near-card,.tag,[data-id],.desk-hit,.hit')) return;
  drag = { x: e.clientX, y: e.clientY, cx: camX || 0, cy: camY || 0 }; dragged = false;
});
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!dragged && Math.hypot(dx, dy) < 6) return;
  dragged = true; camX = drag.cx - dx; camY = drag.cy - dy; lookAround();
});
addEventListener('pointerup', () => { drag = null; });
overlay.addEventListener('click', e => { if (dragged) { dragged = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true); // a drag is not a click to walk
document.getElementById('stage').addEventListener('wheel', e => {
  if (e.ctrlKey && placeView()) { e.preventDefault(); if (Math.abs(e.deltaY) > 2) setZoom(e.deltaY > 0 ? -1 : 1); return; } // pinch on a trackpad, or ctrl + wheel, in both modes
  if (!camActive()) return;
  e.preventDefault();
  if (e.ctrlKey) { if (Math.abs(e.deltaY) > 2) setZoom(e.deltaY > 0 ? -1 : 1); return; } // pinch on a trackpad, or ctrl + wheel
  camX = (camX || 0) + e.deltaX; camY = (camY || 0) + e.deltaY; lookAround();
}, { passive: false });
function gatherFollow() {
  const on = camActive();
  document.body.classList.toggle('gather', on);
  { // the stage fills the window below the bar and the notices, so nothing hides under the bottom edge
    const st = document.getElementById('stage'), want = on ? Math.max(240, Math.round(innerHeight - (st.getBoundingClientRect().top + scrollY) - 8)) + 'px' : '';
    if (st.style.height !== want) st.style.height = want;
  }
  if (!on) { camX = camY = null; camManual = false; if (!officeEl.classList.contains('cam') && officeEl.style.transform) officeEl.style.transform = ''; nearCardHide(); return; }
  if (officeEl.classList.contains('cam')) return; // an agent's panel has the camera
  if (!gatherActive()) { if (camX === null) { camX = 0; camY = 0; } clampCam(); return; } // Normal mode zoomed: no character, you look around
  if (me.moving && camManual) { camManual = false; zoomBar(); } // walking brings the camera back to you
  if (camManual) { clampCam(); nearCard(); return; }
  const st = document.getElementById('stage'), vw = st.clientWidth, vh = st.clientHeight, ww = cv.width * S, wh = cv.height * S;
  const fit = (v, w, c) => (w <= v ? (w - v) / 2 : Math.max(0, Math.min(w - v, c - v / 2)));
  const tx = fit(vw, ww, (me.x + 8) * S), ty = fit(vh, wh, (me.y + 12) * S);
  if (camX === null) { camX = tx; camY = ty; } else { camX += (tx - camX) * .2; camY += (ty - camY) * .2; }
  officeEl.style.transform = `translate(${-Math.round(camX)}px, ${-Math.round(camY)}px)`;
  nearCard();
}
function setGather(on) { gatherOn = on; store.set('gather', on); camX = camY = null; camManual = false; if (playerOn !== on && typeof setPlayer === 'function') setPlayer(on); lastLayoutKey = ''; gatherFollow(); renderAll(); labelGather(); zoomBar(); } // Gather: you walk and the camera follows; Normal: the whole map, no character
// the switch, in the menu's Settings, with the same green dot as the others
const gatherBtn = document.createElement('button');
gatherBtn.id = 'btn-gather'; gatherBtn.className = 'icon-btn';
gatherBtn.innerHTML = `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3zM7 6h2v1h1v2H9v1H7V9H6V7h1z"/></svg><span class="ml"></span>`;
gatherBtn.onclick = () => setGather(!gatherOn);
{ const ref = document.getElementById('btn-autostart'); if (ref) ref.before(gatherBtn); else { const sec = document.querySelector('#tools-menu .menu-sec:last-child'); if (sec) sec.appendChild(gatherBtn); } gatherBtn.after(zoomEl); zoomBar(); }
function labelGather() { gatherBtn.setAttribute('aria-pressed', gatherOn ? 'true' : 'false'); gatherBtn.querySelector('.ml').textContent = T.gather.label; gatherBtn.title = T.gather.tip; zoomBar(); }
labelGather();

// ---- walking up to someone: a card over them (who, what now, what you asked), Enter or the buttons act ----
const nearEl = document.createElement('div'); nearEl.className = 'near-card'; nearEl.hidden = true; overlay.appendChild(nearEl);
let nearId = '', nearKey = '';
function nearCardHide() { if (!nearEl.hidden) { nearEl.hidden = true; nearId = ''; nearKey = ''; } }
function nearCard() {
  const c = { x: me.x + 8, y: me.y + 12 }; let best = null;
  for (const cell of layout) {
    const a = cell.actor; if (!a || cell.p.leaving) continue;
    const ax = (a.mode === 'desk' ? cell.chair.x : a.x) + 8, ay = (a.mode === 'desk' ? cell.chair.y : a.y) + 12, d = Math.hypot(ax - c.x, ay - c.y);
    if (d < 34 && (!best || d < best.d)) best = { d, cell, ax, ay };
  }
  if (!best) return nearCardHide();
  const p = best.cell.p, G = T.gather, need = p.state === 'needs_you' || p.state === 'waiting';
  const doing = p.doing ? (need && p.doing.ask ? p.doing.ask : `${p.doing.tool || ''} ${p.doing.what || ''}`.trim()) : '';
  const key = [p.id, p.state, doing, p.lastPrompt, p.title].join('|');
  if (key !== nearKey) {
    nearKey = key; nearId = p.id;
    nearEl.innerHTML = `<b>${esc(p.name)}</b><span class="nc-st" style="--c:${KIND_COLOR[p.state] || '#888'}">${esc(T.states[p.state] || p.state)}</span>
      ${p.title ? `<small>${esc(p.title)}</small>` : ''}${doing ? `<p class="nc-doing">${esc(doing.slice(0, 160))}</p>` : ''}${p.lastPrompt ? `<p class="nc-said">${esc(G.asked)}: “${esc(p.lastPrompt.slice(0, 120))}”</p>` : ''}
      <span class="nc-row"><button class="btn small" data-near="open">${esc(need ? G.answer : G.open)}</button><button class="btn small ghost" data-near="talk">💬 ${esc(T.chat.talk)}</button></span>`;
  }
  nearEl.hidden = false;
  nearEl.style.left = best.ax * S + 'px'; nearEl.style.top = (best.ay - 30) * S + 'px';
}
nearEl.addEventListener('click', e => {
  const b = e.target.closest('[data-near]'); if (!b || !nearId) return; e.stopPropagation();
  const p = data.people.find(x => x.id === nearId); if (!p) return;
  if (b.dataset.near === 'talk') { deskSub = 'talk'; showPerson(p.id); return; }
  if ((p.state === 'needs_you' || p.state === 'waiting') && typeof openTalk === 'function') openTalk(p.id); else showPerson(p.id);
});

// small zoom buttons on the left edge of the screen while in Gather mode (the same as the menu row)
const zoomPad = document.createElement('div'); zoomPad.className = 'zoom-pad'; zoomPad.hidden = true; document.body.appendChild(zoomPad);
function zoomPadDraw() {
  const on = placeView(), G = T.gather; zoomPad.hidden = !on; if (!on) return;
  const list = gatherOn ? ZOOMS : NZOOMS, i = gatherOn ? zoomI : zoomN;
  const html = `<button data-zp="1" title="${esc(G.in)}" ${i === list.length - 1 ? 'disabled' : ''}>+</button><button data-zp="-1" title="${esc(G.out)}" ${i === 0 ? 'disabled' : ''}>−</button>${camManual && gatherActive() ? `<button data-zp="me" title="${esc(G.backToMe)}">◎</button>` : ''}`;
  if (zoomPad.innerHTML !== html) zoomPad.innerHTML = html;
}
zoomPad.addEventListener('click', e => { const b = e.target.closest('[data-zp]'); if (!b) return; if (b.dataset.zp === 'me') { camManual = false; zoomBar(); } else setZoom(Number(b.dataset.zp)); zoomPadDraw(); });
setInterval(zoomPadDraw, 400);
