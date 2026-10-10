'use strict';
// "Go to terminal": brings the window and tab where the session runs to the front.
// macOS: Terminal and iTerm2 by tty via AppleScript; other apps are only activated.

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


// "Reply": types a line into the exact Terminal/iTerm tab of a session (targeted by tty, not by
// keyboard focus). Refuses unless Claude itself is the foreground program of that tab, so the text
// can never land in a bare shell. The text travels as an osascript argument, never inside the script.
const SEND = {
  Terminal: `on run argv
  set theTty to item 1 of argv
  set theText to item 2 of argv
  tell application "Terminal"
    repeat with w in windows
      repeat with t in tabs of w
        if tty of t is theTty then
          do script theText in t
          return "ok"
        end if
      end repeat
    end repeat
  end tell
  return "notfound"
end run`,
  iTerm2: `on run argv
  set theTty to item 1 of argv
  set theText to item 2 of argv
  tell application "iTerm2"
    repeat with w in windows
      repeat with t in tabs of w
        repeat with s in sessions of t
          if tty of s is theTty then
            tell s to write text theText
            return "ok"
          end if
        end repeat
      end repeat
    end repeat
  end tell
  return "notfound"
end run`,
};

async function sendText(person, text) {
  if (process.platform !== 'darwin') return { ok: false, reason: 'platform' };
  if (!person.pid || person.agent !== 'claude') return { ok: false, reason: 'unsupported' };
  text = String(text || '').replace(/\r/g, '').trim();
  if (!text || text.length > 4000) return { ok: false, reason: 'text' };
  const info = await run('ps', ['-o', 'tty=,stat=', '-p', String(person.pid)]);
  const m = info && /^(ttys?\d+)\s+(\S+)$/.exec(info.trim());
  if (!m) return { ok: false, reason: 'notty' };
  if (!m[2].includes('+')) return { ok: false, reason: 'notforeground' }; // claude must own the tab right now
  const chain = await ancestry(person.pid);
  const app = APPS.find(a => chain.some(c => a.re.test(c)));
  if (!app || !SEND[app.name]) return { ok: false, reason: 'unsupported', app: app && app.name };
  const res = await run('osascript', ['-e', SEND[app.name], '/dev/' + m[1], text]);
  if (res === 'ok') return { ok: true, app: app.name };
  return { ok: false, reason: res === null ? 'automation' : 'notfound', app: app.name };
}

module.exports = { focus, sendText };
