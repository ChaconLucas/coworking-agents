'use strict';
// ---------------- day-to-day helpers: the queue, quick replies, welcome back, daily goal, cost alert, new session ----------------

// ---- the queue: everyone waiting on you, longest wait first ----
const waitedFor = p => (p.state === 'needs_you' || p.state === 'waiting') && p.doing ? p.doing.for : data.now - (p.since || data.now);
function queueList() {
  if (!data) return [];
  return data.people.filter(p => !p.leaving && ['needs_you', 'waiting', 'idle'].includes(p.state))
    .sort((a, b) => ((b.state !== 'idle') - (a.state !== 'idle')) || waitedFor(b) - waitedFor(a));
}
function renderQueue() {
  const Q = T.queue, body = reportEl.querySelector('.report-body'), list = queueList();
  body.innerHTML = tabsHtml() + `<p class="sub">${esc(Q.sub)}</p>` + (list.length ? `<ul class="queue">${list.map(p => {
    const urgent = p.state !== 'idle', what = urgent ? helpText(p) : (p.lastReply ? `“${p.lastReply}”` : T.states.idle);
    return `<li class="${urgent ? 'urgent' : ''}"><span class="q-face" data-face="${esc(p.id)}"></span><span><b>${esc(p.name)}</b> <span class="note">${esc(p.repo ? p.repo.name : '')}</span><br><span class="q-what">${esc(what)}</span></span>
      <span class="q-side"><small>⌛ ${esc(ago(waitedFor(p)))}</small><button class="btn small" data-q-talk="${esc(p.id)}">${esc(urgent ? Q.answer : Q.reply)}</button></span></li>`;
  }).join('')}</ul>` : `<p class="note">${esc(Q.empty)}</p>`);
  body.querySelectorAll('[data-face]').forEach(el => el.appendChild(Art.portrait(el.dataset.face, 'open')));
}
reportEl.addEventListener('click', e => { const b = e.target.closest('[data-q-talk]'); if (b) { closeReport(); openTalk(b.dataset.qTalk); } });

// ---- quick replies in the talk modal: a click fills the box (you still choose to send) ----
function quickReplies() { return `<div class="quick">${T.quick.map((q, i) => `<button class="chip" data-quick="${i}">${esc(q)}</button>`).join('')}</div>`; }
talkEl.addEventListener('click', e => {
  const q = e.target.closest('[data-quick]'); if (!q) return;
  const ta = talkEl.querySelector('textarea'); if (!ta) return;
  ta.value = T.quick[Number(q.dataset.quick)]; ta.focus(); achBump('quickReplies');
});

// ---- welcome back: after 15+ minutes away, what happened meanwhile (from the history) ----
let lastSeenAt = Number(store.get('lastSeenAt', 0)) || 0;
function welcomeBack() {
  const away = Date.now() - lastSeenAt;
  if (lastSeenAt && away > 15 * 60000) {
    const ev = feed.filter(e => e.at > lastSeenAt), n = k => ev.filter(e => e.kind === k).length;
    const need = data ? data.people.filter(p => !p.leaving && (p.state === 'needs_you' || p.state === 'waiting')).length : 0;
    if (ev.length || need) toast(`<b>${esc(T.welcome.title(ago(away)))}</b>${esc(T.welcome.body(n('done'), n('arrive'), n('leave'), need))}<br><button class="btn small" data-welcome-queue>${esc(T.welcome.queue)}</button>`, 'ok sticky');
  }
  lastSeenAt = Date.now(); store.set('lastSeenAt', lastSeenAt);
}
setInterval(() => { if (!document.hidden) { lastSeenAt = Date.now(); store.set('lastSeenAt', lastSeenAt); } }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) welcomeBack(); else { lastSeenAt = Date.now(); store.set('lastSeenAt', lastSeenAt); } });
setTimeout(welcomeBack, 2500); // on open, once the first snapshot is in
document.addEventListener('click', e => { if (e.target.closest('[data-welcome-queue]')) { e.target.closest('.toast').remove(); openReport('queue'); } });

