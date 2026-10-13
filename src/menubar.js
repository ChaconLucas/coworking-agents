'use strict';
// The tray / menu bar icon. The office writes a small private status file and a helper that ships with the system shows it:
//   macOS   — JavaScript for Automation (osascript): icon, menu, red count; notifications through osascript
//   Windows — PowerShell + Windows Forms: tray icon with a red dot, menu and balloons
//   Linux   — zenity --notification --listen when installed (icon + tooltip + messages), else notify-send for messages only
// Opt-in (Personalise or --menubar). Notifications go out only when no office page is open, and never in quiet hours.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const DIR = () => path.join(os.homedir(), '.config', 'coworking-agents');
const FILE = () => path.join(DIR(), 'menubar.json');
const ICON = path.join(__dirname, '..', 'public', 'favicon.png');
let child = null, kind = null, base = '', token = '', lastBody = '', lastTip = '', seen = null;

const has = cmd => { try { return spawnSync('which', [cmd], { stdio: 'ignore' }).status === 0; } catch { return false; } };
// which way this system can show it: 'mac', 'win', 'zenity', 'notify' or null
function detect() {
  if (process.platform === 'darwin') return 'mac';
  if (process.platform === 'win32') return 'win';
  if (process.platform === 'linux') return has('zenity') ? 'zenity' : has('notify-send') ? 'notify' : null;
  return null;
}
let detected;
function how() { if (detected === undefined) detected = detect(); return detected; }
function supported() { return !!how(); }
function running() { return kind === 'notify' ? true : !!(child && child.exitCode === null && !child.killed); }

// what the tray shows: counts, today's spend, the limits, who needs you, tasks asking permission and who is working
function status(snap, b, t, extra = {}) {
  const live = (snap.people || []).filter(p => !p.leaving);
  const needs = live.filter(p => ['needs_you', 'waiting'].includes(p.state));
  const workers = live.filter(p => !['idle', 'asleep', 'needs_you', 'waiting'].includes(p.state));
  const url = `${b}/?t=${t}`, cut = (x, n) => String(x || '').replace(/\s+/g, ' ').slice(0, n);
  const limits = [];
  for (const [id, l] of Object.entries(snap.limits || {})) for (const [w, v] of [['5h', l && l.primary], [extra.weekLabel || 'week', l && l.secondary]]) if (v) limits.push({ label: `${id === 'claude' ? 'Claude' : id === 'codex' ? 'Codex' : id} ${w}`, pct: Math.round(v.usedPercent) });
  return {
    at: Date.now(), url, notify: !!extra.notify, usd: Number(extra.usd) || 0, limits,
    work: workers.length, need: needs.length,
    list: needs.slice(0, 8).map(p => ({ id: String(p.id).slice(0, 80), name: cut(p.name, 40), title: cut(p.title, 60), url: `${url}&focus=${encodeURIComponent(p.id)}` })),
    workers: workers.slice(0, 8).map(p => ({ name: cut(p.name, 30), doing: cut(p.doing ? `${p.doing.tool} ${p.doing.what || ''}` : p.state, 50) })),
    asks: (extra.asks || []).slice(0, 6).map(a => ({ title: cut(a.title, 50), tool: cut(a.tool, 30), url: `${url}&task=${encodeURIComponent(a.id)}` })),
  };
}

// a system notification, with the text passed as arguments (never put into a script or a shell line)
function notifyNative(title, body) {
  try {
    if (kind === 'mac') spawn('osascript', ['-e', 'on run argv\ndisplay notification (item 2 of argv) with title (item 1 of argv)\nend run', title, body], { stdio: 'ignore' }).on('error', () => {});
    else if (kind === 'zenity' && child) child.stdin.write(`message: ${(title + ' — ' + body).replace(/[\r\n]+/g, ' ')}\n`);
    else if (kind === 'notify') spawn('notify-send', ['-a', 'coworking-agents', title, body], { stdio: 'ignore' }).on('error', () => {});
    // Windows: the tray script shows its own balloons (it owns the icon)
  } catch {}
}

function write(snap, extra = {}) {
  if (!running()) return;
  const body = status(snap, base, token, extra);
  // notifications for who just started needing you (not for what was already true when the icon started)
  const ids = new Set(body.list.map(p => p.id));
  if (seen) for (const p of body.list) if (!seen.has(p.id) && body.notify && kind !== 'win') notifyNative(`${p.name} ${extra.needsYou || 'needs you'}`, p.title || '');
  seen = ids;
  if (kind === 'zenity') {
    const tip = `coworking-agents · ●${body.work}${body.need ? ' · ❗' + body.need : ''}`;
    if (tip !== lastTip && child) { lastTip = tip; try { child.stdin.write(`tooltip: ${tip}\n`); } catch {} }
    return;
  }
  if (kind === 'notify') return;
  const key = JSON.stringify({ ...body, at: 0 });
  if (key === lastBody && Date.now() - (write.at || 0) < 5000) return; // the file's time keeps the icon alive
  lastBody = key; write.at = Date.now();
  try {
    fs.mkdirSync(DIR(), { recursive: true, mode: 0o700 });
    const tmp = FILE() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(body), { mode: 0o600 }); fs.renameSync(tmp, FILE());
  } catch {}
}

function start(opts) {
  const k = how(); if (!k) return { ok: false, reason: process.platform === 'linux' ? 'linuxTools' : 'platform' };
  if (running()) return { ok: true, kind };
  base = opts.base; token = opts.token; lastBody = ''; lastTip = ''; seen = null; kind = k;
  if (k === 'mac') child = spawn('osascript', ['-l', 'JavaScript', path.join(__dirname, 'menubar.jxa'), FILE(), ICON], { stdio: 'ignore' });
  else if (k === 'win') child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', path.join(__dirname, 'tray.ps1'), FILE(), ICON], { stdio: 'ignore', windowsHide: true });
  else if (k === 'zenity') { child = spawn('zenity', ['--notification', '--listen', '--text=coworking-agents'], { stdio: ['pipe', 'ignore', 'ignore'] }); try { child.stdin.write(`icon: ${ICON}\n`); } catch {} }
  if (child) { const me = child; child.on('error', () => { if (child === me) child = null; }); child.on('exit', () => { if (child === me) child = null; }); if (child.stdin) child.stdin.on('error', () => {}); }
  return { ok: true, kind };
}
function stop() { if (child && child.exitCode === null) child.kill('SIGTERM'); child = null; kind = null; try { fs.unlinkSync(FILE()); } catch {} }

process.on('exit', stop);
module.exports = { start, stop, write, running, supported, status, how };
