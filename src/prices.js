'use strict';
// Estimated cost in USD from measured tokens. Prices are the public API list prices (per 1M tokens),
// copied from the official pages on 2026-10-09:
//   https://platform.claude.com/docs/en/about-claude/pricing
//   https://developers.openai.com/api/docs/pricing
// A model missing here has no price (shown as such, never guessed). Override or add models in
// ~/.config/coworking-agents/prices.json: { "opus-5-5": { "in": 4, "out": 20, "cacheRead": 0.2, "cacheWrite": 5 } }
// Simplifications, stated in the UI: cache writes use the 5-minute rate unless the 1-hour split is known,
// and models with long-context tiers (Haiku 5.5 over 100k, GPT-5.x over 272k) use their short-context rate.

const os = require('os');
const path = require('path');
const { safeJson } = require('./util');

const PRICES = {
  // Claude: in, 5m cache write, 1h cache write, cache read, out
  'fable-5-1': { in: 10, cacheWrite: 12.5, cacheWrite1h: 20, cacheRead: 0.25, out: 50 },
  'mythos-5-1': { in: 10, cacheWrite: 12.5, cacheWrite1h: 20, cacheRead: 0.25, out: 50 },
  'fable-5': { in: 10, cacheWrite: 12.5, cacheWrite1h: 20, cacheRead: 1, out: 50 },
  'mythos-5': { in: 10, cacheWrite: 12.5, cacheWrite1h: 20, cacheRead: 1, out: 50 },
  'opus-5-5': { in: 4, cacheWrite: 5, cacheWrite1h: 8, cacheRead: 0.2, out: 20 },
  'opus-5': { in: 5, cacheWrite: 6.25, cacheWrite1h: 10, cacheRead: 0.5, out: 25 },
  'opus-4-8': { in: 5, cacheWrite: 6.25, cacheWrite1h: 10, cacheRead: 0.5, out: 25 },
  'opus-4-7': { in: 5, cacheWrite: 6.25, cacheWrite1h: 10, cacheRead: 0.5, out: 25 },
  'opus-4-6': { in: 5, cacheWrite: 6.25, cacheWrite1h: 10, cacheRead: 0.5, out: 25 },
  'opus-4-5': { in: 5, cacheWrite: 6.25, cacheWrite1h: 10, cacheRead: 0.5, out: 25 },
  'opus-4-1': { in: 15, cacheWrite: 18.75, cacheWrite1h: 30, cacheRead: 1.5, out: 75 },
  'opus-4': { in: 15, cacheWrite: 18.75, cacheWrite1h: 30, cacheRead: 1.5, out: 75 },
  'sonnet-5-5': { in: 2, cacheWrite: 2.5, cacheWrite1h: 4, cacheRead: 0.1, out: 10 },
  'sonnet-5': { in: 2, cacheWrite: 2.5, cacheWrite1h: 4, cacheRead: 0.2, out: 10 },
  'sonnet-4-6': { in: 3, cacheWrite: 3.75, cacheWrite1h: 6, cacheRead: 0.3, out: 15 },
  'sonnet-4-5': { in: 3, cacheWrite: 3.75, cacheWrite1h: 6, cacheRead: 0.3, out: 15 },
  'sonnet-4': { in: 3, cacheWrite: 3.75, cacheWrite1h: 6, cacheRead: 0.3, out: 15 },
  'haiku-5-5': { in: 0.1, cacheWrite: 0.125, cacheWrite1h: 0.2, cacheRead: 0.01, out: 0.5 },
  'haiku-4-5': { in: 1, cacheWrite: 1.25, cacheWrite1h: 2, cacheRead: 0.1, out: 5 },
  'haiku-3-5': { in: 0.8, cacheWrite: 1, cacheWrite1h: 1.6, cacheRead: 0.08, out: 4 },
  // OpenAI (standard tier, short context): in, cached in, out
  'gpt-6-astra': { in: 10, cacheRead: 1, out: 50 },
  'gpt-6.1-sol': { in: 2, cacheRead: 0.1, out: 10 },
  'gpt-6-sol': { in: 2, cacheRead: 0.2, out: 10 },
  'gpt-6-luna': { in: 0.1, cacheRead: 0.01, out: 0.5 },
  'gpt-5.6-sol': { in: 4, cacheRead: 0.4, out: 20 },
  'gpt-5.6-terra': { in: 2, cacheRead: 0.2, out: 12 },
  'gpt-5.6-luna': { in: 0.2, cacheRead: 0.02, out: 1.2 },
  'gpt-5.5': { in: 5, cacheRead: 0.5, out: 30 },
  'gpt-5.4': { in: 2.5, cacheRead: 0.25, out: 15 },
  'gpt-5.4-mini': { in: 0.75, cacheRead: 0.075, out: 4.5 },
  'gpt-5.4-nano': { in: 0.2, cacheRead: 0.02, out: 1.25 },
  'gpt-5.3-codex': { in: 1.75, cacheRead: 0.175, out: 14 },
  'gpt-5.2': { in: 1.75, cacheRead: 0.175, out: 14 },
  'gpt-5.1': { in: 1.25, cacheRead: 0.125, out: 10 },
  'gpt-5': { in: 1.25, cacheRead: 0.125, out: 10 },
  'gpt-5-mini': { in: 0.25, cacheRead: 0.025, out: 2 },
  'gpt-5-nano': { in: 0.05, cacheRead: 0.005, out: 0.4 },
};

// "claude-opus-5-5-20260922" → "opus-5-5"; "claude-opus-5-5[1m]" → "opus-5-5"; "gpt-5.5" stays
function modelKey(model) {
  return String(model || '').toLowerCase().replace(/\[.*?\]/g, '').replace(/^claude-/, '').replace(/-\d{8}$/, '').trim();
}

let extra = { at: 0, table: {} };
function table() {
  if (Date.now() - extra.at > 30000) {
    const d = safeJson(path.join(os.homedir(), '.config', 'coworking-agents', 'prices.json'));
    extra = { at: Date.now(), table: d && typeof d === 'object' && !Array.isArray(d) ? d : {} };
  }
  return { ...PRICES, ...extra.table };
}

function priceOf(model) {
  const p = table()[modelKey(model)];
  return p && Number(p.in) >= 0 && Number(p.out) >= 0 ? p : null;
}

// usage = { input, output, cacheRead, cacheWrite, cacheWrite1h? } in tokens → USD, or null when unpriced
function costOf(model, u) {
  const p = priceOf(model);
  if (!p || !u) return null;
  const w1h = Math.min(u.cacheWrite1h || 0, u.cacheWrite || 0), w5m = (u.cacheWrite || 0) - w1h;
  const n = x => Number(x) || 0;
  return (n(u.input) * n(p.in) + n(u.output) * n(p.out) + n(u.cacheRead) * n(p.cacheRead ?? p.in)
    + w5m * n(p.cacheWrite ?? p.in) + w1h * n(p.cacheWrite1h ?? p.cacheWrite ?? p.in)) / 1e6;
}

module.exports = { costOf, priceOf, modelKey, PRICES };
