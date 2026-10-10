'use strict';
// Pieces shared by the sources: git, incremental JSONL reading, small formatters.

const fs = require('fs');
const path = require('path');

const FIRST_READ_MAX = 24 * 1024 * 1024; // huge transcript: start from the end
const PARTIAL_MAX = 1024 * 1024;          // a line with no end (odd file) is dropped
const STATE_IDLE_MS = 26 * 3600 * 1000;   // state of a file unread this long is evicted

function safeJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// commands may carry secrets (TOKEN=..., --password x, Bearer ...): mask them before showing
const SECRET = /((?:token|secret|passw(?:or)?d|api[_-]?key|auth|bearer|credential)[\w-]*\s*[=:\s]\s*)("[^"]*"|'[^']*'|\S+)/gi;
function short(s, n = 48) {
  s = String(s || '').replace(/\s+/g, ' ').trim().replace(/(bearer\s+)\S+/gi, '$1•••').replace(SECRET, (m, k, v) => v === '•••' ? m : k + '•••');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

const repoCache = new Map();
function resolveRepo(dir) {
  if (!dir || typeof dir !== 'string') return null;
  const hit = repoCache.get(dir);
  if (hit && Date.now() - hit.at < 30000) return hit.v;
  let v = null, cur = dir;
  for (let i = 0; i < 40 && cur; i++) {
    const g = path.join(cur, '.git');
    let st = null;
    try { st = fs.statSync(g); } catch {}
    if (st) {
      let common = g;
      if (st.isFile()) {
        // worktree: .git is a file pointing at the gitdir; commondir leads to the main repo
        let txt = '';
        try { txt = fs.readFileSync(g, 'utf8'); } catch {} // unreadable .git (another user): skip instead of crashing
        const m = /gitdir:\s*(.+)/.exec(txt);
        if (m) {
          const gitdir = path.resolve(cur, m[1].trim());
          let cd = null;
          try { cd = fs.readFileSync(path.join(gitdir, 'commondir'), 'utf8').trim(); } catch {}
          common = cd ? path.resolve(gitdir, cd) : gitdir;
        }
      }
      const main = path.basename(common) === '.git' ? path.dirname(common) : common;
      v = { worktree: cur, repo: main, name: path.basename(main), isWorktree: st.isFile() };
      break;
    }
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  repoCache.set(dir, { at: Date.now(), v });
  return v;
}

// Reads only what was appended since last time; `absorb(state, obj)` accumulates.
function incremental(newState, absorb) {
  const states = new Map();
  let lastSweep = Date.now();
  return function read(file) {
    const now = Date.now();
    if (now - lastSweep > 3600 * 1000) { lastSweep = now; for (const [f, s] of states) if (now - s.seen > STATE_IDLE_MS) states.delete(f); }
    let st = states.get(file), stat;
    try { stat = fs.statSync(file); } catch { return null; }
    if (!st || stat.size < st.offset) { st = Object.assign(newState(), { offset: 0, partial: '', mtime: 0 }); states.set(file, st); }
    st.mtime = stat.mtimeMs; st.seen = now;
    if (stat.size === st.offset) return st;
    let start = st.offset;
    // first read or a huge jump: read only the tail (the rest no longer matters to the screen)
    if (stat.size - start > FIRST_READ_MAX) { start = stat.size - FIRST_READ_MAX; st.partial = ''; st.skipFirst = true; }
    const fd = fs.openSync(file, 'r');
    try {
      const len = stat.size - start, buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, start);
      let text = st.partial + buf.toString('utf8');
      if (st.skipFirst) { text = text.slice(text.indexOf('\n') + 1); st.skipFirst = false; }
      const lines = text.split('\n');
      st.partial = lines.pop();
      if (st.partial.length > PARTIAL_MAX) st.partial = '';
      for (const line of lines) {
        if (!line) continue;
        try { absorb(st, JSON.parse(line)); } catch {}
      }
      st.offset = stat.size;
    } finally { fs.closeSync(fd); }
    return st;
  };
}

// Most recent pending call (the tool running right now).
function newest(pending) {
  let best = null;
  for (const v of pending.values()) if (!best || v.ts > best.ts) best = v;
  return best;
}

function track(st, item, filePath) {
  st.pending.set(item.id, item);
  st.recent.push(item);
  if (st.recent.length > 12) st.recent.shift();
  st.tools[item.name] = (st.tools[item.name] || 0) + 1;
  event(st, item.ts, item.kind);
  if (filePath && item.kind === 'edit') {
    st.files.set(filePath, item.ts);
    const r = resolveRepo(path.dirname(filePath));
    if (r) st.edits.set(r.worktree, { at: item.ts, repo: r });
  }
}

// Timeline: every tool call, every message of yours and every turn end becomes a timestamped marker.
const EVENTS_MAX = 6000, EVENTS_AGE = 26 * 3600 * 1000;
function event(st, ts, kind) {
  if (!ts) return;
  const ev = st.events;
  const last = ev[ev.length - 1];
  if (last && last.kind === kind && ts - last.ts < 1000) return;
  ev.push({ ts, kind });
  if (ev.length > EVENTS_MAX || ts - ev[0].ts > EVENTS_AGE) {
    const cut = ev.findIndex(e => ts - e.ts <= EVENTS_AGE);
    ev.splice(0, Math.max(cut, ev.length - EVENTS_MAX));
  }
}

function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function addTokens(st, ts, n) { if (ts && n) { const k = dayKey(ts); st.outByDay[k] = (st.outByDay[k] || 0) + n; } }

function baseState() {
  // prototype-less counters: tool names from the transcript ("constructor", "__proto__") can't collide
  const bag = () => Object.create(null);
  return { title: '', cwd: '', branch: '', model: '', ctx: 0, ctxMax: 0, lastTs: 0, pending: new Map(), recent: [], tools: bag(), skills: bag(), mcps: bag(), edits: new Map(), turns: 0, events: [], files: new Map(), outByDay: bag(), usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, limits: null };
}

module.exports = { safeJson, alive, short, resolveRepo, incremental, newest, track, baseState, event, addTokens, dayKey };
