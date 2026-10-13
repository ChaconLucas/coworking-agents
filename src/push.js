'use strict';
// Push notifications to the phone: they arrive with the app closed and away from home (opt-in, from the phone panel).
// iOS only lets a home-screen app on HTTPS receive push, so the phone subscribes on a small static page of this project
// on GitHub Pages (docs/push). That page holds no data and is never sent any: the office sends each notice straight to
// the phone's push service (Apple, Google, Mozilla, Microsoft), encrypted end to end (RFC 8291) so only that phone can
// read it, and signed with this computer's own key (VAPID, RFC 8292). Those services are the only outbound requests.
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const PAGE = process.env.COWORKING_PUSH_PAGE || 'https://chaconlucas.github.io/coworking-agents/push/';
const CONTACT = 'https://github.com/ChaconLucas/coworking-agents';
const MAX = 5; // phones kept; the oldest goes first
const FILE = () => path.join(os.homedir(), '.config', 'coworking-agents', 'push.json');
const b64u = b => Buffer.from(b).toString('base64url');
const unb64u = s => Buffer.from(String(s || ''), 'base64url');
// only the push services browsers use: a subscription can never point the office at any other address
const SERVICES = [/^([a-z0-9-]+\.)*push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/];

// a subscription as the browser gives it ({endpoint, keys: {p256dh, auth}}) or as kept here; null when anything is off
function clean(s) {
  if (!s || typeof s !== 'object') return null;
  const e = String(s.endpoint || ''); let u; try { u = new URL(e); } catch { return null; }
  if (e.length > 1024 || u.protocol !== 'https:' || u.port || u.username || u.password || !SERVICES.some(r => r.test(u.hostname))) return null;
  const k = s.keys || s, p = unb64u(k.p256dh), a = unb64u(k.auth);
  if (p.length !== 65 || p[0] !== 4 || a.length !== 16) return null;
  return { endpoint: e, p256dh: b64u(p), auth: b64u(a), at: Number(s.at) || Date.now() };
}

