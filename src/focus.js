'use strict';
// "Go to terminal": brings the window and tab where the session runs to the front.
// macOS: Terminal and iTerm2 by tty via AppleScript; other apps are only activated.

const { execFile } = require('child_process');

function run(cmd, args) {
  return new Promise(resolve => execFile(cmd, args, { timeout: 5000 }, (err, out) => resolve(err ? null : String(out).trim())));
}
// osascript with the reason when it fails: -1743 = the user denied Automation for this app
function osa(args) {
  return new Promise(resolve => execFile('osascript', args, { timeout: 8000 }, (err, out, stderr) =>
    resolve(err ? { fail: /-1743/.test(String(stderr)) ? 'automation' : 'script', detail: String(stderr).trim().slice(0, 200) } : { out: String(out).trim() })));
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
    try
      repeat with t in tabs of w
        if tty of t is "${tty}" then
          set selected of t to true
          set index of w to 1
          activate
          return "ok"
        end if
      end repeat
    end try
  end repeat
end tell
return "notfound"`,
  iTerm2: tty => `tell application "iTerm2"
  repeat with w in windows
    try
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
    end try
  end repeat
end tell
return "notfound"`,
};

// Linux / Windows: bring the terminal window that hosts the session to the front (window, not tab).
const TERMS_LINUX = /gnome-terminal|konsole|xfce4-terminal|kitty|alacritty|wezterm|tilix|terminator|xterm|foot|ghostty|code|cursor/i;
const TERMS_WIN = /WindowsTerminal|wezterm|alacritty|conhost|Code\.exe|Cursor\.exe|powershell|pwsh|cmd\.exe/i;
async function focusOther(person) {
  if (!person.pid) return { ok: false, reason: 'nopid' };
  const { ancestry: chainOf } = require('./proc');
  const chain = chainOf(person.pid).slice(1);
  if (process.platform === 'linux') {
    const term = chain.find(p => TERMS_LINUX.test(p.cmd));
    if (!term) return { ok: false, reason: 'unknown' };
    if (await run('xdotool', ['search', '--pid', String(term.pid), 'windowactivate']) !== null) return { ok: true, app: term.cmd.split(/[\s/]/).filter(Boolean).pop() || 'terminal', exact: false };
    const list = await run('wmctrl', ['-lp']);
    const win = list && list.split('\n').find(l => l.split(/\s+/)[2] === String(term.pid));
    if (win && await run('wmctrl', ['-ia', win.split(/\s+/)[0]]) !== null) return { ok: true, app: 'terminal', exact: false };
    return { ok: false, reason: 'linuxtools' };
  }
  if (process.platform === 'win32') {
    const term = chain.find(p => TERMS_WIN.test(p.cmd)) || chain[0];
    if (!term) return { ok: false, reason: 'unknown' };
    const res = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(New-Object -ComObject WScript.Shell).AppActivate(${Number(term.pid)})`]);
    return res && /True/i.test(res) ? { ok: true, app: 'terminal', exact: false } : { ok: false, reason: 'unknown' };
  }
  return { ok: false, reason: 'platform' };
}

