'use strict';
// ---------------- keyboard shortcuts + quick search ----------------
// 1–9 open the n-th agent · N next agent that needs you · / search · R usage report · D today's report · L lights · B building · ? help
const searchEl = document.createElement('div');
searchEl.className = 'search'; searchEl.hidden = true;
searchEl.innerHTML = '<input type="search" autocomplete="off" spellcheck="false"><ul></ul>';
document.body.appendChild(searchEl);
const sInput = searchEl.querySelector('input'), sList = searchEl.querySelector('ul');
let sSel = 0;

function openSearch() { searchEl.hidden = false; sInput.placeholder = T.keys.search; sInput.value = ''; sSel = 0; renderSearch(); sInput.focus(); }
function closeSearch() { searchEl.hidden = true; }
function searchHits() {
  const q = sInput.value.trim().toLowerCase();
  return data.people.filter(p => !p.leaving && (!q || [p.name, p.title, p.repo && p.repo.name, (AGENT[p.agent] || {}).label, T.states[p.state]].some(v => String(v || '').toLowerCase().includes(q)))).slice(0, 12);
}
function renderSearch() {
  const hits = searchHits();
  if (sSel >= hits.length) sSel = Math.max(0, hits.length - 1);
  sList.innerHTML = hits.map((p, i) => `<li class="${i === sSel ? 'on' : ''}" data-id="${esc(p.id)}"><i style="background:${KIND_COLOR[p.state] || '#888'}"></i><b>${esc(p.name)}</b><span>${esc(p.title || '')}</span><em>${esc(p.repo ? p.repo.name : '')} · ${esc(T.states[p.state] || '')}</em></li>`).join('') || `<li class="none">${esc(T.keys.none)}</li>`;
}
sInput.addEventListener('input', () => { sSel = 0; renderSearch(); });
sInput.addEventListener('keydown', e => {
  const hits = searchHits();
  if (e.key === 'ArrowDown') { sSel = Math.min(hits.length - 1, sSel + 1); renderSearch(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { sSel = Math.max(0, sSel - 1); renderSearch(); e.preventDefault(); }
  else if (e.key === 'Enter' && hits[sSel]) { closeSearch(); showPerson(hits[sSel].id); }
  else if (e.key === 'Escape') { closeSearch(); e.stopPropagation(); }
});
sList.addEventListener('click', e => { const li = e.target.closest('[data-id]'); if (li) { closeSearch(); showPerson(li.dataset.id); } });
searchEl.addEventListener('click', e => { if (e.target === searchEl) closeSearch(); });

let needIdx = 0;
document.addEventListener('keydown', e => {
  if (!data || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  const k = e.key;
  if (/^[1-9]$/.test(k)) { const p = layout[Number(k) - 1]; if (p) showPerson(p.p.id); }
  else if (k === 'n' || k === 'N') {
    const need = data.people.filter(p => p.state === 'needs_you' || p.state === 'waiting');
    if (need.length) { const p = need[needIdx++ % need.length]; openTalk(p.id); } else toast(`<b>${esc(T.keys.noneNeed)}</b>`, 'ok');
  }
  else if (k === '/') { e.preventDefault(); openSearch(); }
  else if (k === 'r' || k === 'R') openReport();
  else if (k === 't' || k === 'T') openReport('today');
  else if (k === 'g' || k === 'G') openReport('feed');
  else if (k === 'c' || k === 'C') openReport('ach');
  else if (k === 'q' || k === 'Q') openReport('queue');
  else if (k === 'e' || k === 'E') { decorOn = !decorOn; store.set('decor', decorOn); toast(`<b>${esc(decorOn ? T.decorOn : T.decorOff)}</b>`, 'ok'); }
  else if (k === 'f' || k === 'F') document.getElementById('btn-focus').click();
  else if (k === 'l' || k === 'L') { achBump('lights'); lightsOn = !lightsOn; store.set('lights', lightsOn); lastHits = ''; renderOverlay(); }
  else if (k === 'b' || k === 'B') { if (floors.length > 1) setBuilding(!building); }
  else if (k === 'h' || k === 'H') toggleReplay(replayEl.hidden);
  else if (k === '?') toast(`<b>${esc(T.keys.helpTitle)}</b>${esc(T.keys.help)}`, '');
});