let state = null;
function load() {
  if (state) return state;
  state = { jwk: null, subs: [] };
  try { const s = JSON.parse(fs.readFileSync(FILE(), 'utf8')); if (s.jwk && s.jwk.d) state.jwk = s.jwk; state.subs = (s.subs || []).map(clean).filter(Boolean).slice(-MAX); } catch {}
  return state;
}
function save() {
  try {
    fs.mkdirSync(path.dirname(FILE()), { recursive: true, mode: 0o700 });
    const tmp = FILE() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 }); fs.renameSync(tmp, FILE());
  } catch {}
}
// this computer's own signing key, made once and kept private (never leaves the machine)
function jwk() {
  const s = load();
  if (!s.jwk) { s.jwk = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' }); save(); }
  return s.jwk;
}
const pad32 = b => Buffer.concat([Buffer.alloc(Math.max(0, 32 - b.length)), b]);
function publicKey() { const j = jwk(); return b64u(Buffer.concat([Buffer.from([4]), pad32(unb64u(j.x)), pad32(unb64u(j.y))])); }

// RFC 8291 (aes128gcm): a fresh key pair and salt per message; asPrivate/salt only to check against the RFC's example
function encrypt(text, sub, { asPrivate, salt } = {}) {
  const ua = unb64u(sub.p256dh), auth = unb64u(sub.auth);
  const ecdh = crypto.createECDH('prime256v1'); if (asPrivate) ecdh.setPrivateKey(asPrivate); else ecdh.generateKeys();
  const as = ecdh.getPublicKey(), secret = ecdh.computeSecret(ua);
  salt = salt || crypto.randomBytes(16);
  const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
  const ikm = hmac(hmac(auth, secret), Buffer.concat([Buffer.from('WebPush: info\0'), ua, as, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(text), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = as.length;
  return Buffer.concat([head, as, body]);
}
// RFC 8292: a short-lived token signed with this computer's key, for that push service only
function vapid(endpoint, now = Date.now()) {
  const data = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' })) + '.' + b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: CONTACT }));
  const sig = crypto.sign('sha256', Buffer.from(data), { key: crypto.createPrivateKey({ key: jwk(), format: 'jwk' }), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${data}.${b64u(sig)}, k=${publicKey()}`;
}

let transport = (endpoint, headers, body) => new Promise(resolve => {
  const req = https.request(endpoint, { method: 'POST', headers: { ...headers, 'Content-Length': body.length }, timeout: 10000 }, res => { res.resume(); resolve(res.statusCode); });
  req.on('timeout', () => req.destroy()); req.on('error', () => resolve(0)); req.end(body);
});
// one notice to every phone; a phone that turned notices off (404/410) is forgotten
async function send(msg) {
  const s = load(); if (!s.subs.length) return { ok: false, reason: 'nophone' };
  const cut = (x, n) => String(x || '').replace(/\s+/g, ' ').slice(0, n);
  const text = JSON.stringify({ title: cut(msg.title, 120), body: cut(msg.body, 300), tag: cut(msg.tag, 80), url: msg.url ? String(msg.url).slice(0, 300) : '', badge: Number(msg.badge) || 0 });
  const out = await Promise.all(s.subs.map(async sub => ({ sub, code: await transport(sub.endpoint, { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high', Authorization: vapid(sub.endpoint) }, encrypt(text, sub)) })));
  const gone = out.filter(o => o.code === 404 || o.code === 410).map(o => o.sub.endpoint);
  if (gone.length) { s.subs = s.subs.filter(x => !gone.includes(x.endpoint)); save(); }
  const sent = out.filter(o => o.code >= 200 && o.code < 300).length;
  return { ok: sent > 0, sent, reason: sent ? undefined : gone.length ? 'gone' : 'net' };
}
function add(sub) {
  const c = clean(sub); if (!c) return { ok: false, reason: 'sub' };
  const s = load(); jwk(); s.subs = [...s.subs.filter(x => x.endpoint !== c.endpoint), c].slice(-MAX); save();
  return { ok: true, n: s.subs.length };
}
function clear() { const s = load(); s.subs = []; save(); return { ok: true }; }
const count = () => load().subs.length;
// the link the phone opens to turn notices on: the key and the way back travel in the #fragment, never sent to GitHub
const link = back => `${PAGE}#k=${publicKey()}&b=${encodeURIComponent(back)}`;

// what is new since the last look: someone needing you, a task asking permission, a task that finished or got stuck
let seen = null;
function changes(people, tasks, { pt = false } = {}) {
  const now = new Map(), need = people.filter(p => !p.leaving && ['needs_you', 'waiting'].includes(p.state)), asks = tasks.filter(t => t.ask);
  for (const p of need) now.set('p:' + p.id, { title: `${p.name} ${pt ? 'precisa de você' : 'needs you'}`, body: p.title || '', tag: 'p:' + p.id });
  for (const t of asks) now.set(`a:${t.id}:${t.ask.tool}:${t.ask.what || ''}`, { title: `🔐 ${t.title}`, body: pt ? `Pede permissão: ${t.ask.tool}` : `Asks permission: ${t.ask.tool}`, tag: 'a:' + t.id });
  for (const t of tasks) if (['done', 'failed', 'blocked'].includes(t.state)) now.set(`t:${t.id}:${t.state}`, { title: `${t.state === 'done' ? '✓' : '⚠'} ${t.title}`,
    body: pt ? { done: 'Tarefa concluída', failed: 'A tarefa falhou', blocked: 'A tarefa precisa de você' }[t.state] : { done: 'Task done', failed: 'The task failed', blocked: 'The task needs you' }[t.state], tag: 't:' + t.id });
  const fresh = seen ? [...now].filter(([k]) => !seen.has(k)).map(([, m]) => m) : []; // nothing for what was already true at start
  seen = new Set(now.keys());
  return { fresh: fresh.slice(0, 3), badge: need.length + asks.length };
}

module.exports = { PAGE, clean, encrypt, vapid, publicKey, send, add, clear, count, link, changes, _transport: f => { transport = f; }, _reset: () => { state = null; seen = null; } };
