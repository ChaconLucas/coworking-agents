'use strict';
// phone app: four tabs (Now, Tasks, Office, Usage) and one agent in full, live over the restricted phone server
const P = T.phone, X = T.tasks;
const app = document.getElementById('app'), statusEl = document.getElementById('status'), tabsEl = document.getElementById('tabs');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let last = null, busy = false, tab = 'now', d = null, pending = null, streamAt = 0, detail = null, dd = null, diffs = {}, sub = 'info', talk = null, talkQ = '', talkTimer = 0, es = null, talkSub = '', helpers = [];
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
  for (const p of need) h.push(`<div class="card need" data-agent="${esc(p.id)}"><div class="who"><span class="face" data-face="${esc(p.id)}"></span><div class="txt"><b>${esc(p.name)}</b><small>${esc(p.agent)}${p.repo ? ' · ' + esc(p.repo) : ''}${p.title ? ' · ' + esc(p.title) : ''}</small>${p.ask ? `<pre>${esc(p.ask)}</pre>` : ''}
    ${p.options ? `<div class="row">${p.options.map((o, i) => `<button class="ghost" data-op="answer" data-id="${esc(p.id)}" data-choice="${i + 1}">${i + 1}. ${esc(o)}</button>`).join('')}</div>` : `<p class="msg">${esc(P.openOffice)}</p>`}<p class="msg" data-msg="${esc(p.id)}"></p></div></div></div>`);
  h.push(`<h2>${esc(P.agents)} <small>${others.length}</small></h2>`);
  if (!others.length) h.push(`<p class="empty">${esc(P.noAgents)}</p>`);
  for (const p of others) h.push(`<div class="card agent" data-agent="${esc(p.id)}"><div class="who"><span class="face" data-face="${esc(p.id)}"></span><div class="txt"><div class="line"><b>${esc(p.name)}</b>${pill(stateCls(p.state), T.states[p.state] || p.state)}</div>
    <small>${esc(p.agent)}${p.repo ? ' · ' + esc(p.repo) : ''}${p.branch ? ' · ' + esc(p.branch) : ''}${p.since ? ' · ' + esc(ago(d.now - p.since)) : ''}</small>
    ${p.doing && working(p) ? `<p class="doing">${esc(p.doing)}</p>` : p.title ? `<p class="doing dim">${esc(p.title)}</p>` : ''}${p.lastReply && !working(p) ? `<p class="said">💬 ${esc(p.lastReply)}</p>` : ''}</div><span class="more">›</span></div></div>`);
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
      ${g === 'active' ? `<div class="row"><button class="ghost" data-op="cancel" data-id="${esc(t.id)}">✖ ${esc(X.cancel)}</button></div>` : ''}
      ${d.privacy ? '' : `<div class="row"><button class="ghost" data-diff="${esc(t.id)}">${diffs[t.id] ? '▾ ' + esc(P.diffHide) : '▸ ' + esc(P.diff)}</button></div>${diffView(diffs[t.id])}`}<p class="msg" data-msg="${esc(t.id)}"></p></div>`);
  }
  if (!d.tasks.length) h.push(`<p class="empty">${esc(P.noTasks)}</p>`);
  return h.join('');
}
// what a task changed: the summary, then each line coloured (added, removed, where)
function diffView(x) {
  if (!x) return '';
  if (x === 'loading') return `<p class="msg dim">…</p>`;
  if (!x.ok) return `<p class="msg">⚠ ${esc(P.fail[x.reason] || x.reason || '?')}</p>`;
  if (!x.stat && !x.diff) return `<p class="msg dim">${esc(P.noDiff)}</p>`;
  const lines = String(x.diff || '').split('\n').slice(0, 1500).map(l => `<span class="${l.startsWith('@@') ? 'hunk' : l.startsWith('+') && !l.startsWith('+++') ? 'add' : l.startsWith('-') && !l.startsWith('---') ? 'del' : l.startsWith('diff ') ? 'file' : ''}">${esc(l)}</span>`).join('\n');
  return `${x.stat ? `<pre>${esc(x.stat)}</pre>` : ''}<pre class="diff">${lines}</pre>`;
}
// one agent in full
function agentView() {
  const a = dd, back = `<button class="ghost back" data-back>‹ ${esc(P.back)}</button>`;
  if (!a) return back + `<p class="empty">${dd === undefined ? esc(P.agentGone) : '…'}</p>`;
  const need = a.state === 'needs_you' || a.state === 'waiting', h = [back];
  h.push(`<div class="card${need ? ' need' : ''}"><div class="who"><span class="face" data-face="${esc(a.id)}"></span><div class="txt"><div class="line"><b>${esc(a.name)}</b>${pill(stateCls(a.state), T.states[a.state] || a.state)}</div>
    <small>${esc(a.agent)}${a.repo ? ' · ' + esc(a.repo) : ''}${a.branch ? ' · ' + esc(a.branch) : ''}${a.since ? ' · ' + esc(ago(Date.now() - a.since)) : ''}</small>${a.title ? `<p class="doing dim">${esc(a.title)}</p>` : ''}</div></div></div>`);
  h.push(`<div class="subtabs"><button class="${sub === 'info' ? 'on' : ''}" data-sub="info">${esc(P.summaryTab)}</button>${d && d.privacy ? '' : `<button class="${sub === 'talk' ? 'on' : ''}" data-sub="talk">💬 ${esc(P.talkTab)}</button>`}</div>`);
  if (sub === 'talk') return h.join('') + talkView(a);
  if (a.doing) {
    h.push(`<h2>${esc(need ? P.asking : P.doingNow)}</h2><div class="card${need ? ' need' : ''}"><b>${esc(a.doing.tool)}</b>${a.doing.ask || a.doing.what ? `<pre>${esc(a.doing.ask || a.doing.what)}</pre>` : ''}
      ${need ? (a.doing.options ? `<div class="row">${a.doing.options.map((o, i) => `<button class="ghost" data-op="answer" data-id="${esc(a.id)}" data-choice="${i + 1}">${i + 1}. ${esc(o)}</button>`).join('')}</div>` : `<p class="msg">${esc(P.openOffice)}</p>`) : ''}<p class="msg" data-msg="${esc(a.id)}"></p></div>`);
  }
  if (a.lastPrompt) h.push(`<h2>${esc(P.lastAsk)} <small>${a.lastPromptAt ? esc(ago(Date.now() - a.lastPromptAt)) : ''}</small></h2><div class="card"><p class="text">${esc(a.lastPrompt)}</p></div>`);
  if (a.lastReply) h.push(`<h2>${esc(P.lastReply)} <small>${a.lastReplyAt ? esc(ago(Date.now() - a.lastReplyAt)) : ''}</small></h2><div class="card"><p class="text">${esc(a.lastReply)}</p></div>`);
  h.push(`<div class="card">${a.canMsg ? `<textarea data-text="msg" placeholder="${esc(P.msgPh)}"></textarea><div class="row"><button data-op="message" data-id="${esc(a.id)}">➤ ${esc(P.msgSend)}</button></div>` : `<p class="msg dim">${esc(P.msgOnlyIdle)}</p>`}<p class="msg" data-msg="msg"></p></div>`);
  if (a.recent.length) h.push(`<h2>${esc(P.recent)}</h2><div class="card">${a.recent.map(r => `<div class="act"><b>${esc(r.tool)}</b><span>${esc(r.what)}</span><small>${r.ts ? esc(ago(Date.now() - r.ts)) : ''}</small></div>`).join('')}</div>`);
  if (a.files.length) h.push(`<h2>${esc(P.files)} <small>${a.files.length}</small></h2><div class="card">${a.files.map(f => `<div class="act"><span>${esc(f.name)}</span><small>${f.at ? esc(ago(Date.now() - f.at)) : ''}</small></div>`).join('')}</div>`);
  if (a.subagents.length) h.push(`<h2>${esc(P.helpers)}</h2><div class="card">${a.subagents.map(n => `<div class="act"><span>● ${esc(n)}</span></div>`).join('')}</div>`);
  const pct = a.ctxMax ? Math.round(a.ctx / a.ctxMax * 100) : 0;
  h.push(`<h2>${esc(P.info)}</h2><div class="card"><div class="act"><span>${esc(P.model)}</span><b>${esc(a.model || '?')}${a.effort ? ' · ' + esc(a.effort) : ''}</b></div>
    ${a.ctxMax ? `<div class="act"><span>${esc(P.ctx)}</span><b>${pct}%</b></div><div class="bar"><i style="width:${Math.min(100, pct)}%" class="${pct > 85 ? 'hi' : pct > 60 ? 'mid' : ''}"></i></div>` : ''}
    <div class="act"><span>${esc(P.cost)}</span><b>${esc(usd(a.usd))}</b></div><div class="act"><span>${esc(P.turns)}</span><b>${a.turns}</b></div>
    ${a.startedAt ? `<div class="act"><span>${esc(P.open)}</span><b>${esc(ago(Date.now() - a.startedAt))}</b></div>` : ''}${a.cwd ? `<div class="act"><span>${esc(P.folder)}</span><b>${esc(a.cwd)}</b></div>` : ''}</div>`);
  return h.join('');
}
// the whole conversation as a chat, with a search inside it; only the list is redrawn while you type the search
const mark = (text, q) => {
  const t = String(text || ''); if (!q) return esc(t);
  const low = t.toLowerCase(), out = []; let i = 0, k;
  while ((k = low.indexOf(q, i)) >= 0) { out.push(esc(t.slice(i, k)), '<mark>', esc(t.slice(k, k + q.length)), '</mark>'); i = k + q.length; }
  out.push(esc(t.slice(i))); return out.join('');
};
// **bold** and `code` on already escaped text (the markers are plain characters, nothing else is interpreted)
const md = h => h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
const clock = ms => { const x = new Date(ms), today = new Date().toDateString() === x.toDateString(); return x.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en', today ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
function talkList() {
  if (!talk) return `<p class="empty">…</p>`;
  if (!talk.ok) return `<p class="msg">⚠ ${esc(P.fail[talk.reason] || talk.reason || '?')}</p>`;
  const q = talkQ.toLowerCase();
  if (!talk.items.length) return `<p class="empty">${esc(q ? P.talkNone : P.talkEmpty)}</p>`;
  return (q ? `<p class="msg dim">${esc(P.talkFound(talk.found))}</p>` : talk.cut || talk.total > talk.items.length ? `<p class="msg dim">${esc(P.talkCut)}</p>` : '')
    + talk.items.map(m => `<div class="bubble ${m.role === 'user' ? 'me' : 'it'}"><p>${md(mark(m.text, q))}</p><small>${(h => m.role === 'user' ? esc(h && dd ? dd.name : P.you) : esc(h ? h.type : dd ? dd.name : ''))(helpers.find(x => x.id === talkSub))}${m.at ? ' · ' + esc(clock(m.at)) : ''}</small></div>`).join('');
}
// the agent itself and each of its helpers (subagents); a dot marks the ones still working
function helpersHtml() {
  if (!helpers.length) return '';
  const cur = helpers.find(h => h.id === talkSub);
  return `<div class="helpers"><button class="${talkSub ? '' : 'on'}" data-subag="">${esc(P.main)}</button>${helpers.map(h => `<button class="${h.id === talkSub ? 'on' : ''}" data-subag="${esc(h.id)}">${h.live ? '● ' : ''}${esc(h.type)}</button>`).join('')}</div>
    ${cur ? `<p class="msg dim">🤖 ${esc(P.helperOf(cur.type))}${cur.what ? ': ' + esc(cur.what) : ''}</p>` : ''}`;
}
function talkView(a) {
  return `<div id="talkhelpers">${helpersHtml()}</div><input type="search" class="talkq" data-talkq placeholder="${esc(P.talkSearch)}" value="${esc(talkQ)}" enterkeyhint="search"><div id="talklist">${talkList()}</div>
    <div class="card composer"${talkSub ? ' hidden' : ''}>${a.canMsg ? `<textarea data-text="msg" placeholder="${esc(P.msgPh)}"></textarea><div class="row"><button data-op="message" data-id="${esc(a.id)}">➤ ${esc(P.msgSend)}</button></div>` : `<p class="msg dim">${esc(P.msgOnlyIdle)}</p>`}<p class="msg" data-msg="msg"></p></div>`;
}
async function loadTalk(toEnd) {
  const id = detail; if (!id || sub !== 'talk') return;
  const r = await fetch(`api/talk?id=${encodeURIComponent(id)}&q=${encodeURIComponent(talkQ)}&sub=${encodeURIComponent(talkSub)}`).then(x => (x.ok ? x.json() : null)).catch(() => null);
  if (detail !== id || sub !== 'talk' || !r) return;
  if (r.helpers) helpers = r.helpers;
  const same = talk && JSON.stringify(talk) === JSON.stringify(r); talk = r; if (same && !toEnd) return;
  const hb = document.getElementById('talkhelpers'); if (hb) hb.innerHTML = helpersHtml();
  const atEnd = app.scrollHeight - app.scrollTop - app.clientHeight < 120, list = document.getElementById('talklist');
  if (list && (typing() || document.activeElement === document.querySelector('[data-talkq]'))) list.innerHTML = talkList(); // keep the search box and its caret
  else if (!typing()) { const y = app.scrollTop; render(); app.scrollTop = y; }
  if ((toEnd || atEnd) && !talkQ) app.scrollTop = app.scrollHeight;
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
  statusEl.textContent = P.status(d.people.filter(working).length, n) + (Date.now() - streamAt < 8000 ? ' · ● ' + P.live : '');
  tabsEl.innerHTML = [['now', '●', P.tabNow, n], ['tasks', '☰', P.tabTasks, d.tasks.filter(t => ['blocked', 'failed'].includes(t.state)).length], ['office', '▦', P.tabOffice, 0], ['usage', '$', P.tabUsage, 0]]
    .map(([k, icon, label, badge]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}"><span class="ic">${icon}</span>${esc(label)}${badge ? `<i>${badge}</i>` : ''}</button>`).join('');
  app.innerHTML = detail ? agentView() : tab === 'tasks' ? tasksTab() : tab === 'office' ? officeTab() : tab === 'usage' ? usageTab() : nowTab();
  // each agent's face, drawn by the office's own pixel art (the same look as on the computer)
  if (window.Art) app.querySelectorAll('[data-face]').forEach(el => { try { el.appendChild(Art.portrait(el.dataset.face)); } catch {} });
}
const typing = () => { const a = document.activeElement; return busy || (a && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.tagName === 'INPUT')) || document.querySelector('details[open].new'); };
// a new view: drawn now, or kept until you stop typing (never wipes what is being written)
function apply(r, force) {
  if (!force && typing()) { pending = r; return; }
  pending = null;
  const key = JSON.stringify({ ...r, now: 0 }); d = r;
  if (force || key !== last) { last = key; if (detail) loadDetail(); else { const y = app.scrollTop; render(); app.scrollTop = y; } }
}
async function load(force) {
  if (!force && typing()) return;
  const r = await fetch('api/m').then(x => (x.ok ? x.json() : null)).catch(() => null);
  if (!r) { statusEl.textContent = P.offline; return; }
  apply(r, force);
}
async function loadDetail() {
  const id = detail; if (!id) return;
  const r = await fetch('api/agent?id=' + encodeURIComponent(id)).then(x => (x.ok ? x.json() : false)).catch(() => false);
  if (detail !== id || r === false) return;
  dd = r || undefined; if (typing()) return;
  const y = app.scrollTop; render(); app.scrollTop = y;
}
// live: the office pushes every change; the 3-second poll only runs while the stream is down
function stream() {
  if (!window.EventSource) return;
  if (es) es.close();
  es = new EventSource('api/stream');
  es.onmessage = e => { streamAt = Date.now(); try { apply(JSON.parse(e.data)); } catch {} if (detail && sub === 'talk' && !talkQ) loadTalk(); };
  es.addEventListener('ping', () => { streamAt = Date.now(); });
  es.onerror = () => { if (es.readyState === 2) setTimeout(stream, 2000); }; // closed for good: open a new one
}
document.addEventListener('focusout', () => setTimeout(() => { if (pending && !typing()) apply(pending, true); }, 0));
tabsEl.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; detail = null; dd = null; talk = null; talkQ = ''; try { localStorage.setItem('cw.phone.tab', tab); } catch {} if (d) render(); app.scrollTop = 0; });
app.addEventListener('click', async e => {
  if (e.target.closest('[data-back]')) { detail = null; dd = null; talk = null; talkQ = ''; render(); app.scrollTop = 0; return; }
  const sa = e.target.closest('[data-subag]');
  if (sa) { talkSub = sa.dataset.subag; talk = null; render(); loadTalk(true); return; }
  const sb = e.target.closest('[data-sub]');
  if (sb) { sub = sb.dataset.sub; talk = null; render(); app.scrollTop = 0; if (sub === 'talk') loadTalk(true); return; }
  const df = e.target.closest('[data-diff]');
  if (df) { const id = df.dataset.diff; if (diffs[id]) delete diffs[id]; else { diffs[id] = 'loading'; fetch('api/task-diff?id=' + encodeURIComponent(id)).then(x => x.json()).catch(() => ({ ok: false, reason: 'unknown' })).then(r => { if (diffs[id]) { diffs[id] = r; render(); } }); } render(); return; }
  const b = e.target.closest('[data-op]');
  const card = !b && !e.target.closest('textarea, select, a, pre') && e.target.closest('[data-agent]');
  if (card) { detail = card.dataset.agent; dd = null; sub = 'info'; talk = null; talkQ = ''; talkSub = ''; helpers = []; render(); app.scrollTop = 0; loadDetail(); return; }
  if (!b) return;
  const op = b.dataset.op, id = b.dataset.id || 'new', body = { op, id };
  if (op === 'permit') body.allow = !!b.dataset.allow;
  if (op === 'answer') body.choice = Number(b.dataset.choice);
  if (op === 'message') { const ta = app.querySelector('[data-text="msg"]'); body.text = ta ? ta.value.trim() : ''; if (!body.text) return ta && ta.focus(); }
  if (op === 'reply') { const ta = app.querySelector(`[data-text="${CSS.escape(id)}"]`); body.text = ta ? ta.value.trim() : ''; if (!body.text) return ta && ta.focus(); }
  if (op === 'create') { const ta = app.querySelector('[data-new-text]'); body.text = ta ? ta.value.trim() : ''; if (!body.text) return ta && ta.focus(); body.dir = app.querySelector('[data-new-dir]').value; body.agent = app.querySelector('[data-new-agent]').value; }
  if (op === 'cancel' && !confirm(X.cancelSure)) return;
  busy = true; b.disabled = true;
  const r = await post(body); busy = false;
  if (op === 'message' && r.ok) { const ta = app.querySelector('[data-text="msg"]'); if (ta) { ta.value = ''; ta.blur(); } if (sub === 'talk') setTimeout(() => loadTalk(true), 1500); }
  const m = app.querySelector(`[data-msg="${CSS.escape(op === 'message' ? 'msg' : id)}"]`); if (m) m.textContent = r.ok ? '✓ ' + P.done : '⚠ ' + (P.fail[r.reason] || r.reason || '?');
  b.disabled = false; last = null;
  if (op === 'create' && r.ok) { const det = app.querySelector('details.new'); if (det) det.open = false; setTimeout(() => load(true), 600); return; }
  setTimeout(load, 800);
});
load(true); stream(); setInterval(() => { if (Date.now() - streamAt > 8000) load(); if (detail && sub === 'talk') { if (!talkQ) loadTalk(); } else if (detail && !typing()) loadDetail(); }, 3000);
// back to the app: iOS may have cut the live link while it was in the background, so open a new one and catch up at once
document.addEventListener('visibilitychange', () => { if (document.hidden) return; stream(); load(true); if (detail && sub === 'talk') loadTalk(); else if (detail) loadDetail(); });
// tap the logo: how this page is running (full-screen app or inside Safari), screen heights and the notch / home-bar insets
document.querySelector('.brand').addEventListener('click', () => {
  const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom);left:0;width:1px;visibility:hidden'; document.body.appendChild(probe);
  const r = probe.getBoundingClientRect(), top = Math.round(r.top), bottom = Math.round(innerHeight - r.bottom); probe.remove();
  const mode = matchMedia('(display-mode: standalone)').matches || navigator.standalone ? P.diagApp : P.diagSafari;
  alert(`${mode}\n${P.diagScreen}: ${screen.width}×${screen.height} · ${P.diagPage}: ${innerWidth}×${innerHeight}\n${P.diagInsets}: ${top} / ${bottom}`);
});
