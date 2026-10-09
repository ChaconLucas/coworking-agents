'use strict';
// ---------------- talk modal: the agent at its desk, saying what it wants ----------------
// Opened by clicking a pending agent. Waiting for your next message? Write it here; "copy and go"
// puts it on the clipboard and brings the right terminal tab forward (paste with ⌘V, Enter).
const talkEl = document.createElement('div');
talkEl.className = 'talk'; talkEl.hidden = true;
talkEl.innerHTML = `<div class="talk-box" role="dialog" aria-modal="true">
  <button class="talk-x" aria-label="×">×</button>
  <div class="talk-stage"><canvas class="talk-cv" width="200" height="96"></canvas><div class="talk-say"><p></p></div></div>
  <div class="talk-info"></div>
  <div class="talk-reply"></div>
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
    <small>⌛ ${esc(urgent ? T.help.waitingYou : T.states.idle)} · ${esc(ago(data.now - (p.since || p.lastActivity)))}</small>${p.lastPrompt ? `<em>${esc(T.panel.lastPrompt)}: “${esc(p.lastPrompt)}”</em>` : ''}`;
  const goto = esc(p.agent === 'codex' && !p.pid ? T.panel.gotoCodex : T.panel.goto);
  talkEl.querySelector('.talk-reply').innerHTML = urgent
    ? `<p class="note">${esc(T.talk.approveThere)}</p><div class="talk-btns"><button class="btn" data-talk="goto">›_ ${goto}</button><button class="hb" data-talk="see">${esc(T.help.see)}</button></div>`
    : `<textarea rows="3" maxlength="4000" placeholder="${esc(T.talk.placeholder)}"></textarea>
       <div class="talk-btns"><button class="btn" data-talk="copygo">›_ ${esc(T.talk.copyGo)}</button><button class="hb" data-talk="see">${esc(T.help.see)}</button></div>
       <p class="note talk-msg">${esc(T.talk.pasteHint)}</p>`;
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
    Art.drawBookshelf(150, 8, 40, 46);
    Art.drawPoster(118, 14, 0);
    // desk
    r(0, H - 22, W, 3, '#dc9a6c'); r(0, H - 19, W, 19, '#8f4f3a'); r(0, H - 1, W, 1, PAL.ink);
    // the agent, 3x, mouth moving while it "talks"
    const face = Art.portrait(p.id, f % 4 < 2 ? 'open' : null);
    talkCtx.drawImage(face, 76, H - 22 - 54 + (f % 8 < 4 ? 0 : 1), 48, 54);
    // laptop from behind, mug, plant
    r(84, H - 30, 34, 10, PAL.ink); r(86, H - 29, 30, 8, '#c0cbdc'); r(99, H - 26, 4, 3, '#fff');
    r(136, H - 30, 8, 8, PAL.ink); r(137, H - 29, 6, 6, '#f4ecd8'); r(143, H - 27, 2, 3, PAL.ink);
    if (f % 8 < 5) { r(139, H - 34 - (f % 3), 1, 3, '#ffffffaa'); r(141, H - 35 - ((f + 1) % 3), 1, 3, '#ffffff88'); }
    Art.drawPlant(40, H - 36, false);
    Art.drawCat(160, H - 28, 'sleep', t, true);
  } finally { ctx = prev; Art.setCtx(prev); }
}

talkEl.addEventListener('click', async e => {
  if (e.target === talkEl || e.target.closest('.talk-x')) return closeTalk();
  const b = e.target.closest('[data-talk]');
  if (!b || !talkFor) return;
  const id = talkFor;
  if (b.dataset.talk === 'see') { closeTalk(); return showPerson(id); }
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
