'use strict';
// Lê o que o Claude Code já grava no disco e monta o estado do escritório.
// Só leitura: nada aqui escreve em ~/.claude nem fala com a rede.

const fs = require('fs');
const os = require('os');
const path = require('path');

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const CLAUDE_JSON = path.join(os.homedir(), '.claude.json');

const FIRST_READ_MAX = 24 * 1024 * 1024; // transcrito gigante: começa pelo fim
const PENDING_STALE_MS = 6000;           // ferramenta parada há isto = rodando ou esperando permissão
const ASLEEP_MS = 20 * 60 * 1000;
const SUBAGENT_ACTIVE_MS = 45 * 1000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;   // janela para "duas sessões editando o mesmo clone"

const ACTIVITY = {
  Edit: 'edit', Write: 'edit', NotebookEdit: 'edit', MultiEdit: 'edit',
  Read: 'read', Grep: 'read', Glob: 'read', LS: 'read',
  Bash: 'terminal', Monitor: 'terminal', BashOutput: 'terminal',
  WebFetch: 'web', WebSearch: 'web',
  Agent: 'delegate', Task: 'delegate', Workflow: 'delegate', SendMessage: 'delegate',
  Skill: 'skill', ToolSearch: 'read',
  AskUserQuestion: 'ask', ExitPlanMode: 'ask',
};

function activityOf(name) {
  if (ACTIVITY[name]) return ACTIVITY[name];
  if (name.startsWith('mcp__')) return /browser|chrome|web|page/i.test(name) ? 'web' : 'mcp';
  return 'other';
}

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

function summarize(name, input) {
  input = input || {};
  if (input.file_path) return path.basename(input.file_path);
  if (input.notebook_path) return path.basename(input.notebook_path);
  if (name === 'Bash') return short(input.description || input.command);
  if (name === 'Grep') return short(input.pattern);
  if (name === 'Glob') return short(input.pattern);
  if (name === 'WebFetch') { try { return new URL(input.url).hostname; } catch { return ''; } }
  if (name === 'WebSearch') return short(input.query);
  if (name === 'Skill') return short(input.skill);
  if (name === 'Agent' || name === 'Task') return short(input.description);
  if (name.startsWith('mcp__')) return name.split('__').slice(2).join('__');
  return '';
}

// ---------- git: qual clone cada caminho pertence ----------

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

// ---------- leitura incremental dos transcritos ----------

const parsers = new Map(); // ficheiro -> estado acumulado

function newState() {
  return {
    offset: 0, size: 0, mtime: 0, partial: '',
    title: '', cwd: '', branch: '', model: '', ctx: 0, lastTs: 0,
    pending: new Map(), recent: [], tools: {}, skills: {}, mcps: {},
    edits: new Map(), turns: 0, agentType: '', description: '',
  };
}

