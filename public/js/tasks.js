'use strict';
// ---------------- tasks you hand out, the notification center, the releases board and the office admin ----------------

const api = (url, body) => fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify(body) } : {}).then(r => r.json()).catch(() => ({ ok: false, reason: 'unknown' }));
let taskData = { tasks: [], settings: { maxParallel: 2 }, options: {}, roles: [], privacy: false }, taskSel = '', taskDetail = null, taskDiff = null, taskPeriod = 'week', taskSearch = [], taskWhy = '';
const tasksWaiting = () => taskData.tasks.filter(t => t.state === 'blocked').length;
const taskOfPerson = id => taskData.tasks.find(t => t.sessionId && t.sessionId === id);

// ---- polling: every 4 s in front, every 20 s in the background (requests, failures and budget still arrive);
// what was already waiting when the office opens is recovered once per task state ----
let noticed = {}; try { noticed = JSON.parse(store.get('taskNoticed', '{}')) || {}; } catch { noticed = {}; }
const taskWarnSeen = new Map();
function noticeTask(t) {
  const X = T.tasks, key = t.state + ':' + (t.reason || '') + ':' + t.attempts;
  if (noticed[t.id] === key || !['blocked', 'failed'].includes(t.state)) return;
  noticed[t.id] = key; try { store.set('taskNoticed', JSON.stringify(noticed)); } catch {}
  const what = t.state === 'blocked' ? X.reasons[t.reason] || X.states.blocked : X.states.failed;
  pushNotice('task:' + t.id, t.state === 'failed' || t.reason === 'budget' ? 'warn' : 'ok', T.notices.task(t.title, what), '', { task: t.id });
  notifyOS(T.notices.task(t.title, what), t.agent);
}
function warnText(w) { const W = T.tasks.warn; return w.why === 'loop' ? W.loop(w.name) : typeof W[w.why] === 'function' ? W[w.why](w) : W[w.why] || ''; }
async function pollTasks() {
  const d = await api('api/tasks'); if (!d || !Array.isArray(d.tasks)) return;
  taskData = d;
  for (const t of d.tasks) {
    noticeTask(t);
    if (t.warn && taskWarnSeen.get(t.id) !== t.warn.at) {
      taskWarnSeen.set(t.id, t.warn.at);
      if (Date.now() - t.warn.at < 864e5 && noticed['w' + t.id] !== t.warn.at) {
        noticed['w' + t.id] = t.warn.at; try { store.set('taskNoticed', JSON.stringify(noticed)); } catch {}
        const rec = t.warn.rec, X = T.tasks;
        pushNotice('warn:' + t.id + ':' + t.warn.why, 'warn', t.title, warnText(t.warn) + (rec ? ' ' + X.proposal(X.profiles[rec.profile], rec.model || X.cliDefault, rec.effort) : ''), { task: t.id, rec });
      }
    }
  }
  if (!reportEl.hidden && reportTab === 'tasks') {
    const a = document.activeElement, typing = a && reportEl.contains(a) && /TEXTAREA|INPUT|SELECT/.test(a.tagName);
    if (!typing) { if (taskSel) loadTask(taskSel); else renderTasks(); }
  }
  if (selected && data && typeof renderPanel === 'function' && !panel.contains(document.activeElement)) renderPanel();
}
let pollTimer = 0;
function schedulePoll() { clearTimeout(pollTimer); pollTimer = setTimeout(async () => { await pollTasks(); schedulePoll(); }, document.hidden ? 20000 : 4000); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) pollTasks(); schedulePoll(); });
setTimeout(() => { pollTasks(); schedulePoll(); }, 800);
async function loadTask(id) { taskSel = id; taskDetail = await api('api/task?id=' + encodeURIComponent(id)); if (reportTab === 'tasks') renderTasks(); }

