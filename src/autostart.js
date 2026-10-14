'use strict';
// Start with the computer (opt-in, one click to undo): the office runs hidden at login with its tray icon.
//   macOS   — a LaunchAgent (~/Library/LaunchAgents/io.coworking-agents.plist), program and arguments, no shell
//   Windows — a hidden launcher in the Startup folder
//   Linux   — an XDG autostart entry (~/.config/autostart/coworking-agents.desktop)
// It runs the same thing you run: npx coworking-agents@latest, or this checkout's bin when running from source.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const LABEL = 'io.coworking-agents';
const BIN = path.join(__dirname, '..', 'bin', 'coworking-agents.js');
const ARGS = ['--no-open', '--menubar'];

// node by its stable path (Homebrew's /opt/homebrew/bin/node survives upgrades; the versioned Cellar path does not)
function stableNode() {
  try { const r = require('child_process').spawnSync(process.platform === 'win32' ? 'where' : 'which', ['node'], { encoding: 'utf8' }); const p = r.status === 0 && r.stdout.split(/\r?\n/)[0].trim(); if (p && fs.existsSync(p)) return p; } catch {}
  return process.execPath;
}
// the program to run at login, as a list (never a shell line)
function command(mode) {
  const node = stableNode();
  if (mode === 'source' || mode === 'global') return [node, BIN, ...ARGS];
  const npx = path.join(path.dirname(node), process.platform === 'win32' ? 'npx.cmd' : 'npx');
  return [npx, '-y', 'coworking-agents@latest', ...ARGS];
}
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// the file each system reads, with the command quoted the way that system expects
function entry(cmd, platform = process.platform, home = os.homedir()) {
  if (platform === 'darwin') {
    const log = path.join(home, '.config', 'coworking-agents', 'autostart.log');
    return { file: path.join(home, 'Library', 'LaunchAgents', LABEL + '.plist'), content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array>${cmd.map(a => `<string>${xml(a)}</string>`).join('')}</array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(process.env.PATH || '/usr/bin:/bin')}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${xml(log)}</string><key>StandardErrorPath</key><string>${xml(log)}</string>
</dict></plist>
` };
  }
  if (platform === 'win32') {
    const q = a => '""' + String(a).replace(/"/g, '') + '""'; // VBScript string with the path in quotes
    return { file: path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'coworking-agents.vbs'),
      content: `' coworking-agents: start the office hidden at login (delete this file to stop)\r\nCreateObject("WScript.Shell").Run "${cmd.map(q).join(' ')}", 0, False\r\n` };
  }
  const dq = a => '"' + String(a).replace(/([\\"`$])/g, '\\$1') + '"'; // desktop entry quoting
  return { file: path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'autostart', 'coworking-agents.desktop'),
    content: `[Desktop Entry]\nType=Application\nName=coworking-agents\nComment=A pixel office for your AI coding agents\nExec=${cmd.map(dq).join(' ')}\nX-GNOME-Autostart-enabled=true\nNoDisplay=true\n` };
}
function enabled() { try { return fs.existsSync(entry(command('npx')).file); } catch { return false; } }
function enable(mode) {
  const e = entry(command(mode));
  fs.mkdirSync(path.dirname(e.file), { recursive: true });
  fs.writeFileSync(e.file, e.content, { mode: 0o644 });
  return { ok: true, file: e.file };
}
function disable() {
  const e = entry(command('npx'));
  // stop the running one too (the tests skip this: the label is the real one, and they must never stop your office)
  if (process.platform === 'darwin' && !process.env.COWORKING_TEST) try { execFileSync('launchctl', ['bootout', `gui/${process.getuid()}/${LABEL}`], { stdio: 'ignore' }); } catch {}
  try { fs.unlinkSync(e.file); } catch {}
  return { ok: true };
}

module.exports = { command, entry, enabled, enable, disable, LABEL };
