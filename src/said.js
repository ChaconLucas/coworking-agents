'use strict';
// Search in what you asked and what the agents answered, over the last days of conversation logs.
// Only the conversation logs are read (~/.claude/projects/**.jsonl and ~/.codex/sessions/**.jsonl), never other files;
// tool output is skipped. Bounded in files, bytes and time so the office never stalls on a big history.
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const CLAUDE = () => path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
const CODEX = () => path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions');
const MAX_FILES = 400, MAX_BYTES = 60 * 1024 * 1024, BUDGET_MS = 4000; // a huge log is read from its last MAX_BYTES (the recent part)

function files(days) {
  const since = Date.now() - days * 864e5, out = [];
  const walk = (dir, agent, depth) => {
    let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && depth < 4) walk(full, agent, depth + 1);
      else if (e.isFile() && e.name.endsWith('.jsonl')) { try { const st = fs.statSync(full); if (st.mtimeMs >= since) out.push({ file: full, agent, mtime: st.mtimeMs, size: st.size }); } catch {} }
    }
  };
  walk(CLAUDE(), 'claude', 0); walk(CODEX(), 'codex', 0);
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, MAX_FILES);
}
const textOf = c => typeof c === 'string' ? c : Array.isArray(c) ? c.filter(x => x && (x.type === 'text' || x.type === 'input_text' || x.type === 'output_text') && typeof x.text === 'string').map(x => x.text).join('\n') : '';
// one line of a log → { role, text } when it is something you wrote or the agent said
function said(agent, j) {
  if (agent === 'claude') {
    if ((j.type === 'user' || j.type === 'assistant') && j.message && !j.isMeta) { const t = textOf(j.message.content); return t ? { role: j.type, text: t, at: Date.parse(j.timestamp) || 0, id: j.sessionId } : null; }
    return null;
  }
  const p = j.payload || {};
  if (j.type === 'event_msg' && (p.type === 'user_message' || p.type === 'agent_message') && typeof p.message === 'string') return { role: p.type === 'user_message' ? 'user' : 'assistant', text: p.message, at: Date.parse(j.timestamp) || 0 };
  return null;
}
async function search(q, { days = 7, limit = 40 } = {}) {
  q = String(q || '').toLowerCase().trim().slice(0, 100);
  if (q.length < 3) return [];
  const t0 = Date.now(), out = [];
  for (const f of files(days)) {
    if (out.length >= limit || Date.now() - t0 > BUDGET_MS) break;
    const id = path.basename(f.file, '.jsonl').replace(/^rollout-[\d-T]+-/, '');
    const rl = readline.createInterface({ input: fs.createReadStream(f.file, { encoding: 'utf8', start: Math.max(0, f.size - MAX_BYTES) }), crlfDelay: Infinity });
    for await (const line of rl) {
      if (out.length >= limit || Date.now() - t0 > BUDGET_MS) { rl.close(); break; }
      if (!line.toLowerCase().includes(q)) continue; // cheap filter before parsing
      let j; try { j = JSON.parse(line); } catch { continue; }
      const s = said(f.agent, j); if (!s) continue;
      const low = s.text.toLowerCase(), i = low.indexOf(q); if (i < 0) continue;
      const a = Math.max(0, i - 80), snippet = (a ? '…' : '') + s.text.slice(a, i + q.length + 120).replace(/\s+/g, ' ') + (i + q.length + 120 < s.text.length ? '…' : '');
      out.push({ agent: f.agent, id: s.id || id, role: s.role, at: s.at, snippet });
    }
  }
  return out.sort((a, b) => b.at - a.at);
}

// ---- one conversation in full (the phone's chat view) ----
// the log of one live session, found by its id only (never a path from outside); read from where it was left off
const CHAT_BYTES = 30 * 1024 * 1024, CHAT_KEEP = 1500, chats = new Map();
function locate(agent, id) {
  if (!/^[0-9A-Za-z-]{8,80}$/.test(String(id || ''))) return null;
  if (agent === 'claude') { let dirs = []; try { dirs = fs.readdirSync(CLAUDE()); } catch {} for (const d of dirs) { const f = path.join(CLAUDE(), d, id + '.jsonl'); if (fs.existsSync(f)) return f; } return null; }
  if (agent !== 'codex') return null;
  let hit = null;
  const walk = (dir, depth) => { if (hit) return; let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; } list.sort((a, b) => (a.name < b.name ? 1 : -1)); for (const e of list) { if (hit) return; const full = path.join(dir, e.name); if (e.isDirectory() && depth < 4) walk(full, depth + 1); else if (e.isFile() && e.name.endsWith('-' + id + '.jsonl')) hit = full; } };
  walk(CODEX(), 0); return hit;
}
// what a person reads: no system reminders, no command echoes or task notices
function readable(t) {
  t = String(t || '').replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  return !t || /^<(command-|local-command|bash-|task-notification|user-prompt-submit-hook)/.test(t) ? '' : t;
}
async function conversation(agent, id, { q = '', limit = 200 } = {}) {
  const file = locate(agent, id); if (!file) return { ok: false, reason: 'nofile' };
  let size = 0; try { size = fs.statSync(file).size; } catch { return { ok: false, reason: 'nofile' }; }
  let c = chats.get(file);
  if (!c || size < c.offset) c = { offset: Math.max(0, size - CHAT_BYTES), items: [], cut: size > CHAT_BYTES };
  if (size > c.offset) { // only what was added since the last look, up to the last complete line
    const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(size - c.offset); fs.readSync(fd, buf, 0, buf.length, c.offset); fs.closeSync(fd);
    const end = buf.lastIndexOf(10); if (end >= 0) {
      for (const line of buf.subarray(0, end).toString('utf8').split('\n')) { let j; try { j = JSON.parse(line); } catch { continue; } const s = said(agent, j); const text = s && readable(s.text); if (text) c.items.push({ role: s.role, text: text.slice(0, 6000), at: s.at }); }
      c.offset += end + 1; if (c.items.length > CHAT_KEEP) { c.items = c.items.slice(-CHAT_KEEP); c.cut = true; }
    }
    chats.set(file, c); if (chats.size > 20) chats.delete(chats.keys().next().value);
  }
  q = String(q || '').toLowerCase().trim().slice(0, 100);
  const list = q ? c.items.filter(x => x.text.toLowerCase().includes(q)) : c.items;
  return { ok: true, items: list.slice(-limit), total: c.items.length, found: list.length, cut: c.cut };
}

module.exports = { search, said, conversation, readable };
