'use strict';
// ---------------- "tell me when…" ----------------
// Notices you pick: when an agent finishes (once), when a limit passes a level (again after it comes back down),
// when an agent edits a file whose path has some text. Kept with your progress; checked on every office update.
const watchList = () => (prog.watches = Array.isArray(prog.watches) ? prog.watches : []);
const watchBusy = s => !['idle', 'asleep', 'needs_you', 'waiting'].includes(s);
let watchSaveAt = 0;
function watchSave(now) { if (now || Date.now() - watchSaveAt > 5000) { watchSaveAt = Date.now(); saveProgress(); } }
function watchAdd(w) { watchList().push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), ...w }); watchSave(true); }
function watchDel(id) { prog.watches = watchList().filter(w => w.id !== id); watchSave(true); }
function watchFire(w, title, body, agent) {
  toast(`<b>🔔 ${esc(title)}</b>${esc(body || '')}`, 'ok');
  if (typeof pushNotice === 'function') pushNotice('watch:' + w.id + ':' + Date.now(), 'ok', '🔔 ' + title, body || '', agent ? { agent } : {});
  notifyOS('🔔 ' + title, body || '');
}
const watchLabel = (ai, win) => `${(AGENT[ai] || { label: ai }).label} ${win === 'week' ? T.usage.week : T.usage.fiveHour}`;
function checkWatches() {
  if (!data || !watchList().length) return;
  const W = T.watch;
  for (const w of [...watchList()]) {
    if (w.kind === 'done') { // fires the first time it stops after having worked
      const p = data.people.find(x => x.id === w.agent && !x.leaving);
      if (!p) { if (w.seen) { watchFire(w, W.closed(w.name), '', null); watchDel(w.id); } continue; }
      w.seen = true;
      if (watchBusy(p.state)) { if (!w.worked) { w.worked = true; watchSave(); } continue; }
      if (w.worked) { watchFire(w, ['needs_you', 'waiting'].includes(p.state) ? W.needs(p.name) : W.done(p.name), p.title || '', p.id); watchDel(w.id); }
    } else if (w.kind === 'limit') {
      const l = data.limits && data.limits[w.ai], v = l && (w.win === 'week' ? l.secondary : l.primary); if (!v) continue;
      if (v.usedPercent >= w.pct && !w.over) { w.over = true; watchSave(true); watchFire(w, W.limit(watchLabel(w.ai, w.win), Math.round(v.usedPercent)), W.limitWhy(w.pct)); }
      else if (v.usedPercent < w.pct - 5 && w.over) { w.over = false; watchSave(true); } // back down (a new window): armed again
    } else if (w.kind === 'file') {
      const k = String(w.text || '').toLowerCase(); let last = w.last || w.at;
      for (const p of data.people) for (const f of p.files || []) {
        if (f.at <= (w.last || w.at) || !`${f.repo}/${f.rel}`.toLowerCase().includes(k)) continue;
        watchFire(w, W.file(p.name, f.rel), p.title || '', p.id); last = Math.max(last, f.at);
      }
      if (last !== (w.last || w.at)) { w.last = last; watchSave(true); }
    }
  }
}
setInterval(checkWatches, 2000);
// the agent panel's button: tell me when this one finishes
function watchBtnHtml(p) {
  const on = watchList().find(w => w.kind === 'done' && w.agent === p.id);
  return `<div class="actions"><button class="btn small ${on ? '' : 'ghost'}" data-watch-done="${esc(p.id)}">${on ? '🔕 ' + esc(T.watch.cancelDone) : '🔔 ' + esc(T.watch.whenDone)}</button></div>`;
}
panelBody.addEventListener('click', e => {
  const b = e.target.closest('[data-watch-done]'); if (!b) return;
  const p = data && data.people.find(x => x.id === b.dataset.watchDone); if (!p) return;
  const on = watchList().find(w => w.kind === 'done' && w.agent === p.id);
  if (on) watchDel(on.id); else { watchAdd({ kind: 'done', agent: p.id, name: p.name }); toast(`<b>🔔 ${esc(T.watch.set)}</b>${esc(T.watch.whenDoneOf(p.name))}`, 'ok'); }
  b.outerHTML = watchBtnHtml(p);
});
// the list of what you asked to be told, and the forms to add more
function renderWatches() {
  const W = T.watch, body = reportEl.querySelector('.report-body'), live = data ? data.people.filter(p => !p.leaving) : [];
  const text = w => w.kind === 'done' ? W.whenDoneOf(w.name) : w.kind === 'limit' ? W.whenLimit(watchLabel(w.ai, w.win), w.pct) : W.whenFile(w.text);
  body.innerHTML = tabsHtml() + `<h2>⏰ ${esc(W.title)}</h2><p class="sub">${esc(W.sub)}</p>
    ${watchList().length ? `<ul class="list">${watchList().map(w => `<li><span class="k">🔔</span><span>${esc(text(w))}</span><button class="btn small ghost" data-watch-del="${esc(w.id)}">✕</button></li>`).join('')}</ul>` : `<p class="note">${esc(W.empty)}</p>`}
    <h3>${esc(W.addDone)}</h3><p class="watch-form"><select data-w-agent>${live.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.title ? ' — ' + esc(p.title.slice(0, 40)) : ''}</option>`).join('')}</select> <button class="btn small" data-watch-add="done" ${live.length ? '' : 'disabled'}>＋ ${esc(W.add)}</button></p>
    <h3>${esc(W.addLimit)}</h3><p class="watch-form"><select data-w-ai>${Object.keys(AGENT).map(id => `<option value="${esc(id)}">${esc(AGENT[id].label)}</option>`).join('')}</select> <select data-w-win><option value="5h">${esc(T.usage.fiveHour)}</option><option value="week">${esc(T.usage.week)}</option></select> <input type="number" data-w-pct min="5" max="100" value="80" style="width:70px">% <button class="btn small" data-watch-add="limit">＋ ${esc(W.add)}</button></p>
    <h3>${esc(W.addFile)}</h3><p class="watch-form"><input data-w-file placeholder="${esc(W.filePh)}"> <button class="btn small" data-watch-add="file">＋ ${esc(W.add)}</button></p>
    <p class="note">${esc(W.note)}</p>`;
}
reportEl.addEventListener('click', e => {
  if (reportTab !== 'watches') return;
  const d = e.target.closest('[data-watch-del]'); if (d) { watchDel(d.dataset.watchDel); return renderWatches(); }
  const a = e.target.closest('[data-watch-add]'); if (!a) return;
  const v = sel => (reportEl.querySelector(sel) || {}).value || '';
  if (a.dataset.watchAdd === 'done') { const p = data.people.find(x => x.id === v('[data-w-agent]')); if (p && !watchList().some(w => w.kind === 'done' && w.agent === p.id)) watchAdd({ kind: 'done', agent: p.id, name: p.name }); }
  if (a.dataset.watchAdd === 'limit') { const pct = Math.max(5, Math.min(100, Math.round(Number(v('[data-w-pct]')) || 80))); watchAdd({ kind: 'limit', ai: v('[data-w-ai]'), win: v('[data-w-win]') === 'week' ? 'week' : '5h', pct }); }
  if (a.dataset.watchAdd === 'file') { const t = v('[data-w-file]').trim().slice(0, 120); if (!t) return; watchAdd({ kind: 'file', text: t }); }
  renderWatches();
});
