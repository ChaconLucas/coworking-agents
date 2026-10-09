'use strict';
// Junta as fontes (uma por IA) e monta o estado do escritório.
// Só leitura: nada aqui escreve nos diretórios das IAs nem fala com a rede.

const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { resolveRepo, newest, dayKey } = require('./util');

const SOURCES = [require('./sources/claude'), require('./sources/codex')];

const PENDING_STALE_MS = 6000;           // ferramenta parada há isto = rodando ou esperando permissão
const ASLEEP_MS = 20 * 60 * 1000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;   // janela para "duas sessões editando o mesmo clone"

// Tabela de processos (uma chamada por retrato): quem é filho de quem e há quanto tempo começou.
let procCache = { at: 0, kids: new Map() };
function processTable(now) {
  if (now - procCache.at < 900) return procCache.kids;
  const kids = new Map();
  try {
    const out = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,etime=,command='], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 8 * 1024 * 1024 });
    for (const line of out.split('\n')) {
      const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
      if (!m) continue;
      const [, pid, ppid, et, cmd] = m;
      const t = et.split(/[-:]/).map(Number); // [[dd-]hh:]mm:ss
      const secs = t.length === 4 ? ((t[0] * 24 + t[1]) * 60 + t[2]) * 60 + t[3] : t.length === 3 ? (t[0] * 60 + t[1]) * 60 + t[2] : t[0] * 60 + t[1];
      if (!kids.has(+ppid)) kids.set(+ppid, []);
      kids.get(+ppid).push({ pid: +pid, start: now - secs * 1000, cmd });
    }
  } catch {}
  procCache = { at: now, kids };
  return kids;
}

// Um Bash do Claude Code corre num shell filho ("zsh -c source …/shell-snapshots/…").
// Shell aberto depois do pedido = o comando está a correr; nenhum = ainda à espera de aprovação.
function shellRunning(pid, since, now) {
  const kids = processTable(now).get(pid) || [];
  return kids.some(k => k.start >= since - 2000 && /shell-snapshots|^\/bin\/(ba|z)?sh -c|^(ba|z)?sh -c/.test(k.cmd));
}

// Ferramenta parada: instantâneas (editar, ler) só param se esperam aprovação; Bash mede-se pelo processo;
// as lentas por natureza (web, MCP, subagentes) contam como trabalho, salvo modo que pergunta sempre.
const INSTANT = new Set(['edit', 'read']);
function stalledState(st, pend, pid, now) {
  if (st.explicitApprovals) return pend.kind;
  if (pend.kind === 'terminal' && pid) return shellRunning(pid, pend.ts, now) ? 'terminal' : 'waiting';
  if (INSTANT.has(pend.kind)) return st.permissionMode === 'bypassPermissions' ? pend.kind : 'waiting';
  const mode = st.permissionMode || 'default';
  return mode === 'default' && now - pend.ts > 30000 ? 'waiting' : pend.kind;
}

function stateOf(status, st, now, pid) {
  if (!st) return status === 'busy' ? 'thinking' : 'idle';
  if (status !== 'busy') return now - Math.max(st.lastTs, st.mtime) > ASLEEP_MS ? 'asleep' : 'idle';
  const pend = newest(st.pending);
  if (!pend) return 'thinking';
  if (pend.kind === 'ask') return 'needs_you';
  const stale = !['delegate', 'thinking'].includes(pend.kind) && now - pend.ts > PENDING_STALE_MS && now - st.mtime > PENDING_STALE_MS;
  return stale ? stalledState(st, pend, pid, now) : pend.kind;
}

// Junta os marcos em faixas contínuas [de, até, tipo] dentro da janela pedida.
function segments(events, from, to, open) {
  const out = [];
  const ev = events.filter(e => e.ts >= from - 6 * 3600 * 1000 && e.ts <= to);
  for (let i = 0; i < ev.length; i++) {
    const a = Math.max(ev[i].ts, from), b = Math.min(i + 1 < ev.length ? ev[i + 1].ts : (open ? to : ev[i].ts + 5000), to);
    if (b <= a) continue;
    const last = out[out.length - 1];
    if (last && last.kind === ev[i].kind && last.to >= a - 1000) last.to = b;
    else out.push({ from: a, to: b, kind: ev[i].kind });
  }
  return out;
}

