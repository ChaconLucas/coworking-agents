'use strict';
// ---------------- loop ----------------
let lastLayoutKey = '';
function renderAll() {
  if (!data) return;
  applyAvatars();
  const key = data.people.map(p => p.id + ':' + roomKey(p)).join(',') + '|' + floor + '|' + document.getElementById('stage').clientWidth;
  noteArrivals();
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
  requestAnimationFrame(loop);
  if (document.hidden) return; // tab not visible: draw nothing (browsers also slow rAF, this makes it zero) // schedule first: an error in one frame must not stop the animation
  if (data && spots) {
    const f = (t / 70) | 0; // ~14 frames per second, a pixel-art pace
    if (f !== lastFrame || (playerOn && (me.moving || me.path.length || keysDown.size))) {
      const dt = lastT ? Math.min(.25, (t - lastT) / 1000) : 0;
      lastT = t; lastFrame = f;
      if (trophyView) (viewName === 'terrace' ? drawTerrace : viewName === 'servers' ? drawServers : drawTrophyRoom)(t); else if (building) { if (f % 3 === 0) drawThumbs(t, dt * 3); } else drawScene(t, dt);
    }
  }
}
requestAnimationFrame(loop);
window.addEventListener('resize', () => { if (data) { lastLayoutKey = ''; renderAll(); } });
setInterval(() => { if (data) renderOverlay(); }, 500);

// ---------------- data ----------------
// someone who closed their session stays a few seconds as a "leaving" ghost: they pack up and walk
// out, then their desk is demolished, and only then the room shrinks
const LEAVE_MS = 6000; // walk out (~2.4s) + demolition (3.4s)
let lastPeople = new Map();
const leavers = new Map();
function keepLeavers(d) {
  const now = Date.now(), ids = new Set(d.people.map(p => p.id));
  for (const [id, p] of lastPeople) if (!ids.has(id) && !p.leaving && !leavers.has(id)) leavers.set(id, { ...p, state: 'leaving', leaving: now, doing: null, subagents: [] });
  for (const [id, g] of leavers) { if (ids.has(id) || now - g.leaving > LEAVE_MS) leavers.delete(id); else d.people.push(g); }
  lastPeople = new Map(d.people.filter(p => !p.leaving).map(p => [p.id, p]));
}
const offline = document.getElementById('offline');
function connect() {
  const es = new EventSource('events');
  es.onmessage = e => {
    offline.hidden = true;
    const d = JSON.parse(e.data);
    if (d.error) return;
    keepLeavers(d);
    liveData = d;
    for (const p of d.people) if (p.agentLabel && !AGENT[p.agent]) AGENT[p.agent] = { label: p.agentLabel, color: p.agentColor || '#8a8f98' }; // AIs found by process
    data = applyReplay(d);
    notifyChanges();
    checkAlerts();
    checkAchievements();
    renderAll();
  };
  es.onerror = () => { offline.textContent = T.offline; offline.hidden = false; };
}
connect();