// ---- shared bits: options per agent/model, the running vs pending config, cost that may be unknown ----
const TT = () => T.tasks;
function optsFor(agent, model) {
  const o = (taskData.options || {})[agent] || { models: [''], efforts: [] };
  const efforts = agent === 'codex' && model && o.byModel && o.byModel[model] && o.byModel[model].length ? o.byModel[model] : o.efforts;
  return { models: o.models, efforts, def: o.def };
}
const mname = (t, m) => m || (optsFor(t.agent).def ? optsFor(t.agent).def + ' (' + TT().cliDefault + ')' : TT().cliDefault);
function cfgHtml(t) {
  const X = TT(), r = t.running, pend = t.state === 'running' && r && (r.model !== t.model || r.effort !== t.effort);
  const ev = (t.events || []).filter(e => e.kind === 'applied').slice(-1)[0];
  return `<p class="tcfgnow"><b>${esc(t.state === 'running' ? X.runningCfg : X.currentCfg)}:</b> ${esc(mname(t, r && t.state === 'running' ? r.model : t.model))} · ${esc(r && t.state === 'running' ? r.effort : t.effort)} <small class="note">(${esc(X.profiles[t.profile] || '')})</small>
    ${pend ? `<br><b class="warn">${esc(X.pendingCfg)}:</b> ${esc(mname(t, t.model))} · ${esc(t.effort)} <small class="note">${esc(X.next)}</small>` : ''}
    ${ev && Date.now() - ev.at < 6e5 ? `<br><span class="ok">✓ ${esc(X.appliedOk(mname(t, ev.to.model), ev.to.effort))}</span>` : ''}</p>`;
}
function costHtml(t) {
  const X = TT(), known = t.cost || 0;
  if (t.costUnknown && !known) return `<b>?</b><small>${esc(X.costUnknown)}</small>`;
  return `<b>${esc(fmtUSD(known))}${t.costUnknown ? '+?' : ''}</b><small>${esc(X.cost)}${t.budget ? ' / ' + esc(fmtUSD(t.budget)) : ''}${t.costUnknown ? ' · ' + esc(X.partUnknown) : ''}</small>`;
}
function ctlHtml(t, scope) {
  const X = TT(), o = optsFor(t.agent, t.model);
  const sel = (name, list, v) => `<select data-${scope}cfg="${name}">${list.map(x => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${esc(x || mname(t, ''))}</option>`).join('')}</select>`;
  return `<div class="tcfg"><button class="btn small" data-${scope}act="save" title="${esc(X.saveTip)}">🪙 ${esc(X.save)}</button><button class="btn small" data-${scope}act="more" title="${esc(X.moreTip)}">🚀 ${esc(X.more)}</button><button class="btn small" data-${scope}act="applyRec">💡 ${esc(X.applyRec)}</button>
    <label>${esc(X.model)} ${sel('model', o.models, t.model)}</label><label>${esc(X.effort)} ${sel('effort', o.efforts, t.effort)}</label></div>`;
}

// ---- in the agent's panel: managed sessions get the controls, monitored ones a recommendation that is not applied ----
const recCache = new Map();
function taskCardHtml(p) {
  const X = TT(), t = taskOfPerson(p.id);
  if (!t) {
    const key = p.id, rec = recCache.get(key);
    if (!rec && !taskData.privacy) { recCache.set(key, 'loading'); api('api/tasks', { op: 'recommend', desc: [p.title, p.lastPrompt].filter(Boolean).join('\n'), agent: p.agent }).then(r => { recCache.set(key, r.ok ? r.rec : null); if (selected === p.id) renderPanel(); }); }
    return `<section class="card tcard"><small>${esc(X.monitored)}</small><p class="note">${esc(X.monitoredWhy)}</p>
      ${rec && rec !== 'loading' ? `<p>💡 ${esc(X.recFor(X.profiles[rec.profile], rec.model || X.cliDefault, rec.effort))}<br><small class="note">${esc(rec.why.map(w => X.recWhy[w] || w).join(' · '))} — ${esc(X.notApplied)}</small></p>` : ''}
      ${['claude', 'codex'].includes(p.agent) && p.cwd ? `<p><button class="btn small" data-pnew="${esc(p.id)}">＋ ${esc(X.asTask)}</button></p>` : ''}</section>`;
  }
  return `<section class="card tcard managed"><small>${esc(X.managed)} · <a href="#" data-popen="${esc(t.id)}">${esc(X.openTask)}</a></small>
    <p><b>${esc(t.title)}</b> · ${esc(X.states[t.state])}${t.state === 'blocked' ? ' · ' + esc(X.reasons[t.reason] || '') : ''}</p>
    ${cfgHtml(t)}<div class="tbig"><div>${costHtml(t)}</div><div><b>${fmtK(t.tokens.output)}</b><small>out</small></div><div><b>${esc(X.attempts(t.attempts))}</b><small>${esc(X.src)}</small></div></div>
    ${t.warn ? `<p class="warn">⚠ ${esc(warnText(t.warn))}</p>` : ''}${ctlHtml(t, 'p')}</section>`;
}
async function applyCfg(t, act, extra = {}) {
  let body = { op: 'config', id: t.id, ...extra };
  if (act === 'save' || act === 'more') body = { op: 'config', id: t.id, step: act === 'more' ? 1 : -1, why: act };
  if (act === 'applyRec') { const r = await api('api/tasks', { op: 'recommend', id: t.id }); if (!r.ok) return r; body = { op: 'config', id: t.id, profile: r.rec.profile, model: r.rec.model, effort: r.rec.effort, why: 'rec:' + r.rec.why.join('+') }; }
  return api('api/tasks', body);
}
document.addEventListener('click', async e => {
  if (!panel.contains(e.target)) return;
  const o = e.target.closest('[data-popen]'); if (o) { e.preventDefault(); openReport('tasks'); return loadTask(o.dataset.popen); }
  const n = e.target.closest('[data-pnew]'); if (n) { const p = data.people.find(x => x.id === n.dataset.pnew); openReport('tasks'); taskSel = ''; renderTasks(); const f = reportEl.querySelector('.tform'); if (f && p) { f.open = true; reportEl.querySelector('[data-tf="dir"]').value = p.cwd; reportEl.querySelector('[data-tf="agent"]').value = p.agent; reportEl.querySelector('[data-tf="desc"]').value = p.lastPrompt || p.title || ''; } return; }
  const b = e.target.closest('[data-pact]'); if (!b) return;
  const t = taskOfPerson(selected); if (!t) return;
  await applyCfg(t, b.dataset.pact); await pollTasks();
});
document.addEventListener('change', async e => {
  const c = e.target.closest('[data-pcfg]'); if (!c || !panel.contains(c)) return;
  const t = taskOfPerson(selected); if (t) { await api('api/tasks', { op: 'config', id: t.id, [c.dataset.pcfg]: c.value, why: 'manual' }); await pollTasks(); }
});

// ---- the tab ----
function periodSince() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() - ({ day: 0, week: 6, month: 29 })[taskPeriod] * 864e5; }
const inPeriod = byDay => Object.entries(byDay || {}).filter(([k]) => new Date(k + 'T12:00').getTime() >= periodSince()).reduce((n, [, v]) => n + v, 0);
function rankingHtml() {
  const X = TT(), ts = taskData.tasks.map(t => ({ t, usd: inPeriod(t.costByDay) })).filter(x => x.usd > 0 || x.t.costUnknown).sort((a, b) => b.usd - a.usd).slice(0, 8);
  const done = taskData.tasks.filter(t => t.state === 'done' && inPeriod(t.costByDay) > 0), doneUsd = done.reduce((n, t) => n + inPeriod(t.costByDay), 0);
  const byAi = {}; for (const [k, d] of Object.entries((usageData && usageData.days) || {})) if (new Date(k + 'T12:00').getTime() >= periodSince()) for (const [a, g] of Object.entries(d.byAgent || {})) byAi[a] = (byAi[a] || 0) + (g.usd || 0);
  const sessions = ((usageData && usageData.month && usageData.month.costly) || []).slice(0, 8);
  const max = Math.max(1e-9, ...Object.values(byAi), ...ts.map(x => x.usd), ...sessions.map(x => x.usd));
  const bar = (label, v, c, unk) => `<li><span title="${esc(label)}">${esc(label)}</span><div class="ach-bar" style="--c:${c}"><i style="width:${(v / max * 100).toFixed(1)}%"></i></div><b>${unk && !v ? '?' : esc(fmtUSD(v)) + (unk ? '+?' : '')}</b></li>`;
  return `<h3>${esc(X.ranking)}</h3><div class="opts">${Object.keys(X.period).map(k => `<button class="opt ${taskPeriod === k ? 'on' : ''}" data-tperiod="${k}">${esc(X.period[k])}</button>`).join('')}</div>
    <div class="trank"><div><h4>${esc(X.byAi)}</h4><ul>${Object.entries(byAi).sort((a, b) => b[1] - a[1]).map(([a, v]) => bar(a, v, '#4fa3ff')).join('') || `<li class="note">—</li>`}</ul></div>
    <div><h4>${esc(X.byTask)}</h4><ul>${ts.map(x => bar(x.t.title, x.usd, '#f7b733', x.t.costUnknown)).join('') || `<li class="note">—</li>`}</ul>${done.length ? `<small>${esc(fmtUSD(doneUsd / done.length))} ${esc(X.perDone)}</small>` : ''}</div>
    <div><h4>${esc(X.bySession)}</h4><ul>${sessions.map(x => bar(x.title || x.id.slice(0, 8), x.usd, '#b07cff')).join('') || `<li class="note">—</li>`}</ul><small class="note">${esc(X.sessionsNote)}</small></div></div>
    <p class="note">${esc(X.costNote)}</p>`;
}
function settingsHtml() {
  const X = TT(), st = taskData.settings || {};
  return `<details class="tform"><summary>⚙ ${esc(X.settings)}</summary><div class="trow">
    <label>${esc(X.parallel)}<input type="number" min="1" max="6" value="${Number(st.maxParallel) || 2}" data-tset="maxParallel"></label>
    <label>${esc(X.maxAttempts)}<input type="number" min="1" max="10" value="${Number(st.maxAttempts) || 3}" data-tset="maxAttempts"></label></div>
    <label class="tchk"><input type="checkbox" data-tset="autoApply" ${st.autoApply ? 'checked' : ''}> ${esc(X.autoApply)}</label>
    <div class="trow"><label>${esc(X.autoMax)}<select data-tset="autoMax">${['eco', 'bal', 'deep'].map(k => `<option value="${k}" ${st.autoMax === k ? 'selected' : ''}>${esc(X.profiles[k])}</option>`).join('')}</select></label>
    <label>${esc(X.autoPerTask)}<input type="number" min="0" max="5" value="${Number(st.autoPerTask) || 0}" data-tset="autoPerTask"></label></div><p class="note">${esc(X.autoNote)}</p></details>`;
}
function formHtml() {
  const X = TT(), folders = typeof knownFolders === 'function' ? knownFolders() : [];
  const sel = (name, opts, v) => `<select data-tf="${name}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<details class="tform" ${taskData.tasks.length ? '' : 'open'}><summary>＋ ${esc(X.newT)}</summary>
    <label>${esc(X.desc)}<textarea data-tf="desc" rows="3"></textarea></label>
    <label>${esc(X.title)}<input data-tf="title" maxlength="80"></label>
    <label>${esc(X.folder)}<input data-tf="dir" list="tdirs" value="${esc(folders[0] ? folders[0][0] : '')}"><datalist id="tdirs">${folders.map(([d]) => `<option value="${esc(d)}">`).join('')}</datalist></label>
    <div class="trow"><label>${esc(X.agent)}${sel('agent', [['auto', X.auto], ['claude', 'Claude Code'], ['codex', 'Codex']], 'auto')}</label>
    <label>${esc(X.profile)}${sel('profile', [['', X.recommended], ...Object.entries(X.profiles)], '')}</label>
    <label>${esc(X.role)}${sel('role', [['', X.none], ...(taskData.roles || []).map(r => [r, X.roles[r] || r])], '')}</label>
    <label>${esc(X.prio)}${sel('priority', [['3', X.prios[3]], ['2', X.prios[2]], ['1', X.prios[1]]], '2')}</label></div>
    <div class="trow"><label>${esc(X.perm)}${sel('perm', Object.entries(X.perms), 'acceptEdits')}</label>
    <label>${esc(X.dep)}${sel('dependsOn', [['', X.none], ...taskData.tasks.filter(t => !['done', 'cancelled'].includes(t.state)).map(t => [t.id, t.title])], '')}</label>
    <label>${esc(X.budget)}<input data-tf="budget" type="number" min="0" step="0.5" value="0"></label></div>
    <label>${esc(X.test)}<input data-tf="testCmd" placeholder="npm test"></label>
    <label class="tchk"><input type="checkbox" data-tf="worktree" checked> ${esc(X.wt)}</label>
    <label class="tchk"><input type="checkbox" data-tf="lean"> ${esc(X.lean)}</label>
    <p><button class="btn small" data-tact="recommend">💡 ${esc(X.rec)}</button> <button class="btn" data-tact="create">➤ ${esc(X.create)}</button></p><p class="note" id="tmsg">${esc(taskWhy)}</p></details>`;
}
function rowHtml(t) {
  const X = TT(), why = t.state === 'blocked' || t.reason === 'restart' || t.reason === 'detached' ? ' · ' + (X.reasons[t.reason] || '') : '';
  return `<li class="trow-item st-${t.state}" data-topen="${esc(t.id)}"><span class="tdot"></span><span><b>${esc(t.title)}</b><br><small>${esc(X.states[t.state])}${esc(why)} · ${esc(t.agent)} · ${esc(X.profiles[t.profile] || '')} · ${esc(mname(t, t.model))} · ${esc(t.effort)}</small></span>
    <span class="q-side"><small>${t.costUnknown && !t.cost ? '?' : esc(fmtUSD(t.cost || 0)) + (t.costUnknown ? '+?' : '')}</small><small>⌛ ${esc(ago(Date.now() - t.updated))}</small></span></li>`;
}
function renderTasks() {
  const X = TT(), body = reportEl.querySelector('.report-body');
  if (taskSel && taskDetail) return renderTaskDetail(body);
  const order = ['blocked', 'running', 'pending', 'failed', 'done', 'cancelled'], list = taskData.tasks.slice().sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || b.priority - a.priority || b.updated - a.updated);
  const kindL = { task: X.kinds.task, session: X.kinds.session, today: X.kinds.today, month: X.kinds.month };
  body.innerHTML = tabsHtml() + `<p class="sub">${esc(X.sub)}</p>${taskData.privacy ? `<p class="note">🔒 ${esc(X.privateNote)}</p>` : ''}` + formHtml() + settingsHtml()
    + `<div class="trow"><label style="flex:2">🔎 <input data-tsearch placeholder="${esc(X.search)}"></label></div>`
    + (taskSearch.length ? `<ul class="queue">${taskSearch.map(r => `<li ${r.kind === 'task' ? `data-topen="${esc(r.id)}"` : r.live ? `data-tperson="${esc(r.id)}"` : ''}><b>${esc(r.title)}</b> <small>${esc(kindL[r.kind] || r.kind)} · ${esc(r.agent || '')}${r.state ? ' · ' + esc(X.states[r.state] || T.states[r.state] || r.state) : ''}</small></li>`).join('')}</ul>` : '')
    + (list.length ? `<ul class="queue tlist">${list.map(rowHtml).join('')}</ul>` : `<p class="note">${esc(X.empty)}</p>`) + rankingHtml();
}
function renderTaskDetail(body) {
  const X = TT(), t = taskDetail, ev = t.events || [], live = t.state === 'running';
  const evHtml = ev.slice(-60).reverse().map(e => {
    const txt = e.kind === 'warn' ? warnText(e) : e.kind === 'config' ? `${mname(t, e.from.model)}/${e.from.effort} → ${mname(t, e.to.model)}/${e.to.effort} (${e.applies === 'next' ? X.next : X.now}; ${e.why})` : e.kind === 'applied' ? X.appliedOk(mname(t, e.to.model), e.to.effort) : e.kind === 'test' ? X.tests(e.code) + '\n' + (e.text || '') : e.kind === 'tool' ? `${e.name} ${e.text || ''}` : e.kind === 'state' ? `${X.states[e.state] || e.state}${e.reason ? ' · ' + (X.reasons[e.reason] || e.reason) : ''}` : e.kind === 'start' ? `${mname(t, e.model)} · ${e.effort} · #${e.attempt}${e.resume ? ' · ' + X.resumed : ''}` : e.text || '';
    return `<li class="ev-${esc(e.kind)}"><small>${esc(new Date(e.at).toLocaleTimeString())} · ${esc(X.ev[e.kind] || e.kind)}</small>${txt ? `<pre>${esc(String(txt).slice(0, 1500))}</pre>` : ''}</li>`;
  }).join('');
  const models = Object.entries(t.byModel || {});
  body.innerHTML = tabsHtml() + `<p><button class="btn small" data-tact="back">${esc(X.back)}</button></p>
    <h3>${esc(t.title)} <small class="note">${esc(X.states[t.state])}${t.reason ? ' · ' + esc(X.reasons[t.reason] || t.reason) : ''}</small></h3>
    <p class="note">${esc(t.agent)}${t.role ? ' · ' + esc(X.roles[t.role] || t.role) : ''}${t.lean ? ' · ' + esc(X.leanOn) : ''} · ${esc(t.cwd)}${t.sessionId ? ' · ' + esc(t.sessionId.slice(0, 8)) : ''} · ${esc(X.attempts(t.attempts))}${t.subagents ? ' · ' + esc(X.subagents(t.subagents)) : ''}</p>
    <div class="tbig"><div>${costHtml(t)}</div><div><b>${fmtK(t.tokens.output)}</b><small>out ${esc(X.tokens)}</small></div><div><b>${fmtK(t.tokens.input + t.tokens.cacheWrite)}</b><small>in</small></div><div><b>${fmtK(t.tokens.cacheRead)}</b><small>cache</small></div></div>
    ${models.length ? `<p class="note">${models.map(([m, v]) => `${esc(m)}: ${v.unpriced ? '?' : esc(fmtUSD(v.usd))}`).join(' · ')} — ${esc(t.agent === 'claude' ? X.srcClaude : X.srcCodex)}</p>` : ''}
    ${cfgHtml(t)}${ctlHtml(t, 't')}
    <label class="tchk"><input type="checkbox" data-tcfg="lean" ${t.lean ? 'checked' : ''}> ${esc(X.lean)}</label>
    ${t.result ? `<pre class="tresult">${esc(t.result)}</pre>` : ''}
    ${t.tests ? `<p class="${t.tests.code === 0 ? 'ok' : 'warn'}">${esc(X.tests(t.tests.code))}</p>` : ''}
    ${t.warn ? `<p class="warn">⚠ ${esc(warnText(t.warn))}${t.warn.rec ? ` <button class="btn small" data-tact="applyWarn">${esc(T.notices.apply)}: ${esc(X.profiles[t.warn.rec.profile])}</button>` : ''}</p>` : ''}
    ${t.denials && t.denials.length ? `<p><b>${esc(X.denied)}:</b> ${t.denials.map(d => `<code>${esc(d.tool)}</code> <small>${esc(d.what)}</small>`).join(', ')}</p><p><button class="btn" data-tact="approve">✔ ${esc(X.approve)}</button></p>` : ''}
    ${t.files && t.files.length ? `<p><b>${esc(X.files)}:</b> ${t.files.slice(0, 30).map(f => `<code>${esc(f)}</code>`).join(' ')}</p>` : ''}
    ${['blocked', 'failed'].includes(t.state) ? `<div class="office-name"><textarea data-treply rows="2" placeholder="${esc(X.reply)}"></textarea></div><p><button class="btn" data-tact="reply">➤ ${esc(X.send)}</button></p>` : ''}
    <p>${['blocked', 'failed', 'done'].includes(t.state) && !taskData.privacy ? `<button class="btn small" data-tact="diff">${esc(X.diff)}</button>` : ''}
      ${t.state === 'blocked' ? `<button class="btn small" data-tact="conclude">✔ ${esc(X.conclude)}</button>` : ''}
      ${['failed', 'cancelled', 'blocked'].includes(t.state) ? `<button class="btn small" data-tact="retry">↻ ${esc(X.retry)}</button>` : ''}
      ${['failed', 'blocked'].includes(t.state) ? `<button class="btn small" data-tact="fresh" title="${esc(X.freshTip)}">✦ ${esc(X.fresh)}</button>` : ''}
      ${['blocked', 'failed', 'done'].includes(t.state) ? `<button class="btn small" data-tact="handoff">↪ ${esc(X.handoff)}</button>` : ''}
      ${['running', 'pending', 'blocked'].includes(t.state) ? `<button class="btn small warn" data-tact="cancel">✖ ${esc(X.cancel)}</button>` : ''}
      ${!live ? `<button class="btn small" data-tact="delete">🗑 ${esc(X.del)}</button>` : ''}</p><p class="note" id="tmsg"></p>
    ${taskDiff ? taskDiff.ok ? `<pre class="tdiff">${esc(taskDiff.base ? X.since(taskDiff.base.slice(0, 8)) + '\n' : '')}${esc(taskDiff.stat)}${taskDiff.untracked && taskDiff.untracked.length ? '\n' + esc(X.newFiles) + ': ' + esc(taskDiff.untracked.join(', ')) : ''}\n\n${esc(taskDiff.diff)}</pre>` : `<p class="note">${esc(X.fail[taskDiff.reason] || X.fail.state)}</p>` : ''}
    ${t.configLog && t.configLog.length ? `<h4>${esc(X.configLog)}</h4><ul class="note">${t.configLog.slice(-8).map(c => `<li>${esc(new Date(c.at).toLocaleString())}: ${esc(mname(t, c.from.model))}/${esc(c.from.effort)} → ${esc(mname(t, c.to.model))}/${esc(c.to.effort)} (${esc(c.why)})</li>`).join('')}</ul>` : ''}
    <h4>${esc(X.events)}</h4><ul class="tevents">${evHtml}</ul>`;
}
const tfVal = () => { const o = {}; reportEl.querySelectorAll('[data-tf]').forEach(el => { o[el.dataset.tf] = el.type === 'checkbox' ? el.checked : el.value; }); return o; };
const tFail = r => (TT().fail[r.reason] || TT().fail.state);
reportEl.addEventListener('click', async e => {
  if (reportTab !== 'tasks') return;
  const per = e.target.closest('[data-tperiod]'); if (per) { taskPeriod = per.dataset.tperiod; return renderTasks(); }
  const op1 = e.target.closest('[data-topen]'); if (op1) { taskDiff = null; return loadTask(op1.dataset.topen); }
  const pp = e.target.closest('[data-tperson]'); if (pp) { closeReport(); selected = pp.dataset.tperson; return renderPanel(); }
  const b = e.target.closest('[data-tact]'); if (!b) return;
  const act = b.dataset.tact, X = TT(), msg = t => { const m = document.getElementById('tmsg'); if (m) m.textContent = t; };
  if (act === 'recommend') { const v = tfVal(), r = await api('api/tasks', { op: 'recommend', desc: v.desc, agent: v.agent === 'auto' ? 'claude' : v.agent }); if (r.ok) { reportEl.querySelector('[data-tf="profile"]').value = r.rec.profile; taskWhy = `${X.recFor(X.profiles[r.rec.profile], r.rec.model || X.cliDefault, r.rec.effort)} — ${r.rec.why.map(w => X.recWhy[w] || w).join(' · ')}${r.rec.similar ? ' · ' + X.similar(r.rec.similar) : ''}`; msg(taskWhy); } return; }
  if (act === 'create') { const r = await api('api/tasks', { op: 'create', ...tfVal() }); if (!r.ok) return msg(tFail(r)); taskWhy = ''; achBump('launches'); await pollTasks(); return loadTask(r.task.id); }
  if (act === 'back') { taskSel = ''; taskDetail = null; taskDiff = null; return renderTasks(); }
  const id = taskSel; if (!id) return;
  if (act === 'diff') { taskDiff = await api('api/task-diff?id=' + encodeURIComponent(id)); return renderTasks(); }
  if (act === 'cancel' && !confirm(X.cancelSure)) return;
  let r;
  if (['save', 'more', 'applyRec'].includes(act)) r = await applyCfg(taskDetail, act);
  else if (act === 'applyWarn') { const w = taskDetail.warn.rec; r = await api('api/tasks', { op: 'config', id, profile: w.profile, model: w.model, effort: w.effort, why: 'warn:' + w.why }); }
  else r = await api('api/tasks', { op: act, id, text: act === 'reply' ? (reportEl.querySelector('[data-treply]') || {}).value || '' : undefined, agent: act === 'handoff' ? (taskDetail.agent === 'claude' ? 'codex' : 'claude') : undefined });
  if (!r.ok) return msg(tFail(r));
  if (act === 'delete') { taskSel = ''; taskDetail = null; await pollTasks(); return renderTasks(); }
  if (act === 'handoff' && r.task) { await pollTasks(); return loadTask(r.task.id); }
  if (act === 'cancel' && r.pending) msg(X.cancelling);
  await pollTasks(); loadTask(id);
});
reportEl.addEventListener('change', async e => {
  if (reportTab !== 'tasks') return;
  const c = e.target.closest('[data-tcfg]'); if (c && taskSel) { await api('api/tasks', { op: 'config', id: taskSel, [c.dataset.tcfg]: c.type === 'checkbox' ? c.checked : c.value, why: 'manual' }); return loadTask(taskSel); }
  const st = e.target.closest('[data-tset]'); if (st) { await api('api/tasks', { op: 'settings', [st.dataset.tset]: st.type === 'checkbox' ? st.checked : st.value }); pollTasks(); }
});
let tSearchT = 0;
reportEl.addEventListener('input', e => {
  const q = e.target.closest('[data-tsearch]'); if (!q) return;
  clearTimeout(tSearchT); tSearchT = setTimeout(async () => { taskSearch = q.value.trim().length > 1 ? await api('api/search?q=' + encodeURIComponent(q.value)) : []; if (!Array.isArray(taskSearch)) taskSearch = []; const v = q.value; renderTasks(); const n = reportEl.querySelector('[data-tsearch]'); n.value = v; n.focus(); }, 300);
});

