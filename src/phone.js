'use strict';
// Opt-in phone panel (`--phone`): a second, much smaller server on the local network.
// It only answers on this machine's LAN address, with its own token (a new one each run), and only offers:
// who needs you, tasks and their permission questions, and a few answers (allow/deny, reply, conclude, pick an option).
// Nothing else of the office (files, diffs, launching, focusing windows) is reachable from it.
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'public', 'phone');
// what a phone needs to put the panel on its home screen: no data in any of them, so no code needed
const PUBLIC = { '/fonts/silkscreen-400.woff2': ['../fonts/silkscreen-400.woff2', 'font/woff2'], '/fonts/silkscreen-700.woff2': ['../fonts/silkscreen-700.woff2', 'font/woff2'], '/logo.svg': ['../logo.svg', 'image/svg+xml'], '/art.js': ['../art.js', 'text/javascript; charset=utf-8'], '/manifest.webmanifest': ['phone.webmanifest', 'application/manifest+json'], '/icon-192.png': ['../icon-192.png', 'image/png'], '/icon-512.png': ['../icon-512.png', 'image/png'], '/apple-touch-icon.png': ['../apple-touch-icon.png', 'image/png'] };
const FILES = { '/': ['index.html', 'text/html; charset=utf-8'], '/i18n.js': ['../js/i18n.js', 'text/javascript; charset=utf-8'], '/phone.js': ['phone.js', 'text/javascript; charset=utf-8'], '/phone.css': ['phone.css', 'text/css; charset=utf-8'] };
const BUILD = Date.now().toString(36);
const OPS = new Set(['permit', 'reply', 'conclude', 'cancel', 'retry']);
// visits: a read-only link that expires, showing only a picture of the office (drawn without names) and how many are working
const VISIT_FILES = { '': ['visit.html', 'text/html; charset=utf-8'], 'i18n.js': ['../js/i18n.js', 'text/javascript; charset=utf-8'], 'visit.js': ['visit.js', 'text/javascript; charset=utf-8'], 'phone.css': ['phone.css', 'text/css; charset=utf-8'] };
const visits = new Map(); let frame = null, frameAt = 0, counts = { working: 0, waiting: 0, total: 0 }, phoneSeen = 0;

function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) {
    if (a.family === 'IPv4' && !a.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) return a.address;
  }
  return null;
}
const same = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const cookieOf = req => { const m = /(?:^|;\s*)cwp=([^;]+)/.exec(req.headers.cookie || ''); return m ? m[1] : ''; };
const send = (res, code, type, body) => { res.writeHead(code, { 'Content-Type': type }); res.end(body); };

