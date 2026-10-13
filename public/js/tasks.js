'use strict';
// ---------------- tasks you hand out, the notification center, the releases board and the office admin ----------------

const api = (url, body) => fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify(body) } : {}).then(r => r.json()).catch(() => ({ ok: false, reason: 'unknown' }));
let taskSaid = [], ghIssuesList = [];
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
// sessions opened outside are watched while they run: when the recommended setup moves away from what they use, a notice asks
const tierOf = (agent, model, effort) => agent === 'claude' ? (/haiku/.test(model) ? 'eco' : /opus/.test(model) ? 'deep' : /sonnet/.test(model) ? 'bal' : '')
  : ({ minimal: 'eco', low: 'eco', medium: 'bal', high: 'deep', xhigh: 'deep' })[effort] || '';
const watchAt = new Map();
function watchOutside() {
  if (!data || data.privacy || taskData.privacy) return;
  for (const p of data.people) {
    if (!['claude', 'codex'].includes(p.agent) || ['idle', 'asleep'].includes(p.state) || taskOfPerson(p.id)) continue;
    if (Date.now() - (watchAt.get(p.id) || 0) < 60000) continue; watchAt.set(p.id, Date.now());
    const live = { stuckMs: p.doing ? p.doing.for : 0, ctx: p.ctxMax ? p.ctx / p.ctxMax : 0 };
    api('api/tasks', { op: 'recommend', desc: [p.title, p.lastPrompt].filter(Boolean).join('\n'), agent: p.agent, live }).then(r => {
      const rec = r && r.ok && r.rec; if (!rec) return;
      recOf.set('p:' + p.id, { key: 'p:' + p.id + ':' + (p.title || '') + (p.lastPrompt || ''), rec });
      const now = tierOf(p.agent, p.model, p.effort), ctx = rec.why.includes('live-ctx');
      if (!ctx && (!now || now === rec.profile || !rec.why.some(w => w !== 'default'))) return; // a plain "regular task" is no reason to interrupt
      const key = rec.profile + ':' + rec.why.join('+'); if (noticed['o' + p.id] === key) return;
      noticed['o' + p.id] = key; try { store.set('taskNoticed', JSON.stringify(noticed)); } catch {}
      const X = T.tasks, why = rec.why.map(w => X.recWhy[w] || w).join(' · ');
      pushNotice('out:' + p.id, ORDER_UP(now, rec.profile) || ctx ? 'warn' : 'ok', X.outTitle(p.name, X.profiles[rec.profile]), `${why}. ${X.proposal(X.profiles[rec.profile], rec.model || X.cliDefault, rec.effort)} ${X.outHow}`, { agent: p.id, rec, ext: true });
      notifyOS(X.outTitle(p.name, X.profiles[rec.profile]), p.agent);
    });
  }
}
const ORDER_UP = (a, b) => ['eco', 'bal', 'deep'].indexOf(b) > ['eco', 'bal', 'deep'].indexOf(a);
function warnText(w) { const W = T.tasks.warn; return w.why === 'loop' ? W.loop(w.name) : typeof W[w.why] === 'function' ? W[w.why](w) : W[w.why] || ''; }
async function pollTasks() {
  const d = await api('api/tasks'); if (!d || !Array.isArray(d.tasks)) return;
  taskData = d;
  for (const t of d.tasks) {
    noticeTask(t);
    if (t.ask && noticed['a' + t.id] !== t.ask.at) {
      noticed['a' + t.id] = t.ask.at; try { store.set('taskNoticed', JSON.stringify(noticed)); } catch {}
      pushNotice('ask:' + t.id, 'warn', T.tasks.permTitle(t.title, t.ask.tool), t.ask.what, { task: t.id, ask: true });
      notifyOS(T.tasks.permTitle(t.title, t.ask.tool), t.agent);
    }
    if (t.warn && taskWarnSeen.get(t.id) !== t.warn.at) {
      taskWarnSeen.set(t.id, t.warn.at);
      if (Date.now() - t.warn.at < 864e5 && noticed['w' + t.id] !== t.warn.at) {
        noticed['w' + t.id] = t.warn.at; try { store.set('taskNoticed', JSON.stringify(noticed)); } catch {}
        const rec = t.warn.rec, X = T.tasks;
        pushNotice('warn:' + t.id + ':' + t.warn.why, 'warn', t.title, warnText(t.warn) + (rec ? ' ' + X.proposal(X.profiles[rec.profile], rec.model || X.cliDefault, rec.effort) : ''), { task: t.id, rec });
      }
    }
  }
  watchOutside();
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
// current, pending and recommended live in the recommendation card; this only confirms a change that just took effect
function cfgHtml(t) {
  const X = TT(), ev = (t.events || []).filter(e => e.kind === 'applied').slice(-1)[0];
  return ev && Date.now() - ev.at < 6e5 ? `<p class="tcfgnow"><span class="ok">✓ ${esc(X.appliedOk(mname(t, ev.to.model), ev.to.effort))}</span></p>` : '';
}
function costHtml(t) {
  const X = TT(), known = t.cost || 0;
  if (t.costUnknown && !known) return `<b>?</b><small>${esc(X.costUnknown)}</small>`;
  return `<b>${esc(fmtUSD(known))}${t.costUnknown ? '+?' : ''}</b><small>${esc(X.cost)}${t.budget ? ' / ' + esc(fmtUSD(t.budget)) : ''}${t.costUnknown ? ' · ' + esc(X.partUnknown) : ''}</small>`;
}
function ctlHtml(t, scope) {
  const X = TT(), o = optsFor(t.agent, t.model);
  const sel = (name, list, v) => `<select data-${scope}cfg="${name}">${list.map(x => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${esc(x || mname(t, ''))}</option>`).join('')}</select>`;
  return `<div class="tcfg"><button class="btn small ghost" data-${scope}act="save" title="${esc(X.saveTip)}">🪙 ${esc(X.save)}</button><button class="btn small ghost" data-${scope}act="more" title="${esc(X.moreTip)}">🚀 ${esc(X.more)}</button>
    <label>${esc(X.model)} ${sel('model', o.models, t.model)}</label><label>${esc(X.effort)} ${sel('effort', o.efforts, t.effort)}</label></div>`;
}

// ---- in the agent's panel: managed sessions get the controls, monitored ones a recommendation that is not applied ----
const recCache = new Map();
function taskCardHtml(p) {
  const X = TT(), t = taskOfPerson(p.id);
  if (!t) {
    return `<section class="card tcard"><small>${esc(X.monitored)}</small><p class="note">${esc(X.monitoredWhy)}</p>
      ${recCardHtml(null, p)}${canAsk(p) ? askHtml(p) : ''}
      ${canAsk(p) ? `<p><button class="btn small ghost" data-pnew="${esc(p.id)}">＋ ${esc(X.asTask)}</button></p>` : ''}</section>`;
  }
  return `<section class="card tcard managed"><small>${esc(X.managed)} · <a href="#" data-popen="${esc(t.id)}">${esc(X.openTask)}</a></small>
    <p><b>${esc(t.title)}</b> · ${esc(X.states[t.state])}${t.state === 'blocked' ? ' · ' + esc(X.reasons[t.reason] || '') : ''}</p>
    ${recCardHtml(t)}<div class="tbig"><div>${costHtml(t)}</div><div><b>${fmtK(t.tokens.output)}</b><small>out</small></div><div><b>${esc(X.attempts(t.attempts))}</b><small>${esc(X.src)}</small></div></div>
    ${askPermHtml(t)}${t.warn ? `<p class="warn">⚠ ${esc(warnText(t.warn))}</p>` : ''}${ctlHtml(t, 'p')}</section>`;
}
// a session running in a terminal switches model and effort right away: the office types /model and /effort (Codex: its picker)
const canSwitch = p => typeof canType === 'function' && canType() && !!p.pid && ['claude', 'codex'].includes(p.agent) && !['claude-desktop', 'claude-vscode', 'codex-vscode', 'codex-desktop'].includes(p.entrypoint);
const switchModel = (p, rec) => rec.model || ((taskData.options || {})[p.agent] || {}).def || '';
async function switchTo(p, rec) {
  const r = await fetch('api/switch', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id: p.id, model: switchModel(p, rec), effort: rec.effort }) }).then(x => x.json()).catch(() => ({ ok: false, reason: 'unknown' }));
  return r;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-pswitch]'); if (!b) return;
  const p = data.people.find(x => x.id === b.dataset.pswitch), hit = recOf.get('p:' + b.dataset.pswitch), X = TT(); if (!p || !hit || !hit.rec) return;
  b.disabled = true; const r = await switchTo(p, hit.rec), m = document.querySelector(`[data-pswitch-msg="${CSS.escape(p.id)}"]`);
  if (m) m.textContent = r.ok ? '✓ ' + X.switchOk : '⚠ ' + (X.switchFail[r.reason] || r.reason || '?'); b.disabled = false;
});
// a session opened outside (terminal, VS Code, the app) takes a request that continues the same conversation in the background
const canAsk = p => ['claude', 'codex'].includes(p.agent) && !!p.cwd;
const askDraft = new Map();
function askHtml(p) {
  const X = TT(), hit = recOf.get('p:' + p.id), rec = hit && hit.rec, d = askDraft.get(p.id) || {}, busy = !['idle', 'asleep'].includes(p.state);
  const model = d.model !== undefined ? d.model : rec ? rec.model : '', o = optsFor(p.agent, model), effort = d.effort || (rec && rec.effort) || p.effort || 'medium';
  const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label || v)}</option>`;
  return `<div class="pask"><b>${esc(X.askTitle)}</b><textarea data-pask-text="${esc(p.id)}" rows="3" maxlength="8000" placeholder="${esc(X.askPh)}">${esc(d.text || '')}</textarea>
    <div class="pask-row"><select data-pask-model="${esc(p.id)}" aria-label="${esc(X.model || 'model')}">${o.models.map(m => opt(m, model, m || (o.def ? o.def + ' (' + X.cliDefault + ')' : X.cliDefault))).join('')}</select>
    <select data-pask-effort="${esc(p.id)}" aria-label="${esc(X.effort || 'effort')}">${o.efforts.map(e => opt(e, effort)).join('')}</select>
    <button class="btn small" data-pask="${esc(p.id)}"${busy ? ' disabled' : ''}>➤ ${esc(X.askSend)}</button></div>
    ${p.ctxMax && p.ctx / p.ctxMax >= .5 ? `<p><button class="btn small ghost" data-pcompact="${esc(p.id)}"${busy ? ' disabled' : ''} title="${esc(X.compactTip)}">⤓ ${esc(X.compactNow)} · ${Math.round(p.ctx / p.ctxMax * 100)}%</button></p>` : ''}
    <p class="note" data-pask-msg>${esc(busy ? X.askBusy : X.askHow)}</p></div>`;
}
document.addEventListener('input', e => {
  const el = e.target.closest('[data-pask-text],[data-pask-model],[data-pask-effort]'); if (!el) return;
  const id = el.dataset.paskText || el.dataset.paskModel || el.dataset.paskEffort, d = askDraft.get(id) || {};
  if (el.dataset.paskText) d.text = el.value; else if (el.dataset.paskModel) { d.model = el.value; askDraft.set(id, d); return renderPanel(); } else d.effort = el.value;
  askDraft.set(id, d);
});
document.addEventListener('click', async e => {
  const k = e.target.closest('[data-pcompact]'); if (!k) return;
  const p = data.people.find(x => x.id === k.dataset.pcompact); if (!p) return; k.disabled = true;
  const r = await api('api/tasks', { op: 'create', resume: p.id, compact: true, dir: p.cwd, agent: p.agent, desc: 'compact', title: (p.title || p.name).slice(0, 70) });
  if (r && r.ok) { await pollTasks(); renderPanel(); } else { k.disabled = false; }
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-pask]'); if (!b) return;
  const p = data.people.find(x => x.id === b.dataset.pask), box = b.closest('.pask'), X = TT(); if (!p || !box) return;
  const text = box.querySelector('textarea').value.trim(); if (!text) return box.querySelector('textarea').focus();
  const hit = recOf.get('p:' + p.id), rec = hit && hit.rec;
  b.disabled = true;
  const r = await api('api/tasks', { op: 'create', resume: p.id, dir: p.cwd, agent: p.agent, desc: text, title: (p.title || p.name).slice(0, 70),
    profile: rec ? rec.profile : '', model: box.querySelector('[data-pask-model]').value, effort: box.querySelector('[data-pask-effort]').value });
  if (r && r.ok) { askDraft.delete(p.id); await pollTasks(); renderPanel(); }
  else { b.disabled = false; box.querySelector('[data-pask-msg]').textContent = '⚠ ' + ((X.fail || {})[r && r.reason] || (r && r.reason) || '?'); }
});
// the agent stopped before a tool it may not use: answer from here, the run goes on
function askPermHtml(t) {
  if (!t.ask) return ''; const X = TT();
  return `<div class="permask"><b>🔐 ${esc(X.permAsk(t.ask.tool))}</b>${t.ask.what ? `<code>${esc(t.ask.what)}</code>` : ''}
    <div class="pask-row"><button class="btn small" data-tpermit="${esc(t.id)}" data-allow="1">✓ ${esc(X.permAllow)}</button><button class="btn small" data-tpermit="${esc(t.id)}" data-allow="1" data-always="1">✓✓ ${esc(X.permAlways(t.ask.tool))}</button><button class="btn small ghost" data-tpermit="${esc(t.id)}">✕ ${esc(X.permDeny)}</button></div></div>`;
}
async function permit(id, allow, always) { await api('api/tasks', { op: 'permit', id, allow, always }); notices = notices.filter(n => n.key !== 'ask:' + id); saveNotices(); await pollTasks(); if (selected) renderPanel(); if (taskSel === id && !reportEl.hidden) loadTask(id); }
document.addEventListener('click', e => { const b = e.target.closest('[data-tpermit]'); if (!b) return; b.disabled = true; permit(b.dataset.tpermit, !!b.dataset.allow, !!b.dataset.always); });
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
// models compared on your own finished tasks: cost, attempts, tests and how often they ended well
function compareHtml() {
  const X = TT(), C = X.cmp, fin = taskData.tasks.filter(t => (['done', 'failed'].includes(t.state) || (t.state === 'blocked' && t.reason === 'review')) && t.attempts > 0 && !t.reviewOf); // only work that has ended, not a task waiting on a question
  const groups = new Map();
  for (const t of fin) { const k = `${t.agent} · ${mname(t, t.model)} · ${t.effort}`; (groups.get(k) || groups.set(k, []).get(k)).push(t); }
  if (!groups.size) return '';
  const rows = [...groups.entries()].map(([k, ts]) => {
    const tested = ts.filter(t => t.tests), ok = ts.filter(t => t.state === 'done' || (t.state === 'blocked' && t.reason === 'review'));
    return { k, n: ts.length, usd: ts.reduce((n, t) => n + (t.cost || 0), 0) / ts.length, unk: ts.some(t => t.costUnknown), att: ts.reduce((n, t) => n + t.attempts, 0) / ts.length, tests: tested.length ? tested.filter(t => t.tests.code === 0).length / tested.length : null, ok: ok.length / ts.length };
  }).sort((a, b) => b.n - a.n);
  const pct = v => v == null ? '—' : Math.round(v * 100) + '%';
  return `<h3>${esc(C.title)}</h3><p class="note">${esc(C.sub)}</p><div class="tcmp-wrap"><table class="tcmp"><thead><tr><th>${esc(C.model)}</th><th>${esc(C.n)}</th><th>${esc(C.cost)}</th><th>${esc(C.att)}</th><th>${esc(C.tests)}</th><th>${esc(C.ok)}</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(r.k)}${r.n < 3 ? ` <small class="note">${esc(C.few)}</small>` : ''}</td><td>${r.n}</td><td>${esc(fmtUSD(r.usd))}${r.unk ? '+?' : ''}</td><td>${r.att.toFixed(1)}</td><td>${pct(r.tests)}</td><td>${pct(r.ok)}</td></tr>`).join('')}</tbody></table></div>`;
}
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
// standing permission rules: always allow an exact command, always deny anything containing a text
function rulesHtml(st) {
  const P = TT().rules, rules = st.permRules || [];
  return `<h4>🛡 ${esc(P.title)}</h4><p class="note">${esc(P.sub)}</p>${rules.length ? `<ul class="tscheds">${rules.map(r => `<li><span class="tpill ${r.action === 'deny' ? 'st-failed' : 'st-done'}">${esc(P[r.action])}</span> <code>${esc(r.tool)}</code> ${r.match ? `<code>${esc(r.match)}</code>` : esc(P.any)} <button class="hb" data-ruledel="${esc(r.id)}" title="${esc(P.del)}">✕</button></li>`).join('')}</ul>` : ''}
    <div class="trow tsched-add"><label>${esc(P.action)}<select data-rule="action"><option value="deny">${esc(P.deny)}</option><option value="allow">${esc(P.allow)}</option></select></label>
      <label>${esc(P.tool)}<select data-rule="tool">${['*', 'Bash', 'command', 'Write', 'Edit', 'file_change', 'WebFetch'].map(x => `<option value="${x}">${esc(x === '*' ? P.anyTool : x)}</option>`).join('')}</select></label>
      <label>${esc(P.match)}<input data-rule="match" placeholder="npm test"></label><button class="btn small" data-ruleadd>＋ ${esc(P.add)}</button></div>
    <p><button class="btn small ghost" data-rulepreset>🛡 ${esc(P.preset)}</button></p>`;
}
document.addEventListener('click', async e => {
  const add = e.target.closest('[data-ruleadd]'), del = e.target.closest('[data-ruledel]'), pre = e.target.closest('[data-rulepreset]'); if (!add && !del && !pre) return;
  let r = { ok: true };
  if (del) r = await api('api/tasks', { op: 'unpermRule', id: del.dataset.ruledel });
  else if (pre) r = await api('api/tasks', { op: 'permPreset' });
  else { const v = k => (reportEl.querySelector(`[data-rule="${k}"]`) || {}).value || ''; r = await api('api/tasks', { op: 'permRule', action: v('action'), tool: v('tool'), match: v('match') }); }
  await pollTasks(); renderTasks(); if (!r.ok) { const m = document.getElementById('tmsg'); if (m) m.textContent = TT().rules.bad; }
});
// schedules: a saved template at a time, every day / weekdays / one weekday (only while the office is open)
function schedHtml(st) {
  const X = TT(), S = X.sched, tpls = st.templates || [], days = S.days;
  const when = sc => (sc.every === 'weekly' ? days[sc.day] : S.every[sc.every]) + ' · ' + sc.at;
  return `<h4>⏰ ${esc(S.title)}</h4>${(st.schedules || []).length ? `<ul class="tscheds">${st.schedules.map(sc => `<li><label class="tchk"><input type="checkbox" data-schon="${esc(sc.id)}" ${sc.on ? 'checked' : ''}> <b>${esc(sc.tpl)}</b> · ${esc(when(sc))}${sc.last ? ' · ' + esc(S.last(sc.last)) : ''}</label> <button class="hb" data-schdel="${esc(sc.id)}" title="${esc(S.del)}">✕</button></li>`).join('')}</ul>` : ''}
    ${tpls.length ? `<div class="trow tsched-add"><label>${esc(S.tpl)}<select data-sch="tpl">${tpls.map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')}</select></label>
      <label>${esc(S.when)}<select data-sch="every">${Object.entries(S.every).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}${days.map((d, i) => `<option value="w${i}">${esc(d)}</option>`).join('')}</select></label>
      <label>${esc(S.at)}<input type="time" value="08:00" data-sch="at"></label><button class="btn small" data-schadd>＋ ${esc(S.add)}</button></div>` : `<p class="note">${esc(S.noTpl)}</p>`}
    <p class="note">${esc(S.note)}</p>`;
}
document.addEventListener('click', async e => {
  const add = e.target.closest('[data-schadd]'), del = e.target.closest('[data-schdel]'); if (!add && !del) return;
  if (del) await api('api/tasks', { op: 'unschedule', id: del.dataset.schdel });
  else { const v = k => (reportEl.querySelector(`[data-sch="${k}"]`) || {}).value || '', ev = v('every'); await api('api/tasks', { op: 'schedule', tpl: v('tpl'), every: ev.startsWith('w') ? 'weekly' : ev, day: ev.startsWith('w') ? Number(ev.slice(1)) : 0, at: v('at') }); }
  await pollTasks(); renderTasks();
});
document.addEventListener('change', async e => {
  const c = e.target.closest('[data-schon]'); if (!c) return;
  const sc = (taskData.settings.schedules || []).find(x => x.id === c.dataset.schon); if (!sc) return;
  await api('api/tasks', { op: 'schedule', ...sc, on: c.checked }); await pollTasks();
});
function settingsHtml() {
  const X = TT(), st = taskData.settings || {};
  return `<details class="tform tset" ${tsetOpen ? 'open' : ''}><summary>⚙ ${esc(X.settings)}</summary><div class="trow">
    <label>${esc(X.parallel)}<input type="number" min="1" max="6" value="${Number(st.maxParallel) || 2}" data-tset="maxParallel"></label>
    <label>${esc(X.maxAttempts)}<input type="number" min="1" max="10" value="${Number(st.maxAttempts) || 3}" data-tset="maxAttempts"></label>
    <label>${esc(X.dayBudget)}<input type="number" min="0" step="1" value="${Number(st.dayBudget) || 0}" data-tset="dayBudget"></label></div>
    <label class="tchk"><input type="checkbox" data-tset="autoApply" ${st.autoApply ? 'checked' : ''}> ${esc(X.autoApply)}</label>
    <label class="tchk"><input type="checkbox" data-tset="autoReview" ${st.autoReview ? 'checked' : ''}> ${esc(X.autoReview)}</label>
    <div class="trow"><label>${esc(X.autoMax)}<select data-tset="autoMax">${['eco', 'bal', 'deep'].map(k => `<option value="${k}" ${st.autoMax === k ? 'selected' : ''}>${esc(X.profiles[k])}</option>`).join('')}</select></label>
    <label>${esc(X.autoPerTask)}<input type="number" min="0" max="5" value="${Number(st.autoPerTask) || 0}" data-tset="autoPerTask"></label></div><p class="note">${esc(X.autoNote)}</p>
    ${schedHtml(st)}${rulesHtml(st)}</details>`;
}
let tformOpen = false; // the form stays open across the periodic refresh
let tsetOpen = false;
document.addEventListener('toggle', e => { const c = e.target.classList; if (!c || !c.contains('tform')) return; if (c.contains('tset')) tsetOpen = e.target.open; else tformOpen = e.target.open; }, true);
function formHtml() {
  const X = TT(), folders = typeof knownFolders === 'function' ? knownFolders() : [];
  const sel = (name, opts, v) => `<select data-tf="${name}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<details class="tform" ${!taskData.tasks.length || tformOpen ? 'open' : ''}><summary>＋ ${esc(X.newT)}</summary>
    ${(taskData.settings.templates || []).length ? `<div class="tpls"><small>${esc(X.tplTitle)}</small>${taskData.settings.templates.map((x, i) => `<span class="tpl"><button class="btn small ghost" data-tpl="${i}" title="${esc(x.desc.slice(0, 200))}">${esc(x.name)}</button><button class="hb" data-tplrun="${i}" title="${esc(X.tplRun)}">▶</button><button class="hb" data-tpldel="${i}" title="${esc(X.tplDel)}">✕</button></span>`).join('')}</div>` : ''}
    <div class="tgh"><button class="btn small ghost" data-gh="issues">📥 ${esc(X.gh.fromIssue)}</button><span data-ghissues>${ghIssuesList.length ? `<select data-ghissue><option value="">${esc(X.gh.pick(ghIssuesList.length))}</option>${ghIssuesList.map((x, i) => `<option value="${i}">#${x.number} ${esc(x.title)}</option>`).join('')}</select>` : ''}</span>
      <span class="tgh-pr"><label>🔎 ${esc(X.gh.reviewPr)} #<input data-ghpr inputmode="numeric" size="5"></label><button class="btn small ghost" data-gh="review">${esc(X.gh.review)}</button></span></div>
    <label>${esc(X.desc)}<textarea data-tf="desc" rows="3"></textarea></label>
    <label>${esc(X.title)}<input data-tf="title" maxlength="80"></label>
    <label>${esc(X.folder)}<input data-tf="dir" list="tdirs" value="${esc(folders[0] ? folders[0][0] : '')}"><datalist id="tdirs">${folders.map(([d]) => `<option value="${esc(d)}">`).join('')}</datalist></label>
    <div class="trow"><label>${esc(X.agent)}${sel('agent', [['auto', X.auto], ['claude', 'Claude Code'], ['codex', 'Codex']], 'auto')}</label>
    <label>${esc(X.profile)}${sel('profile', [['', X.recommended], ...Object.entries(X.profiles)], '')}</label>
    <label>${esc(X.role)}${sel('role', [['', X.none], ...(taskData.roles || []).map(r => [r, X.roles[r] || r])], '')}</label>
    <label>${esc(X.prio)}${sel('priority', [['3', X.prios[3]], ['2', X.prios[2]], ['1', X.prios[1]]], '2')}</label></div>
    <div class="trow"><label>${esc(X.perm)}${sel('perm', Object.entries(X.perms), 'acceptEdits')}</label>
    <label>${esc(X.dep)}${sel('dependsOn', [['', X.none], ...taskData.tasks.filter(t => !['done', 'cancelled'].includes(t.state)).map(t => [t.id, t.title])], '')}</label>
    <label class="tchk" title="${esc(X.chainTip)}"><input type="checkbox" data-tf="chain"> ${esc(X.chain)}</label>
    <label>${esc(X.budget)}<input data-tf="budget" type="number" min="0" step="0.5" value="0"></label></div>
    <label>${esc(X.moreDirs)}<textarea data-tf="moreDirs" rows="2" placeholder="${esc(X.moreDirsPh)}"></textarea></label>
    <label>${esc(X.test)}<input data-tf="testCmd" placeholder="npm test"></label>
    <label class="tchk"><input type="checkbox" data-tf="worktree" checked> ${esc(X.wt)}</label>
    <label class="tchk"><input type="checkbox" data-tf="lean"> ${esc(X.lean)}</label>
    <p><button class="btn small ghost" data-tact="recommend">💡 ${esc(X.rec)}</button> <button class="btn" data-tact="create">➤ ${esc(X.create)}</button> <button class="btn small ghost" data-tact="saveTpl">💾 ${esc(X.tplSave)}</button></p><p class="note" id="tmsg">${esc(taskWhy)}</p></details>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-gh]'); if (!b || reportTab !== 'tasks') return;
  const X = TT(), dir = (reportEl.querySelector('[data-tf="dir"]') || {}).value || '', msg = t => { const m = document.getElementById('tmsg'); if (m) m.textContent = t; };
  const post = body => fetch('api/gh', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, reason: 'unknown' }));
  b.disabled = true; msg(X.gh.loading);
  if (b.dataset.gh === 'issues') {
    const r = await post({ op: 'issues', dir }); b.disabled = false;
    if (!r.ok) return msg('⚠ ' + (X.gh.fail[r.reason] || r.reason) + (r.detail ? ' — ' + r.detail : ''));
    ghIssuesList = r.issues; msg(r.issues.length ? '' : X.gh.noIssues);
    renderTasks(); return;
  }
  const n = (reportEl.querySelector('[data-ghpr]') || {}).value || '', agent = (reportEl.querySelector('[data-tf="agent"]') || {}).value || 'auto';
  const r = await post({ op: 'review', dir, n, agent }); b.disabled = false;
  if (!r.ok) return msg('⚠ ' + (X.gh.fail[r.reason] || r.reason) + (r.detail ? ' — ' + r.detail : ''));
  await pollTasks(); loadTask(r.task.id);
});
document.addEventListener('change', e => {
  const sel = e.target.closest('[data-ghissue]'); if (!sel) return;
  const x = ghIssuesList[Number(sel.value)]; if (!x) return;
  const set = (k, v) => { const el = reportEl.querySelector(`[data-tf="${k}"]`); if (el) el.value = v; };
  set('title', `#${x.number} ${x.title}`.slice(0, 80)); set('desc', `Resolve GitHub issue #${x.number}: ${x.title}${x.url ? ' (' + x.url + ')' : ''}\n\n${x.body}`);
});
function rowHtml(t) {
  const X = TT(), why = t.reason && ['blocked', 'failed'].includes(t.state) || t.reason === 'restart' || t.reason === 'detached' ? X.reasons[t.reason] || '' : '';
  return `<li class="trow-item st-${t.state}" data-topen="${esc(t.id)}"><span class="tdot"></span><span class="tmainc"><b>${esc(t.title)}</b>
    <small><span class="tpill st-${t.state}">${esc(X.states[t.state])}</span>${why ? ' ' + esc(why) + ' ·' : ''} ${esc(t.agent)} · ${esc(mname(t, t.model))} · ${esc(t.effort)}${t.ask ? ' · 🔐 ' + esc(t.ask.tool) : ''}</small></span>
    <span class="q-side"><b class="tcost">${t.costUnknown && !t.cost ? '?' : esc(fmtUSD(t.cost || 0)) + (t.costUnknown ? '+?' : '')}</b><small>${esc(ago(Date.now() - t.updated))}</small></span></li>`;
}
// "ready to ship?": tests, review, files, what is not committed and the branch, then commit / PR / conclude
let taskShip = null;
function shipHtml(t, c) {
  const S = TT().ship, li = (ok, txt) => `<li class="${ok === true ? 'ok' : ok === false ? 'warn' : 'note'}">${ok === true ? '✓' : ok === false ? '⚠' : '•'} ${esc(txt)}</li>`;
  if (!c.ok) return `<div class="tship"><p class="warn">⚠ ${esc(S.fail[c.reason] || c.reason || '?')}</p></div>`;
  return `<div class="tship"><b>✅ ${esc(S.title)}</b><ul>
    ${li(c.tests ? c.tests.code === 0 : null, c.tests ? (c.tests.code === 0 ? S.testsOk : S.testsBad) : S.noTests)}
    ${li(c.review ? (c.review.pending ? null : c.review.ok) : null, c.review ? (c.review.pending ? S.reviewRunning : c.review.ok ? S.reviewOk : S.reviewBad) : S.noReview)}
    ${li(null, S.files(c.files))}
    ${li(c.dirtyCount === 0, c.dirtyCount ? S.dirty(c.dirtyCount) + ': ' + c.dirty.slice(0, 8).join(', ') + (c.dirtyCount > 8 ? '…' : '') : S.clean)}
    ${c.branch ? li(null, S.branch(c.branch, c.ahead)) : ''}
    ${(c.secrets || []).length ? `<li class="bad">⛔ ${esc(S.secrets(c.secrets.length))}<ul class="tsecrets">${c.secrets.map(x => `<li><code>${esc(x.file)}${x.line ? ':' + x.line : ''}</code> — ${esc(S.secretKind[x.kind] || x.kind)}</li>`).join('')}</ul></li>` : li(true, S.noSecrets)}</ul>
    ${c.dirtyCount ? `<label>${esc(S.msg)}<textarea data-ship-msg rows="2">${esc(c.suggest || t.title)}</textarea></label>${(c.secrets || []).length ? `<label class="tchk"><input type="checkbox" data-ship-force> ${esc(S.force)}</label>` : ''}<p><button class="btn small" data-tact="shipCommit">⎇ ${esc(S.commit)}</button></p>` : ''}
    ${c.canPr ? `<p><button class="btn small" data-tact="shipPr">⇪ ${esc(S.pr)}</button> <small class="note">${esc(S.prNote)}</small></p>` : `<p class="note">${esc(c.gh ? S.noPrBranch : S.noPrGh)}</p>`}
    <p><button class="btn" data-tact="conclude">✔ ${esc(S.conclude)}</button> <button class="btn small ghost" data-tact="shipClose">${esc(S.close)}</button></p><p class="note" id="tship-msg"></p></div>`;
}
const shipApi = body => fetch('api/task-ship', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, reason: 'unknown' }));
function renderTasks() {
  const X = TT(), body = reportEl.querySelector('.report-body');
  if (taskSel && taskDetail) return renderTaskDetail(body);
  const draft = reportEl.querySelector('.tform') ? tfVal() : null; // what was typed survives the refresh
  renderTaskList(X, body);
  if (draft) for (const [k, v] of Object.entries(draft)) { const el = reportEl.querySelector(`[data-tf="${k}"]`); if (el) { if (el.type === 'checkbox') el.checked = v; else el.value = v; } }
}
function renderTaskList(X, body) {
  const order = ['blocked', 'running', 'pending', 'failed', 'done', 'cancelled'], list = taskData.tasks.slice().sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || b.priority - a.priority || b.updated - a.updated);
  const kindL = { task: X.kinds.task, session: X.kinds.session, today: X.kinds.today, month: X.kinds.month };
  body.innerHTML = tabsHtml() + `<p class="sub">${esc(X.sub)}</p>${taskData.privacy ? `<p class="note">🔒 ${esc(X.privateNote)}</p>` : ''}${taskData.dayStopped ? `<div class="talert">⏸ ${esc(X.dayStopped(fmtUSD(taskData.spentToday || 0), fmtUSD(taskData.settings.dayBudget || 0)))}</div>` : ''}` + formHtml() + settingsHtml()
    + `<div class="trow"><label style="flex:2">🔎 <input data-tsearch placeholder="${esc(X.search)}"></label></div>`
    + (taskSaid.length ? `<h4 class="tsaid-h">💬 ${esc(X.saidTitle(taskSaid.length))}</h4><ul class="queue tsaid">${taskSaid.map(r => { const live = data && data.people.some(p => p.id === r.id); return `<li ${live ? `data-tperson="${esc(r.id)}"` : ''}><span><small>${esc(r.agent)} · ${esc(r.role === 'user' ? X.saidYou : X.saidAgent)} · ${esc(ago(Date.now() - r.at))}${live ? ' · ' + esc(X.saidLive) : ''}</small><br>${esc(r.snippet)}</span></li>`; }).join('')}</ul>` : '')
    + (taskSearch.length ? `<ul class="queue">${taskSearch.map(r => `<li ${r.kind === 'task' ? `data-topen="${esc(r.id)}"` : r.live ? `data-tperson="${esc(r.id)}"` : ''}><b>${esc(r.title)}</b> <small>${esc(kindL[r.kind] || r.kind)} · ${esc(r.agent || '')}${r.state ? ' · ' + esc(X.states[r.state] || T.states[r.state] || r.state) : ''}</small></li>`).join('')}</ul>` : '')
    + (list.length ? [['need', ['blocked', 'failed']], ['active', ['running', 'pending']], ['done', ['done', 'cancelled']]].map(([g, sts]) => {
      const items = list.filter(t => sts.includes(t.state)); if (!items.length) return '';
      const ul = `<ul class="queue tlist">${items.map(rowHtml).join('')}</ul>`;
      return g === 'done' ? `<details class="tgroup"><summary><h4>${esc(X.groups[g])} <small>${items.length}</small></h4></summary>${ul}</details>` : `<div class="tgroup"><h4>${esc(X.groups[g])} <small>${items.length}</small></h4>${ul}</div>`;
    }).join('') : `<p class="note">${esc(X.empty)}</p>`) + rankingHtml() + compareHtml();
}
function renderTaskDetail(body) {
  const X = TT(), t = taskDetail, ev = t.events || [], live = t.state === 'running';
  const evHtml = ev.slice(-60).reverse().map(e => {
    const txt = e.kind === 'compacted' ? (e.pre ? `${fmtK(e.pre)} → ${fmtK(e.post)} tokens` : '') : e.kind === 'ask' || e.kind === 'permit' ? `${e.tool}${e.text ? ': ' + e.text : ''}${e.kind === 'permit' ? ' — ' + (e.allow ? (e.always ? X.permAlways(e.tool) : X.permAllow) : X.permDeny) : ''}` : e.kind === 'warn' ? warnText(e) : e.kind === 'config' ? `${mname(t, e.from.model)}/${e.from.effort} → ${mname(t, e.to.model)}/${e.to.effort} (${e.applies === 'next' ? X.next : X.now}; ${e.why})` : e.kind === 'applied' ? X.appliedOk(mname(t, e.to.model), e.to.effort) : e.kind === 'test' ? X.tests(e.code) + '\n' + (e.text || '') : e.kind === 'tool' ? `${e.name} ${e.text || ''}` : e.kind === 'state' ? `${X.states[e.state] || e.state}${e.reason ? ' · ' + (X.reasons[e.reason] || e.reason) : ''}` : e.kind === 'start' ? `${mname(t, e.model)} · ${e.effort} · #${e.attempt}${e.resume ? ' · ' + X.resumed : ''}` : e.text || '';
    return `<li class="ev-${esc(e.kind)}"><small>${esc(new Date(e.at).toLocaleTimeString())} · ${esc(X.ev[e.kind] || e.kind)}</small>${txt ? `<pre>${esc(String(txt).slice(0, 1500))}</pre>` : ''}</li>`;
  }).join('');
  const models = Object.entries(t.byModel || {}), st = t.state;
  const btn = (show, a, label, cls = 'ghost', title = '') => show ? `<button class="btn small ${cls}" data-tact="${a}"${title ? ` title="${esc(title)}"` : ''}>${label}</button>` : '';
  body.innerHTML = tabsHtml() + `<div class="tdhead"><button class="tback" data-tact="back">${esc(X.back)}</button>
    <div class="tdtitle"><h2>${esc(t.title)}</h2><span class="tpill big st-${st}">${esc(X.states[st])}${t.reason ? ' · ' + esc(X.reasons[t.reason] || t.reason) : ''}</span></div>
    <p class="tdmeta">${esc(t.agent)}${t.role ? ' · ' + esc(X.roles[t.role] || t.role) : ''}${t.lean ? ' · ' + esc(X.leanOn) : ''} · <code>${esc(t.cwd)}</code>${t.sessionId ? ' · ' + esc(t.sessionId.slice(0, 8)) : ''} · ${esc(X.attempts(t.attempts))}${t.subagents ? ' · ' + esc(X.subagents(t.subagents)) : ''}</p></div>
    ${askPermHtml(t)}
    ${t.warn ? `<div class="talert">⚠ ${esc(warnText(t.warn))}${t.warn.rec ? ` <button class="btn small" data-tact="applyWarn">${esc(T.notices.apply)}: ${esc(X.profiles[t.warn.rec.profile])}</button>` : ''}</div>` : ''}
    ${t.denials && t.denials.length ? `<div class="talert"><b>${esc(X.denied)}:</b> ${t.denials.map(d => `<code>${esc(d.tool)}</code> <small>${esc(d.what)}</small>`).join(', ')} <button class="btn small" data-tact="approve">✔ ${esc(X.approve)}</button></div>` : ''}
    <div class="tdgrid"><div class="tdmain">
      ${t.result ? `<section class="tsec"><h4>${esc(X.resultTitle)}</h4><pre class="tresult">${esc(t.result)}</pre>${t.tests ? `<p class="${t.tests.code === 0 ? 'ok' : 'warn'}">${esc(X.tests(t.tests.code))}</p>` : ''}</section>`
        : `<section class="tsec"><p class="note">${esc(st === 'running' ? X.workingNow : st === 'pending' ? X.queuedNow : X.noResult)}</p></section>`}
      ${taskShip && taskShip.id === t.id ? shipHtml(t, taskShip) : ''}
      ${t.review ? `<div class="treview"><b>🔎 ${esc(X.reviewTitle)}</b> · <a href="#" data-popen="${esc(t.review.id)}">${esc(X.openTask)}</a>${t.review.text ? `<pre>${esc(t.review.text)}</pre>` : `<p class="note">${esc(X.reviewRunning)}</p>`}</div>` : ''}
      ${t.reviewOf ? `<p class="note">🔎 ${esc(X.reviewOfNote)} · <a href="#" data-popen="${esc(t.reviewOf)}">${esc(X.openTask)}</a></p>` : ''}
      ${t.pr && /^https:\/\//.test(t.pr) ? `<p>🔗 PR: <a href="${esc(t.pr)}" target="_blank" rel="noopener noreferrer">${esc(t.pr)}</a></p>` : ''}
      ${t.files && t.files.length ? `<section class="tsec"><h4>${esc(X.files)} <small>${t.files.length}</small></h4><p class="tfiles">${t.files.slice(0, 30).map(f => `<code>${esc(f)}</code>`).join(' ')}</p>${btn(['blocked', 'failed', 'done'].includes(st) && !taskData.privacy, 'diff', esc(X.diff))}</section>` : ''}
      ${taskDiff ? taskDiff.ok ? `<pre class="tdiff">${esc(taskDiff.base ? X.since(taskDiff.base.slice(0, 8)) + '\n' : '')}${esc(taskDiff.stat)}${taskDiff.untracked && taskDiff.untracked.length ? '\n' + esc(X.newFiles) + ': ' + esc(taskDiff.untracked.join(', ')) : ''}\n\n${esc(taskDiff.diff)}</pre>` : `<p class="note">${esc(X.fail[taskDiff.reason] || X.fail.state)}</p>` : ''}
      ${['blocked', 'failed'].includes(st) ? `<section class="tsec treply"><h4>${esc(X.replyTitle)}</h4><textarea data-treply rows="3" placeholder="${esc(X.reply)}"></textarea><p><button class="btn small" data-tact="reply">➤ ${esc(X.send)}</button></p></section>` : ''}
    </div><aside class="tdside">
      <section class="tsec"><h4>${esc(X.costTitle)}</h4><div class="tbig"><div>${costHtml(t)}</div><div><b>${fmtK(t.tokens.output)}</b><small>out</small></div><div><b>${fmtK(t.tokens.input + t.tokens.cacheWrite)}</b><small>in</small></div><div><b>${fmtK(t.tokens.cacheRead)}</b><small>cache</small></div></div>
        ${models.length ? `<p class="note">${models.map(([m, v]) => `${esc(m)}: ${v.unpriced ? '?' : esc(fmtUSD(v.usd))}`).join(' · ')}</p>` : ''}</section>
      <section class="tsec"><h4>${esc(X.cfgTitle)}</h4>${cfgHtml(t)}${recCardHtml(t)}${ctlHtml(t, 't')}<label class="tchk"><input type="checkbox" data-tcfg="lean" ${t.lean ? 'checked' : ''}> ${esc(X.lean)}</label></section>
    </aside></div>
    <div class="tdactions">
      ${st === 'blocked' ? `<button class="btn" data-tact="checkShip">✔ ${esc(X.conclude)}…</button>` : ''}
      ${btn(['failed', 'cancelled', 'blocked'].includes(st), 'retry', '↻ ' + esc(X.retry))}
      ${btn(['failed', 'blocked'].includes(st) && t.sessionId, 'compact', '⤓ ' + esc(X.compactNow), 'ghost', X.compactTip)}
      ${btn(['failed', 'blocked'].includes(st), 'fresh', '✦ ' + esc(X.fresh), 'ghost', X.freshTip)}
      ${btn(['blocked', 'failed', 'done'].includes(st), 'handoff', '↪ ' + esc(X.handoff))}
      <span class="tdspacer"></span>
      ${btn(['running', 'pending', 'blocked'].includes(st), 'cancel', '✖ ' + esc(X.cancel), 'danger')}
      ${btn(!live, 'delete', '🗑 ' + esc(X.del), 'ghost danger')}
    </div><p class="note" id="tmsg"></p>
    <details class="tsec tlog"><summary><h4>${esc(X.events)} <small>${ev.length}</small></h4></summary>
      ${t.configLog && t.configLog.length ? `<p class="note"><b>${esc(X.configLog)}:</b> ${t.configLog.slice(-8).map(c => `${esc(new Date(c.at).toLocaleTimeString())} ${esc(mname(t, c.from.model))}/${esc(c.from.effort)} → ${esc(mname(t, c.to.model))}/${esc(c.to.effort)} (${esc(c.why)})`).join(' · ')}</p>` : ''}
      <ul class="tevents">${evHtml}</ul></details>`;
}
const tfVal = () => { const o = {}; reportEl.querySelectorAll('[data-tf]').forEach(el => { o[el.dataset.tf] = el.type === 'checkbox' ? el.checked : el.value; }); return o; };
const tFail = r => (TT().fail[r.reason] || TT().fail.state);
reportEl.addEventListener('click', async e => {
  if (reportTab !== 'tasks') return;
  const tp = e.target.closest('[data-tpl],[data-tplrun],[data-tpldel]');
  if (tp) {
    const i = Number(tp.dataset.tpl ?? tp.dataset.tplrun ?? tp.dataset.tpldel), x = (taskData.settings.templates || [])[i]; if (!x) return;
    if (tp.dataset.tpldel !== undefined) { if (!confirm(TT().tplDelSure(x.name))) return; await api('api/tasks', { op: 'untemplate', name: x.name }); await pollTasks(); return renderTasks(); }
    if (tp.dataset.tplrun !== undefined) { const { name, ...v } = x; const r = await api('api/tasks', { op: 'create', ...v, title: name }); if (!r.ok) { const m = document.getElementById('tmsg'); if (m) m.textContent = tFail(r); return; } achBump('launches'); await pollTasks(); return loadTask(r.task.id); }
    for (const [k, v] of Object.entries(x)) { const el = reportEl.querySelector(`[data-tf="${k}"]`); if (el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v; } }
    const ti = reportEl.querySelector('[data-tf="title"]'); if (ti && !ti.value) ti.value = x.name; return;
  }
  const per = e.target.closest('[data-tperiod]'); if (per) { taskPeriod = per.dataset.tperiod; return renderTasks(); }
  const op1 = e.target.closest('[data-topen]'); if (op1) { taskDiff = null; return loadTask(op1.dataset.topen); }
  const pp = e.target.closest('[data-tperson]'); if (pp) { closeReport(); selected = pp.dataset.tperson; return renderPanel(); }
  const b = e.target.closest('[data-tact]'); if (!b) return;
  const act = b.dataset.tact, X = TT(), msg = t => { const m = document.getElementById('tmsg'); if (m) m.textContent = t; };
  if (act === 'recommend') { const v = tfVal(), r = await api('api/tasks', { op: 'recommend', desc: v.desc, agent: v.agent === 'auto' ? 'claude' : v.agent }); if (r.ok) { reportEl.querySelector('[data-tf="profile"]').value = r.rec.profile; taskWhy = `${X.recFor(X.profiles[r.rec.profile], r.rec.model || X.cliDefault, r.rec.effort)} — ${r.rec.why.map(w => X.recWhy[w] || w).join(' · ')}${r.rec.similar ? ' · ' + X.similar(r.rec.similar) : ''}`; msg(taskWhy); } return; }
  if (act === 'saveTpl') { const v = tfVal(); if (!v.desc.trim()) return msg(X.fail.nodesc); const name = (prompt(X.tplName, v.title || v.desc.split('\n')[0].slice(0, 40)) || '').trim(); if (!name) return; const r = await api('api/tasks', { op: 'template', name, ...v }); if (!r.ok) return msg(tFail(r)); await pollTasks(); renderTasks(); return msg(X.tplSaved(name)); }
  if (act === 'create') {
    const { moreDirs = '', ...v } = tfVal(), extra = [...new Set(moreDirs.split('\n').map(x => x.trim()).filter(x => x && x !== v.dir))].slice(0, 20);
    const r = await api('api/tasks', { op: 'create', ...v }); if (!r.ok) return msg(tFail(r));
    // the same request in other folders: one task each, every folder checked by the server
    const fails = []; for (const dir of extra) { const r2 = await api('api/tasks', { op: 'create', ...v, dir }); if (!r2.ok) fails.push(dir + ' (' + tFail(r2) + ')'); }
    taskWhy = ''; achBump('launches'); await pollTasks();
    if (extra.length) { taskSel = ''; taskWhy = X.batchDone(extra.length + 1 - fails.length) + (fails.length ? ' ' + X.batchFail(fails.join(', ')) : ''); for (const k of ['desc', 'title', 'moreDirs']) { const el = reportEl.querySelector(`[data-tf="${k}"]`); if (el) el.value = ''; } renderTasks(); return; }
    return loadTask(r.task.id);
  }
  if (act === 'back') { taskSel = ''; taskDetail = null; taskDiff = null; return renderTasks(); }
  const id = taskSel; if (!id) return;
  if (act === 'checkShip') { taskShip = { id, ...(await shipApi({ op: 'check', id })) }; return loadTask(id); }
  if (act === 'shipClose') { taskShip = null; return renderTasks(); }
  if (act === 'conclude') taskShip = null;
  if (act === 'shipCommit' || act === 'shipPr') {
    const S = X.ship, m = document.getElementById('tship-msg'), mb = reportEl.querySelector('[data-ship-msg]');
    b.disabled = true; if (m) m.textContent = S.working;
    const fc = reportEl.querySelector('[data-ship-force]'), r = await shipApi({ op: act === 'shipCommit' ? 'commit' : 'pr', id, message: mb ? mb.value : '', force: !!(fc && fc.checked) }); b.disabled = false;
    if (!r.ok) { if (m) m.textContent = '⚠ ' + (S.fail[r.reason] || r.reason) + (r.detail ? ' — ' + r.detail : ''); return; }
    taskShip = { id, ...(await shipApi({ op: 'check', id })) }; await loadTask(id);
    const m2 = document.getElementById('tship-msg'); if (m2) m2.textContent = '✓ ' + (r.sha ? S.committed(r.sha) : S.prDone);
    return;
  }
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
  clearTimeout(tSearchT); tSearchT = setTimeout(async () => { const v = q.value.trim(); taskSearch = v.length > 1 ? await api('api/search?q=' + encodeURIComponent(v)) : []; if (!Array.isArray(taskSearch)) taskSearch = []; const sd = v.length > 2 ? await api('api/said?q=' + encodeURIComponent(v)) : []; taskSaid = Array.isArray(sd) ? sd : []; const typed = q.value; renderTasks(); const n = reportEl.querySelector('[data-tsearch]'); n.value = typed; n.focus(); }, 300);
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
    <span class="q-side">${n.ref.ask && (taskData.tasks.find(x => x.id === n.ref.task) || {}).ask ? `<button class="btn small" data-nact="allow" data-n="${i}">${esc(T.tasks.permAllow)}</button><button class="btn small" data-nact="deny" data-n="${i}">${esc(T.tasks.permDeny)}</button>` : ''}${n.ref.rec ? `<button class="btn small" data-nact="apply" data-n="${i}" title="${esc(T.tasks.profiles[n.ref.rec.profile] + ' · ' + (n.ref.rec.model || T.tasks.cliDefault) + ' · ' + n.ref.rec.effort)}">${esc(N.apply)}</button><button class="btn small" data-nact="why" data-n="${i}">${esc(N.why)}</button>` : ''}${n.ref.task || n.ref.agent || n.ref.ver || n.ref.tab ? `<button class="btn small" data-nact="open" data-n="${i}">${esc(N.open)}</button>` : ''}<button class="btn small" data-nact="dismiss" data-n="${i}">${esc(N.notNow)}</button></span></li>`).join('')}</ul>` : `<p class="note">${esc(N.empty)}</p>`);
}
reportEl.addEventListener('click', async e => {
  if (reportTab !== 'notices') return;
  if (e.target.closest('[data-nall]')) { notices.forEach(n => { n.read = true; }); saveNotices(); return renderNotices(); }
  const b = e.target.closest('[data-nact]'); if (!b) return;
  const n = notices[Number(b.dataset.n)]; if (!n) return; const a = b.dataset.nact;
  n.read = true;
  if (a === 'why') n.showWhy = true;
  if (a === 'dismiss') notices = notices.filter(x => x !== n);
  if (a === 'allow' || a === 'deny') { await permit(n.ref.task, a === 'allow', false); return renderNotices(); }
  if (a === 'apply' && n.ref.ext && n.ref.rec) {
    const p = data.people.find(x => x.id === n.ref.agent);
    if (p && canSwitch(p)) { const r = await switchTo(p, n.ref.rec); n.body = (r.ok ? '✓ ' + T.tasks.switchOk : '⚠ ' + (T.tasks.switchFail[r.reason] || r.reason)) + ' — ' + n.body; n.showWhy = true; saveNotices(); return renderNotices(); }
    // not in a terminal (VS Code, the app): the choice goes into its request box, used on the next request sent from here
    askDraft.set(n.ref.agent, { ...(askDraft.get(n.ref.agent) || {}), model: n.ref.rec.model, effort: n.ref.rec.effort }); saveNotices();
    closeReport(); selected = n.ref.agent; renderOverlay(); renderPanel();
    const box = panelBody.querySelector('.pask'); if (box) { box.scrollIntoView({ block: 'center' }); box.querySelector('textarea').focus(); }
    return;
  }
  if (a === 'apply' && n.ref.task && n.ref.rec) { const w = n.ref.rec; await api('api/tasks', { op: 'config', id: n.ref.task, profile: w.profile, model: w.model, effort: w.effort, why: 'notice:' + w.why }); } // exactly what the notice proposed
  saveNotices();
  if (a === 'open' || a === 'apply') { if (n.ref.task) { reportTab = 'tasks'; await pollTasks(); return loadTask(n.ref.task); } if (n.ref.ver) { reportTab = 'version'; return renderReport(); } if (n.ref.tab) { reportTab = n.ref.tab; return renderReport(); } if (n.ref.agent) { closeReport(); return openTalk(n.ref.agent); } }
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


// ---- office objects for the panels: task board (whiteboard), costs screen, notice board, history and releases posters ----
const tcount = st => taskData.tasks.filter(t => t.state === st).length;
function taskBoardTip() { const O = T.officeObj; return O.tasks(tcount('pending'), tcount('running'), tcount('blocked'), tcount('done')); }
function officeTips() {
  const O = T.officeObj, days = (usageData && usageData.days) || {}, k = new Date().toISOString().slice(0, 10);
  const week = Object.entries(days).filter(([d]) => new Date(d + 'T12:00').getTime() >= Date.now() - 7 * 864e5).reduce((n, [, d]) => n + (d.usd || 0), 0);
  const v = verData || {};
  return { tasks: taskBoardTip(), costs: O.costs(fmtUSD((days[k] && days[k].usd) || 0), fmtUSD(week)), notices: O.notices(unreadNotices()), history: O.history, releases: O.releases(v.current || '?', v.newer ? v.latest : '') };
}
function drawTaskBoard(x, y, w, h, t) { // whiteboard with four columns of sticky notes, one per task
  r(x - 1, y - 1, w + 2, h + 2, PAL.ink); r(x, y, w, h, '#f4f4f8'); r(x, y + h - 2, w, 2, '#c0cbdc');
  r(x + 2, y + h, w - 4, 2, PAL.aluDark); r(x + 6, y + h, 4, 1, PAL.red); r(x + 12, y + h, 4, 1, PAL.blue);
  const cols = [['pending', '#c0cbdc'], ['running', '#7ab8ff'], ['blocked', '#ffd84d'], ['done', '#9fe3a0']], cw = Math.floor((w - 4) / 4);
  cols.forEach(([st, c], i) => {
    const cx = x + 2 + i * cw; r(cx, y + 2, cw - 2, 1, c === '#c0cbdc' ? '#8b9bb4' : c); if (i) r(cx - 1, y + 2, 1, h - 6, '#dde3ee');
    const n = Math.min(8, tcount(st));
    for (let k = 0; k < n; k++) { const sx = cx + (k % 2) * 6, sy = y + 5 + ((k / 2) | 0) * 5; r(sx, sy, 5, 4, c); r(sx + 1, sy + 1, 3, 1, '#8a7a6a'); }
    if (st === 'running' && n && ((t / 400) | 0) % 2) r(cx + 1, y + 5, 1, 1, '#ffffff');
  });
  if (!taskData.tasks.length) { r(x + w / 2 - 3, y + h / 2 - 1, 6, 2, '#c0cbdc'); r(x + w / 2 - 1, y + h / 2 - 3, 2, 6, '#c0cbdc'); }
}
function drawCostScreen(x, y, w, h, t) { // wall screen: estimated spend of the last 7 days and today
  r(x - 1, y - 1, w + 2, h + 2, PAL.ink); r(x, y, w, h, '#0c1410'); r(x + 1, y + 1, w - 2, 1, '#18261d');
  const days = (usageData && usageData.days) || {}, vals = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); vals.push((days[d] && days[d].usd) || 0); }
  const max = Math.max(1e-9, ...vals);
  vals.forEach((v, i) => { const bh = Math.max(1, Math.round((h - 13) * v / max)); r(x + 3 + i * 6, y + h - 3 - bh, 4, bh, i === 6 ? '#3ddc84' : '#1f7a48'); });
  const today = vals[6], label = '$' + (today >= 100 ? Math.round(today) : today >= 10 ? today.toFixed(0) : today.toFixed(1));
  pixText(x + w - 3 - label.length * 4, y + 3, label, '#3ddc84');
  if (((t / 500) | 0) % 2) r(x + 3, y + 3, 2, 2, '#3ddc84');
}
function drawNoticeCork(x, y, w, h, t) { // cork board: one paper per unread notice, the bell pinned in the corner
  r(x - 1, y - 1, w + 2, h + 2, '#6b4a33'); r(x, y, w, h, '#c98f5a');
  for (let k = 0; k < 24; k++) { const hh = Art.hash('nc' + k); r(x + hh % w, y + (hh >>> 8) % h, 1, 1, '#b97c48'); }
  r(x + 3, y + 3, 7, 6, '#feae34'); r(x + 5, y + 2, 3, 1, '#feae34'); r(x + 5, y + 9, 3, 1, PAL.ink);
  const un = notices.filter(n => !n.read).slice(0, 6);
  un.forEach((n, i) => { const px = x + 13 + (i % 3) * 11, py = y + 3 + ((i / 3) | 0) * 13; r(px, py, 9, 10, n.kind === 'warn' ? '#ffd0d0' : '#ffffff'); r(px + 3, py - 1, 3, 2, n.kind === 'warn' ? '#e43b44' : '#3b5dc9'); r(px + 1, py + 3, 6, 1, '#8a7a6a'); r(px + 1, py + 6, 4, 1, '#8a7a6a'); });
  if (!un.length) { r(x + 16, y + 10, 20, 12, '#f4ecd8'); r(x + 18, y + 14, 14, 1, '#c0b090'); r(x + 18, y + 17, 10, 1, '#c0b090'); }
  else if (((t / 450) | 0) % 2) r(x + 9, y + 2, 2, 2, '#e43b44');
}
function drawReleaseBadge(x, y, t) { // the rocket poster gets a star when a newer version is out
  const v = verData || {}; if (!v.newer) return;
  const on = ((t / 400) | 0) % 2; r(x + 14, y - 3, 7, 7, PAL.ink); r(x + 15, y - 2, 5, 5, on ? '#feae34' : '#e43b44');
}
// the same panels in the ☰ menu
{
  const menu = document.getElementById('tools-menu');
  if (menu) for (const [tab, icon] of [['tv', '📺'], ['phone', '📱'], ['broadcast', '📣'], ['repos', '📦'], ['tasks', '📋'], ['usage', '💲'], ['feed', '🗂'], ['notices', '🔔'], ['version', '🚀']]) {
    const b = document.createElement('button'); b.className = 'icon-btn menu-panel'; b.dataset.menuTab = tab;
    b.innerHTML = `<span aria-hidden="true">${icon}</span><span class="ml"></span>`; menu.prepend(b);
    b.addEventListener('click', () => { if (typeof setMenu === 'function') setMenu(false); if (tab === 'tv') return setTv(true); openReport(tab); });
  }
}
// repositories at a glance: who is in each one now, what is not committed or pushed, task branches and PRs, today's activity
// one message to several agents: typed into the ones waiting in a terminal, sent in the background to the others
let bcPick = new Set(), bcOut = {};
function bcRoute(p) {
  const busy = !['idle', 'asleep'].includes(p.state);
  if (typeof canType === 'function' && canType() && p.pid && !['claude-desktop', 'claude-vscode', 'codex-vscode', 'codex-desktop'].includes(p.entrypoint)) return busy ? 'busy' : 'terminal';
  return canAsk(p) && !taskOfPerson(p.id) ? (busy ? 'busy' : 'background') : 'none';
}
function renderBroadcast() {
  const B = T.bcast, body = reportEl.querySelector('.report-body'), list = ((data && data.people) || []).filter(p => ['claude', 'codex'].includes(p.agent) && !p.leaving);
  const draft = (reportEl.querySelector('[data-bc-text]') || {}).value || '';
  body.innerHTML = tabsHtml() + `<h3>📣 ${esc(B.title)}</h3><p class="sub">${esc(B.sub)}</p>
    <div class="tsec"><p><button class="btn small ghost" data-bc-all>${esc(B.all)}</button> <button class="btn small ghost" data-bc-none>${esc(B.none)}</button></p>
    <ul class="bclist">${list.map(p => { const r = bcRoute(p), can = r === 'terminal' || r === 'background'; return `<li><label class="tchk"><input type="checkbox" data-bc="${esc(p.id)}" ${can ? '' : 'disabled'} ${can && bcPick.has(p.id) ? 'checked' : ''}> <b>${esc(p.name)}</b> <small class="note">${esc(p.agent)} · ${esc(T.states[p.state] || p.state)}${p.title ? ' · ' + esc(p.title) : ''}</small></label> <span class="tpill ${r === 'terminal' ? 'st-running' : r === 'background' ? 'st-done' : 'st-pending'}">${esc(B.route[r])}</span>${bcOut[p.id] ? ` <small>${esc(bcOut[p.id])}</small>` : ''}</li>`; }).join('') || `<li class="note">${esc(B.empty)}</li>`}</ul></div>
    <div class="tsec"><textarea data-bc-text rows="3" maxlength="4000" placeholder="${esc(B.ph)}">${esc(draft)}</textarea><p><button class="btn" data-bc-send>➤ ${esc(B.send(bcPick.size))}</button></p><p class="note">${esc(B.note)}</p></div>`;
}
document.addEventListener('change', e => { const c = e.target.closest('[data-bc]'); if (!c) return; if (c.checked) bcPick.add(c.dataset.bc); else bcPick.delete(c.dataset.bc); renderBroadcast(); });
document.addEventListener('click', async e => {
  if (reportTab !== 'broadcast') return;
  if (e.target.closest('[data-bc-all]')) { for (const p of data.people) if (['terminal', 'background'].includes(bcRoute(p)) && ['claude', 'codex'].includes(p.agent)) bcPick.add(p.id); return renderBroadcast(); }
  if (e.target.closest('[data-bc-none]')) { bcPick.clear(); return renderBroadcast(); }
  const b = e.target.closest('[data-bc-send]'); if (!b) return;
  const text = (reportEl.querySelector('[data-bc-text]') || {}).value.trim(); if (!text || !bcPick.size) return;
  b.disabled = true; bcOut = {};
  for (const id of bcPick) {
    const p = data.people.find(x => x.id === id), r = p ? bcRoute(p) : 'none'; let out = { ok: false, reason: 'gone' };
    if (r === 'terminal') out = await fetch('api/reply', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id, text }) }).then(x => x.json()).catch(() => ({ ok: false, reason: 'unknown' }));
    else if (r === 'background') out = await api('api/tasks', { op: 'create', resume: p.id, dir: p.cwd, agent: p.agent, desc: text, title: (p.title || p.name).slice(0, 70) });
    else out = { ok: false, reason: r };
    bcOut[id] = out.ok ? '✓ ' + T.bcast.sent : '⚠ ' + (T.bcast.fail[out.reason] || out.reason || '?');
  }
  const ta = reportEl.querySelector('[data-bc-text]'); if (ta) ta.value = ''; bcPick.clear(); if (typeof pollTasks === 'function') await pollTasks(); renderBroadcast();
});
document.addEventListener('click', e => { const pp = reportTab === 'repos' && e.target.closest('[data-tperson]'); if (!pp) return; e.preventDefault(); closeReport(); selected = pp.dataset.tperson; renderOverlay(); renderPanel(); });
function renderRepos() {
  const R = T.repos, body = reportEl.querySelector('.report-body'), repos = new Map();
  const get = name => repos.get(name) || repos.set(name, { name, path: '', people: [], trees: new Map(), tasks: [], today: null }).get(name);
  for (const p of (data && data.people) || []) {
    if (!p.repo) continue; const r = get(p.repo.name); r.path = r.path || p.repo.path; r.people.push(p);
    if (p.git) r.trees.set(p.repo.worktree, { branch: p.branch, ...p.git, wt: p.repo.isWorktree });
  }
  for (const t of taskData.tasks || []) { const r = [...repos.values()].find(x => x.path && (t.dir === x.path || String(t.dir).startsWith(x.path + '/'))); if (r) r.tasks.push(t); }
  for (const x of (todayData && todayData.rows) || []) if (x.repo && repos.has(x.repo)) { const r = repos.get(x.repo); r.today = r.today || { sessions: 0, ms: 0 }; r.today.sessions++; r.today.ms += x.activeMs; }
  const hrs = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${(m / 60) | 0}h${String(m % 60).padStart(2, '0')}` : `${m}min`; };
  const list = [...repos.values()].sort((a, b) => b.people.length - a.people.length || a.name.localeCompare(b.name));
  body.innerHTML = tabsHtml() + `<h3>📦 ${esc(R.title)}</h3><p class="sub">${esc(R.sub)}</p>` + (list.length ? `<div class="repos">${list.map(r => {
    const trees = [...r.trees.values()], dirty = trees.reduce((n, g) => n + (g.dirty || 0), 0), ahead = trees.reduce((n, g) => n + (g.ahead || 0), 0), behind = trees.reduce((n, g) => n + (g.behind || 0), 0);
    const open = r.tasks.filter(t => !['done', 'cancelled'].includes(t.state)), prs = r.tasks.filter(t => t.pr && /^https:\/\//.test(t.pr));
    return `<section class="tsec repo"><h4 class="repo-name">${esc(r.name)}</h4>
      <p class="repo-badges">${dirty ? `<span class="tpill st-blocked">${esc(R.dirty(dirty))}</span>` : `<span class="tpill st-done">${esc(R.clean)}</span>`}${ahead ? ` <span class="tpill st-running">↑ ${esc(R.ahead(ahead))}</span>` : ''}${behind ? ` <span class="tpill st-pending">↓ ${esc(R.behind(behind))}</span>` : ''}${r.today ? ` <small class="note">${esc(R.today(r.today.sessions, hrs(r.today.ms)))}</small>` : ''}</p>
      <p><b>${esc(R.now)}:</b> ${r.people.map(p => `<a href="#" data-tperson="${esc(p.id)}">${esc(p.name)}</a> <small class="note">(${esc(T.states[p.state] || p.state)}${p.branch ? ' · ' + esc(p.branch) : ''})</small>`).join(', ')}</p>
      ${trees.length > 1 ? `<p class="note">${esc(R.trees(trees.length))}: ${trees.map(g => `${esc(g.branch || '?')}${g.dirty ? ' ✎' + g.dirty : ''}${g.ahead ? ' ↑' + g.ahead : ''}`).join(' · ')}</p>` : ''}
      ${open.length ? `<p><b>${esc(R.tasks)}:</b> ${open.map(t => `<a href="#" data-popen="${esc(t.id)}">${esc(t.title)}</a> <span class="tpill st-${esc(t.state)}">${esc(T.tasks.states[t.state])}</span>`).join(' ')}</p>` : ''}
      ${prs.length ? `<p><b>PRs:</b> ${prs.map(t => `<a href="${esc(t.pr)}" target="_blank" rel="noopener noreferrer">${esc(t.pr.replace(/^https:\/\/github\.com\//, ''))}</a>`).join(' · ')}</p>` : ''}
      ${r.path && !taskData.privacy ? `<p class="rbudget"><label>💲 ${esc(R.budget)} <input type="number" min="0" step="1" value="${Number((taskData.settings.repoBudgets || {})[r.path]) || ''}" placeholder="0" data-repobudget="${esc(r.path)}"></label></p>` : ''}
      ${r.path && !taskData.privacy ? `<details class="rnote" ${(taskData.settings.repoNotes || {})[r.path] ? 'open' : ''}><summary>📌 ${esc(R.note)}${(taskData.settings.repoNotes || {})[r.path] ? ' ✓' : ''}</summary><textarea data-reponote="${esc(r.path)}" rows="3" maxlength="2000" placeholder="${esc(R.notePh)}">${esc((taskData.settings.repoNotes || {})[r.path] || '')}</textarea><p><button class="btn small" data-reponotesave="${esc(r.path)}">${esc(R.noteSave)}</button> <small class="note">${esc(R.noteHint)}</small></p></details>` : ''}</section>`;
  }).join('')}</div>` : `<p class="note">${esc(R.none)}</p>`);
  body.insertAdjacentHTML('beforeend', hotHtml() + cleanHtml());
  if (!hotData && !taskData.privacy) { hotData = []; api('api/hotfiles').then(r => { hotData = Array.isArray(r) ? r : []; if (reportTab === 'repos' && !reportEl.hidden) renderRepos(); }); }
  if (!todayData && typeof loadToday === 'function') loadToday();
}
document.addEventListener('change', async e => { const i = e.target.closest('[data-repobudget]'); if (!i) return; await api('api/tasks', { op: 'settings', repoBudget: Number(i.value) || 0, dir: i.dataset.repobudget }); await pollTasks(); });
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-reponotesave]'); if (!b) return;
  const ta = [...reportEl.querySelectorAll('[data-reponote]')].find(x => x.dataset.reponote === b.dataset.reponotesave);
  b.disabled = true; const r = await api('api/tasks', { op: 'repoNote', dir: b.dataset.reponotesave, text: ta ? ta.value : '' }); b.disabled = false;
  b.textContent = r.ok ? '✓ ' + T.repos.noteSaved : '⚠'; await pollTasks();
});
// the files the agents touched most this week, hotter = more sessions
let hotData = null;
function hotHtml() {
  const H = T.hot; if (taskData.privacy) return '';
  if (!hotData || !hotData.length) return `<h3>🔥 ${esc(H.title)}</h3><p class="note">${esc(hotData ? H.none : H.loading)}</p>`;
  const max = Math.max(...hotData.map(x => x.sessions)), heat = n => { const f = n / max; return f > .66 ? '#e43b44' : f > .33 ? '#f77622' : '#feae34'; };
  return `<h3>🔥 ${esc(H.title)}</h3><p class="note">${esc(H.sub)}</p><ul class="bars hot">${hotData.slice(0, 20).map(x => `<li><code title="${esc(x.repo + ' · ' + x.rel)}">${esc(x.rel)}</code><span class="tbar"><i style="width:${(x.sessions / max * 100).toFixed(1)}%;background:${heat(x.sessions)}"></i></span><span class="t">${esc(H.sessions(x.sessions))} · ${esc(x.repo)} · ${esc(x.agents.join(', '))} · ${esc(ago(Date.now() - x.last))}</span></li>`).join('')}</ul>`;
}
// cleanup of finished tasks' worktrees: list first, remove only what you tick (uncommitted work is never removed)
let cleanData = null, cleanOut = null;
function cleanHtml() {
  const C = T.clean;
  if (!cleanData) return `<h3>🧹 ${esc(C.title)}</h3><p class="note">${esc(C.sub)}</p><p><button class="btn small ghost" data-clean="list">${esc(C.find)}</button></p>`;
  const items = cleanData.items || [];
  return `<h3>🧹 ${esc(C.title)}</h3><p class="note">${esc(C.sub)}</p>${items.length ? `<ul class="bclist">${items.map(it => `<li><label class="tchk"><input type="checkbox" data-cleanid="${esc(it.id)}" ${it.dirty ? 'disabled' : ''}> <b>${esc(it.title || it.id)}</b> <small class="note">${esc(T.tasks.states[it.state] || C.deleted)}</small></label>
    ${it.dirty ? `<span class="tpill st-blocked">${esc(C.dirty(it.dirty))}</span>` : ''} <span class="tpill ${it.merged || it.pushed ? 'st-done' : 'st-pending'}">${esc(it.merged ? C.merged : it.pushed ? C.pushed : C.keep)}</span>${cleanOut && cleanOut[it.id] ? ` <small>${esc(cleanOut[it.id])}</small>` : ''}</li>`).join('')}</ul>
    <p><button class="btn small" data-clean="run">🧹 ${esc(C.run)}</button></p>` : `<p class="note">${esc(C.none)}</p>`}`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-clean]'); if (!b) return;
  const post = body => fetch('api/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false }));
  b.disabled = true;
  if (b.dataset.clean === 'run') {
    const ids = [...reportEl.querySelectorAll('[data-cleanid]:checked')].map(x => x.dataset.cleanid); if (!ids.length) { b.disabled = false; return; }
    if (!confirm(T.clean.sure(ids.length))) { b.disabled = false; return; }
    const r = await post({ op: 'run', ids }); cleanOut = {}; for (const x of (r.out || [])) cleanOut[x.id] = x.done ? '✓ ' + (x.branch === 'deleted' ? T.clean.doneAll : T.clean.doneKept) : '⚠ ' + (T.clean.why[x.why] || x.why);
    if (!r.ok) alert(T.clean.why[r.reason] || r.reason);
  }
  cleanData = await post({ op: 'list' }); renderRepos();
});
// the phone panel: its link as a QR code when the office was started with --phone, how to turn it on otherwise
async function renderPhone() {
  const P = T.phone, body = reportEl.querySelector('.report-body');
  const d = await api('api/phone'); if (reportTab !== 'phone' || reportEl.hidden) return;
  if (!d || !d.on) { body.innerHTML = tabsHtml() + `<h3>📱 ${esc(P.title)}</h3><p>${esc(P.how)}</p><p><code>npx coworking-agents --phone</code></p><p class="note">${esc(P.warn)}</p>`; return; }
  body.innerHTML = tabsHtml() + `<h3>📱 ${esc(P.title)}</h3><p>${esc(P.scan)}</p><canvas class="qr" width="10" height="10"></canvas><p><code class="qr-url">${esc(d.url)}</code></p><p class="note">${esc(P.warn)}</p>`;
  drawQr(body.querySelector('canvas.qr'), d.qr);
  const V = T.visit; visitUntil = d.visit ? d.visit.until : 0;
  body.insertAdjacentHTML('beforeend', `<h3>👀 ${esc(V.title)}</h3><p class="note">${esc(V.sub)}</p>${d.visit
    ? `<p class="ok">${esc(V.live(new Date(d.visit.until).toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en', { hour: '2-digit', minute: '2-digit' })))}</p><canvas class="qr qr-visit" width="10" height="10"></canvas><p><code class="qr-url">${esc(d.visit.url)}</code></p><p><button class="btn small danger" data-visit="stop">✕ ${esc(V.stop)}</button></p>`
    : `<p><button class="btn small" data-visit="start">👀 ${esc(V.start)}</button></p>`}`);
  if (d.visit) drawQr(body.querySelector('canvas.qr-visit'), d.visit.qr);
}
function drawQr(c, qr) {
  const n = qr.length, q = 4, s = 6, g = c.getContext('2d');
  c.width = c.height = (n + q * 2) * s; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
  qr.forEach((row, r) => [...row].forEach((x, k) => { if (x === '1') g.fillRect((k + q) * s, (r + q) * s, s, s); }));
}
// while a visit is open, this page sends a picture of the office drawn without names every 5 seconds
let visitUntil = 0;
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-visit]'); if (!b) return;
  b.disabled = true;
  const r = await fetch('api/visit?op=' + b.dataset.visit + '&min=60', { method: 'POST', headers: { 'X-Coworking': '1' } }).then(x => x.json()).catch(() => ({ ok: false }));
  visitUntil = r.ok && r.until ? r.until : 0; if (visitUntil) sendVisitFrame(); renderPhone();
});
function sendVisitFrame() {
  if (!visitUntil || Date.now() > visitUntil || typeof drawScene !== 'function' || !data) return;
  const cv = document.getElementById('cv'); if (!cv) return;
  snapshotMode = true;
  try { drawScene(performance.now(), 0); } finally { snapshotMode = false; }
  const ppl = data.people || [], w = ppl.filter(p => !['idle', 'asleep', 'needs_you', 'waiting'].includes(p.state)).length, n = ppl.filter(p => ['needs_you', 'waiting'].includes(p.state)).length;
  cv.toBlob(blob => { if (!blob) return; fetch(`api/visit?op=frame&w=${w}&n=${n}&t=${ppl.length}`, { method: 'POST', headers: { 'Content-Type': 'image/png', 'X-Coworking': '1' }, body: blob }).then(x => x.json()).then(r => { if (r && r.active === false) visitUntil = 0; }).catch(() => {}); }, 'image/png');
}
setInterval(sendVisitFrame, 5000);
api('api/phone').then(d => { if (d && d.visit) visitUntil = d.visit.until; }).catch(() => {});
// TV mode: only the office and the counters, big, full screen; Esc or the corner button leaves
function setTv(on) {
  document.body.classList.toggle('tv', on);
  let x = document.getElementById('tv-exit');
  if (on && !x) { x = document.createElement('button'); x.id = 'tv-exit'; x.className = 'btn small ghost'; x.onclick = () => setTv(false); document.body.appendChild(x); }
  if (x) { x.textContent = '✕ ' + T.tv.exit; x.hidden = !on; }
  if (on) { closeReport(); selected = null; if (typeof renderPanel === 'function') renderPanel(); try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch {} }
  else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  try { window.dispatchEvent(new Event('resize')); } catch {}
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('tv')) setTv(false); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('tv')) setTv(false); });
if (new URLSearchParams(location.search).get('tv') === '1') setTimeout(() => setTv(true), 500);
function labelMenuPanels() { const O = T.officeObj; document.querySelectorAll('[data-menu-tab]').forEach(b => { const l = O.menu[b.dataset.menuTab]; b.querySelector('.ml').textContent = l; b.title = l; }); }
setInterval(labelMenuPanels, 2000); setTimeout(labelMenuPanels, 300);

// ---- the recommendation card: current, recommended and pending config, the reason, Apply; refreshed as the task moves ----
const recOf = new Map();
function recCardHtml(t, p) {
  const X = T.tasks, key = t ? t.id + ':' + t.updated + ':' + t.profile + ':' + t.effort : 'p:' + p.id + ':' + (p.title || '') + (p.lastPrompt || '');
  const hit = recOf.get(t ? t.id : 'p:' + p.id);
  if ((!hit || hit.key !== key) && !(hit && hit.loading === key) && !taskData.privacy) {
    recOf.set(t ? t.id : 'p:' + p.id, { ...(hit || {}), loading: key });
    api('api/tasks', t ? { op: 'recommend', id: t.id } : { op: 'recommend', desc: [p.title, p.lastPrompt].filter(Boolean).join('\n'), agent: p.agent })
      .then(r => { recOf.set(t ? t.id : 'p:' + p.id, { key, rec: r.ok ? r.rec : null }); if (t && reportTab === 'tasks' && taskSel === t.id && !reportEl.hidden) renderTasks(); if (selected && data) renderPanel(); });
  }
  const rec = hit && hit.rec, cur = t ? `${mname(t, t.running && t.state === 'running' ? t.running.model : t.model)} · ${t.running && t.state === 'running' ? t.running.effort : t.effort}` : `${p.model || X.unknownModel} · ${p.effort || X.unknownEffort}`;
  const pend = t && t.state === 'running' && t.running && (t.running.model !== t.model || t.running.effort !== t.effort) ? `${mname(t, t.model)} · ${t.effort}` : '';
  const same = rec && t && rec.model === t.model && rec.effort === t.effort;
  const missing = rec ? (rec.missing || []).map(m => X.missing[m] || m) : [];
  return `<div class="reccard"><div class="rc-row"><span>${esc(X.rcCurrent)}</span><b>${esc(cur)}</b></div>
    ${pend ? `<div class="rc-row"><span>${esc(X.pendingCfg)}</span><b class="warn">${esc(pend)}</b></div>` : ''}
    <div class="rc-row"><span>${esc(X.rcRecommended)}</span><b>${rec ? esc(`${(t ? mname(t, rec.model) : rec.model || X.cliDefault)} · ${rec.effort}`) + ` <small>(${esc(X.profiles[rec.profile])})</small>` : esc(taskData.privacy ? X.rcPrivate : X.rcLoading)}</b></div>
    ${rec ? `<p class="rc-why">${esc(rec.why.map(w => X.recWhy[w] || w).join(' · '))}${rec.similar ? ' · ' + esc(X.similar(rec.similar)) : ''}</p>` : ''}
    ${missing.length ? `<p class="rc-miss">${esc(X.rcMissing)}: ${esc(missing.join('; '))}</p>` : ''}
    ${t ? (rec && !same ? `<button class="btn small" data-rcapply="${esc(t.id)}">💡 ${esc(T.notices.apply)}: ${esc(mname(t, rec.model))} · ${esc(rec.effort)}</button>${t.state === 'running' ? ` <small class="note">${esc(X.next)}</small>` : ''}` : rec ? `<p class="ok">✓ ${esc(X.rcAlready)}</p>` : '') : (canSwitch(p) && rec ? `<p><button class="btn small" data-pswitch="${esc(p.id)}">⌨ ${esc(X.switchTerm)}: ${esc(switchModel(p, rec))} · ${esc(rec.effort)}</button></p><p class="note" data-pswitch-msg="${esc(p.id)}">${esc(X.switchHow)}</p>` : '') + `<p class="note">${canAsk(p) ? '💡 ' + esc(X.rcExternal) : '🔒 ' + esc(X.rcNoAsk)}</p>`}</div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-rcapply]'); if (!b) return;
  const hit = recOf.get(b.dataset.rcapply), rec = hit && hit.rec; if (!rec) return;
  b.disabled = true;
  await api('api/tasks', { op: 'config', id: b.dataset.rcapply, profile: rec.profile, model: rec.model, effort: rec.effort, why: 'rec:' + rec.why.join('+') });
  await pollTasks(); if (taskSel === b.dataset.rcapply) loadTask(taskSel);
});

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