// ---- notification center: grouped by key, read state, actions; kept in this browser ----
let notices = []; try { notices = JSON.parse(store.get('notices', '[]')) || []; } catch { notices = []; }
const unreadNotices = () => notices.filter(n => !n.read).length;
function saveNotices() { notices = notices.slice(0, 80); try { store.set('notices', JSON.stringify(notices)); } catch {} updateBell(); }
function pushNotice(key, kind, title, body, ref = {}) {
  const n = notices.find(x => x.key === key && !x.read);
  if (n) { n.n++; n.at = Date.now(); n.title = title; n.body = body; n.ref = ref; notices = [n, ...notices.filter(x => x !== n)]; }
  else notices.unshift({ key, kind, title, body, ref, at: Date.now(), n: 1, read: false });
  saveNotices();
}
function renderNotices() {
  const N = T.notices, body = reportEl.querySelector('.report-body'), priv = !!(data && data.privacy) || taskData.privacy;
  const title = n => priv ? N.hidden : n.title;
  body.innerHTML = tabsHtml() + `<p class="sub">${esc(N.sub)}</p>${priv ? `<p class="note">🔒 ${esc(N.privateNote)}</p>` : ''}` + (notices.length ? `<p><button class="btn small" data-nall>${esc(N.readAll)}</button></p><ul class="queue notices">${notices.map((n, i) => `<li class="${n.read ? '' : 'urgent'} ${esc(n.kind)}"><span><b>${esc(title(n))}</b>${n.n > 1 ? ` <small>${esc(N.times(n.n))}</small>` : ''}<br><small>${esc(ago(Date.now() - n.at))}</small>${!priv && (n.showWhy || !n.ref.rec) && n.body ? `<br><span class="q-what">${esc(n.body)}</span>` : ''}</span>
    <span class="q-side">${n.ref.rec ? `<button class="btn small" data-nact="apply" data-n="${i}" title="${esc(T.tasks.profiles[n.ref.rec.profile] + ' · ' + (n.ref.rec.model || T.tasks.cliDefault) + ' · ' + n.ref.rec.effort)}">${esc(N.apply)}</button><button class="btn small" data-nact="why" data-n="${i}">${esc(N.why)}</button>` : ''}${n.ref.task || n.ref.agent || n.ref.ver ? `<button class="btn small" data-nact="open" data-n="${i}">${esc(N.open)}</button>` : ''}<button class="btn small" data-nact="dismiss" data-n="${i}">${esc(N.notNow)}</button></span></li>`).join('')}</ul>` : `<p class="note">${esc(N.empty)}</p>`);
}
reportEl.addEventListener('click', async e => {
  if (reportTab !== 'notices') return;
  if (e.target.closest('[data-nall]')) { notices.forEach(n => { n.read = true; }); saveNotices(); return renderNotices(); }
  const b = e.target.closest('[data-nact]'); if (!b) return;
  const n = notices[Number(b.dataset.n)]; if (!n) return; const a = b.dataset.nact;
  n.read = true;
  if (a === 'why') n.showWhy = true;
  if (a === 'dismiss') notices = notices.filter(x => x !== n);
  if (a === 'apply' && n.ref.task && n.ref.rec) { const w = n.ref.rec; await api('api/tasks', { op: 'config', id: n.ref.task, profile: w.profile, model: w.model, effort: w.effort, why: 'notice:' + w.why }); } // exactly what the notice proposed
  saveNotices();
  if (a === 'open' || a === 'apply') { if (n.ref.task) { reportTab = 'tasks'; await pollTasks(); return loadTask(n.ref.task); } if (n.ref.ver) { reportTab = 'version'; return renderReport(); } if (n.ref.agent) { closeReport(); return openTalk(n.ref.agent); } }
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
// ?admin=new | seen | party previews the admin without a real release (nothing is saved as seen)
const adminPreview = new URLSearchParams(location.search).get('admin');
async function loadVersion() {
  verData = await api('api/version');
  if (verData && verData.current && adminPreview) {
    const [a, b, c] = verData.current.split('.').map(Number); verData = { ...verData, latest: `${a}.${b}.${c + 1}`, newer: adminPreview !== 'party' };
    if (adminPreview === 'party') adminCelebrateUntil = Date.now() + 864e5;
  }
  if (verData && verData.current) { if (!adminPreview) checkVersionNotice(); drawAdmin(); } if (!reportEl.hidden && reportTab === 'version') renderVersion(); }
setTimeout(loadVersion, 1500); setInterval(loadVersion, 30 * 60000);
function checkVersionNotice() {
  const v = verData; if (!v.newer) return;
  const later = Number(store.get('verLater', 0)) || 0;
  if (Date.now() > later && !notices.some(n => n.key === 'ver:' + v.latest)) pushNotice('ver:' + v.latest, 'ok', T.notices.update(v.latest), T.ver.note, { ver: v.latest });
}
let verPick = '';
function lucasPortrait() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 17; const g = c.getContext('2d');
  g.drawImage(Art.sprite(LUCAS_BODY, LUCAS_COL, 'lucas-b'), 0, 10); g.drawImage(Art.sprite(LUCAS_HEAD, LUCAS_COL, 'lucas-h'), 0, 0);
  g.fillStyle = '#8a5e3a'; g.fillRect(5, 1, 3, 1); return c;
}
function renderVersion() {
  const V = T.ver, v = verData || {}, body = reportEl.querySelector('.report-body'), notes = v.notes || [];
  if (v.newer && !adminPreview) { store.set('verSeen', v.latest); drawAdmin(); }
  const pick = notes.find(n => n.v === verPick) || notes.find(n => n.v === v.latest) || notes.find(n => n.v === v.current) || notes[0];
  const top = notes.find(n => n.v === (v.newer ? v.latest : v.current));
  const say = !v.checkedAt && !v.current ? V.unavailable : v.newer ? (top ? V.sayNew(v.latest) : V.sayNewNoNotes(v.latest)) : V.sayCur(v.current || '?');
  const cmd = (label, c) => `<p>${esc(label)} <code>${esc(c)}</code> <button class="btn small" data-vcopy="${esc(c)}">${esc(V.copy)}</button></p>`;
  const checked = v.checkedAt ? esc(ago(Date.now() - v.checkedAt)) : esc(v.error ? V.unavailable : V.never);
  body.innerHTML = tabsHtml() + `<div class="vhero"><span data-vface></span><div class="vsay"><b>${esc(V.admin)}</b>${esc(say)}${top ? `<ul>${top.items.slice(0, 3).map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}</div></div>
    <div class="tbig"><div><b>${esc(v.current || '?')}</b><small>${esc(V.installed)}</small></div><div><b>${esc(v.latest || '—')}</b><small>${esc(V.latest)}</small></div><div><b>${checked}</b><small>${esc(V.checked)}</small></div></div>
    ${v.newer ? (v.install === 'global' ? cmd(V.global, 'npm install -g coworking-agents@latest') : v.install === 'plugin' ? `<p>${esc(V.plugin)}</p>` : cmd(V.npx, 'npx coworking-agents@latest')) + `<p class="note">${esc(V.note)}</p><p><button class="btn small" data-vlater>${esc(V.later)}</button></p>` : v.latest ? `<p class="ok">${esc(V.upToDate)}</p>` : `<p class="note">${esc(V.unavailable)}</p>`}
    <h3>${esc(V.map)}</h3><div class="vmap">${notes.slice().reverse().map((n, i) => `${i ? '<i></i>' : ''}<button data-vpick="${esc(n.v)}" class="${n === pick ? 'on' : ''} ${n.v === v.current ? 'cur' : ''} ${v.newer && n.v === v.latest ? 'next' : ''}" title="${esc(n.date)}">${esc(n.v)}</button>`).join('')}</div>
    ${pick ? `<div class="vnotes"><h4>${esc(pick.v)} <small class="note">${esc(pick.date)}</small></h4><ul>${pick.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>` : ''}`;
  const face = body.querySelector('[data-vface]'); if (face) face.appendChild(lucasPortrait());
  const m = body.querySelector('.vmap'); if (m) m.scrollLeft = m.scrollWidth;
}
reportEl.addEventListener('click', e => { if (reportTab !== 'version') return; const b = e.target.closest('[data-vpick]'); if (b) { verPick = b.dataset.vpick; renderVersion(); } });
reportEl.addEventListener('click', e => {
  if (reportTab !== 'version') return;
  const c = e.target.closest('[data-vcopy]'); if (c) { navigator.clipboard && navigator.clipboard.writeText(c.dataset.vcopy); c.textContent = T.ver.copied; return; }
  if (e.target.closest('[data-vlater]')) { store.set('verLater', Date.now() + 864e5); notices = notices.filter(n => n.key !== 'ver:' + (verData || {}).latest); saveNotices(); closeReport(); }
});

// ---- the office admin: waves with a sign while a new version is unseen, keeps the sign until it runs, celebrates once ----
const adminEl = document.createElement('button');
adminEl.id = 'admin'; adminEl.className = 'admin'; adminEl.innerHTML = '<span class="admin-bubble"></span>'; adminEl.hidden = true;
document.querySelector('.bar').appendChild(adminEl); // a click target over the admin drawn in the top bar scene
adminEl.addEventListener('click', () => openReport('version'));
const reduceMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
let adminState = 'idle', adminCelebrateUntil = 0;
function adminMode() {
  const v = verData; if (!v || !v.current) return 'idle';
  const last = store.get('lastRunVersion', '');
  if (last !== v.current) { if (last) adminCelebrateUntil = Date.now() + 10000; store.set('lastRunVersion', v.current); }
  if (Date.now() < adminCelebrateUntil) return 'celebrate';
  if (v.newer) return adminPreview ? (adminPreview === 'seen' ? 'pending' : 'unseen') : store.get('verSeen', '') === v.latest ? 'pending' : 'unseen';
  return 'idle';
}
function drawAdmin(t = Date.now()) {
  adminState = adminMode();
  const v = verData || {}, bub = adminEl.querySelector('.admin-bubble');
  adminEl.hidden = adminState === 'idle'; // only shows up when there's news about a version
  bub.textContent = adminState === 'celebrate' ? T.ver.celebrate(v.current) : adminState !== 'idle' ? 'v' + v.latest : '';
  adminEl.classList.toggle('loud', adminState === 'unseen'); adminEl.title = T.ver.admin + (adminState !== 'idle' ? ' · ' + bub.textContent : '');
}
// Lucas, drawn by the top bar scene (help.js) behind the counter in the same chibi style as the agents:
// textured brown crop, light eyes, stubble beard, butterfly tattoo on the neck, navy polo with an open collar.
// While there's version news he holds up a little wooden sign with the version.
const LUCAS_HEAD = [
  '....oooooooo....', '...ohHhhHhhho...', '..ohhhHhhhHhho..', '..ohHhhhhhHhho..', '..ohsssssssSho..',
  '.ohssbssssbssho.', '.oSssssssssssSo.', '..oBsssmmsssBo..', '...oBBBBBBBBo...', '.....oBttBo.....',
];
const LUCAS_BODY = [
  '..oocccsstcccoo.', '.occcccsscccccCo', 'occcccccccccccCo', 'occCccccccccCcCo', 'occCccccccccCcCo', 'osSCccccccccCSso', 'oooCCCCCCCCCCooo',
];
const LUCAS_COL = { o: '#1a1520', s: '#f2c7a5', S: '#d9a07c', h: '#6a4530', H: '#4a2f20', b: '#3f6a8a', m: '#a8584e', B: '#8a6a52', t: '#59586a', c: '#2f3e63', C: '#222c48' };
function drawLucas(g, ox, oy, S, t) {
  const still = reduceMotion.matches, f = still ? 0 : Math.floor(t / 320) % 2, party = adminState === 'celebrate';
  const bob = party && f ? -1 : 0, y = oy + bob;
  g.drawImage(Art.sprite(LUCAS_BODY, LUCAS_COL, 'lucas-b'), ox, y + 10);
  g.drawImage(Art.sprite(LUCAS_HEAD, LUCAS_COL, 'lucas-h'), ox, y);
  const px = (x, yy, w, h, col) => { g.fillStyle = col; g.fillRect(ox + x, y + yy, w, h); };
  px(5, 1, 3, 1, '#8a5e3a'); // hair highlight, like the agents
  if (!still && t % 3200 < 140) { px(4, 5, 3, 1, '#f2c7a5'); px(9, 5, 3, 1, '#f2c7a5'); } // blink
  // small raised arm on his right (our left) with the sign beside the head; it sways while the news is unseen
  const lift = adminState === 'unseen' && f ? -1 : 0, ay = 6 + lift;
  px(-1, ay, 3, 11 - lift, '#1a1520'); px(0, ay + 1, 1, 9 - lift, '#2f3e63'); px(-1, ay - 2, 3, 3, '#1a1520'); px(0, ay - 1, 1, 1, '#f2c7a5');
  const v = verData || {}, label = 'V' + ((party ? v.current : v.latest) || ''), w = label.length * 4 + 3, bx = -w - 1, by = ay - 6;
  px(bx - 1, by - 1, w + 2, 9, '#1a1520'); px(bx, by, w, 7, party ? '#63c74d' : '#d79a55'); px(bx, by + 6, w, 1, party ? '#3e8948' : '#a8703a');
  g.fillStyle = party ? '#163a1c' : '#3a1f0c';
  for (const [i, ch] of [...label].entries()) { const gl = PIXFONT[ch]; if (gl) for (let k = 0; k < 15; k++) if (gl[k] === '1') g.fillRect(ox + bx + 2 + i * 4 + (k % 3), y + by + 1 + ((k / 3) | 0), 1, 1); }
  if (adminState === 'unseen' && f) { px(bx - 3, by + 1, 1, 2, '#feae34'); px(bx - 3, by + 4, 1, 1, '#feae34'); }
  if (party && !still) for (let i = 0; i < 8; i++) px(((i * 7 + f * 3) % 28) - 6, ((i * 5 + f * 2) % 8) - 4, 1, 1, ['#f7b733', '#ff6b9d', '#4fa3ff'][i % 3]);
}
setInterval(() => { if (!document.hidden) drawAdmin(); }, 1000);
try { drawAdmin(); } catch {}