// conversations living in an app or in VS Code open right on that conversation through the app's own link
function deepLink(p) {
  if (!/^[\w-]{8,64}$/.test(p.id || '')) return null;
  if (p.agent === 'claude' && p.entrypoint === 'claude-desktop') return { url: 'claude://code/continue?session=' + p.id, app: 'Claude' };
  if (p.agent === 'claude' && p.entrypoint === 'claude-vscode') return { url: 'vscode://anthropic.claude-code/open?session=' + p.id, app: 'VS Code' };
  if (p.agent === 'codex' && p.entrypoint === 'codex-vscode') return { url: 'vscode://openai.chatgpt/local/' + p.id, app: 'VS Code' };
  if (p.agent === 'codex' && !p.pid) return { url: 'codex://threads/' + p.id, app: 'Codex' };
  return null;
}
async function focus(person) {
  if (process.platform !== 'darwin') return focusOther(person);
  const link = deepLink(person);
  if (link) { const ok = await run('open', [link.url]); return ok === null ? { ok: false, reason: person.agent === 'codex' ? 'codex' : 'desktop' } : { ok: true, app: link.app, exact: true }; }
  if (!person.pid) return { ok: false, reason: 'nopid' };
  const tty = await run('ps', ['-o', 'tty=', '-p', String(person.pid)]);
  if (!tty || !/^ttys?\d+$/.test(tty)) return { ok: false, reason: 'notty' };
  const chain = await ancestry(person.pid);
  const app = APPS.find(a => chain.some(c => a.re.test(c)));
  if (!app) return { ok: false, reason: 'unknown', chain: chain.slice(-1) };
  if (app.tab) {
    const res = await osa(['-e', SCRIPTS[app.name]('/dev/' + tty)]);
    if (res.out === 'ok') return { ok: true, app: app.name, exact: true };
    if (res.fail === 'automation') return { ok: false, reason: 'automation', app: app.name };
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
      try
        repeat with t in tabs of w
          if tty of t is theTty then
            do script theText in t
            return "ok"
          end if
        end repeat
      end try
    end repeat
  end tell
  return "notfound"
end run`,
  iTerm2: `on run argv
  set theTty to item 1 of argv
  set theText to item 2 of argv
  tell application "iTerm2"
    repeat with w in windows
      try
        repeat with t in tabs of w
          repeat with s in sessions of t
            if tty of s is theTty then
              tell s to write text theText
              return "ok"
            end if
          end repeat
        end repeat
      end try
    end repeat
  end tell
  return "notfound"
end run`,
};

// any OS: an agent running inside tmux gets the text through `tmux send-keys` on the pane that owns its tty
async function sendTmux(pid, text) {
  const info = await run('ps', ['-o', 'tty=,stat=', '-p', String(pid)]);
  const m = info && /^(\S+)\s+(\S+)$/.exec(info.trim());
  if (!m || m[1] === '?' || m[1] === '??') return null;
  const panes = await run('tmux', ['list-panes', '-a', '-F', '#{pane_tty} #{pane_id}']);
  const pane = panes && panes.split('\n').map(l => l.split(' ')).find(([tty]) => tty === '/dev/' + m[1]);
  if (!pane) return null;
  if (!m[2].includes('+')) return { ok: false, reason: 'notforeground', app: 'tmux' };
  if ((await run('tmux', ['send-keys', '-t', pane[1], '-l', text])) == null) return { ok: false, reason: 'notfound', app: 'tmux' };
  await run('tmux', ['send-keys', '-t', pane[1], 'Enter']);
  return { ok: true, app: 'tmux' };
}

async function sendText(person, text) {
  if (person.entrypoint === 'claude-desktop') return { ok: false, reason: 'desktop' };
  if (!person.pid || !['claude', 'codex'].includes(person.agent)) return { ok: false, reason: 'unsupported' };
  text = String(text || '').replace(/\r/g, '').trim();
  if (!text || text.length > 4000) return { ok: false, reason: 'text' };
  const viaTmux = await sendTmux(person.pid, text); if (viaTmux) return viaTmux;
  if (process.platform !== 'darwin') return { ok: false, reason: 'platform' };
  const info = await run('ps', ['-o', 'tty=,stat=', '-p', String(person.pid)]);
  const m = info && /^(ttys?\d+)\s+(\S+)$/.exec(info.trim());
  if (!m) return { ok: false, reason: 'notty' };
  if (!m[2].includes('+')) return { ok: false, reason: 'notforeground' }; // the agent must own the tab right now
  const chain = await ancestry(person.pid);
  const app = APPS.find(a => chain.some(c => a.re.test(c)));
  if (!app || !SEND[app.name]) return { ok: false, reason: 'unsupported', app: app && app.name };
  const res = await osa(['-e', SEND[app.name], '/dev/' + m[1], text]);
  if (res.out === 'ok') return { ok: true, app: app.name };
  return { ok: false, reason: res.fail || 'notfound', app: app.name, detail: res.detail };
}

// switching model and effort of a session running in a terminal, by typing what the user would type.
// Claude takes `/model <alias>` and `/effort <level>`. Codex only has a picker: `/model`, the model's number,
// then Up to the top, Down to the effort and `s` ("this session only", so Codex does not save it as the default).
const CODEX_EFFORTS = 4; // the picker lists the first four levels; the rest sit behind "More reasoning…"
function codexKeys(model, effort, cache) {
  const list = (cache && Array.isArray(cache.models) ? cache.models : []).filter(m => m.visibility === 'list').sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const i = list.findIndex(m => m.slug === model); if (i < 0 || i > 8) return null;
  const e = (list[i].supported_reasoning_levels || []).map(r => r.effort).slice(0, CODEX_EFFORTS).indexOf(effort); if (e < 0) return null;
  return [{ text: '/model' }, { key: 'enter' }, { text: String(i + 1) }, ...Array(6).fill({ key: 'up' }), ...Array(e).fill({ key: 'down' }), { text: 's' }];
}
const KEYCODE = { enter: 36, up: 126, down: 125 }, ESCSEQ = { up: '\x1b[A', down: '\x1b[B' };
const KEYS_SCRIPT = {
  // Terminal has no "type without Enter": the tab is brought forward and System Events types (needs Accessibility)
  Terminal: `on run argv
  set theTty to item 1 of argv
  tell application "Terminal"
    repeat with w in windows
      repeat with t in tabs of w
        if tty of t is theTty then
          set selected of t to true
          set index of w to 1
          activate
          delay 0.3
          tell application "System Events"
            repeat with i from 2 to count of argv
              set k to item i of argv
              if k starts with "#" then
                key code ((text 2 thru -1 of k) as integer)
              else
                keystroke k
              end if
              delay 0.35
            end repeat
          end tell
          return "ok"
        end if
      end repeat
    end repeat
  end tell
  return "notfound"
end run`,
  iTerm2: `on run argv
  set theTty to item 1 of argv
  tell application "iTerm2"
    repeat with w in windows
      repeat with t in tabs of w
        repeat with s in sessions of t
          if tty of s is theTty then
            repeat with i from 2 to count of argv
              set k to item i of argv
              if k is "#36" then
                tell s to write text ""
              else if k is "#126" then
                tell s to write text ((ASCII character 27) & "[A") newline no
              else if k is "#125" then
                tell s to write text ((ASCII character 27) & "[B") newline no
              else
                tell s to write text k newline no
              end if
              delay 0.35
            end repeat
            return "ok"
          end if
        end repeat
      end repeat
    end repeat
  end tell
  return "notfound"
end run`,
};
async function sendKeys(person, keys) {
  const info = await run('ps', ['-o', 'tty=,stat=', '-p', String(person.pid)]);
  const m = info && /^(\S+)\s+(\S+)$/.exec(info.trim());
  if (!m || m[1] === '?' || m[1] === '??') return { ok: false, reason: 'notty' };
  if (!m[2].includes('+')) return { ok: false, reason: 'notforeground' };
  const panes = await run('tmux', ['list-panes', '-a', '-F', '#{pane_tty} #{pane_id}']);
  const pane = panes && panes.split('\n').map(l => l.split(' ')).find(([tty]) => tty === '/dev/' + m[1]);
  if (pane) {
    for (const k of keys) { await run('tmux', ['send-keys', '-t', pane[1], ...(k.text ? ['-l', k.text] : [{ enter: 'Enter', up: 'Up', down: 'Down' }[k.key]])]); await new Promise(r => setTimeout(r, 350)); }
    return { ok: true, app: 'tmux' };
  }
  if (process.platform !== 'darwin') return { ok: false, reason: 'platform' };
  const chain = await ancestry(person.pid), term = APPS.find(a => chain.some(c => a.re.test(c)));
  if (!term || !KEYS_SCRIPT[term.name]) return { ok: false, reason: 'unsupported', app: term && term.name };
  const res = await osa(['-e', KEYS_SCRIPT[term.name], '/dev/' + m[1], ...keys.map(k => k.text || '#' + KEYCODE[k.key])]);
  if (res.out === 'ok') return { ok: true, app: term.name };
  return { ok: false, reason: /1002|1719|25211|assistive|not allowed/i.test(res.detail || '') ? 'accessibility' : res.fail || 'notfound', app: term.name, detail: res.detail };
}
async function switchCfg(person, model, effort) {
  if (!person.pid || !['claude', 'codex'].includes(person.agent) || ['claude-desktop', 'claude-vscode'].includes(person.entrypoint)) return { ok: false, reason: 'unsupported' };
  if (person.agent === 'claude') {
    if (!/^[a-z0-9.\[\]-]{2,40}$/i.test(model || '') || !/^(low|medium|high|xhigh|max)$/.test(effort || '')) return { ok: false, reason: 'text' };
    const a = await sendText(person, '/model ' + model); if (!a.ok) return a;
    await new Promise(r => setTimeout(r, 600));
    return sendText(person, '/effort ' + effort);
  }
  let cache = null; try { cache = JSON.parse(require('fs').readFileSync(require('path').join(process.env.CODEX_HOME || require('path').join(require('os').homedir(), '.codex'), 'models_cache.json'), 'utf8')); } catch {}
  const keys = codexKeys(model, effort, cache); if (!keys) return { ok: false, reason: 'text' };
  return sendKeys(person, keys);
}

// open a new terminal tab in a folder and start an AI there (macOS Terminal/iTerm). Only an existing folder
// and one of two fixed commands: nothing typed by the page reaches the shell except the quoted path.
const LAUNCH = { claude: 'claude', codex: 'codex' };
async function launch(dir, agent) {
  if (process.platform !== 'darwin') return { ok: false, reason: 'platform' };
  const cmd = LAUNCH[agent]; if (!cmd) return { ok: false, reason: 'unsupported' };
  let st = null; try { st = require('fs').statSync(String(dir || '')); } catch {}
  if (!st || !st.isDirectory()) return { ok: false, reason: 'nodir' };
  const script = 'on run argv\n tell application "Terminal"\n activate\n do script "cd " & quoted form of (item 1 of argv) & " && " & (item 2 of argv)\n end tell\n return "ok"\nend run';
  const res = await osa(['-e', script, String(dir), cmd]);
  return res.out === 'ok' ? { ok: true, app: 'Terminal' } : { ok: false, reason: res.fail || 'unknown' };
}

module.exports = { switchCfg, codexKeys, deepLink, focus, sendText, launch };
