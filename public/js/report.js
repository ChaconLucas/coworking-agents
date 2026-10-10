'use strict';
// ---------------- usage: always-visible pill in the top bar + big report modal ----------------
let usageData = null, usageAt = 0;
async function loadUsage(force) {
  if (!force && Date.now() - usageAt < 30000) return usageData;
  usageAt = Date.now();
  try { usageData = await fetch('api/usage').then(r => r.json()); } catch {}
  renderUsagePill();
  if (!reportEl.hidden) renderReport();
  // the first full scan takes a few seconds: poll until it lands
  if (usageData && (usageData.scanning || !usageData.byAgent)) setTimeout(() => loadUsage(true), 3000);
  return usageData;
}
setInterval(() => loadUsage(), 30000);
setTimeout(() => loadUsage(true), 500);

const meterCls = p => p > 85 ? 'hi' : p > 60 ? 'mid' : '';
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
function tabsHtml() { return `<div class="rtabs">${[['usage', T.usage.title], ['today', T.today.title], ['paper', T.paper.tab], ['ach', T.ach.title], ['shop', T.shop.title], ['office', T.office.tab], ['feed', T.feed.title]].map(([k, l]) => `<button data-tab="${k}" class="${reportTab === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`; }
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
  body.innerHTML = tabsHtml() + `<div class="rhead"><p class="sub">${esc(D.sub)}</p><button class="btn small" data-copy-md>${esc(D.copyMd)}</button></div>
    <div class="ltiles">${[[hrs(t.activeMs), D.active], [t.sessions, D.sessions], [t.tools, D.tools], [t.files, D.files], [fmtK(t.outTokens), D.tokens]].map(([v, l]) => `<div class="ltile" style="--c:#2ce8f5"><div class="ltop"><span>${esc(l)}</span></div><b>${esc(String(v))}</b></div>`).join('')}</div>
    <h3>${esc(D.who)}</h3>
    <ul class="bars today-list">${r.rows.map(x => `<li><code title="${esc(x.title)}"><i class="ailogo" data-ai="${esc(x.agent)}"></i>${esc(x.name || x.title || x.id.slice(0, 8))}</code><span class="tbar"><i style="width:${(x.activeMs / max * 100).toFixed(1)}%;background:${(AGENT[x.agent] || {}).color || '#888'}"></i></span><span class="t">${esc(hrs(x.activeMs))} · ${Number(x.tools) || 0} ${esc(D.toolsShort)} · ${fmtK(x.outTokens)}</span></li>`).join('')}</ul>
    ${repliesHtml()}
    ${r.topFiles.length ? `<h3>${esc(D.filesTop)}</h3><ul class="list">${r.topFiles.map(f => `<li><span class="k">✎</span><code>${esc(f.rel)}</code><span class="t">${esc(f.repo)}${f.n > 1 ? ' · ' + f.n + '×' : ''}</span></li>`).join('')}</ul>` : ''}`;
  body.querySelectorAll('.ailogo[data-ai]').forEach(el => { const id = el.dataset.ai; el.appendChild(Art.aiIconEl(id, (AGENT[id] || {}).color || '#888')); });
}
// today's report as Markdown, ready to paste into a standup
function todayMarkdown(r) {
  const D = T.today, hrs = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${(m / 60) | 0}h${String(m % 60).padStart(2, '0')}` : `${m}min`; };
  const day = new Date(r.now || Date.now()).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en', { weekday: 'long', day: 'numeric', month: 'long' });
  const t = r.totals, lines = [`## ${D.title} · ${day}`, '', `**${hrs(t.activeMs)}** ${D.active} · **${t.sessions}** ${D.sessions} · **${t.tools}** ${D.tools} · **${t.files}** ${D.files} · **${fmtK(t.outTokens)}** ${D.tokens}`, '', `### ${D.who}`];
  for (const x of r.rows) lines.push(`- **${x.name || x.title || x.id.slice(0, 8)}** (${(AGENT[x.agent] || {}).label || x.agent}${x.repo ? ', ' + x.repo : ''})${x.title && x.name ? ` — ${x.title}` : ''}: ${hrs(x.activeMs)}, ${Number(x.tools) || 0} ${D.toolsShort}`);
  if (r.topFiles.length) { lines.push('', `### ${D.filesTop}`); for (const f of r.topFiles) lines.push(`- \`${f.rel}\` (${f.repo}${f.n > 1 ? ', ' + f.n + '×' : ''})`); }
  return lines.join('\n') + '\n';
}
reportEl.addEventListener('click', async e => {
  const b = e.target.closest('[data-copy-md]');
  if (!b || !todayData) return;
  let ok = false;
  try { await navigator.clipboard.writeText(todayMarkdown(todayData)); ok = true; } catch {}
  b.textContent = ok ? T.today.copied : T.today.copyFail;
  setTimeout(() => { b.textContent = T.today.copyMd; }, 2000);
});
function closeReport() { reportEl.hidden = true; }

function renderReport() {
  if (reportTab === 'today') return renderToday();
  if (reportTab === 'feed') return renderFeed();
  if (reportTab === 'ach') return renderAchievements();
  if (reportTab === 'paper') return renderPaper();
  if (reportTab === 'shop') return renderShop();
  if (reportTab === 'office') return renderOffice();
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
  const limTile = (id, label, w) => {
    if (!w) return '';
    const pct = Math.max(0, Math.min(100, w.usedPercent)), c = pct > 85 ? '#e43b44' : pct > 60 ? '#feae34' : '#63c74d';
    return `<div class="ltile" style="--c:${c}"><div class="ltop"><span style="color:${AGENT[id].color}"><i class="ailogo" data-ai="${esc(id)}"></i>${esc(AGENT[id].label)}</span><small>${esc(label)}</small></div><b>${Math.round(pct)}%</b><div class="lbar"><i style="width:${pct}%"></i></div><small>${esc(U.resets)} ${esc(untilText(w.resetsAt))}</small></div>`;
  };
  const tiles = Object.keys(AGENT).flatMap(id => { const l = L[id]; return l ? [limTile(id, U.fiveHour, l.primary), limTile(id, U.week, l.secondary)] : []; }).join('');
  const total = id => u && u.byAgent && u.byAgent[id] ? u.byAgent[id].total : null;
  body.innerHTML = tabsHtml() + `<h2 hidden>${esc(U.title)}</h2><p class="sub">${esc(U.reportSub)}${u && u.scannedAt ? ' · ' + esc(U.updated) + ' ' + esc(ago(Date.now() - u.scannedAt)) : ''}</p>
    <h3>${esc(U.limits)}</h3><div class="ltiles">${tiles || `<p class="note">${esc(U.none)}</p>`}</div>
    <h3>${esc(U.last14)}</h3><div class="chart-wrap"><span class="ymax">${tok(max)}</span>${chart}</div>
    <h3>${esc(U.allTime)}</h3><div class="rgrid">${Object.keys(AGENT).map(card).join('')}</div>
    <p class="note" style="margin-top:14px">${esc(U.note)} ${esc(U.costNote)}</p>`;
  body.querySelectorAll('.ailogo[data-ai]').forEach(el => { const id = el.dataset.ai; el.appendChild(Art.aiIconEl(id, (AGENT[id] || {}).color || '#888')); });
}
