'use strict';
// ---------------- top bar ----------------
function renderBar() {
  document.getElementById('host').textContent = data.host || '';
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
  for (const [id, on, label] of [['btn-notify', !!notifyOn, T.notify], ['btn-sound', soundOn, T.sound]]) {
    const b = document.getElementById(id);
    b.setAttribute('aria-pressed', on); b.title = `${label.replace(/^\S+\s/, '')}: ${on ? T.on : T.off}`; b.querySelector('.sr').textContent = b.title;
  }
  document.getElementById('btn-lang').textContent = T.lang;
  { const sb = document.getElementById('btn-search'); sb.title = T.keys.searchTitle; sb.querySelector('.sr').textContent = T.keys.searchTitle; }
  renderUsagePill();

  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
}

// ---------------- notifications ----------------
let prevStates = new Map(), audio = null;
function beep(urgent) {
  if (!soundOn) return;
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
const TUNES = { need: [[880, 0], [1175, .12]], done: [[784, 0], [1047, .1]], arrive: [[523, 0], [659, .09], [784, .18]], leave: [[659, 0], [440, .12]], limit: [[440, 0], [440, .18], [440, .36]] };
function playTune(kind) {
  if (!soundOn || !TUNES[kind]) return;
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

function notifyChanges() {
  const ids = new Set(data.people.filter(p => !p.leaving).map(p => p.id));
  if (prevStates.size) {
    if ([...ids].some(id => !prevStates.has(id))) playTune('arrive');
    else if ([...prevStates.keys()].some(id => !ids.has(id))) playTune('leave');
  }
  for (const p of data.people) {
    const before = prevStates.get(p.id);
    if (before && before !== p.state) {
      const urgent = p.state === 'needs_you' || p.state === 'waiting';
      const done = p.state === 'idle' && !['idle', 'asleep'].includes(before);
      if (done) doneUntil.set(p.id, Date.now() + 9000);
      if (urgent || done) {
        playTune(urgent ? 'need' : 'done');
        if (notifyOn && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
          try { new Notification(`${p.name} ${T.states[p.state]}`, { body: p.title || '', tag: p.id }); } catch {}
        }
      }
    }
  }
  prevStates = new Map(data.people.filter(p => !p.leaving).map(p => [p.id, p.state]));
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
document.getElementById('btn-lang').onclick = () => { lang = lang === 'pt' ? 'en' : 'pt'; T = I18N[lang]; store.set('lang', lang); renderAll(); };
