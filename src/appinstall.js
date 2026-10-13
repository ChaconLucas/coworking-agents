'use strict';
// "Create the app": an app made on this computer, free, no store, no signing (it is created here, not downloaded,
// so the system does not quarantine it). Opening it starts the office if needed and shows it in an app window.
//   macOS   — ~/Applications/Coworking Agents.app (launcher + Info.plist + icon made with sips/iconutil)
//   Windows — Start Menu and Desktop shortcuts with an icon, through a hidden launcher (no console window)
//   Linux   — an entry in the applications menu with an icon
// Undo with uninstall: everything it created is listed in one place and removed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { command } = require('./autostart');

const APP_NAME = 'Coworking Agents';
const ICON_PNG = path.join(__dirname, '..', 'public', 'icon-512.png');
const ARGS = ['--app', '--menubar'];
const sh = a => "'" + String(a).replace(/'/g, "'\\''") + "'"; // POSIX single quotes

// the program the app runs (same as the terminal: npx coworking-agents@latest, or this checkout)
function appCommand(mode) { return [...command(mode).filter(a => a !== '--no-open' && a !== '--menubar'), ...ARGS]; }

function places(home = os.homedir(), platform = process.platform) {
  if (platform === 'darwin') return { app: path.join(home, 'Applications', APP_NAME + '.app') };
  if (platform === 'win32') {
    const data = process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return { dir: path.join(local, 'coworking-agents', 'app'), startMenu: path.join(data, 'Microsoft', 'Windows', 'Start Menu', 'Programs', APP_NAME + '.lnk'), desktop: path.join(home, 'Desktop', APP_NAME + '.lnk') };
  }
  const data = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  return { desktopFile: path.join(data, 'applications', 'coworking-agents.desktop'), icon: path.join(data, 'icons', 'hicolor', '512x512', 'apps', 'coworking-agents.png') };
}

// the macOS launcher script: fixed text with the program quoted, PATH from the install time (where node/npx live)
function macLauncher(cmd, envPath) {
  return `#!/bin/sh\n# Coworking Agents: starts the office if needed and opens it in an app window\nexport PATH=${sh(envPath || '/usr/bin:/bin')}\nexec ${cmd.map(sh).join(' ')}\n`;
}
function macPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>${APP_NAME}</string>
  <key>CFBundleDisplayName</key><string>${APP_NAME}</string>
  <key>CFBundleIdentifier</key><string>io.coworking-agents.app</string>
  <key>CFBundleExecutable</key><string>coworking-agents</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${require('../package.json').version}</string>
  <key>LSUIElement</key><true/>
</dict></plist>
`;
}
// an .ico with the PNG inside (supported since Windows Vista), made without any image library
function icoFromPng(png) {
  const head = Buffer.alloc(6 + 16);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); // reserved, type icon, one image
  head.writeUInt8(0, 6); head.writeUInt8(0, 7); // 0 = 256 px
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png]);
}
function desktopEntry(cmd, icon) {
  const dq = a => '"' + String(a).replace(/([\\"`$])/g, '\\$1') + '"';
  return `[Desktop Entry]\nType=Application\nName=${APP_NAME}\nComment=A pixel office for your AI coding agents\nExec=${cmd.map(dq).join(' ')}\nIcon=${icon}\nCategories=Development;\nTerminal=false\n`;
}

function installed() { const p = places(); return [p.app, p.startMenu, p.desktopFile].some(f => f && fs.existsSync(f)); }

function install(mode) {
  const cmd = appCommand(mode), p = places();
  if (process.platform === 'darwin') {
    const c = path.join(p.app, 'Contents'), macos = path.join(c, 'MacOS'), res = path.join(c, 'Resources');
    fs.mkdirSync(macos, { recursive: true }); fs.mkdirSync(res, { recursive: true });
    fs.writeFileSync(path.join(c, 'Info.plist'), macPlist());
    fs.writeFileSync(path.join(macos, 'coworking-agents'), macLauncher(cmd, process.env.PATH), { mode: 0o755 });
    try { // icon: the system's own sips and iconutil
      const set = path.join(os.tmpdir(), 'coworking-agents-' + process.pid + '.iconset'); fs.mkdirSync(set, { recursive: true });
      for (const n of [16, 32, 64, 128, 256, 512]) { execFileSync('sips', ['-z', String(n), String(n), ICON_PNG, '--out', path.join(set, `icon_${n}x${n}.png`)], { stdio: 'ignore' }); if (n <= 256) execFileSync('sips', ['-z', String(n * 2), String(n * 2), ICON_PNG, '--out', path.join(set, `icon_${n}x${n}@2x.png`)], { stdio: 'ignore' }); }
      execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(res, 'icon.icns')], { stdio: 'ignore' });
      fs.rmSync(set, { recursive: true, force: true });
    } catch {}
    try { execFileSync('touch', [p.app]); } catch {} // so Finder picks up the icon
    return { ok: true, where: p.app };
  }
  if (process.platform === 'win32') {
    fs.mkdirSync(p.dir, { recursive: true });
    const ico = path.join(p.dir, 'icon.ico'), vbs = path.join(p.dir, 'open.vbs');
    fs.writeFileSync(ico, icoFromPng(fs.readFileSync(ICON_PNG)));
    const q = a => '""' + String(a).replace(/"/g, '') + '""';
    fs.writeFileSync(vbs, `' Coworking Agents: starts the office if needed and opens it, without a console window\r\nCreateObject("WScript.Shell").Run "${cmd.map(q).join(' ')}", 0, False\r\n`);
    // the shortcuts, through PowerShell with the paths in environment variables (never put into the script)
    const ps = '$w = New-Object -ComObject WScript.Shell; foreach ($l in @($env:CW_LNK1, $env:CW_LNK2)) { $s = $w.CreateShortcut($l); $s.TargetPath = "$env:WINDIR\\System32\\wscript.exe"; $s.Arguments = \'"\' + $env:CW_VBS + \'"\'; $s.IconLocation = $env:CW_ICO; $s.Description = "A pixel office for your AI coding agents"; $s.Save() }';
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: { ...process.env, CW_LNK1: p.startMenu, CW_LNK2: p.desktop, CW_VBS: vbs, CW_ICO: ico }, stdio: 'ignore', windowsHide: true });
    return { ok: true, where: p.startMenu };
  }
  fs.mkdirSync(path.dirname(p.icon), { recursive: true }); fs.copyFileSync(ICON_PNG, p.icon);
  fs.mkdirSync(path.dirname(p.desktopFile), { recursive: true }); fs.writeFileSync(p.desktopFile, desktopEntry(cmd, p.icon), { mode: 0o644 });
  return { ok: true, where: p.desktopFile };
}
function uninstall() {
  const p = places();
  for (const f of [p.app, p.dir, p.startMenu, p.desktop, p.desktopFile, p.icon]) if (f) try { fs.rmSync(f, { recursive: true, force: true }); } catch {}
  return { ok: true };
}

module.exports = { install, uninstall, installed, places, appCommand, macLauncher, desktopEntry, icoFromPng, APP_NAME };
