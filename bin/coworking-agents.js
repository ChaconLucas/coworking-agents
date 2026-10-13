#!/usr/bin/env node
'use strict';
const { execFile } = require('child_process');
const { start } = require('../src/server');

const args = process.argv.slice(2);
// `--demo 40` = fake office with 40 agents
{ const i = args.indexOf('--demo'); if (i >= 0 && /^\d+$/.test(args[i + 1] || '')) process.env.COWORKING_DEMO_COUNT = args.splice(i + 1, 1)[0]; }
const flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

if (flag('-h') || flag('--help')) {
  console.log(`coworking-agents — a pixel office for your AI coding agents (Claude Code, Codex, …)

  npx coworking-agents [--port 4777] [--no-open] [--private] [--phone]

  --port      port to listen on (default 4777, falls back to a free one)
  --no-open   don't open the browser
  --private   hide session titles, paths and file names (screen sharing)
  --phone     also serve a small phone panel on your Wi-Fi (own token, QR code in the terminal; trusted networks only)
  --demo [N]  show a fake office with every state and N agents (default 10)
  --json      print one snapshot and exit
  mcp         run a read-only MCP server on stdio (claude mcp add coworking -- npx coworking-agents mcp)
  --no-update-check  don't ask npm whether a newer version is out`);
  process.exit(0);
}

if (args[0] === 'mcp') { require('../src/mcp').serve(); return; }

if (flag('--json')) {
  const { snapshot } = require('../src/collect');
  // write and let Node exit on its own: process.exit() cuts a big snapshot short when stdout is a pipe
  process.stdout.write(JSON.stringify(snapshot({ privacy: flag('--private') }), null, 2) + '\n');
  return;
}

function open(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const a = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  execFile(cmd, a, () => {});
}

// The token link lives in a file only you can read (0600): a second run reopens the same
// office, and a foreign program on port 4777 can't impersonate it (it doesn't have the token).
const os = require('os'), fs = require('fs'), path = require('path');
const STATE_DIR = path.join(os.homedir(), '.config', 'coworking-agents');
const STATE_FILE = path.join(STATE_DIR, 'session.json');

async function reuse() {
  let s;
  try { s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
  if (!s || !s.base || !s.token) return null;
  const ok = await fetch(s.base + '/api/ping', { headers: { Cookie: 'cw=' + s.token } }).then(r => r.ok).catch(() => false);
  return ok ? s : null;
}

(async () => {
  const port = Number(opt('--port', 4777));
  const privacy = flag('--private'), demo = flag('--demo');
  if (!demo && !privacy && !flag('--port')) {
    const s = await reuse();
    if (s && flag('--phone')) { console.log(`coworking-agents is already running without the phone panel (${s.base}). Close it (Ctrl+C in its terminal) and start again with --phone.`); return; }
    if (s) { console.log(`coworking-agents already running → ${s.base}/?t=${s.token}`); if (!flag('--no-open')) open(`${s.base}/?t=${s.token}`); return; }
  }
  // keep the same token across restarts so an open tab keeps working (file is 0600, only yours)
  let token;
  if (!demo && !privacy) { try { const prev = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); if (/^[0-9a-f]{48}$/.test(prev.token)) token = prev.token; } catch {} }
  let hq;
  const phone = flag('--phone');
  try { hq = await start({ port, privacy, demo, token, phone }); }
  catch (e) {
    if (e.code !== 'EADDRINUSE') throw e;
    hq = await start({ port: 0, privacy, demo, token, phone }); // port taken by something else: use a free one
  }
  if (!demo && !privacy) {
    try {
      fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
      fs.writeFileSync(STATE_FILE, JSON.stringify({ pid: process.pid, base: hq.base, token: hq.token }), { mode: 0o600 });
      // the file stays on exit: it keeps the token for the next run (reuse() pings before trusting it)
      const bye = () => process.exit(0);
      process.on('SIGINT', bye); process.on('SIGTERM', bye);
    } catch {}
  }
  console.log(`coworking-agents → ${hq.url}${privacy ? '  (private mode)' : ''}\nCtrl+C to close.`);
  if (phone) {
    if (hq.phone) console.log(`\nPhone (same Wi-Fi, trusted networks only — the LAN link is not encrypted) → ${hq.phone.url}\n${require('../src/qr').toTerminal(require('../src/qr').encode(hq.phone.url))}\n`);
    else console.log(`\nPhone panel not started: ${hq.phoneReason === 'nolan' ? 'no local network address found' : hq.phoneReason}`);
  }
  if (!flag('--no-open')) open(hq.url);
  if (!demo && !flag('--no-update-check')) {
    const up = await require('../src/update').startChecks();
    if (up) console.log(`New version ${up.latest} (you have ${up.current}): npx coworking-agents@latest`);
  }
})();
