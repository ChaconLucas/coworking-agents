'use strict';
// ---------------- Gather mode: a closer camera that follows you, and a card when you walk up to someone ----------------
// On by default while you walk around (☰ → Settings → Camera follows you). The office is drawn bigger and the view
// slides with you; next to an agent a card shows what it is doing and what you asked last, with its buttons.
let gatherOn = qs.get('gather') === '0' ? false : store.get('gather', true) !== false; // ?gather=0 for the README screenshots (the whole office)
// zoom: the − and + buttons in the corner (or the - and = keys); the smallest shows the whole office
const ZOOMS = [1, 1.5, 2, 2.5, 3];
let zoomI = Math.max(0, ZOOMS.indexOf(Number(store.get('zoom', 2)))); if (ZOOMS[zoomI] === undefined) zoomI = 2;
const gatherActive = () => gatherOn && playerOn && !trophyView && !building && !!data;
function gatherZoom() { return gatherActive() ? ZOOMS[zoomI] : 1; }
function setZoom(step) {
  const i = Math.max(0, Math.min(ZOOMS.length - 1, zoomI + step)); if (i === zoomI) return;
  zoomI = i; store.set('zoom', ZOOMS[i]); camX = camY = null; lastLayoutKey = ''; renderAll(); zoomBar();
}
const zoomEl = document.createElement('div'); zoomEl.className = 'zoom-bar'; document.body.appendChild(zoomEl);
function zoomBar() {
  zoomEl.hidden = !gatherActive();
  zoomEl.innerHTML = `<button data-zoom="-1" title="${esc(T.gather.out)}" ${zoomI === 0 ? 'disabled' : ''}>−</button><span>${ZOOMS[zoomI]}×</span><button data-zoom="1" title="${esc(T.gather.in)}" ${zoomI === ZOOMS.length - 1 ? 'disabled' : ''}>+</button>`;
}
zoomEl.addEventListener('click', e => { const b = e.target.closest('[data-zoom]'); if (b) setZoom(Number(b.dataset.zoom)); });
zoomBar();
document.addEventListener('keydown', e => {
  if (!gatherActive() || e.metaKey || e.ctrlKey || e.altKey || !reportEl.hidden) return;
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea') return;
  if (e.key === '-' || e.key === '_') { setZoom(-1); e.preventDefault(); } else if (e.key === '=' || e.key === '+') { setZoom(1); e.preventDefault(); }
});
let camX = null, camY = null;
function gatherFollow() {
  const on = gatherActive();
  document.body.classList.toggle('gather', on);
  if (zoomEl.hidden === on) zoomBar();
  if (!on) { if (camX !== null) { camX = camY = null; if (!officeEl.classList.contains('cam')) officeEl.style.transform = ''; } nearCardHide(); return; }
  if (officeEl.classList.contains('cam')) return; // an agent's panel has the camera
  const st = document.getElementById('stage'), vw = st.clientWidth, vh = st.clientHeight, ww = cv.width * S, wh = cv.height * S;
  const fit = (v, w, c) => (w <= v ? (w - v) / 2 : Math.max(0, Math.min(w - v, c - v / 2)));
  const tx = fit(vw, ww, (me.x + 8) * S), ty = fit(vh, wh, (me.y + 12) * S);
  if (camX === null) { camX = tx; camY = ty; } else { camX += (tx - camX) * .2; camY += (ty - camY) * .2; }
  officeEl.style.transform = `translate(${-Math.round(camX)}px, ${-Math.round(camY)}px)`;
  nearCard();
}
function setGather(on) { gatherOn = on; store.set('gather', on); lastLayoutKey = ''; renderAll(); labelGather(); }
// the switch, in the menu's Settings, with the same green dot as the others
const gatherBtn = document.createElement('button');
gatherBtn.id = 'btn-gather'; gatherBtn.className = 'icon-btn';
gatherBtn.innerHTML = `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3zM7 6h2v1h1v2H9v1H7V9H6V7h1z"/></svg><span class="ml"></span>`;
gatherBtn.onclick = () => setGather(!gatherOn);
{ const ref = document.getElementById('btn-autostart'); if (ref) ref.before(gatherBtn); else { const sec = document.querySelector('#tools-menu .menu-sec:last-child'); if (sec) sec.appendChild(gatherBtn); } }
function labelGather() { gatherBtn.setAttribute('aria-pressed', gatherOn ? 'true' : 'false'); gatherBtn.querySelector('.ml').textContent = T.gather.label; gatherBtn.title = T.gather.tip; }
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
