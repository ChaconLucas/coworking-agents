'use strict';
// Builds a fake ~/.claude in a temp folder and checks what the collector reads from it.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync, spawn } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coworking-test-'));
const claude = path.join(root, '.claude');
process.env.CLAUDE_CONFIG_DIR = claude;
fs.mkdirSync(path.join(claude, 'sessions'), { recursive: true });
fs.mkdirSync(path.join(claude, 'projects', 'p'), { recursive: true });

// a git repo with a worktree: both resolve to the same repo, different checkouts
const repo = path.join(root, 'repo');
fs.mkdirSync(repo);
const git = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'ignore' });
git('init', '-q'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-qm', 'x');
git('worktree', 'add', '-q', path.join(root, 'wt'));

const now = Date.now();
const iso = ms => new Date(ms).toISOString();
const line = o => JSON.stringify(o) + '\n';

function session(pid, id, status, entries) {
  fs.writeFileSync(path.join(claude, 'sessions', pid + '.json'), JSON.stringify({ pid, sessionId: id, cwd: repo, startedAt: now - 1000, status, name: 'n' + pid, kind: 'interactive' }));
  fs.writeFileSync(path.join(claude, 'sessions', pid + '.abc.key'), '{"peerToken":"secret"}');
  fs.writeFileSync(path.join(claude, 'projects', 'p', id + '.jsonl'), entries.map(line).join(''));
}
const use = (id, name, input, ts) => ({ type: 'assistant', timestamp: iso(ts), cwd: repo, message: { model: 'claude-x', usage: { input_tokens: 1, cache_read_input_tokens: 1000 }, content: [{ type: 'tool_use', id, name, input }] } });
const result = (id, ts) => ({ type: 'user', timestamp: iso(ts), message: { content: [{ type: 'tool_result', tool_use_id: id }] } });

const pid = process.pid; // needs a live pid
// A: editing now, with a skill and an MCP used earlier
session(pid, 'A', 'busy', [
  { type: 'ai-title', aiTitle: 'Title A' },
  use('s1', 'Skill', { skill: 'impeccable' }, now - 9000), result('s1', now - 8900),
  use('m1', 'mcp__rea__inspect', {}, now - 8000), result('m1', now - 7900),
  use('e1', 'Edit', { file_path: path.join(repo, 'a.txt') }, now - 500),
]);
// B: finished its turn (pending cleared), edited in the worktree
session(1, 'B', 'idle', [
  use('e2', 'Write', { file_path: path.join(root, 'wt', 'b.txt') }, now - 4000),
  { type: 'system', subtype: 'turn_duration', timestamp: iso(now - 3000) },
]);
// C: question to the user pending; also edited in A's checkout
session(process.ppid, 'C', 'busy', [
  use('e3', 'Edit', { file_path: path.join(repo, 'c.txt') }, now - 6000), result('e3', now - 5900),
  use('q1', 'AskUserQuestion', {}, now - 100),
]);
// E: Bash stalled for 10s in auto mode; F: the same in default mode (both checked below)
const staleBash = id => [use('b' + id, 'Bash', { command: 'npm test' }, now - 10000)];
const permMode = m => ({ type: 'permission-mode', permissionMode: m });
// G: the registry still says "idle", but you just sent a message: the transcript wins
const sleepG = spawn('sleep', ['30']);
session(sleepG.pid, 'G', 'idle', [
  { type: 'system', subtype: 'turn_duration', timestamp: iso(now - 60000) },
  { type: 'user', timestamp: iso(now - 500), message: { content: 'new question' } },
]);
// I: asking you something while the registry already says idle → still "needs you"
const sleepI = spawn('sleep', ['30']);
session(sleepI.pid, 'I', 'idle', [{ type: 'user', timestamp: iso(now - 60000), message: { content: 'go' } }, use('qI', 'AskUserQuestion', { questions: [{ question: 'Pode?', options: [{ label: 'Sim' }, { label: 'Não' }] }] }, now - 40000)]);
fs.utimesSync(path.join(claude, 'projects', 'p', 'I.jsonl'), new Date(now - 40000), new Date(now - 40000));
// D: a dead process doesn't show up
session(999999, 'D', 'busy', []);

// Codex: one conversation from today running a command and another that edited the worktree (clashes with B)
const codex = path.join(root, '.codex');
process.env.CODEX_HOME = codex;
process.env.COWORKING_CODEX_RUNNING = '1';
const d = new Date(now);
const day = path.join(codex, 'sessions', String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0'));
fs.mkdirSync(day, { recursive: true });
fs.writeFileSync(path.join(codex, 'session_index.jsonl'), line({ id: 'X1', thread_name: 'Codex conversation' }));
fs.writeFileSync(path.join(codex, 'auth.json'), '{"token":"secret"}');
const ev = (type, payload, ts) => ({ type, timestamp: iso(ts), payload });
fs.writeFileSync(path.join(day, 'rollout-x1.jsonl'), [
  ev('session_meta', { id: 'X1', cwd: repo, cli_version: '0.1', originator: 'codex_cli', timestamp: iso(now - 9000) }, now - 9000),
  ev('event_msg', { type: 'task_started', model_context_window: 258400 }, now - 8000),
  ev('event_msg', { type: 'token_count', info: { last_token_usage: { input_tokens: 5000 } } }, now - 7000),
  ev('response_item', { type: 'function_call', name: 'exec_command', call_id: 'c1', arguments: JSON.stringify({ cmd: 'sed -n 1p ~/.codex/skills/imagegen/SKILL.md' }) }, now - 6000),
  ev('response_item', { type: 'function_call_output', call_id: 'c1' }, now - 5900),
  ev('response_item', { type: 'function_call', name: 'exec_command', call_id: 'c2', arguments: JSON.stringify({ cmd: 'npm test' }) }, now - 300),
].map(line).join(''));
fs.writeFileSync(path.join(day, 'rollout-x2.jsonl'), [
  ev('session_meta', { id: 'X2', cwd: path.join(root, 'wt'), timestamp: iso(now - 9000) }, now - 9000),
  ev('event_msg', { type: 'task_started' }, now - 8000),
  ev('response_item', { type: 'custom_tool_call', name: 'apply_patch', call_id: 'p1', input: '*** Begin Patch\n*** Update File: ' + path.join(root, 'wt', 'z.txt') + '\n' }, now - 7000),
  ev('response_item', { type: 'custom_tool_call_output', call_id: 'p1' }, now - 6900),
  ev('event_msg', { type: 'task_complete' }, now - 6000),
].map(line).join(''));

// extra live sessions using pids of child processes that sleep during the test
const sleepers = [spawn('sleep', ['30']), spawn('sleep', ['30'])];
session(sleepers[0].pid, 'E', 'busy', [permMode('auto'), ...staleBash('E')]);
session(sleepers[1].pid, 'F', 'busy', [permMode('default'), ...staleBash('F')]);
// the file only counts as "stalled" if untouched for more than 6s
for (const id of ['E', 'F']) { const f = path.join(claude, 'projects', 'p', id + '.jsonl'); fs.utimesSync(f, new Date(now - 10000), new Date(now - 10000)); }

// H: a "Claude" with a child shell spawned after the Bash request
// H's "Claude" process is an sh that spawns another sh (the command's) as its child
const shellH = spawn('/bin/sh', ['-c', '/bin/sh -c "sleep 20; : shell-snapshots"; :'], { stdio: 'ignore' });
execFileSync('sleep', ['0.3']);
session(shellH.pid, 'H', 'busy', [permMode('auto'), use('bH', 'Bash', { command: 'npm test' }, now - 9000)]);
fs.utimesSync(path.join(claude, 'projects', 'p', 'H.jsonl'), new Date(now - 9000), new Date(now - 9000));

// a fake "aider" running in a terminal: detected by process (tty needed, so only checked when we have one)
const fakeAider = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)', 'aider'], { stdio: 'ignore' });

const { snapshot } = require('../src/collect');
const s = snapshot();
const by = id => s.people.find(p => p.id === id);

assert.deepStrictEqual(s.people.filter(p => p.agent === 'claude').map(p => p.id).sort(), ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'I'].filter(id => id !== 'B' || by('B')).sort(), 'only live sessions');
// Codex
assert.strictEqual(by('X1').agent, 'codex');
assert.strictEqual(by('X1').title, 'Codex conversation');
assert.strictEqual(by('X1').state, 'terminal');
assert.strictEqual(by('X1').doing.what, 'npm test');
assert.deepStrictEqual({ ...by('X1').skills }, { imagegen: 1 });
assert.strictEqual(by('X1').ctx, 5000);
assert.strictEqual(by('X1').ctxMax, 258400);
assert.strictEqual(by('X2').state, 'idle', 'task_complete ends the turn');
assert.ok(s.credentials.codex, 'Codex credentials present');
assert.ok(!by('D'), 'dead pid is left out');
assert.strictEqual(by('A').state, 'edit');
assert.strictEqual(by('A').title, 'Title A');
assert.strictEqual(by('A').doing.what, 'a.txt');
assert.deepStrictEqual({ ...by('A').skills }, { impeccable: 1 });
assert.deepStrictEqual({ ...by('A').mcps }, { rea: 1 });
assert.strictEqual(by('A').ctx, 1001);
assert.strictEqual(by('A').usage.cacheRead, 3000, 'usage adds up every reply (3 replies of 1000 cached tokens)');
assert.ok(by('A').today && by('A').today.tools >= 2, 'today stats count tools');
assert.strictEqual(by('G').lastPrompt, 'new question', 'last prompt comes from the transcript');
assert.strictEqual(by('A').repo.name, 'repo');
assert.strictEqual(by('C').state, 'needs_you');
{ // process source: matching and dedupe work without a terminal too (tty filter skipped by checking the matcher directly)
  const { KNOWN } = require('../src/sources/process');
  const re = new RegExp(KNOWN.find(k => k.id === 'aider').match);
  assert.ok(re.test('node -e x aider') && !re.test('/usr/bin/aidermark'), 'aider matcher');
  assert.ok(new RegExp(KNOWN.find(k => k.id === 'gemini').match).test('/opt/homebrew/bin/gemini'), 'gemini matcher');
}
assert.strictEqual(by('I').state, 'needs_you', 'a pending question beats the registry saying idle');
assert.deepStrictEqual(by('I').doing.options.map(o => o.label), ['Sim', 'Não'], 'question options reach the screen');
assert.strictEqual(by('G').status, 'busy', 'a new message in the transcript beats the lagging registry');
assert.strictEqual(by('E').state, 'waiting', 'stalled Bash with no shell spawned = waiting for approval, even in auto mode');
assert.strictEqual(by('F').state, 'waiting', 'default mode: stalled Bash with no shell = waiting for approval');
assert.strictEqual(by('H').state, 'terminal', 'stalled Bash with a shell spawned after the request = command running');
if (by('B')) {
  assert.strictEqual(by('B').state, 'idle');
  assert.strictEqual(by('B').doing, null, 'ended turn clears the pending call');
  assert.strictEqual(by('B').editing[0].repo, 'repo', 'worktree resolves to the main repo');
}
// A and C edited the same checkout (Claude + Claude); B and X2 the worktree (Claude + Codex)
assert.deepStrictEqual(s.clashes.map(c => c.who.sort()).sort(), by('B') ? [['A', 'C'], ['B', 'X2']] : [['A', 'C']]);
// the .key is never read into the response
assert.ok(!JSON.stringify(s).includes('secret'));
// private mode hides titles and paths
const priv = snapshot({ privacy: true });
assert.ok(!JSON.stringify(priv).includes('Title A') && !JSON.stringify(priv).includes(repo));
assert.deepStrictEqual(priv.clashes.map(c => c.who.sort()).sort(), by('B') ? [['A', 'C'], ['B', 'X2']] : [['A', 'C']], 'hiding paths does not merge different checkouts');