function absorb(st, d) {
  const ts = d.timestamp ? Date.parse(d.timestamp) : 0;
  if (ts) st.lastTs = Math.max(st.lastTs, ts);
  if (d.cwd) st.cwd = d.cwd;
  if (d.gitBranch) st.branch = d.gitBranch;
  if (d.type === 'ai-title' && d.aiTitle) st.title = d.aiTitle;
  if (d.type === 'system' && d.subtype === 'turn_duration') { st.pending.clear(); st.turns++; }
  const m = d.message;
  if (!m) return;
  if (d.type === 'assistant') {
    if (m.model && !m.model.startsWith('<')) st.model = m.model;
    const u = m.usage;
    if (u) st.ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    for (const c of Array.isArray(m.content) ? m.content : []) {
      if (c.type !== 'tool_use') continue;
      const name = c.name || '?';
      const item = { id: c.id, name, kind: activityOf(name), what: summarize(name, c.input), ts: ts || Date.now() };
      st.pending.set(c.id, item);
      st.recent.push(item);
      if (st.recent.length > 12) st.recent.shift();
      st.tools[name] = (st.tools[name] || 0) + 1;
      if (name === 'Skill' && c.input && c.input.skill) st.skills[c.input.skill] = (st.skills[c.input.skill] || 0) + 1;
      if (name.startsWith('mcp__')) { const s = name.split('__')[1]; st.mcps[s] = (st.mcps[s] || 0) + 1; }
      const fp = c.input && (c.input.file_path || c.input.notebook_path);
      if (fp && item.kind === 'edit') {
        const r = resolveRepo(path.dirname(fp));
        if (r) st.edits.set(r.worktree, { at: ts || Date.now(), repo: r });
      }
    }
  } else if (d.type === 'user') {
    const content = m.content;
    if (Array.isArray(content)) {
      for (const c of content) {
        if (c.type === 'tool_result') st.pending.delete(c.tool_use_id);
        if (c.type === 'text' && /^\[Request interrupted/.test(c.text || '')) st.pending.clear();
      }
    } else if (typeof content === 'string' && /^\[Request interrupted/.test(content)) st.pending.clear();
  }
}

function readTranscript(file) {
  let st = parsers.get(file);
  let stat;
  try { stat = fs.statSync(file); } catch { return null; }
  if (!st || stat.size < st.offset) { st = newState(); parsers.set(file, st); }
  st.mtime = stat.mtimeMs;
  if (stat.size === st.offset) return st;
  let start = st.offset;
  if (start === 0 && stat.size > FIRST_READ_MAX) start = stat.size - FIRST_READ_MAX;
  const fd = fs.openSync(file, 'r');
  try {
    const len = stat.size - start;
    const buf = Buffer.alloc(len);
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
}

const transcriptPath = new Map();
function findTranscript(sessionId) {
  const hit = transcriptPath.get(sessionId);
  if (hit && fs.existsSync(hit)) return hit;
  const root = path.join(CLAUDE_DIR, 'projects');
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch { return null; }
  for (const d of dirs) {
    const f = path.join(root, d, sessionId + '.jsonl');
    if (fs.existsSync(f)) { transcriptPath.set(sessionId, f); return f; }
  }
  return null;
}

// ---------- estado de cada pessoa no escritório ----------

function stateOf(status, st, now) {
  if (!st) return status === 'busy' ? 'thinking' : 'idle';
  if (status !== 'busy') return now - Math.max(st.lastTs, st.mtime) > ASLEEP_MS ? 'asleep' : 'idle';
  const pend = [...st.pending.values()].sort((a, b) => b.ts - a.ts)[0];
  if (!pend) return 'thinking';
  if (pend.kind === 'ask') return 'needs_you';
  if (pend.kind !== 'delegate' && now - pend.ts > PENDING_STALE_MS && now - st.mtime > PENDING_STALE_MS) return 'waiting';
  return pend.kind;
}

function subagentsOf(transcript, now) {
  const dir = path.join(path.dirname(transcript), path.basename(transcript, '.jsonl'), 'subagents');
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')); } catch { return []; }
  const out = [];
  for (const f of files) {
    const full = path.join(dir, f);
    let mt = 0;
    try { mt = fs.statSync(full).mtimeMs; } catch { continue; }
    if (now - mt > SUBAGENT_ACTIVE_MS) continue;
    const st = readTranscript(full);
    if (!st) continue;
    if (!st.agentType) {
      const meta = safeJson(full.replace(/\.jsonl$/, '.meta.json')) || {};
      st.agentType = meta.agentType || 'agent';
      st.description = meta.description || '';
    }
    const pend = [...st.pending.values()].sort((a, b) => b.ts - a.ts)[0];
    out.push({
      id: f.replace(/^agent-|\.jsonl$/g, ''),
      type: st.agentType, description: st.description,
      state: pend ? pend.kind : 'thinking', doing: pend ? pend.what : '',
    });
  }
  return out.slice(0, 8);
}

function globalCredentials() {
  const cj = safeJson(CLAUDE_JSON) || {};
  const usage = Object.entries(cj.skillUsage || {})
    .map(([name, v]) => ({ name, count: v.usageCount || 0, last: v.lastUsedAt || 0 }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);
  let skills = [];
  try { skills = fs.readdirSync(path.join(CLAUDE_DIR, 'skills')).filter(n => !n.startsWith('.') && n !== 'synced'); } catch {}
  const mcps = Object.keys(cj.mcpServers || {});
  const plugins = Object.entries(cj.pluginUsage || {})
    .map(([name, v]) => ({ name: name.replace(/@.*$/, ''), count: v.usageCount || 0 }));
  return { topSkills: usage.slice(0, 10), skills, mcps, plugins };
}

function snapshot({ privacy = false } = {}) {
  const now = Date.now();
  const dir = path.join(CLAUDE_DIR, 'sessions');
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /^\d+\.json$/.test(f)); } catch {}
  const people = [];
  for (const f of files) {
    const s = safeJson(path.join(dir, f));
    if (!s || !s.sessionId || !alive(s.pid)) continue;
    const tp = findTranscript(s.sessionId);
    const st = tp ? readTranscript(tp) : null;
    const cwd = (st && st.cwd) || s.cwd;
    const repo = resolveRepo(cwd);
    const pend = st ? [...st.pending.values()].sort((a, b) => b.ts - a.ts)[0] : null;
    const edits = st ? [...st.edits.values()].filter(e => now - e.at < EDIT_WINDOW_MS) : [];
    const p = {
      id: s.sessionId, name: s.name || 'claude-' + s.pid, pid: s.pid,
      kind: s.kind, entrypoint: s.entrypoint, version: s.version,
      status: s.status, state: stateOf(s.status, st, now),
      since: s.statusUpdatedAt || s.updatedAt || s.startedAt, startedAt: s.startedAt,
      title: st ? st.title : '', cwd, branch: st ? st.branch : '',
      repo: repo ? { name: repo.name, path: repo.repo, worktree: repo.worktree, isWorktree: repo.isWorktree } : null,
      model: st ? st.model : '', ctx: st ? st.ctx : 0, turns: st ? st.turns : 0,
      doing: pend ? { tool: pend.name, what: pend.what, kind: pend.kind, for: now - pend.ts } : null,
      recent: st ? st.recent.slice(-8).reverse().map(r => ({ tool: r.name, what: r.what, kind: r.kind, ts: r.ts })) : [],
      skills: st ? st.skills : {}, mcps: st ? st.mcps : {}, tools: st ? st.tools : {},
      editing: edits.map(e => ({ worktree: e.repo.worktree, repo: e.repo.name, at: e.at })),
      subagents: tp ? subagentsOf(tp, now) : [],
      lastActivity: st ? Math.max(st.lastTs, st.mtime) : 0,
    };
    people.push(p);
  }
  people.sort((a, b) => a.startedAt - b.startedAt);

  // duas ou mais sessões editando o mesmo checkout nos últimos minutos
  const byTree = new Map();
  for (const p of people) for (const e of p.editing) {
    if (!byTree.has(e.worktree)) byTree.set(e.worktree, { worktree: e.worktree, repo: e.repo, who: new Set() });
    byTree.get(e.worktree).who.add(p.id);
  }
  const clashes = [...byTree.values()].filter(c => c.who.size > 1)
    .map(c => ({ worktree: privacy ? '' : c.worktree, repo: c.repo, who: [...c.who] }));

  if (privacy) for (const p of people) {
    p.title = ''; p.cwd = ''; p.doing = p.doing && { ...p.doing, what: '' };
    if (p.repo) p.repo = { name: p.repo.name, path: '', worktree: '', isWorktree: p.repo.isWorktree };
    p.editing = p.editing.map(e => ({ ...e, worktree: '' }));
    p.recent = p.recent.map(r => ({ ...r, what: '' }));
    p.subagents = p.subagents.map(a => ({ ...a, description: '', doing: '' }));
  }
  const hn = os.hostname().replace(/\.local$/, '');
  return { now, host: /^[\d.:]+$/.test(hn) ? '' : hn, people, clashes, credentials: globalCredentials() };
}

module.exports = { snapshot, CLAUDE_DIR };
