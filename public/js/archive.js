'use strict';
// ---------------- the conversation archive ----------------
// Every conversation on disk, open or closed (the last 60 days): find one by name, folder or what was said,
// then read it as a chat, with its helpers and a search inside it. Nothing here writes anything.
let arcList = null, arcQ = '', arcOpen = null, arcTalk = null, arcTalkQ = '', arcSub = '', arcTimer = 0;
async function arcLoad() {
  const r = await api('api/archive?q=' + encodeURIComponent(arcQ));
  arcList = r; if (reportTab === 'archive' && !arcOpen) arcDrawList();
}
async function arcLoadTalk(toTop) {
  const o = arcOpen; if (!o) return;
  const r = await api(`api/archive-talk?agent=${encodeURIComponent(o.agent)}&id=${encodeURIComponent(o.id)}&q=${encodeURIComponent(arcTalkQ)}&sub=${encodeURIComponent(arcSub)}`);
  if (arcOpen !== o) return;
  if (r.helpers) o.helpers = r.helpers;
  arcTalk = r; const list = document.getElementById('arc-chat'); if (list) list.innerHTML = arcChatHtml();
  const hb = document.getElementById('arc-helpers'); if (hb) hb.innerHTML = arcHelpersHtml();
  const box = reportEl.querySelector('.report-body'); if (box && !toTop && !arcTalkQ) box.scrollTop = box.scrollHeight;
}
const arcWhen = ms => new Date(ms).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
function arcChatHtml() {
  const C = T.chat, A = T.archive, r = arcTalk, q = arcTalkQ.toLowerCase(), o = arcOpen, h = (o.helpers || []).find(x => x.id === arcSub);
  if (!r) return `<p class="note">…</p>`;
  if (!r.ok) return `<p class="note">⚠ ${esc(C.fail[r.reason] || r.reason || '?')}</p>`;
  if (!r.items.length) return `<p class="note">${esc(q ? C.none : C.empty)}</p>`;
  return (q ? `<p class="note">${esc(C.found(r.found))}</p>` : r.cut || r.total > r.items.length ? `<p class="note">${esc(C.cut)}</p>` : '')
    + r.items.map(m => `<div class="bubble ${m.role === 'user' ? 'me' : 'it'}"><p>${deskMd(deskMark(m.text, q))}</p><small>${m.role === 'user' ? esc(h ? A.mainAgent : C.you) : esc(h ? h.type : o.agent === 'codex' ? 'Codex' : 'Claude')}${m.at ? ' · ' + esc(arcWhen(m.at)) : ''}</small></div>`).join('');
}
function arcHelpersHtml() {
  const C = T.chat, hs = (arcOpen && arcOpen.helpers) || []; if (!hs.length) return '';
  return `<div class="phelpers"><button class="${arcSub ? '' : 'on'}" data-arc-sub="">${esc(C.main)}</button>${hs.map(h => `<button class="${h.id === arcSub ? 'on' : ''}" data-arc-sub="${esc(h.id)}" title="${esc(h.what)}">${esc(h.type)}</button>`).join('')}</div>`;
}
function arcDrawList() {
  const A = T.archive, body = reportEl.querySelector('.report-body'), r = arcList, live = new Set(data ? data.people.map(p => p.id) : []);
  const row = x => `<li><button class="arc-row" data-arc-open="${esc(x.agent)}|${esc(x.id)}"><i class="ailogo" data-ai="${esc(x.agent)}"></i><span class="arc-txt"><b>${esc(x.title || A.untitled)}</b><small>${x.cwd ? esc(x.cwd) + ' · ' : ''}${esc(arcWhen(x.at))}${live.has(x.id) ? ' · ● ' + esc(A.open) : ''}</small>${x.first ? `<small class="arc-first">${esc(x.first)}</small>` : ''}</span></button></li>`;
  const focus = document.activeElement && document.activeElement.matches('[data-arc-q]');
  body.innerHTML = tabsHtml() + `<h2>🗄 ${esc(A.title)}</h2><p class="sub">${esc(A.sub)}</p>
    <input type="search" class="ptalk-q" data-arc-q placeholder="${esc(A.search)}" value="${esc(arcQ)}">
    ${!r ? `<p class="note">…</p>` : !r.ok ? `<p class="note">⚠ ${esc(T.chat.fail[r.reason] || r.reason)}</p>` : `
      <h3>${esc(A.list(r.items.length, r.total))}</h3>${r.items.length ? `<ul class="arc-list">${r.items.map(row).join('')}</ul>` : `<p class="note">${esc(A.none)}</p>`}
      ${r.hits && r.hits.length ? `<h3>${esc(A.said(r.hits.length))}</h3><ul class="arc-list">${r.hits.map(x => `<li><button class="arc-row" data-arc-open="${esc(x.agent)}|${esc(x.id)}" data-arc-q-in="${esc(arcQ)}"><i class="ailogo" data-ai="${esc(x.agent)}"></i><span class="arc-txt"><small>${esc(x.role === 'user' ? T.chat.you : x.agent === 'codex' ? 'Codex' : 'Claude')} · ${esc(arcWhen(x.at))}</small><span>${deskMark(x.snippet, arcQ.toLowerCase())}</span></span></button></li>`).join('')}</ul>` : ''}`}`;
  body.querySelectorAll('.ailogo[data-ai]').forEach(el => { const id = el.dataset.ai; el.appendChild(Art.aiIconEl(id, (AGENT[id] || {}).color || '#888')); });
  if (focus) { const i = body.querySelector('[data-arc-q]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
function arcDrawTalk() {
  const A = T.archive, body = reportEl.querySelector('.report-body'), o = arcOpen;
  body.innerHTML = tabsHtml() + `<p><button class="tback" data-arc-back>${esc(A.back)}</button></p><h2>${esc(o.title || A.untitled)}</h2><p class="sub">${esc(o.agent === 'codex' ? 'Codex' : 'Claude Code')}${o.cwd ? ' · ' + esc(o.cwd) : ''}${o.at ? ' · ' + esc(arcWhen(o.at)) : ''}</p>
    <div id="arc-helpers">${arcHelpersHtml()}</div><input type="search" class="ptalk-q" data-arc-tq placeholder="${esc(T.chat.search)}" value="${esc(arcTalkQ)}"><div id="arc-chat" class="arc-chat">${arcChatHtml()}</div>`;
}
function renderArchive() { if (arcOpen) arcDrawTalk(); else { arcDrawList(); if (!arcList) arcLoad(); } }
reportEl.addEventListener('click', e => {
  if (reportTab !== 'archive') return;
  const op = e.target.closest('[data-arc-open]');
  if (op) { const [agent, id] = op.dataset.arcOpen.split('|'), x = (arcList && arcList.items.find(i => i.id === id)) || { agent, id, title: '' }; arcOpen = { ...x, helpers: [] }; arcTalk = null; arcSub = ''; arcTalkQ = op.dataset.arcQIn || ''; arcDrawTalk(); arcLoadTalk(!!arcTalkQ); return; }
  if (e.target.closest('[data-arc-back]')) { arcOpen = null; arcTalk = null; arcDrawList(); return; }
  const sb = e.target.closest('[data-arc-sub]'); if (sb) { arcSub = sb.dataset.arcSub; arcTalk = null; const c = document.getElementById('arc-chat'); if (c) c.innerHTML = '<p class="note">…</p>'; arcLoadTalk(true); }
});
reportEl.addEventListener('input', e => {
  if (reportTab !== 'archive') return;
  if (e.target.matches('[data-arc-q]')) { clearTimeout(arcTimer); arcTimer = setTimeout(() => { arcQ = e.target.value.trim().slice(0, 100); arcLoad(); }, 400); }
  if (e.target.matches('[data-arc-tq]')) { clearTimeout(arcTimer); arcTimer = setTimeout(() => { arcTalkQ = e.target.value.trim().slice(0, 100); arcLoadTalk(true); }, 350); }
});
