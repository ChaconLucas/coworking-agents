'use strict';
// ---------------- top bar ----------------
function renderBar() {
  document.getElementById('host').textContent = prog.officeName || data.host || '';
  const c = { work: 0, need: 0, turn: 0, sleep: 0 };
  for (const p of data.people) {
    if (p.leaving) continue;
    if (p.state === 'needs_you' || p.state === 'waiting') c.need++;
    else if (p.state === 'idle') c.turn++;
    else if (p.state === 'asleep') c.sleep++;
    else c.work++;
  }
  // stat tiles: the "needs you" one turns red and pulses when it isn't zero
  const tile = (n, label, color, cls = '') => `<span class="stat ${cls}" style="--c:${color}"><i></i><b>${n}</b><small>${esc(label)}</small></span>`;
  document.getElementById('counts').innerHTML = [
    tile(c.work, T.working, KIND_COLOR.terminal),
    tile(c.need, T.needYou, KIND_COLOR.needs_you, c.need ? 'need' : 'zero'),
    tile(c.turn, T.yourTurn, KIND_COLOR.idle, c.turn ? '' : 'zero'),
    tile(c.sleep, T.asleep, KIND_COLOR.asleep, c.sleep ? '' : 'zero'),
  ].join('');
  // busy bar: how the office is split right now (working stripes move)
  // busy bar: one lane per AI — its mark, then its agents split by state
  const busy = document.getElementById('busy') || document.createElement('div');
  const lanes = new Map();
  for (const p of data.people) {
    if (p.leaving) continue;
    const l = lanes.get(p.agent) || { work: 0, need: 0, turn: 0, sleep: 0, n: 0 };
    const st = p.state === 'needs_you' || p.state === 'waiting' ? 'need' : p.state === 'idle' ? 'turn' : p.state === 'asleep' ? 'sleep' : 'work';
    l[st]++; l.n++; lanes.set(p.agent, l);
  }
  const seg = (n, cls, label) => n ? `<i class="${cls}" style="flex:${n}" title="${n} ${esc(label)}"></i>` : '';
  const html = [...lanes.entries()].map(([id, l]) => `<span class="lane" style="flex:${l.n}" data-ai="${esc(id)}" title="${esc((AGENT[id] || {}).label || id)}: ${l.work} ${esc(T.working)} · ${l.need} ${esc(T.needYou)} · ${l.turn} ${esc(T.yourTurn)} · ${l.sleep} ${esc(T.asleep)}"><span class="ico"></span><span class="nm">${esc(((AGENT[id] || {}).label || id).split(' ')[0])}</span><span class="segs">${seg(l.work, 'b-work', T.working)}${seg(l.need, 'b-need', T.needYou)}${seg(l.turn, 'b-turn', T.yourTurn)}${seg(l.sleep, 'b-sleep', T.asleep)}</span><b>${l.n}</b></span>`).join('');
  if (busy.dataset.html !== html) {
    busy.dataset.html = html; busy.innerHTML = html;
    busy.querySelectorAll('.lane').forEach(el => { const id = el.dataset.ai, a = AGENT[id] || { color: '#8a8f98' }; el.querySelector('.ico').appendChild(Art.aiIconEl(id, a.color)); });
  }
  busy.setAttribute('aria-label', `${c.work} ${T.working}, ${c.need} ${T.needYou}, ${c.turn} ${T.yourTurn}, ${c.sleep} ${T.asleep}`);
  document.title = (c.need ? `(${c.need}) ` : '') + 'coworking-agents';
  const box = document.getElementById('clashes');
  const names = id => (data.people.find(p => p.id === id) || {}).name || id.slice(0, 6);
  box.innerHTML = (data.fileClashes || []).map(cl => `<div>${T.fileClash(cl.who.map(names).map(esc).join(T.and), esc(cl.file), esc(cl.repo))}</div>`).join('') + data.clashes.map(cl => `<div>${T.clash(cl.who.map(names).map(esc).join(T.and), esc(cl.repo))}</div>`).join('');
  box.hidden = !data.clashes.length && !(data.fileClashes || []).length;
  const empty = document.getElementById('empty');
  empty.innerHTML = T.empty; empty.hidden = data.people.length > 0;
  for (const [id, on, label] of [['btn-notify', !!notifyOn, T.notify], ['btn-sound', soundOn, T.sound], ['btn-radio', radioOn, T.radio.label], ['btn-walk', playerOn, T.walk.label]]) {
    const b = document.getElementById(id);
    b.setAttribute('aria-pressed', on); b.title = `${label.replace(/^\S+\s/, '')}: ${on ? T.on : T.off}`; b.querySelector('.sr').textContent = b.title;
  }
  document.getElementById('btn-lang').innerHTML = `<b class="lg">${esc(T.lang)}</b><span class="ml">${esc(T.menuItems.lang)}</span>`; document.getElementById('btn-lang').title = T.langName;
  { const mb = document.getElementById('btn-menu'); mb.title = T.menu; mb.querySelector('.sr').textContent = T.menu; mb.querySelector('.menu-dot').hidden = !focusing(); }
  { const rb = document.getElementById('btn-replay'); rb.title = T.replay.title; rb.querySelector('.sr').textContent = T.replay.title; rb.setAttribute('aria-pressed', !replayEl.hidden); }
  renderFocus();
  // short visible labels in the ☰ menu (the long explanation stays in the tooltip)
  for (const [id, k] of [['btn-notify', 'notify'], ['btn-sound', 'sound'], ['btn-focus', 'focus'], ['btn-replay', 'replay'], ['btn-search', 'search'], ['btn-radio', 'radio'], ['btn-photo', 'photo'], ['btn-office', 'office'], ['btn-walk', 'walk']]) {
    const b = document.getElementById(id); let ml = b.querySelector('.ml');
    if (!ml) { ml = document.createElement('span'); ml.className = 'ml'; b.insertBefore(ml, b.querySelector('.focus-left')); }
    ml.textContent = T.menuItems[k];
  }
  { const ob = document.getElementById('btn-office'); ob.title = T.office.tab; ob.querySelector('.sr').textContent = T.office.tab; }
  { const pb = document.getElementById('btn-photo'); pb.title = T.photo.title; pb.querySelector('.sr').textContent = T.photo.title; }
  { const sb = document.getElementById('btn-search'); sb.title = T.keys.searchTitle; sb.querySelector('.sr').textContent = T.keys.searchTitle; }
  renderUsagePill();

  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
}

