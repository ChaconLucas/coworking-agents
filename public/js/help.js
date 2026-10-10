'use strict';
// ---------------- toasts with faces: who needs you ----------------
const helpEl = document.createElement('aside');
helpEl.className = 'help'; helpEl.setAttribute('aria-live', 'polite');
document.body.appendChild(helpEl);
const helpCards = new Map(), doneUntil = new Map();

function helpText(p) {
  const H = T.help;
  if (p.state === 'needs_you') {
    const ask = p.doing && p.doing.ask;
    return ask === 'plan' ? H.plan : ask ? `“${ask}”` : H.question;
  }
  if (p.state === 'waiting') {
    const d = p.doing || {};
    return d.kind === 'terminal' && d.what ? H.run(d.what) : d.kind === 'edit' && d.what ? H.edit(d.what) : H.tool(d.tool || '');
  }
  return H.done(p.title || '');
}

const HELP_MAX = 3, HELP_TTL = 12000; // after 12s without an answer the card shrinks into a face in the top bar
const helpSeen = new Map();

// The top bar IS a little dev office: wall of shelves, night window, lamps, a long counter.
// Up to 4 agents waiting for your reply sit there per "office"; "+" slides to the next office.
const bar = document.querySelector('.bar');
const dockCv = document.createElement('canvas');
dockCv.className = 'bar-scene';
bar.prepend(dockCv);
const dockCtx = dockCv.getContext('2d');
const dock = document.createElement('button'); // the "+" that slides to the next office
dock.className = 'scene-more'; dock.hidden = true;
bar.appendChild(dock);
const DOCK_S = 3, SLOT = 34, PER_OFFICE = 4;
let dockList = [], dockLeaving = [], dockPage = 0, slide = null; // slide = { from, to, at }

function renderDock() {
  const since = p => helpSeen.get(p.id + ':' + p.state) || 0;
  const rank = p => p.state === 'needs_you' || p.state === 'waiting' ? 0 : 1;
  // only pending requests (a question or an approval); finished agents wait in the lounge, not up here
  const list = data.people.filter(p => ['needs_you', 'waiting'].includes(p.state))
    .sort((a, b) => rank(a) - rank(b) || since(b) - since(a));
  const now = Date.now(), keep = new Set(list.map(p => p.id));
  for (const d of dockList) {
    if (keep.has(d.p.id)) continue;
    const back = data.people.find(x => x.id === d.p.id);
    if (back && back.state !== 'asleep' && pageOf(d.i) === dockPage) dockLeaving.push({ ...d, at: now });
    if (popFor === d.p.id) { pop.hidden = true; popFor = null; }
  }
  dockList = list.map((p, i) => ({ p, i }));
  const pages = Math.max(1, Math.ceil(dockList.length / PER_OFFICE));
  if (dockPage >= pages) dockPage = 0;
  dock.hidden = pages < 2;
  dock.textContent = '+' + (dockList.length - PER_OFFICE * (dockPage + 1) > 0 ? dockList.length - PER_OFFICE * (dockPage + 1) : dockList.length - PER_OFFICE);
  dock.title = T.help.nextOffice;
  if (popFor && !pop.hidden) { const d = dockList.find(x => x.p.id === popFor); if (d && pageOf(d.i) === dockPage) showPop(d); }
}
const pageOf = i => Math.floor(i / PER_OFFICE);
dock.addEventListener('click', () => {
  const pages = Math.ceil(dockList.length / PER_OFFICE);
  if (pages < 2) return;
  slide = { from: dockPage, to: (dockPage + 1) % pages, at: performance.now() };
  dockPage = slide.to; pop.hidden = true; popFor = null; renderDock();
});

// geometry of the scene in canvas pixels
function sceneBox() {
  const W = Math.max(200, Math.floor(bar.clientWidth / DOCK_S)), H = Math.ceil(bar.clientHeight / DOCK_S);
  // the agents sit right after the counters panel
  const c = document.getElementById('counts').getBoundingClientRect(), b0 = bar.getBoundingClientRect();
  const x0 = Math.max(Math.round(W * .3), Math.ceil((c.right - b0.left) / DOCK_S) + 18);
  return { W, H, x0, desk: H - 7 };
}

