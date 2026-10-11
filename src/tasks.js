'use strict';
// Tasks you hand out from the office: each one runs a headless agent (claude -p / codex exec) in the
// background, in its own git worktree when asked. The office only controls sessions it started; sessions
// found by monitoring stay read-only. Tasks and their events live in ~/.config/coworking-agents/tasks/
// (tasks.json + one <id>.jsonl per task), so the link task → session survives a restart.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { costOf } = require('./prices');

const DIR = () => path.join(os.homedir(), '.config', 'coworking-agents', 'tasks');
const STATES = ['pending', 'running', 'blocked', 'done', 'failed', 'cancelled'];
const AGENTS = ['claude', 'codex'];
// profiles: model + effort per agent. Codex keeps its own default model (only the effort changes).
const PROFILES = {
  eco: { claude: { model: 'haiku', effort: 'low' }, codex: { model: '', effort: 'low' } },
  bal: { claude: { model: 'sonnet', effort: 'medium' }, codex: { model: '', effort: 'medium' } },
  deep: { claude: { model: 'opus', effort: 'high' }, codex: { model: '', effort: 'high' } },
};
const ORDER = ['eco', 'bal', 'deep'];
const EFFORTS = ['low', 'medium', 'high'];
const MODELS = { claude: ['haiku', 'sonnet', 'opus'], codex: [''] };

let tasks = [], settings = { maxParallel: 2 }, demo = false, loaded = false, timer = null;
const procs = new Map(), events = new Map(), listeners = new Set();

const now = () => Date.now();
const file = n => path.join(DIR(), n);
function save() {
  if (demo) return;
  try { fs.mkdirSync(DIR(), { recursive: true, mode: 0o700 }); fs.writeFileSync(file('tasks.json'), JSON.stringify({ tasks, settings }), { mode: 0o600 }); } catch {}
}
function log(t, ev) {
  ev = { at: now(), ...ev };
  const list = events.get(t.id) || []; list.push(ev); if (list.length > 400) list.shift(); events.set(t.id, list);
  if (!demo) try { fs.appendFileSync(file(t.id + '.jsonl'), JSON.stringify(ev) + '\n', { mode: 0o600 }); } catch {}
  t.updated = ev.at;
  if (ev.kind === 'warn') t.warn = { why: ev.why, name: ev.name || '', at: ev.at };
  for (const fn of listeners) try { fn(t, ev); } catch {}
}
function eventsOf(id) {
  if (!events.has(id) && !demo) {
    try { events.set(id, fs.readFileSync(file(id + '.jsonl'), 'utf8').trim().split('\n').slice(-400).map(l => JSON.parse(l))); } catch { events.set(id, []); }
  }
  return events.get(id) || [];
}

function load(opts = {}) {
  if (loaded) return; loaded = true;
  demo = !!opts.demo;
  if (demo) { tasks = require('./demo').demoTasks(); return; }
  try { const j = JSON.parse(fs.readFileSync(file('tasks.json'), 'utf8')); tasks = Array.isArray(j.tasks) ? j.tasks : []; settings = { ...settings, ...(j.settings || {}) }; } catch {}
  // the server stopped while these ran: the process is gone, the session (if any) can be resumed by replying
  for (const t of tasks) if (t.state === 'running') { t.state = t.sessionId ? 'blocked' : 'failed'; t.reason = 'restart'; }
  save();
}