// ---- daily goal (hours of agents at work today) and a cost alert (estimated USD today) ----
const todayKey = () => new Date().toISOString().slice(0, 10);
function todayHours() { const d = usageData && usageData.days && usageData.days[todayKey()]; return d ? d.activeMs / 36e5 : 0; }
function todayUsd() { const d = usageData && usageData.days && usageData.days[todayKey()]; return d ? d.usd || 0 : 0; }
function goalHtml() {
  const G = T.goal, goal = Number((prog.style || {}).goalHours) || 0, cap = Number((prog.style || {}).costAlert) || 0, h = todayHours(), usd = todayUsd();
  return `<h3>${esc(G.title)}</h3><div class="goal">
    <label>${esc(G.hours)} <input type="number" min="0" max="48" step="1" value="${goal || ''}" data-goal="goalHours" placeholder="8"></label>
    ${goal ? `<div class="ach-bar" style="--c:#63c74d"><i style="width:${Math.min(100, h / goal * 100).toFixed(1)}%"></i></div><small>${h.toFixed(1)}h / ${goal}h</small>` : ''}
    <label>${esc(G.cost)} <input type="number" min="0" step="5" value="${cap || ''}" data-goal="costAlert" placeholder="50"></label>
    <small>${esc(G.costToday(fmtUSD(usd)))}</small></div>`;
}
reportEl.addEventListener('change', e => {
  const i = e.target.closest('[data-goal]'); if (!i) return;
  prog.style = { ...(prog.style || {}), [i.dataset.goal]: Math.max(0, Number(i.value) || 0) }; saveProgress(); renderReport();
});
let goalToldFor = store.get('goalTold', ''), costToldFor = store.get('costTold', '');
function checkGoals() {
  const s = prog.style || {}, k = todayKey();
  if (s.goalHours && todayHours() >= s.goalHours && goalToldFor !== k) { goalToldFor = k; store.set('goalTold', k); toast(`<b>${esc(T.goal.reached)}</b>${esc(T.goal.reachedBody(s.goalHours))}`, 'ok'); playTune('trophy'); confettiAt = Date.now(); achBump('goals'); }
  if (s.costAlert && todayUsd() >= s.costAlert && costToldFor !== k) { costToldFor = k; store.set('costTold', k); toast(`<b>${esc(T.goal.costHit(fmtUSD(todayUsd())))}</b>${esc(T.goal.costBody)}`, 'warn'); notifyOS(T.goal.costHit(fmtUSD(todayUsd())), T.goal.costBody); }
}
setInterval(checkGoals, 60000);

// ---- new session: pick a folder you already work in (or type one) and an AI; a Terminal tab opens there ----
function knownFolders() {
  const set = new Map();
  for (const p of (data && data.people) || []) if (p.cwd) set.set(p.cwd, p.repo ? p.repo.name : p.cwd.split('/').pop());
  return [...set.entries()];
}
function renderLaunch() {
  const L = T.launch, body = reportEl.querySelector('.report-body'), folders = knownFolders();
  body.innerHTML = tabsHtml() + `<p class="sub">${esc(L.sub)}</p>
    <h3>${esc(L.folder)}</h3><div class="opts">${folders.map(([d, n]) => `<button class="opt" data-launch-dir="${esc(d)}" title="${esc(d)}">${esc(n)}</button>`).join('')}</div>
    <div class="office-name" style="margin-top:8px"><input id="launch-dir" placeholder="${esc(L.typePh)}" value="${esc(folders[0] ? folders[0][0] : '')}"></div>
    <h3>${esc(L.ai)}</h3><div class="opts"><button class="opt on" data-launch-ai="claude">Claude Code</button><button class="opt" data-launch-ai="codex">Codex</button></div>
    <p><button class="btn" data-launch-go>➤ ${esc(L.go)}</button> <span class="note" id="launch-msg"></span></p><p class="note">${esc(L.note)}</p>`;
}
reportEl.addEventListener('click', async e => {
  const d = e.target.closest('[data-launch-dir]'); if (d) { document.getElementById('launch-dir').value = d.dataset.launchDir; return; }
  const a = e.target.closest('[data-launch-ai]'); if (a) { reportEl.querySelectorAll('[data-launch-ai]').forEach(b => b.classList.toggle('on', b === a)); return; }
  if (!e.target.closest('[data-launch-go]')) return;
  const dir = document.getElementById('launch-dir').value.trim(), agent = (reportEl.querySelector('[data-launch-ai].on') || {}).dataset.launchAi || 'claude', msg = document.getElementById('launch-msg');
  let out = { ok: false, reason: 'unknown' };
  try { out = await fetch('api/launch', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ dir, agent }) }).then(r => r.json()); } catch {}
  msg.textContent = out.ok ? T.launch.ok : (T.launch.fail[out.reason] || T.launch.fail.unknown);
  if (out.ok) achBump('launches');
});
