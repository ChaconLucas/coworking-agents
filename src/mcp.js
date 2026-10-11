'use strict';
// Read-only MCP server over stdio (JSON-RPC 2.0, one message per line): other agents can ask who is
// working, who waits on you, where edits clash, today's report and the tasks. Nothing here changes anything.

const readline = require('readline');
const { snapshot, report } = require('./collect');
const tasks = require('./tasks');

const TOOLS = [
  { name: 'list_agents', description: 'Every live AI coding session: name, AI, state, repo, current activity.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_agent_status', description: 'Full status of one session by id or name.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'get_conflicts', description: 'Clones and files that more than one session is editing right now.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_daily_report', description: "Today's report: time, tools, files and output per session.", inputSchema: { type: 'object', properties: {} } },
  { name: 'list_tasks', description: 'Tasks created in the office, with state, agent, cost and last result.', inputSchema: { type: 'object', properties: { state: { type: 'string' } } } },
];

function call(name, a = {}) {
  if (name === 'list_agents') return snapshot().people.map(p => ({ id: p.id, name: p.name, agent: p.agent, state: p.state, repo: p.repo && p.repo.name, doing: p.doing && p.doing.what, title: p.title }));
  if (name === 'get_agent_status') return snapshot().people.find(p => p.id === a.id || p.name === a.id) || null;
  if (name === 'get_conflicts') { const s = snapshot(); return { clones: s.clashes, files: s.fileClashes }; }
  if (name === 'get_daily_report') return report();
  if (name === 'list_tasks') return tasks.list().tasks.filter(t => !a.state || t.state === a.state).map(({ id, title, state, reason, agent, profile, model, effort, cost, result, files, updated }) => ({ id, title, state, reason, agent, profile, model, effort, cost, result, files, updated }));
  throw new Error('unknown tool');
}

function serve() {
  const out = m => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
  readline.createInterface({ input: process.stdin }).on('line', line => {
    let m; try { m = JSON.parse(line); } catch { return out({ id: null, error: { code: -32700, message: 'parse error' } }); }
    const { id, method, params = {} } = m;
    if (id === undefined) return; // notification
    if (method === 'initialize') return out({ id, result: { protocolVersion: params.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'coworking-agents', version: require('../package.json').version } } });
    if (method === 'ping') return out({ id, result: {} });
    if (method === 'tools/list') return out({ id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      try { return out({ id, result: { content: [{ type: 'text', text: JSON.stringify(call(params.name, params.arguments), null, 1) }] } }); }
      catch (e) { return out({ id, result: { content: [{ type: 'text', text: String(e.message) }], isError: true } }); }
    }
    out({ id, error: { code: -32601, message: 'method not found' } });
  });
}

module.exports = { serve, call, TOOLS };
