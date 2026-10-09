'use strict';
// Source: Claude Code. Live sessions in ~/.claude/sessions/<pid>.json; conversation in projects/**/<id>.jsonl.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { safeJson, alive, short, incremental, newest, track, baseState, event, addTokens } = require('../util');

const DIR = () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const SUBAGENT_ACTIVE_MS = 45 * 1000;

const ACTIVITY = {
  Edit: 'edit', Write: 'edit', NotebookEdit: 'edit', MultiEdit: 'edit',
  Read: 'read', Grep: 'read', Glob: 'read', LS: 'read', ToolSearch: 'read',
  Bash: 'terminal', Monitor: 'terminal', BashOutput: 'terminal',
  WebFetch: 'web', WebSearch: 'web',
  Agent: 'delegate', Task: 'delegate', Workflow: 'delegate', SendMessage: 'delegate',
  Skill: 'skill', AskUserQuestion: 'ask', ExitPlanMode: 'ask',
};
function activityOf(name) {
  if (ACTIVITY[name]) return ACTIVITY[name];
  if (name.startsWith('mcp__')) return /browser|chrome|web|page/i.test(name) ? 'web' : 'mcp';
  return 'other';
}

function summarize(name, input) {
  input = input || {};
  if (input.file_path) return path.basename(input.file_path);
  if (input.notebook_path) return path.basename(input.notebook_path);
  if (name === 'Bash') return short(input.description || input.command);
  if (name === 'Grep' || name === 'Glob') return short(input.pattern);
  if (name === 'WebFetch') { try { return new URL(input.url).hostname; } catch { return ''; } }
  if (name === 'WebSearch') return short(input.query);
  if (name === 'Skill') return short(input.skill);
  if (name === 'Agent' || name === 'Task') return short(input.description);
  if (name.startsWith('mcp__')) return name.split('__').slice(2).join('__');
  return '';
}

function isToolResult(content) {
  return Array.isArray(content) && content.length > 0 && content.every(c => c.type === 'tool_result');
}

function absorb(st, d) {
  const ts = d.timestamp ? Date.parse(d.timestamp) : 0;
  if (ts) st.lastTs = Math.max(st.lastTs, ts);
  if (d.cwd) st.cwd = d.cwd;
  if (d.gitBranch) st.branch = d.gitBranch;
  if (d.type === 'ai-title' && d.aiTitle) st.title = d.aiTitle;
  if (d.type === 'permission-mode' && d.permissionMode) st.permissionMode = d.permissionMode;
  if (d.type === 'system' && d.subtype === 'turn_duration') { st.pending.clear(); st.turns++; st.turnOpen = false; event(st, ts, 'idle'); }
  // the conversation is written immediately: a new message of yours or a model reply = turn open
  const prompt = d.type === 'user' && !d.isMeta && d.message && !isToolResult(d.message.content);
  if (prompt) event(st, ts, 'thinking');
  if (d.type === 'assistant' || prompt) st.turnOpen = true;
  const m = d.message;
  if (!m) return;
  if (d.type === 'assistant') {
    if (m.model && !m.model.startsWith('<')) st.model = m.model;
    const u = m.usage;
    if (u) { st.ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); addTokens(st, ts, u.output_tokens || 0); }
    for (const c of Array.isArray(m.content) ? m.content : []) {
      if (c.type !== 'tool_use') continue;
      const name = c.name || '?', input = c.input || {};
      const item = { id: c.id, name, kind: activityOf(name), what: summarize(name, input), ts: ts || Date.now() };
      // what the session is asking, for the "needs you" notice
      if (name === 'AskUserQuestion') item.ask = short(((input.questions || [])[0] || {}).question || '', 140);
      if (name === 'ExitPlanMode') item.ask = 'plan';
      track(st, item, input.file_path || input.notebook_path);
      if (name === 'Skill' && input.skill) st.skills[input.skill] = (st.skills[input.skill] || 0) + 1;
      if (name.startsWith('mcp__')) { const s = name.split('__')[1]; st.mcps[s] = (st.mcps[s] || 0) + 1; }
    }
  } else if (d.type === 'user') {
    const content = m.content;
    const interrupted = t => /^\[Request interrupted/.test(t || '');
    if (Array.isArray(content)) {
      for (const c of content) {
        if (c.type === 'tool_result') st.pending.delete(c.tool_use_id);
        if (c.type === 'text' && interrupted(c.text)) st.pending.clear();
      }
    } else if (typeof content === 'string' && interrupted(content)) st.pending.clear();
  }
}