// ---------------- notifications ----------------
let prevStates = new Map(), audio = null;
// focus mode: sounds and system notifications pause for a while (toasts and the office keep going)
let focusUntil = Number(store.get('focusUntil', 0)) || 0;
const focusing = () => focusUntil > Date.now();
const FOCUS_STEPS = [25, 50]; // minutes; each click goes to the next, then off
const lastSeen = new Map(); // id → last known person, to name who left
function beep(urgent) {
  if (!soundOn || focusing()) return;
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'square'; o.frequency.value = urgent ? 880 : 660;
    g.gain.setValueAtTime(.06, audio.currentTime); g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .25);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + .25);
    if (urgent) { const o2 = audio.createOscillator(); o2.type = 'square'; o2.frequency.value = 1175; o2.connect(g); o2.start(audio.currentTime + .12); o2.stop(audio.currentTime + .25); }
  } catch {}
}
// a little chiptune per event: request (two rising beeps), done (soft chime), arrival (three notes up), leaving (two notes down)
const TUNES = { need: [[880, 0], [1175, .12]], done: [[784, 0], [1047, .1]], arrive: [[523, 0], [659, .09], [784, .18]], leave: [[659, 0], [440, .12]], limit: [[440, 0], [440, .18], [440, .36]], trophy: [[523, 0], [659, .08], [784, .16], [1047, .24], [1319, .36]], purr: [[196, 0], [185, .1], [196, .2]] };
function playTune(kind) {
  if (!soundOn || focusing() || !TUNES[kind]) return;
  try {
    audio = audio || new AudioContext();
    for (const [freq, at] of TUNES[kind]) {
      const o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + at;
      o.type = kind === 'done' ? 'triangle' : 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(.05, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + .16);
      o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + .17);
    }
  } catch {}
}

// activity feed: what happened, kept in this browser for 24h (a per-viewer convenience, not shared state)
const FEED_MAX = 300, FEED_MS = 24 * 36e5;
let feed = store.get('feed', []);
if (!Array.isArray(feed)) feed = [];
function logEvent(kind, p) {
  feed.push({ at: Date.now(), kind, id: p.id, name: p.name, title: p.title || '', agent: p.agent });
  feed = feed.filter(e => Date.now() - e.at < FEED_MS).slice(-FEED_MAX);
  store.set('feed', feed);
  if (!reportEl.hidden && reportTab === 'feed') renderReport();
}

