'use strict';
// "Ir para o terminal": traz para a frente a janela e a aba onde a sessão está a correr.
// macOS: Terminal e iTerm2 por tty via AppleScript; outros apps só são ativados.

const { execFile } = require('child_process');

function run(cmd, args) {
  return new Promise(resolve => execFile(cmd, args, { timeout: 5000 }, (err, out) => resolve(err ? null : String(out).trim())));
}

async function ancestry(pid) {
  const out = [];
  let cur = pid;
  for (let i = 0; i < 12 && cur > 1; i++) {
    const line = await run('ps', ['-o', 'ppid=,comm=', '-p', String(cur)]);
    if (!line) break;
    const m = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (!m) break;
    out.push(m[2]);
    cur = Number(m[1]);
  }
  return out;
}

const APPS = [
  { re: /Terminal\.app/, name: 'Terminal', tab: true },
  { re: /iTerm/, name: 'iTerm2', tab: true },
  { re: /Visual Studio Code|Code Helper|\/Code$/, name: 'Visual Studio Code' },
  { re: /Cursor/, name: 'Cursor' },
  { re: /Warp/, name: 'Warp' },
  { re: /Ghostty/i, name: 'Ghostty' },
  { re: /WezTerm/i, name: 'WezTerm' },
  { re: /kitty/, name: 'kitty' },
  { re: /Alacritty/i, name: 'Alacritty' },
];

const SCRIPTS = {
  Terminal: tty => `tell application "Terminal"
  repeat with w in windows
    repeat with t in tabs of w
      if tty of t is "${tty}" then
        set selected of t to true
        set index of w to 1
        activate
        return "ok"
      end if
    end repeat
  end repeat
end tell
return "notfound"`,
  iTerm2: tty => `tell application "iTerm2"
  repeat with w in windows
    repeat with t in tabs of w
      repeat with s in sessions of t
        if tty of s is "${tty}" then
          select w
          tell t to select
          tell s to select
          activate
          return "ok"
        end if
      end repeat
    end repeat
  end repeat
end tell
return "notfound"`,
};

async function focus(person) {
  if (process.platform !== 'darwin') return { ok: false, reason: 'platform' };
  if (person.agent === 'codex' && !person.pid) {
    const ok = await run('open', ['-a', 'Codex']);
    return ok === null ? { ok: false, reason: 'codex' } : { ok: true, app: 'Codex', exact: false };
  }
  if (!person.pid) return { ok: false, reason: 'nopid' };
  const tty = await run('ps', ['-o', 'tty=', '-p', String(person.pid)]);
  if (!tty || !/^ttys?\d+$/.test(tty)) return { ok: false, reason: 'notty' };
  const chain = await ancestry(person.pid);
  const app = APPS.find(a => chain.some(c => a.re.test(c)));
  if (!app) return { ok: false, reason: 'unknown', chain: chain.slice(-1) };
  if (app.tab) {
    const res = await run('osascript', ['-e', SCRIPTS[app.name]('/dev/' + tty)]);
    if (res === 'ok') return { ok: true, app: app.name, exact: true };
    if (res === null) return { ok: false, reason: 'automation', app: app.name };
  }
  await run('open', ['-a', app.name]);
  return { ok: true, app: app.name, exact: false };
}

module.exports = { focus };