const read = incremental(() => Object.assign(baseState(), { agentType: '', description: '' }), absorb);

const transcriptPath = new Map();
function findTranscript(sessionId) {
  const hit = transcriptPath.get(sessionId);
  if (hit && fs.existsSync(hit)) return hit;
  const root = path.join(DIR(), 'projects');
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch { return null; }
  for (const d of dirs) {
    const f = path.join(root, d, sessionId + '.jsonl');
    if (fs.existsSync(f)) { transcriptPath.set(sessionId, f); return f; }
  }
  return null;
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
    const st = read(full);
    if (!st) continue;
    if (!st.agentType) {
      const meta = safeJson(full.replace(/\.jsonl$/, '.meta.json')) || {};
      st.agentType = meta.agentType || 'agent';
      st.description = meta.description || '';
    }
    const pend = newest(st.pending);
    out.push({ id: f.replace(/^agent-|\.jsonl$/g, ''), type: st.agentType, description: st.description, state: pend ? pend.kind : 'thinking', doing: pend ? pend.what : '' });
  }
  return out.slice(0, 8);
}

// The session registry sometimes lags; the transcript is written the instant a message arrives.
// An open turn in the transcript wins, unless the registry says idle and the file has gone quiet
// (an interrupted turn doesn't always write its end).
function statusOf(s, st, now) {
  const reg = s.status === 'busy';
  if (!st) return reg ? 'busy' : 'idle';
  const fresh = now - st.mtime < 4000;
  if (st.turnOpen) return reg || now - st.mtime < 15000 ? 'busy' : 'idle';
  return reg && fresh ? 'busy' : 'idle';
}

function sessions(now) {
  const dir = path.join(DIR(), 'sessions');
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /^\d+\.json$/.test(f)); } catch { return []; }
  const out = [];
  for (const f of files) {
    const s = safeJson(path.join(dir, f)); // the *.key files next to it are never read
    if (!s || !s.sessionId || !alive(s.pid)) continue;
    const tp = findTranscript(s.sessionId);
    const st = tp ? read(tp) : null;
    out.push({
      agent: 'claude', id: s.sessionId, name: s.name || 'claude-' + s.pid, pid: s.pid,
      kind: s.kind, version: s.version, status: statusOf(s, st, now),
      since: s.statusUpdatedAt || s.updatedAt || s.startedAt, startedAt: s.startedAt,
      cwd: s.cwd, st, subagents: tp ? subagentsOf(tp, now) : [],
    });
  }
  return out;
}

// Every conversation touched since midnight (open or already closed), for the daily report.
function today(since) {
  const root = path.join(DIR(), 'projects');
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(root); } catch { return out; }
  for (const d of dirs) {
    let files = [];
    try { files = fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.jsonl')); } catch { continue; }
    for (const f of files) {
      const full = path.join(root, d, f);
      try { if (fs.statSync(full).mtimeMs < since) continue; } catch { continue; }
      const st = read(full);
      if (st) out.push({ agent: 'claude', id: f.replace(/\.jsonl$/, ''), st });
    }
  }
  return out;
}

function credentials() {
  const cj = safeJson(path.join(os.homedir(), '.claude.json')) || {};
  const topSkills = Object.entries(cj.skillUsage || {})
    .map(([name, v]) => ({ name, count: v.usageCount || 0 }))
    .filter(x => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);
  let skills = [];
  try { skills = fs.readdirSync(path.join(DIR(), 'skills')).filter(n => !n.startsWith('.') && n !== 'synced'); } catch {}
  return {
    topSkills, skills, mcps: Object.keys(cj.mcpServers || {}),
    plugins: Object.entries(cj.pluginUsage || {}).map(([name, v]) => ({ name: name.replace(/@.*$/, ''), count: v.usageCount || 0 })),
  };
}

module.exports = { id: 'claude', label: 'Claude Code', sessions, credentials, today };
