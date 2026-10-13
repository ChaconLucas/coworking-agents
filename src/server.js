'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { snapshot: real, report, ended, hotFiles } = require('./collect');
const { demoSnapshot, demoReport } = require('./demo');
const { focus, sendText, launch, switchCfg } = require('./focus');
const { usage } = require('./usage');
const { updateInfo } = require('./update');
const progress = require('./progress');
const tasks = require('./tasks');
const { versionInfo, maybeCheck } = require('./update');

const PUBLIC = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon' };
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

// one search box for the whole history: office tasks, live sessions, today's report and this month's top conversations
function searchAll(q, privacy, demo) {
  q = String(q).slice(0, 100).toLowerCase().trim();
  if (q.length < 2 || privacy) return [];
  const out = tasks.search(q), has = x => x && String(x).toLowerCase().includes(q);
  try { for (const p of (demo ? demoSnapshot() : real()).people) if (has(p.title) || has(p.lastPrompt) || has(p.name)) out.push({ kind: 'session', id: p.id, title: p.title || p.name, agent: p.agent, state: p.state, live: true }); } catch {}
  try { for (const r of (demo ? demoReport() : report()).rows) if (has(r.title)) out.push({ kind: 'today', id: r.id, title: r.title, agent: r.agent, live: r.live }); } catch {}
  try { const u = demo ? require('./demo').demoUsage() : usage(); for (const m of (u.month && u.month.top) || []) if (has(m.title)) out.push({ kind: 'month', id: m.id, title: m.title, agent: m.agent }); } catch {}
  const seen = new Set(); return out.filter(r => !seen.has(r.kind === 'task' ? 't' + r.id : r.id) && seen.add(r.kind === 'task' ? 't' + r.id : r.id)).slice(0, 40);
}

// private mode: conversation titles name projects and people, so they go
function privateUsage(u, privacy) {
  if (!privacy || !u) return u;
  const strip = x => Array.isArray(x) ? x.map(strip) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === 'title' ? '' : strip(v)])) : x;
  return strip(u);
}

