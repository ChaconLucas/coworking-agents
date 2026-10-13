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
  --app       open in an app window (Chrome, Edge, Brave or Chromium) instead of a browser tab
  install-app       create the Coworking Agents app on this computer (uninstall-app removes it)
  autostart on|off  start hidden with the computer, with the tray icon
  --menubar   show a menu bar icon with who needs you (macOS; also a switch in Personalise)
  --phone     also serve a small phone panel on your Wi-Fi (own token, QR code in the terminal; trusted networks only)
  --demo [N]  show a fake office with every state and N agents (default 10)
  --json      print one snapshot and exit
  mcp         run a read-only MCP server on stdio (claude mcp add coworking -- npx coworking-agents mcp)
  --no-update-check  don't ask npm whether a newer version is out`);
  process.exit(0);
}

if (args[0] === 'mcp') { require('../src/mcp').serve(); return; }
// the app: `coworking-agents install-app` / `uninstall-app` (made on this computer, free, no store)
if (args[0] === 'install-app') { const r = require('../src/appinstall').install(require('../src/update').installMode()); console.log(`Created: ${r.where}\nOpen "Coworking Agents" like any app. Remove it with: coworking-agents uninstall-app`); return; }
if (args[0] === 'uninstall-app') { require('../src/appinstall').uninstall(); console.log('Removed the Coworking Agents app.'); return; }
// start with the computer: `coworking-agents autostart on | off | status`
if (args[0] === 'autostart') {
  const a = require('../src/autostart');
  if (args[1] === 'on') { const r = a.enable(require('../src/update').installMode()); console.log(`On: the office starts hidden at login, with its tray icon.\n${r.file}\nUndo with: coworking-agents autostart off`); }
  else if (args[1] === 'off') { a.disable(); console.log('Off: the office no longer starts with the computer.'); }
  else console.log(a.enabled() ? 'Autostart is on.' : 'Autostart is off. Turn it on with: coworking-agents autostart on');
  return;
}

if (flag('--json')) {
  const { snapshot } = require('../src/collect');
  // write and let Node exit on its own: process.exit() cuts a big snapshot short when stdout is a pipe
  process.stdout.write(JSON.stringify(snapshot({ privacy: flag('--private') }), null, 2) + '\n');
  return;
}

// the choice made in the office the first time ("use as an app" or "keep the browser") decides how it opens next time
function wantsApp() {
  if (flag('--app')) return true;
  try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'coworking-agents', 'tasks', 'tasks.json'), 'utf8')).settings.appChoice === 'app'; } catch { return false; }
}
function open(url) {
  if (wantsApp() && openApp(url)) return;
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const a = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  execFile(cmd, a, () => {});
}
// --app: an app window of Chrome, Edge, Brave or Chromium (no tabs, no address bar); the default browser otherwise
function openApp(url) {
  const fs = require('fs'), path = require('path'), { spawnSync, spawn } = require('child_process');
  const pf = process.env.ProgramFiles || 'C:\\Program Files', pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', local = process.env.LOCALAPPDATA || '';
  const candidates = process.platform === 'darwin' ? ['Google Chrome', 'Microsoft Edge', 'Brave Browser', 'Chromium'].map(n => `/Applications/${n}.app/Contents/MacOS/${n}`)
    : process.platform === 'win32' ? [path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe')]
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser'].map(n => { try { const r = spawnSync('which', [n], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : ''; } catch { return ''; } });
  const exe = candidates.find(c => c && fs.existsSync(c)); if (!exe) return false;
  spawn(exe, ['--app=' + url], { detached: true, stdio: 'ignore' }).unref();
  return true;
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
  let token, phoneToken;
  if (!demo && !privacy) { try { const prev = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); if (/^[0-9a-f]{48}$/.test(prev.token)) token = prev.token; if (/^[0-9a-f]{32}$/.test(prev.phoneToken || '')) phoneToken = prev.phoneToken; } catch {} }
  // the phone code is kept with the office token (0600 file) so a home-screen icon keeps working; "new code" replaces it
  const onPhoneToken = t => { phoneToken = t; try { const cur = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); fs.writeFileSync(STATE_FILE, JSON.stringify({ ...cur, phoneToken: t }), { mode: 0o600 }); } catch {} };
  let hq;
  const phone = flag('--phone');
  const menubar = flag('--menubar');
  try { hq = await start({ port, privacy, demo, token, phone, menubar, phoneToken, onPhoneToken }); }
  catch (e) {
    if (e.code !== 'EADDRINUSE') throw e;
    hq = await start({ port: 0, privacy, demo, token, phone, menubar, phoneToken, onPhoneToken }); // port taken by something else: use a free one
  }
  if (!demo && !privacy) {
    try {
      fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
      fs.writeFileSync(STATE_FILE, JSON.stringify({ pid: process.pid, base: hq.base, token: hq.token, phoneToken: hq.phone ? hq.phone.url.split('t=')[1] : phoneToken }), { mode: 0o600 });
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
