'use strict';
// ---------------- loop ----------------
let lastLayoutKey = '';
function renderAll() {
  if (!data) return;
  const key = data.people.map(p => p.id + ':' + roomKey(p)).join(',') + '|' + floor + '|' + document.getElementById('stage').clientWidth;
  if (key !== lastLayoutKey) { lastLayoutKey = key; relayout(); }
  else {
    // same people: only swap each desk's data, otherwise the drawing stays stuck on the old state
    const byId = new Map(data.people.map(p => [p.id, p]));
    for (const f of floorStates) { for (const c of f.layout) c.p = byId.get(c.p.id) || c.p; for (const d of f.desks) if (d.p) d.p = byId.get(d.p.id) || d.p; }
    for (const f of floors) for (const sh of f.shelves) for (const R of sh.rooms) R.people = R.people.map(p => byId.get(p.id) || p);
    renderFloors();
  }
  renderOverlay(); renderBar(); renderPanel(); renderHelp();
  if (building) renderBuildingCounts();
}

let lastFrame = -1, lastT = 0;
function loop(t) {
  requestAnimationFrame(loop); // schedule first: an error in one frame must not stop the animation
  if (data && spots) {
    const f = (t / 70) | 0; // ~14 frames per second, a pixel-art pace
    if (f !== lastFrame) {
      const dt = lastT ? Math.min(.25, (t - lastT) / 1000) : 0;
      lastT = t; lastFrame = f;
      if (building) { if (f % 3 === 0) drawThumbs(t, dt * 3); } else drawScene(t, dt);
    }
  }
}
requestAnimationFrame(loop);
window.addEventListener('resize', () => { if (data) { lastLayoutKey = ''; renderAll(); } });
setInterval(() => { if (data) renderOverlay(); }, 500);

// ---------------- data ----------------
const offline = document.getElementById('offline');
function connect() {
  const es = new EventSource('events');
  es.onmessage = e => {
    offline.hidden = true;
    const d = JSON.parse(e.data);
    if (d.error) return;
    data = d;
    notifyChanges();
    renderAll();
  };
  es.onerror = () => { offline.textContent = T.offline; offline.hidden = false; };
}
connect();
