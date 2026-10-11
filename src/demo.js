'use strict';
const { costOf } = require('./prices');
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
      agent, ctxMax: agent === 'codex' ? 258400 : 1e6,
      id: `demo-${i}-${TITLES[i % TITLES.length]}`, name: ['ada', 'grace', 'linus', 'alan', 'margaret', 'ken', 'barbara', 'dennis', 'radia', 'guido'][i % 10] + (i >= 10 ? '-' + ((i / 10) | 0) : ''),
      pid: 1000 + i, kind: 'interactive', entrypoint: 'cli', version: 'demo', status: busy ? 'busy' : 'idle', state,
      since: stepStart || now - (state === 'asleep' ? 3 * 36e5 : 4 * 6e4), startedAt: now - (i + 1) * 3.1 * 36e5,
      title: TITLES[i % TITLES.length], cwd: `/home/dev/${REPOS[i % REPOS.length]}`, branch: i % 3 ? 'main' : `feat/${REPOS[i % REPOS.length]}-${i}`,
      repo: { name: REPOS[i % REPOS.length], path: `/home/dev/${REPOS[i % REPOS.length]}`, worktree: `/home/dev/${REPOS[i % REPOS.length]}`, isWorktree: false },
      model: agent === 'codex' ? 'gpt-5.5' : 'claude-opus-5-5', ctx: [42e3, 180e3, 810e3, 95e3, 320e3, 150e3, 88e3, 240e3, 30e3, 12e3][i % 10], turns: [12, 64, 30, 8, 51, 22, 5, 70, 3, 1][i % 10],
      git: [{ dirty: 3, ahead: 2, behind: 0, upstream: true }, null, { dirty: 0, ahead: 0, behind: 1, upstream: true }, { dirty: 12, ahead: 0, behind: 0, upstream: false }][i % 4],
      usage: { input: 4e4 * (i + 1), output: 9e4 * (i + 2), cacheRead: 6e6 * (i + 1), cacheWrite: 4e5 * (i + 1) },
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
  for (const p of people) if (p.usage && !p.cost) p.cost = { usd: costOf(p.model, p.usage) || 0, partial: false };
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

function demoUsage() {
  const byDay = {}, now = Date.now();
  for (let i = 0; i < 14; i++) { const d = new Date(now - i * 864e5), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); byDay[k] = { input: 2e4, output: 4e5 + (i * 7919) % 9e5, cacheRead: 3e8, cacheWrite: 2e6 }; }
  const agent = (k, models) => ({ sessions: 40, total: { input: 3e5, output: 9e6 * k, cacheRead: 6e9 * k, cacheWrite: 5e7 * k }, byDay, byModel: Object.fromEntries(models.map((m, i) => [m, { input: 1e5, output: 3e6 / (i + 1), cacheRead: 2e9, cacheWrite: 1e7 }])) });
  const byAgent = { claude: agent(1, ['claude-opus-5-5', 'claude-sonnet-5']), codex: agent(.2, ['gpt-5.5']) };
  for (const o of Object.values(byAgent)) {
    o.costByModel = Object.fromEntries(Object.entries(o.byModel).map(([m, u]) => [m, costOf(m, u)]));
    o.cost = { usd: Object.values(o.costByModel).reduce((a, b) => a + b, 0), unpricedModels: [] };
  }
  const days = {};
  for (let i = 0; i < 40; i++) {
    const d = new Date(now - i * 864e5), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const first = new Date(d.getFullYear(), d.getMonth(), d.getDate(), i % 9 === 0 ? 2 : 9).getTime();
    if (i % 11 !== 10) { const tools = 300 + (i * 97) % 900, act = (3 + (i * 7) % 9) * 36e5;
      days[k] = { tools, activeMs: act, sessions: 4, agents: i % 3 ? ['claude'] : ['claude', 'codex'], first, last: first + 8 * 36e5, output: 4e5, usd: 18 + (i * 13) % 40,
        byAgent: { claude: { activeMs: act * .7, tools: Math.round(tools * .7), output: 3e5, usd: act / 36e5 * 2.1 }, codex: { activeMs: act * .3, tools: Math.round(tools * .3), output: 1e5, usd: act / 36e5 * .6 } } }; }
  }
  const ppl = demoSnapshot().people;
  const top = ppl.slice(0, 5).map((p, i) => ({ id: p.id, agent: p.agent, title: p.title, activeMs: (40 - i * 7) * 36e5, tools: 2400 - i * 380, output: 3e6 - i * 4e5, last: now }));
  return { scanning: false, scannedAt: now, byAgent, days, month: { key: Object.keys(days)[0].slice(0, 7), top, costly: top.map((m, i) => ({ id: m.id, agent: m.agent, title: m.title, usd: [41.2, 22.7, 13.9, 6.4, 2.1][i] || 1 })) } };
}