// ---- recommendation: plain rules first (no AI call just to pick a setting), then what past tasks taught ----
const DEEP = /arquitet|investig|refator|refactor|migra|race|concorr|performance|desempenho|segurança|security|architecture|debug|intermit|redesign|reescrev|rewrite/i;
const ECO = /\b(doc|docs|readme|texto|text|typo|renome|rename|coment|comment|tradu|translat|copy|changelog|ortograf|spelling|lint|format)/i;
function recommend(desc = '', agent = 'claude') {
  let p = 'bal', why = 'default';
  if (DEEP.test(desc) || desc.length > 900) { p = 'deep'; why = 'deep'; }
  else if (ECO.test(desc) && desc.length < 400) { p = 'eco'; why = 'eco'; }
  // learning: similar finished tasks (shared words) that failed or needed retries at this profile → one step up
  const words = new Set(desc.toLowerCase().match(/[a-zà-ú]{5,}/g) || []);
  const similar = tasks.filter(t => t.profile === p && ['done', 'failed'].includes(t.state) && (t.desc.toLowerCase().match(/[a-zà-ú]{5,}/g) || []).filter(w => words.has(w)).length >= 2);
  const bad = similar.filter(t => t.state === 'failed' || t.attempts > 1).length;
  if (similar.length >= 2 && bad / similar.length > .5 && p !== 'deep') { p = ORDER[ORDER.indexOf(p) + 1]; why = 'history'; }
  const a = AGENTS.includes(agent) ? agent : 'claude';
  return { profile: p, ...PROFILES[p][a], why, similar: similar.length, bad };
}

// ---- create / control ----
const s = (v, n) => String(v == null ? '' : v).slice(0, n);
function validDir(d) {
  d = s(d, 500); let st = null;
  try { st = fs.statSync(d); } catch {}
  return path.isAbsolute(d) && st && st.isDirectory() && (d + '/').startsWith(os.homedir() + '/') ? d : null;
}
function create(m) {
  const dir = validDir(m.dir); if (!dir) return { ok: false, reason: 'nodir' };
  const desc = s(m.desc, 8000).trim(); if (!desc) return { ok: false, reason: 'nodesc' };
  let agent = !m.agent || m.agent === 'auto' ? pickAgent() : m.agent; if (!AGENTS.includes(agent)) return { ok: false, reason: 'unsupported' };
  const rec = recommend(desc, agent), profile = PROFILES[m.profile] ? m.profile : rec.profile;
  const t = {
    id: Math.random().toString(36).slice(2, 10), title: s(m.title, 80).trim() || s(desc, 60), desc, dir, agent, profile,
    model: MODELS[agent].includes(m.model) ? m.model : PROFILES[profile][agent].model,
    effort: EFFORTS.includes(m.effort) ? m.effort : PROFILES[profile][agent].effort,
    perm: ['acceptEdits', 'plan', 'default'].includes(m.perm) ? m.perm : 'acceptEdits',
    priority: Math.min(3, Math.max(1, Number(m.priority) || 2)), budget: Math.max(0, Number(m.budget) || 0),
    testCmd: s(m.testCmd, 300), worktree: !!m.worktree, dependsOn: tasks.some(x => x.id === m.dependsOn) ? m.dependsOn : '',
    from: s(m.from, 12), state: 'pending', reason: '', created: now(), updated: now(), sessionId: '', cwd: dir, cost: 0,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, attempts: 0, turns: 0, result: '', files: [], denials: [], allowed: [], configLog: [],
  };
  tasks.push(t); log(t, { kind: 'created', text: t.title, profile: t.profile, model: t.model, effort: t.effort }); save(); tick();
  return { ok: true, task: t };
}
function pickAgent() {
  const busy = a => tasks.filter(t => t.agent === a && t.state === 'running').length;
  return AGENTS.slice().sort((a, b) => busy(a) - busy(b))[0];
}
function setConfig(t, m) {
  const prev = { model: t.model, effort: t.effort, profile: t.profile };
  if (PROFILES[m.profile]) { t.profile = m.profile; t.model = PROFILES[m.profile][t.agent].model; t.effort = PROFILES[m.profile][t.agent].effort; }
  if (m.step) { const i = Math.max(0, Math.min(2, ORDER.indexOf(t.profile) + (m.step > 0 ? 1 : -1))); return setConfig(t, { profile: ORDER[i], why: m.why || (m.step > 0 ? 'more' : 'save') }); }
  if (MODELS[t.agent].includes(m.model)) t.model = m.model;
  if (EFFORTS.includes(m.effort)) t.effort = m.effort;
  const entry = { at: now(), from: prev, to: { model: t.model, effort: t.effort, profile: t.profile }, why: s(m.why, 40) || 'manual', applies: t.state === 'running' ? 'next' : 'now' };
  t.configLog.push(entry); log(t, { kind: 'config', ...entry }); save();
  return { ok: true, task: t };
}
function op(m = {}) {
  load();
  if (m.op === 'create') return create(m);
  if (m.op === 'settings') { settings.maxParallel = Math.min(6, Math.max(1, Number(m.maxParallel) || 2)); save(); tick(); return { ok: true, settings }; }
  if (m.op === 'recommend') return { ok: true, rec: recommend(s(m.desc, 8000), m.agent) };
  const t = tasks.find(x => x.id === m.id); if (!t) return { ok: false, reason: 'notask' };
  if (m.op === 'config') return setConfig(t, m);
  if (m.op === 'cancel') {
    if (t.state === 'running') { const p = procs.get(t.id); t.cancelling = true; if (p) p.kill('SIGTERM'); return { ok: true, pending: true }; } // confirmed when the process exits
    if (['pending', 'blocked'].includes(t.state)) { t.state = 'cancelled'; log(t, { kind: 'cancelled' }); save(); return { ok: true }; }
    return { ok: false, reason: 'state' };
  }
  if (m.op === 'reply' || m.op === 'approve' || m.op === 'retry') {
    if (t.state === 'running' || t.state === 'pending') return { ok: false, reason: 'state' };
    if (m.op === 'approve') { for (const d of t.denials) if (!t.allowed.includes(d.tool)) t.allowed.push(d.tool); t.denials = []; }
    t.next = m.op === 'approve' ? 'Permission granted. Continue.' : m.op === 'retry' ? (t.sessionId ? 'Try again.' : '') : s(m.text, 8000);
    if (m.op === 'reply' && !t.next.trim()) return { ok: false, reason: 'nodesc' };
    log(t, { kind: m.op, text: t.next }); t.state = 'pending'; t.reason = ''; save(); tick(); return { ok: true };
  }
  if (m.op === 'conclude') { t.state = 'done'; t.reason = ''; log(t, { kind: 'done' }); save(); return { ok: true }; }
  if (m.op === 'handoff') {
    const summary = `Handoff from task "${t.title}" (${t.agent}).\nOriginal request:\n${t.desc}\n\nLast result:\n${t.result || '(none)'}\n\nFiles touched: ${t.files.join(', ') || '(none)'}\n\nNext:\n${s(m.text, 4000) || 'Continue and finish this work.'}`;
    return create({ desc: summary, title: '↪ ' + t.title, dir: t.cwd || t.dir, agent: m.agent || 'auto', profile: t.profile, priority: t.priority, testCmd: t.testCmd, from: t.id });
  }
  if (m.op === 'delete') { if (t.state === 'running') return { ok: false, reason: 'state' }; tasks = tasks.filter(x => x !== t); events.delete(t.id); if (!demo) try { fs.unlinkSync(file(t.id + '.jsonl')); } catch {} save(); return { ok: true }; }
  return { ok: false, reason: 'op' };
}

