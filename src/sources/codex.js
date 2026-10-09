'use strict';
// Fonte: Codex (CLI e app). Não há registro de sessões vivas como no Claude Code, então
// conta como aberta a conversa mexida há pouco, e só enquanto há um processo do Codex a correr.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { short, incremental, newest, track, baseState } = require('../util');

const DIR = () => process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const OPEN_MS = 3 * 60 * 60 * 1000; // conversa sem mexer há mais que isto sai do escritório

const ACTIVITY = {
  exec_command: 'terminal', exec: 'terminal', shell: 'terminal', local_shell: 'terminal', js: 'terminal', write_stdin: 'terminal',
  apply_patch: 'edit', view_image: 'read', read_file: 'read', list_dir: 'read', grep_files: 'read',
  web_search: 'web', web_fetch: 'web', imagegen: 'other', wait: 'thinking',
  request_user_input_async: 'ask', request_user_input: 'ask', spawn_agent: 'delegate',
};
function activityOf(name) {
  if (ACTIVITY[name]) return ACTIVITY[name];
  if (name.includes('__') || name.startsWith('_')) return 'mcp';
  return 'other';
}

function parseArgs(a) {
  if (a && typeof a === 'object') return a;
  try { return JSON.parse(a); } catch { return { raw: String(a || '') }; }
}

function summarize(name, args, raw) {
  if (name === 'apply_patch') {
    const m = /\*\*\* (?:Update|Add|Delete) File: (.+)/.exec(raw || args.raw || '');
    return { what: m ? path.basename(m[1].trim()) : '', file: m ? m[1].trim() : '' };
  }
  const cmd = args.cmd || args.command;
  if (cmd) return { what: short(Array.isArray(cmd) ? cmd.join(' ') : cmd) };
  if (args.path) return { what: path.basename(args.path) };
  if (args.query) return { what: short(args.query) };
  if (name === 'js' || name === 'exec') return { what: short(args.raw || args.code || '') };
  return { what: '' };
}

