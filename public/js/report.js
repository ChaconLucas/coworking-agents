'use strict';
// ---------------- usage: always-visible pill in the top bar + big report modal ----------------
let usageData = null, usageAt = 0;
async function loadUsage(force) {
  if (!force && Date.now() - usageAt < 30000) return usageData;
  usageAt = Date.now();
  try { usageData = await fetch('api/usage').then(r => r.json()); } catch {}
  costGoalCheck();
  renderUsagePill();
  if (!reportEl.hidden) renderReport();
  // the first full scan takes a few seconds: poll until it lands
  if (usageData && (usageData.scanning || !usageData.byAgent)) setTimeout(() => loadUsage(true), 3000);
  return usageData;
}
setInterval(() => loadUsage(), 30000);
setTimeout(() => loadUsage(true), 500);

const meterCls = p => p > 85 ? 'hi' : p > 60 ? 'mid' : '';
// the month's cost goal: spent so far (estimated from the logs), the end-of-month projection at this pace, and a notice when it goes over
function monthSpend(u) {
  const now = new Date(), key = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const spent = Object.entries((u && u.days) || {}).filter(([k]) => k.startsWith(key)).reduce((n, [, d]) => n + (d.usd || 0), 0);
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), elapsed = now.getDate() - 1 + (now.getHours() * 60 + now.getMinutes()) / 1440;
  return { key, spent, projected: elapsed >= 1 ? spent / elapsed * dim : 0, elapsed };
}
function costGoalHtml(u) {
  const G = T.goalCost, goal = Number(((typeof taskData !== 'undefined' && taskData.settings) || {}).monthGoal) || 0, m = monthSpend(u);
  const pct = goal ? Math.min(100, m.spent / goal * 100) : 0, ppct = goal ? Math.min(100, m.projected / goal * 100) : 0, c = !goal ? '#8b9bb4' : m.spent >= goal ? '#e43b44' : m.projected > goal ? '#feae34' : '#63c74d';
  return `<h3>${esc(G.title)}</h3><div class="cgoal"><label>${esc(G.goal)} <input type="number" min="0" step="5" value="${goal || ''}" placeholder="0" data-cost-goal></label>
    ${goal ? `<div class="gbar"><i class="proj" style="width:${ppct.toFixed(1)}%"></i><i style="width:${pct.toFixed(1)}%;background:${c}"></i></div>` : ''}
    <p class="note">${esc(G.spent(fmtUSD(m.spent)))}${m.projected ? ' · ' + esc(G.projected(fmtUSD(m.projected))) : ''}${goal ? ' · ' + esc(m.spent >= goal ? G.over : m.projected > goal ? G.overPace : G.ok) : ' · ' + esc(G.none)}</p></div>`;
}
function costGoalCheck() {
  const goal = Number(((typeof taskData !== 'undefined' && taskData.settings) || {}).monthGoal) || 0; if (!goal || !usageData || typeof pushNotice !== 'function') return;
  const G = T.goalCost, m = monthSpend(usageData), said = store.get('goalSaid', []);
  const say = (k, kind, title, body) => { if (said.includes(k)) return; store.set('goalSaid', [...said.slice(-10), k]); pushNotice(k, kind, title, body, { tab: 'usage' }); notifyOS(title, body); };
  if (m.spent >= goal) say(`goal:${m.key}:over:${goal}`, 'warn', G.noticeOver(fmtUSD(goal)), G.spent(fmtUSD(m.spent)));
  else if (m.elapsed >= 2 && m.projected > goal) say(`goal:${m.key}:pace:${goal}`, 'warn', G.noticePace(fmtUSD(m.projected), fmtUSD(goal)), G.spent(fmtUSD(m.spent)) + '. ' + G.tip);
}
document.addEventListener('change', async e => {
  const g = e.target.closest('[data-cost-goal]'); if (!g) return;
  await api('api/tasks', { op: 'settings', monthGoal: Number(g.value) || 0 }); await pollTasks(); costGoalCheck(); renderReport();
});
function renderUsagePill() {
  const pill = document.getElementById('usage-pill');
  if (!pill || !data) return;
  const U = T.usage, L = data.limits || {}, parts = [];
  const meter = (label, w, opt) => w ? `<span class="u ${opt ? 'opt' : ''}"><span><small>${esc(label)}</small><b>${Math.round(w.usedPercent)}%</b></span><span class="m"><i class="${meterCls(w.usedPercent)}" style="width:${Math.min(100, w.usedPercent)}%"></i></span></span>` : '';
  for (const id of Object.keys(AGENT)) {
    const l = L[id];
    if (l && l.primary) parts.push(meter(`${AGENT[id].label.split(' ')[0]} 5h`, l.primary), meter(`${AGENT[id].label.split(' ')[0]} ${U.weekShort}`, l.secondary, true));
  }
  const today = data.people.reduce((n, p) => n + ((p.today && p.today.outTokens) || 0), 0);
  parts.push(`<span class="u"><span><small>${esc(U.todayShort)}</small><b>${fmtK(today)}</b></span><span class="m"><i style="width:100%;background:#3b5dc9"></i></span></span>`);
  pill.innerHTML = parts.filter(Boolean).join('<span class="sep"></span>');
  pill.title = U.open;
}