// ---- queue: highest priority first, then oldest; a dependency must be done first ----
function tick() {
  if (demo) return;
  const running = tasks.filter(t => t.state === 'running').length;
  const ready = tasks.filter(t => t.state === 'pending' && (!t.dependsOn || (tasks.find(x => x.id === t.dependsOn) || {}).state === 'done'))
    .sort((a, b) => b.priority - a.priority || a.created - b.created);
  for (const t of ready.slice(0, Math.max(0, settings.maxParallel - running))) run(t);
}

const git = (cwd, args) => new Promise(r => execFile('git', ['-C', cwd, ...args], { timeout: 20000, maxBuffer: 4e6 }, (e, out) => r(e ? null : String(out))));
async function run(t) {
  t.state = 'running'; t.reason = ''; t.attempts++; save();
  if (t.worktree && t.cwd === t.dir && await git(t.dir, ['rev-parse', '--git-dir']) != null) {
    const wt = path.join(os.homedir(), '.config', 'coworking-agents', 'worktrees', t.id);
    if (await git(t.dir, ['worktree', 'add', '-b', 'coworking/' + t.id, wt]) != null) { t.cwd = wt; log(t, { kind: 'worktree', text: wt }); }
  }
  const prompt = t.next || t.desc; t.next = '';
  const a = t.agent === 'claude'
    ? ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', t.perm, ...(t.model ? ['--model', t.model] : []), '--effort', t.effort,
      ...(t.allowed.length ? ['--allowedTools', t.allowed.join(',')] : []), ...(t.sessionId ? ['--resume', t.sessionId] : [])]
    : ['exec', ...(t.sessionId ? ['resume', t.sessionId] : []), '--json', '--skip-git-repo-check', ...(t.model ? ['-m', t.model] : []), '-c', `model_reasoning_effort="${t.effort}"`, ...(t.sessionId ? [] : ['--sandbox', 'workspace-write']), prompt];
  log(t, { kind: 'start', model: t.model, effort: t.effort, attempt: t.attempts });
  let child;
  try { child = spawn(t.agent, a, { cwd: t.cwd, stdio: ['ignore', 'pipe', 'pipe'], env: process.env }); } catch { return finish(t, 1, 'spawn'); }
  procs.set(t.id, child);
  let buf = '', err = '', turnCost = 0; const seen = new Map();
  child.on('error', () => { err += 'spawn failed'; });
  child.stderr.on('data', d => { err = (err + d).slice(-2000); });
  child.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      let j; try { j = JSON.parse(line); } catch { continue; }
      turnCost = absorb(t, j, seen, turnCost);
      if (t.budget && t.cost + turnCost > t.budget && !t.cancelling) { t.overBudget = true; t.cancelling = true; child.kill('SIGTERM'); log(t, { kind: 'warn', why: 'budget', usd: t.cost + turnCost }); }
    }
  });
  child.on('close', code => { procs.delete(t.id); if (turnCost && !t.costFinal) t.cost += turnCost; t.costFinal = false; finish(t, code, err); });
}