// incremental read: a new line at the end changes the state
fs.appendFileSync(path.join(claude, 'projects', 'p', 'A.jsonl'), line(result('e1', now)));
assert.strictEqual(snapshot().people.find(p => p.id === 'A').state, 'thinking');

// the stylesheet must have balanced braces (one stray "@media {" silently breaks everything after it)
{
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const ch of css) { if (ch === '{') depth++; if (ch === '}') depth--; assert.ok(depth >= 0, 'style.css closes a brace it never opened'); }
  assert.strictEqual(depth, 0, 'style.css has an unclosed block');
}

// every UI string key exists in both languages (a stray comment once hid half a line of pt keys)
{
  const vm = require('vm'), box = { localStorage: { getItem: () => null, setItem() {} }, location: { search: '' }, navigator: { language: 'pt' }, URLSearchParams };
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'i18n.js'), 'utf8') + ';this.I18N = I18N;', box);
  const keys = o => Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? keys(v).map(x => k + '.' + x) : [k]).sort();
  const pt = keys(box.I18N.pt), en = keys(box.I18N.en);
  assert.deepStrictEqual(pt.filter(k => !en.includes(k)), [], 'keys only in pt');
  assert.deepStrictEqual(en.filter(k => !pt.includes(k)), [], 'keys only in en');
}