function drawOffice(ox, B, t, page) {
  const { H, desk } = B, f = (t / 140) | 0;
  const people = dockList.filter(d => pageOf(d.i) === page);
  people.forEach((d, k) => {
    const x = ox + k * SLOT;
    Art.blit(Art.portrait(d.p.id), x + 6, desk - 18);
    r(x + 12, desk - 7, 14, 8, PAL.ink); r(x + 13, desk - 6, 12, 6, '#c0cbdc'); r(x + 18, desk - 4, 2, 2, '#ffffff');
    const urgent = d.p.state === 'needs_you' || d.p.state === 'waiting';
    if (urgent) { // red badge
      r(x + 18, desk - 22, 7, 7, PAL.ink); r(x + 19, desk - 21, 5, 5, '#e43b44'); r(x + 21, desk - 20, 1, 2, '#fff'); r(x + 21, desk - 17, 1, 1, '#fff');
      if (f % 4 < 2) { r(x + 5, desk - 22, 1, 2, '#feae34'); r(x + 9, desk - 24, 1, 3, '#feae34'); }
    } else Art.bubble(x + 20, desk - 30, 'done', t); // finished, your turn (not a request)
    // something on the counter between people
    if (k % 2) { r(x + 31, desk - 5, 5, 5, PAL.ink); r(x + 32, desk - 4, 3, 3, Art.SHIRT[Art.hash(d.p.id) % Art.SHIRT.length]); if (f % 8 < 5) r(x + 33, desk - 8 - (f % 3), 1, 2, '#ffffff88'); }
    else if (k < 3) { r(x + 31, desk - 5, 6, 5, PAL.pot); r(x + 32, desk - 10, 1, 5, PAL.leafLight); r(x + 34, desk - 11, 1, 6, PAL.leaf); r(x + 35, desk - 9, 1, 4, PAL.leafLight); }
  });
}