function addUsage(t, u) {
  if (!u) return;
  t.tokens.input += u.input_tokens || 0; t.tokens.output += u.output_tokens || 0;
  t.tokens.cacheRead += u.cache_read_input_tokens || u.cached_input_tokens || 0; t.tokens.cacheWrite += u.cache_creation_input_tokens || 0;
}
function absorb(t, j, seen, turnCost) {
  if (t.agent === 'claude') {
    if (j.type === 'system' && j.subtype === 'init' && j.session_id) { t.sessionId = j.session_id; save(); }
    if (j.type === 'assistant' && j.message) {
      for (const c of j.message.content || []) {
        if (c.type === 'text' && c.text) log(t, { kind: 'text', text: s(c.text, 2000) });
        if (c.type === 'tool_use') toolEvent(t, c.name, c.input, seen);
      }
      const u = j.message.usage; if (u) { const c = costOf(t.model || 'sonnet', { input: u.input_tokens || 0, output: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0 }); turnCost += c || 0; }
    }
    if (j.type === 'result') {
      addUsage(t, j.usage); t.turns += j.num_turns || 0; t.result = s(j.result, 6000);
      if (typeof j.total_cost_usd === 'number') { t.cost += j.total_cost_usd; t.costFinal = true; turnCost = 0; }
      t.denials = (j.permission_denials || []).map(d => ({ tool: s(d.tool_name, 60), what: s(JSON.stringify(d.tool_input || {}), 200) })).slice(0, 10);
      t.failedTurn = !!j.is_error; log(t, { kind: 'result', text: t.result, usd: j.total_cost_usd, error: !!j.is_error });
    }
  } else {
    if (j.type === 'thread.started' && j.thread_id) { t.sessionId = j.thread_id; save(); }
    const it = j.item || {};
    if (j.type === 'item.completed' && it.type === 'agent_message') { t.result = s(it.text, 6000); log(t, { kind: 'text', text: s(it.text, 2000) }); }
    if (j.type === 'item.started' && it.type) toolEvent(t, it.type, it.command || it.changes || it.query || '', seen);
    if (j.type === 'turn.completed') { addUsage(t, j.usage); t.turns++; const u = j.usage || {}; if (!t.model) t.costUnknown = true; const c = t.model && costOf(t.model, { input: (u.input_tokens || 0) - (u.cached_input_tokens || 0), output: u.output_tokens || 0, cacheRead: u.cached_input_tokens || 0, cacheWrite: 0 }); t.cost += c || 0; }
    if (j.type === 'turn.failed' || j.type === 'error') { t.failedTurn = true; log(t, { kind: 'error', text: s((j.error && j.error.message) || j.message, 400) }); }
  }
  return turnCost;
}
// the same tool with the same input 3 times is a loop without progress: say so once
function toolEvent(t, name, input, seen) {
  const what = s(typeof input === 'string' ? input : JSON.stringify(input), 160), key = name + what, n = (seen.get(key) || 0) + 1;
  seen.set(key, n); log(t, { kind: 'tool', name: s(name, 40), text: what });
  if (n === 3) log(t, { kind: 'warn', why: 'loop', name: s(name, 40) });
}