// what the phone sees: short, and already private when the office is
function view({ snapshot, tasks, privacy, extra }) {
  const snap = snapshot({ privacy }), cut = (x, n) => String(x || '').slice(0, n);
  const people = snap.people.filter(p => !p.leaving).map(p => ({
    id: p.id, name: p.name, agent: p.agent, state: p.state, title: privacy ? '' : cut(p.title, 120),
    doing: p.doing ? (privacy ? p.doing.tool : cut(`${p.doing.tool} ${p.doing.what || ''}`, 120)) : '',
    repo: p.repo ? p.repo.name : '', branch: privacy ? '' : p.branch || '', since: p.since || 0,
    ask: p.doing && (p.state === 'needs_you' || p.state === 'waiting') ? (privacy ? '' : p.doing.ask || p.doing.what || p.doing.tool || '') : '',
    options: p.doing && p.doing.options && !p.doing.multi && p.doing.qcount === 1 ? p.doing.options.map(o => (privacy ? '' : String(o.label || o).slice(0, 80))) : null,
    lastPrompt: privacy ? '' : cut(p.lastPrompt, 200), lastReply: privacy ? '' : cut(p.lastReply, 300), model: p.model || '', usd: p.cost ? p.cost.usd : 0,
    ctxPct: p.ctxMax ? Math.round(p.ctx / p.ctxMax * 100) : 0, canMsg: canMsg(p),
  }));
  const tl = tasks.list({ privacy });
  const list = tl.tasks.map(t => ({ id: t.id, title: t.title, state: t.state, reason: t.reason, agent: t.agent, cost: t.cost, costUnknown: t.costUnknown, ask: t.ask || null, result: privacy ? '' : String(t.result || '').slice(0, 600), review: t.review && !privacy ? String(t.review.text || '').slice(0, 600) : '', updated: t.updated, attempts: t.attempts }));
  return { now: Date.now(), privacy, people, tasks: list, folders: privacy ? [] : folders(snap, tl), usage: extra ? extra() : null, limits: limitsOf(snap), frameAt };
}
// a message can be typed only into a session that finished its turn, in a terminal (the same rule as the office)
const canMsg = p => ['claude', 'codex'].includes(p.agent) && p.entrypoint !== 'claude-desktop' && ['idle', 'asleep'].includes(p.state);
// one agent in full: what you asked last, its last answer, what it did, the files it touched (texts hidden in private mode)
function agent(snap, id, privacy) {
  const p = (snap.people || []).find(x => x.id === id && !x.leaving); if (!p) return null;
  const cut = (x, n) => (privacy ? '' : String(x || '').slice(0, n)), home = s => String(s || '').replace(/^\/Users\/[^/]+|^\/home\/[^/]+/, '~');
  const d = p.doing;
  return { id: p.id, name: p.name, agent: p.agent, state: p.state, title: cut(p.title, 200), model: p.model || '', effort: p.effort || '', ctx: p.ctx || 0, ctxMax: p.ctxMax || 0,
    usd: p.cost ? p.cost.usd : 0, turns: p.turns || 0, startedAt: p.startedAt || 0, since: p.since || 0, repo: p.repo ? p.repo.name : '', branch: privacy ? '' : p.branch || '', cwd: privacy ? '' : home(p.cwd),
    lastPrompt: cut(p.lastPrompt, 3000), lastPromptAt: p.lastPromptAt || 0, lastReply: cut(p.lastReplyLong || p.lastReply, 8000), lastReplyAt: p.lastReplyAt || 0,
    doing: d ? { tool: d.tool, what: cut(d.what, 1000), ask: cut(d.ask, 3000), options: d.options && !d.multi && d.qcount === 1 ? d.options.map(o => cut(o.label || o, 120)) : null } : null,
    recent: (p.recent || []).slice(0, 20).map(r => ({ tool: r.tool, what: cut(r.what, 200), ts: r.ts || 0 })),
    files: privacy ? [] : (p.files || []).slice(0, 20).map(f => ({ name: String(f.rel || f.path || f).slice(-120), at: f.at || 0 })),
    subagents: (p.subagents || []).slice(0, 10).map(a => cut(a.name || a.type || a.description || 'agent', 80)), canMsg: canMsg(p) };
}
// folders a phone may start a task in: where your agents and tasks already work (the server still checks each one)
function folders(snap, tl) {
  const set = new Set();
  for (const p of snap.people) if (p.cwd) set.add(p.cwd);
  for (const t of tl.tasks) if (t.dir) set.add(t.dir);
  for (const x of (tl.settings && tl.settings.templates) || []) if (x.dir) set.add(x.dir);
  return [...set].slice(0, 30);
}
// the computer's own name on the local network (Bonjour, e.g. "MyMac.local"): it stays the same when the Wi-Fi hands out a
// new address, so the link and the home-screen icon keep working. Not in demo or private mode (it names the computer).
function localName() { const h = os.hostname().toLowerCase(); return /^[a-z0-9-]{1,63}\.local$/.test(h) ? h : ''; } // lower case, as browsers send it
function limitsOf(snap) {
  const out = [];
  for (const [id, l] of Object.entries(snap.limits || {})) for (const [w, v] of [['5h', l && l.primary], ['week', l && l.secondary]]) if (v) out.push({ ai: id, window: w, pct: Math.round(v.usedPercent), resetsAt: v.resetsAt || 0 });
  return out;
}

