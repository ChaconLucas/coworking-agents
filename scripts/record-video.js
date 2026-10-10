#!/usr/bin/env node
// Re-records the animated README clips from demo mode:
//   docs/demo.webp  the office, then the camera flying in to an agent (hero)
//   docs/tour.webp  office → agent panel → talk → usage report → server room → rooftop
// Run with `npm run video`. Needs agent-browser (https://github.com/vercel-labs/agent-browser)
// and img2webp (libwebp: `brew install webp`) on PATH, and Node 22+ (global WebSocket). Frames come from agent-browser's
// screencast stream, so no ffmpeg is needed.
'use strict';
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 4791, FPS = 12, FRAME_MS = Math.round(1000 / FPS);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ab = (...args) => execFileSync('agent-browser', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
for (const bin of ['agent-browser', 'img2webp']) {
  try { execFileSync('which', [bin], { stdio: 'ignore' }); } catch { console.error(`${bin} not found on PATH`); process.exit(1); }
}

async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'bin/coworking-agents.js'), '--demo', '--no-open', '--no-update-check', '--port', String(PORT)],
    { env: { ...process.env, COWORKING_DEMO_COUNT: '12' }, stdio: ['ignore', 'pipe', 'inherit'] });
  const url = await new Promise((ok, fail) => {
    let out = '';
    server.stdout.on('data', (d) => { out += d; const m = out.match(/http:\/\/\S+/); if (m) ok(m[0]); });
    setTimeout(() => fail(new Error('demo server did not start')), 10000);
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-video-'));
  try {
    ab('set', 'viewport', '1280', '760');
    ab('open', url);                                   // sets the token cookie
    await sleep(1500);
    ab('open', `http://127.0.0.1:${PORT}/?lang=en&hour=21&date=05-05`);
    await sleep(6000);
    // start clean: the office view (the last one is remembered), nothing open, no
    // achievement toasts left over from an earlier run
    ab('eval', "setView(null); closeTalk(); closeReport(); document.getElementById('panel-close').click(); document.querySelectorAll('.toasts .toast').forEach((t) => t.remove())");
    await sleep(1500);
    try { ab('stream', 'enable'); } catch { /* already on */ }
    const port = ab('stream', 'status').match(/\d{4,5}/)[0];

    // capture every frame of the stream while the tour runs
    const frames = [];
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?maxFps=${FPS}`);
    const aberto = new Promise((r) => { ws.onopen = r; });
    ws.onmessage = async (ev) => {
      const txt = typeof ev.data === 'string' ? ev.data : Buffer.from(await ev.data.arrayBuffer()).toString();
      let m; try { m = JSON.parse(txt); } catch { return; }
      if (m.type !== 'frame' || !m.data) return;
      const f = path.join(tmp, `f${String(frames.length).padStart(4, '0')}.jpg`);
      fs.writeFileSync(f, Buffer.from(m.data, 'base64')); frames.push(f);
    };
    await aberto;
    // the stream opens with the last frame it already had (maybe from an earlier
    // run): drop the first half second
    await sleep(500); frames.length = 0;
    const step = async (js, ms) => { if (js) ab('eval', js); await sleep(ms); };
    await step('', 4500);
    await step("showPerson((data.people.find(p => p.state === 'delegating') || data.people[3]).id)", 5000);
    await step("document.getElementById('panel-close').click(); openTalk((data.people.find(p => p.state === 'idle') || data.people[0]).id)", 5000);
    await step('closeTalk(); openReport()', 4500);
    await step("closeReport(); setView('servers')", 4000);
    await step("setView('terrace')", 4000);
    ab('eval', 'setView(null)');
    ws.close();

    const enc = (list, q, out) => execFileSync('img2webp', ['-loop', '0', '-lossy', '-q', String(q), '-m', '5', '-d', String(FRAME_MS), ...list, '-o', out], { stdio: 'ignore' });
    enc(frames.slice(0, 110), 72, path.join(ROOT, 'docs/demo.webp'));
    enc(frames, 60, path.join(ROOT, 'docs/tour.webp'));
    console.log(`✓ docs/demo.webp, docs/tour.webp (${frames.length} frames)`);
  } finally {
    server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
