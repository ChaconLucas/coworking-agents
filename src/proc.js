'use strict';
// Process table, the same shape on every OS: [{ pid, ppid, cpu, secs, tty, cmd }].
// macOS/Linux use `ps`; Windows uses PowerShell/CIM (no tty there: tty = '', cpu = 0).

const { execFileSync } = require('child_process');

function parseEtime(et) {
  const t = String(et).split(/[-:]/).map(Number); // [[dd-]hh:]mm:ss
  return t.length === 4 ? ((t[0] * 24 + t[1]) * 60 + t[2]) * 60 + t[3] : t.length === 3 ? (t[0] * 60 + t[1]) * 60 + t[2] : (t[0] || 0) * 60 + (t[1] || 0);
}

function unixList() {
  const out = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,pcpu=,etime=,tty=,args='], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 });
  const rows = [];
  for (const line of out.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+(\S+)\s+(\S+)\s+(.*)$/.exec(line);
    if (m) rows.push({ pid: +m[1], ppid: +m[2], cpu: +m[3], secs: parseEtime(m[4]), tty: /^(\?\?|\?|-)$/.test(m[5]) ? '' : m[5], cmd: m[6] });
  }
  return rows;
}

function windowsList() {
  const ps = "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate,Name,CommandLine | ConvertTo-Json -Compress";
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  let arr = [];
  try { arr = JSON.parse(out); } catch {}
  if (!Array.isArray(arr)) arr = [arr];
  const now = Date.now();
  return arr.filter(Boolean).map(p => {
    const born = /Date\((\d+)\)/.exec(String(p.CreationDate || ''));
    return { pid: p.ProcessId, ppid: p.ParentProcessId, cpu: 0, secs: born ? Math.max(0, (now - Number(born[1])) / 1000) : 0, tty: '', cmd: p.CommandLine || p.Name || '' };
  });
}

let cache = { at: 0, rows: [] };
function processList(maxAgeMs = 900) {
  if (Date.now() - cache.at < maxAgeMs) return cache.rows;
  let rows = [];
  try { rows = process.platform === 'win32' ? windowsList() : unixList(); } catch {}
  cache = { at: Date.now(), rows };
  return rows;
}

// the chain of commands from a process up to the root (for finding the terminal app that hosts it)
function ancestry(pid) {
  const byPid = new Map(processList().map(r => [r.pid, r])), out = [];
  for (let cur = byPid.get(pid), i = 0; cur && i < 15; cur = byPid.get(cur.ppid), i++) out.push(cur);
  return out;
}

module.exports = { processList, ancestry, parseEtime };
