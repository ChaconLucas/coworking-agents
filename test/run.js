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

const { snapshot } = require('../src/collect');
const s = snapshot();
const by = id => s.people.find(p => p.id === id);

assert.deepStrictEqual(s.people.filter(p => p.agent === 'claude').map(p => p.id).sort(), ['A', 'B', 'C', 'E', 'F', 'G', 'H'].filter(id => id !== 'B' || by('B')).sort(), 'only live sessions');
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
assert.ok(by('A').today && by('A').today.tools >= 2, 'today stats count tools');
assert.strictEqual(by('G').lastPrompt, 'new question', 'last prompt comes from the transcript');
assert.strictEqual(by('A').repo.name, 'repo');
assert.strictEqual(by('C').state, 'needs_you');
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

// secrets in commands never show up
const { short } = require('../src/util');
assert.ok(!short('export GITHUB_TOKEN=ghp_abc123 && x').includes('ghp_abc123'));
assert.ok(!short('curl -H "Authorization: Bearer xyz.secret" x', 200).includes('xyz.secret'));
assert.strictEqual(short('npm test'), 'npm test');

// private mode: nothing that identifies a project, person or machine
const pv = snapshot({ privacy: true }), pvJson = JSON.stringify(pv);
assert.ok(pv.people.every(p => !p.branch && /^(claude|codex)-\d+$/.test(p.name)), 'private: no branch or name');
assert.ok(!pvJson.includes('"repo":"repo"') && !pvJson.includes('impeccable') && !pvJson.includes('Codex conversation'), 'private: repo aliased, no skills, no titles');
assert.deepStrictEqual(pv.credentials, {});
assert.ok(pv.people.every(p => !p.lastPrompt && !p.lastReply), 'private: no prompt or reply text');

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
  for (const pth of ['/api/state', '/api/report', '/events', '/app.js', '/']) assert.strictEqual((await req(port, pth)).code, 401, 'no token: ' + pth);
  assert.strictEqual((await req(port, '/?t=wrong')).code, 401, 'wrong token');
  const login = await req(port, '/?t=' + hq.token);
  assert.strictEqual(login.code, 302);
  assert.ok(/HttpOnly/.test(login.headers['set-cookie']) && /SameSite=Strict/.test(login.headers['set-cookie']), 'protected cookie');
  const ok = await req(port, '/api/state', { headers: ck });
  assert.strictEqual(ok.code, 200);
  assert.ok(JSON.parse(ok.body).people.length > 0);
  assert.strictEqual((await req(port, '/api/state', { headers: { ...ck, Host: 'evil.example:' + port } })).code, 421, 'DNS rebinding');
  assert.strictEqual((await req(port, '/api/focus', { method: 'POST', headers: ck, body: '{"id":"A"}' })).code, 403, 'focus without the custom header');
  assert.strictEqual((await req(port, '/api/focus', { method: 'POST', headers: { ...ck, 'X-Coworking': '1', Origin: 'https://evil.example' }, body: '{"id":"A"}' })).code, 403, 'focus from another origin');
  assert.ok([403, 404].includes((await req(port, '/../src/server.js', { headers: ck })).code), 'path traversal');
  assert.ok([403, 404].includes((await req(port, '/%2e%2e/package.json', { headers: ck })).code), 'encoded path traversal');
  const csp = (await req(port, '/', { headers: ck })).headers['content-security-policy'] || '';
  assert.ok(/default-src 'self'/.test(csp) && !/googleapis/.test(csp), 'CSP local only');
  hq.close();

  sleepers.forEach(p => p.kill()); sleepG.kill(); shellH.kill();
  fs.rmSync(root, { recursive: true, force: true });
  console.log('ok — ' + (by('B') ? 'all checks' : 'all checks (pid 1 not visible, B skipped)'));
})().catch(e => { console.error(e); process.exit(1); });
