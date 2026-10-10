'use strict';
// ---------------- HTML labels (crisp text) ----------------
function ago(ms) {
  const s = Math.max(0, ms / 1000) | 0, a = T.ago;
  if (s < 60) return s + a.s;
  if (s < 3600) return ((s / 60) | 0) + a.m;
  if (s < 86400) return ((s / 3600) | 0) + a.h;
  return ((s / 86400) | 0) + a.d;
}

function stateText(p) {
  const base = T.states[p.state] || p.state;
  if (p.doing && ['edit', 'read', 'terminal', 'web', 'skill', 'mcp', 'delegate', 'other'].includes(p.state)) return `${base}${p.doing.what ? ' · ' + p.doing.what : ''}${p.doing.for > 60000 ? ' · ' + T.for(ago(p.doing.for)) : ''}`;
  if (p.state === 'waiting' && p.doing) return `${p.doing.tool} ${T.for(ago(p.doing.for))}`;
  if (p.state === 'idle' || p.state === 'asleep') return `${base} · ${ago(data.now - (p.since || p.lastActivity))}`;
  return base;
}

function shortName(n) { const parts = String(n).split('-'); return parts.length > 1 && parts[parts.length - 1].length >= 2 ? parts[parts.length - 1] : String(n).slice(0, 10); }

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

