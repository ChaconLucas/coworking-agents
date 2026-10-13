'use strict';
// phone app: four tabs (Now, Tasks, Office, Usage) over the restricted phone server
const P = T.phone, X = T.tasks;
const app = document.getElementById('app'), statusEl = document.getElementById('status'), tabsEl = document.getElementById('tabs');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let last = null, busy = false, tab = 'now', d = null;
try { tab = localStorage.getItem('cw.phone.tab') || 'now'; } catch {}
const post = body => fetch('api/m', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, reason: 'unknown' }));
const usd = n => 'US$ ' + (Number(n) || 0).toFixed(2);
const ago = ms => { const m = Math.round(ms / 60000); return m < 1 ? P.justNow : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`; };
const working = p => !['idle', 'asleep', 'needs_you', 'waiting'].includes(p.state);
const pill = (cls, txt) => `<span class="pill ${cls}">${esc(txt)}</span>`;
const stateCls = s => s === 'needs_you' || s === 'waiting' ? 'need' : ['idle', 'asleep'].includes(s) ? 'idle' : 'work';

function nowTab() {
  const need = d.people.filter(p => p.state === 'needs_you' || p.state === 'waiting'), asking = d.tasks.filter(t => t.ask);
  const others = d.people.filter(p => !need.includes(p)).sort((a, b) => working(b) - working(a));
  const h = [`<h2>${esc(P.needYou)}</h2>`];
  if (!need.length && !asking.length) h.push(`<p class="empty">✓ ${esc(P.nothing)}</p>`);
  for (const t of asking) h.push(`<div class="card need"><b>🔐 ${esc(t.title)}</b><small>${esc(X.permAsk(t.ask.tool))}</small>${t.ask.what ? `<pre>${esc(t.ask.what)}</pre>` : ''}
    <div class="row"><button data-op="permit" data-id="${esc(t.id)}" data-allow="1">✓ ${esc(X.permAllow)}</button><button class="bad" data-op="permit" data-id="${esc(t.id)}">✕ ${esc(X.permDeny)}</button></div><p class="msg" data-msg="${esc(t.id)}"></p></div>`);
  for (const p of need) h.push(`<div class="card need"><div class="who"><span class="face" data-face="${esc(p.id)}"></span><div class="txt"><b>${esc(p.name)}</b><small>${esc(p.agent)}${p.repo ? ' · ' + esc(p.repo) : ''}${p.title ? ' · ' + esc(p.title) : ''}</small>${p.ask ? `<pre>${esc(p.ask)}</pre>` : ''}
    ${p.options ? `<div class="row">${p.options.map((o, i) => `<button class="ghost" data-op="answer" data-id="${esc(p.id)}" data-choice="${i + 1}">${i + 1}. ${esc(o)}</button>`).join('')}</div>` : `<p class="msg">${esc(P.openOffice)}</p>`}<p class="msg" data-msg="${esc(p.id)}"></p></div></div></div>`);
  h.push(`<h2>${esc(P.agents)} <small>${others.length}</small></h2>`);
  if (!others.length) h.push(`<p class="empty">${esc(P.noAgents)}</p>`);
  for (const p of others) h.push(`<div class="card agent"><div class="who"><span class="face" data-face="${esc(p.id)}"></span><div class="txt"><div class="line"><b>${esc(p.name)}</b>${pill(stateCls(p.state), T.states[p.state] || p.state)}</div>
    <small>${esc(p.agent)}${p.repo ? ' · ' + esc(p.repo) : ''}${p.branch ? ' · ' + esc(p.branch) : ''}${p.since ? ' · ' + esc(ago(d.now - p.since)) : ''}</small>
    ${p.doing && working(p) ? `<p class="doing">${esc(p.doing)}</p>` : p.title ? `<p class="doing dim">${esc(p.title)}</p>` : ''}</div></div></div>`);
  return h.join('');
}
function tasksTab() {
  const groups = [['need', ['blocked', 'failed']], ['active', ['running', 'pending']], ['done', ['done', 'cancelled']]];
  const h = [`<details class="card new"><summary>＋ ${esc(P.newTask)}</summary>${d.folders.length ? `<textarea data-new-text placeholder="${esc(P.newPh)}"></textarea>
    <select data-new-dir>${d.folders.map(f => `<option value="${esc(f)}">${esc(f.replace(/^\/Users\/[^/]+|^\/home\/[^/]+/, '~'))}</option>`).join('')}</select>
    <select data-new-agent><option value="auto">${esc(X.auto)}</option><option value="claude">Claude Code</option><option value="codex">Codex</option></select>
    <div class="row"><button data-op="create">➤ ${esc(X.create)}</button></div><p class="msg" data-msg="new"></p>` : `<p class="msg">${esc(P.noFolders)}</p>`}</details>`];
  for (const [g, sts] of groups) {
    const items = d.tasks.filter(t => sts.includes(t.state)); if (!items.length) continue;
    h.push(`<h2>${esc(X.groups[g])} <small>${items.length}</small></h2>`);
    for (const t of g === 'done' ? items.slice(0, 8) : items) h.push(`<div class="card"><div class="line"><b>${esc(t.title)}</b>${pill(g === 'need' ? 'need' : g === 'active' ? 'work' : 'idle', X.states[t.state])}</div>
      <small>${t.reason ? esc(X.reasons[t.reason] || t.reason) + ' · ' : ''}${esc(t.agent)} · ${t.costUnknown && !t.cost ? '?' : esc(usd(t.cost))} · ${esc(ago(d.now - t.updated))}</small>
      ${t.ask ? `<p class="doing">🔐 ${esc(X.permAsk(t.ask.tool))}</p>` : ''}${t.result ? `<pre>${esc(t.result)}</pre>` : ''}${t.review ? `<pre>🔎 ${esc(t.review)}</pre>` : ''}
      ${g === 'need' ? `<textarea data-text="${esc(t.id)}" placeholder="${esc(X.reply)}"></textarea><div class="row"><button data-op="reply" data-id="${esc(t.id)}">➤ ${esc(X.send)}</button>${t.state === 'blocked' ? `<button class="ghost" data-op="conclude" data-id="${esc(t.id)}">✔ ${esc(X.conclude)}</button>` : ''}<button class="ghost" data-op="retry" data-id="${esc(t.id)}">↻ ${esc(X.retry)}</button></div>` : ''}
      ${g === 'active' ? `<div class="row"><button class="ghost" data-op="cancel" data-id="${esc(t.id)}">✖ ${esc(X.cancel)}</button></div>` : ''}<p class="msg" data-msg="${esc(t.id)}"></p></div>`);
  }
  if (!d.tasks.length) h.push(`<p class="empty">${esc(P.noTasks)}</p>`);
  return h.join('');
}
function officeTab() {
  const w = d.people.filter(working).length, n = d.people.filter(p => p.state === 'needs_you' || p.state === 'waiting').length;
  return `<div class="counts"><span>● ${esc(P.working(w))}</span><span class="${n ? 'red' : ''}">❗ ${esc(P.needCount(n))}</span><span>☾ ${esc(P.idleCount(d.people.length - w - n))}</span></div>
    ${d.frameAt ? `<img class="frame" src="frame.png?${d.frameAt}" alt="${esc(P.officeAlt)}"><p class="msg dim">${esc(P.officeNote(ago(d.now - d.frameAt)))}</p>` : `<p class="empty">${esc(P.noFrame)}</p>`}`;
}
function usageTab() {
  const u = d.usage || {}, bar = (pct, label, sub) => `<div class="meter"><div class="line"><b>${esc(label)}</b><span>${pct}%</span></div><div class="bar"><i style="width:${Math.min(100, pct)}%" class="${pct > 85 ? 'hi' : pct > 60 ? 'mid' : ''}"></i></div>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  const h = [`<div class="tiles"><div><b>${esc(usd(u.today))}</b><small>${esc(P.today)}</small></div><div><b>${esc(usd(u.month))}</b><small>${esc(P.month)}</small></div></div>`];
  if (u.goal) h.push(bar(Math.round(u.month / u.goal * 100), P.goal(usd(u.goal)), ''));
  h.push(`<h2>${esc(P.limits)}</h2>`);
  if (!d.limits.length) h.push(`<p class="empty">${esc(P.noLimits)}</p>`);
  for (const l of d.limits) h.push(bar(l.pct, `${l.ai === 'claude' ? 'Claude' : l.ai === 'codex' ? 'Codex' : l.ai} · ${l.window === '5h' ? P.fiveH : P.week}`, l.resetsAt ? P.resets(ago(l.resetsAt - d.now)) : ''));
  h.push(`<p class="msg dim">${esc(P.estimate)}</p>`);
  return h.join('');
}
function render() {
  const n = d.people.filter(p => p.state === 'needs_you' || p.state === 'waiting').length + d.tasks.filter(t => t.ask).length;
  statusEl.textContent = P.status(d.people.filter(working).length, n);
  tabsEl.innerHTML = [['now', '●', P.tabNow, n], ['tasks', '☰', P.tabTasks, d.tasks.filter(t => ['blocked', 'failed'].includes(t.state)).length], ['office', '▦', P.tabOffice, 0], ['usage', '$', P.tabUsage, 0]]
    .map(([k, icon, label, badge]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}"><span class="ic">${icon}</span>${esc(label)}${badge ? `<i>${badge}</i>` : ''}</button>`).join('');
  app.innerHTML = tab === 'tasks' ? tasksTab() : tab === 'office' ? officeTab() : tab === 'usage' ? usageTab() : nowTab();
  // each agent's face, drawn by the office's own pixel art (the same look as on the computer)
  if (window.Art) app.querySelectorAll('[data-face]').forEach(el => { try { el.appendChild(Art.portrait(el.dataset.face)); } catch {} });
}
async function load(force) {
  const a = document.activeElement;
  if (!force && (busy || (a && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) || document.querySelector('details[open].new'))) return; // don't wipe what is being typed
  const r = await fetch('api/m').then(x => (x.ok ? x.json() : null)).catch(() => null);
  if (!r) { statusEl.textContent = P.offline; return; }
  const key = JSON.stringify({ ...r, now: 0 }); d = r; if (force || key !== last) { last = key; render(); }
}
tabsEl.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; try { localStorage.setItem('cw.phone.tab', tab); } catch {} scrollTo(0, 0); if (d) render(); });
app.addEventListener('click', async e => {
  const b = e.target.closest('[data-op]'); if (!b) return;
  const op = b.dataset.op, id = b.dataset.id || 'new', body = { op, id };
  if (op === 'permit') body.allow = !!b.dataset.allow;
  if (op === 'answer') body.choice = Number(b.dataset.choice);
  if (op === 'reply') { const ta = app.querySelector(`[data-text="${CSS.escape(id)}"]`); body.text = ta ? ta.value.trim() : ''; if (!body.text) return ta && ta.focus(); }
  if (op === 'create') { const ta = app.querySelector('[data-new-text]'); body.text = ta ? ta.value.trim() : ''; if (!body.text) return ta && ta.focus(); body.dir = app.querySelector('[data-new-dir]').value; body.agent = app.querySelector('[data-new-agent]').value; }
  if (op === 'cancel' && !confirm(X.cancelSure)) return;
  busy = true; b.disabled = true;
  const r = await post(body); busy = false;
  const m = app.querySelector(`[data-msg="${CSS.escape(id)}"]`); if (m) m.textContent = r.ok ? '✓ ' + P.done : '⚠ ' + (P.fail[r.reason] || r.reason || '?');
  b.disabled = false; last = null;
  if (op === 'create' && r.ok) { const det = app.querySelector('details.new'); if (det) det.open = false; setTimeout(() => load(true), 600); return; }
  setTimeout(load, 800);
});
load(true); setInterval(load, 3000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(true); });
