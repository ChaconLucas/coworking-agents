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
const { dayKey } = require('./util');

const DIR = () => path.join(os.homedir(), '.config', 'coworking-agents', 'tasks');
const STATES = ['pending', 'running', 'blocked', 'done', 'failed', 'cancelled'];
const AGENTS = ['claude', 'codex'];
const ORDER = ['eco', 'bal', 'deep'];
// what each operation may start from: the backend refuses anything else
const ALLOWED = {
  cancel: ['pending', 'running', 'blocked'], reply: ['blocked', 'failed'], approve: ['blocked'], retry: ['failed', 'cancelled', 'blocked'],
  conclude: ['blocked'], compact: ['blocked', 'failed'], handoff: ['blocked', 'failed', 'done'], delete: ['pending', 'blocked', 'done', 'failed', 'cancelled'],
};
// short instructions added on demand: a role, and the economy rules (cheap context, no log dumps)
const ROLES = {
  backend: 'You are the backend engineer on this task. Focus on server code, data and APIs; keep changes minimal and covered by tests.',
  frontend: 'You are the frontend engineer on this task. Focus on UI code; keep the existing look and conventions, check accessibility and both languages if the project has them.',
  reviewer: 'You are the reviewer on this task. Do not rewrite the work: read the diff, run the tests, list concrete problems with file:line and fix only clear bugs.',
};
const LEAN = 'Work economically: read only the files and line ranges you need, search before opening, never paste long logs (use tail/grep), do not re-explore what you already read, and keep replies short.';

