'use strict';
// ---------------- tasks you hand out, the notification center, the releases board and the office admin ----------------

const api = (url, body) => fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify(body) } : {}).then(r => r.json()).catch(() => ({ ok: false, reason: 'unknown' }));
let taskData = { tasks: [], settings: { maxParallel: 2 }, models: {}, efforts: [] }, taskSel = '', taskDetail = null, taskDiff = null, taskPeriod = 'week', taskSearch = [], taskWhy = '';
const tasksWaiting = () => taskData.tasks.filter(t => t.state === 'blocked').length;

// ---- polling: the list every 4 s; state changes and warnings become notices ----
const taskSeen = new Map();
async function pollTasks() {
  const d = await api('api/tasks'); if (!d || !Array.isArray(d.tasks)) return;
  taskData = d;
  for (const t of d.tasks) {
    const prev = taskSeen.get(t.id), key = t.state + ':' + (t.reason || '') + ':' + t.updated;
    if (prev && prev.state !== t.state && ['blocked', 'failed', 'done'].includes(t.state)) {
      pushNotice('task:' + t.id, t.state === 'failed' ? 'warn' : 'ok', T.notices.task(t.title, t.state === 'blocked' ? T.tasks.reasons[t.reason] || T.tasks.states.blocked : T.tasks.states[t.state]), '', { task: t.id });
      if (t.state === 'blocked') notifyOS(T.notices.task(t.title, T.tasks.reasons[t.reason] || ''), t.agent);
    }
    if (t.warn && (!prev || !prev.warn || prev.warn.at !== t.warn.at) && prev) {
      const W = T.tasks.warn, text = t.warn.why === 'loop' ? W.loop(t.warn.name) : W[t.warn.why] || '';
      pushNotice('warn:' + t.id + ':' + t.warn.why, 'warn', t.title, text, { task: t.id, rec: t.warn.why !== 'budget' });
    }
    taskSeen.set(t.id, { state: t.state, warn: t.warn, key });
  }
  if (!reportEl.hidden && reportTab === 'tasks') {
    if (taskSel) { const a = document.activeElement; if (!a || !reportEl.contains(a) || !/TEXTAREA|INPUT|SELECT/.test(a.tagName)) loadTask(taskSel); }
    else { const a = document.activeElement; if (!a || !reportEl.contains(a) || !/TEXTAREA|INPUT|SELECT/.test(a.tagName)) renderTasks(); }
  }
}
setInterval(() => { if (!document.hidden) pollTasks(); }, 4000); setTimeout(pollTasks, 800);
async function loadTask(id) { taskSel = id; taskDetail = await api('api/task?id=' + encodeURIComponent(id)); if (reportTab === 'tasks') renderTasks(); }