// the browser art module must load and export only real functions (node --check can't see a missing name)
{
  global.window = {}; global.document = { createElement: () => ({ getContext: () => ({}) }) };
  require('../public/art.js');
  const bad = Object.entries(window.Art).filter(([k, v]) => v === undefined).map(([k]) => k);
  assert.deepStrictEqual(bad, [], 'art.js exports undefined names');
  delete global.window; delete global.document;
}

// the front-end scripts: every one listed in index.html exists, no top-level name is declared twice
// (a SyntaxError across classic scripts) and they all load in order against a minimal fake DOM
{
  const pub = path.join(__dirname, '..', 'public');
  const srcs = [...fs.readFileSync(path.join(pub, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  assert.strictEqual(srcs[0], 'art.js', 'art.js loads first');
  assert.strictEqual(srcs[srcs.length - 1], 'js/main.js', 'main.js loads last');
  const code = srcs.map(s => [s, fs.readFileSync(path.join(pub, s), 'utf8')]);
  // top-level declarations start at column 0; `let a = 1, b = 2` declares every name before an `=`
  const seen = new Map();
  for (const [s, c] of code.slice(1)) for (const m of c.matchAll(/^(?:const|let|var|(?:async )?function|class)\s+(.*)$/gm)) {
    const decl = m[1].startsWith('{') ? m[1].slice(1, m[1].indexOf('}')).split(',').map(x => x.split(':').pop()) : /^[\w$]+\s*\(/.test(m[1]) ? [m[1]] : m[1].split(/,(?=\s*[\w$]+\s*=)/);
    for (const n of decl.map(x => x.trim().match(/^[\w$]+/)[0])) { assert.ok(!seen.has(n), `${n} declared in both ${seen.get(n)} and ${s}`); seen.set(n, s); }
  }
  const vm = require('vm');
  const el = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : ['clientWidth', 'width', 'height', 'length'].includes(k) ? 0 : k === 'children' ? [] : el(), set: () => true, apply: () => el(), construct: () => el() });
  const sandbox = { console, Map, Set, URLSearchParams, setTimeout, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, location: { search: '' }, navigator: { language: 'en' }, localStorage: { getItem: () => null, setItem() {} }, document: el(), EventSource: function () {}, CSS: { escape: s => s }, addEventListener() {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const [s, c] of code) vm.runInContext(c, sandbox, { filename: s });
  assert.strictEqual(vm.runInContext('typeof drawScene + typeof renderAll + typeof I18N.en.working', sandbox), 'functionfunctionstring', 'front-end scripts share their names');
}

// secrets in commands never show up
const { short } = require('../src/util');
assert.ok(!short('export GITHUB_TOKEN=ghp_abc123 && x').includes('ghp_abc123'));
assert.ok(!short('curl -H "Authorization: Bearer xyz.secret" x', 200).includes('xyz.secret'));
assert.strictEqual(short('npm test'), 'npm test');

// private mode: nothing that identifies a project, person or machine
const pv = snapshot({ privacy: true }), pvJson = JSON.stringify(pv);
assert.ok(pv.people.every(p => !p.branch && /^[a-z]+-\d+$/.test(p.name)), 'private: no branch or name');
assert.ok(!pvJson.includes('"repo":"repo"') && !pvJson.includes('impeccable') && !pvJson.includes('Codex conversation'), 'private: repo aliased, no skills, no titles');
assert.deepStrictEqual(pv.credentials, {});
assert.ok(pv.people.every(p => !p.lastPrompt && !p.lastReply), 'private: no prompt or reply text');

// update notice: only a strictly higher x.y.z counts; nothing is known until the CLI asks npm
const upd = require('../src/update');
assert.ok(upd.newer('0.2.0', '0.1.9') && upd.newer('1.0.0', '0.9.9') && upd.newer('0.1.10', '0.1.9'), 'newer versions');
assert.ok(!upd.newer('0.1.0', '0.1.0') && !upd.newer('0.0.9', '0.1.0') && !upd.newer('0.0.0-stage', '0.1.0') && !upd.newer('9.0.0-beta', '0.1.0'), 'same, older or pre-release is not newer');
assert.strictEqual(upd.updateInfo(), null, 'no update notice before a check');

// server: attempts to get in other than through the page itself
const http = require('http');
const { start } = require('../src/server');
function req(port, pathName, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path: pathName, method, headers: { Host: '127.0.0.1:' + port, ...headers } }, res => {
      let data = ''; res.on('data', c => { data += c; if (res.headers['content-type'] === 'text/event-stream') res.destroy(); });
      res.on('end', () => resolve({ code: res.statusCode, headers: res.headers, body: data }));
      res.on('close', () => resolve({ code: res.statusCode, headers: res.headers, body: data }));
    });
    r.on('error', reject); if (body) r.write(body); r.end();
  });
}

