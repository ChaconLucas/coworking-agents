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
reportEl.innerHTML = '<div class="report-box" role="dialog" aria-modal="true"><button class="report-x" aria-label="×">×</button><div class="report-body"></div></div>';
document.body.appendChild(reportEl);
reportEl.addEventListener('click', e => { if (e.target === reportEl || e.target.closest('.report-x')) closeReport(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !reportEl.hidden) { e.stopPropagation(); closeReport(); } }, true);
function openReport() { reportEl.hidden = false; renderReport(); loadUsage(true); }
function closeReport() { reportEl.hidden = true; }

function renderReport() {
  const U = T.usage, u = usageData, body = reportEl.querySelector('.report-body'), L = (data && data.limits) || {};
  const tok = n => fmtK(Math.round(Number(n) || 0));
  const card = id => {
    const a = AGENT[id], g = u && u.byAgent && u.byAgent[id], l = L[id];
    const lim = l ? limitRow(U.fiveHour, l.primary) + limitRow(U.week, l.secondary) : `<p class="note">${esc(id === 'claude' ? U.claudeHint : U.none)}</p>`;
    const totals = g ? `<div class="big"><div><b>${tok(g.total.output)}</b><small>${esc(U.out)}</small></div><div><b>${tok(g.total.input + g.total.cacheWrite)}</b><small>${esc(U.in)}</small></div><div><b>${tok(g.total.cacheRead)}</b><small>${esc(U.cache)}</small></div></div>
      <p class="note">${Number(g.sessions) || 0} ${esc(U.conversations)}</p>
      <ul class="bars">${Object.entries(g.byModel).sort((x, y) => y[1].output - x[1].output).slice(0, 6).map(([m, v], i, arr) => `<li><code title="${esc(m)}">${esc(m)}</code><span class="tbar"><i style="width:${(v.output / arr[0][1].output * 100).toFixed(1)}%;background:${a.color}"></i></span><span class="t">${tok(v.output)}</span></li>`).join('')}</ul>` : `<p class="note">${esc(u && u.scanning ? U.scanning : U.none)}</p>`;
    return `<div class="rcard"><h4 style="color:${a.color}">${esc(a.label)}</h4>${totals}</div>`;
  };
  // last 14 days, output tokens per day stacked by AI
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); days.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); }
  const val = (id, k) => (u && u.byAgent && u.byAgent[id] && u.byAgent[id].byDay[k] && u.byAgent[id].byDay[k].output) || 0;
  const max = Math.max(1, ...days.map(k => Object.keys(AGENT).reduce((n, id) => n + val(id, k), 0)));
  const chart = `<div class="chart">${days.map(k => `<div class="col" title="${k}: ${Object.keys(AGENT).map(id => `${AGENT[id].label} ${tok(val(id, k))}`).join(' · ')}">${Object.keys(AGENT).map(id => `<i style="height:${(val(id, k) / max * 100).toFixed(2)}%;background:${AGENT[id].color}"></i>`).join('')}</div>`).join('')}</div>
    <div class="axis">${days.map((k, i) => `<span>${i % 2 ? '' : k.slice(8) + '/' + k.slice(5, 7)}</span>`).join('')}</div>
    <div class="legend">${Object.keys(AGENT).map(id => `<span><i style="background:${AGENT[id].color}"></i>${esc(AGENT[id].label)}</span>`).join('')}</div>`;
  // limits first: one big tile per window, the most urgent thing on the page
  const limTile = (id, label, w) => {
    if (!w) return '';
    const pct = Math.max(0, Math.min(100, w.usedPercent)), c = pct > 85 ? '#e43b44' : pct > 60 ? '#feae34' : '#63c74d';
    return `<div class="ltile" style="--c:${c}"><div class="ltop"><span style="color:${AGENT[id].color}">${esc(AGENT[id].label)}</span><small>${esc(label)}</small></div><b>${Math.round(pct)}%</b><div class="lbar"><i style="width:${pct}%"></i></div><small>${esc(U.resets)} ${esc(untilText(w.resetsAt))}</small></div>`;
  };
  const tiles = Object.keys(AGENT).flatMap(id => { const l = L[id]; return l ? [limTile(id, U.fiveHour, l.primary), limTile(id, U.week, l.secondary)] : []; }).join('');
  const total = id => u && u.byAgent && u.byAgent[id] ? u.byAgent[id].total : null;
  body.innerHTML = `<h2>${esc(U.title)}</h2><p class="sub">${esc(U.reportSub)}${u && u.scannedAt ? ' · ' + esc(U.updated) + ' ' + esc(ago(Date.now() - u.scannedAt)) : ''}</p>
    <h3>${esc(U.limits)}</h3><div class="ltiles">${tiles || `<p class="note">${esc(U.none)}</p>`}</div>
    <h3>${esc(U.last14)}</h3><div class="chart-wrap"><span class="ymax">${tok(max)}</span>${chart}</div>
    <h3>${esc(U.allTime)}</h3><div class="rgrid">${Object.keys(AGENT).map(card).join('')}</div>
    <p class="note" style="margin-top:14px">${esc(U.note)} ${esc(U.noCost)}</p>`;
}
