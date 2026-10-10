'use strict';
// Your progress in the office (achievement counters, levels, coins spent, items bought, chosen avatars,
// office name, theme, mascot): one small file, ~/.config/coworking-agents/progress.json (mode 0600).
// It is per person because the app is: it runs on your machine and reads your own disk.

const fs = require('fs');
const os = require('os');
const path = require('path');

const FILE = () => path.join(os.homedir(), '.config', 'coworking-agents', 'progress.json');
const MAX = 128 * 1024;
const KEYS = { record: 'object', levels: 'object', avatars: 'object', owned: 'array', placed: 'object', spent: 'number', officeName: 'string', theme: 'string', mascot: 'string', super: 'number', style: 'object' };

// keep only known keys of the right type; strings are short, objects are flat-ish and bounded by MAX
function clean(input) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [k, type] of Object.entries(KEYS)) {
    const v = input[k];
    if (v === undefined || v === null) continue;
    if (type === 'array' ? Array.isArray(v) : type === 'object' ? typeof v === 'object' && !Array.isArray(v) : typeof v === type) {
      out[k] = type === 'string' ? v.slice(0, 40) : type === 'number' ? (Number.isFinite(v) ? v : 0) : type === 'array' ? v.filter(x => typeof x === 'string').slice(0, 200).map(x => x.slice(0, 40)) : v;
    }
  }
  return out;
}

let memory = null; // demo mode keeps progress in memory only
function load({ demo = false } = {}) {
  if (demo) return memory || {};
  try { return clean(JSON.parse(fs.readFileSync(FILE(), 'utf8'))); } catch { return {}; }
}
// counters keep the highest value and lists the union, so two tabs never erase each other's progress;
// settings (name, theme, mascot, placed items) take the newest value
function merge(old, inc) {
  const out = { ...old, ...inc };
  const rec = { ...(old.record || {}) };
  for (const [k, v] of Object.entries(inc.record || {})) {
    if (Array.isArray(v)) rec[k] = [...new Set([...(Array.isArray(rec[k]) ? rec[k] : []), ...v.filter(x => typeof x === 'string')])].slice(0, 2000);
    else if (typeof v === 'number' && Number.isFinite(v)) rec[k] = Math.max(Number(rec[k]) || 0, v);
  }
  out.record = rec;
  out.levels = { ...(old.levels || {}) };
  for (const [k, v] of Object.entries(inc.levels || {})) out.levels[k] = Math.max(out.levels[k] || 0, Number(v) || 0);
  out.avatars = { ...(old.avatars || {}), ...(inc.avatars || {}) };
  out.owned = [...new Set([...(old.owned || []), ...(inc.owned || [])])];
  out.spent = Math.max(old.spent || 0, inc.spent || 0);
  out.super = Math.max(old.super || 0, inc.super || 0);
  return out;
}
function save(data, { demo = false } = {}) {
  const body = JSON.stringify(clean(merge(load({ demo }), clean(data))));
  if (body.length > MAX) return false;
  if (demo) { memory = JSON.parse(body); return true; }
  try {
    fs.mkdirSync(path.dirname(FILE()), { recursive: true, mode: 0o700 });
    const tmp = FILE() + '.tmp';
    fs.writeFileSync(tmp, body, { mode: 0o600 });
    fs.renameSync(tmp, FILE());
    return true;
  } catch { return false; }
}

module.exports = { load, save, clean, merge, MAX };