async function finish(t, code, err) {
  if (t.cancelling && !t.overBudget) { t.cancelling = false; t.state = 'cancelled'; log(t, { kind: 'cancelled' }); return done(t); }
  if (t.overBudget) { t.overBudget = t.cancelling = false; t.state = 'blocked'; t.reason = 'budget'; return done(t); }
  const st = await git(t.cwd, ['status', '--porcelain']);
  if (st != null) t.files = st.split('\n').filter(Boolean).map(l => l.slice(3)).slice(0, 100);
  if (code !== 0 || t.failedTurn) {
    t.state = 'failed'; t.reason = 'error'; log(t, { kind: 'error', text: s(err, 600), code });
    if (t.attempts >= 2) log(t, { kind: 'warn', why: 'retry' });
    return done(t);
  }
  if (t.testCmd) {
    const r = await new Promise(res => execFile('/bin/sh', ['-c', t.testCmd], { cwd: t.cwd, timeout: 600000, maxBuffer: 4e6 }, (e, out, er) => res({ code: e ? (e.code || 1) : 0, out: String(out || '') + String(er || '') })));
    t.tests = { code: r.code, at: now() }; log(t, { kind: 'test', code: r.code, text: r.out.slice(-3000) });
  }
  t.state = 'blocked'; t.reason = t.denials.length ? 'approval' : /\?\s*$/.test(t.result) ? 'question' : 'review';
  done(t);
}
function done(t) { log(t, { kind: 'state', state: t.state, reason: t.reason }); save(); tick(); }

async function diff(id) {
  load(); const t = tasks.find(x => x.id === id); if (!t) return { ok: false };
  if (demo) return { ok: true, stat: ' src/app.js | 4 ++--\n 1 file changed', diff: '-old line\n+new line' };
  const base = t.cwd !== t.dir ? ['diff', 'HEAD'] : ['diff'];
  return { ok: true, stat: await git(t.cwd, [...base, '--stat']) || '', diff: (await git(t.cwd, base) || '').slice(0, 60000) };
}

function list() { load(); return { tasks, settings, profiles: PROFILES, models: MODELS, efforts: EFFORTS }; }
function get(id) { load(); const t = tasks.find(x => x.id === id); return t ? { ...t, events: eventsOf(id).slice(-300) } : null; }
// plain text search over tasks and their events (no index, no embeddings: fast enough at this size)
function search(q) {
  load(); q = s(q, 100).toLowerCase().trim(); if (q.length < 2) return [];
  const out = [];
  for (const t of tasks) {
    const hits = [t.title, t.desc, t.result].filter(x => x && x.toLowerCase().includes(q)).length + eventsOf(t.id).filter(e => e.text && String(e.text).toLowerCase().includes(q)).length;
    if (hits) out.push({ id: t.id, title: t.title, state: t.state, agent: t.agent, updated: t.updated, hits });
  }
  return out.sort((a, b) => b.hits - a.hits || b.updated - a.updated).slice(0, 30);
}
function startQueue(opts) { load(opts); if (!timer && !demo) { timer = setInterval(tick, 3000); timer.unref(); tick(); } }
function onEvent(fn) { listeners.add(fn); }
function _reset(o = {}) { tasks = []; events.clear(); loaded = false; load(o); }

module.exports = { op, list, get, diff, search, recommend, startQueue, onEvent, load, STATES, PROFILES, _reset };
