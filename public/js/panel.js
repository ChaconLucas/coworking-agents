'use strict';
// ---------------- side panel ----------------
const panel = document.getElementById('panel'), panelBody = document.getElementById('panel-body');
function fmtK(n) { return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n); }
const KIND_ICON = { edit: '✎', read: '◉', terminal: '›_', web: '◍', delegate: '⚑', skill: '✦', mcp: '⚡', other: '•', ask: '?', thinking: '…' };

const fmtTok = n => fmtK(Math.round(Number(n) || 0));
// chosen avatars, remembered per session name across runs (n = how many times "new look" was clicked)
let avatars = store.get('avatars', {});
if (!avatars || typeof avatars !== 'object') avatars = {};
function applyAvatars() {
  const m = new Map();
  if (data) for (const p of data.people) { const n = avatars[p.name]; if (n) m.set(p.id, p.name + '#' + n); }
  Art.setLookSeeds(m);
}
function nextAvatar(p, reset) {
  if (reset) delete avatars[p.name]; else { avatars[p.name] = (avatars[p.name] || 0) + 1; achBump('avatars'); }
  store.set('avatars', avatars); applyAvatars(); renderPanel(); lastHits = ''; renderOverlay();
}
// estimated money at API list prices; never shown without a price (see src/prices.js)
const fmtUSD = n => { const d = n >= 100 ? 0 : n >= 1 ? 2 : 3; return 'US$ ' + n.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en', { minimumFractionDigits: d, maximumFractionDigits: d }); };
const untilText = ms => { if (!ms) return ''; const d = ms - Date.now(); if (d <= 0) return T.usage.now; const h = Math.floor(d / 36e5), m = Math.round((d % 36e5) / 6e4); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`; };
function limitRow(label, w) {
  if (!w) return '';
  const pct = Math.max(0, Math.min(100, w.usedPercent)), cls = pct > 85 ? 'hi' : pct > 60 ? 'mid' : 'on';
  return `<div class="lim"><div class="lim-h"><span>${esc(label)}</span><b>${Math.round(pct)}%</b></div><div class="lim-bar"><i class="${cls}" style="width:${pct}%"></i></div><small>${esc(T.usage.resets)} ${esc(untilText(w.resetsAt))}${w.resetsAt ? ' · ' + new Date(w.resetsAt).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</small></div>`;
}
// usage & limits: rate-limit windows per AI, then tokens per open session
function renderUsage(P) {
  const U = T.usage, L = data.limits || {};
  const block = id => {
    const a = AGENT[id] || { label: id, color: '#888' }, l = L[id];
    const body = l ? limitRow(U.fiveHour, l.primary) + limitRow(U.week, l.secondary) : `<p class="note">${esc(id === 'claude' ? U.claudeHint : U.none)}</p>`;
    return `<h3 style="color:${a.color}">${esc(a.label)}</h3>${body}`;
  };
  const ps = data.people.filter(p => p.usage && !p.leaving).sort((a, b) => (b.usage.output + b.usage.input) - (a.usage.output + a.usage.input));
  const total = ps.reduce((t, p) => ({ input: t.input + p.usage.input, output: t.output + p.usage.output, cacheRead: t.cacheRead + p.usage.cacheRead, cacheWrite: t.cacheWrite + p.usage.cacheWrite }), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  const todayOut = data.people.reduce((n, p) => n + ((p.today && p.today.outTokens) || 0), 0);
  panelBody.innerHTML = `<h2>${esc(U.title)}</h2><p class="sub">${esc(U.sub)}</p>
    ${Object.keys(AGENT).map(block).join('')}
    <h3>${esc(U.tokens)}</h3>
    <div class="stats tok"><div><b>${fmtTok(todayOut)}</b><small>${esc(U.outToday)}</small></div><div><b>${fmtTok(total.output)}</b><small>${esc(U.out)}</small></div><div><b>${fmtTok(total.input + total.cacheWrite)}</b><small>${esc(U.in)}</small></div><div><b>${fmtTok(total.cacheRead)}</b><small>${esc(U.cache)}</small></div></div>
    <ul class="list usage-list">${ps.map(p => `<li><span class="k" style="color:${agentOf(p).color}">●</span><span>${esc(p.name)}<br><span class="note">${esc(p.title || '')}</span></span><span class="t">${fmtTok(p.usage.output)} ${esc(U.outShort)} · ${fmtTok(p.usage.input + p.usage.cacheWrite)} ${esc(U.inShort)}</span></li>`).join('')}</ul>
    <p class="note">${esc(U.note)}</p>`;
}

function renderPanel() {
  document.body.classList.toggle('panel-open', !!(selected && data));
  if (!selected || !data) { panel.hidden = true; return; }
  panel.hidden = false;
  const P = T.panel;
  if (selected === '__usage') return renderUsage(P);
  if (selected === '__hall') {
    // podium for the top 3, bars for the rest, compact chips for everything installed (used ones lit)
    const section = (id, c) => {
      const a = AGENT[id] || { label: id, color: '#888' };
      const top = c.topSkills.slice(0, 3), rest = c.topSkills.slice(3), max = c.topSkills.length ? c.topSkills[0].count : 1;
      const used = new Map(c.topSkills.map(x => [x.name, x.count]));
      const order = [1, 0, 2].filter(i => top[i]);
      const podium = top.length ? `<div class="podium">${order.map(i => `<div class="pod p${i + 1}"><span class="medal">${i + 1}</span><b title="${esc(top[i].name)}">${esc(top[i].name)}</b><small>${Number(top[i].count) || 0}×</small><i></i></div>`).join('')}</div>` : '';
      const bars = rest.length ? `<ul class="bars">${rest.map(x => `<li><code title="${esc(x.name)}">${esc(x.name)}</code><span class="tbar"><i style="width:${(x.count / max * 100).toFixed(1)}%"></i></span><span class="t">${Number(x.count) || 0}</span></li>`).join('')}</ul>` : '';
      // used ones first; long lists fold after 10 behind "show all"
      const chip = (n, kind) => `<span class="chip-s ${used.has(n) ? 'on' : ''} ${kind}" title="${esc(n)}${used.has(n) ? ' · ' + used.get(n) + '×' : ''}">${esc(n)}</span>`;
      const chips = (list, kind) => {
        if (!list.length) return '';
        const sorted = [...list].sort((x, y) => (used.has(y) - used.has(x)) || x.localeCompare(y)), head = sorted.slice(0, 10), rest = sorted.slice(10);
        return `<div class="chips">${head.map(n => chip(n, kind)).join('')}</div>${rest.length ? `<details class="more-chips"><summary>${esc(P.showAll(sorted.length))}</summary><div class="chips">${rest.map(n => chip(n, kind)).join('')}</div></details>` : ''}`;
      };
      const grp = (label, list, kind) => list.length ? `<div class="grp"><div class="grp-h"><span>${esc(label)}</span><b>${list.length}</b></div>${chips(list, kind)}</div>` : '';
      return `<h3 style="color:${a.color}"><i class="ailogo" data-ai="${esc(id)}"></i>${esc(a.label)}</h3>
        ${top.length ? `<div class="grp"><div class="grp-h"><span>${esc(P.topSkills)}</span></div>${podium}${bars}</div>` : ''}
        ${grp(P.installed, c.skills, 'skill')}${grp(P.mcps, c.mcps, 'mcp')}${grp(P.plugins, c.plugins.map(x => x.name), 'plugin')}`;
    };
    panelBody.innerHTML = `<h2>${esc(P.hall)}</h2><p class="sub">${esc(data.host)}</p>` +
      Object.entries(data.credentials || {}).map(([id, c]) => section(id, c)).join('');
    panelBody.querySelectorAll('.ailogo[data-ai]').forEach(el => { const id = el.dataset.ai; el.appendChild(Art.aiIconEl(id, (AGENT[id] || {}).color || '#888')); });
    return;
  }
  const p = data.people.find(x => x.id === selected);
  if (!p) { selected = null; panel.hidden = true; return; }
  const col = KIND_COLOR[p.state] || '#888';
  const ctxMax = p.ctxMax || 0, ctxPct = ctxMax ? Math.min(1, p.ctx / ctxMax) : 0;
  const certs = certsOf(p);
  const tools = Object.entries(p.tools || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const toolMax = tools.length ? tools[0][1] : 1;
  const td = p.today || {};
  const clock = ts => new Date(ts).toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en', { hour: '2-digit', minute: '2-digit' });
  const hrs = ms => { const m = Math.round(ms / 60000); return m >= 60 ? `${(m / 60) | 0}h${String(m % 60).padStart(2, '0')}` : `${m}min`; };
  // last hour as a colour strip, one block per activity
  const span = 3600 * 1000, t0 = data.now - span;
  const strip = (p.timeline || []).map(g => `<i style="left:${((g.from - t0) / span * 100).toFixed(2)}%;width:${Math.max(.4, (g.to - g.from) / span * 100).toFixed(2)}%;background:${KIND_COLOR[g.kind] || '#8b9bb4'}" title="${esc(T.states[g.kind] || g.kind)} · ${clock(g.from)}–${clock(g.to)}"></i>`).join('');
  const blocks = Array.from({ length: 20 }, (_, i) => `<i class="${i < Math.round(ctxPct * 20) ? (ctxPct > .8 ? 'hi' : ctxPct > .5 ? 'mid' : 'on') : ''}"></i>`).join('');
  const now = p.doing ? (p.state === 'needs_you' && p.doing.ask ? (p.doing.ask === 'plan' ? T.help.plan : `“${p.doing.ask}”`) : `${p.doing.what || p.doing.tool}`) : (T.states[p.state] || '');
  const branch = p.branch === 'HEAD' ? 'HEAD (detached)' : p.branch;
  panelBody.innerHTML = `
    <header class="ph"><div class="ph-face"></div><div><h2>${esc(p.name)}</h2><p class="sub">${esc(p.title || '—')}</p>
      <div class="pills"><span class="pill" style="background:${agentOf(p).color}">${esc(agentOf(p).label)}</span><span class="pill" style="background:${col}">${esc(T.states[p.state] || p.state)}</span>${p.permissionMode ? `<span class="pill ghost" title="${esc(P.mode)}">${esc(P.modes[p.permissionMode] || p.permissionMode)}</span>` : ''}</div></div></header>
    ${canCompact(p) ? `<div class="actions"><button class="btn compact" data-compact-panel="${esc(p.id)}">⤓ ${esc(T.alerts.compact)} · ${Math.round(ctxPct * 100)}%</button></div>` : ''}
    <div class="actions"><button class="btn" id="btn-goto" data-id="${esc(p.id)}">›_ ${esc(p.agent === 'codex' && !p.pid ? P.gotoCodex : P.goto)}</button><span class="note" id="goto-msg"></span></div>
    ${p.coarse ? `<p class="note">${esc(T.panel.coarse)}</p>` : ''}
    <section class="card now" style="--c:${col}"><small>${esc(P.doing)}</small><p><span class="ico">${KIND_ICON[p.doing ? p.doing.kind : ''] || '•'}</span>${p.doing ? `<code>${esc(p.doing.tool)}</code> ` : ''}${esc(now)}</p>${p.doing ? `<span class="note">${esc(T.for(ago(p.doing.for)))}</span>` : ''}${p.state === 'waiting' ? `<p class="note">${esc(P.waitNote)}</p>` : ''}</section>
    ${p.lastPrompt ? `<section class="card quote"><small>${esc(P.lastPrompt)}${p.lastPromptAt ? ' · ' + esc(ago(data.now - p.lastPromptAt)) : ''}</small><p>${esc(p.lastPrompt)}</p></section>` : ''}
    ${p.lastReply ? `<section class="card quote reply"><small>${esc(P.lastReply)}${p.lastReplyAt ? ' · ' + esc(ago(data.now - p.lastReplyAt)) : ''}</small><p>${esc(p.lastReply)}</p></section>` : ''}
    <h3>${esc(P.timeline)}</h3><div class="tl">${strip}</div><div class="tl-axis"><span>${clock(t0)}</span><span>${clock(t0 + span / 2)}</span><span>${esc(P.nowLabel)}</span></div>
    <h3>${esc(P.today)}</h3><div class="stats">
      <div><b>${hrs(td.activeMs || 0)}</b><small>${esc(P.activeToday)}</small></div>
      <div><b>${Number(td.tools) || 0}</b><small>${esc(P.toolsToday)}</small></div>
      <div><b>${Number(td.prompts) || 0}</b><small>${esc(P.promptsToday)}</small></div>
      <div><b>${Number(td.files) || 0}</b><small>${esc(P.filesToday)}</small></div>
      <div><b>${fmtK(Number(td.outTokens) || 0)}</b><small>${esc(P.tokensOut)}</small></div></div>
    ${p.files && p.files.length ? `<h3>${esc(P.filesNow)}</h3><ul class="list files">${p.files.map(f => `<li><span class="k">✎</span><code title="${esc(f.repo + '/' + f.rel)}">${esc(f.rel)}</code><span class="t">${esc(ago(data.now - f.at))}</span></li>`).join('')}</ul>` : ''}
    ${p.subagents.length ? `<h3>${P.team}</h3><ul class="list">${p.subagents.map(a => `<li><span class="k">${KIND_ICON[a.state] || '•'}</span><span><b>${esc(a.type)}</b> ${esc(a.description)}${a.doing ? `<br><span class="note">${esc(a.doing)}</span>` : ''}</span></li>`).join('')}</ul>` : ''}
    ${p.usage ? `<h3>${esc(T.usage.session)}</h3><div class="stats tok"><div><b>${fmtTok(p.usage.output)}</b><small>${esc(T.usage.out)}</small></div><div><b>${fmtTok(p.usage.input + p.usage.cacheWrite)}</b><small>${esc(T.usage.in)}</small></div><div><b>${fmtTok(p.usage.cacheRead)}</b><small>${esc(T.usage.cache)}</small></div>${p.cost ? `<div class="cost" title="${esc(T.usage.costNote)}"><b>≈ ${esc(fmtUSD(p.cost.usd))}${p.cost.partial ? '+' : ''}</b><small>${esc(T.usage.cost)}</small></div>` : ''}</div>` : ''}
    ${p.ctx ? `<h3>${P.context}</h3>${ctxMax ? `<div class="blocks">${blocks}</div>` : ''}<div class="ctx-row"><span>${esc(P.tokens(fmtK(p.ctx)))}</span><span>${ctxMax ? `${Math.round(ctxPct * 100)}% / ${fmtK(ctxMax)}` : esc(P.ctxUnknown)}</span></div><p class="note">${esc(P.ctxNote)}</p>` : ''}
    <h3>${P.where}</h3><dl>
      ${p.repo ? `<dt>${P.repo}</dt><dd>${esc(p.repo.name)}${p.repo.isWorktree ? ` <span class="note">(${P.worktree})</span>` : ''}</dd>` : ''}
      ${branch ? `<dt>${P.branch}</dt><dd><code>${esc(branch)}</code></dd>` : ''}
      ${p.git ? `<dt>${esc(T.git.label)}</dt><dd>${esc([p.git.dirty ? T.git.dirty(p.git.dirty) : T.git.clean, p.git.ahead ? T.git.ahead(p.git.ahead) : '', p.git.behind ? T.git.behind(p.git.behind) : ''].filter(Boolean).join(' · '))}</dd>` : ''}
      ${p.cwd ? `<dt>${P.folder}</dt><dd><code class="path" title="${esc(p.cwd)}">${esc(p.cwd)}</code></dd>` : ''}
      ${p.model ? `<dt>${P.model}</dt><dd><code>${esc(p.model)}</code></dd>` : ''}
      <dt>${P.started}</dt><dd>${esc(ago(data.now - p.startedAt))} · ${P.turns}: ${Number(p.turns) || 0}</dd>
      <dt>${P.version}</dt><dd>${esc(p.version || '')}${p.pid ? ' · pid ' + (Number(p.pid) || '') : ''}</dd>
    </dl>
    <h3>${P.recent}</h3><ul class="list">${p.recent.map(a => `<li><span class="k">${KIND_ICON[a.kind] || '•'}</span><span><code>${esc(a.tool)}</code> ${esc(a.what)}</span><span class="t">${esc(ago(data.now - a.ts))}</span></li>`).join('') || '<li>—</li>'}</ul>
    ${tools.length ? `<h3>${P.tools}</h3><ul class="bars">${tools.map(([k, n]) => `<li><code>${esc(k)}</code><span class="tbar"><i style="width:${(n / toolMax * 100).toFixed(1)}%"></i></span><span class="t">${Number(n) || 0}</span></li>`).join('')}</ul>` : ''}
    <h3 id="certs-h">${P.certs}</h3>${certs.length ? `<div class="certs">${certs.map(c => `<div class="cert" style="--c:${certColor(c)}"><small>${T.kinds[c.kind]}</small>${esc(c.name)}${c.kind === 'badge' ? `<br><span class="note">${esc(c.desc)}</span>` : ` <span class="note">${Number(c.n) || 0}×</span>`}</div>`).join('')}</div>` : `<p class="note">${P.noCerts}</p>`}
    <p class="note" style="margin-top:18px">${P.session}: <code>${esc(p.id)}</code></p>`;
  const face = Art.portrait(p.id, p.state === 'needs_you' ? 'open' : null);
  const fb = panelBody.querySelector('.ph-face');
  fb.appendChild(face);
  fb.insertAdjacentHTML('beforeend', `<button class="ph-dice" data-avatar="${esc(p.id)}" title="${esc(P.newLook)}" aria-label="${esc(P.newLook)}">⚄</button>${avatars[p.name] ? `<button class="ph-reset" data-avatar-reset="${esc(p.id)}" title="${esc(P.resetLook)}" aria-label="${esc(P.resetLook)}">↺</button>` : ''}`);
}


overlay.addEventListener('click', e => {
  if (e.target.closest('[data-usage]')) return openReport();
  if (e.target.closest('[data-weather]')) return enableWeather(true);
  if (e.target.closest('[data-ach]')) return openReport('ach');
  if (e.target.closest('[data-switch]')) { achBump('lights'); lightsOn = !lightsOn; store.set('lights', lightsOn); lastHits = ''; renderOverlay(); return; } // wall light switch
  const cb = e.target.closest('[data-compact]');
  if (cb) return compactAgent(cb.dataset.compact, cb);
  const mc = e.target.closest('[data-certs]');
  if (mc) { showPerson(mc.dataset.certs); setTimeout(() => { const h = document.getElementById('certs-h'); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); return; }
  const el = e.target.closest('[data-id],[data-hall]');
  if (!el) return;
  const id = el.dataset.hall ? '__hall' : el.dataset.id;
  selected = selected === id ? null : id;
  camera(selected);
  renderOverlay(); renderPanel();
});
panelBody.addEventListener('click', async e => {
  const av = e.target.closest('[data-avatar],[data-avatar-reset]');
  if (av) { const p = data.people.find(x => x.id === (av.dataset.avatar || av.dataset.avatarReset)); if (p) nextAvatar(p, !!av.dataset.avatarReset); return; }
  const cp = e.target.closest('[data-compact-panel]');
  if (cp) return compactAgent(cp.dataset.compactPanel, cp);
  const b = e.target.closest('#btn-goto');
  if (!b) return;
  b.disabled = true;
  const msg = document.getElementById('goto-msg'), F = T.panel.focus;
  let out = { ok: false, reason: 'gone' };
  try { out = await fetch('api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id: b.dataset.id }) }).then(r => r.json()); } catch {}
  b.disabled = false;
  if (msg) msg.textContent = out.ok ? (out.exact ? F.ok(out.app) : F.app(out.app)) : typeof F[out.reason] === 'function' ? F[out.reason](out.app || '') : (F[out.reason] || F.unknown);
});
document.getElementById('panel-close').onclick = () => { selected = null; camera(null); renderOverlay(); renderPanel(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && building && !selected) return setBuilding(false); if (e.key === 'Escape' && selected) { selected = null; camera(null); renderOverlay(); renderPanel(); } });
