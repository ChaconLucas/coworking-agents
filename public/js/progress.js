'use strict';
// ---------------- progress: achievements, coins, items, avatars, office name/theme/mascot ----------------
// Saved by the server in ~/.config/coworking-agents/progress.json (your machine, your file), mirrored in the
// browser so the page works before the first answer. Counters merge by max, lists by union: nothing is lost
// when two tabs or an old browser copy meet.
const prog = { record: {}, levels: null, avatars: {}, owned: [], placed: {}, spent: 0, officeName: '', theme: '', mascot: 'cat', super: 0 };
{
  const m = store.get('progress', null);
  if (m && typeof m === 'object') mergeProgress(m);
  else mergeProgress({ record: store.get('achRecord', {}), levels: store.get('achLevels', null), avatars: store.get('avatars', {}) }); // before progress.json existed
}
function mergeProgress(src) {
  if (!src || typeof src !== 'object') return;
  const rec = src.record && typeof src.record === 'object' ? src.record : {};
  for (const [k, v] of Object.entries(rec)) {
    const cur = prog.record[k];
    if (Array.isArray(v)) prog.record[k] = [...new Set([...(Array.isArray(cur) ? cur : []), ...v.filter(x => typeof x === 'string')])];
    else if (typeof v === 'number') prog.record[k] = Math.max(Number(cur) || 0, v);
  }
  if (src.levels && typeof src.levels === 'object') { if (!prog.levels) prog.levels = {}; for (const [k, v] of Object.entries(src.levels)) prog.levels[k] = Math.max(prog.levels[k] || 0, Number(v) || 0); }
  if (src.avatars && typeof src.avatars === 'object') Object.assign(prog.avatars, src.avatars);
  if (Array.isArray(src.owned)) prog.owned = [...new Set([...prog.owned, ...src.owned])];
  if (src.placed && typeof src.placed === 'object') Object.assign(prog.placed, src.placed);
  prog.spent = Math.max(prog.spent, Number(src.spent) || 0);
  prog.super = Math.max(prog.super, Number(src.super) || 0);
  for (const k of ['officeName', 'theme', 'mascot']) if (typeof src[k] === 'string' && src[k]) prog[k] = src[k];
}
let progTimer = 0;
function saveProgress() {
  store.set('progress', prog);
  clearTimeout(progTimer);
  progTimer = setTimeout(() => fetch('api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify(prog) }).catch(() => {}), 1500);
}
// a setting chosen in the page (name, theme, mascot) replaces the old one instead of merging
function setProgress(k, v) { prog[k] = v; saveProgress(); }
fetch('api/progress').then(r => r.json()).then(s => { mergeProgress(s); saveProgress(); if (typeof renderAll === 'function') renderAll(); }).catch(() => {});