// ---- models and efforts the integration really supports ----
const CLAUDE = { models: ['haiku', 'sonnet', 'opus'], efforts: ['low', 'medium', 'high', 'xhigh', 'max'] };
function codexCatalog() { // ~/.codex/models_cache.json (written by Codex) and the default model in config.toml
  let models = [], def = '';
  try { const j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.codex', 'models_cache.json'), 'utf8')); models = (j.models || []).map(m => ({ slug: String(m.slug), efforts: (m.supported_reasoning_levels || []).map(e => String(e.effort)) })).filter(m => /^[\w.-]+$/.test(m.slug)); } catch {}
  try { const m = /^\s*model\s*=\s*"([\w.-]+)"/m.exec(fs.readFileSync(path.join(os.homedir(), '.codex', 'config.toml'), 'utf8')); if (m) def = m[1]; } catch {}
  return { models, def };
}
function options(agent) {
  if (agent === 'claude') return { models: CLAUDE.models, efforts: CLAUDE.efforts, def: '' };
  const c = codexCatalog(), all = new Set(c.models.flatMap(m => m.efforts));
  return { models: ['', ...c.models.map(m => m.slug)], efforts: all.size ? [...all] : ['low', 'medium', 'high'], def: c.def, byModel: Object.fromEntries(c.models.map(m => [m.slug, m.efforts])) };
}
const PROFILES = {
  eco: { claude: { model: 'haiku', effort: 'low' }, codex: { model: '', effort: 'low' } },
  bal: { claude: { model: 'sonnet', effort: 'medium' }, codex: { model: '', effort: 'medium' } },
  deep: { claude: { model: 'opus', effort: 'high' }, codex: { model: '', effort: 'high' } },
};

let tasks = [], settings = { maxParallel: 2, maxAttempts: 3, autoApply: false, autoMax: 'bal', autoPerTask: 1 }, demo = false, loaded = false, timer = null;
const procs = new Map(), events = new Map(), listeners = new Set();
const now = () => Date.now();
const file = n => path.join(DIR(), n);
const s = (v, n) => String(v == null ? '' : v).slice(0, n);

function save() {
  if (demo) return;
  try { fs.mkdirSync(DIR(), { recursive: true, mode: 0o700 }); fs.writeFileSync(file('tasks.json'), JSON.stringify({ tasks: tasks.map(pub), settings }), { mode: 0o600 }); } catch {}
}
function log(t, ev) {
  ev = { at: now(), ...ev };
  const list = eventsOf(t.id); list.push(ev); if (list.length > 400) list.shift();
  if (!demo) try { fs.mkdirSync(DIR(), { recursive: true, mode: 0o700 }); fs.appendFileSync(file(t.id + '.jsonl'), JSON.stringify(ev) + '\n', { mode: 0o600 }); } catch {}
  t.updated = ev.at;
  if (ev.kind === 'warn') { t.warn = { why: ev.why, name: ev.name || '', at: ev.at, rec: ev.rec || null }; if (ev.rec) setTimeout(() => autoApply(t, ev.rec), 0); }
  for (const fn of listeners) try { fn(t, ev); } catch {}
}
function eventsOf(id) {
  if (!events.has(id)) {
    let list = [];
    if (!demo) try { list = fs.readFileSync(file(id + '.jsonl'), 'utf8').trim().split('\n').slice(-400).map(l => JSON.parse(l)); } catch {}
    events.set(id, list);
  }
  return events.get(id);
}

const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const run1 = (cmd, args, opts = {}) => new Promise(r => execFile(cmd, args, { timeout: 20000, maxBuffer: 8e6, ...opts }, (e, out, err) => r({ code: e ? (typeof e.code === 'number' ? e.code : 1) : 0, out: String(out || ''), err: String(err || (e && e.message) || '') })));
const git = async (cwd, args) => { const r = await run1('git', ['-C', cwd, ...args]); return r.code === 0 ? r.out : null; };
// a pid we saved belongs to our agent only if its command still is that agent
async function ours(t) { if (!t.pid || !alive(t.pid)) return false; const r = await run1('ps', ['-o', 'command=', '-p', String(t.pid)]); return new RegExp('\\b' + t.agent + '\\b').test(r.out); }

function load(opts = {}) {
  if (loaded) return; loaded = true;
  demo = !!opts.demo;
  if (demo) { tasks = require('./demo').demoTasks(); return; }
  try { const j = JSON.parse(fs.readFileSync(file('tasks.json'), 'utf8')); tasks = Array.isArray(j.tasks) ? j.tasks : []; settings = { ...settings, ...(j.settings || {}) }; } catch {}
  // the server stopped while these ran: an agent still alive keeps its slot ("detached") until it exits
  for (const t of tasks) if (t.state === 'running') { t.reason = 'detached'; t.detached = true; t.ask = null; }
  save();
}
async function checkDetached() {
  for (const t of tasks.filter(x => x.state === 'running' && x.detached)) {
    if (await ours(t)) continue;
    t.detached = false; t.pid = 0; t.compactOnly = false;
    if (t.cancelling) { t.cancelling = false; t.state = 'cancelled'; t.reason = ''; log(t, { kind: 'cancelled' }); }
    else { t.state = t.sessionId ? 'blocked' : 'failed'; t.reason = 'restart'; log(t, { kind: 'state', state: t.state, reason: 'restart' }); }
    save();
  }
}

// ---- cost: per model, per day; unknown is not zero ----
function addCost(t, model, u, usd) {
  const key = model || '?';
  const c = typeof usd === 'number' ? usd : costOf(model, u);
  const m = t.byModel[key] || (t.byModel[key] = { usd: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, unpriced: false });
  for (const k of ['input', 'output', 'cacheRead', 'cacheWrite']) { m[k] += u[k] || 0; t.tokens[k] += u[k] || 0; }
  if (c == null) { m.unpriced = true; t.costUnknown = true; return 0; }
  m.usd += c; t.cost += c; const d = dayKey(now()); t.costByDay[d] = (t.costByDay[d] || 0) + c;
  return c;
}
const claudeUsage = u => ({ input: u.input_tokens || u.inputTokens || 0, output: u.output_tokens || u.outputTokens || 0, cacheRead: u.cache_read_input_tokens || u.cacheReadInputTokens || 0, cacheWrite: u.cache_creation_input_tokens || u.cacheCreationInputTokens || 0 });

// ---- recommendation: rules on scope, context and attempts, then what similar finished tasks show ----
const DEEP = /arquitet|investig|refator|refactor|migra|race|concorr|performance|desempenho|segurança|security|architecture|debug|intermit|redesign|reescrev|rewrite/i;
const ECO = /\b(doc|docs|readme|texto|text|typo|renome|rename|coment|comment|tradu|translat|copy|changelog|ortograf|spelling|lint|format)/i;
const WIDE = /\b(todo o projeto|todos os|every|all files|whole|inteiro|monorepo|everywhere)\b/i;
const words = d => new Set(String(d).toLowerCase().match(/[a-zà-ú]{5,}/g) || []);
function stats(list) {
  const n = list.length, ok = list.filter(t => t.state === 'done' && (!t.tests || t.tests.code === 0)).length;
  return { n, success: n ? ok / n : 0, cost: n ? list.reduce((a, t) => a + (t.cost || 0), 0) / n : 0, attempts: n ? list.reduce((a, t) => a + (t.attempts || 0), 0) / n : 0 };
}
function recommend(desc = '', agent = 'claude', task = null, live = null) {
  const why = [];
  const files = (String(desc).match(/[\w/-]+\.[a-z]{1,5}\b/gi) || []).length;
  let p = 'bal';
  if (DEEP.test(desc) || desc.length > 900 || files > 6 || WIDE.test(desc)) { p = 'deep'; why.push(DEEP.test(desc) ? 'deep' : 'scope'); }
  else if (ECO.test(desc) && desc.length < 400 && files <= 2) { p = 'eco'; why.push('eco'); }
  else why.push('default');
  if (task && (task.attempts >= 2 || task.state === 'failed') && p !== 'deep') { p = ORDER[ORDER.indexOf(p) + 1]; why.push('attempts'); }
  // signals while the task runs: loops and repeated failures ask for more, a run far above the median for less
  if (task && task.warn && ['loop', 'retry'].includes(task.warn.why) && p !== 'deep' && !why.includes('attempts')) { p = ORDER[ORDER.indexOf(p) + 1]; why.push('signal-' + task.warn.why); }
  if (task && task.warn && task.warn.why === 'high' && p !== 'eco') { p = ORDER[ORDER.indexOf(p) - 1]; why.push('signal-high'); }
  // a session opened outside, watched while it runs: stuck on one step asks for more, a nearly full context for a fresh start
  if (live && Number(live.stuckMs) > 6e5 && p !== 'deep') { p = ORDER[ORDER.indexOf(p) + 1]; why.push('live-stuck'); }
  if (live && Number(live.ctx) > .8) why.push('live-ctx');
  // history: similar finished tasks (2+ shared words); success = done with passing tests
  const w = words(desc), similar = tasks.filter(t => t !== task && ['done', 'failed'].includes(t.state) && [...words(t.desc)].filter(x => w.has(x)).length >= 2);
  const by = Object.fromEntries(ORDER.map(k => [k, stats(similar.filter(t => t.profile === k))]));
  if (by[p].n >= 2 && by[p].success < .5 && p !== 'deep') { p = ORDER[ORDER.indexOf(p) + 1]; why.push('history-up'); }
  else { const lower = ORDER.slice(0, ORDER.indexOf(p)).reverse().find(k => by[k].n >= 2 && by[k].success >= .8 && by[k].attempts <= 1.3); if (lower) { p = lower; why.push('history-down'); } }
  const a = AGENTS.includes(agent) ? agent : 'claude';
  const missing = [];
  if (String(desc).trim().length < 20) missing.push('desc');
  if (!similar.length) missing.push('history');
  if (a === 'codex' && !options('codex').def) missing.push('codexModel');
  return { profile: p, ...PROFILES[p][a], why, history: by, similar: similar.length, missing };
}

// ---- create / control ----
function validDir(d) {
  d = s(d, 500); let st = null;
  try { st = fs.statSync(d); } catch {}
  return path.isAbsolute(d) && st && st.isDirectory() && (d + '/').startsWith(os.homedir() + '/') ? d : null;
}
function pickAgent() {
  const busy = a => tasks.filter(t => t.agent === a && t.state === 'running').length;
  return AGENTS.slice().sort((a, b) => busy(a) - busy(b))[0];
}
function create(m) {
  const dir = validDir(m.dir); if (!dir) return { ok: false, reason: 'nodir' };
  const desc = s(m.desc, 12000).trim(); if (!desc) return { ok: false, reason: 'nodesc' };
  const agent = !m.agent || m.agent === 'auto' ? pickAgent() : m.agent; if (!AGENTS.includes(agent)) return { ok: false, reason: 'unsupported' };
  // continue a conversation opened outside (terminal, VS Code, the app): same session id, no worktree
  const resume = /^[\w-]{8,64}$/.test(m.resume || '') ? m.resume : '';
  const rec = recommend(desc, agent), profile = PROFILES[m.profile] ? m.profile : rec.profile, opt = options(agent);
  const t = {
    id: Math.random().toString(36).slice(2, 10), title: s(m.title, 80).trim() || s(desc.split('\n')[0], 60), desc, dir, agent, profile,
    model: opt.models.includes(m.model) ? m.model : PROFILES[profile][agent].model,
    effort: opt.efforts.includes(m.effort) ? m.effort : PROFILES[profile][agent].effort,
    role: ROLES[m.role] ? m.role : '', lean: m.lean === undefined ? profile === 'eco' : !!m.lean,
    perm: ['acceptEdits', 'plan', 'default'].includes(m.perm) ? m.perm : 'acceptEdits',
    priority: Math.min(3, Math.max(1, Number(m.priority) || 2)), budget: Math.max(0, Number(m.budget) || 0),
    testCmd: s(m.testCmd, 300), worktree: !!m.worktree && !resume, dependsOn: tasks.some(x => x.id === m.dependsOn) ? m.dependsOn : '',
    from: s(m.from, 12), state: 'pending', reason: '', created: now(), updated: now(), sessionId: resume, adopted: !!resume, compactOnly: !!(m.compact && resume), cwd: dir, baseCommit: '', pid: 0,
    cost: 0, costUnknown: false, byModel: {}, costByDay: {}, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    attempts: 0, turns: 0, subagents: 0, result: '', files: [], denials: [], allowed: [], configLog: [], running: null,
  };
  tasks.push(t); log(t, { kind: 'created', profile: t.profile, model: t.model, effort: t.effort, why: rec.why }); save(); tick();
  return { ok: true, task: t };
}
function setConfig(t, m) {
  const prev = { model: t.model, effort: t.effort, profile: t.profile }, opt = options(t.agent);
  if (m.step) { const i = Math.max(0, Math.min(2, ORDER.indexOf(t.profile) + (m.step > 0 ? 1 : -1))); m = { ...m, profile: ORDER[i] }; }
  if (PROFILES[m.profile]) { t.profile = m.profile; t.model = PROFILES[m.profile][t.agent].model; t.effort = PROFILES[m.profile][t.agent].effort; }
  if (m.model !== undefined && opt.models.includes(m.model)) t.model = m.model;
  if (m.effort !== undefined && opt.efforts.includes(m.effort)) t.effort = m.effort;
  if (m.role !== undefined) t.role = ROLES[m.role] ? m.role : '';
  if (m.lean !== undefined) t.lean = !!m.lean;
  const entry = { at: now(), from: prev, to: { model: t.model, effort: t.effort, profile: t.profile }, why: s(m.why, 60) || 'manual', applies: t.state === 'running' ? 'next' : 'now' };
  t.configLog.push(entry); if (t.configLog.length > 50) t.configLog.shift();
  log(t, { kind: 'config', ...entry }); save();
  return { ok: true, task: t };
}
function op(m = {}) {
  load();
  if (m.op === 'create') return create(m);
  if (m.op === 'settings') {
    if (m.maxParallel !== undefined) settings.maxParallel = Math.min(6, Math.max(1, Number(m.maxParallel) || 2));
    if (m.maxAttempts !== undefined) settings.maxAttempts = Math.min(10, Math.max(1, Number(m.maxAttempts) || 3));
    if (m.autoApply !== undefined) settings.autoApply = !!m.autoApply;
    if (ORDER.includes(m.autoMax)) settings.autoMax = m.autoMax;
    if (m.autoPerTask !== undefined) settings.autoPerTask = Math.min(5, Math.max(0, Number(m.autoPerTask) || 0));
    save(); tick(); return { ok: true, settings };
  }
  if (m.op === 'recommend') { const t = tasks.find(x => x.id === m.id); return { ok: true, rec: recommend(s(m.desc || (t && t.desc), 12000), m.agent || (t && t.agent), t, m.live && typeof m.live === 'object' ? m.live : null) }; }
  const t = tasks.find(x => x.id === m.id); if (!t) return { ok: false, reason: 'notask' };
  if (m.op === 'config') return setConfig(t, m);
  if (ALLOWED[m.op] && !ALLOWED[m.op].includes(t.state)) return { ok: false, reason: 'state' };
  if (m.op === 'cancel') {
    if (t.state === 'running') { // confirmed only when the process (worktree setup, agent or tests) has exited
      t.cancelling = true; const p = procs.get(t.id);
      if (p) p.kill('SIGTERM'); else if (t.detached && t.pid) ours(t).then(y => { if (y) try { process.kill(t.pid, 'SIGTERM'); } catch {} });
      log(t, { kind: 'cancelling' }); return { ok: true, pending: true };
    }
    t.state = 'cancelled'; t.reason = ''; log(t, { kind: 'cancelled' }); save(); return { ok: true };
  }
  if (m.op === 'reply' || m.op === 'approve' || m.op === 'retry') {
    const next = m.op === 'approve' ? 'Permission granted. Continue.' : m.op === 'retry' ? (t.sessionId ? 'Try again.' : '') : s(m.text, 8000).trim();
    if (m.op === 'reply' && !next) return { ok: false, reason: 'nodesc' };
    if (m.op === 'retry' && t.attempts >= settings.maxAttempts) return { ok: false, reason: 'attempts' };
    if (m.op === 'approve') { for (const d of t.denials) if (!t.allowed.includes(d.tool)) t.allowed.push(d.tool); t.denials = []; }
    t.next = next; log(t, { kind: m.op, text: next }); t.state = 'pending'; t.reason = ''; save(); tick(); return { ok: true };
  }
  if (m.op === 'fresh') { // a new session that starts from a summary instead of the whole old context
    if (!['blocked', 'failed'].includes(t.state)) return { ok: false, reason: 'state' };
    t.next = handoffText(t, s(m.text, 4000)); t.sessionId = ''; t.denials = []; log(t, { kind: 'fresh' }); t.state = 'pending'; t.reason = ''; save(); tick(); return { ok: true };
  }
  if (m.op === 'permit') { const f = askers.get(t.id); if (!f || !t.ask) return { ok: false, reason: 'state' }; f(!!m.allow, !!m.always); return { ok: true }; }
  if (m.op === 'compact') { // shrinks the same session's context (Claude /compact, Codex thread/compact/start); nothing else runs
    if (!t.sessionId) return { ok: false, reason: 'nosession' };
    t.compactOnly = true; t.next = ''; log(t, { kind: 'compact-asked' }); t.state = 'pending'; t.reason = ''; save(); tick(); return { ok: true };
  }
  if (m.op === 'conclude') { t.state = 'done'; t.reason = ''; log(t, { kind: 'done' }); save(); tick(); return { ok: true }; }
  if (m.op === 'handoff') return create({ desc: handoffText(t, s(m.text, 4000)), title: '↪ ' + t.title, dir: t.cwd || t.dir, agent: m.agent || 'auto', profile: t.profile, role: m.role, priority: t.priority, testCmd: t.testCmd, from: t.id });
  if (m.op === 'delete') { tasks = tasks.filter(x => x !== t); events.delete(t.id); if (!demo) try { fs.unlinkSync(file(t.id + '.jsonl')); } catch {} save(); return { ok: true }; }
  return { ok: false, reason: 'op' };
}
// the next agent gets the request, what was decided, the tests and what is still open
function handoffText(t, next) {
  const ev = eventsOf(t.id), said = ev.filter(e => e.kind === 'text').slice(-4).map(e => '- ' + s(e.text, 400).replace(/\n+/g, ' ')), test = ev.filter(e => e.kind === 'test').slice(-1)[0];
  const open = [t.reason && t.state !== 'done' ? `state: ${t.state} (${t.reason})` : '', ...t.denials.map(d => `blocked tool: ${d.tool} ${d.what}`), t.warn ? `warning: ${t.warn.why}` : ''].filter(Boolean);
  return `Handoff from task "${t.title}" (${t.agent}, ${t.attempts} attempt(s)).\n\nOriginal request:\n${t.desc}\n\nDecisions and notes from the previous agent:\n${said.join('\n') || '(none)'}\n\nLast result:\n${t.result || '(none)'}\n\nTests: ${test ? `\`${t.testCmd}\` exited ${test.code}\n${s(test.text, 800)}` : '(not run)'}\n\nFiles touched: ${t.files.join(', ') || '(none)'}${t.baseCommit ? ` (since ${t.baseCommit.slice(0, 8)})` : ''}\n\nOpen items:\n${open.map(x => '- ' + x).join('\n') || '(none)'}\n\nNext:\n${next || 'Continue and finish this work.'}`;
}

// ---- queue: highest priority first, then oldest; a dependency must be done first ----
function tick() {
  if (demo) return;
  const running = tasks.filter(t => t.state === 'running').length;
  const ready = tasks.filter(t => t.state === 'pending' && (!t.dependsOn || (tasks.find(x => x.id === t.dependsOn) || {}).state === 'done'))
    .sort((a, b) => b.priority - a.priority || a.created - b.created);
  for (const t of ready.slice(0, Math.max(0, settings.maxParallel - running))) run(t);
}

function child(t, cmd, args, opts) { // every process of a task is tracked, so cancel reaches it
  const c = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, ...opts });
  procs.set(t.id, c); t.pid = c.pid || 0; save();
  return c;
}
async function prepare(t) {
  if (!t.baseCommit) t.baseCommit = (await git(t.dir, ['rev-parse', 'HEAD']) || '').trim();
  if (!t.worktree || t.cwd !== t.dir) return null;
  if (!t.baseCommit) return 'nogit';
  const wt = path.join(os.homedir(), '.config', 'coworking-agents', 'worktrees', t.id);
  const r = await new Promise(res => { const c = child(t, 'git', ['-C', t.dir, 'worktree', 'add', '-b', 'coworking/' + t.id, wt, t.baseCommit]); let err = ''; c.stderr.on('data', d => { err += d; }); c.on('error', e => res({ code: 1, err: e.message })); c.on('close', code => res({ code, err })); });
  procs.delete(t.id); t.pid = 0;
  if (r.code !== 0) return 'worktree: ' + s(r.err, 300).trim();
  t.cwd = wt; log(t, { kind: 'worktree', text: wt });
  return null;
}
async function run(t) {
  t.state = 'running'; t.reason = ''; if (!t.compactOnly) t.attempts++;
  Object.assign(t, { failedTurn: false, overBudget: false, cancelling: false, budgetWarned: false, detached: false, warn: null }); // a new attempt starts clean
  const cfg = { model: t.model, effort: t.effort };
  if (t.running && (t.running.model !== cfg.model || t.running.effort !== cfg.effort)) log(t, { kind: 'applied', from: t.running, to: cfg });
  t.running = { ...cfg, at: now() }; save();
  const bad = await prepare(t);
  if (t.cancelling) return finish(t, 0, '');
  if (bad) { t.state = 'failed'; t.reason = bad === 'nogit' ? 'nogit' : 'worktree'; log(t, { kind: 'error', text: bad }); return done(t); }
  const sys = [t.role && ROLES[t.role], t.lean && LEAN].filter(Boolean).join('\n');
  const prompt = t.compactOnly ? '/compact' : t.next || t.desc; t.next = '';
  const opt = options(t.agent);
  t.live = { model: t.agent === 'codex' ? t.model || opt.def : t.model, usd: 0, unknown: false, msgs: new Set(), seen: new Map(), byModel: new Map(), committed: false };
  log(t, { kind: 'start', model: t.model || opt.def, effort: t.effort, attempt: t.attempts, resume: !!t.sessionId });
  if (t.agent === 'codex') return runCodex(t, prompt, sys);
  const a = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--permission-prompt-tool', 'stdio', '--permission-mode', t.perm, ...(t.model ? ['--model', t.model] : []), '--effort', t.effort,
    ...(sys ? ['--append-system-prompt', sys] : []), ...(t.allowed.length ? ['--allowedTools', t.allowed.join(',')] : []), ...(t.sessionId ? ['--resume', t.sessionId] : [])];
  let c; try { c = child(t, 'claude', a, { cwd: t.cwd, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { return finish(t, 1, 'spawn failed: ' + e.message); }
  // Claude takes the request on stdin and asks the office before a tool it may not use (answered by op 'permit')
  c.stdin.on('error', () => {}); c.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: prompt } }) + '\n');
  let buf = '', err = '';
  c.on('error', e => { err += 'spawn failed: ' + e.message; });
  c.stderr.on('data', d => { err = (err + d).slice(-2000); });
  c.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      let j; try { j = JSON.parse(line); } catch { continue; }
      if (j.type === 'control_request') { control(t, c, j); continue; }
      if (j.type === 'result') c.stdin.end();
      absorb(t, j); budget(t, c);
    }
  });
  c.on('close', code => { procs.delete(t.id); askers.delete(t.id); t.ask = null; t.pid = 0; if (t.live && !t.live.committed) commitLive(t); finish(t, code, err); });
}
// a tool the agent may not use waits here until the office answers (op 'permit'); "always" is remembered for the task
const askers = new Map();
function ask(t, tool, what, answer) {
  if (t.allowed.includes(tool)) return answer(true, false);
  t.ask = { tool, what: s(what, 300), at: now() };
  askers.set(t.id, (allow, always) => {
    if (allow && always && !t.allowed.includes(tool)) t.allowed.push(tool);
    answer(!!allow, !!always); log(t, { kind: 'permit', tool, allow: !!allow, always: !!always }); t.ask = null; askers.delete(t.id); save();
  });
  log(t, { kind: 'ask', tool, text: t.ask.what }); save();
}
function control(t, c, j) {
  const r = j.request || {}, send = response => { try { c.stdin.write(JSON.stringify({ type: 'control_response', response }) + '\n'); } catch {} };
  if (r.subtype !== 'can_use_tool') return send({ subtype: 'error', request_id: j.request_id, error: 'unsupported' });
  ask(t, s(r.tool_name, 60), r.description || toolWhat(r.input), allow => send({ subtype: 'success', request_id: j.request_id,
    response: allow ? { behavior: 'allow', updatedInput: r.input || {} } : { behavior: 'deny', message: 'The user denied this from the office.' } }));
}
// Codex runs as `codex app-server` (JSON-RPC on stdio): the only headless mode where it can ask before leaving its sandbox
function runCodex(t, prompt, sys) {
  let c; try { c = child(t, 'codex', ['app-server'], { cwd: t.cwd, stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { return finish(t, 1, 'spawn failed: ' + e.message); }
  const L = t.live; L.committed = true; // usage is committed per model call as it comes
  let buf = '', err = '', rid = 0, over = false;
  const write = m => { try { c.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n'); } catch {} };
  const call = (method, params) => { write({ id: ++rid, method, params }); return rid; };
  const end = () => { if (over) return; over = true; try { c.stdin.end(); } catch {} setTimeout(() => { if (procs.get(t.id) === c) c.kill('SIGTERM'); }, 3000).unref(); };
  const fail = msg => { t.failedTurn = true; log(t, { kind: 'error', text: s(msg, 400) }); end(); };
  const policy = { cwd: t.cwd, approvalPolicy: 'on-request', sandbox: 'workspace-write', ...(t.model ? { model: t.model } : {}), ...(sys ? { developerInstructions: sys } : {}) };
  const ids = { init: call('initialize', { clientInfo: { name: 'coworking-agents', version: require('../package.json').version } }) };
  const seen = new Set();
  c.stdin.on('error', () => {});
  c.on('error', e => { err += 'spawn failed: ' + e.message; });
  c.stderr.on('data', d => { err = (err + d).slice(-2000); });
  c.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      let j; try { j = JSON.parse(line); } catch { continue; }
      if (j.id !== undefined && j.method) { codexRequest(t, j, write); continue; }
      if (j.id !== undefined) {
        if (j.error) { fail(j.error.message || 'codex error'); continue; }
        if (j.id === ids.init) { write({ method: 'initialized' }); ids.thread = t.sessionId ? call('thread/resume', { threadId: t.sessionId, ...policy }) : call('thread/start', policy); }
        else if (j.id === ids.thread) {
          const r = j.result || {}; if (r.thread && r.thread.id) t.sessionId = r.thread.id; if (r.model) L.model = r.model; save();
          if (t.compactOnly) ids.turn = call('thread/compact/start', { threadId: t.sessionId });
          else ids.turn = call('turn/start', { threadId: t.sessionId, input: [{ type: 'text', text: prompt }], effort: t.effort, ...(t.model ? { model: t.model } : {}) });
        }
        continue;
      }
      const p = j.params || {}, it = p.item || {};
      if (j.method === 'item/started' && it.type && !['userMessage', 'agentMessage', 'reasoning'].includes(it.type) && !/compact/i.test(it.type)) { toolEvent(t, it.type, it.command || it.changes || it.query || ''); if (/agent/i.test(it.type)) t.subagents++; }
      if (j.method === 'thread/compacted' || (j.method === 'item/completed' && /compact/i.test(it.type || ''))) { if (!L.compacted) { L.compacted = true; log(t, { kind: 'compacted' }); } if (t.compactOnly) end(); }
      if (j.method === 'item/completed' && it.type === 'agentMessage' && it.text && !t.compactOnly) { t.result = s(it.text, 6000); log(t, { kind: 'text', text: s(it.text, 2000) }); }
      if (j.method === 'thread/tokenUsage/updated' && p.tokenUsage && p.tokenUsage.last) {
        const u = p.tokenUsage.last, k = p.turnId + ':' + (p.tokenUsage.total && p.tokenUsage.total.totalTokens);
        if (!seen.has(k)) { seen.add(k); addCost(t, L.model, { input: Math.max(0, (u.inputTokens || 0) - (u.cachedInputTokens || 0)), output: u.outputTokens || 0, cacheRead: u.cachedInputTokens || 0, cacheWrite: u.cacheWriteInputTokens || 0 }); save(); }
      }
      if (j.method === 'turn/completed') {
        const turn = p.turn || {}; t.turns++;
        if (turn.status === 'failed') fail((turn.error && turn.error.message) || 'turn failed'); else end();
      }
      if (j.method === 'error' && p.error && !p.willRetry) fail(p.error.message);
      budget(t, c);
    }
  });
  c.on('close', code => { procs.delete(t.id); askers.delete(t.id); t.ask = null; t.pid = 0; finish(t, over && !t.failedTurn ? 0 : code || (t.failedTurn ? 1 : 0), err); });
}
function codexRequest(t, j, write) {
  const p = j.params || {}, m = j.method, reply = result => write({ id: j.id, result });
  const v1 = m === 'execCommandApproval' || m === 'applyPatchApproval', decide = (allow, always) => reply({ decision: v1 ? (allow ? (always ? 'approved_for_session' : 'approved') : 'denied') : allow ? (always ? 'acceptForSession' : 'accept') : 'decline' });
  if (m === 'item/commandExecution/requestApproval' || m === 'execCommandApproval') return ask(t, 'command', [Array.isArray(p.command) ? p.command.join(' ') : p.command, p.reason].filter(Boolean).join(' — '), decide);
  if (m === 'item/fileChange/requestApproval' || m === 'applyPatchApproval') return ask(t, 'file_change', p.reason || p.grantRoot || 'file changes', decide);
  write({ id: j.id, error: { code: -32601, message: 'not supported by coworking-agents' } }); // anything else is refused, never approved silently
}
const toolWhat = i => { i = i || {}; return String(i.command || i.file_path || i.path || i.url || i.pattern || JSON.stringify(i)).slice(0, 300); };
// the live estimate (per assistant message, deduplicated by message id) is replaced by the CLI's own totals when they arrive
function commitLive(t) {
  const L = t.live; L.committed = true;
  for (const [model, u] of L.byModel) addCost(t, model, u);
}
function budget(t, c) {
  const L0 = t.live; if (L0 && !L0.highWarned) { const runUsd = L0.committed ? 0 : L0.usd, done0 = tasks.filter(x => x.state === 'done' && x.cost > 0).map(x => x.cost).sort((a, b) => a - b), med = done0.length >= 3 ? done0[done0.length >> 1] : 0; if (med && runUsd > 3 * med) { L0.highWarned = true; log(t, { kind: 'warn', why: 'high', usd: runUsd, median: med, rec: proposal(t, -1, 'high') }); } }
  if (!t.budget || t.cancelling) return;
  const L = t.live, spent = t.cost + (L.committed ? 0 : L.usd);
  if ((t.costUnknown || L.unknown) && !t.budgetWarned) { t.budgetWarned = true; log(t, { kind: 'warn', why: 'budgetUnknown' }); }
  if (spent > t.budget) { t.overBudget = true; t.cancelling = true; c.kill('SIGTERM'); log(t, { kind: 'warn', why: 'budget', usd: spent }); }
}
function absorb(t, j) {
  const L = t.live;
  { // Claude's stream-json; Codex goes through runCodex
    if (j.type === 'system' && j.subtype === 'init') { if (j.session_id) t.sessionId = j.session_id; if (j.model) L.model = j.model; save(); }
    if (j.type === 'system' && j.subtype === 'compact_boundary') { const c = j.compact_metadata || {}; log(t, { kind: 'compacted', pre: c.pre_tokens || 0, post: c.post_tokens || 0 }); }
    if (j.type === 'assistant' && j.message) {
      const msg = j.message;
      for (const c of msg.content || []) {
        if (c.type === 'text' && c.text) log(t, { kind: 'text', text: s(c.text, 2000) });
        if (c.type === 'tool_use') { toolEvent(t, c.name, c.input); if (c.name === 'Task' || c.name === 'Agent') t.subagents++; }
      }
      const id = msg.id || ('m' + L.msgs.size);
      if (msg.usage && !L.msgs.has(id)) { // one usage per message, even when it arrives in several events
        L.msgs.add(id); const model = msg.model || L.model, u = claudeUsage(msg.usage), c = costOf(model, u);
        const acc = L.byModel.get(model) || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        for (const k in acc) acc[k] += u[k]; L.byModel.set(model, acc);
        if (c == null) L.unknown = true; else L.usd += c;
      }
    }
    if (j.type === 'result') {
      L.committed = true; t.turns += j.num_turns || 0; if (!t.compactOnly) t.result = s(j.result, 6000);
      const mu = j.modelUsage && typeof j.modelUsage === 'object' ? Object.entries(j.modelUsage) : [];
      if (mu.length) for (const [model, u] of mu) addCost(t, model, claudeUsage(u), typeof u.costUSD === 'number' ? u.costUSD : undefined);
      else if (typeof j.total_cost_usd === 'number') addCost(t, L.model || t.model, claudeUsage(j.usage || {}), j.total_cost_usd);
      else commitLive(t);
      t.denials = (j.permission_denials || []).map(d => ({ tool: s(d.tool_name, 60), what: s(JSON.stringify(d.tool_input || {}), 200) })).slice(0, 10);
      t.failedTurn = !!j.is_error; log(t, { kind: 'result', text: t.result, usd: j.total_cost_usd, error: !!j.is_error });
    }
  }
}
// the same tool with the same input 3 times is a loop without progress: say so once, with the proposed fix
function toolEvent(t, name, input) {
  const what = s(typeof input === 'string' ? input : JSON.stringify(input), 160), key = name + what, seen = t.live.seen, n = (seen.get(key) || 0) + 1;
  seen.set(key, n); log(t, { kind: 'tool', name: s(name, 40), text: what });
  if (n === 3) log(t, { kind: 'warn', why: 'loop', name: s(name, 40), rec: proposal(t, 1, 'loop') });
}
// optional auto-apply: only up to the profile and the count per task the person allowed; always logged
function autoApply(t, rec) {
  const n = t.configLog.filter(c => String(c.why).startsWith('auto:')).length;
  if (!settings.autoApply || !rec || ORDER.indexOf(rec.profile) > ORDER.indexOf(settings.autoMax) || n >= settings.autoPerTask) return false;
  setConfig(t, { profile: rec.profile, why: 'auto:' + rec.why }); return true;
}
function proposal(t, step, why) { const i = Math.min(2, ORDER.indexOf(t.profile) + step), p = ORDER[i]; return i === ORDER.indexOf(t.profile) ? null : { profile: p, ...PROFILES[p][t.agent], why }; }

async function finish(t, code, err) {
  const compact = t.compactOnly; t.compactOnly = false;
  if (t.cancelling && !t.overBudget) { t.cancelling = false; t.state = 'cancelled'; t.reason = ''; log(t, { kind: 'cancelled' }); return done(t); }
  if (compact) { // a compaction ends where it started: waiting for the next request, with the same result
    t.state = code !== 0 || t.failedTurn ? 'failed' : 'blocked'; t.reason = t.state === 'failed' ? 'error' : 'compacted';
    if (t.state === 'failed') log(t, { kind: 'error', text: s(err, 600), code }); return done(t);
  }
  t.files = await changedFiles(t);
  if (t.overBudget) { t.overBudget = t.cancelling = false; t.state = 'blocked'; t.reason = 'budget'; return done(t); }
  if (code !== 0 || t.failedTurn) {
    t.state = 'failed'; t.reason = 'error'; log(t, { kind: 'error', text: s(err, 600), code });
    if (t.attempts >= 2) log(t, { kind: 'warn', why: 'retry', rec: proposal(t, 1, 'retry') });
    return done(t);
  }
  if (t.testCmd) {
    const r = await new Promise(res => { const c = child(t, '/bin/sh', ['-c', t.testCmd], { cwd: t.cwd }); let out = ''; const k = setTimeout(() => c.kill('SIGTERM'), 600000); c.stdout.on('data', d => { out = (out + d).slice(-20000); }); c.stderr.on('data', d => { out = (out + d).slice(-20000); }); c.on('error', () => res({ code: 127, out })); c.on('close', code2 => { clearTimeout(k); res({ code: code2 == null ? 1 : code2, out }); }); });
    procs.delete(t.id); t.pid = 0;
    if (t.cancelling) { t.cancelling = false; t.state = 'cancelled'; t.reason = ''; log(t, { kind: 'cancelled' }); return done(t); }
    // logs filtered before they reach the screen or a handoff: the lines that look like failures, then the tail
    const lines = r.out.trimEnd().split('\n'), hot = lines.filter(l => /fail|error|✗|assert|expected/i.test(l)).slice(-20);
    t.tests = { code: r.code, at: now() }; log(t, { kind: 'test', code: r.code, text: [...hot, ...(hot.length ? ['…'] : []), ...lines.slice(-30)].join('\n').slice(-4000) });
  }
  t.state = 'blocked'; t.reason = t.denials.length ? 'approval' : /\?\s*$/.test(t.result) ? 'question' : 'review';
  done(t);
}
function done(t) { log(t, { kind: 'state', state: t.state, reason: t.reason }); save(); tick(); }

async function changedFiles(t) {
  const set = new Set();
  if (t.baseCommit) for (const f of (await git(t.cwd, ['diff', '--name-only', t.baseCommit]) || '').split('\n')) if (f) set.add(f);
  for (const l of (await git(t.cwd, ['status', '--porcelain', '--untracked-files=all']) || '').split('\n')) if (l.trim()) set.add(l.slice(3));
  return [...set].slice(0, 200);
}
// everything since the task started: commits, staged, unstaged and new files
async function diff(id, { privacy = false } = {}) {
  load(); const t = tasks.find(x => x.id === id); if (!t) return { ok: false, reason: 'notask' };
  if (privacy) return { ok: false, reason: 'private' };
  if (demo) return { ok: true, stat: ' src/app.js | 4 ++--\n 1 file changed', diff: '-old line\n+new line', untracked: [] };
  const base = t.baseCommit ? [t.baseCommit] : [];
  const stat = await git(t.cwd, ['diff', '--stat', ...base]) || '', body = await git(t.cwd, ['diff', ...base]) || '';
  const untracked = (await git(t.cwd, ['ls-files', '--others', '--exclude-standard']) || '').split('\n').filter(Boolean).slice(0, 30);
  let extra = '';
  for (const f of untracked.slice(0, 15)) { const r = await run1('git', ['-C', t.cwd, 'diff', '--no-index', '--', '/dev/null', f]); extra += r.out.slice(0, 8000); }
  return { ok: true, base: t.baseCommit, stat, untracked, diff: (body + extra).slice(0, 120000) };
}

// ---- private mode: nothing that names a project leaves the server ----
function mask(t, i) {
  return { ...t, title: 'task ' + (i + 1), desc: '', dir: '', cwd: '', result: '', files: t.files.map(() => '•'), denials: t.denials.map(d => ({ tool: d.tool, what: '' })), testCmd: t.testCmd ? '•' : '', sessionId: '', baseCommit: '', ask: t.ask ? { ...t.ask, what: '' } : null };
}
function pub(t) { const { live, ...rest } = t; return rest; }
function list({ privacy = false } = {}) {
  load(); const opts = { claude: options('claude'), codex: options('codex') };
  return { tasks: tasks.map((t, i) => privacy ? mask(pub(t), i) : pub(t)), settings, profiles: PROFILES, options: opts, roles: Object.keys(ROLES), privacy };
}
function get(id, { privacy = false } = {}) {
  load(); const i = tasks.findIndex(x => x.id === id); if (i < 0) return null;
  const t = pub(tasks[i]), ev = eventsOf(id).slice(-300);
  return privacy ? { ...mask(t, i), events: ev.map(e => ({ at: e.at, kind: e.kind, state: e.state, reason: e.reason, why: e.why, code: e.code })) } : { ...t, events: ev };
}
// plain text search over tasks and their events (no index, no embeddings: fast enough at this size)
function search(q, { privacy = false } = {}) {
  load(); q = s(q, 100).toLowerCase().trim(); if (q.length < 2 || privacy) return [];
  const out = [];
  for (const t of tasks) {
    const hits = [t.title, t.desc, t.result].filter(x => x && x.toLowerCase().includes(q)).length + eventsOf(t.id).filter(e => e.text && String(e.text).toLowerCase().includes(q)).length;
    if (hits) out.push({ kind: 'task', id: t.id, title: t.title, state: t.state, agent: t.agent, updated: t.updated, hits });
  }
  return out.sort((a, b) => b.hits - a.hits || b.updated - a.updated).slice(0, 30);
}
function startQueue(opts) { load(opts); if (!timer && !demo) { timer = setInterval(() => { checkDetached().then(tick); }, 3000); timer.unref(); checkDetached().then(tick); } }
function onEvent(fn) { listeners.add(fn); }
function _reset(o = {}) { tasks = []; events.clear(); procs.clear(); loaded = false; settings = { maxParallel: 2, maxAttempts: 3, autoApply: false, autoMax: 'bal', autoPerTask: 1 }; load(o); }
async function _idle(ms = 30000) { const t0 = now(); while (now() - t0 < ms) { if (!tasks.some(t => ['pending', 'running'].includes(t.state))) return true; await new Promise(r => setTimeout(r, 50)); } return false; }

module.exports = { op, list, get, diff, search, recommend, options, startQueue, onEvent, load, tick, handoffText, STATES, PROFILES, ROLES, ALLOWED, _reset, _idle };
