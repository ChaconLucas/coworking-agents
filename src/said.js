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

module.exports = { search, said };
