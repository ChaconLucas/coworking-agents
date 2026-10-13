'use strict';
// The macOS menu bar icon: the office writes a small status file and an osascript (JXA) process shows it.
// Opt-in (☰ → Personalise, or --menubar); only on macOS; the icon goes away when the office closes.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const DIR = () => path.join(os.homedir(), '.config', 'coworking-agents');
const FILE = () => path.join(DIR(), 'menubar.json');
let child = null, base = '', token = '', lastBody = '';

function supported() { return process.platform === 'darwin'; }
function running() { return !!(child && child.exitCode === null && !child.killed); }

// what the icon shows: counts and who needs you, each with a link that opens the office on that agent
function status(snap, b, t) {
  const live = (snap.people || []).filter(p => !p.leaving);
  const needs = live.filter(p => ['needs_you', 'waiting'].includes(p.state));
  const url = `${b}/?t=${t}`;
  return {
    at: Date.now(), url,
    work: live.filter(p => !['idle', 'asleep', 'needs_you', 'waiting'].includes(p.state)).length,
    need: needs.length,
    list: needs.slice(0, 8).map(p => ({ name: String(p.name || '').slice(0, 40), title: String(p.title || '').slice(0, 60), url: `${url}&focus=${encodeURIComponent(p.id)}` })),
  };
}
function write(snap) {
  if (!running()) return;
  const body = status(snap, base, token);
  const key = JSON.stringify({ ...body, at: 0 });
  if (key === lastBody && Date.now() - (write.at || 0) < 5000) return; // the file's time keeps the icon alive
  lastBody = key; write.at = Date.now();
  try {
    fs.mkdirSync(DIR(), { recursive: true, mode: 0o700 });
    const tmp = FILE() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(body), { mode: 0o600 }); fs.renameSync(tmp, FILE());
  } catch {}
}

function start(opts) {
  if (!supported()) return { ok: false, reason: 'platform' };
  if (running()) return { ok: true };
  base = opts.base; token = opts.token;
  child = spawn('osascript', ['-l', 'JavaScript', path.join(__dirname, 'menubar.jxa'), FILE(), path.join(__dirname, '..', 'public', 'favicon.png')], { stdio: 'ignore' });
  child.on('error', () => { child = null; });
  child.on('exit', () => { child = null; });
  lastBody = '';
  return { ok: true };
}
function stop() { if (running()) child.kill('SIGTERM'); child = null; try { fs.unlinkSync(FILE()); } catch {} }

process.on('exit', stop);
module.exports = { start, stop, write, running, supported, status };