// ---- the tab ----
const TT = () => T.tasks;
function cfgLabel(t) { return `${t.model || TT().cliDefault} · ${t.effort}`; }
function periodSince() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() - ({ day: 0, week: 6, month: 29 })[taskPeriod] * 864e5; }
function rankingHtml() {
  const X = TT(), since = periodSince(), ts = taskData.tasks.filter(t => t.updated >= since && t.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 8);
  const done = taskData.tasks.filter(t => t.updated >= since && t.state === 'done'), doneUsd = done.reduce((n, t) => n + t.cost, 0);
  const byAi = {}; const days = (usageData && usageData.days) || {};
  for (const [k, d] of Object.entries(days)) if (new Date(k + 'T12:00').getTime() >= since) for (const [a, g] of Object.entries(d.byAgent || {})) byAi[a] = (byAi[a] || 0) + (g.usd || 0);
  const max = Math.max(1e-9, ...Object.values(byAi), ...ts.map(t => t.cost));
  const bar = (label, v, c) => `<li><span>${esc(label)}</span><div class="ach-bar" style="--c:${c}"><i style="width:${(v / max * 100).toFixed(1)}%"></i></div><b>${esc(fmtUSD(v))}</b></li>`;
  return `<h3>${esc(X.ranking)}</h3><div class="opts">${Object.keys(X.period).map(k => `<button class="opt ${taskPeriod === k ? 'on' : ''}" data-tperiod="${k}">${esc(X.period[k])}</button>`).join('')}</div>
    <div class="trank"><div><h4>${esc(X.byAi)}</h4><ul>${Object.entries(byAi).sort((a, b) => b[1] - a[1]).map(([a, v]) => bar(a, v, '#4fa3ff')).join('') || `<li class="note">—</li>`}</ul></div>
    <div><h4>${esc(X.byTask)}</h4><ul>${ts.map(t => bar(t.title, t.cost, '#f7b733')).join('') || `<li class="note">—</li>`}</ul>${done.length ? `<small>${esc(fmtUSD(doneUsd / done.length))} ${esc(X.perDone)}</small>` : ''}</div></div>
    <p class="note">${esc(X.costNote)}</p>`;
}
function formHtml() {
  const X = TT(), folders = typeof knownFolders === 'function' ? knownFolders() : [];
  const sel = (name, opts, v) => `<select data-tf="${name}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<details class="tform" ${taskData.tasks.length ? '' : 'open'}><summary>＋ ${esc(X.newT)}</summary>
    <label>${esc(X.desc)}<textarea data-tf="desc" rows="3"></textarea></label>
    <label>${esc(X.title)}<input data-tf="title" maxlength="80"></label>
    <label>${esc(X.folder)}<input data-tf="dir" list="tdirs" value="${esc(folders[0] ? folders[0][0] : '')}"><datalist id="tdirs">${folders.map(([d]) => `<option value="${esc(d)}">`).join('')}</datalist></label>
    <div class="trow"><label>${esc(X.agent)}${sel('agent', [['auto', X.auto], ['claude', 'Claude Code'], ['codex', 'Codex']], 'auto')}</label>
    <label>${esc(X.profile)}${sel('profile', [['', '—'], ...Object.entries(X.profiles)], '')}</label>
    <label>${esc(X.prio)}${sel('priority', [['3', X.prios[3]], ['2', X.prios[2]], ['1', X.prios[1]]], '2')}</label></div>
    <div class="trow"><label>${esc(X.perm)}${sel('perm', Object.entries(X.perms), 'acceptEdits')}</label>
    <label>${esc(X.dep)}${sel('dependsOn', [['', X.none], ...taskData.tasks.filter(t => !['done', 'cancelled'].includes(t.state)).map(t => [t.id, t.title])], '')}</label>
    <label>${esc(X.budget)}<input data-tf="budget" type="number" min="0" step="0.5" value="0"></label></div>
    <label>${esc(X.test)}<input data-tf="testCmd" placeholder="npm test"></label>
    <label class="tchk"><input type="checkbox" data-tf="worktree" checked> ${esc(X.wt)}</label>
    <p><button class="btn small" data-tact="recommend">💡 ${esc(X.rec)}</button> <button class="btn" data-tact="create">➤ ${esc(X.create)}</button> <span class="note" id="tmsg">${esc(taskWhy)}</span></p></details>`;
}
function rowHtml(t) {
  const X = TT(), why = t.state === 'blocked' ? ' · ' + (X.reasons[t.reason] || '') : t.state === 'failed' && t.reason === 'restart' ? ' · ' + X.reasons.restart : '';
  return `<li class="trow-item st-${t.state}" data-topen="${esc(t.id)}"><span class="tdot"></span><span><b>${esc(t.title)}</b><br><small>${esc(X.states[t.state])}${esc(why)} · ${esc(t.agent)} · ${esc(X.profiles[t.profile] || '')} · ${esc(cfgLabel(t))}</small></span>
    <span class="q-side"><small>${t.costUnknown && !t.cost ? '?' : esc(fmtUSD(t.cost || 0))}</small><small>⌛ ${esc(ago(Date.now() - t.updated))}</small></span></li>`;
}
function renderTasks() {
  const X = TT(), body = reportEl.querySelector('.report-body');
  if (taskSel && taskDetail) return renderTaskDetail(body);
  const order = ['blocked', 'running', 'pending', 'failed', 'done', 'cancelled'], list = taskData.tasks.slice().sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || b.priority - a.priority || b.updated - a.updated);
  body.innerHTML = tabsHtml() + `<p class="sub">${esc(X.sub)}</p>` + formHtml()
    + `<div class="trow"><label>${esc(X.parallel)} <input type="number" min="1" max="6" value="${Number(taskData.settings.maxParallel) || 2}" data-tparallel style="width:4em"></label><label style="flex:2">🔎 <input data-tsearch placeholder="${esc(X.search)}"></label></div>`
    + (taskSearch.length ? `<ul class="queue">${taskSearch.map(r => `<li data-topen="${esc(r.id)}"><b>${esc(r.title)}</b> <small>${esc(X.states[r.state] || '')} · ${r.hits}×</small></li>`).join('')}</ul>` : '')
    + (list.length ? `<ul class="queue tlist">${list.map(rowHtml).join('')}</ul>` : `<p class="note">${esc(X.empty)}</p>`) + rankingHtml();
}
function renderTaskDetail(body) {
  const X = TT(), t = taskDetail, ev = t.events || [], live = t.state === 'running';
  const evHtml = ev.slice(-60).reverse().map(e => {
    const txt = e.kind === 'warn' ? (e.why === 'loop' ? X.warn.loop(e.name) : X.warn[e.why] || '') : e.kind === 'config' ? `${e.from.model || X.cliDefault}/${e.from.effort} → ${e.to.model || X.cliDefault}/${e.to.effort} (${e.applies === 'next' ? X.next : X.now})` : e.kind === 'test' ? X.tests(e.code) + '\n' + (e.text || '') : e.kind === 'tool' ? `${e.name} ${e.text || ''}` : e.kind === 'state' ? `${X.states[e.state] || e.state}${e.reason ? ' · ' + (X.reasons[e.reason] || e.reason) : ''}` : e.text || e.model || '';
    return `<li class="ev-${esc(e.kind)}"><small>${esc(new Date(e.at).toLocaleTimeString())} · ${esc(e.kind)}</small><pre>${esc(String(txt).slice(0, 1500))}</pre></li>`;
  }).join('');
  const sel = (name, opts, v) => `<select data-tcfg="${name}">${opts.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o || X.cliDefault)}</option>`).join('')}</select>`;
  body.innerHTML = tabsHtml() + `<p><button class="btn small" data-tact="back">${esc(X.back)}</button></p>
    <h3>${esc(t.title)} <small class="note">${esc(X.states[t.state])}${t.state === 'blocked' ? ' · ' + esc(X.reasons[t.reason] || '') : ''}</small></h3>
    <p class="note">${esc(t.agent)} · ${esc(t.cwd)}${t.sessionId ? ' · ' + esc(t.sessionId.slice(0, 8)) : ''} · ${esc(X.attempts(t.attempts))}</p>
    <div class="tbig"><div><b>${t.costUnknown && !t.cost ? '?' : esc(fmtUSD(t.cost || 0))}</b><small>${esc(t.costUnknown && !t.cost ? X.costUnknown : X.cost)}${t.budget ? ' / ' + esc(fmtUSD(t.budget)) : ''}</small></div><div><b>${fmtK(t.tokens.output)}</b><small>out ${esc(X.tokens)}</small></div><div><b>${fmtK(t.tokens.input + t.tokens.cacheWrite)}</b><small>in</small></div><div><b>${fmtK(t.tokens.cacheRead)}</b><small>cache</small></div></div>
    <div class="tcfg"><b>${esc(X.profiles[t.profile] || '')}</b> ${esc(cfgLabel(t))}
      <button class="btn small" data-tact="save">🪙 ${esc(X.save)}</button><button class="btn small" data-tact="more">🚀 ${esc(X.more)}</button><button class="btn small" data-tact="applyRec">💡 ${esc(X.applyRec)}</button>
      ${esc(X.model)} ${sel('model', taskData.models[t.agent] || [''], t.model)} ${esc(X.effort)} ${sel('effort', taskData.efforts || [], t.effort)} ${live ? `<small class="note">${esc(X.next)}</small>` : ''}</div>
    ${t.result ? `<pre class="tresult">${esc(t.result)}</pre>` : ''}
    ${t.tests ? `<p class="${t.tests.code === 0 ? 'ok' : 'warn'}">${esc(X.tests(t.tests.code))}</p>` : ''}
    ${t.denials && t.denials.length ? `<p><b>${esc(X.denied)}:</b> ${t.denials.map(d => `<code>${esc(d.tool)}</code> <small>${esc(d.what)}</small>`).join(', ')}</p><p><button class="btn" data-tact="approve">✔ ${esc(X.approve)}</button></p>` : ''}
    ${t.files && t.files.length ? `<p><b>${esc(X.files)}:</b> ${t.files.slice(0, 20).map(f => `<code>${esc(f)}</code>`).join(' ')}</p>` : ''}
    ${['blocked', 'failed'].includes(t.state) ? `<div class="office-name"><textarea data-treply rows="2" placeholder="${esc(X.reply)}"></textarea></div><p><button class="btn" data-tact="reply">➤ ${esc(X.send)}</button></p>` : ''}
    <p>${['blocked', 'failed', 'done'].includes(t.state) ? `<button class="btn small" data-tact="diff">${esc(X.diff)}</button>` : ''}
      ${t.state === 'blocked' ? `<button class="btn small" data-tact="conclude">✔ ${esc(X.conclude)}</button>` : ''}
      ${['failed', 'cancelled'].includes(t.state) ? `<button class="btn small" data-tact="retry">↻ ${esc(X.retry)}</button>` : ''}
      ${['blocked', 'failed', 'done'].includes(t.state) ? `<button class="btn small" data-tact="handoff">↪ ${esc(X.handoff)}</button>` : ''}
      ${['running', 'pending', 'blocked'].includes(t.state) ? `<button class="btn small warn" data-tact="cancel">✖ ${esc(X.cancel)}</button>` : ''}
      ${!live ? `<button class="btn small" data-tact="delete">🗑 ${esc(X.del)}</button>` : ''} <span class="note" id="tmsg"></span></p>
    ${taskDiff ? `<pre class="tdiff">${esc(taskDiff.stat)}\n${esc(taskDiff.diff)}</pre>` : ''}
    ${t.configLog && t.configLog.length ? `<h4>${esc(X.configLog)}</h4><ul class="note">${t.configLog.slice(-6).map(c => `<li>${esc(new Date(c.at).toLocaleString())}: ${esc(c.from.model || X.cliDefault)}/${esc(c.from.effort)} → ${esc(c.to.model || X.cliDefault)}/${esc(c.to.effort)} (${esc(c.why)})</li>`).join('')}</ul>` : ''}
    <h4>${esc(X.events)}</h4><ul class="tevents">${evHtml}</ul>`;
}
const tfVal = () => { const o = {}; reportEl.querySelectorAll('[data-tf]').forEach(el => { o[el.dataset.tf] = el.type === 'checkbox' ? el.checked : el.value; }); return o; };
const tFail = r => (TT().fail[r.reason] || TT().fail.state);
reportEl.addEventListener('click', async e => {
  if (!['tasks', 'notices', 'version'].includes(reportTab)) return;
  const per = e.target.closest('[data-tperiod]'); if (per) { taskPeriod = per.dataset.tperiod; return renderTasks(); }
  const open = e.target.closest('[data-topen]'); if (open) { taskDiff = null; return loadTask(open.dataset.topen); }
  const b = e.target.closest('[data-tact]'); if (!b) return;
  const act = b.dataset.tact, X = TT(), msg = t => { const m = document.getElementById('tmsg'); if (m) m.textContent = t; };
  if (act === 'recommend') { const r = await api('api/tasks', { op: 'recommend', ...tfVal() }); if (r.ok) { const p = reportEl.querySelector('[data-tf="profile"]'); p.value = r.rec.profile; taskWhy = `${X.profiles[r.rec.profile]} (${r.rec.model || X.cliDefault} · ${r.rec.effort}): ${X.recWhy[r.rec.why]}`; msg(taskWhy); } return; }
  if (act === 'create') { const r = await api('api/tasks', { op: 'create', ...tfVal() }); if (!r.ok) return msg(tFail(r)); taskWhy = ''; achBump('launches'); await pollTasks(); return loadTask(r.task.id); }
  if (act === 'back') { taskSel = ''; taskDetail = null; taskDiff = null; return renderTasks(); }
  const id = taskSel; if (!id) return;
  if (act === 'diff') { taskDiff = await api('api/task-diff?id=' + encodeURIComponent(id)); return renderTasks(); }
  if (act === 'cancel' && !confirm(X.cancelSure)) return;
  let body = { op: act, id };
  if (act === 'save' || act === 'more') body = { op: 'config', id, step: act === 'more' ? 1 : -1, why: act };
  if (act === 'applyRec') { const r = await api('api/tasks', { op: 'recommend', desc: taskDetail.desc, agent: taskDetail.agent }); body = { op: 'config', id, profile: r.rec.profile, why: 'rec:' + r.rec.why }; }
  if (act === 'reply') body.text = (reportEl.querySelector('[data-treply]') || {}).value || '';
  if (act === 'handoff') body.agent = taskDetail.agent === 'claude' ? 'codex' : 'claude';
  const r = await api('api/tasks', body);
  if (!r.ok) return msg(tFail(r));
  if (act === 'delete') { taskSel = ''; taskDetail = null; await pollTasks(); return renderTasks(); }
  if (act === 'handoff' && r.task) { await pollTasks(); return loadTask(r.task.id); }
  await pollTasks(); loadTask(id);
});
reportEl.addEventListener('change', async e => {
  if (reportTab !== 'tasks') return;
  const c = e.target.closest('[data-tcfg]'); if (c && taskSel) { await api('api/tasks', { op: 'config', id: taskSel, [c.dataset.tcfg]: c.value, why: 'manual' }); return loadTask(taskSel); }
  const p = e.target.closest('[data-tparallel]'); if (p) { await api('api/tasks', { op: 'settings', maxParallel: p.value }); pollTasks(); }
});
let tSearchT = 0;
reportEl.addEventListener('input', e => {
  const q = e.target.closest('[data-tsearch]'); if (!q) return;
  clearTimeout(tSearchT); tSearchT = setTimeout(async () => { taskSearch = q.value.trim().length > 1 ? await api('api/search?q=' + encodeURIComponent(q.value)) : []; const v = q.value; renderTasks(); const n = reportEl.querySelector('[data-tsearch]'); n.value = v; n.focus(); }, 300);
});

// ---- notification center: grouped by key, read state, actions; kept in this browser ----
let notices = []; try { notices = JSON.parse(store.get('notices', '[]')) || []; } catch { notices = []; }
const unreadNotices = () => notices.filter(n => !n.read).length;
function saveNotices() { notices = notices.slice(0, 80); try { store.set('notices', JSON.stringify(notices)); } catch {} updateBell(); }
function pushNotice(key, kind, title, body, ref = {}) {
  const n = notices.find(x => x.key === key && !x.read);
  if (n) { n.n++; n.at = Date.now(); n.title = title; n.body = body; notices = [n, ...notices.filter(x => x !== n)]; }
  else notices.unshift({ key, kind, title, body, ref, at: Date.now(), n: 1, read: false });
  saveNotices();
}
function renderNotices() {
  const N = T.notices, body = reportEl.querySelector('.report-body');
  body.innerHTML = tabsHtml() + `<p class="sub">${esc(N.sub)}</p>` + (notices.length ? `<p><button class="btn small" data-nall>${esc(N.readAll)}</button></p><ul class="queue notices">${notices.map((n, i) => `<li class="${n.read ? '' : 'urgent'} ${esc(n.kind)}"><span><b>${esc(n.title)}</b>${n.n > 1 ? ` <small>${esc(N.times(n.n))}</small>` : ''}<br><small>${esc(ago(Date.now() - n.at))}</small>${n.showWhy || !n.ref.rec ? `<br><span class="q-what">${esc(n.body)}</span>` : ''}</span>
    <span class="q-side">${n.ref.rec ? `<button class="btn small" data-nact="apply" data-n="${i}">${esc(N.apply)}</button><button class="btn small" data-nact="why" data-n="${i}">${esc(N.why)}</button>` : ''}${n.ref.task || n.ref.agent || n.ref.ver ? `<button class="btn small" data-nact="open" data-n="${i}">${esc(N.open)}</button>` : ''}<button class="btn small" data-nact="dismiss" data-n="${i}">${esc(N.notNow)}</button></span></li>`).join('')}</ul>` : `<p class="note">${esc(N.empty)}</p>`);
}
reportEl.addEventListener('click', async e => {
  if (reportTab !== 'notices') return;
  if (e.target.closest('[data-nall]')) { notices.forEach(n => { n.read = true; }); saveNotices(); return renderNotices(); }
  const b = e.target.closest('[data-nact]'); if (!b) return;
  const n = notices[Number(b.dataset.n)]; if (!n) return; const a = b.dataset.nact;
  n.read = true;
  if (a === 'why') { n.showWhy = true; }
  if (a === 'dismiss') notices = notices.filter(x => x !== n);
  if (a === 'apply' && n.ref.task) await api('api/tasks', { op: 'config', id: n.ref.task, step: 1, why: 'notice' });
  saveNotices();
  if (a === 'open' || a === 'apply') { if (n.ref.task) { reportTab = 'tasks'; return loadTask(n.ref.task); } if (n.ref.ver) { reportTab = 'version'; return renderReport(); } if (n.ref.agent) { closeReport(); return openTalk(n.ref.agent); } }
  renderNotices();
});
function updateBell() {
  const b = document.getElementById('btn-bell'); if (!b) return;
  const u = unreadNotices(); b.querySelector('.bell-n').textContent = u ? (u > 9 ? '9+' : u) : ''; b.querySelector('.bell-n').hidden = !u; b.title = T.notices.tab(u);
}
{ // the bell sits next to the ☰ menu
  const menu = document.getElementById('btn-menu'), bell = document.createElement('button');
  bell.id = 'btn-bell'; bell.className = 'icon-btn'; bell.innerHTML = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M7 1h2v1h2v1h1v5h1v3h1v1H2v-1h1V8h1V3h1V2h2zm-1 12h4v1H9v1H7v-1H6z"/></svg><i class="bell-n" hidden></i>';
  if (menu) menu.before(bell);
  bell.addEventListener('click', () => openReport('notices'));
  updateBell();
}

// ---- releases board ----
let verData = null;
async function loadVersion() { verData = await api('api/version'); if (verData && verData.current) { checkVersionNotice(); drawAdmin(); } if (!reportEl.hidden && reportTab === 'version') renderVersion(); }
setTimeout(loadVersion, 1500); setInterval(loadVersion, 30 * 60000);
function checkVersionNotice() {
  const v = verData; if (!v.newer) return;
  const later = Number(store.get('verLater', 0)) || 0;
  if (Date.now() > later && !notices.some(n => n.key === 'ver:' + v.latest)) pushNotice('ver:' + v.latest, 'ok', T.notices.update(v.latest), T.ver.note, { ver: v.latest });
}
function renderVersion() {
  const V = T.ver, v = verData || {}, body = reportEl.querySelector('.report-body');
  if (v.newer) { store.set('verSeen', v.latest); drawAdmin(); }
  const cmd = (label, c) => `<p>${esc(label)} <code>${esc(c)}</code> <button class="btn small" data-vcopy="${esc(c)}">${esc(V.copy)}</button></p>`;
  body.innerHTML = tabsHtml() + `<p class="sub">${esc(V.sub)}</p>
    <div class="tbig"><div><b>${esc(v.current || '?')}</b><small>${esc(V.installed)}</small></div><div><b>${esc(v.latest || '?')}</b><small>${esc(V.latest)}</small></div><div><b>${v.checkedAt ? esc(ago(Date.now() - v.checkedAt)) : esc(V.never)}</b><small>${esc(V.checked)}</small></div></div>
    ${v.newer ? cmd(V.npx, 'npx coworking-agents@latest') + cmd(V.global, 'npm install -g coworking-agents@latest') + `<p class="note">${esc(V.plugin)}</p><p class="note">${esc(V.note)}</p><p><button class="btn small" data-vlater>${esc(V.later)}</button></p>` : `<p class="ok">${esc(V.upToDate)}</p>`}
    <h3>${esc(V.news)}</h3>${(v.notes || []).map(n => `<h4>${esc(n.v)} <small class="note">${esc(n.date)}</small></h4><ul>${n.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')}`;
}
reportEl.addEventListener('click', e => {
  if (reportTab !== 'version') return;
  const c = e.target.closest('[data-vcopy]'); if (c) { navigator.clipboard && navigator.clipboard.writeText(c.dataset.vcopy); c.textContent = T.ver.copied; return; }
  if (e.target.closest('[data-vlater]')) { store.set('verLater', Date.now() + 864e5); notices = notices.filter(n => n.key !== 'ver:' + (verData || {}).latest); saveNotices(); closeReport(); }
});

// ---- the office admin: waves with a sign while a new version is unseen, keeps the sign until it runs, celebrates once ----
const adminEl = document.createElement('button');
adminEl.id = 'admin'; adminEl.className = 'admin'; adminEl.innerHTML = '<canvas width="96" height="120"></canvas><span class="admin-bubble" hidden></span>';
{ const bell = document.getElementById('btn-bell'); if (bell) bell.before(adminEl); else document.body.appendChild(adminEl); } // in the header, next to the bell
adminEl.addEventListener('click', () => openReport('version'));
const reduceMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
let adminState = 'idle', adminCelebrateUntil = 0;
function adminMode() {
  const v = verData; if (!v || !v.current) return 'idle';
  const last = store.get('lastRunVersion', '');
  if (last !== v.current) { if (last) adminCelebrateUntil = Date.now() + 10000; store.set('lastRunVersion', v.current); }
  if (Date.now() < adminCelebrateUntil) return 'celebrate';
  if (v.newer) return store.get('verSeen', '') === v.latest ? 'pending' : 'unseen';
  return 'idle';
}
function drawAdmin(t = Date.now()) {
  adminState = adminMode();
  const c = adminEl.querySelector('canvas'), g = c.getContext('2d'), S = 4, still = reduceMotion.matches, f = still ? 0 : Math.floor(t / 280) % 2;
  g.clearRect(0, 0, c.width, c.height);
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x * S, y * S, w * S, h * S); };
  const bob = adminState === 'celebrate' && f ? -1 : 0, y0 = 5 + bob;
  // Lucas: short textured brown hair, light skin, stubble beard, butterfly tattoo on the neck, navy knit polo
  // with an open collar, tattooed forearms (the left one blacked out), bead bracelet, dark jeans, white sneakers
  const SK = '#ebb894', SK2 = '#d49c78', HR = '#5e3d25', HR2 = '#7b5434', BD = '#8c6a50', PO = '#2d3b5e', PO2 = '#243150', INK = '#4b4c5c', INK2 = '#2f3140';
  px(9, y0 + 22, 2, 2, '#2c3242'); px(13, y0 + 22, 2, 2, '#2c3242'); px(8, y0 + 24, 3, 1, '#ececec'); px(13, y0 + 24, 3, 1, '#ececec');
  px(7, y0 + 13, 10, 9, PO); for (let x = 8; x < 17; x += 2) px(x, y0 + 14, 1, 8, PO2);
  px(10, y0 + 13, 4, 1, SK); px(11, y0 + 14, 2, 1, SK); px(9, y0 + 13, 1, 2, PO2); px(14, y0 + 13, 1, 2, PO2); px(11, y0 + 13, 2, 1, INK);
  px(10, y0 + 11, 4, 2, SK); px(10, y0 + 11, 1, 1, INK); px(13, y0 + 11, 1, 1, INK); px(11, y0 + 12, 2, 1, INK2); px(11, y0 + 11, 2, 1, INK);
  px(8, y0 + 3, 8, 8, SK); px(7, y0 + 5, 1, 3, SK2); px(16, y0 + 5, 1, 3, SK2); px(16, y0 + 5, 1, 1, '#d8dde6');
  px(8, y0 + 1, 8, 3, HR); px(7, y0 + 2, 1, 3, HR); px(16, y0 + 2, 1, 3, HR); px(9, y0 + 1, 1, 1, HR2); px(11, y0 + 2, 1, 1, HR2); px(13, y0 + 1, 1, 1, HR2); px(14, y0 + 3, 1, 1, HR2); px(10, y0 + 3, 1, 1, HR2); px(9, y0 + 0, 6, 1, HR);
  px(9, y0 + 5, 2, 1, '#4a3020'); px(13, y0 + 5, 2, 1, '#4a3020'); px(9, y0 + 6, 2, 1, '#fff'); px(13, y0 + 6, 2, 1, '#fff'); px(10, y0 + 6, 1, 1, '#4f7894'); px(13, y0 + 6, 1, 1, '#4f7894');
  px(11, y0 + 7, 2, 1, SK2); px(8, y0 + 8, 1, 2, BD); px(15, y0 + 8, 1, 2, BD); px(9, y0 + 9, 6, 2, BD); px(10, y0 + 8, 1, 1, BD); px(13, y0 + 8, 1, 1, BD); px(11, y0 + 9, 2, 1, '#c4836a'); px(13, y0 + 5, 1, 1, '#d8dde6'); px(10, y0 + 10, 4, 1, BD);
  // arms: short polo sleeves, inked forearms; the right one (our left) waves or holds the sign up when there's news
  px(5, y0 + 13, 2, 3, PO); px(5, y0 + 16, 2, 4, SK); px(5, y0 + 16, 1, 1, INK); px(6, y0 + 18, 1, 1, INK); px(5, y0 + 20, 2, 1, SK);
  const up = adminState === 'unseen' ? !f : adminState === 'celebrate' ? f : adminState === 'pending';
  if (up) { px(17, y0 + 11, 2, 3, PO); px(17, y0 + 6, 2, 5, INK2); px(17, y0 + 9, 2, 1, '#f2f2f2'); px(17, y0 + 5, 2, 1, SK); px(18, y0 - 1, 1, 6, '#8a5a2b'); px(15, y0 - 4, 9, 4, adminState === 'celebrate' ? '#63c74d' : '#f7b733'); px(16, y0 - 3, 7, 2, '#fff6d5'); }
  else { px(17, y0 + 13, 2, 3, PO); px(17, y0 + 16, 2, 4, INK2); px(17, y0 + 19, 2, 1, '#f2f2f2'); px(17, y0 + 20, 2, 1, SK); }
  if (adminState === 'celebrate' && !still) for (let i = 0; i < 6; i++) px((i * 7 + f * 3) % 24, (i * 5 + f * 2) % 8, 1, 1, ['#f7b733', '#ff6b9d', '#4fa3ff'][i % 3]);
  const bub = adminEl.querySelector('.admin-bubble'), v = verData || {};
  bub.hidden = adminState === 'idle'; bub.textContent = adminState === 'celebrate' ? T.ver.celebrate(v.current) : adminState !== 'idle' ? 'v' + v.latest : '';
  adminEl.hidden = adminState === 'idle'; // only shows up when there's news about a version
  adminEl.classList.toggle('loud', adminState === 'unseen'); adminEl.title = T.ver.admin + (adminState !== 'idle' ? ' · ' + bub.textContent : '');
}
setInterval(() => { if (!document.hidden && adminState !== 'idle') drawAdmin(); }, 280);
try { drawAdmin(); } catch {}
