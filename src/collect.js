'use strict';
// Junta as fontes (uma por IA) e monta o estado do escritório.
// Só leitura: nada aqui escreve nos diretórios das IAs nem fala com a rede.

const os = require('os');
const path = require('path');
const { resolveRepo, newest, dayKey } = require('./util');

const SOURCES = [require('./sources/claude'), require('./sources/codex')];

const PENDING_STALE_MS = 6000;           // ferramenta parada há isto = rodando ou esperando permissão
const ASLEEP_MS = 20 * 60 * 1000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;   // janela para "duas sessões editando o mesmo clone"

// Ferramenta parada há mais de uns segundos pode ser só demorada ou um pedido de permissão.
// Só vira "waiting" quando o modo de permissão pergunta mesmo por aquela ferramenta.
function mayAskPermission(st, kind) {
  if (st.explicitApprovals) return false;
  const mode = st.permissionMode || 'default';
  if (mode === 'auto' || mode === 'bypassPermissions' || mode === 'plan') return false;
  if (mode === 'acceptEdits' && kind === 'edit') return false;
  return true;
}

function stateOf(status, st, now) {
  if (!st) return status === 'busy' ? 'thinking' : 'idle';
  if (status !== 'busy') return now - Math.max(st.lastTs, st.mtime) > ASLEEP_MS ? 'asleep' : 'idle';
  const pend = newest(st.pending);
  if (!pend) return 'thinking';
  if (pend.kind === 'ask') return 'needs_you';
  const stale = !['delegate', 'thinking'].includes(pend.kind) && now - pend.ts > PENDING_STALE_MS && now - st.mtime > PENDING_STALE_MS;
  if (stale && mayAskPermission(st, pend.kind)) return 'waiting';
  return pend.kind;
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
    status: s.status, state: stateOf(s.status, st, now), since: s.since, startedAt: s.startedAt,
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
    for (const s of list) people.push(person(s, now));
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
  return { now, host: /^[\d.:]+$/.test(hn) ? '' : hn, agents, people, clashes, fileClashes, credentials };
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