function drawDock(t) {
  const now = Date.now(), f = (t / 140) | 0;
  dockLeaving = dockLeaving.filter(d => now - d.at < 1500);
  const B = sceneBox(), { W, H, x0, desk } = B;
  if (dockCv.width !== W || dockCv.height !== H) { dockCv.width = W; dockCv.height = H; dockCtx.imageSmoothingEnabled = false; }
  const prev = ctx; ctx = dockCtx; Art.setCtx(dockCtx);
  try {
    // wall
    r(0, 0, W, H, '#231d2b');
    for (let x = 0; x < W; x += 24) r(x, 0, 1, desk, '#2a2333');
    // night window and shelves along the wall
    const winX = Math.round(W * .2);
    r(winX - 1, 2, 42, desk - 9, '#0b0a0e'); r(winX, 3, 40, desk - 11, '#141a36');
    for (let k = 0; k < 9; k++) { const h = 4 + Art.hash('bw' + k) % 10; r(winX + k * 5, 3 + desk - 11 - h, 4, h, '#1d2240'); if (Art.hash('bl' + k + ((f / 50) | 0)) % 2) r(winX + k * 5 + 1, desk - 10 - h + 2, 1, 1, '#feae34'); }
    r(winX + 19, 3, 2, desk - 11, '#0b0a0e');
    for (const sx of [Math.round(W * .05), Math.round(W * .32), W - 120]) { if (sx < 0) continue; Art.drawBookshelf(sx, 3, 30, Math.max(12, desk - 12)); }
    // lamps with warm light pools
    const lamps = [x0 - 14, x0 + PER_OFFICE * SLOT + 4];
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const lx of lamps) { const g = ctx.createRadialGradient(lx + 5, desk - 6, 0, lx + 5, desk - 6, 30); g.addColorStop(0, 'rgba(255,190,90,.35)'); g.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = g; ctx.fillRect(lx - 30, desk - 40, 70, 40); }
    ctx.restore();
    // the counter
    r(0, desk, W, 2, '#dc9a6c'); r(0, desk + 2, W, H - desk - 2, '#8f4f3a'); r(0, H - 1, W, 1, PAL.ink);
    for (const lx of lamps) Art.drawLamp(lx, desk - 12, true);
    // retro monitor sign on the right
    const tl = document.querySelector('.bar .tools').getBoundingClientRect().left - bar.getBoundingClientRect().left;
    const mx = Math.floor(tl / DOCK_S) - 40;
    if (mx > x0 + PER_OFFICE * SLOT + 20) {
      r(mx - 2, desk - 26, 34, 24, PAL.ink); r(mx, desk - 24, 30, 20, '#0c1410');
      for (let i = 0; i < 4; i++) r(mx + 3, desk - 21 + i * 4, [18, 16, 20, 14][i], 2, '#3ddc84');
      if (f % 2) r(mx + 3 + 15, desk - 9, 3, 2, '#3ddc84');
      r(mx + 12, desk - 2, 6, 2, PAL.ink);
    }
    Art.drawCat(x0 - 30, desk - 6, 'sleep', t, false);
    // the agents: current office, sliding in from the right when "+" is clicked
    const span = PER_OFFICE * SLOT + 12;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 2, 0, span, H); ctx.clip();
    if (slide && t - slide.at < 450) {
      const k = (t - slide.at) / 450, e = 1 - Math.pow(1 - k, 3), off = Math.round(e * span);
      drawOffice(x0 - off, B, t, slide.from);
      drawOffice(x0 + span - off, B, t, slide.to);
    } else { slide = null; drawOffice(x0, B, t, dockPage); }
    // answered: happy jump with a note and a heart, then gone
    for (const d of dockLeaving) {
      const k = d.i % PER_OFFICE, x = x0 + k * SLOT, age = (now - d.at) / 1500, up = Math.round(age * 12);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - .6) / .4);
      Art.blit(Art.portrait(d.p.id), x + 6, desk - 18 + Math.round(Math.sin(Math.min(1, age * 3) * Math.PI) * -4));
      r(x + 6, desk - 22 - up, 2, 3, '#feae34'); r(x + 8, desk - 24 - up, 1, 3, '#feae34');
      r(x + 20, desk - 22 - up, 2, 2, '#e43b44'); r(x + 23, desk - 22 - up, 2, 2, '#e43b44'); r(x + 20, desk - 20 - up, 5, 2, '#e43b44'); r(x + 21, desk - 18 - up, 3, 1, '#e43b44');
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // place the "+" right after the fourth seat
    dock.style.left = ((x0 + span) * DOCK_S + 4) + 'px';
  } finally { ctx = prev; Art.setCtx(prev); }
}
setInterval(() => { if (data) drawDock(performance.now()); }, 90);

function slotAt(e) {
  const r0 = dockCv.getBoundingClientRect(), B = sceneBox();
  const k = Math.floor(((e.clientX - r0.left) / DOCK_S - B.x0) / SLOT), y = (e.clientY - r0.top) / DOCK_S;
  if (k < 0 || k >= PER_OFFICE || y < B.desk - 30) return null;
  return dockList[dockPage * PER_OFFICE + k] || null;
}

