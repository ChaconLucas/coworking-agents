'use strict';
// Escritório de mentira para `--demo`: mostra todos os estados sem precisar de sessões reais.

const STATES = ['edit', 'terminal', 'needs_you', 'read', 'web', 'delegate', 'idle', 'waiting', 'thinking', 'asleep'];
const TITLES = ['Refactor checkout flow', 'Fix flaky CI test', 'Migrate auth to OAuth', 'Write release notes', 'Investigate slow query', 'Add dark mode', 'Port profile page', 'Review PR #482', 'Bump dependencies', 'Explain the codebase'];
const REPOS = ['web-app', 'web-app', 'api', 'docs', 'api', 'design-system', 'mobile', 'web-app', 'infra', 'api'];
const WHAT = { edit: 'Checkout.tsx', terminal: 'Run test suite', read: 'schema.sql', web: 'developer.mozilla.org', delegate: 'Map all call sites', needs_you: '', waiting: 'npm run build', thinking: '' };
const TOOL = { edit: 'Edit', terminal: 'Bash', read: 'Read', web: 'WebFetch', delegate: 'Agent', needs_you: 'AskUserQuestion', waiting: 'Bash' };

function demoSnapshot() {
  const now = Date.now();
  const people = STATES.map((state, i) => {
    const busy = !['idle', 'asleep'].includes(state);
    const doing = TOOL[state] ? { tool: TOOL[state], what: WHAT[state] || '', kind: state === 'needs_you' ? 'ask' : state === 'waiting' ? 'terminal' : state, for: state === 'waiting' ? 42000 : 3000 } : null;
    return {
      id: `demo-${i}-${TITLES[i]}`, name: ['ada', 'grace', 'linus', 'alan', 'margaret', 'ken', 'barbara', 'dennis', 'radia', 'guido'][i],
      pid: 1000 + i, kind: 'interactive', entrypoint: 'cli', version: 'demo', status: busy ? 'busy' : 'idle', state,
      since: now - (state === 'asleep' ? 3 * 36e5 : 4 * 6e4), startedAt: now - (i + 1) * 3.1 * 36e5,
      title: TITLES[i], cwd: `/home/dev/${REPOS[i]}`, branch: i % 3 ? 'main' : `feat/${REPOS[i]}-${i}`,
      repo: { name: REPOS[i], path: `/home/dev/${REPOS[i]}`, worktree: `/home/dev/${REPOS[i]}`, isWorktree: false },
      model: 'claude-opus-5-5', ctx: [42e3, 180e3, 610e3, 95e3, 320e3, 150e3, 88e3, 240e3, 30e3, 12e3][i], turns: [12, 64, 30, 8, 51, 22, 5, 70, 3, 1][i],
      doing, recent: doing ? [{ tool: doing.tool, what: doing.what, kind: doing.kind, ts: now - 3000 }, { tool: 'Read', what: 'README.md', kind: 'read', ts: now - 60000 }] : [],
      skills: i === 0 ? { 'frontend-design': 3, simplify: 1 } : i === 4 ? { 'web-research': 2 } : i === 2 ? { 'code-review': 1 } : {},
      mcps: i === 4 ? { playwright: 6 } : i === 1 ? { github: 4 } : {},
      tools: { Bash: [20, 120, 8, 4, 30, 10, 3, 60, 1, 0][i], Edit: [80, 12, 40, 2, 5, 9, 0, 20, 0, 0][i], WebSearch: i === 4 ? 3 : 0, Agent: i === 5 ? 3 : 0 },
      editing: i === 0 || i === 7 ? [{ worktree: '/home/dev/web-app', repo: 'web-app', at: now - 60000 }] : [],
      subagents: i === 5 ? [
        { id: 'a1', type: 'Explore', description: 'Map all call sites', state: 'read', doing: 'Grep useCart' },
        { id: 'a2', type: 'Explore', description: 'Find tests', state: 'terminal', doing: 'Run vitest' },
        { id: 'a3', type: 'Plan', description: 'Plan migration', state: 'thinking', doing: '' },
      ] : [],
      lastActivity: now - 2000,
    };
  });
  return {
    now, host: 'demo', people,
    clashes: [{ worktree: '/home/dev/web-app', repo: 'web-app', who: [people[0].id, people[7].id] }],
    credentials: {
      topSkills: [{ name: 'frontend-design', count: 41 }, { name: 'code-review', count: 17 }, { name: 'simplify', count: 9 }],
      skills: ['frontend-design', 'code-review', 'simplify', 'web-research'], mcps: ['playwright', 'github'],
      plugins: [{ name: 'code-review', count: 17 }],
    },
  };
}

module.exports = { demoSnapshot };
