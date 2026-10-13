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
const push = require('./push');

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
  }));
  const tl = tasks.list({ privacy });
  const list = tl.tasks.map(t => ({ id: t.id, title: t.title, state: t.state, reason: t.reason, agent: t.agent, cost: t.cost, costUnknown: t.costUnknown, ask: t.ask || null, result: privacy ? '' : String(t.result || '').slice(0, 600), review: t.review && !privacy ? String(t.review.text || '').slice(0, 600) : '', updated: t.updated, attempts: t.attempts }));
  return { now: Date.now(), privacy, people, tasks: list, folders: privacy ? [] : folders(snap, tl), usage: extra ? extra() : null, limits: limitsOf(snap), frameAt };
}
// folders a phone may start a task in: where your agents and tasks already work (the server still checks each one)
function folders(snap, tl) {
  const set = new Set();
  for (const p of snap.people) if (p.cwd) set.add(p.cwd);
  for (const t of tl.tasks) if (t.dir) set.add(t.dir);
  for (const x of (tl.settings && tl.settings.templates) || []) if (x.dir) set.add(x.dir);
  return [...set].slice(0, 30);
}
function limitsOf(snap) {
  const out = [];
  for (const [id, l] of Object.entries(snap.limits || {})) for (const [w, v] of [['5h', l && l.primary], ['week', l && l.secondary]]) if (v) out.push({ ai: id, window: w, pct: Math.round(v.usedPercent), resetsAt: v.resetsAt || 0 });
  return out;
}

function startPhone({ port = 4778, privacy = false, demo = false, snapshot, tasks, sendText, people, token: kept, onToken, extra }) {
  const ip = lanIp();
  if (!ip) return Promise.resolve({ ok: false, reason: 'nolan' });
  let token = /^[0-9a-f]{32}$/.test(kept || '') ? kept : crypto.randomBytes(16).toString('hex'); // kept across restarts so the home-screen icon keeps working
  return new Promise((resolve, reject) => {
    let host = '';
    const server = http.createServer((req, res) => {
      try {
        if ((req.headers.host || '') !== host) { res.writeHead(421); return res.end(); } // only this LAN address, never a rebinding name
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
          res.writeHead(302, { 'Set-Cookie': `cwp=${token}; HttpOnly; SameSite=Strict; Path=/${kept ? '; Max-Age=31536000' : ''}`, Location: '/' }); return res.end();
        }
        if (!same(cookieOf(req), token)) return send(res, 401, 'text/plain; charset=utf-8', 'Scan the QR code shown by the office.');
        if (FILES[url.pathname] && req.method === 'GET') { const [f, type] = FILES[url.pathname]; return fs.readFile(path.join(DIR, f), (e, d) => (e ? send(res, 404, 'text/plain', 'not found') : send(res, 200, type, url.pathname === '/' ? String(d).replace(/__V__/g, BUILD) : d))); } // files named with this run, so a home-screen icon never keeps an old page
        if (url.pathname === '/api/m' && req.method === 'GET') { phoneSeen = Date.now(); return send(res, 200, 'application/json', JSON.stringify({ ...view({ snapshot, tasks, privacy, extra }), push: demo ? null : { n: push.count(), link: push.link(`http://${host}/?t=${token}`) } })); }
        if (url.pathname === '/frame.png' && req.method === 'GET') { phoneSeen = Date.now(); return frame ? (res.writeHead(200, { 'Content-Type': 'image/png' }), res.end(frame)) : send(res, 404, 'text/plain', 'no picture yet'); } // the office drawn without names
        if (url.pathname === '/api/m' && req.method === 'POST') {
          if (req.headers['x-coworking'] !== '1' || req.headers.origin !== 'http://' + host) { res.writeHead(403); return res.end(); }
          let body = '';
          req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
          req.on('end', async () => {
            let m = {}; try { m = JSON.parse(body); } catch {}
            try {
              if (demo) return send(res, 200, 'application/json', '{"ok":false,"reason":"demo"}');
              if (OPS.has(m.op)) return send(res, 200, 'application/json', JSON.stringify(tasks.op({ op: m.op, id: String(m.id || ''), allow: !!m.allow, text: String(m.text || '').slice(0, 4000) })));
              // notices on this phone: its subscription (checked: a known push service, real keys), a test, or all off
              if (m.op === 'push-add') return send(res, 200, 'application/json', JSON.stringify(push.add(m.sub)));
              if (m.op === 'push-off') return send(res, 200, 'application/json', JSON.stringify(push.clear()));
              if (m.op === 'push-test') return send(res, 200, 'application/json', JSON.stringify(await push.send({ title: String(m.title || '').slice(0, 80), body: String(m.text || '').slice(0, 200), tag: 'test', url: `http://${host}/?t=${token}` })));
              if (m.op === 'create') { // only in a folder your agents or tasks already use, isolated in its own worktree
                const dir = String(m.dir || ''); if (!folders(snapshot({ privacy }), tasks.list({ privacy })).includes(dir)) return send(res, 200, 'application/json', '{"ok":false,"reason":"nodir"}');
                return send(res, 200, 'application/json', JSON.stringify(tasks.op({ op: 'create', dir, desc: String(m.text || '').slice(0, 8000), agent: ['claude', 'codex'].includes(m.agent) ? m.agent : 'auto', worktree: true, from: 'phone' })));
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
    server.once('error', reject);
    server.listen(port, ip, () => {
      host = `${ip}:${server.address().port}`;
      resolve({ ok: true, url: `http://${host}/?t=${token}`, host, close: () => { visits.clear(); server.close(); },
        rotate: () => { token = crypto.randomBytes(16).toString('hex'); if (onToken) onToken(token); return `http://${host}/?t=${token}`; }, // every phone has to scan again
        addVisit: minutes => { const t = crypto.randomBytes(16).toString('hex'), until = Date.now() + Math.min(240, Math.max(5, Number(minutes) || 60)) * 60000; visits.set(t, { until }); return { url: `http://${host}/v/${t}`, until }; },
        endVisits: () => { visits.clear(); frame = null; },
        visiting: () => [...visits.values()].some(v => v.until > Date.now()) || Date.now() - phoneSeen < 60000, // someone is looking at the picture
        setFrame: (buf, c) => { frame = buf; frameAt = Date.now(); counts = { working: Number(c.working) || 0, waiting: Number(c.waiting) || 0, total: Number(c.total) || 0 }; } });
    });
  });
}

module.exports = { startPhone, lanIp, view };
