'use strict';
// "A newer version is out": asks the npm registry for the latest version, once at start and every 6 hours.
// Only the package name goes out (no data about you or your sessions). Off with --no-update-check
// or COWORKING_NO_UPDATE_CHECK=1. Started by the CLI only, so tests and the demo never touch the network.

const CURRENT = require('../package.json').version;
const URL = 'https://registry.npmjs.org/coworking-agents/latest';
let latest = null, timer = null;

// true when a is a higher x.y.z than b (pre-release tags like 0.0.0-stage never count as newer)
function newer(a, b) {
  if (!/^\d+\.\d+\.\d+$/.test(String(a)) || !/^\d+\.\d+\.\d+$/.test(String(b))) return false;
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

async function check() {
  try {
    const r = await fetch(URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (r.ok) { const v = (await r.json()).version; if (typeof v === 'string') latest = v; }
  } catch {}
  return updateInfo();
}

function startChecks() {
  if (timer || process.env.COWORKING_NO_UPDATE_CHECK) return Promise.resolve(null);
  timer = setInterval(check, 6 * 3600e3);
  timer.unref();
  return check();
}

// what the page shows: null until a newer version is known
function updateInfo() { return latest && newer(latest, CURRENT) ? { current: CURRENT, latest } : null; }

module.exports = { startChecks, updateInfo, newer, CURRENT };