// hover card: big portrait, name, what they said, how long they've waited, go to terminal
const pop = document.createElement('div');
pop.className = 'dpop'; pop.hidden = true;
document.body.appendChild(pop);
let popFor = null, popHide = 0;
function showPop(d) {
  clearTimeout(popHide);
  const p = data && data.people.find(x => x.id === d.p.id);
  if (!p) return;
  popFor = p.id;
  const urgent = p.state === 'needs_you' || p.state === 'waiting';
  const quote = urgent ? helpText(p) : p.lastReply ? `“${p.lastReply}”` : T.states[p.state];
  const status = urgent ? T.help.waitingYou : `${T.states.idle} · ${ago(data.now - (p.since || p.lastActivity))}`;
  pop.innerHTML = `<div class="dpop-face"></div><div class="dpop-body"><b>${esc(p.name)}</b><span class="dpop-repo">${esc(p.repo ? p.repo.name : '')}</span><p>${esc(quote)}</p><small>⌛ ${esc(status)}</small></div>
    <div class="dpop-actions"><button class="hb main" data-pop="goto">${esc(p.agent === 'codex' && !p.pid ? T.panel.gotoCodex : T.panel.goto)} →</button><button class="hb" data-pop="see">${esc(T.help.see)}</button></div>`;
  pop.querySelector('.dpop-face').appendChild(Art.portrait(p.id, p.state === 'needs_you' ? 'open' : null));
  pop.hidden = false;
  const r0 = dockCv.getBoundingClientRect(), cx = r0.left + (sceneBox().x0 + (d.i % PER_OFFICE) * SLOT + 14) * DOCK_S, w = pop.offsetWidth;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, cx - w / 2));
  pop.style.left = left + 'px';
  pop.style.top = (r0.bottom + 10) + 'px';
  pop.style.setProperty('--arrow', (cx - left) + 'px');
}
function hidePop() { popHide = setTimeout(() => { pop.hidden = true; popFor = null; }, 220); }
dockCv.addEventListener('mousemove', e => { const d = slotAt(e); dockCv.style.cursor = d ? 'pointer' : 'default'; if (d && d.p.id !== popFor) showPop(d); else if (d) clearTimeout(popHide); });
dockCv.addEventListener('mouseleave', hidePop);
dockCv.addEventListener('click', e => { const d = slotAt(e); if (d) { pop.hidden = true; openTalk(d.p.id); } });
pop.addEventListener('mouseenter', () => clearTimeout(popHide));
pop.addEventListener('mouseleave', hidePop);
pop.addEventListener('click', async e => {
  const b = e.target.closest('[data-pop]');
  if (!b || !popFor) return;
  if (b.dataset.pop === 'see') { pop.hidden = true; return openTalk(popFor); }
  b.disabled = true;
  try { await fetch('api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id: popFor }) }); } catch {}
  b.disabled = false;
});

let helpOpen = false;
const helpMore = document.createElement('button');
helpMore.className = 'hmore'; helpMore.hidden = true;
helpMore.onclick = () => { helpOpen = !helpOpen; renderHelp(); };

function renderHelp() {
  const now = Date.now();
  const rank = p => p.state === 'needs_you' ? 0 : p.state === 'waiting' ? 1 : 2;
  // a card lives HELP_TTL ms per (person, state); after that only the face in the top bar remains
  for (const p of data.people) { const k = p.id + ':' + p.state; if (!helpSeen.has(k)) helpSeen.set(k, now); }
  const fresh = p => now - helpSeen.get(p.id + ':' + p.state) < HELP_TTL && !dismissed.has(p.id + ':' + p.state);
  const all = data.people.filter(p => ((p.state === 'needs_you' || p.state === 'waiting') && fresh(p)) || (doneUntil.get(p.id) || 0) > now).sort((a, b) => rank(a) - rank(b));
  renderDock();
  // a few cards at a time; the rest go behind an expand button
  const list = helpOpen ? all : all.slice(0, HELP_MAX);
  helpMore.hidden = all.length <= HELP_MAX;
  helpMore.textContent = helpOpen ? T.help.less : T.help.more(all.length - HELP_MAX);
  if (!helpMore.isConnected) helpEl.prepend(helpMore);
  helpEl.classList.toggle('open', helpOpen);
  const keep = new Set(list.map(p => p.id));
  for (const [id, el] of helpCards) if (!keep.has(id)) { el.classList.add('out'); setTimeout(() => el.remove(), 250); helpCards.delete(id); }
  for (const p of list) {
    let el = helpCards.get(p.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'hcard';
      el.dataset.id = p.id;
      const face = Art.portrait(p.id, 'open'); face.className = 'face';
      el.innerHTML = `<div class="who"></div><div class="balloon"><p></p><div class="hbtns"><button class="hb" data-act="see"></button><button class="hb main" data-act="goto"></button><button class="hb x" data-act="close" aria-label="×">×</button></div></div>`;
      el.querySelector('.who').appendChild(face);
      helpEl.appendChild(el);
      helpCards.set(p.id, el);
    }
    const kind = p.state === 'needs_you' || p.state === 'waiting' ? 'urgent' : 'done';
    el.classList.toggle('done', kind === 'done');
    const msg = helpText(p), head = `${p.name}${p.repo ? ' · ' + p.repo.name : ''}`;
    const pEl = el.querySelector('p');
    const html = `<b>${esc(head)}</b>${esc(msg)}`;
    if (pEl.innerHTML !== html) pEl.innerHTML = html;
    el.querySelector('[data-act="see"]').textContent = T.help.see;
    el.querySelector('[data-act="goto"]').textContent = (p.agent === 'codex' && !p.pid ? T.panel.gotoCodex : T.panel.goto) + ' →';
  }
}

helpEl.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'), card = e.target.closest('.hcard');
  if (!b || !card) return;
  const id = card.dataset.id;
  if (b.dataset.act === 'close') { doneUntil.delete(id); card.classList.add('out'); setTimeout(() => card.remove(), 250); helpCards.delete(id); dismissed.add(id + ':' + ((data.people.find(p => p.id === id) || {}).state)); return; }
  if (b.dataset.act === 'see') return showPerson(id);
  b.disabled = true;
  try { await fetch('api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id }) }); } catch {}
  b.disabled = false;
});
const dismissed = new Set();

// take me to the person: switch floor, open the panel and scroll to the desk
function showPerson(id) {
  const f = floorOf(id);
  if (f >= 0 && f !== floor) goFloor(f); else if (building) setBuilding(false);
  selected = id; renderOverlay(); renderPanel();
  const tag = document.querySelector(`.tag[data-id="${CSS.escape(id)}"]`);
  if (tag) tag.scrollIntoView({ block: 'center' }); // jump first, then the camera flies in
  camera(id);
}

// camera: glide and zoom to the agent's desk with a spotlight; null brings it back
const officeEl = document.getElementById('office');
const spot = document.createElement('div');
spot.className = 'spot';
officeEl.appendChild(spot);
function camera(id) {
  const cell = id && layout.find(c => c.p.id === id);
  if (!cell) { officeEl.classList.remove('cam'); officeEl.style.transform = ''; spot.classList.remove('on'); return; }
  const act = cell.actor && cell.actor.mode !== 'desk' ? cell.actor : null;
  // the point to fly to: the agent's face at the monitor (or wherever they are)
  const cx = (act ? act.x + 8 : cell.x + CELL_W / 2) * S, cy = (act ? act.y + 10 : cell.y + 40) * S;
  // land it in the middle of what's visible next to the side panel
  officeEl.classList.remove('cam'); officeEl.style.transform = '';
  const box = officeEl.getBoundingClientRect();
  const panelW = window.innerWidth > 720 ? Math.min(420, window.innerWidth) : 0;
  const tx = (window.innerWidth - panelW) / 2 - box.left, ty = window.innerHeight * .52 - box.top;
  const k = Math.max(2, Math.min(3, 520 / (CELL_W * S) * 2.2));
  // zoom and tilt around the agent itself, then slide that point to the visible centre
  officeEl.style.transformOrigin = `${cx}px ${cy}px`;
  void officeEl.offsetWidth; // restart the transition from the untransformed state
  officeEl.classList.add('cam');
  officeEl.style.transform = `translate(${tx - cx}px, ${ty - cy}px) perspective(1400px) rotateX(9deg) scale(${k})`;
  spot.style.setProperty('--sx', cx + 'px'); spot.style.setProperty('--sy', cy + 'px'); spot.style.setProperty('--r', (70 / k * 1.6) + 'px');
  spot.classList.add('on');
  panelBody.classList.add('enter'); setTimeout(() => panelBody.classList.remove('enter'), 900);
}
window.addEventListener('resize', () => { if (selected && officeEl.classList.contains('cam')) camera(selected); });
