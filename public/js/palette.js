'use strict';
// ---------------- state colors and certificates ----------------
const { PAL, hash, shade, look, r } = Art;
const KIND_COLOR = {
  edit: '#7aa2f7', read: '#d9cdb0', terminal: '#63c74d', web: '#2ce8f5', delegate: '#feae34', skill: '#b55088',
  mcp: '#2ce8f5', other: '#8b9bb4', thinking: '#b4a0f0', needs_you: '#e43b44', waiting: '#feae34', ask: '#e43b44',
  idle: '#3b5dc9', asleep: '#5a6988',
};
const AGENT = { claude: { label: 'Claude Code', color: '#d97757' }, codex: { label: 'Codex', color: '#10a37f' } };
const agentOf = p => AGENT[p.agent] || { label: p.agent || '?', color: '#8a8f98' };
const CERT = { skill: '#e8b04b', mcp: '#2c9a8f', badge: '#e43b44' };
const BADGE_COLOR = { tools100: '#e43b44', tools1000: '#b55088', marathon: '#f77622', immortal: '#68386c', boss: '#3b5dc9', elephant: '#8b9bb4', chat: '#3e8948', terminal: '#265c42', writer: '#b86f50', research: '#0099db' };

// ---------------- certificates ----------------
function certsOf(p) {
  const out = [];
  for (const [k, n] of Object.entries(p.skills || {}).sort((a, b) => b[1] - a[1])) out.push({ kind: 'skill', name: k, n });
  for (const [k, n] of Object.entries(p.mcps || {}).sort((a, b) => b[1] - a[1])) out.push({ kind: 'mcp', name: k, n });
  const tools = p.tools || {}, total = Object.values(tools).reduce((s, v) => s + v, 0);
  const age = data ? data.now - p.startedAt : 0;
  const B = T.badges, add = (key) => out.push({ kind: 'badge', key, name: B[key][0], desc: B[key][1] });
  if (total >= 1000) add('tools1000'); else if (total >= 100) add('tools100');
  if (age > 864e5) add('immortal'); else if (age > 4 * 36e5) add('marathon');
  if ((tools.Agent || 0) + (tools.Task || 0) + (tools.Workflow || 0) + (tools.spawn_agent || 0) > 0) add('boss');
  if (p.ctx >= 5e5) add('elephant');
  if (p.turns >= 50) add('chat');
  if ((tools.Bash || 0) + (tools.exec_command || 0) + (tools.exec || 0) >= 50) add('terminal');
  if ((tools.Edit || 0) + (tools.Write || 0) + (tools.apply_patch || 0) >= 50) add('writer');
  if ((tools.WebSearch || 0) + (tools.WebFetch || 0) + (tools.web_search || 0) > 0) add('research');
  return out;
}
function certColor(c) { return c.kind === 'badge' ? BADGE_COLOR[c.key] || CERT.badge : CERT[c.kind]; }

function clashSet() {
  const s = new Set();
  for (const c of (data && data.clashes) || []) for (const id of c.who) s.add(id);
  return s;
}

function counts() {
  const c = { work: 0, need: 0, turn: 0, sleep: 0 };
  for (const p of data.people) {
    if (p.state === 'needs_you' || p.state === 'waiting') c.need++;
    else if (p.state === 'idle') c.turn++;
    else if (p.state === 'asleep') c.sleep++;
    else c.work++;
  }
  return c;
}
