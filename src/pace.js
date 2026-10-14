'use strict';
// How fast each limit is filling: samples of the used percentage over the last hour of the current window, and when it
// would run out at that pace (or that it lasts until the reset). Measured from the limits the office already reads;
// shown only with enough samples, never guessed from one reading.
const samples = new Map(); // "claude:5h" → [{ t, pct, resetsAt }]
const WINDOW = 60 * 60000, MIN_SPAN = 10 * 60000;

function record(limits, now = Date.now()) {
  for (const [ai, l] of Object.entries(limits || {})) for (const [w, v] of [['5h', l && l.primary], ['week', l && l.secondary]]) {
    if (!v || typeof v.usedPercent !== 'number') continue;
    const k = ai + ':' + w; let list = samples.get(k) || [];
    const last = list[list.length - 1];
    if (last && (last.resetsAt || 0) !== (v.resetsAt || 0) && v.usedPercent < last.pct) list = []; // a new window started
    if (last && now - last.t < 30000) continue;
    list.push({ t: now, pct: v.usedPercent, resetsAt: v.resetsAt || 0 });
    samples.set(k, list.filter(x => now - x.t <= 3 * WINDOW));
  }
}
// per AI and window: the pace (points per hour) and when it reaches 100% (0 when it doesn't before the reset or isn't rising)
function forecast(now = Date.now()) {
  const out = {};
  for (const [k, list] of samples) {
    const recent = list.filter(x => now - x.t <= WINDOW); if (recent.length < 3) continue;
    const a = recent[0], b = recent[recent.length - 1]; if (b.t - a.t < MIN_SPAN) continue;
    const perHour = (b.pct - a.pct) / ((b.t - a.t) / 36e5), [ai, w] = k.split(':');
    const fullAt = perHour > 0.5 && b.pct < 100 ? Math.round(b.t + (100 - b.pct) / perHour * 36e5) : 0;
    (out[ai] || (out[ai] = {}))[w] = { pct: b.pct, perHour: Math.round(perHour * 10) / 10, fullAt: fullAt && b.resetsAt && fullAt >= b.resetsAt ? 0 : fullAt, resetsAt: b.resetsAt, lasts: !fullAt || (b.resetsAt && fullAt >= b.resetsAt) };
  }
  return out;
}

module.exports = { record, forecast, _reset: () => samples.clear() };
