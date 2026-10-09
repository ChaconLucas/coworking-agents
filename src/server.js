'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { snapshot: real } = require('./collect');
const { demoSnapshot } = require('./demo');

const PUBLIC = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

function start({ port = 4777, host = '127.0.0.1', privacy = false, interval = 1000, demo = false } = {}) {
  const snapshot = demo ? demoSnapshot : real;
  const clients = new Set();
  let last = '', lastPush = 0;

  function tick() {
    let body;
    try { body = JSON.stringify(snapshot({ privacy })); } catch (e) { body = JSON.stringify({ error: String(e && e.message || e) }); }
    // o relógio "now" muda sempre; só empurra quando o resto mudou ou a cada 5s
    const key = body.replace(/"now":\d+,/, '');
    if (key === last && Date.now() - lastPush < 5000) return;
    last = key; lastPush = Date.now();
    for (const res of clients) res.write(`data: ${body}\n\n`);
  }
  const timer = setInterval(() => { if (clients.size) tick(); }, interval);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify(snapshot({ privacy }))}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url.pathname === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(snapshot({ privacy })));
    }
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.join(PUBLIC, path.normalize(rel));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve({ server, url: `http://${host === '0.0.0.0' ? 'localhost' : host}:${server.address().port}`, close: () => { clearInterval(timer); server.close(); } }));
  });
}

module.exports = { start };
