'use strict';
// ---------------- talk modal: the agent at its desk, saying what it wants ----------------
// Opened by clicking a pending agent. Waiting for your next message? Write it here; "copy and go"
// puts it on the clipboard and brings the right terminal tab forward (paste with ⌘V, Enter).
const talkEl = document.createElement('div');
talkEl.className = 'talk'; talkEl.hidden = true;
talkEl.innerHTML = `<div class="talk-box" role="dialog" aria-modal="true">
  <button class="talk-x" aria-label="×">×</button>
  <div class="talk-scroll">
  <div class="talk-stage"><canvas class="talk-cv" width="200" height="96"></canvas><div class="talk-say"><p></p></div></div>
  <div class="talk-info"></div>
  <div class="talk-reply"></div>
  </div>
</div>`;
document.body.appendChild(talkEl);
const talkCv = talkEl.querySelector('.talk-cv'), talkCtx = talkCv.getContext('2d');
talkCtx.imageSmoothingEnabled = false;
let talkFor = null, talkTimer = 0;

function openTalk(id) {
  const p = data && data.people.find(x => x.id === id);
  if (!p) return;
  talkFor = id;
  pop.hidden = true;
  const urgent = p.state === 'needs_you' || p.state === 'waiting';
  const say = urgent ? helpText(p) : p.lastReply ? `“${p.lastReply}”` : T.help.done(p.title || '');
  talkEl.querySelector('.talk-say p').textContent = say;
  talkEl.querySelector('.talk-info').innerHTML = `<b>${esc(p.name)}</b><span>${esc(p.repo ? p.repo.name : '')}${p.branch && p.branch !== 'HEAD' ? ' · ' + esc(p.branch) : ''}</span>
    <small>⌛ ${esc(urgent ? T.help.waitingYou : T.states.idle)} · ${esc(ago(data.now - (p.since || p.lastActivity)))}</small>${p.compactedAt && p.compactedAt > (p.lastPromptAt || 0) ? `<em>${esc(T.talk.compacted)} · ${esc(ago(data.now - p.compactedAt))}</em>` : p.lastPrompt ? `<em>${esc(T.panel.lastPrompt)}: “${esc(p.lastPrompt)}”</em>` : ''}
    ${!urgent && p.lastReplyLong && p.lastReplyLong.length > (p.lastReply || '').length ? `<div class="talk-full"><small>${esc(T.panel.lastReply)}</small><div>${esc(p.lastReplyLong)}</div></div>` : ''}`;
  const goto = esc(p.agent === 'codex' && !p.pid ? T.panel.gotoCodex : T.panel.goto);
  talkEl.querySelector('.talk-reply').innerHTML = urgent
    ? (p.doing && p.doing.options && p.doing.options.length && !p.doing.multi && p.doing.qcount === 1 && p.entrypoint !== 'claude-desktop' && p.pid
      ? `<div class="opts">${p.doing.options.map((o, i) => `<button class="opt" data-choice="${i + 1}"><b>${i + 1}</b><span>${esc(o.label)}${o.description ? `<small>${esc(o.description)}</small>` : ''}</span></button>`).join('')}</div>
         <div class="talk-btns"><button class="hb" data-talk="goto">›_ ${goto}</button><button class="hb" data-talk="see">${esc(T.help.see)}</button></div><p class="note talk-msg">${esc(T.talk.pickHint)}</p>`
      : `<p class="note">${esc(T.talk.approveThere)}</p><div class="talk-btns"><button class="btn" data-talk="goto">›_ ${goto}</button><button class="hb" data-talk="see">${esc(T.help.see)}</button></div>`)
    : `<p class="note talk-why">${esc(T.talk.yourTurnWhy)}</p><textarea rows="3" maxlength="4000" placeholder="${esc(T.talk.placeholder)}"></textarea>
       <div class="talk-btns">${p.agent === 'claude' && p.pid && p.entrypoint !== 'claude-desktop' ? `<button class="btn" data-talk="send">➤ ${esc(T.talk.send)}</button>` : ''}<button class="hb" data-talk="copygo">${esc(T.talk.copyGo)}</button><button class="hb" data-talk="see">${esc(T.help.see)}</button></div>
       <p class="note talk-msg">${esc(p.entrypoint === 'claude-desktop' ? T.talk.desktopHint : p.agent === 'claude' && p.pid ? T.talk.sendHint : T.talk.pasteHint)}</p>`;
  talkEl.hidden = false; document.body.classList.add('talk-open');
  const ta = talkEl.querySelector('textarea');
  if (ta) setTimeout(() => ta.focus(), 30);
  clearInterval(talkTimer);
  talkTimer = setInterval(drawTalk, 150);
  drawTalk();
}

function closeTalk() { talkEl.hidden = true; talkFor = null; clearInterval(talkTimer); document.body.classList.remove('talk-open'); }

