'use strict';
// All-time token usage per AI, from every transcript on disk. Big (GBs), so it runs in the background,
// streams line by line, and caches per file (size + mtime) in ~/.config/coworking-agents/usage-cache.json.

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { costOf } = require('./prices');

const CACHE = path.join(os.homedir(), '.config', 'coworking-agents', 'usage-cache.json');
const CLAUDE = () => path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
const CODEX = () => path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions');

const zero = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0 });
const add = (a, b) => { a.input += b.input; a.output += b.output; a.cacheRead += b.cacheRead; a.cacheWrite += b.cacheWrite; a.cacheWrite1h += b.cacheWrite1h || 0; return a; };
const SCAN_VERSION = 2; // bump when scanFile's output changes: cached files are rescanned once
const day = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function walk(dir, out = []) {
  let list = [];
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of list) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

async function scanFile(file, kind) {
  const res = { total: zero(), byDay: {}, byModel: {} };
  const bump = (ts, model, u) => {
    add(res.total, u);
    const k = day(ts || Date.now());
    add(res.byDay[k] || (res.byDay[k] = zero()), u);
    if (model) add(res.byModel[model] || (res.byModel[model] = zero()), u);
  };
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  let lastId = null, model = '';
  for await (const line of rl) {
    if (kind === 'claude') {
      if (line.indexOf('"usage"') < 0 || line.indexOf('"assistant"') < 0) continue;
      let d; try { d = JSON.parse(line); } catch { continue; }
      const m = d.message || {}, u = m.usage;
      if (!u || (m.id && m.id === lastId)) continue; // one API reply is split into several entries
      lastId = m.id;
      bump(Date.parse(d.timestamp), m.model && !m.model.startsWith('<') ? m.model : '', { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, cacheWrite1h: (u.cache_creation && u.cache_creation.ephemeral_1h_input_tokens) || 0 });
    } else {
      if (line.indexOf('"turn_context"') >= 0) { try { const d = JSON.parse(line); if (d.payload && d.payload.model) model = d.payload.model; } catch {} continue; }
      if (line.indexOf('"token_count"') < 0) continue;
      let d; try { d = JSON.parse(line); } catch { continue; }
      const u = d.payload && d.payload.info && d.payload.info.last_token_usage;
      if (!u) continue;
      const cached = u.cached_input_tokens || 0;
      bump(Date.parse(d.timestamp), model, { input: Math.max(0, (u.input_tokens || 0) - cached), output: u.output_tokens || 0, cacheRead: cached, cacheWrite: 0 });
    }
  }
  return res;
}

let cache = null, state = { scanning: false, scannedAt: 0, result: null };
function loadCache() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { cache = {}; }
  return cache;
}
function saveCache() {
  try { fs.mkdirSync(path.dirname(CACHE), { recursive: true, mode: 0o700 }); fs.writeFileSync(CACHE, JSON.stringify(cache), { mode: 0o600 }); } catch {}
}

async function refresh() {
  if (state.scanning) return;
  state.scanning = true;
  try {
    const c = loadCache(), seen = new Set();
    const files = [...walk(CLAUDE()).map(f => [f, 'claude']), ...walk(CODEX()).map(f => [f, 'codex'])];
    for (const [file, kind] of files) {
      seen.add(file);
      let st; try { st = fs.statSync(file); } catch { continue; }
      const hit = c[file];
      if (hit && hit.v === SCAN_VERSION && hit.size === st.size && hit.mtime === st.mtimeMs) continue;
      try { c[file] = { v: SCAN_VERSION, size: st.size, mtime: st.mtimeMs, kind, res: await scanFile(file, kind) }; } catch {}
    }
    for (const f of Object.keys(c)) if (!seen.has(f)) delete c[f]; // deleted transcripts drop out
    saveCache();
    const out = {};
    for (const { kind, res } of Object.values(c)) {
      const o = out[kind] || (out[kind] = { total: zero(), byDay: {}, byModel: {}, sessions: 0 });
      o.sessions++; add(o.total, res.total);
      for (const [k, v] of Object.entries(res.byDay)) add(o.byDay[k] || (o.byDay[k] = zero()), v);
      for (const [k, v] of Object.entries(res.byModel)) add(o.byModel[k] || (o.byModel[k] = zero()), v);
    }
    // estimated cost per model (list prices); tokens of models without a price stay out of the total
    for (const o of Object.values(out)) {
      o.cost = { usd: 0, unpricedModels: [] }; o.costByModel = {};
      for (const [m, u] of Object.entries(o.byModel)) {
        const c = costOf(m, u);
        if (c == null) o.cost.unpricedModels.push(m); else { o.costByModel[m] = c; o.cost.usd += c; }
      }
    }
    state.result = out; state.scannedAt = Date.now();
  } finally { state.scanning = false; }
}

// returns what we have now and refreshes in the background when older than a minute
function usage() {
  if (!state.scanning && Date.now() - state.scannedAt > 60000) refresh();
  return { scanning: state.scanning, scannedAt: state.scannedAt, byAgent: state.result };
}

module.exports = { usage, refresh, scanFile };