function startPhone({ port = 4778, privacy = false, demo = false, snapshot, tasks, sendText, people, token: kept, onToken, extra }) {
  let ip = lanIp();
  if (!ip) return Promise.resolve({ ok: false, reason: 'nolan' });
  let token = /^[0-9a-f]{32}$/.test(kept || '') ? kept : crypto.randomBytes(16).toString('hex'); // kept across restarts so the home-screen icon keeps working
  // live view: one timer for every open phone, sending only when something changed (and a ping every 5s so the phone knows it is alive)
  const streams = new Set(); let streamTimer = null, lastView = '', lastPing = 0, usageAt = 0, usageNow = null;
  const usageCached = () => { if (!extra) return null; if (Date.now() - usageAt > 30000) { usageAt = Date.now(); try { usageNow = extra(); } catch {} } return usageNow; };
  const viewJson = () => JSON.stringify(view({ snapshot, tasks, privacy, extra: usageCached }));
  function startStream() {
    if (streamTimer) return;
    streamTimer = setInterval(() => {
      if (!streams.size) { clearInterval(streamTimer); streamTimer = null; lastView = ''; return; }
      phoneSeen = Date.now();
      let body; try { body = viewJson(); } catch { return; }
      const key = body.replace(/"now":\d+,/, '');
      if (key !== lastView) { lastView = key; lastPing = Date.now(); for (const r of streams) if (!r.write(`data: ${body}\n\n`)) { streams.delete(r); r.destroy(); } }
      else if (Date.now() - lastPing > 5000) { lastPing = Date.now(); for (const r of streams) r.write('event: ping\ndata: 1\n\n'); } // the phone sees the link is alive
    }, 1000);
    streamTimer.unref();
  }
  return new Promise((resolve, reject) => {
    let host = '', port0 = 0; const name = demo || privacy ? '' : localName();
    const hosts = () => [ip + ':' + port0, ...(name ? [name + ':' + port0] : [])];
    const server = http.createServer((req, res) => {
      try {
        const reqHost = String(req.headers.host || '').toLowerCase();
        if (!hosts().includes(reqHost)) { res.writeHead(421); return res.end(); } // only this LAN address or the computer's own .local name, never a rebinding name
        res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
        const url = new URL(req.url, 'http://x');
        const vm = /^\/v\/([0-9a-f]{32})(?:\/([a-z0-9.]*))?$/.exec(url.pathname);
        if (vm) { // a visit: its own token in the path, nothing but the picture, the counts and the page itself
          const v = visits.get(vm[1]); if (v && v.until < Date.now()) visits.delete(vm[1]);
          if (!v || v.until < Date.now()) return send(res, 410, 'text/plain; charset=utf-8', 'This visit link has ended.');
          if (req.method !== 'GET') { res.writeHead(405); return res.end(); } // read-only
          if (vm[2] === undefined) { res.writeHead(302, { Location: url.pathname + '/' }); return res.end(); } // relative files resolve under the link
          const f = vm[2] || '';
          if (f === 'frame.png') return frame ? (res.writeHead(200, { 'Content-Type': 'image/png' }), res.end(frame)) : send(res, 404, 'text/plain', 'no picture yet');
          if (f === 'info') return send(res, 200, 'application/json', JSON.stringify({ until: v.until, frameAt, ...counts }));
          if (VISIT_FILES[f]) { const [file, type] = VISIT_FILES[f]; return fs.readFile(path.join(DIR, file), (e, d) => (e ? send(res, 404, 'text/plain', 'not found') : send(res, 200, type, d))); }
          return send(res, 404, 'text/plain', 'not found');
        }
        if (PUBLIC[url.pathname] && req.method === 'GET') { const [f, type] = PUBLIC[url.pathname]; return fs.readFile(path.join(DIR, f), (e, d) => (e ? send(res, 404, 'text/plain', 'not found') : send(res, 200, type, d))); }
        if (url.pathname === '/' && url.searchParams.has('t')) {
          if (!same(url.searchParams.get('t'), token)) return send(res, 401, 'text/plain; charset=utf-8', 'Scan the QR code again.');
          // the page itself, with the code kept in the address: iOS gives a home-screen app its own cookies, so the icon has to
          // open this same link (the manifest has no start_url, so the icon takes the address it was added from)
          return fs.readFile(path.join(DIR, 'index.html'), (e, d) => { if (e) return send(res, 404, 'text/plain', 'not found');
            res.writeHead(200, { 'Set-Cookie': `cwp=${token}; HttpOnly; SameSite=Strict; Path=/${kept ? '; Max-Age=31536000' : ''}`, 'Content-Type': 'text/html; charset=utf-8' }); res.end(String(d).replace(/__V__/g, BUILD)); });
        }
        if (!same(cookieOf(req), token)) return send(res, 401, 'text/plain; charset=utf-8', 'Scan the QR code shown by the office.');
        if (FILES[url.pathname] && req.method === 'GET') { const [f, type] = FILES[url.pathname]; return fs.readFile(path.join(DIR, f), (e, d) => (e ? send(res, 404, 'text/plain', 'not found') : send(res, 200, type, url.pathname === '/' ? String(d).replace(/__V__/g, BUILD) : d))); } // files named with this run, so a home-screen icon never keeps an old page
        if (url.pathname === '/api/m' && req.method === 'GET') { phoneSeen = Date.now(); return send(res, 200, 'application/json', viewJson()); }
        if (url.pathname === '/api/stream' && req.method === 'GET') { // the view pushed on every change, like the office's own stream
          if (streams.size >= 4) { res.writeHead(503); return res.end(); }
          phoneSeen = Date.now(); res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
          const first = viewJson(); res.write(`retry: 1000\ndata: ${first}\n\n`); streams.add(res); req.on('close', () => streams.delete(res)); startStream(); return;
        }
        if (url.pathname === '/api/agent' && req.method === 'GET') { phoneSeen = Date.now(); return send(res, 200, 'application/json', JSON.stringify(agent(snapshot({ privacy }), String(url.searchParams.get('id') || ''), privacy))); }
        if (url.pathname === '/api/talk' && req.method === 'GET') { // one live agent's whole conversation, or what matches a search in it (off in private mode)
          phoneSeen = Date.now(); const p = (snapshot({ privacy }).people || []).find(x => x.id === String(url.searchParams.get('id') || '') && !x.leaving);
          if (privacy || !p) return send(res, 200, 'application/json', JSON.stringify({ ok: false, reason: privacy ? 'private' : 'gone' }));
          require('./said').conversation(p.agent, p.id, { q: url.searchParams.get('q') || '', sub: url.searchParams.get('sub') || '' }).then(r => send(res, 200, 'application/json', JSON.stringify(r)), () => send(res, 200, 'application/json', '{"ok":false,"reason":"unknown"}'));
          return;
        }
        if (url.pathname === '/api/task-diff' && req.method === 'GET') { // what a task changed, to check before concluding (off in private mode)
          tasks.diff(String(url.searchParams.get('id') || ''), { privacy }).then(d => send(res, 200, 'application/json', JSON.stringify(d.ok ? { ...d, diff: String(d.diff || '').slice(0, 60000) } : d)), () => send(res, 200, 'application/json', '{"ok":false,"reason":"unknown"}'));
          return;
        }
        if (url.pathname === '/frame.png' && req.method === 'GET') { phoneSeen = Date.now(); return frame ? (res.writeHead(200, { 'Content-Type': 'image/png' }), res.end(frame)) : send(res, 404, 'text/plain', 'no picture yet'); } // the office drawn without names
        if (url.pathname === '/api/m' && req.method === 'POST') {
          if (req.headers['x-coworking'] !== '1' || req.headers.origin !== 'http://' + reqHost) { res.writeHead(403); return res.end(); }
          let body = '';
          req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
          req.on('end', async () => {
            let m = {}; try { m = JSON.parse(body); } catch {}
            try {
              if (demo) return send(res, 200, 'application/json', '{"ok":false,"reason":"demo"}');
              if (OPS.has(m.op)) return send(res, 200, 'application/json', JSON.stringify(tasks.op({ op: m.op, id: String(m.id || ''), allow: !!m.allow, text: String(m.text || '').slice(0, 4000) })));
              if (m.op === 'create') { // only in a folder your agents or tasks already use, isolated in its own worktree
                const dir = String(m.dir || ''); if (!folders(snapshot({ privacy }), tasks.list({ privacy })).includes(dir)) return send(res, 200, 'application/json', '{"ok":false,"reason":"nodir"}');
                return send(res, 200, 'application/json', JSON.stringify(tasks.op({ op: 'create', dir, desc: String(m.text || '').slice(0, 8000), agent: ['claude', 'codex'].includes(m.agent) ? m.agent : 'auto', worktree: true, from: 'phone' })));
              }
              if (m.op === 'message') { // free text, only to a session waiting for your next message, typed into its terminal
                const p = people().find(x => x.id === String(m.id || ''));
                return send(res, 200, 'application/json', JSON.stringify(!p ? { ok: false, reason: 'gone' } : !canMsg(p) ? { ok: false, reason: 'busy' } : await sendText(p, String(m.text || '').slice(0, 4000))));
              }
              if (m.op === 'answer') { // the same rule as the office: one single-choice question, a valid number
                const p = people().find(x => x.id === String(m.id || '')), d = p && p.doing, n = Number(m.choice);
                const out = !p ? { ok: false, reason: 'gone' } : p.state !== 'needs_you' || !d || !d.options || d.multi || d.qcount !== 1 ? { ok: false, reason: 'busy' }
                  : !Number.isInteger(n) || n < 1 || n > d.options.length ? { ok: false, reason: 'text' } : await sendText(p, String(n));
                return send(res, 200, 'application/json', JSON.stringify(out));
              }
              send(res, 200, 'application/json', '{"ok":false,"reason":"op"}');
            } catch { send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); }
          });
          return;
        }
        send(res, 404, 'text/plain', 'not found');
      } catch { if (!res.headersSent) send(res, 500, 'text/plain', 'error'); else res.destroy(); }
    });
    // a new address from the Wi-Fi: listen there instead (same port and code), so nothing has to be scanned again
    const sockets = new Set(); server.on('connection', c => { sockets.add(c); c.on('close', () => sockets.delete(c)); });
    const follow = setInterval(() => {
      const now = lanIp(); if (!now || now === ip) return;
      for (const r of streams) r.destroy(); streams.clear();
      server.close(() => { server.once('error', () => {}); server.listen(port0, now, () => { ip = now; host = (name || ip) + ':' + port0; }); });
      for (const c of sockets) c.destroy();
    }, 15000); follow.unref();
    server.once('error', reject);
    server.listen(port, ip, () => {
      port0 = server.address().port; host = (name || ip) + ':' + port0;
      resolve({ ok: true, get url() { return `http://${host}/?t=${token}`; }, set url(v) {}, get host() { return host; }, get ipUrl() { return `http://${ip}:${port0}/?t=${token}`; },
        close: () => { clearInterval(follow); visits.clear(); for (const r of streams) r.destroy(); streams.clear(); server.close(); },
        rotate: () => { token = crypto.randomBytes(16).toString('hex'); if (onToken) onToken(token); return `http://${host}/?t=${token}`; }, // every phone has to scan again
        addVisit: minutes => { const t = crypto.randomBytes(16).toString('hex'), until = Date.now() + Math.min(240, Math.max(5, Number(minutes) || 60)) * 60000; visits.set(t, { until }); return { url: `http://${host}/v/${t}`, until }; },
        endVisits: () => { visits.clear(); frame = null; },
        visiting: () => [...visits.values()].some(v => v.until > Date.now()) || Date.now() - phoneSeen < 60000, // someone is looking at the picture
        setFrame: (buf, c) => { frame = buf; frameAt = Date.now(); counts = { working: Number(c.working) || 0, waiting: Number(c.waiting) || 0, total: Number(c.total) || 0 }; } });
    });
  });
}

module.exports = { startPhone, lanIp, view, agent };
