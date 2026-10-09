'use strict';
// ---------------- side panel ----------------
const panel = document.getElementById('panel'), panelBody = document.getElementById('panel-body');
function fmtK(n) { return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n); }
const KIND_ICON = { edit: '✎', read: '◉', terminal: '›_', web: '◍', delegate: '⚑', skill: '✦', mcp: '⚡', other: '•', ask: '?', thinking: '…' };

function renderPanel() {
  document.body.classList.toggle('panel-open', !!(selected && data));
  if (!selected || !data) { panel.hidden = true; return; }
  panel.hidden = false;
  const P = T.panel;
  if (selected === '__hall') {
    const section = (id, c) => {
      const a = AGENT[id] || { label: id, color: '#888' };
      return `<h3 style="color:${a.color}">${esc(a.label)}</h3>
      ${c.topSkills.length ? `<p class="note">${esc(P.topSkills)}</p><ul class="list">${c.topSkills.map((s, i) => `<li><span class="k">${['🥇', '🥈', '🥉'][i] || '·'}</span>${esc(s.name)}<span class="t">${Number(s.count) || 0}×</span></li>`).join('')}</ul>` : ''}
      ${c.skills.length ? `<p class="note">${esc(P.installed)}</p><div class="certs">${c.skills.map(s => `<div class="cert" style="--c:${CERT.skill}"><small>${T.kinds.skill}</small>${esc(s)}</div>`).join('')}</div>` : ''}
      ${c.mcps.length ? `<p class="note">${esc(P.mcps)}</p><div class="certs">${c.mcps.map(s => `<div class="cert" style="--c:${CERT.mcp}"><small>MCP</small>${esc(s)}</div>`).join('')}</div>` : ''}
      ${c.plugins.length ? `<p class="note">${esc(P.plugins)}</p><ul class="list">${c.plugins.map(s => `<li>${esc(s.name)}<span class="t">${Number(s.count) || 0}×</span></li>`).join('')}</ul>` : ''}`;
    };
    panelBody.innerHTML = `<h2>${esc(P.hall)}</h2><p class="sub">${esc(data.host)}</p>` +
      Object.entries(data.credentials || {}).map(([id, c]) => section(id, c)).join('');
    return;
  }
  const p = data.people.find(x => x.id === selected);
  if (!p) { selected = null; panel.hidden = true; return; }
  const col = KIND_COLOR[p.state] || '#888';
  const ctxMax = p.ctxMax || (p.ctx > 2e5 ? 1e6 : 2e5), ctxPct = Math.min(1, p.ctx / ctxMax);
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
    <div class="actions"><button class="btn" id="btn-goto" data-id="${esc(p.id)}">›_ ${esc(p.agent === 'codex' && !p.pid ? P.gotoCodex : P.goto)}</button><span class="note" id="goto-msg"></span></div>
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
    ${p.ctx ? `<h3>${P.context}</h3><div class="blocks">${blocks}</div><div class="ctx-row"><span>${esc(P.tokens(fmtK(p.ctx)))}</span><span>${Math.round(ctxPct * 100)}% / ${fmtK(ctxMax)}</span></div><p class="note">${esc(P.ctxNote)}</p>` : ''}
    <h3>${P.where}</h3><dl>
      ${p.repo ? `<dt>${P.repo}</dt><dd>${esc(p.repo.name)}${p.repo.isWorktree ? ` <span class="note">(${P.worktree})</span>` : ''}</dd>` : ''}
      ${branch ? `<dt>${P.branch}</dt><dd><code>${esc(branch)}</code></dd>` : ''}
      ${p.cwd ? `<dt>${P.folder}</dt><dd><code class="path" title="${esc(p.cwd)}">${esc(p.cwd)}</code></dd>` : ''}
      ${p.model ? `<dt>${P.model}</dt><dd><code>${esc(p.model)}</code></dd>` : ''}
      <dt>${P.started}</dt><dd>${esc(ago(data.now - p.startedAt))} · ${P.turns}: ${Number(p.turns) || 0}</dd>
      <dt>${P.version}</dt><dd>${esc(p.version || '')}${p.pid ? ' · pid ' + (Number(p.pid) || '') : ''}</dd>
    </dl>
    <h3>${P.recent}</h3><ul class="list">${p.recent.map(a => `<li><span class="k">${KIND_ICON[a.kind] || '•'}</span><span><code>${esc(a.tool)}</code> ${esc(a.what)}</span><span class="t">${esc(ago(data.now - a.ts))}</span></li>`).join('') || '<li>—</li>'}</ul>
    ${tools.length ? `<h3>${P.tools}</h3><ul class="bars">${tools.map(([k, n]) => `<li><code>${esc(k)}</code><span class="bar"><i style="width:${(n / toolMax * 100).toFixed(1)}%"></i></span><span class="t">${Number(n) || 0}</span></li>`).join('')}</ul>` : ''}
    <h3 id="certs-h">${P.certs}</h3>${certs.length ? `<div class="certs">${certs.map(c => `<div class="cert" style="--c:${certColor(c)}"><small>${T.kinds[c.kind]}</small>${esc(c.name)}${c.kind === 'badge' ? `<br><span class="note">${esc(c.desc)}</span>` : ` <span class="note">${Number(c.n) || 0}×</span>`}</div>`).join('')}</div>` : `<p class="note">${P.noCerts}</p>`}
    <p class="note" style="margin-top:18px">${P.session}: <code>${esc(p.id)}</code></p>`;
  const face = Art.portrait(p.id, p.state === 'needs_you' ? 'open' : null);
  panelBody.querySelector('.ph-face').appendChild(face);
}


overlay.addEventListener('click', e => {
  const mc = e.target.closest('[data-certs]');
  if (mc) { showPerson(mc.dataset.certs); setTimeout(() => { const h = document.getElementById('certs-h'); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); return; }
  const el = e.target.closest('[data-id],[data-hall]');
  if (!el) return;
  const id = el.dataset.hall ? '__hall' : el.dataset.id;
  selected = selected === id ? null : id;
  renderOverlay(); renderPanel();
});
panelBody.addEventListener('click', async e => {
  const b = e.target.closest('#btn-goto');
  if (!b) return;
  b.disabled = true;
  const msg = document.getElementById('goto-msg'), F = T.panel.focus;
  let out = { ok: false, reason: 'gone' };
  try { out = await fetch('api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id: b.dataset.id }) }).then(r => r.json()); } catch {}
  b.disabled = false;
  if (msg) msg.textContent = out.ok ? (out.exact ? F.ok(out.app) : F.app(out.app)) : typeof F[out.reason] === 'function' ? F[out.reason](out.app || '') : (F[out.reason] || F.unknown);
});
document.getElementById('panel-close').onclick = () => { selected = null; renderOverlay(); renderPanel(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && building && !selected) return setBuilding(false); if (e.key === 'Escape' && selected) { selected = null; renderOverlay(); renderPanel(); } });