function absorb(st, d) {
  const ts = d.timestamp ? Date.parse(d.timestamp) : 0;
  if (ts) st.lastTs = Math.max(st.lastTs, ts);
  const p = d.payload || {};
  if (d.type === 'session_meta') {
    st.id = p.id || p.session_id; st.cwd = p.cwd || st.cwd; st.version = p.cli_version || '';
    st.startedAt = p.timestamp ? Date.parse(p.timestamp) : ts; st.originator = p.originator || '';
    if (p.git && p.git.branch) st.branch = p.git.branch;
  } else if (d.type === 'turn_context') {
    if (p.cwd) st.cwd = p.cwd;
    if (p.model) st.model = p.model;
  } else if (d.type === 'event_msg') {
    const t = p.type;
    if (t === 'task_started') { st.busy = true; st.since = ts; if (p.model_context_window) st.ctxMax = Number(p.model_context_window) || 0; }
    else if (t === 'task_complete' || t === 'turn_aborted') { st.busy = false; st.since = ts; st.pending.clear(); st.turns++; }
    else if (t === 'thread_settings_applied' && p.thread_settings && p.thread_settings.model) st.model = p.thread_settings.model;
    else if (t === 'token_count' && p.info) {
      const u = p.info.last_token_usage || p.info.total_token_usage;
      if (u) st.ctx = u.input_tokens || 0;
      if (p.info.model_context_window) st.ctxMax = p.info.model_context_window;
    } else if (/approval_request$/.test(t || '')) {
      // pedido de aprovação explícito: precisa de você até a ferramenta responder
      const id = p.call_id || 'approval';
      st.pending.set(id, { id, name: 'approval', kind: 'ask', what: short(p.command ? [].concat(p.command).join(' ') : ''), ts: ts || Date.now() });
    }
  } else if (d.type === 'response_item') {
    if (p.type === 'function_call' || p.type === 'custom_tool_call' || p.type === 'local_shell_call') {
      const name = p.name || (p.type === 'local_shell_call' ? 'local_shell' : '?');
      const args = p.type === 'custom_tool_call' ? { raw: p.input } : parseArgs(p.arguments || p.action);
      const s = summarize(name, args, p.input);
      track(st, { id: p.call_id || p.id, name, kind: activityOf(name), what: s.what, ts: ts || Date.now() }, s.file);
      // as skills do Codex são lidas como ficheiros: ler um SKILL.md conta como usar a skill
      const sk = /skills\/(?:\.system\/)?([^/\s'"]+)\/SKILL\.md/.exec(JSON.stringify(args));
      if (sk) st.skills[sk[1]] = (st.skills[sk[1]] || 0) + 1;
      if (activityOf(name) === 'mcp') { const srv = name.startsWith('_') ? 'connector' : name.split('__')[0]; st.mcps[srv] = (st.mcps[srv] || 0) + 1; }
    } else if (/_output$/.test(p.type || '')) {
      st.pending.delete(p.call_id);
      st.pending.delete('approval');
    } else if (p.type === 'message' && p.role === 'user' && !st.title) {
      const txt = (p.content || []).map(c => c.text || '').join(' ');
      if (txt && !txt.startsWith('<')) st.firstPrompt = short(txt, 60);
    }
  }
}

// o Codex grava *_approval_request quando pede aprovação, então ferramenta parada é só demorada
const read = incremental(() => Object.assign(baseState(), { explicitApprovals: true, busy: false, since: 0, startedAt: 0, version: '', originator: '', id: '', firstPrompt: '' }), absorb);

let procCache = { at: 0, v: false };
function codexRunning() {
  if (process.env.COWORKS_CODEX_RUNNING) return process.env.COWORKS_CODEX_RUNNING === '1'; // testes
  if (Date.now() - procCache.at < 5000) return procCache.v;
  let v = false;
  try {
    const out = execFileSync('ps', ['-axo', 'comm='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    v = out.split('\n').some(c => /(^|\/)codex(\s|$)/i.test(c.trim()) || /Codex\.app\//.test(c));
  } catch {}
  procCache = { at: Date.now(), v };
  return v;
}

function titles() {
  const out = new Map();
  try {
    for (const line of fs.readFileSync(path.join(DIR(), 'session_index.jsonl'), 'utf8').split('\n')) {
      if (!line) continue;
      try { const d = JSON.parse(line); if (d.id && d.thread_name) out.set(d.id, d.thread_name); } catch {}
    }
  } catch {}
  return out;
}

function recentRollouts(now) {
  // só as pastas de hoje e ontem (sessions/AAAA/MM/DD)
  const files = [];
  for (const back of [0, 1]) {
    const d = new Date(now - back * 864e5);
    const dir = path.join(DIR(), 'sessions', String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0'));
    let list = [];
    try { list = fs.readdirSync(dir); } catch { continue; }
    for (const f of list) {
      if (!f.endsWith('.jsonl')) continue;
      const full = path.join(dir, f);
      try { if (now - fs.statSync(full).mtimeMs < OPEN_MS) files.push(full); } catch {}
    }
  }
  return files;
}

function sessions(now) {
  if (!fs.existsSync(DIR()) || !codexRunning()) return [];
  const names = titles();
  const out = [];
  for (const f of recentRollouts(now)) {
    const st = read(f);
    if (!st || !st.id) continue;
    st.title = names.get(st.id) || st.firstPrompt || '';
    out.push({
      agent: 'codex', id: st.id, name: 'codex-' + st.id.slice(-4), pid: null,
      kind: st.originator.includes('desktop') ? 'desktop' : 'cli', version: st.version,
      status: st.busy ? 'busy' : 'idle', since: st.since || st.lastTs, startedAt: st.startedAt || st.lastTs,
      cwd: st.cwd, st, subagents: [],
    });
  }
  return out;
}

function credentials() {
  let skills = [];
  for (const sub of ['skills', path.join('skills', '.system')]) {
    try { skills.push(...fs.readdirSync(path.join(DIR(), sub)).filter(n => !n.startsWith('.'))); } catch {}
  }
  return { topSkills: [], skills: [...new Set(skills)], mcps: [], plugins: [] };
}

module.exports = { id: 'codex', label: 'Codex', sessions, credentials };