let lastHits = '', lastTags = '';
const hitsLayer = document.createElement('div'), tagsLayer = document.createElement('div');
overlay.append(hitsLayer, tagsLayer);
function renderOverlay() {
  // two layers: hit areas rarely change (so they keep their tooltip); labels change every second
  const parts = [], tags = [];
  for (const cell of layout) {
    const { p, x, y } = cell;
    const cls = p.state === 'needs_you' ? 'need' : p.state === 'waiting' ? 'wait' : '';
    const repo = p.repo ? `${p.repo.name}${p.branch && p.branch !== 'HEAD' ? ' · ' + p.branch : ''}` : '';
    parts.push(`<div class="desk-hit" data-id="${esc(p.id)}" style="left:${x * S}px;top:${(y + 14) * S}px;width:${CELL_W * S}px;height:${54 * S}px"></div>`);
    tags.push(`<button class="tag ${cls} ${selected === p.id ? 'sel' : ''}" data-id="${esc(p.id)}" style="left:${(x + CELL_W / 2) * S}px;top:${(y + 72) * S}px;max-width:${CELL_W * S - 8}px">
      <span class="nm" style="--ag:${agentOf(p).color}" title="${esc(agentOf(p).label)}">${esc(p.name)}</span>
      <span class="tt" title="${esc(p.title)}">${esc(p.title || repo || '—')}</span>
      <span class="st">${esc(stateText(p))}${repo && p.title ? ' · ' + esc(repo) : ''}</span></button>`);
    for (const c of cell.certs || []) {
      const label = c.c.kind === 'badge' ? `${T.kinds.badge}: ${c.c.name} — ${c.c.desc}` : `${T.kinds[c.c.kind]}: ${c.c.name} (${c.c.n}×)`;
      parts.push(`<div class="hit" title="${esc(label)}" style="left:${c.x * S}px;top:${c.y * S}px;width:${c.w * S}px;height:${c.h * S}px"></div>`);
    }
    if (canCompact(p)) tags.push(`<button class="compact-btn" data-compact="${esc(p.id)}" title="${esc(T.alerts.compactTitle(Math.round(ctxPct(p) * 100)))}" style="left:${(x + CELL_W / 2) * S}px;top:${(y + 6) * S}px">⤓ ${esc(T.alerts.compact)} ${Math.round(ctxPct(p) * 100)}%</button>`);
    if (cell.extraCerts) parts.push(`<button class="more-certs" data-certs="${esc(p.id)}" title="${esc(T.moreCerts(cell.extraCerts))}" style="left:${(x + CELL_W - 26) * S}px;top:${(y + 4) * S}px">+${cell.extraCerts}</button>`);
    (cell.interns || []).slice(0, 2).forEach((a, i) => {
      const ix = i ? x + 1 : x + CELL_W - 17;
      parts.push(`<div class="hit" title="${esc(a.type)}${a.description ? ': ' + esc(a.description) : ''}${a.doing ? ' — ' + esc(a.doing) : ''}" style="left:${ix * S}px;top:${(y + 40) * S}px;width:${16 * S}px;height:${24 * S}px"></div>`);
    });
    // whoever went to the kitchen stays clickable there
    const a = cell.actor;
    if (a && a.mode !== 'desk' && a.mode !== 'walk') parts.push(`<div class="desk-hit" data-id="${esc(p.id)}" title="${esc(p.name)} · ${esc(T.states[p.state] || '')}" style="left:${Math.round(a.x) * S}px;top:${Math.round(a.y - 2) * S}px;width:${18 * S}px;height:${24 * S}px"></div>`);
  }
  // room signs and names of whoever is away from their desk
  for (const R of rooms) {
    const g = roomGit(R), G = T.git;
    const gitTxt = g ? `${g.dirty ? `<b class="g-dirty">●${g.dirty}</b>` : ''}${g.ahead ? `<b class="g-up">↑${g.ahead}</b>` : ''}${g.behind ? `<b class="g-down">↓${g.behind}</b>` : ''}` : '';
    const gitTitle = g ? ' · ' + [g.dirty ? G.dirty(g.dirty) : G.clean, g.ahead ? G.ahead(g.ahead) : '', g.behind ? G.behind(g.behind) : ''].filter(Boolean).join(' · ') : '';
    tags.push(`<span class="room-sign" style="left:${(R.x + 12) * S}px;top:${(R.y - 1) * S}px;max-width:${(R.w - 16) * S}px" title="${esc(R.name + gitTitle)}"><span class="rs-name">${esc(R.name)}</span> <em>${R.people.length}</em>${gitTxt}</span>`);
  }
  for (const cell of layout) {
    const a = cell.actor;
    if (!a || a.mode === 'desk' || a.mode === 'walk' || a.mode === 'meet') continue;
    // side by side on the sofa the labels would overlap: short name, alternating heights
    const seat = a.spot && spots.sofa.indexOf(a.spot);
    const lift = seat >= 0 ? (seat % 2 ? 19 : 10) : a.mode === 'nap' ? 6 : 10;
    const label = seat >= 0 ? shortName(cell.p.name) : cell.p.name;
    tags.push(`<span class="away" title="${esc(cell.p.name)}" style="left:${(a.x + 8) * S}px;top:${(a.y - lift) * S}px">${esc(label)}</span>`);
  }
  // meeting room: who leads, which subagents, and the total on the TV
  meetInfo.people.forEach((m, i) => {
    // neighbours sit 32px apart: alternate the label height so they never touch
    const lift = (m.spot.pose === 'back' ? -26 : m.spot.pose === 'stand' ? 4 : 6) + (i % 2 ? (m.spot.pose === 'back' ? -9 : 9) : 0);
    tags.push(`<span class="away ${m.lead ? '' : 'intern'}" title="${esc(m.title || m.label)}" style="left:${(m.spot.x + 8) * S}px;top:${(m.spot.y - lift) * S}px">${esc(m.lead ? shortName(m.label) : m.label)}</span>`);
  });
  if (meetInfo.subTotal) tags.push(`<span class="tv-count" style="left:${(RX + 17) * S}px;top:${(wing.meet + 34) * S}px">${esc(T.subagents(meetInfo.subTotal))}${meetInfo.subTotal > meetInfo.shown ? ' · +' + (meetInfo.subTotal - meetInfo.shown) : ''}</span>`);
  if (napBox) tags.push(`<span class="room-sign" style="left:${(napBox.x + 10) * S}px;top:${(napBox.y - 2) * S}px">${esc(T.restRoom)}</span>`);
  for (const wb of windowBoxes) parts.push(`<button class="wall-switch" data-weather="1" title="${esc(weather ? T.weather.now(weather.temp) : T.weather.ask)}" style="left:${wb.x * S}px;top:${wb.y * S}px;width:${wb.w * S}px;height:${wb.h * S}px"></button>`);
  if (usageBox) parts.push(`<button class="wall-switch usage-hit" data-usage="1" title="${esc(usageGauges().map(m => `${m.label}: ${Math.round(m.pct)}%${m.resetsAt ? ` (${T.usage.resets} ${untilText(m.resetsAt)})` : ''}`).concat([T.usage.open]).join('\n'))}" style="left:${usageBox.x * S}px;top:${usageBox.y * S}px;width:${usageBox.w * S}px;height:${usageBox.h * S}px"></button>`);
  if (switchBox) parts.push(`<button class="wall-switch" data-switch="1" title="${esc(T.lights)}" aria-pressed="${lightsOn}" style="left:${switchBox.x * S}px;top:${switchBox.y * S}px;width:${switchBox.w * S}px;height:${switchBox.h * S}px"></button>`);
  if (boardBox && data) { const c = counts(); parts.push(`<div class="hit" title="${c.work} ${esc(T.working)} · ${c.need} ${esc(T.needYou)} · ${c.turn} ${esc(T.yourTurn)} · ${c.sleep} ${esc(T.asleep)}" style="left:${boardBox.x * S}px;top:${boardBox.y * S}px;width:${boardBox.w * S}px;height:${boardBox.h * S}px"></div>`); }
  const box = (b, attr, title) => b ? parts.push(`<button class="wall-switch" ${attr} title="${esc(title)}" style="left:${b.x * S}px;top:${b.y * S}px;width:${b.w * S}px;height:${b.h * S}px"></button>`) : 0;
  { const m = usageData && usageData.month && usageData.month.top && usageData.month.top[0], live = m && data && data.people.find(p => p.id === m.id);
    box(aotmBox, 'data-ach="1"', m ? T.ach.aotmTip((live && live.name) || m.title || m.id.slice(0, 8), Math.round(m.activeMs / 36e5), m.tools) : T.ach.noMonth); }
  box(trophyBox, 'data-ach="1"', T.ach.shelfTip);
  { const working = data ? data.people.filter(p => !p.leaving && !['idle', 'asleep', 'needs_you', 'waiting'].includes(p.state)).length : 0;
    box(moodBox, '', T.mood[!working ? 'calm' : officeMood() === 'rush' ? 'rush' : 'normal']); }
  box(radioBox, 'data-radio="1"', radioOn ? T.radio.on : T.radio.off);
  box(caseBox, 'data-ach="1"', T.trophyRoom);
  box(neonBox, 'data-neon="1"', '</>');
  box(noticeBox, '', T.noticeTitle + '\n' + (boardFiles.map(f => `${f.rel} · ${f.repo}${f.n > 1 ? ' · ' + f.n + '×' : ''}`).join('\n') || T.noticeNone));
  box(tvBox, '', meetInfo.people.filter(m => !m.lead).map(m => m.title || m.label).join('\n'));
  if (clockBox && data) { // first activity today of every conversation (from the daily report), earliest first
    const ins = clockIns().slice(0, 12);
    box(clockBox, 'data-clock="1"', T.clockIn + '\n' + (ins.map(x => `${new Date(x.first).toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en', { hour: '2-digit', minute: '2-digit' })}  ${x.name || x.title || x.id.slice(0, 8)}`).join('\n') || T.clockNone)); }
  { const th = idleThought(); if (th) tags.push(`<span class="thought" style="left:${(th.c.actor.x + 8) * S}px;top:${(th.c.actor.y - 6) * S}px">${esc(th.text)}</span>`); }
  if (hallBox) parts.push(`<div class="desk-hit" data-hall="1" title="${esc(T.panel.hall)}" style="left:${hallBox.x * S}px;top:${hallBox.y * S}px;width:${hallBox.w * S}px;height:${hallBox.h * S}px"></div>`);
  const h = parts.join(''), g = tags.join('');
  if (h !== lastHits) { hitsLayer.innerHTML = h; lastHits = h; }
  if (g !== lastTags) { tagsLayer.innerHTML = g; lastTags = g; }
}

// git state of a room: summed over its distinct checkouts (a room can hold a repo and its worktrees)
function roomGit(R) {
  const seen = new Map();
  for (const p of R.people) if (p.git) seen.set((p.repo && (p.repo.worktree || p.repo.name)) || p.id, p.git);
  if (!seen.size) return null;
  const all = [...seen.values()];
  return { dirty: all.reduce((n, g) => n + g.dirty, 0), ahead: Math.max(...all.map(g => g.ahead)), behind: Math.max(...all.map(g => g.behind)) };
}
