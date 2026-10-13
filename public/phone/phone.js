'use strict';
// phone panel: who needs you and the tasks, with the few answers the phone server accepts
const P = T.phone, X = T.tasks;
const app = document.getElementById('app'), statusEl = document.getElementById('status');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let last = null, busy = false;
const post = body => fetch('api/m', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, reason: 'unknown' }));
const usd = n => 'US$ ' + (Number(n) || 0).toFixed(2);

function render(d) {
  const need = d.people.filter(p => p.state === 'needs_you' || p.state === 'waiting');
  const asking = d.tasks.filter(t => t.ask), waiting = d.tasks.filter(t => !t.ask && ['blocked', 'failed'].includes(t.state)), running = d.tasks.filter(t => !t.ask && ['running', 'pending'].includes(t.state));
  const working = d.people.filter(p => !['needs_you', 'waiting', 'asleep', 'idle'].includes(p.state)).length;
  statusEl.textContent = P.status(working, need.length + asking.length);
  const html = [];
  html.push(`<h2>${esc(P.needYou)}</h2>`);
  if (!need.length && !asking.length) html.push(`<p class="empty">${esc(P.nothing)}</p>`);
  for (const t of asking) html.push(`<div class="card need"><b>🔐 ${esc(t.title)}</b><small>${esc(X.permAsk(t.ask.tool))}</small>${t.ask.what ? `<pre>${esc(t.ask.what)}</pre>` : ''}
    <div class="row"><button data-op="permit" data-id="${esc(t.id)}" data-allow="1">✓ ${esc(X.permAllow)}</button><button class="bad" data-op="permit" data-id="${esc(t.id)}">✕ ${esc(X.permDeny)}</button></div><p class="msg" data-msg="${esc(t.id)}"></p></div>`);
  for (const p of need) html.push(`<div class="card need"><b>${esc(p.name)}</b><small>${esc(p.agent)}${p.title ? ' · ' + esc(p.title) : ''}</small>${p.ask ? `<pre>${esc(p.ask)}</pre>` : ''}
    ${p.options ? `<div class="row">${p.options.map((o, i) => `<button class="ghost" data-op="answer" data-id="${esc(p.id)}" data-choice="${i + 1}">${i + 1}. ${esc(o)}</button>`).join('')}</div>` : `<p class="msg">${esc(P.openOffice)}</p>`}<p class="msg" data-msg="${esc(p.id)}"></p></div>`);
  html.push(`<h2>${esc(P.tasks)}</h2>`);
  if (!waiting.length && !running.length) html.push(`<p class="empty">${esc(P.noTasks)}</p>`);
  for (const t of waiting) html.push(`<div class="card"><b>${esc(t.title)}</b><small>${esc(X.states[t.state])}${t.reason ? ' · ' + esc(X.reasons[t.reason] || t.reason) : ''} · ${esc(t.agent)} · ${t.costUnknown && !t.cost ? '?' : esc(usd(t.cost))}</small>
    ${t.result ? `<pre>${esc(t.result)}</pre>` : ''}${t.review ? `<pre>🔎 ${esc(t.review)}</pre>` : ''}
    <textarea data-text="${esc(t.id)}" placeholder="${esc(X.reply)}"></textarea>
    <div class="row"><button data-op="reply" data-id="${esc(t.id)}">➤ ${esc(X.send)}</button>${t.state === 'blocked' ? `<button class="ghost" data-op="conclude" data-id="${esc(t.id)}">✔ ${esc(X.conclude)}</button>` : ''}</div><p class="msg" data-msg="${esc(t.id)}"></p></div>`);
  for (const t of running) html.push(`<div class="card"><b>${esc(t.title)}</b><small>${esc(X.states[t.state])} · ${esc(t.agent)} · ${t.costUnknown && !t.cost ? '?' : esc(usd(t.cost))}</small>
    <div class="row"><button class="ghost" data-op="cancel" data-id="${esc(t.id)}">✖ ${esc(X.cancel)}</button></div><p class="msg" data-msg="${esc(t.id)}"></p></div>`);
  app.innerHTML = html.join('');
}
async function load() {
  if (busy || (document.activeElement && document.activeElement.tagName === 'TEXTAREA')) return; // don't wipe what is being typed
  const d = await fetch('api/m').then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!d) { statusEl.textContent = P.offline; return; }
  const key = JSON.stringify({ ...d, now: 0 }); if (key !== last) { last = key; render(d); }
}
app.addEventListener('click', async e => {
  const b = e.target.closest('[data-op]'); if (!b) return;
  const op = b.dataset.op, id = b.dataset.id, body = { op, id };
  if (op === 'permit') body.allow = !!b.dataset.allow;
  if (op === 'answer') body.choice = Number(b.dataset.choice);
  if (op === 'reply') { const ta = app.querySelector(`[data-text="${CSS.escape(id)}"]`); body.text = ta ? ta.value.trim() : ''; if (!body.text) return ta && ta.focus(); }
  if (op === 'cancel' && !confirm(X.cancelSure)) return;
  busy = true; b.disabled = true;
  const r = await post(body); busy = false;
  const m = app.querySelector(`[data-msg="${CSS.escape(id)}"]`); if (m) m.textContent = r.ok ? '✓ ' + P.done : '⚠ ' + (P.fail[r.reason] || r.reason || '?');
  b.disabled = false; last = null; setTimeout(load, 800);
});
load(); setInterval(load, 3000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
