'use strict';
// ---------------- alerts: rate limits filling up, contexts close to compaction, and the compact action ----------------
const CTX_WARN = .75;               // from here a "compact" button shows over the agent
const LIMIT_STEPS = [80, 95];       // notify once per window when usage crosses these
const alerted = new Set();

const ctxPct = p => p.ctx && p.ctxMax ? p.ctx / p.ctxMax : 0; // unknown window size = no percentage, no compact button
const canType = () => !data || !data.platform || data.platform === 'darwin'; // typing into a terminal tab is macOS-only
const canCompact = p => !replayAt && canType() && p.agent === 'claude' && !p.leaving && (p.state === 'idle' || p.state === 'asleep') && ctxPct(p) >= CTX_WARN && p.entrypoint !== 'claude-desktop';

const toastEl = document.createElement('div');
toastEl.className = 'toasts'; toastEl.setAttribute('aria-live', 'polite');
document.body.appendChild(toastEl);
function toast(html, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.innerHTML = html;
  toastEl.appendChild(el);
  if (/\bsticky\b/.test(kind || '')) { el.title = '×'; el.addEventListener('click', e => { if (e.target.tagName !== 'CODE') el.remove(); }); return; } // stays until clicked (the command itself stays selectable)
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 7000);
}
function notifyOS(title, body) {
  playTune('limit');
  if (notifyOn && 'Notification' in window && Notification.permission === 'granted' && document.hidden) { try { new Notification(title, { body }); } catch {} }
}

function checkAlerts() {
  if (!data) return;
  const A = T.alerts, L = data.limits || {};
  for (const [id, l] of Object.entries(L)) {
    for (const [win, w] of [['5h', l && l.primary], ['week', l && l.secondary]]) {
      if (!w) continue;
      for (const step of LIMIT_STEPS) {
        const key = `lim:${id}:${win}:${step}:${w.resetsAt}`;
        if (w.usedPercent >= step && !alerted.has(key)) {
          alerted.add(key);
          if (!firstAlertPass) { const label = `${(AGENT[id] || {}).label || id} · ${win === '5h' ? T.usage.fiveHour : T.usage.week}`; toast(`<b>${esc(A.limit(Math.round(w.usedPercent)))}</b>${esc(label)} · ${esc(T.usage.resets)} ${esc(untilText(w.resetsAt))}`, step >= 95 ? 'bad' : 'warn'); notifyOS(A.limit(Math.round(w.usedPercent)), `${label} · ${T.usage.resets} ${untilText(w.resetsAt)}`); }
        }
      }
    }
  }
  for (const p of data.people) {
    const pct = ctxPct(p), key = `ctx:${p.id}:${p.compactedAt || 0}`;
    if (pct >= .85 && !alerted.has(key)) {
      alerted.add(key);
      if (!firstAlertPass) { toast(`<b>${esc(A.context(Math.round(pct * 100)))}</b>${esc(p.name)} · ${esc(p.title || '')}`, 'warn'); notifyOS(A.context(Math.round(pct * 100)), p.name); }
    }
  }
  // a newer release on npm: told once per page load, even if it was already true on load
  const up = data.update;
  if (up && up.latest && !alerted.has('upd:' + up.latest)) {
    alerted.add('upd:' + up.latest);
    toast(`<b>${esc(A.update(up.latest))}</b>${esc(A.updateHow)} <code>npx coworking-agents@latest</code>`, 'ok sticky');
  }
  firstAlertPass = false;
}
let firstAlertPass = true; // what's already true on load is noted, not announced

async function compactAgent(id, btn) {
  if (btn) btn.disabled = true;
  let out = { ok: false, reason: 'unknown' };
  try { out = await fetch('api/compact', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id }) }).then(r => r.json()); } catch {}
  if (btn) btn.disabled = false;
  const R = T.talk.reasons;
  if (out.ok) toast(`<b>${esc(T.alerts.compacting)}</b>${esc((data.people.find(p => p.id === id) || {}).name || '')}`, 'ok');
  else toast(`<b>${esc(T.alerts.compactFail)}</b>${esc(typeof R[out.reason] === 'function' ? R[out.reason](out.app || 'Terminal') : (R[out.reason] || R.unknown))}`, 'bad');
}
