'use strict';
// Fake office for `--demo`: shows every state without needing real sessions.

const STATES = ['edit', 'terminal', 'needs_you', 'read', 'web', 'delegate', 'idle', 'waiting', 'thinking', 'asleep'];
const TITLES = ['Refactor checkout flow', 'Fix flaky CI test', 'Migrate auth to OAuth', 'Write release notes', 'Investigate slow query', 'Add dark mode', 'Port profile page', 'Review PR #482', 'Bump dependencies', 'Explain the codebase'];
const REPOS = ['web-app', 'web-app', 'api', 'docs', 'api', 'design-system', 'mobile', 'web-app', 'infra', 'api'];
const WHAT = { edit: 'Checkout.tsx', terminal: 'Run test suite', read: 'schema.sql', web: 'developer.mozilla.org', delegate: 'Map all call sites', needs_you: '', waiting: 'npm run build', thinking: '' };
const TOOL = { edit: 'Edit', terminal: 'Bash', read: 'Read', web: 'WebFetch', delegate: 'Agent', needs_you: 'AskUserQuestion', waiting: 'Bash' };

function demoSnapshot() {
  const COUNT = Math.max(1, Math.min(500, Number(process.env.COWORKING_DEMO_COUNT) || 10)); // read per call: `--demo N` sets it after require
  const now = Date.now();
  // a living demo: each fake agent moves to its next state on its own rhythm (9–21s), so requests
  // arrive, people walk to the lounge and back, answered ones play the happy exit — no real sessions, no tokens
  const live = process.env.COWORKING_DEMO_STATIC !== '1';
  const people = Array.from({ length: COUNT }, (_, i) => {
    if (!live) return { state: STATES[i % STATES.length], since: 0, i };
    const period = 9000 + (i * 2371) % 12000, step = Math.floor((now + i * 1337) / period);
    return { state: STATES[(i + step) % STATES.length], since: step * period - i * 1337, i };
  }).map(({ state, since: stepStart }, i) => {
    const busy = !['idle', 'asleep'].includes(state);
    const forMs = stepStart ? now - stepStart : state === 'waiting' ? 42000 : 3000;
    const doing = TOOL[state] ? { tool: TOOL[state], what: WHAT[state] || '', kind: state === 'needs_you' ? 'ask' : state === 'waiting' ? 'terminal' : state, for: forMs } : null;
    const agent = [1, 4, 8].includes(i) ? 'codex' : 'claude';
    return {
      agent, ctxMax: agent === 'codex' ? 258400 : 0,
      id: `demo-${i}-${TITLES[i % TITLES.length]}`, name: ['ada', 'grace', 'linus', 'alan', 'margaret', 'ken', 'barbara', 'dennis', 'radia', 'guido'][i % 10] + (i >= 10 ? '-' + ((i / 10) | 0) : ''),
      pid: 1000 + i, kind: 'interactive', entrypoint: 'cli', version: 'demo', status: busy ? 'busy' : 'idle', state,
      since: stepStart || now - (state === 'asleep' ? 3 * 36e5 : 4 * 6e4), startedAt: now - (i + 1) * 3.1 * 36e5,
      title: TITLES[i % TITLES.length], cwd: `/home/dev/${REPOS[i % REPOS.length]}`, branch: i % 3 ? 'main' : `feat/${REPOS[i % REPOS.length]}-${i}`,
      repo: { name: REPOS[i % REPOS.length], path: `/home/dev/${REPOS[i % REPOS.length]}`, worktree: `/home/dev/${REPOS[i % REPOS.length]}`, isWorktree: false },
      model: agent === 'codex' ? 'gpt-5.5' : 'claude-opus-5-5', ctx: [42e3, 180e3, 610e3, 95e3, 320e3, 150e3, 88e3, 240e3, 30e3, 12e3][i % 10], turns: [12, 64, 30, 8, 51, 22, 5, 70, 3, 1][i % 10],
      doing, recent: doing ? [{ tool: doing.tool, what: doing.what, kind: doing.kind, ts: now - 3000 }, { tool: 'Read', what: 'README.md', kind: 'read', ts: now - 60000 }] : [],
      skills: i === 0 ? { 'frontend-design': 3, simplify: 1 } : i === 4 ? { 'web-research': 2 } : i === 2 ? { 'code-review': 1 } : {},
      mcps: i === 4 ? { playwright: 6 } : i === 1 ? { github: 4 } : {},
      tools: { Bash: [20, 120, 8, 4, 30, 10, 3, 60, 1, 0][i % 10], Edit: [80, 12, 40, 2, 5, 9, 0, 20, 0, 0][i % 10], WebSearch: i === 4 ? 3 : 0, Agent: i === 5 ? 3 : 0 },
      editing: i === 0 || i === 7 ? [{ worktree: '/home/dev/web-app', repo: 'web-app', at: now - 60000 }] : [],
      subagents: state === 'delegate' ? [
        { id: 'a1', type: 'Explore', description: 'Map all call sites', state: 'read', doing: 'Grep useCart' },
        { id: 'a2', type: 'Explore', description: 'Find tests', state: 'terminal', doing: 'Run vitest' },
        { id: 'a3', type: 'Plan', description: 'Plan migration', state: 'thinking', doing: '' },
      ] : [],
      lastActivity: now - 2000,
    };
  });
  // every 30s someone new joins (fresh id, so the office builds a desk and they walk in with their computer)
  if (live) {
    const cycle = Math.floor(now / 30000);
    if (cycle % 2) {
      const base = people[0];
      people.push({ ...base, id: `demo-new-${cycle}`, name: 'newbie-' + (cycle % 100), title: 'Just joined: set up the project', state: 'edit', status: 'busy',
        repo: { name: 'new-service', path: '/home/dev/new-service', worktree: '/home/dev/new-service', isWorktree: false }, cwd: '/home/dev/new-service',
        startedAt: cycle * 30000, since: cycle * 30000, subagents: [], editing: [], files: [], skills: {}, mcps: {}, tools: { Edit: 1 },
        doing: { tool: 'Edit', what: 'package.json', kind: 'edit', for: now - cycle * 30000 } });
    }
  }
  return {
    now, host: 'demo', people,
    clashes: [{ worktree: '/home/dev/web-app', repo: 'web-app', who: [people[0].id, people[7].id] }],
    agents: [{ id: 'claude', label: 'Claude Code', sessions: 7 }, { id: 'codex', label: 'Codex', sessions: 3 }],
    credentials: {
      claude: {
        topSkills: [{ name: 'frontend-design', count: 41 }, { name: 'code-review', count: 17 }, { name: 'simplify', count: 9 }],
        skills: ['frontend-design', 'code-review', 'simplify', 'web-research'], mcps: ['playwright', 'github'],
        plugins: [{ name: 'code-review', count: 17 }],
      },
      codex: { topSkills: [], skills: ['imagegen', 'openai-docs', 'skill-creator'], mcps: [], plugins: [] },
    },
  };
}

function demoReport() {
  const now = Date.now(), d = new Date(now), since = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const rows = demoSnapshot().people.map((p, i) => ({ agent: p.agent, id: p.id, name: p.name, live: true, title: p.title, repo: p.repo.name, activeMs: (10 - (i % 10)) * 23 * 60000, tools: 40 + i * 7, turns: 3 + i, files: i % 6, outTokens: 20000 + i * 3100 }));
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  return { since, now, rows, topFiles: [{ repo: 'web-app', rel: 'src/Checkout.tsx', n: 2 }, { repo: 'api', rel: 'auth/oauth.ts', n: 1 }], totals: { sessions: rows.length, activeMs: sum('activeMs'), tools: sum('tools'), files: 9, outTokens: sum('outTokens'), turns: sum('turns') } };
}

module.exports = { demoSnapshot, demoReport };