// the little scene: wall, window, desk, the agent talking (mouth opens and closes), laptop, mug
function drawTalk() {
  const p = data && data.people.find(x => x.id === talkFor);
  if (!p) return closeTalk();
  const t = performance.now(), f = (t / 150) | 0, W = 200, H = 96;
  const hr = new Date().getHours() + new Date().getMinutes() / 60, sky = Art.skyFor(qs.get('hour') ? Number(qs.get('hour')) : hr);
  const prev = ctx; ctx = talkCtx; Art.setCtx(talkCtx);
  try {
    r(0, 0, W, H, '#2a2333');
    for (let x = 0; x < W; x += 20) r(x, 0, 1, H - 22, '#30283a');
    Art.drawWindow(14, 10, 48, 30, sky, t, 7);
    Art.drawPoster(100, 12, 0); // the speech balloon covers the left half; the agent sits on the right
    // desk
    r(0, H - 22, W, 3, '#dc9a6c'); r(0, H - 19, W, 19, '#8f4f3a'); r(0, H - 1, W, 1, PAL.ink);
    // the agent, 3x, mouth moving while it "talks"
    const face = Art.portrait(p.id, f % 4 < 2 ? 'open' : null);
    talkCtx.drawImage(face, 128, H - 22 - 54 + (f % 8 < 4 ? 0 : 1), 48, 54);
    // laptop from behind, mug, plant
    r(136, H - 30, 34, 10, PAL.ink); r(138, H - 29, 30, 8, '#c0cbdc'); r(151, H - 26, 4, 3, '#fff');
    r(182, H - 30, 8, 8, PAL.ink); r(183, H - 29, 6, 6, '#f4ecd8'); r(189, H - 27, 2, 3, PAL.ink);
    if (f % 8 < 5) { r(185, H - 34 - (f % 3), 1, 3, '#ffffffaa'); r(187, H - 35 - ((f + 1) % 3), 1, 3, '#ffffff88'); }
    Art.drawPlant(108, H - 36, false);
    Art.drawCat(14, H - 28, 'sleep', t, false);
  } finally { ctx = prev; Art.setCtx(prev); }
}

talkEl.addEventListener('click', async e => {
  if (e.target === talkEl || e.target.closest('.talk-x')) return closeTalk();
  const opt = e.target.closest('[data-choice]');
  if (opt && talkFor) {
    const msg = talkEl.querySelector('.talk-msg'), R = T.talk.reasons;
    talkEl.querySelectorAll('.opt').forEach(x => { x.disabled = true; });
    let out = { ok: false, reason: 'unknown' };
    try { out = await fetch('api/answer', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id: talkFor, choice: Number(opt.dataset.choice) }) }).then(r => r.json()); } catch {}
    if (out.ok) { opt.classList.add('picked'); if (msg) msg.textContent = T.talk.sent(out.app); setTimeout(closeTalk, 1200); }
    else { talkEl.querySelectorAll('.opt').forEach(x => { x.disabled = false; }); if (msg) msg.textContent = typeof R[out.reason] === 'function' ? R[out.reason](out.app || 'Terminal') : (R[out.reason] || R.unknown); }
    return;
  }
  const b = e.target.closest('[data-talk]');
  if (!b || !talkFor) return;
  const id = talkFor;
  if (b.dataset.talk === 'see') { closeTalk(); return showPerson(id); }
  if (b.dataset.talk === 'send') {
    const ta = talkEl.querySelector('textarea'), msg = talkEl.querySelector('.talk-msg');
    const text = ta ? ta.value.trim() : '';
    if (!text) { if (ta) ta.focus(); return; }
    b.disabled = true; if (msg) msg.textContent = T.talk.sending;
    let out = { ok: false, reason: 'unknown' };
    try { out = await fetch('api/reply', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id, text }) }).then(r => r.json()); } catch {}
    b.disabled = false;
    const R = T.talk.reasons;
    if (out.ok) { if (msg) msg.textContent = T.talk.sent(out.app); ta.value = ''; setTimeout(closeTalk, 1200); }
    else if (msg) msg.textContent = typeof R[out.reason] === 'function' ? R[out.reason](out.app || 'Terminal') : (R[out.reason] || R.unknown);
    return;
  }
  if (b.dataset.talk === 'copygo') {
    const ta = talkEl.querySelector('textarea'), msg = talkEl.querySelector('.talk-msg');
    const text = ta ? ta.value.trim() : '';
    if (text) { try { await navigator.clipboard.writeText(text); } catch { ta.select(); document.execCommand('copy'); } }
    if (msg) msg.textContent = text ? T.talk.copied : T.talk.pasteHint;
  }
  b.disabled = true;
  try { await fetch('api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworking': '1' }, body: JSON.stringify({ id }) }); } catch {}
  b.disabled = false;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !talkEl.hidden) { e.stopPropagation(); closeTalk(); } }, true);
