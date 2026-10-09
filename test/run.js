'use strict';
// Monta um ~/.claude falso numa pasta temporária e confere o que o coletor lê dele.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync, spawn } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coworks-test-'));
const claude = path.join(root, '.claude');
process.env.CLAUDE_CONFIG_DIR = claude;
fs.mkdirSync(path.join(claude, 'sessions'), { recursive: true });
fs.mkdirSync(path.join(claude, 'projects', 'p'), { recursive: true });

// um repo git com uma worktree: as duas resolvem para o mesmo repo, checkouts diferentes
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

const pid = process.pid; // precisa de um pid vivo
// A: editando agora, com skill e MCP usados antes
session(pid, 'A', 'busy', [
  { type: 'ai-title', aiTitle: 'Título A' },
  use('s1', 'Skill', { skill: 'impeccable' }, now - 9000), result('s1', now - 8900),
  use('m1', 'mcp__rea__inspect', {}, now - 8000), result('m1', now - 7900),
  use('e1', 'Edit', { file_path: path.join(repo, 'a.txt') }, now - 500),
]);
// B: terminou o turno (pendência limpa), editou na worktree
session(1, 'B', 'idle', [
  use('e2', 'Write', { file_path: path.join(root, 'wt', 'b.txt') }, now - 4000),
  { type: 'system', subtype: 'turn_duration', timestamp: iso(now - 3000) },
]);
// C: pergunta para o usuário pendente; e editou no mesmo checkout de A
session(process.ppid, 'C', 'busy', [
  use('e3', 'Edit', { file_path: path.join(repo, 'c.txt') }, now - 6000), result('e3', now - 5900),
  use('q1', 'AskUserQuestion', {}, now - 100),
]);
// E: Bash parado há 10s em modo auto continua "terminal"; F: o mesmo em modo default vira "waiting"
const staleBash = id => [use('b' + id, 'Bash', { command: 'npm test' }, now - 10000)];
const permMode = m => ({ type: 'permission-mode', permissionMode: m });
// G: o registro ainda diz "idle", mas você acabou de mandar mensagem: o transcrito manda
const sleepG = spawn('sleep', ['30']);
session(sleepG.pid, 'G', 'idle', [
  { type: 'system', subtype: 'turn_duration', timestamp: iso(now - 60000) },
  { type: 'user', timestamp: iso(now - 500), message: { content: 'nova pergunta' } },
]);
// D: processo morto não aparece
session(999999, 'D', 'busy', []);

