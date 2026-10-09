'use strict';
// Peças comuns às fontes: git, leitura incremental de JSONL, pequenos formatadores.

const fs = require('fs');
const path = require('path');

const FIRST_READ_MAX = 24 * 1024 * 1024; // transcrito gigante: começa pelo fim

function safeJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function short(s, n = 48) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

const repoCache = new Map();
function resolveRepo(dir) {
  if (!dir) return null;
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
        // worktree: .git é um ficheiro que aponta para o gitdir; commondir leva ao repo principal
        const m = /gitdir:\s*(.+)/.exec(fs.readFileSync(g, 'utf8'));
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

// Lê só o que foi acrescentado desde a última vez; `absorb(state, obj)` acumula.
function incremental(newState, absorb) {
  const states = new Map();
  return function read(file) {
    let st = states.get(file), stat;
    try { stat = fs.statSync(file); } catch { return null; }
    if (!st || stat.size < st.offset) { st = Object.assign(newState(), { offset: 0, partial: '', mtime: 0 }); states.set(file, st); }
    st.mtime = stat.mtimeMs;
    if (stat.size === st.offset) return st;
    let start = st.offset;
    if (start === 0 && stat.size > FIRST_READ_MAX) start = stat.size - FIRST_READ_MAX;
    const fd = fs.openSync(file, 'r');
    try {
      const len = stat.size - start, buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, start);
      let text = st.partial + buf.toString('utf8');
      if (st.offset === 0 && start > 0) text = text.slice(text.indexOf('\n') + 1);
      const lines = text.split('\n');
      st.partial = lines.pop();
      for (const line of lines) {
        if (!line) continue;
        try { absorb(st, JSON.parse(line)); } catch {}
      }
      st.offset = stat.size;
    } finally { fs.closeSync(fd); }
    return st;
  };
}

// Pendência mais recente (a ferramenta que está a correr agora).
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
  if (filePath && item.kind === 'edit') {
    const r = resolveRepo(path.dirname(filePath));
    if (r) st.edits.set(r.worktree, { at: item.ts, repo: r });
  }
}

function baseState() {
  return { title: '', cwd: '', branch: '', model: '', ctx: 0, ctxMax: 0, lastTs: 0, pending: new Map(), recent: [], tools: {}, skills: {}, mcps: {}, edits: new Map(), turns: 0 };
}

module.exports = { safeJson, alive, short, resolveRepo, incremental, newest, track, baseState };