const reportEl = document.createElement('div');
reportEl.className = 'report'; reportEl.hidden = true;
reportEl.innerHTML = '<div class="report-box" role="dialog" aria-modal="true"><button class="report-x" aria-label="Close"><svg viewBox="0 0 10 10" width="12" height="12" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M1 1h2v1h1v1h2V2h1V1h2v2H8v1H7v2h1v1h1v2H7V8H6V7H4v1H3v1H1V7h1V6h1V4H2V3H1z"/></svg></button><div class="report-body"></div></div>';
document.body.appendChild(reportEl);
reportEl.addEventListener('click', e => { if (e.target === reportEl || e.target.closest('.report-x')) closeReport(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !reportEl.hidden) { e.stopPropagation(); closeReport(); } }, true);
let reportTab = 'usage', todayData = null;
function openReport(tab) { reportTab = tab || 'usage'; achBump('tab_' + reportTab); reportEl.hidden = false; renderReport(); loadUsage(true); if (reportTab === 'today') loadToday(); }
async function loadToday() { try { todayData = await fetch('api/report').then(r => r.json()); } catch {} if (!reportEl.hidden) renderReport(); }
reportEl.addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) { reportTab = t.dataset.tab; achBump('tab_' + reportTab); if (reportTab === 'today') loadToday(); renderReport(); } });
function tabsHtml() { return `<div class="rtabs">${[['tasks', T.tasks.tab(typeof tasksWaiting === 'function' ? tasksWaiting() : 0)], ['notices', T.notices.tab(typeof unreadNotices === 'function' ? unreadNotices() : 0)], ['queue', T.queue.tab(typeof queueList === 'function' ? queueList().filter(p => p.state !== 'idle').length : 0)], ['usage', T.usage.title], ['today', T.today.title], ['paper', T.paper.tab], ['ach', T.ach.title], ['shop', T.shop.title], ['office', T.office.tab], ['feed', T.feed.title], ['version', T.ver.tab]].map(([k, l]) => `<button data-tab="${k}" class="${reportTab === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`; }
// activity feed: newest first, grouped by hour
function renderFeed() {
  const F = T.feed, body = reportEl.querySelector('.report-body');
  const ICON = { arrive: ['→', '#63c74d'], leave: ['←', '#8b9bb4'], done: ['✓', '#2ce8f5'], needs_you: ['?', '#e43b44'], waiting: ['!', '#feae34'] };
  const list = [...feed].reverse();
  const clock = ts => new Date(ts).toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en', { hour: '2-digit', minute: '2-digit' });
  let lastHour = '';
  const rows = list.map(e => {
    const h = new Date(e.at).getHours() + 'h', [ic, c] = ICON[e.kind] || ['•', '#888'];
    const sep = h !== lastHour ? `<li class="feed-h">${esc(h === new Date().getHours() + 'h' ? F.thisHour : h)}</li>` : '';
    lastHour = h;
    return `${sep}<li data-feed-id="${esc(e.id)}"><span class="k" style="color:${c}">${ic}</span><span><b>${esc(e.name)}</b> ${esc(F.kinds[e.kind] || e.kind)}${e.title ? `<br><span class="note">${esc(e.title)}</span>` : ''}</span><span class="t">${esc(clock(e.at))}</span></li>`;
  }).join('');
  body.innerHTML = tabsHtml() + `<div class="rhead"><p class="sub">${esc(F.sub)}</p>${list.length ? `<button class="btn small" data-feed-clear>${esc(F.clear)}</button>` : ''}</div>
    ${list.length ? `<ul class="list feed">${rows}</ul>` : `<p class="note">${esc(F.empty)}</p>`}`;
}
reportEl.addEventListener('click', e => {
  if (e.target.closest('[data-feed-clear]')) { feed = []; store.set('feed', feed); renderFeed(); return; }
  const li = e.target.closest('[data-feed-id]');
  if (li && data.people.some(p => p.id === li.dataset.feedId && !p.leaving)) { closeReport(); showPerson(li.dataset.feedId); }
});
function renderToday() {
  const D = T.today, r = todayData, body = reportEl.querySelector('.report-body');
  const hrs = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${(m / 60) | 0}h${String(m % 60).padStart(2, '0')}` : `${m}min`; };
  if (!r) { body.innerHTML = tabsHtml() + `<p class="note">${esc(D.loading)}</p>`; return; }
  const t = r.totals, max = Math.max(1, ...r.rows.map(x => x.activeMs));
  body.innerHTML = tabsHtml() + `<div class="rhead"><p class="sub">${esc(D.sub)}</p><span><button class="btn small" data-copy-md>${esc(D.copyMd)}</button> <button class="btn small" data-copy-md="slack">${esc(D.copySlack)}</button></span></div>
    <div class="ltiles">${[[hrs(t.activeMs), D.active], [t.sessions, D.sessions], [t.tools, D.tools], [t.files, D.files], [fmtK(t.outTokens), D.tokens]].map(([v, l]) => `<div class="ltile" style="--c:#2ce8f5"><div class="ltop"><span>${esc(l)}</span></div><b>${esc(String(v))}</b></div>`).join('')}</div>
    <h3>${esc(D.who)}</h3>
    <ul class="bars today-list">${r.rows.map(x => `<li><code title="${esc(x.title)}"><i class="ailogo" data-ai="${esc(x.agent)}"></i>${esc(x.name || x.title || x.id.slice(0, 8))}</code><span class="tbar"><i style="width:${(x.activeMs / max * 100).toFixed(1)}%;background:${(AGENT[x.agent] || {}).color || '#888'}"></i></span><span class="t">${esc(hrs(x.activeMs))} · ${Number(x.tools) || 0} ${esc(D.toolsShort)} · ${fmtK(x.outTokens)}</span></li>`).join('')}</ul>
    ${waitHtml(r, hrs)}
    ${repliesHtml()}
    ${goalHtml()}
    ${r.topFiles.length ? `<h3>${esc(D.filesTop)}</h3><ul class="list">${r.topFiles.map(f => `<li><span class="k">✎</span><code>${esc(f.rel)}</code><span class="t">${esc(f.repo)}${f.n > 1 ? ' · ' + f.n + '×' : ''}</span></li>`).join('')}</ul>` : ''}`;
  body.querySelectorAll('.ailogo[data-ai]').forEach(el => { const id = el.dataset.ai; el.appendChild(Art.aiIconEl(id, (AGENT[id] || {}).color || '#888')); });
}
// waiting on you today, measured: questions the agents asked and office tasks blocked on you
function waitList(r) {
  const out = [];
  for (const x of r.rows || []) for (const w of x.waits || []) out.push({ who: x.name || x.title || x.id.slice(0, 8), what: x.title || '', ms: w.ms, at: w.from, kind: 'ask' });
  for (const t of (typeof taskData !== 'undefined' && taskData.tasks) || []) if (t.waitToday > 0) out.push({ who: t.title, what: '', ms: t.waitToday, kind: 'task' });
  return out.sort((a, b) => b.ms - a.ms);
}
function waitHtml(r, hrs) {
  const W = T.today.wait, list = waitList(r); if (!list.length) return `<h3>${esc(W.title)}</h3><p class="note">${esc(W.none)}</p>`;
  const total = list.reduce((n, x) => n + x.ms, 0);
  return `<h3>${esc(W.title)}</h3><p><b>${esc(hrs(total))}</b> ${esc(W.total(list.length))}</p><ul class="list">${list.slice(0, 6).map(x => `<li><span class="k">${x.kind === 'ask' ? '❓' : '📋'}</span><span>${esc(x.who)}${x.what && x.what !== x.who ? ' <small class="note">' + esc(x.what) + '</small>' : ''}</span><span class="t">${esc(hrs(x.ms))}</span></li>`).join('')}</ul><p class="note">${esc(W.note)}</p>`;
}
// today's report as Markdown, ready to paste into a standup
function todayMarkdown(r) {
  const D = T.today, hrs = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${(m / 60) | 0}h${String(m % 60).padStart(2, '0')}` : `${m}min`; };
  const day = new Date(r.now || Date.now()).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en', { weekday: 'long', day: 'numeric', month: 'long' });
  const t = r.totals, lines = [`## ${D.title} · ${day}`, '', `**${hrs(t.activeMs)}** ${D.active} · **${t.sessions}** ${D.sessions} · **${t.tools}** ${D.tools} · **${t.files}** ${D.files} · **${fmtK(t.outTokens)}** ${D.tokens}`, '', `### ${D.who}`];
  const waits = waitList(r), waitMs = waits.reduce((n, x) => n + x.ms, 0);
  if (waitMs) lines.splice(3, 0, '', `${D.wait.title}: **${hrs(waitMs)}** (${D.wait.total(waits.length)})`);
  const usd = r.rows.reduce((a, x) => a + (x.usd || 0), 0);
  if (usd) lines.splice(3, 0, '', `${D.costLine}: **${fmtUSD(usd)}**${r.rows.some(x => x.unpriced) ? ' + ?' : ''}`);
  for (const x of r.rows) lines.push(`- **${x.name || x.title || x.id.slice(0, 8)}** (${(AGENT[x.agent] || {}).label || x.agent}${x.repo ? ', ' + x.repo : ''})${x.title && x.name ? ` — ${x.title}` : ''}: ${hrs(x.activeMs)}, ${Number(x.tools) || 0} ${D.toolsShort}${x.usd ? ', ' + fmtUSD(x.usd) : ''}`);
  if (r.topFiles.length) { lines.push('', `### ${D.filesTop}`); for (const f of r.topFiles) lines.push(`- \`${f.rel}\` (${f.repo}${f.n > 1 ? ', ' + f.n + '×' : ''})`); }
  // what is still open: tasks waiting on you or failed, and agents asking something
  const open = [...((typeof taskData !== 'undefined' && taskData.tasks) || []).filter(x => ['blocked', 'failed', 'pending'].includes(x.state)).map(x => `${x.title} — ${T.tasks.states[x.state]}${x.reason ? ' (' + (T.tasks.reasons[x.reason] || x.reason) + ')' : ''}`),
    ...((data && data.people) || []).filter(p => ['needs_you', 'waiting'].includes(p.state)).map(p => `${p.name}${p.title ? ' (' + p.title + ')' : ''} — ${T.states[p.state] || p.state}`)];
  if (open.length) { lines.push('', `### ${D.pending}`); for (const o of open) lines.push('- ' + o); }
  return lines.join('\n') + '\n';
}
// the same report in Slack's own markup: *bold*, no headings, • bullets
const toSlack = md => md.split('\n').map(l => l.replace(/^#{2,3} (.*)$/, '*$1*').replace(/\*\*([^*]+)\*\*/g, '*$1*').replace(/^- /, '• ')).join('\n');
reportEl.addEventListener('click', async e => {
  const b = e.target.closest('[data-copy-md]');
  if (!b || !todayData) return;
  let ok = false;
  const slack = b.dataset.copyMd === 'slack', md = todayMarkdown(todayData), label = slack ? T.today.copySlack : T.today.copyMd;
  try { await navigator.clipboard.writeText(slack ? toSlack(md) : md); ok = true; } catch {}
  b.textContent = ok ? T.today.copied : T.today.copyFail;
  setTimeout(() => { b.textContent = label; }, 2000);
});
function closeReport() { reportEl.hidden = true; }

// how fast a limit is filling and when it runs out at that pace (measured over the last hour; nothing until there is enough)
function paceHtml(u, id, key) {
  const H = T.heat, x = u && u.pace && u.pace[id] && u.pace[id][key]; if (!x) return '';
  const at = ms => new Date(ms).toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en', { hour: '2-digit', minute: '2-digit' }) + (new Date(ms).toDateString() === new Date().toDateString() ? '' : ' ' + new Date(ms).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en', { weekday: 'short' }));
  return x.fullAt ? `<small class="pace hot">⏱ ${esc(H.endsAt(at(x.fullAt), x.perHour))}</small>` : `<small class="pace">✓ ${esc(x.perHour > 0.5 ? H.lasts(x.perHour) : H.steady)}</small>`;
}
// when the tokens go: weekday × hour over the last 28 days, darker = more output tokens
function heatHtml(u) {
  const H = T.heat, g = u && u.heat && u.heat.grid; if (!g) return '';
  const max = Math.max(1, ...g.flat().map(c => c.out)); if (max <= 1) return '';
  const days = lang === 'pt' ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], order = [1, 2, 3, 4, 5, 6, 0];
  let best = null; for (const d of order) for (let h = 0; h < 24; h++) if (!best || g[d][h].out > best.out) best = { d, h, out: g[d][h].out };
  const byDay = order.map(d => ({ d, out: g[d].reduce((n, c) => n + c.out, 0) })).sort((a, b) => b.out - a.out)[0];
  const rows = order.map(d => `<div class="hrow"><span>${esc(days[d])}</span>${g[d].map((c, h) => `<i style="--a:${c.out ? (0.12 + 0.88 * c.out / max).toFixed(2) : 0}" title="${esc(days[d])} ${h}h · ${esc(fmtK(c.out))} tokens${c.usd ? ' · ' + esc(fmtUSD(c.usd)) : ''}"></i>`).join('')}</div>`).join('');
  return `<h3>${esc(H.title)}</h3><p class="note">${esc(H.peak(days[best.d], best.h, days[byDay.d]))}</p>
    <div class="heat">${rows}<div class="hrow axis"><span></span>${Array.from({ length: 24 }, (_, h) => `<em>${h % 3 ? '' : h}</em>`).join('')}</div></div><p class="note">${esc(H.note(u.heat.days))}</p>`;
}
function renderReport() {
  if (reportTab === 'tasks') return renderTasks();
  if (reportTab === 'notices') return renderNotices();
  if (reportTab === 'version') return renderVersion();
  if (reportTab === 'phone') return renderPhone();
  if (reportTab === 'repos') return renderRepos();
  if (reportTab === 'broadcast') return renderBroadcast();
  if (reportTab === 'today') return renderToday();
  if (reportTab === 'feed') return renderFeed();
  if (reportTab === 'timelapse') return renderTimelapse();
  if (reportTab === 'ach') return renderAchievements();
  if (reportTab === 'paper') return renderPaper();
  if (reportTab === 'queue') return renderQueue();
  if (reportTab === 'launch') return renderLaunch();
  if (reportTab === 'shop') return renderShop();
  if (reportTab === 'office') { renderOffice(); syncAutostart(); syncAppMade(); return syncMenubar(); }
  const U = T.usage, u = usageData, body = reportEl.querySelector('.report-body'), L = (data && data.limits) || {};
  const tok = n => fmtK(Math.round(Number(n) || 0));
  const card = id => {
    const a = AGENT[id], g = u && u.byAgent && u.byAgent[id], l = L[id];
    const lim = l ? limitRow(U.fiveHour, l.primary) + limitRow(U.week, l.secondary) : `<p class="note">${esc(id === 'claude' ? U.claudeHint : U.none)}</p>`;
    const totals = g ? `<div class="big"><div><b>${tok(g.total.output)}</b><small>${esc(U.out)}</small></div><div><b>${tok(g.total.input + g.total.cacheWrite)}</b><small>${esc(U.in)}</small></div><div><b>${tok(g.total.cacheRead)}</b><small>${esc(U.cache)}</small></div></div>
      ${g.cost ? `<p class="cost"><b>≈ ${esc(fmtUSD(g.cost.usd))}</b> ${esc(U.costApi)}${g.cost.unpricedModels.length ? ` <span class="note" title="${esc(g.cost.unpricedModels.join(', '))}">(${esc(U.unpriced(g.cost.unpricedModels.length))})</span>` : ''}</p>` : ''}
      <p class="note">${Number(g.sessions) || 0} ${esc(U.conversations)}</p>
      <ul class="bars">${Object.entries(g.byModel).sort((x, y) => y[1].output - x[1].output).slice(0, 6).map(([m, v], i, arr) => `<li><code title="${esc(m)}">${esc(m)}</code><span class="tbar"><i style="width:${(v.output / arr[0][1].output * 100).toFixed(1)}%;background:${a.color}"></i></span><span class="t">${tok(v.output)}${g.costByModel && g.costByModel[m] != null ? ' · ' + esc(fmtUSD(g.costByModel[m])) : ''}</span></li>`).join('')}</ul>` : `<p class="note">${esc(u && u.scanning ? U.scanning : U.none)}</p>`;
    return `<div class="rcard"><h4 style="color:${a.color}"><i class="ailogo big" data-ai="${esc(id)}"></i>${esc(a.label)}</h4>${totals}</div>`;
  };
  // last 14 days, output tokens per day stacked by AI
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); days.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); }
  const val = (id, k) => (u && u.byAgent && u.byAgent[id] && u.byAgent[id].byDay[k] && u.byAgent[id].byDay[k].output) || 0;
  const max = Math.max(1, ...days.map(k => Object.keys(AGENT).reduce((n, id) => n + val(id, k), 0)));
  const chart = `<div class="chart">${days.map(k => `<div class="col" title="${k}: ${Object.keys(AGENT).map(id => `${AGENT[id].label} ${tok(val(id, k))}`).join(' · ')}">${Object.keys(AGENT).map(id => `<i style="height:${(val(id, k) / max * 100).toFixed(2)}%;background:${AGENT[id].color}"></i>`).join('')}</div>`).join('')}</div>
    <div class="axis">${days.map((k, i) => `<span>${i % 2 ? '' : k.slice(8) + '/' + k.slice(5, 7)}</span>`).join('')}</div>
    <div class="legend">${Object.keys(AGENT).map(id => `<span><i class="ailogo" data-ai="${esc(id)}"></i>${esc(AGENT[id].label)}</span>`).join('')}</div>`;
  // limits first: one big tile per window, the most urgent thing on the page
  const limTile = (id, label, w, key) => {
    if (!w) return '';
    const pct = Math.max(0, Math.min(100, w.usedPercent)), c = pct > 85 ? '#e43b44' : pct > 60 ? '#feae34' : '#63c74d';
    return `<div class="ltile" style="--c:${c}"><div class="ltop"><span style="color:${AGENT[id].color}"><i class="ailogo" data-ai="${esc(id)}"></i>${esc(AGENT[id].label)}</span><small>${esc(label)}</small></div><b>${Math.round(pct)}%</b><div class="lbar"><i style="width:${pct}%"></i></div><small>${esc(U.resets)} ${esc(untilText(w.resetsAt))}</small>${paceHtml(u, id, key)}</div>`;
  };
  const tiles = Object.keys(AGENT).flatMap(id => { const l = L[id]; return l ? [limTile(id, U.fiveHour, l.primary, '5h'), limTile(id, U.week, l.secondary, 'week')] : []; }).join('');
  const total = id => u && u.byAgent && u.byAgent[id] ? u.byAgent[id].total : null;
  body.innerHTML = tabsHtml() + `<h2 hidden>${esc(U.title)}</h2><p class="sub">${esc(U.reportSub)}${u && u.scannedAt ? ' · ' + esc(U.updated) + ' ' + esc(ago(Date.now() - u.scannedAt)) : ''}</p>
    <h3>${esc(U.limits)}</h3><div class="ltiles">${tiles || `<p class="note">${esc(U.none)}</p>`}</div>
    ${costGoalHtml(u)}
    ${heatHtml(u)}
    <h3>${esc(U.last14)}</h3><div class="chart-wrap"><span class="ymax">${tok(max)}</span>${chart}</div>
    <h3>${esc(U.allTime)}</h3><div class="rgrid">${Object.keys(AGENT).map(card).join('')}</div>
    <p class="note" style="margin-top:14px">${esc(U.note)} ${esc(U.costNote)}</p>`;
  body.querySelectorAll('.ailogo[data-ai]').forEach(el => { const id = el.dataset.ai; el.appendChild(Art.aiIconEl(id, (AGENT[id] || {}).color || '#888')); });
}
