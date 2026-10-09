#!/usr/bin/env node
'use strict';
const { execFile } = require('child_process');
const { start } = require('../src/server');

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

if (flag('-h') || flag('--help')) {
  console.log(`coworks-agents — a pixel office for your AI coding agents (Claude Code, Codex, …)

  npx coworks-agents [--port 4777] [--no-open] [--private]

  --port      port to listen on (default 4777, falls back to a free one)
  --no-open   don't open the browser
  --private   hide session titles, paths and file names (screen sharing)
  --demo      show a fake office with every state (no sessions needed)
  --json      print one snapshot and exit`);
  process.exit(0);
}

if (flag('--json')) {
  const { snapshot } = require('../src/collect');
  console.log(JSON.stringify(snapshot({ privacy: flag('--private') }), null, 2));
  process.exit(0);
}

function open(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const a = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  execFile(cmd, a, () => {});
}

(async () => {
  const port = Number(opt('--port', 4777));
  const privacy = flag('--private'), demo = flag('--demo');
  let hq;
  try { hq = await start({ port, privacy, demo }); }
  catch (e) {
    if (e.code !== 'EADDRINUSE') throw e;
    // já há um escritório aberto nessa porta? então só abre o navegador nele
    const already = await fetch(`http://127.0.0.1:${port}/api/state`).then(r => r.ok).catch(() => false);
    if (already) { console.log(`coworks-agents already running → http://127.0.0.1:${port}`); if (!flag('--no-open')) open(`http://127.0.0.1:${port}`); return; }
    hq = await start({ port: 0, privacy, demo });
  }
  console.log(`coworks-agents → ${hq.url}${privacy ? '  (private mode)' : ''}\nCtrl+C to close.`);
  if (!flag('--no-open')) open(hq.url);
})();
