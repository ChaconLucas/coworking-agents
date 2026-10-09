'use strict';
// Monta um ~/.claude falso numa pasta temporária e confere o que o coletor lê dele.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claudehq-test-'));
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
// D: processo morto não aparece
session(999999, 'D', 'busy', []);

const { snapshot } = require('../src/collect');
const s = snapshot();
const by = id => s.people.find(p => p.id === id);

assert.deepStrictEqual(s.people.map(p => p.id).sort(), ['A', 'B', 'C'].filter(id => id !== 'B' || by('B')).sort(), 'só sessões vivas');
assert.ok(!by('D'), 'pid morto fica de fora');
assert.strictEqual(by('A').state, 'edit');
assert.strictEqual(by('A').title, 'Título A');
assert.strictEqual(by('A').doing.what, 'a.txt');
assert.deepStrictEqual(by('A').skills, { impeccable: 1 });
assert.deepStrictEqual(by('A').mcps, { rea: 1 });
assert.strictEqual(by('A').ctx, 1001);
assert.strictEqual(by('A').repo.name, 'repo');
assert.strictEqual(by('C').state, 'needs_you');
if (by('B')) {
  assert.strictEqual(by('B').state, 'idle');
  assert.strictEqual(by('B').doing, null, 'turno encerrado limpa a pendência');
  assert.strictEqual(by('B').editing[0].repo, 'repo', 'worktree resolve para o repo principal');
}
// A e C editaram o mesmo checkout; B editou outra worktree do mesmo repo e não conta
assert.strictEqual(s.clashes.length, 1);
assert.deepStrictEqual(s.clashes[0].who.sort(), ['A', 'C']);
// a .key nunca é lida para a resposta
assert.ok(!JSON.stringify(s).includes('secret'));
// modo privado esconde títulos e caminhos
const priv = snapshot({ privacy: true });
assert.ok(!JSON.stringify(priv).includes('Título A') && !JSON.stringify(priv).includes(repo));
assert.deepStrictEqual(priv.clashes.map(c => c.who.sort()), [['A', 'C']], 'esconder caminhos não junta checkouts diferentes');

// leitura incremental: linha nova no fim muda o estado
fs.appendFileSync(path.join(claude, 'projects', 'p', 'A.jsonl'), line(result('e1', now)));
assert.strictEqual(snapshot().people.find(p => p.id === 'A').state, 'thinking');

fs.rmSync(root, { recursive: true, force: true });
console.log('ok — ' + (by('B') ? 'all checks' : 'all checks (pid 1 not visible, B skipped)'));