// Codex: uma conversa de hoje rodando um comando e outra que editou a worktree (choca com B)
const codex = path.join(root, '.codex');
process.env.CODEX_HOME = codex;
process.env.COWORKS_CODEX_RUNNING = '1';
const d = new Date(now);
const day = path.join(codex, 'sessions', String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0'));
fs.mkdirSync(day, { recursive: true });
fs.writeFileSync(path.join(codex, 'session_index.jsonl'), line({ id: 'X1', thread_name: 'Conversa do Codex' }));
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

// sessões vivas extra usando pids de processos-filho que ficam a dormir durante o teste
const sleepers = [spawn('sleep', ['30']), spawn('sleep', ['30'])];
session(sleepers[0].pid, 'E', 'busy', [permMode('auto'), ...staleBash('E')]);
session(sleepers[1].pid, 'F', 'busy', [permMode('default'), ...staleBash('F')]);
// o ficheiro só conta como "parado" se não mexeu há mais de 6s
for (const id of ['E', 'F']) { const f = path.join(claude, 'projects', 'p', id + '.jsonl'); fs.utimesSync(f, new Date(now - 10000), new Date(now - 10000)); }

// H: um "Claude" (este processo de teste) com um shell filho aberto depois do pedido do Bash
// o processo "Claude" de H é um sh que abre outro sh (o do comando) como filho
const shellH = spawn('/bin/sh', ['-c', '/bin/sh -c "sleep 20; : shell-snapshots"; :'], { stdio: 'ignore' });
execFileSync('sleep', ['0.3']);
session(shellH.pid, 'H', 'busy', [permMode('auto'), use('bH', 'Bash', { command: 'npm test' }, now - 9000)]);
fs.utimesSync(path.join(claude, 'projects', 'p', 'H.jsonl'), new Date(now - 9000), new Date(now - 9000));

const { snapshot } = require('../src/collect');
const s = snapshot();
const by = id => s.people.find(p => p.id === id);

assert.deepStrictEqual(s.people.filter(p => p.agent === 'claude').map(p => p.id).sort(), ['A', 'B', 'C', 'E', 'F', 'G', 'H'].filter(id => id !== 'B' || by('B')).sort(), 'só sessões vivas');
// Codex
assert.strictEqual(by('X1').agent, 'codex');
assert.strictEqual(by('X1').title, 'Conversa do Codex');
assert.strictEqual(by('X1').state, 'terminal');
assert.strictEqual(by('X1').doing.what, 'npm test');
assert.deepStrictEqual(by('X1').skills, { imagegen: 1 });
assert.strictEqual(by('X1').ctx, 5000);
assert.strictEqual(by('X1').ctxMax, 258400);
assert.strictEqual(by('X2').state, 'idle', 'task_complete encerra o turno');
assert.ok(s.credentials.codex, 'credenciais do Codex presentes');
assert.ok(!by('D'), 'pid morto fica de fora');
assert.strictEqual(by('A').state, 'edit');
assert.strictEqual(by('A').title, 'Título A');
assert.strictEqual(by('A').doing.what, 'a.txt');
assert.deepStrictEqual(by('A').skills, { impeccable: 1 });
assert.deepStrictEqual(by('A').mcps, { rea: 1 });
assert.strictEqual(by('A').ctx, 1001);
assert.strictEqual(by('A').repo.name, 'repo');
assert.strictEqual(by('C').state, 'needs_you');
assert.strictEqual(by('G').status, 'busy', 'mensagem nova no transcrito vence o registro atrasado');
assert.strictEqual(by('E').state, 'waiting', 'Bash parado sem shell aberto = esperando aprovação, mesmo em modo auto');
assert.strictEqual(by('F').state, 'waiting', 'modo default: Bash parado sem shell = esperando aprovação');
assert.strictEqual(by('H').state, 'terminal', 'Bash parado com shell aberto depois do pedido = comando a correr');
if (by('B')) {
  assert.strictEqual(by('B').state, 'idle');
  assert.strictEqual(by('B').doing, null, 'turno encerrado limpa a pendência');
  assert.strictEqual(by('B').editing[0].repo, 'repo', 'worktree resolve para o repo principal');
}
// A e C editaram o mesmo checkout; B editou outra worktree do mesmo repo e não conta
// A e C no mesmo checkout (Claude + Claude); B e X2 na worktree (Claude + Codex)
assert.deepStrictEqual(s.clashes.map(c => c.who.sort()).sort(), by('B') ? [['A', 'C'], ['B', 'X2']] : [['A', 'C']]);
// a .key nunca é lida para a resposta
assert.ok(!JSON.stringify(s).includes('secret'));
// modo privado esconde títulos e caminhos
const priv = snapshot({ privacy: true });
assert.ok(!JSON.stringify(priv).includes('Título A') && !JSON.stringify(priv).includes(repo));
assert.deepStrictEqual(priv.clashes.map(c => c.who.sort()).sort(), by('B') ? [['A', 'C'], ['B', 'X2']] : [['A', 'C']], 'esconder caminhos não junta checkouts diferentes');

// leitura incremental: linha nova no fim muda o estado
fs.appendFileSync(path.join(claude, 'projects', 'p', 'A.jsonl'), line(result('e1', now)));
assert.strictEqual(snapshot().people.find(p => p.id === 'A').state, 'thinking');

sleepers.forEach(p => p.kill()); sleepG.kill(); shellH.kill();
fs.rmSync(root, { recursive: true, force: true });
console.log('ok — ' + (by('B') ? 'all checks' : 'all checks (pid 1 not visible, B skipped)'));