// quiet hours (same rule as the page): a daily window that may cross midnight
function quietAt(q, d = new Date()) {
  if (!q || !q.on || !/^\d\d:\d\d$/.test(q.from || '') || !/^\d\d:\d\d$/.test(q.to || '')) return false;
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return q.from <= q.to ? hm >= q.from && hm < q.to : hm >= q.from || hm < q.to;
}
// one at a time for the heavy ones (reading days of logs, calling gh, removing worktrees): a burst of requests cannot pile up
const inFlight = new Set();
async function once(key, fn) { if (inFlight.has(key)) return { ok: false, reason: 'busy' }; inFlight.add(key); try { return await fn(); } finally { inFlight.delete(key); } }
function start({ port = 4777, host = '127.0.0.1', privacy = false, interval = 1000, demo = false, token, phone = false, menubar = false } = {}) {
  tasks.startQueue({ demo });
  token = token || crypto.randomBytes(24).toString('hex');
  const snapshot = demo ? demoSnapshot : real;
  const clients = new Set();
  let last = '', lastPush = 0;

  function safeSnapshot() {
    try { return JSON.stringify({ ...snapshot({ privacy }), update: demo ? null : updateInfo(), privacy }); } catch (e) { return JSON.stringify({ error: 'snapshot failed' }); }
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
  let phoneInfo = null, phoneReason = phone ? 'starting' : 'off', visitNow = null, baseUrl = '';
  const mb = require('./menubar');
  // what the tray icon gets besides the snapshot: today's spend, tasks asking permission, and whether it may notify
  // (only when no office page is open, so nothing is announced twice, and never in the quiet hours set in Personalise)
  const ptLang = /^pt/i.test(process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || '');
  let usdToday = 0, usdAt = 0;
  const mbExtra = () => {
    if (Date.now() - usdAt > 60000) { usdAt = Date.now(); try { const u = usage(), d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); usdToday = (u.days && u.days[k] && u.days[k].usd) || 0; } catch {} }
    const st = tasks.list({ privacy }), q = st.settings.quiet;
    return { usd: usdToday, notify: clients.size === 0 && !quietAt(q), asks: st.tasks.filter(t => t.ask).map(t => ({ id: t.id, title: t.title, tool: t.ask.tool })), needsYou: ptLang ? 'precisa de você' : 'needs you', weekLabel: ptLang ? 'semana' : 'week' };
  };
  const mbTimer = setInterval(() => { if (mb.running()) try { mb.write(snapshot({ privacy }), mbExtra()); } catch {} }, 2000); mbTimer.unref();

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
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api.open-meteo.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const url = new URL(req.url, 'http://x');

    // access token: the ?t= link becomes an HttpOnly/SameSite=Strict cookie; without it nothing answers
    if (url.pathname === '/' && url.searchParams.has('t')) {
      if (!sameSecret(url.searchParams.get('t'), token)) return send(res, 401, 'text/html; charset=utf-8', LOCKED);
      // keep the other parameters (lang, hour, date…), drop only the token; always a same-origin path
      const rest = new URLSearchParams(url.searchParams); rest.delete('t');
      res.writeHead(302, { 'Set-Cookie': `cw=${token}; HttpOnly; SameSite=Strict; Path=/`, Location: '/' + (rest.toString() ? '?' + rest.toString() : '') });
      return res.end();
    }
    // icons are public: browsers fetch them without cookies and cache the 401 otherwise
    const PUBLIC_ICONS = new Set(['/favicon.ico', '/favicon.png', '/favicon.svg', '/apple-touch-icon.png', '/logo.svg']);
    if (!PUBLIC_ICONS.has(url.pathname) && !sameSecret(cookie(req, 'cw'), token)) return send(res, 401, 'text/html; charset=utf-8', LOCKED);

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
    if (url.pathname === '/api/reply' && req.method === 'POST') {
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 2e4) req.destroy(); });
      req.on('end', async () => {
        try {
          let msg = {};
          try { msg = JSON.parse(body); } catch {}
          const person = demo ? null : real().people.find(p => p.id === String(msg.id || ''));
          // only sessions waiting for your next message (turn finished) take free text
          const out = !person ? { ok: false, reason: demo ? 'demo' : 'gone' } : person.state !== 'idle' && person.state !== 'asleep' ? { ok: false, reason: 'busy' } : await sendText(person, msg.text);
          send(res, 200, 'application/json', JSON.stringify(out));
        } catch { if (!res.headersSent) send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); }
      });
      return;
    }
    if (url.pathname === '/api/usage') return send(res, 200, 'application/json', JSON.stringify(demo ? require('./demo').demoUsage() : privateUsage(usage(), privacy)));
    if (url.pathname === '/api/compact' && req.method === 'POST') {
      // types "/compact" into a Claude session that finished its turn and whose context is filling up
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 2e3) req.destroy(); });
      req.on('end', async () => {
        try {
          let msg = {};
          try { msg = JSON.parse(body); } catch {}
          const person = demo ? null : real().people.find(p => p.id === String(msg.id || ''));
          const out = !person ? { ok: false, reason: demo ? 'demo' : 'gone' }
            : person.agent !== 'claude' ? { ok: false, reason: 'unsupported' }
            : person.state !== 'idle' && person.state !== 'asleep' ? { ok: false, reason: 'busy' }
            : await sendText(person, '/compact');
          send(res, 200, 'application/json', JSON.stringify(out));
        } catch { if (!res.headersSent) send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); }
      });
      return;
    }
    if (url.pathname === '/api/switch' && req.method === 'POST') {
      // changes model and effort of a session running in a terminal, typed the way the user would (never while it asks something)
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 2e3) req.destroy(); });
      req.on('end', async () => {
        try {
          let msg = {};
          try { msg = JSON.parse(body); } catch {}
          const person = demo ? null : real().people.find(p => p.id === String(msg.id || ''));
          const out = !person ? { ok: false, reason: demo ? 'demo' : 'gone' }
            : ['needs_you', 'waiting'].includes(person.state) ? { ok: false, reason: 'busy' }
            : await switchCfg(person, String(msg.model || ''), String(msg.effort || ''));
          send(res, 200, 'application/json', JSON.stringify(out));
        } catch { if (!res.headersSent) send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); }
      });
      return;
    }
    if (url.pathname === '/api/answer' && req.method === 'POST') {
      // pick an option of the agent's question: only a single-question, single-choice ask, and only a valid number
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 2e3) req.destroy(); });
      req.on('end', async () => {
        try {
          let msg = {};
          try { msg = JSON.parse(body); } catch {}
          const person = demo ? null : real().people.find(p => p.id === String(msg.id || ''));
          const d = person && person.doing, n = Number(msg.choice);
          const out = !person ? { ok: false, reason: demo ? 'demo' : 'gone' }
            : person.state !== 'needs_you' || !d || !d.options || !d.options.length ? { ok: false, reason: 'busy' }
            : d.multi || d.qcount !== 1 ? { ok: false, reason: 'complex' }
            : !Number.isInteger(n) || n < 1 || n > d.options.length ? { ok: false, reason: 'text' }
            : await sendText(person, String(n));
          send(res, 200, 'application/json', JSON.stringify(out));
        } catch { if (!res.headersSent) send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); }
      });
      return;
    }
    if (url.pathname === '/api/launch' && req.method === 'POST') {
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 4e3) req.destroy(); });
      req.on('end', async () => {
        try { let m = {}; try { m = JSON.parse(body); } catch {} send(res, 200, 'application/json', JSON.stringify(demo ? { ok: false, reason: 'demo' } : await launch(m.dir, m.agent))); }
        catch { if (!res.headersSent) send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); }
      });
      return;
    }
    if (url.pathname === '/api/progress' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(progress.load({ demo })));
    if (url.pathname === '/api/progress' && req.method === 'POST') {
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '', big = false;
      req.on('data', c => { body += c; if (body.length > progress.MAX) { big = true; req.destroy(); } });
      req.on('end', () => {
        if (big) return;
        let data = null;
        try { data = JSON.parse(body); } catch {}
        send(res, 200, 'application/json', JSON.stringify({ ok: data ? progress.save(data, { demo }) : false }));
      });
      return;
    }
    if (url.pathname === '/api/replay' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(demo ? [] : ended({ privacy })));
    if (url.pathname === '/api/tasks' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(tasks.list({ privacy })));
    if (url.pathname === '/api/task' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(tasks.get(url.searchParams.get('id'), { privacy }) || null));
    if (url.pathname === '/api/gh' && req.method === 'POST') { // issues to tasks and PR reviews, through your logged-in gh
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
      req.on('end', async () => { let m = {}; try { m = JSON.parse(body); } catch {} try { const out = privacy ? { ok: false, reason: 'private' } : await once('gh', () => m.op === 'issues' ? tasks.ghIssues(m.dir) : m.op === 'review' ? tasks.ghReviewPr(m.dir, m.n, ['claude', 'codex', 'auto'].includes(m.agent) ? m.agent : 'auto') : { ok: false, reason: 'op' }); send(res, 200, 'application/json', JSON.stringify(out)); } catch { send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); } });
      return;
    }
    if (url.pathname === '/api/cleanup' && req.method === 'POST') { // list or remove finished worktrees (rules in tasks.cleanup)
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e4) req.destroy(); });
      req.on('end', async () => { let m = {}; try { m = JSON.parse(body); } catch {} try { const out = privacy ? { ok: false, reason: 'private' } : await once('cleanup', () => m.op === 'run' ? tasks.cleanup(Array.isArray(m.ids) ? m.ids.map(String).slice(0, 200) : []) : tasks.cleanupList()); send(res, 200, 'application/json', JSON.stringify(out)); } catch { send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); } });
      return;
    }
    if (url.pathname === '/api/task-ship' && req.method === 'POST') { // check before concluding, commit, open a PR (same guards as every POST)
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 2e4) req.destroy(); });
      req.on('end', async () => { let m = {}; try { m = JSON.parse(body); } catch {} try { const out = m.op === 'check' ? await tasks.check(String(m.id || ''), { privacy }) : privacy ? { ok: false, reason: 'private' } : await tasks.ship(String(m.id || ''), m); send(res, 200, 'application/json', JSON.stringify(out)); } catch { send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); } });
      return;
    }
    if (url.pathname === '/api/task-diff' && req.method === 'GET') { tasks.diff(url.searchParams.get('id'), { privacy }).then(d => send(res, 200, 'application/json', JSON.stringify(d))); return; }
    if (url.pathname === '/api/hotfiles' && req.method === 'GET') { // files touched most this week (off in private mode)
      if (demo) return send(res, 200, 'application/json', JSON.stringify(require('./demo').demoHot ? require('./demo').demoHot() : []));
      once('hot', async () => hotFiles({ privacy })).then(r => send(res, 200, 'application/json', JSON.stringify(Array.isArray(r) ? r : []))).catch(() => send(res, 200, 'application/json', '[]'));
      return;
    }
    if (url.pathname === '/api/said' && req.method === 'GET') { // search in what was asked and answered (off in private mode)
      if (privacy || demo) return send(res, 200, 'application/json', JSON.stringify(demo ? [{ agent: 'claude', id: 'demo-0-Refactor checkout flow', role: 'assistant', at: Date.now() - 6e5, snippet: '…the migration adds a nullable column first, then backfills…' }] : []));
      once('said', () => require('./said').search(url.searchParams.get('q') || '')).then(r => send(res, 200, 'application/json', JSON.stringify(Array.isArray(r) ? r : []))).catch(() => send(res, 200, 'application/json', '[]'));
      return;
    }
    if (url.pathname === '/api/search' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify(searchAll(url.searchParams.get('q') || '', privacy, demo)));
    if (url.pathname === '/api/version' && req.method === 'GET') { (demo ? Promise.resolve() : maybeCheck()).then(() => send(res, 200, 'application/json', JSON.stringify(versionInfo()))); return; }
    if (url.pathname === '/api/tasks' && req.method === 'POST') {
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 2e4) req.destroy(); });
      req.on('end', () => { let m = {}; try { m = JSON.parse(body); } catch {} try { send(res, 200, 'application/json', JSON.stringify(tasks.op(m))); } catch { send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); } });
      return;
    }
    if (url.pathname === '/api/report') return send(res, 200, 'application/json', JSON.stringify(demo ? demoReport() : report({ privacy })));
    if (url.pathname === '/api/state') return send(res, 200, 'application/json', safeSnapshot());
    if (url.pathname === '/api/ping') return send(res, 200, 'application/json', '{"ok":true}');
    // the phone link and its QR code, only to this machine (the phone server itself never serves this)
    if (url.pathname === '/api/phone') return send(res, 200, 'application/json', JSON.stringify(phoneInfo ? { on: true, url: phoneInfo.url, qr: require('./qr').encode(phoneInfo.url).map(r => r.map(x => (x ? 1 : 0)).join('')), visit: visitNow && visitNow.until > Date.now() ? { ...visitNow, qr: require('./qr').encode(visitNow.url).map(r => r.map(x => (x ? 1 : 0)).join('')) } : null } : { on: false, reason: phoneReason }));
    if (url.pathname === '/api/menubar' && req.method === 'GET') return send(res, 200, 'application/json', JSON.stringify({ supported: mb.supported() && !demo, on: mb.running(), how: mb.how(), platform: process.platform }));
    if (url.pathname === '/api/menubar' && req.method === 'POST') { // turn the macOS menu bar icon on or off (remembered for next time)
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 1e3) req.destroy(); });
      req.on('end', () => { let m = {}; try { m = JSON.parse(body); } catch {} if (demo) return send(res, 200, 'application/json', '{"ok":false,"reason":"demo"}'); const on = !!m.on; tasks.op({ op: 'settings', menubar: on }); const r = on ? mb.start({ base: baseUrl, token }) : (mb.stop(), { ok: true }); if (on) mb.write(snapshot({ privacy }), mbExtra()); send(res, 200, 'application/json', JSON.stringify({ ...r, on: mb.running() })); });
      return;
    }
    if (url.pathname === '/api/visit' && req.method === 'POST') { // start/stop a visit and send its picture: same guards as every POST, and only with the phone panel on
      const origin = req.headers.origin || '';
      if (req.headers['x-coworking'] !== '1' || (origin && !LOCAL_ORIGIN.test(origin))) { res.writeHead(403); return res.end(); }
      if (!phoneInfo) return send(res, 200, 'application/json', '{"ok":false,"reason":"nophone"}');
      const chunks = []; let size = 0;
      req.on('data', c => { size += c.length; if (size > 4e6) req.destroy(); else chunks.push(c); });
      req.on('end', () => {
        try {
          const op = url.searchParams.get('op');
          if (op === 'start') { visitNow = phoneInfo.addVisit(Number(url.searchParams.get('min')) || 60); return send(res, 200, 'application/json', JSON.stringify({ ok: true, ...visitNow })); }
          if (op === 'stop') { visitNow = null; phoneInfo.endVisits(); return send(res, 200, 'application/json', '{"ok":true}'); }
          if (op === 'frame') {
            const buf = Buffer.concat(chunks); if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return send(res, 200, 'application/json', '{"ok":false,"reason":"png"}'); // a PNG and nothing else
            phoneInfo.setFrame(buf, { working: url.searchParams.get('w'), waiting: url.searchParams.get('n'), total: url.searchParams.get('t') });
            return send(res, 200, 'application/json', JSON.stringify({ ok: true, active: phoneInfo.visiting() }));
          }
          send(res, 200, 'application/json', '{"ok":false,"reason":"op"}');
        } catch { send(res, 500, 'application/json', '{"ok":false,"reason":"unknown"}'); }
      });
      return;
    }

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
    server.listen(port, host, async () => {
      const base = `http://${host === '0.0.0.0' ? 'localhost' : host}:${server.address().port}`; baseUrl = base;
      if (!demo && (menubar || tasks.list().settings.menubar)) { mb.start({ base, token }); try { mb.write(snapshot({ privacy }), mbExtra()); } catch {} }
      if (phone) { // opt-in: a separate, restricted server on the LAN address (see src/phone.js)
        try { const r = await require('./phone').startPhone({ port: port ? server.address().port + 1 : 0, privacy, demo, snapshot, tasks, sendText, people: () => real().people }); if (r.ok) phoneInfo = r; else phoneReason = r.reason; }
        catch (e) { phoneReason = e.code === 'EADDRINUSE' ? 'port' : 'error'; }
      }
      resolve({ server, token, base, url: `${base}/?t=${token}`, phone: phoneInfo, phoneReason, close: () => { clearInterval(timer); clearInterval(mbTimer); mb.stop(); for (const c of clients) c.destroy(); server.close(); if (phoneInfo) phoneInfo.close(); } });
    });
  });
}

module.exports = { start };
