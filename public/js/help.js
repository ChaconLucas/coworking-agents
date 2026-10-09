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

// faces of everyone still waiting on you, in the top bar, until they're answered
const dock = document.createElement('div');
dock.className = 'dock';
document.querySelector('.bar .counts').after(dock);
const dockFaces = new Map();
dock.addEventListener('click', e => { const f = e.target.closest('[data-id]'); if (f) showPerson(f.dataset.id); });

function renderDock() {
  // folder tabs: newest in front and brightest, older ones step back, smaller and dimmer
  const since = p => helpSeen.get(p.id + ':' + p.state) || 0;
  const list = data.people.filter(p => ['needs_you', 'waiting', 'idle'].includes(p.state))
    .sort((a, b) => (a.state === 'idle') - (b.state === 'idle') || since(b) - since(a));
  const keep = new Set(list.map(p => p.id));
  for (const [id, el] of dockFaces) if (!keep.has(id)) { el.remove(); dockFaces.delete(id); }
  list.forEach((p, i) => {
    let el = dockFaces.get(p.id);
    if (!el) {
      el = document.createElement('button');
      el.className = 'dface'; el.dataset.id = p.id;
      el.innerHTML = '<span class="dname"></span>';
      el.prepend(Art.portrait(p.id));
      dockFaces.set(p.id, el);
    }
    const urgent = p.state !== 'idle';
    el.classList.toggle('urgent', urgent);
    el.querySelector('.dname').textContent = shortName(p.name);
    el.title = `${p.name} — ${urgent ? helpText(p) : T.states.idle}`;
    el.style.setProperty('--i', i);
    el.style.zIndex = String(100 - i);
    if (dock.children[i] !== el) dock.insertBefore(el, dock.children[i] || null);
  });
}

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
  if (tag) tag.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