// a few tasks in every state, for the Tasks tab in --demo (nothing runs)
function demoTasks() {
  const n = Date.now(), base = { dir: '/Users/you/code/shop', cwd: '/Users/you/code/shop', perm: 'acceptEdits', budget: 2, testCmd: 'npm test', worktree: true, dependsOn: '', from: '', sessionId: '', tokens: { input: 52000, output: 8100, cacheRead: 410000, cacheWrite: 30000 }, turns: 6, result: '', files: [], denials: [], allowed: [], configLog: [], reason: '' };
  return [
    { ...base, id: 'demo1', sessionId: 'demo-0-Refactor checkout flow', running: { model: 'opus', effort: 'high', at: n - 9e5 }, byModel: { 'claude-opus-5-5': { usd: 1.42, input: 52000, output: 8100, cacheRead: 410000, cacheWrite: 30000 } }, costByDay: { [new Date().toISOString().slice(0, 10)]: 1.42 }, title: 'Checkout: fix double charge', desc: 'Investigate the double charge race in checkout', agent: 'claude', profile: 'deep', model: 'sonnet', effort: 'high', priority: 3, state: 'running', warn: { why: 'loop', name: 'Bash', at: n - 6e4, rec: { profile: 'deep', model: 'opus', effort: 'high', why: 'loop' } }, created: n - 9e5, updated: n - 2e4, cost: 1.42, attempts: 1 },
    { ...base, id: 'demo2', title: 'README: install section', desc: 'Update the README install docs', agent: 'claude', profile: 'eco', model: 'haiku', effort: 'low', priority: 1, state: 'blocked', reason: 'review', created: n - 3e6, updated: n - 6e5, cost: 0.08, attempts: 1, result: 'Updated the install section and added npx usage.', files: ['README.md'], tests: { code: 0, at: n - 6e5 } },
    { ...base, id: 'demo3', costUnknown: true, title: 'API: pagination', desc: 'Add cursor pagination to /orders', agent: 'codex', profile: 'bal', model: '', effort: 'medium', priority: 2, state: 'blocked', reason: 'question', created: n - 5e6, updated: n - 9e5, cost: 0.31, attempts: 1, result: 'Should the cursor be opaque (base64) or the raw id?' },
    { ...base, id: 'demo4', title: 'Flaky login test', desc: 'Fix the flaky login test', agent: 'claude', profile: 'bal', model: 'sonnet', effort: 'medium', priority: 2, state: 'failed', reason: 'error', created: n - 8e6, updated: n - 7e6, cost: 0.66, attempts: 2 },
    { ...base, id: 'demo5', title: 'Docs: changelog', desc: 'Write the changelog', agent: 'codex', profile: 'eco', model: '', effort: 'low', priority: 1, state: 'pending', created: n - 1e5, updated: n - 1e5, cost: 0, attempts: 0, dependsOn: 'demo2' },
    { ...base, id: 'demo6', title: 'Dark mode toggle', desc: 'Add a dark mode toggle', agent: 'claude', profile: 'bal', model: 'sonnet', effort: 'medium', priority: 2, state: 'done', created: n - 2e7, updated: n - 1.8e7, cost: 0.54, attempts: 1, result: 'Added the toggle and tests.', files: ['src/theme.js'] },
  ];
}

module.exports = { demoSnapshot, demoReport, demoUsage, demoTasks };