function relFile(f) {
  const r = resolveRepo(path.dirname(f));
  return r ? { repo: r.name, rel: path.relative(r.worktree, f), abs: f } : { repo: '', rel: path.basename(f), abs: f };
}

function person(s, now) {
  const st = s.st;
  const cwd = (st && st.cwd) || s.cwd;
  const repo = resolveRepo(cwd);
  const pend = st ? newest(st.pending) : null;
  const edits = st ? [...st.edits.values()].filter(e => now - e.at < EDIT_WINDOW_MS) : [];
  return {
    agent: s.agent, id: s.id, name: s.name, pid: s.pid, kind: s.kind, version: s.version,
    status: s.status, state: stateOf(s.status, st, now, s.pid), since: s.since, startedAt: s.startedAt,
    title: st ? st.title : '', cwd, branch: st ? st.branch : '',
    repo: repo ? { name: repo.name, path: repo.repo, worktree: repo.worktree, isWorktree: repo.isWorktree } : null,
    model: st ? st.model : '', ctx: st ? st.ctx : 0, ctxMax: st ? st.ctxMax : 0, turns: st ? st.turns : 0,
    doing: pend ? { tool: pend.name, what: pend.what, kind: pend.kind, for: now - pend.ts, ask: pend.ask || '' } : null,
    timeline: st ? segments(st.events, now - 3600 * 1000, now, true) : [],
    files: st ? [...st.files.entries()].filter(([, at]) => now - at < EDIT_WINDOW_MS).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([f, at]) => ({ ...relFile(f), at })) : [],
    permissionMode: st ? st.permissionMode || '' : '',
    recent: st ? st.recent.slice(-8).reverse().map(r => ({ tool: r.name, what: r.what, kind: r.kind, ts: r.ts })) : [],
    skills: st ? st.skills : {}, mcps: st ? st.mcps : {}, tools: st ? st.tools : {},
    editing: edits.map(e => ({ worktree: e.repo.worktree, repo: e.repo.name, at: e.at })),
    subagents: s.subagents || [],
    lastActivity: st ? Math.max(st.lastTs, st.mtime) : 0,
  };
}

