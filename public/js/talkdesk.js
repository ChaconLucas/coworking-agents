'use strict';
// ---------------- an agent's whole conversation in the side panel ----------------
// Two views of the selected agent: Summary (the panel as it was) and Conversation (a chat with a search inside it).
// The conversation is read on the server from the session's own log; only what you wrote and what it answered.
let deskSub = 'info', deskTalkSub = '', deskHelpers = [], deskTalk = null, deskTalkFor = '', deskTalkKey = '', deskTalkQ = '', deskTalkBusy = false, deskTalkDrawn = '', deskTalkTimer = 0;
const deskCanMsg = p => ['claude', 'codex'].includes(p.agent) && p.entrypoint !== 'claude-desktop' && ['idle', 'asleep'].includes(p.state);
function deskTabsHtml() {
  const C = T.chat;
  return `<div class="ptabs"><button class="${deskSub === 'info' ? 'on' : ''}" data-psub="info">${esc(C.summary)}</button>${data && data.privacy ? '' : `<button class="${deskSub === 'talk' ? 'on' : ''}" data-psub="talk">💬 ${esc(C.talk)}</button>`}</div>`;
}
const deskMark = (text, q) => {
  const t = String(text || ''); if (!q) return esc(t);
  const low = t.toLowerCase(), out = []; let i = 0, k;
  while ((k = low.indexOf(q, i)) >= 0) { out.push(esc(t.slice(i, k)), '<mark>', esc(t.slice(k, k + q.length)), '</mark>'); i = k + q.length; }
  out.push(esc(t.slice(i))); return out.join('');
};
// **bold** and `code` on already escaped text
const deskMd = h => h.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
function deskTalkList(p) {
  const C = T.chat, r = deskTalk, q = deskTalkQ.toLowerCase();
  if (!r) return `<p class="note">…</p>`;
  if (!r.ok) return `<p class="note">⚠ ${esc(C.fail[r.reason] || r.reason || '?')}</p>`;
  if (!r.items.length) return `<p class="note">${esc(q ? C.none : C.empty)}</p>`;
  const when = ms => { const x = new Date(ms), today = new Date().toDateString() === x.toDateString(); return x.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en', today ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  return (q ? `<p class="note">${esc(C.found(r.found))}</p>` : r.cut || r.total > r.items.length ? `<p class="note">${esc(C.cut)}</p>` : '')
    + r.items.map(m => `<div class="bubble ${m.role === 'user' ? 'me' : 'it'}"><p>${deskMd(deskMark(m.text, q))}</p><small>${(h => m.role === 'user' ? esc(h ? p.name : C.you) : esc(h ? h.type : p.name))(deskHelpers.find(x => x.id === deskTalkSub))}${m.at ? ' · ' + esc(when(m.at)) : ''}</small></div>`).join('');
}
// the agent itself and each of its helpers (subagents), newest first; a dot marks the ones still working
function deskHelpersHtml() {
  const C = T.chat; if (!deskHelpers.length) return '';
  const cur = deskHelpers.find(h => h.id === deskTalkSub);
  return `<div class="phelpers"><button class="${deskTalkSub ? '' : 'on'}" data-psubag="">${esc(C.main)}</button>${deskHelpers.map(h => `<button class="${h.id === deskTalkSub ? 'on' : ''}" data-psubag="${esc(h.id)}" title="${esc(h.what)}">${h.live ? '● ' : ''}${esc(h.type)}</button>`).join('')}</div>
    ${cur ? `<p class="note">🤖 ${esc(C.helperOf(cur.type))}${cur.what ? ': ' + esc(cur.what) : ''}</p>` : `<p class="note">${esc(C.helpers(deskHelpers.length))}</p>`}`;
}
async function deskLoadTalk(p, toEnd) {
  if (deskTalkBusy) return; deskTalkBusy = true;
  const id = p.id, r = await fetch(`api/talk?id=${encodeURIComponent(id)}&q=${encodeURIComponent(deskTalkQ)}&sub=${encodeURIComponent(deskTalkSub)}`).then(x => x.json()).catch(() => ({ ok: false, reason: 'unknown' }));
  deskTalkBusy = false;
  if (selected !== id || deskSub !== 'talk') return;
  deskTalk = r; deskTalkFor = id; if (r.helpers) deskHelpers = r.helpers;
  const hb = document.getElementById('ptalk-helpers'); if (hb) hb.innerHTML = deskHelpersHtml();
  const box = panelBody.querySelector('.ptalk-box'); if (box) box.hidden = !!deskTalkSub; // a helper takes no messages
  const list = document.getElementById('ptalk-list');
  const atEnd = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 140;
  if (list) list.innerHTML = deskTalkList(p);
  if (list && (toEnd || atEnd) && !deskTalkQ) panel.scrollTop = panel.scrollHeight;
}
// called by renderPanel: draws the conversation view and returns true, or false for the summary
function deskTalkOn(p) {
  if (deskSub !== 'talk' || (data && data.privacy)) return false;
  const C = T.chat, key = `${p.state}|${p.lastReplyAt}|${p.lastPromptAt}`;
  if (deskTalkFor !== p.id) { deskTalk = null; deskTalkQ = ''; deskTalkKey = ''; deskTalkDrawn = ''; deskTalkSub = ''; deskHelpers = []; }
  const shell = `${p.id}|${p.state}|${deskCanMsg(p)}|${lang}`;
  if (shell !== deskTalkDrawn || !document.getElementById('ptalk-list')) { // the frame only when it changes; the list fills in place
    deskTalkDrawn = shell;
    panelBody.innerHTML = `<header class="ph"><div class="ph-face"></div><div><h2>${esc(p.name)}</h2><p class="sub">${esc(p.title || '—')}</p>
      <div class="pills"><span class="pill" style="background:${agentOf(p).color}">${esc(agentOf(p).label)}</span><span class="pill" style="background:${KIND_COLOR[p.state] || '#888'}">${esc(T.states[p.state] || p.state)}</span></div></div></header>
      ${deskTabsHtml()}<div id="ptalk-helpers">${deskHelpersHtml()}</div><input type="search" class="ptalk-q" data-ptalkq placeholder="${esc(C.search)}" value="${esc(deskTalkQ)}"><div id="ptalk-list">${deskTalkList(p)}</div>
      <div class="card ptalk-box"${deskTalkSub ? ' hidden' : ''}>${deskCanMsg(p) ? `<textarea data-ptalk-text rows="3" placeholder="${esc(C.write)}"></textarea><p><button class="btn small" data-ptalk-send="${esc(p.id)}">➤ ${esc(C.send)}</button> <small class="note" data-ptalk-msg></small></p>` : `<p class="note">${esc(C.onlyIdle)}</p>`}</div>`;
    panelBody.querySelector('.ph-face').appendChild(Art.portrait(p.id, p.state === 'needs_you' ? 'open' : null));
  }
  if (key !== deskTalkKey || !deskTalk) { const first = !deskTalk; deskTalkKey = key; deskLoadTalk(p, first); }
  return true;
}
panelBody.addEventListener('click', async e => {
  const t = e.target.closest('[data-psub]');
  if (t) { deskSub = t.dataset.psub; deskTalkDrawn = ''; deskTalk = null; deskTalkKey = ''; renderPanel(); return; }
  const sa = e.target.closest('[data-psubag]');
  if (sa) { deskTalkSub = sa.dataset.psubag; deskTalk = null; const p = data && data.people.find(x => x.id === selected); const list = document.getElementById('ptalk-list'); if (list) list.innerHTML = '<p class="note">…</p>'; if (p) deskLoadTalk(p, true); return; }
  const s = e.target.closest('[data-ptalk-send]'); if (!s) return;
  const ta = panelBody.querySelector('[data-ptalk-text]'), m = panelBody.querySelector('[data-ptalk-msg]'), text = ta ? ta.value.trim() : '';
  if (!text) return ta && ta.focus();
  s.disabled = true;
  const r = await fetch('api/reply', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id: s.dataset.ptalkSend, text }) }).then(x => x.json()).catch(() => ({ ok: false, reason: 'unknown' }));
  s.disabled = false;
  if (r.ok) { ta.value = ''; ta.blur(); }
  if (m) m.textContent = r.ok ? '✓' : '⚠ ' + (T.chat.fail[r.reason] || r.reason || '?');
});
panelBody.addEventListener('input', e => {
  if (!e.target.matches('[data-ptalkq]')) return;
  clearTimeout(deskTalkTimer);
  deskTalkTimer = setTimeout(() => { deskTalkQ = e.target.value.trim().slice(0, 100); const p = data && data.people.find(x => x.id === selected); if (p) deskLoadTalk(p, !deskTalkQ); }, 350);
});