(async () => {
  const hq = await start({ port: 0 });
  const port = hq.server.address().port, ck = { Cookie: 'cw=' + hq.token };
  for (const pth of ['/api/state', '/api/report', '/events', '/js/main.js', '/']) assert.strictEqual((await req(port, pth)).code, 401, 'no token: ' + pth);
  assert.strictEqual((await req(port, '/?t=wrong')).code, 401, 'wrong token');
  const login = await req(port, '/?t=' + hq.token);
  assert.strictEqual(login.code, 302);
  assert.ok(/HttpOnly/.test(login.headers['set-cookie']) && /SameSite=Strict/.test(login.headers['set-cookie']), 'protected cookie');
  const ok = await req(port, '/api/state', { headers: ck });
  assert.strictEqual(ok.code, 200);
  assert.ok(JSON.parse(ok.body).people.length > 0);
  assert.strictEqual(JSON.parse(ok.body).update, null, 'the server never asks npm by itself');
  assert.strictEqual((await req(port, '/api/state', { headers: { ...ck, Host: 'evil.example:' + port } })).code, 421, 'DNS rebinding');
  assert.strictEqual((await req(port, '/api/focus', { method: 'POST', headers: ck, body: '{"id":"A"}' })).code, 403, 'focus without the custom header');
  assert.strictEqual((await req(port, '/api/focus', { method: 'POST', headers: { ...ck, 'X-Coworking': '1', Origin: 'https://evil.example' }, body: '{"id":"A"}' })).code, 403, 'focus from another origin');
  assert.strictEqual((await req(port, '/api/reply', { method: 'POST', headers: ck, body: '{"id":"B","text":"hi"}' })).code, 403, 'reply without the custom header');
  assert.strictEqual((await req(port, '/api/answer', { method: 'POST', headers: ck, body: '{"id":"I","choice":1}' })).code, 403, 'answer without the custom header');
  assert.strictEqual((await req(port, '/api/compact', { method: 'POST', headers: ck, body: '{"id":"B"}' })).code, 403, 'compact without the custom header');
  const compactBusy = JSON.parse((await req(port, '/api/compact', { method: 'POST', headers: { ...ck, 'X-Coworking': '1' }, body: '{"id":"A"}' })).body);
  assert.strictEqual(compactBusy.reason, 'busy', 'a working session is never compacted');
  const compactCodex = JSON.parse((await req(port, '/api/compact', { method: 'POST', headers: { ...ck, 'X-Coworking': '1' }, body: '{"id":"X2"}' })).body);
  assert.strictEqual(compactCodex.reason, 'unsupported', 'only Claude sessions take /compact');
  const badChoice = JSON.parse((await req(port, '/api/answer', { method: 'POST', headers: { ...ck, 'X-Coworking': '1' }, body: '{"id":"I","choice":7}' })).body);
  assert.strictEqual(badChoice.reason, 'text', 'an option number out of range is refused');
  const notAsking = JSON.parse((await req(port, '/api/answer', { method: 'POST', headers: { ...ck, 'X-Coworking': '1' }, body: '{"id":"A","choice":1}' })).body);
  assert.strictEqual(notAsking.reason, 'busy', 'a session not asking anything never gets an answer typed');
  assert.strictEqual((await req(port, '/api/reply', { method: 'POST', headers: { ...ck, 'X-Coworking': '1', Origin: 'https://evil.example' }, body: '{"id":"B","text":"hi"}' })).code, 403, 'reply from another origin');
  assert.strictEqual((await req(port, '/api/reply', { method: 'POST', headers: { Host: '127.0.0.1:' + port, 'X-Coworking': '1' }, body: '{"id":"B","text":"hi"}' })).code, 401, 'reply without the token');
  const busy = JSON.parse((await req(port, '/api/reply', { method: 'POST', headers: { ...ck, 'X-Coworking': '1' }, body: '{"id":"A","text":"hi"}' })).body);
  assert.deepStrictEqual(busy, { ok: false, reason: 'busy' }, 'a working session never receives typed text');
  assert.ok([403, 404].includes((await req(port, '/../src/server.js', { headers: ck })).code), 'path traversal');
  assert.ok([403, 404].includes((await req(port, '/%2e%2e/package.json', { headers: ck })).code), 'encoded path traversal');
  const csp = (await req(port, '/', { headers: ck })).headers['content-security-policy'] || '';
  assert.ok(/default-src 'self'/.test(csp) && !/googleapis/.test(csp), 'CSP local only');
  hq.close();

  // reply safeguards: only Claude sessions, and only when Claude owns a real terminal tab
  const { sendText } = require('../src/focus');
  assert.strictEqual((await sendText({ agent: 'codex', pid: 1 }, 'hi')).reason, process.platform === 'darwin' ? 'unsupported' : 'platform');
  if (process.platform === 'darwin') {
    assert.strictEqual((await sendText({ agent: 'claude', pid: sleepers[0].pid }, 'hi')).reason, 'notty', 'a process without a terminal never receives text');
    assert.strictEqual((await sendText({ agent: 'claude', pid: sleepers[0].pid }, '')).reason, 'text', 'empty text is refused');
  }

  fakeAider.kill(); sleepers.forEach(p => p.kill()); sleepG.kill(); shellH.kill(); sleepI.kill();
  fs.rmSync(root, { recursive: true, force: true });
  console.log('ok — ' + (by('B') ? 'all checks' : 'all checks (pid 1 not visible, B skipped)'));
})().catch(e => { console.error(e); process.exit(1); });
