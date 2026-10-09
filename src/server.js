'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { snapshot: real, report } = require('./collect');
const { demoSnapshot, demoReport } = require('./demo');
const { focus } = require('./focus');

const PUBLIC = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const MAX_CLIENTS = 16;
const LOCAL_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;
const LOCAL_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

function sameSecret(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function cookie(req, name) {
  const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]+)').exec(req.headers.cookie || '');
  return m ? m[1] : '';
}
function send(res, code, type, body) { res.writeHead(code, { 'Content-Type': type }); res.end(body); }

const LOCKED = `<!doctype html><meta charset="utf-8"><title>coworking-agents</title>
<body style="font:15px system-ui;background:#17151a;color:#ece7df;display:grid;place-items:center;min-height:100vh;margin:0">
<p style="max-width:420px;text-align:center">Abra o escritório pelo link que o <code>coworking-agents</code> mostrou no terminal.<br><br>
<span style="color:#9a9187">Open the office using the link printed by <code>coworking-agents</code> in your terminal.</span></p>`;

function start({ port = 4777, host = '127.0.0.1', privacy = false, interval = 1000, demo = false, token } = {}) {
  token = token || crypto.randomBytes(24).toString('hex');
  const snapshot = demo ? demoSnapshot : real;
  const clients = new Set();
  let last = '', lastPush = 0;

  function safeSnapshot() {
    try { return JSON.stringify(snapshot({ privacy })); } catch (e) { return JSON.stringify({ error: 'snapshot failed' }); }
  }

  function tick() {
    const body = safeSnapshot();
    // the "now" clock always changes; only push when the rest changed or every 5s
    const key = body.replace(/"now":\d+,/, '');
    if (key === last && Date.now() - lastPush < 5000) return;
    last = key; lastPush = Date.now();
    for (const res of clients) {
      // a client that doesn't read (full buffer) is dropped instead of piling up memory
      if (!res.write(`data: ${body}\n\n`)) { clients.delete(res); res.destroy(); }
    }
  }
  const timer = setInterval(() => { if (clients.size) tick(); }, interval);

  const server = http.createServer((req, res) => {
    try { handle(req, res); } catch { if (!res.headersSent) send(res, 500, 'text/plain', 'error'); else res.destroy(); }
  });

  function handle(req, res) {
    // DNS rebinding: an outside site pointing its domain at 127.0.0.1 arrives here with a different Host
    if (!LOCAL_HOST.test(req.headers.host || '')) { res.writeHead(421); return res.end(); }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const url = new URL(req.url, 'http://x');

    // access token: the ?t= link becomes an HttpOnly/SameSite=Strict cookie; without it nothing answers
    if (url.pathname === '/' && url.searchParams.has('t')) {
      if (!sameSecret(url.searchParams.get('t'), token)) return send(res, 401, 'text/html; charset=utf-8', LOCKED);
      res.writeHead(302, { 'Set-Cookie': `cw=${token}; HttpOnly; SameSite=Strict; Path=/`, Location: '/' + (url.searchParams.get('lang') ? '?lang=' + encodeURIComponent(url.searchParams.get('lang')) : '') });
      return res.end();
    }
    if (!sameSecret(cookie(req, 'cw'), token)) return send(res, 401, 'text/html; charset=utf-8', LOCKED);

    if (url.pathname === '/events') {
      if (clients.size >= MAX_CLIENTS) { res.writeHead(503); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`data: ${safeSnapshot()}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url.pathname === '/api/focus' && req.method === 'POST') {
      // on top of the cookie: a custom header (forces a CORS preflight, never approved) and a local origin
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
      req.on('end', async () => {
        try {
          let id = '';
          try { id = String(JSON.parse(body).id || ''); } catch {}
          const person = demo ? null : real().people.find(p => p.id === id);
          const out = person ? await focus(person) : { ok: false, reason: demo ? 'demo' : 'gone' };
          send(res, 200, 'application/json', JSON.stringify(out));
        } catch { if (!res.headersSent) send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); }
      });
      return;
    }
    if (url.pathname === '/api/report') return send(res, 200, 'application/json', JSON.stringify(demo ? demoReport() : report({ privacy })));
    if (url.pathname === '/api/state') return send(res, 200, 'application/json', safeSnapshot());
    if (url.pathname === '/api/ping') return send(res, 200, 'application/json', '{"ok":true}');

    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.join(PUBLIC, path.normalize(rel));
    if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'text/plain', 'not found');
      send(res, 200, TYPES[path.extname(file)] || 'application/octet-stream', data);
    });
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const base = `http://${host === '0.0.0.0' ? 'localhost' : host}:${server.address().port}`;
      resolve({ server, token, base, url: `${base}/?t=${token}`, close: () => { clearInterval(timer); for (const c of clients) c.destroy(); server.close(); } });
    });
  });
}

module.exports = { start };