function snapshot({ privacy = false } = {}) {
  const now = Date.now();
  const people = [], credentials = {}, agents = [];
  for (const src of SOURCES) {
    let list = [];
    try { list = src.sessions(now); } catch {}
    for (const s of list) { try { people.push(person(s, now)); } catch {} }
    try { credentials[src.id] = src.credentials(); } catch {}
    agents.push({ id: src.id, label: src.label, sessions: list.length });
  }
  people.sort((a, b) => a.startedAt - b.startedAt);

  // duas ou mais sessões (de qualquer IA) editando o mesmo checkout nos últimos minutos
  const byTree = new Map();
  for (const p of people) for (const e of p.editing) {
    if (!byTree.has(e.worktree)) byTree.set(e.worktree, { worktree: e.worktree, repo: e.repo, who: new Set() });
    byTree.get(e.worktree).who.add(p.id);
  }
  const clashes = [...byTree.values()].filter(c => c.who.size > 1)
    .map(c => ({ worktree: privacy ? '' : c.worktree, repo: c.repo, who: [...c.who] }));

  // o mesmo arquivo nas mãos de duas sessões é pior que o mesmo repo
  const byFile = new Map();
  for (const p of people) for (const f of p.files) {
    if (!byFile.has(f.abs)) byFile.set(f.abs, { file: f.rel, repo: f.repo, who: new Set() });
    byFile.get(f.abs).who.add(p.id);
  }
  const fileClashes = [...byFile.values()].filter(c => c.who.size > 1).map(c => ({ file: privacy ? '' : c.file, repo: c.repo, who: [...c.who] }));
  for (const p of people) p.files = p.files.map(({ abs, ...f }) => f);

  // modo privado (compartilhar a tela): nada que identifique projeto, pessoa ou máquina
  const alias = new Map();
  const aliasOf = name => { if (!name) return name; if (!alias.has(name)) alias.set(name, 'repo ' + String.fromCharCode(65 + (alias.size % 26)) + (alias.size >= 26 ? alias.size : '')); return alias.get(name); };
  if (privacy) for (const c of clashes) c.repo = aliasOf(c.repo);
  if (privacy) for (const c of fileClashes) c.repo = aliasOf(c.repo);
  if (privacy) people.forEach((p, i) => {
    p.name = p.agent + '-' + (i + 1); p.branch = '';
    if (p.doing && p.doing.tool.startsWith('mcp__')) p.doing.tool = 'MCP';
    p.recent = p.recent.map(r => ({ ...r, tool: r.tool.startsWith('mcp__') ? 'MCP' : r.tool }));
    p.files = p.files.map(f => ({ ...f, repo: aliasOf(f.repo) }));
    p.editing = p.editing.map(e => ({ ...e, repo: aliasOf(e.repo) }));
    if (p.repo) p.repo = { ...p.repo, name: aliasOf(p.repo.name) };
    p.mcps = {}; p.skills = {};
  });
  if (privacy) for (const p of people) {
    p.title = ''; p.cwd = ''; p.doing = p.doing && { ...p.doing, what: '' };
    if (p.repo) p.repo = { name: p.repo.name, path: '', worktree: '', isWorktree: p.repo.isWorktree };
    p.editing = p.editing.map(e => ({ ...e, worktree: '' }));
    p.recent = p.recent.map(r => ({ ...r, what: '' }));
    p.subagents = p.subagents.map(a => ({ ...a, description: '', doing: '' }));
    p.files = p.files.map(f => ({ ...f, rel: '' }));
    if (p.doing) p.doing.ask = '';
  }
  const hn = os.hostname().replace(/\.local$/, '');
  return { now, host: privacy || /^[\d.:]+$/.test(hn) ? '' : hn, agents, people, clashes, fileClashes, credentials: privacy ? {} : credentials };
}

// Relatório do dia: todas as conversas mexidas desde a meia-noite, abertas ou já fechadas.
function report({ privacy = false } = {}) {
  const now = Date.now(), d = new Date(now);
  const since = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), key = dayKey(now);
  const live = new Map(snapshot({ privacy }).people.map(p => [p.id, p]));
  const rows = [], fileCount = new Map();
  for (const src of SOURCES) {
    let list = [];
    try { list = src.today ? src.today(since) : []; } catch {}
    for (const { agent, id, st, title } of list) {
      const segs = segments(st.events, since, now, live.has(id));
      const activeMs = segs.filter(x => x.kind !== 'idle').reduce((a, x) => a + (x.to - x.from), 0);
      const evToday = st.events.filter(e => e.ts >= since);
      const tools = evToday.filter(e => !['idle', 'thinking'].includes(e.kind)).length;
      const files = [...st.files.entries()].filter(([, at]) => at >= since).map(([f]) => f);
      for (const f of files) fileCount.set(f, (fileCount.get(f) || 0) + 1);
      if (!tools && !activeMs) continue;
      const repo = resolveRepo(st.cwd);
      const p = live.get(id);
      rows.push({
        agent, id, name: p ? p.name : '', live: !!p, title: privacy ? '' : (st.title || title || ''),
        repo: repo ? repo.name : '', activeMs, tools, turns: evToday.filter(e => e.kind === 'idle').length,
        files: files.length, outTokens: st.outByDay[key] || 0,
      });
    }
  }
  rows.sort((a, b) => b.activeMs - a.activeMs);
  const topFiles = [...fileCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([f, n]) => ({ ...relFile(f), n })).map(({ abs, ...f }) => privacy ? { ...f, rel: '' } : f);
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  return { since, now, rows, topFiles, totals: { sessions: rows.length, activeMs: sum('activeMs'), tools: sum('tools'), files: fileCount.size, outTokens: sum('outTokens'), turns: sum('turns') } };
}

module.exports = { snapshot, report };
