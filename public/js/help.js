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

// everyone still waiting on you sits on a wooden shelf in the top bar until you answer them
const dock = document.createElement('div');
dock.className = 'dock';
document.querySelector('.bar .counts').after(dock);
const dockFaces = new Map();
dock.addEventListener('click', e => { const f = e.target.closest('.dface[data-id]'); if (f) showPerson(f.dataset.id); });

// hover card: big portrait, name, what they said, how long they've waited, go to terminal
const pop = document.createElement('div');
pop.className = 'dpop'; pop.hidden = true;
document.body.appendChild(pop);
let popFor = null, popHide = 0;
function showPop(el) {
  clearTimeout(popHide);
  const p = data && data.people.find(x => x.id === el.dataset.id);
  if (!p) return;
  popFor = p.id;
  const urgent = p.state === 'needs_you' || p.state === 'waiting';
  const quote = urgent ? helpText(p) : p.lastReply ? `“${p.lastReply}”` : T.states[p.state];
  const status = urgent ? T.help.waitingYou : p.state === 'asleep' ? `${T.states.asleep} · ${ago(data.now - (p.since || p.lastActivity))}` : `${T.states.idle} · ${ago(data.now - (p.since || p.lastActivity))}`;
  pop.innerHTML = `<div class="dpop-face"></div><div class="dpop-body"><b>${esc(p.name)}</b><span class="dpop-repo">${esc(p.repo ? p.repo.name : '')}</span><p>${esc(quote)}</p><small>⌛ ${esc(status)}</small></div>
    <div class="dpop-actions"><button class="hb main" data-pop="goto">${esc(p.agent === 'codex' && !p.pid ? T.panel.gotoCodex : T.panel.goto)} →</button><button class="hb" data-pop="see">${esc(T.help.see)}</button></div>`;
  pop.querySelector('.dpop-face').appendChild(Art.portrait(p.id, p.state === 'needs_you' ? 'open' : null));
  pop.hidden = false;
  const r = el.getBoundingClientRect(), w = pop.offsetWidth;
  pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  pop.style.top = (r.bottom + 10) + 'px';
  pop.style.setProperty('--arrow', (r.left + r.width / 2 - parseFloat(pop.style.left)) + 'px');
}
function hidePop() { popHide = setTimeout(() => { pop.hidden = true; popFor = null; }, 220); }
dock.addEventListener('mouseover', e => { const f = e.target.closest('.dface[data-id]'); if (f && f.dataset.id !== popFor) showPop(f); else if (f) clearTimeout(popHide); });
dock.addEventListener('mouseleave', hidePop);
pop.addEventListener('mouseenter', () => clearTimeout(popHide));
pop.addEventListener('mouseleave', hidePop);
pop.addEventListener('click', async e => {
  const b = e.target.closest('[data-pop]');
  if (!b || !popFor) return;
  if (b.dataset.pop === 'see') { pop.hidden = true; return showPerson(popFor); }
  b.disabled = true;
  try { await fetch('api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id: popFor }) }); } catch {}
  b.disabled = false;
});

function renderDock() {
  const since = p => helpSeen.get(p.id + ':' + p.state) || 0;
  const rank = p => p.state === 'needs_you' || p.state === 'waiting' ? 0 : p.state === 'idle' ? 1 : 2;
  // asleep sessions are still waiting on you: they stay (at the end) until you send them something
  const list = data.people.filter(p => ['needs_you', 'waiting', 'idle', 'asleep'].includes(p.state))
    .sort((a, b) => rank(a) - rank(b) || since(b) - since(a));
  const keep = new Set(list.map(p => p.id));
  for (const [id, el] of dockFaces) {
    if (keep.has(id)) continue;
    dockFaces.delete(id);
    // answered (back to work): a happy little jump with a note and a heart, then gone
    const p = data.people.find(x => x.id === id);
    if (p && !el.classList.contains('happy')) {
      el.classList.add('happy');
      el.insertAdjacentHTML('beforeend', '<i class="fx note">♪</i><i class="fx heart">♥</i>');
      setTimeout(() => el.remove(), 1500);
    } else el.remove();
    if (popFor === id) { pop.hidden = true; popFor = null; }
  }
  list.forEach((p, i) => {
    let el = dockFaces.get(p.id);
    if (!el) {
      el = document.createElement('button');
      el.className = 'dface'; el.dataset.id = p.id;
      el.innerHTML = '<span class="bub"></span><span class="fizz"><i></i><i></i><i></i></span><span class="tag"></span>';
      el.insertBefore(Art.portrait(p.id), el.querySelector('.tag'));
      dockFaces.set(p.id, el);
    }
    const urgent = p.state === 'needs_you' || p.state === 'waiting';
    el.classList.toggle('urgent', urgent);
    el.classList.toggle('sleepy', p.state === 'asleep');
    el.querySelector('.bub').textContent = p.state === 'asleep' ? 'zZ' : '...'; // the pixel font has no ellipsis glyph
    el.querySelector('.tag').textContent = shortName(p.name);
    el.setAttribute('aria-label', `${p.name} — ${urgent ? helpText(p) : T.states[p.state]}`);
    const at = [...dock.children].filter(c => !c.classList.contains('happy'))[i];
    if (at !== el) dock.insertBefore(el, at || null);
  });
  if (popFor && !pop.hidden) { const el = dockFaces.get(popFor); if (el) showPop(el); }
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
