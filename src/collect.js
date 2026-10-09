'use strict';
// Junta as fontes (uma por IA) e monta o estado do escritório.
// Só leitura: nada aqui escreve nos diretórios das IAs nem fala com a rede.

const os = require('os');
const { resolveRepo, newest } = require('./util');

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
    doing: pend ? { tool: pend.name, what: pend.what, kind: pend.kind, for: now - pend.ts } : null,
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

  if (privacy) for (const p of people) {
    p.title = ''; p.cwd = ''; p.doing = p.doing && { ...p.doing, what: '' };
    if (p.repo) p.repo = { name: p.repo.name, path: '', worktree: '', isWorktree: p.repo.isWorktree };
    p.editing = p.editing.map(e => ({ ...e, worktree: '' }));
    p.recent = p.recent.map(r => ({ ...r, what: '' }));
    p.subagents = p.subagents.map(a => ({ ...a, description: '', doing: '' }));
  }
  const hn = os.hostname().replace(/\.local$/, '');
  return { now, host: /^[\d.:]+$/.test(hn) ? '' : hn, agents, people, clashes, credentials };
}

module.exports = { snapshot };
