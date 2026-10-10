'use strict';
// ---------------- replay: scrub the office back through the last hour ----------------
// Every agent's state at a past moment comes from its own timeline (measured events), so the office
// re-plays what really happened. Live data keeps arriving; it's just shown as of the chosen minute.
let replayAt = 0, replayPlay = 0, liveData = null;
const replayEl = document.createElement('div');
replayEl.className = 'replay'; replayEl.hidden = true;
replayEl.innerHTML = '<button class="hb" data-r="play">▶</button><input type="range" min="-3600" max="0" step="15" value="0"><span class="rt"></span><button class="hb" data-r="live"></button>';
document.body.appendChild(replayEl);
const rRange = replayEl.querySelector('input'), rTime = replayEl.querySelector('.rt');
const KIND_STATE = { idle: 'idle', ask: 'needs_you' };

function applyReplay(d) {
  if (!replayAt) return d;
  const T0 = replayAt;
  return { ...d, people: d.people.filter(p => !p.startedAt || p.startedAt <= T0).map(p => {
    const seg = (p.timeline || []).find(g => g.from <= T0 && T0 < g.to);
    const state = seg ? (KIND_STATE[seg.kind] || seg.kind) : 'asleep';
    return { ...p, state, doing: null, subagents: [], since: seg ? seg.from : p.since };
  }) };
}
function setReplay(offsetSec) {
  replayAt = offsetSec >= 0 ? 0 : Date.now() + offsetSec * 1000;
  rRange.value = String(offsetSec);
  rTime.textContent = replayAt ? new Date(replayAt).toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en', { hour: '2-digit', minute: '2-digit' }) + ' · ' + T.replay.ago(ago(-offsetSec * 1000)) : T.replay.live;
  replayEl.classList.toggle('past', !!replayAt);
  document.body.classList.toggle('replaying', !!replayAt);
  if (liveData) { data = applyReplay(liveData); lastLayoutKey = ''; renderAll(); }
}
function toggleReplay(on) {
  if (on) achBump('replay');
  replayEl.hidden = !on;
  replayEl.querySelector('[data-r="live"]').textContent = T.replay.live;
  if (!on) { clearInterval(replayPlay); replayPlay = 0; setReplay(0); } else setReplay(-1800);
}
rRange.addEventListener('input', () => setReplay(Number(rRange.value)));
replayEl.addEventListener('click', e => {
  const b = e.target.closest('[data-r]'); if (!b) return;
  if (b.dataset.r === 'live') return toggleReplay(false);
  if (replayPlay) { clearInterval(replayPlay); replayPlay = 0; b.textContent = '▶'; return; }
  if (Number(rRange.value) >= 0) setReplay(-3600);
  b.textContent = '❚❚';
  replayPlay = setInterval(() => { const v = Number(rRange.value) + 30; if (v >= 0) { clearInterval(replayPlay); replayPlay = 0; b.textContent = '▶'; setReplay(0); } else setReplay(v); }, 400); // 1 hour in ~48s
});
