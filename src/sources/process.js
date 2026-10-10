'use strict';
// Source: any other AI coding CLI, found by its running process. We don't read their transcripts
// (formats we can't verify), so state is coarse and measured from the process itself:
// using CPU = working, otherwise idle. Users can add any tool in ~/.config/coworking-agents/agents.json:
//   [{ "id": "mytool", "label": "My Tool", "color": "#ff8800", "match": "\\bmytool\\b" }]

const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { processList } = require('../proc');
const { safeJson } = require('../util');

const KNOWN = [
  { id: 'gemini', label: 'Gemini CLI', color: '#4285f4', match: '(^|/)gemini(\\s|$)|@google/gemini-cli' },
  { id: 'opencode', label: 'OpenCode', color: '#f5a623', match: '(^|/)opencode(\\s|$)' },
  { id: 'aider', label: 'Aider', color: '#14b014', match: '(^|/|\\s)aider(\\s|$)' },
  { id: 'cursor', label: 'Cursor Agent', color: '#9b8cff', match: '(^|/)cursor-agent(\\s|$)' },
  { id: 'amp', label: 'Amp', color: '#f34e3f', match: '(^|/)amp(\\s|$)|@sourcegraph/amp' },
  { id: 'goose', label: 'Goose', color: '#ffd84d', match: '(^|/)goose(\\s|$)' },
  { id: 'qwen', label: 'Qwen Code', color: '#615ced', match: '(^|/)qwen(\\s|$)|@qwen-code/' },
  { id: 'crush', label: 'Crush', color: '#ff5fd2', match: '(^|/)crush(\\s|$)' },
  { id: 'droid', label: 'Droid', color: '#ff7a1a', match: '(^|/)droid(\\s|$)' },
  { id: 'kimi', label: 'Kimi CLI', color: '#1ec8e6', match: '(^|/)kimi(\\s|$)' },
];
const BUSY_CPU = 3; // % CPU above which the tool counts as working

function tools() {
  const extra = safeJson(path.join(os.homedir(), '.config', 'coworking-agents', 'agents.json'));
  const list = [...KNOWN, ...(Array.isArray(extra) ? extra : [])].filter(t => t && t.id && t.match && !['claude', 'codex'].includes(t.id));
  return list.map(t => { try { return { ...t, re: new RegExp(t.match) }; } catch { return null; } }).filter(Boolean);
}

function cwdOf(pid) {
  if (process.platform === 'linux') { try { return require('fs').readlinkSync(`/proc/${pid}/cwd`); } catch { return ''; } }
  if (process.platform === 'win32') return ''; // not exposed without native code
  try {
    const out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 });
    const line = out.split('\n').find(l => l.startsWith('n'));
    return line ? line.slice(1) : '';
  } catch { return ''; }
}

const cwdCache = new Map();
let cache = { at: 0, list: [] };
function sessions(now) {
  if (now - cache.at < 2500) return cache.list;
  const ts = tools(), out = [];
  if (ts.length) {
    const rows = processList();
    const hits = [];
    for (const row of rows) {
      if (row.pid === process.pid || (process.platform !== 'win32' && !row.tty)) continue; // only tools living in a terminal (Windows has no tty)
      const t = ts.find(x => x.re.test(row.cmd));
      if (t) hits.push({ ...row, tool: t });
    }
    // a CLI often spawns helpers matching the same name: keep only the topmost process of each tool
    const pids = new Set(hits.map(h => h.pid));
    for (const h of hits) {
      if (pids.has(h.ppid) && hits.find(x => x.pid === h.ppid && x.tool.id === h.tool.id)) continue;
      const secs = h.secs;
      const cpu = hits.filter(x => x.tool.id === h.tool.id && (x.pid === h.pid || x.ppid === h.pid)).reduce((n, x) => n + x.cpu, 0);
      let cwd = cwdCache.get(h.pid);
      if (cwd === undefined) { cwd = cwdOf(h.pid); cwdCache.set(h.pid, cwd); }
      const startedAt = now - secs * 1000;
      out.push({
        agent: h.tool.id, agentLabel: h.tool.label, agentColor: h.tool.color || '#8a8f98', coarse: true,
        id: `${h.tool.id}-${h.pid}`, name: `${h.tool.id}-${String(h.pid).slice(-4)}`, pid: h.pid, kind: 'cli', version: '',
        status: process.platform === 'win32' ? 'idle' : cpu > BUSY_CPU ? 'busy' : 'idle', since: startedAt, startedAt, cwd, st: null, subagents: [],
      });
    }
  }
  cache = { at: now, list: out };
  return out;
}

function credentials() { return { topSkills: [], skills: [], mcps: [], plugins: [] }; }

module.exports = { id: 'process', label: 'Other AIs', sessions, credentials, KNOWN };
