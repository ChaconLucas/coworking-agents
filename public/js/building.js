'use strict';
// ---------------- building view: every floor as a live thumbnail ----------------
const buildingEl = document.createElement('section');
buildingEl.className = 'building'; buildingEl.hidden = true;
document.getElementById('stage').after(buildingEl);
buildingEl.addEventListener('click', e => { const c = e.target.closest('[data-floor]'); if (c) goFloor(+c.dataset.floor); });
const thumbs = [];

function setBuilding(on) {
  building = !!on && floors.length > 1;
  buildingEl.hidden = !building;
  document.getElementById('stage').hidden = building;
  if (building) renderBuilding();
  renderFloors();
}

function renderBuilding() {
  buildingEl.innerHTML = floors.map((f, i) => {
    const ps = f.shelves.flatMap(sh => sh.rooms.flatMap(r => r.people));
    const need = ps.filter(p => p.state === 'needs_you' || p.state === 'waiting').length;
    const work = ps.filter(p => !['idle', 'asleep', 'needs_you', 'waiting'].includes(p.state)).length;
    const names = f.shelves.flatMap(sh => sh.rooms.map(r => r.name));
    return `<button class="card ${i === floor ? 'cur' : ''} ${need ? 'needs' : ''}" data-floor="${i}">
      <header><span class="plate">${i + 1}</span><div><b>${esc(T.floor(i + 1))}</b><small>${esc(names.join(' · '))}</small></div><span class="faces" data-faces="${i}"></span></header>
      <div class="frame"><canvas data-thumb="${i}"></canvas></div>
      <footer>${ps.length} ${esc(T.agents)} · ${work} ${esc(T.working)}${need ? ` · <b class="need">${need} ${esc(T.needYou)}</b>` : ''}</footer></button>`;
  }).join('');
  // little faces of who works on each floor (red ring = needs you)
  buildingEl.querySelectorAll('[data-faces]').forEach(el => {
    const ps = floors[+el.dataset.faces].shelves.flatMap(sh => sh.rooms.flatMap(r => r.people)).slice(0, 6);
    for (const p of ps) { const c = Art.portrait(p.id); if (p.state === 'needs_you' || p.state === 'waiting') c.className = 'need'; el.appendChild(c); }
  });
  thumbs.length = 0;
  buildingEl.querySelectorAll('canvas[data-thumb]').forEach(c => { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; thumbs[+c.dataset.thumb] = { c, g }; });
}

function drawThumbs(t, dt) {
  for (let i = 0; i < floorStates.length; i++) {
    const th = thumbs[i];
    if (!th) continue;
    useFloor(i);
    if (th.c.width !== W || th.c.height !== H) { th.c.width = W; th.c.height = H; th.g.imageSmoothingEnabled = false; }
    ctx = th.g; Art.setCtx(ctx);
    try { drawScene(t, dt); } catch {}
  }
  ctx = mainCtx; Art.setCtx(ctx); useFloor(floor);
}

// update only the card texts (recreating the canvases every second would flicker)
function renderBuildingCounts() {
  if (buildingEl.children.length !== floors.length) return renderBuilding();
  floors.forEach((f, i) => {
    const ps = f.shelves.flatMap(sh => sh.rooms.flatMap(r => r.people));
    const need = ps.filter(p => p.state === 'needs_you' || p.state === 'waiting').length;
    const work = ps.filter(p => !['idle', 'asleep', 'needs_you', 'waiting'].includes(p.state)).length;
    const foot = buildingEl.children[i].querySelector('footer');
    if (foot) foot.innerHTML = `${ps.length} ${esc(T.agents)} · ${work} ${esc(T.working)}${need ? ` · <b class="need">${need} ${esc(T.needYou)}</b>` : ''}`;
  });
}