function notifyChanges() {
  const ids = new Set(data.people.filter(p => !p.leaving).map(p => p.id));
  if (prevStates.size && !replayAt) {
    for (const p of data.people) if (!p.leaving && !prevStates.has(p.id)) logEvent('arrive', p);
    for (const [id] of prevStates) if (!ids.has(id)) { const g = data.people.find(x => x.id === id) || lastSeen.get(id); if (g) logEvent('leave', g); lastSeen.delete(id); }
  }
  if (prevStates.size) {
    if ([...ids].some(id => !prevStates.has(id))) playTune('arrive');
    else if ([...prevStates.keys()].some(id => !ids.has(id))) playTune('leave');
  }
  for (const p of data.people) {
    const before = prevStates.get(p.id);
    if (!replayAt) noteLife(p, before);
    if (before && before !== p.state) {
      const urgent = p.state === 'needs_you' || p.state === 'waiting';
      const done = p.state === 'idle' && !['idle', 'asleep'].includes(before);
      if (done) doneUntil.set(p.id, Date.now() + 9000);
      if ((urgent || done) && !replayAt) logEvent(done ? 'done' : p.state, p);
      if (urgent || done) {
        playTune(urgent ? 'need' : 'done');
        if (notifyOn && !focusing() && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
          try { new Notification(`${p.name} ${T.states[p.state]}`, { body: p.title || '', tag: p.id }); } catch {}
        }
      }
    }
  }
  prevStates = new Map(data.people.filter(p => !p.leaving).map(p => [p.id, p.state]));
  for (const p of data.people) if (!p.leaving) lastSeen.set(p.id, p);
}

// ask for notification permission right away; browsers that need a gesture get asked on the first click
async function askNotify() {
  if (!('Notification' in window) || notifyOn === false) return;
  if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch {} }
  if (notifyOn === null && Notification.permission === 'granted') { notifyOn = true; store.set('notify', true); }
  if (data) renderBar();
}
askNotify();
document.addEventListener('pointerdown', () => {
  askNotify();
  try { audio = audio || new AudioContext(); if (audio.state === 'suspended') audio.resume(); } catch {} // unlock sound
}, { once: true });

document.getElementById('btn-notify').onclick = async () => {
  if (!notifyOn && 'Notification' in window && Notification.permission !== 'granted') {
    try { await Notification.requestPermission(); } catch {}
  }
  notifyOn = !notifyOn; store.set('notify', notifyOn); renderBar();
};
document.getElementById('btn-sound').onclick = () => { soundOn = !soundOn; store.set('sound', soundOn); if (soundOn) beep(false); renderBar(); };
document.getElementById('btn-search').onclick = () => openSearch();
document.getElementById('btn-radio').onclick = () => setRadio(!radioOn);
document.getElementById('btn-walk').onclick = () => setPlayer(!playerOn);
document.getElementById('btn-photo').onclick = () => { setMenu(false); groupPhoto(); };
document.getElementById('btn-office').onclick = () => { setMenu(false); openReport('office'); };
document.getElementById('btn-replay').onclick = () => toggleReplay(replayEl.hidden);
document.getElementById('btn-lang').onclick = () => { achBump('lang'); lang = lang === 'pt' ? 'en' : 'pt'; T = I18N[lang]; store.set('lang', lang); renderAll(); };

function renderFocus() {
  const b = document.getElementById('btn-focus'), left = b.querySelector('.focus-left'), on = focusing();
  const mins = on ? Math.ceil((focusUntil - Date.now()) / 60000) : 0;
  b.setAttribute('aria-pressed', on);
  b.title = on ? T.focus.on(mins) : T.focus.off; b.querySelector('.sr').textContent = b.title;
  left.hidden = !on; left.textContent = on ? mins + 'm' : '';
}
document.getElementById('btn-focus').onclick = () => {
  const cur = focusing() ? Math.round((focusUntil - Date.now()) / 60000) : 0;
  const next = FOCUS_STEPS.find(m => m > cur + 1); // 25 → 50 → off
  focusUntil = next ? Date.now() + next * 60000 : 0;
  store.set('focusUntil', focusUntil);
  if (!focusUntil) toast(`<b>${esc(T.focus.ended)}</b>`, 'ok');
  renderFocus();
};
setInterval(() => { if (focusUntil && !focusing()) { focusUntil = 0; store.set('focusUntil', 0); achBump('focusDone'); toast(`<b>${esc(T.focus.ended)}</b>`, 'ok'); } renderFocus(); }, 20000);

// the tools live in a menu behind ☰ (the bar keeps room for the office); toggles keep it open
const menuEl = document.getElementById('tools-menu'), menuBtn = document.getElementById('btn-menu');
document.body.appendChild(menuEl); // out of the bar: its overflow would clip the menu in some browsers
function setMenu(open) {
  menuEl.hidden = !open; menuBtn.setAttribute('aria-expanded', open);
  if (open) { const b = menuBtn.getBoundingClientRect(); menuEl.style.top = (b.bottom + 8) + 'px'; menuEl.style.right = Math.max(8, innerWidth - b.right) + 'px'; }
}
menuBtn.onclick = e => { e.stopPropagation(); setMenu(menuEl.hidden); };
menuEl.addEventListener('click', e => { if (e.target.closest('#btn-search,#btn-replay')) setMenu(false); });
document.addEventListener('click', e => { if (!menuEl.hidden && !e.target.closest('#tools-menu,#btn-menu')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menuEl.hidden) setMenu(false); });
addEventListener('resize', () => { if (!menuEl.hidden) setMenu(true); });
