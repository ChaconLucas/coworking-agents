'use strict';
// ---------------- top bar ----------------
function renderBar() {
  document.getElementById('host').textContent = data.host || '';
  const c = { work: 0, need: 0, turn: 0, sleep: 0 };
  for (const p of data.people) {
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
  document.title = (c.need ? `(${c.need}) ` : '') + 'coworking-agents';
  const box = document.getElementById('clashes');
  const names = id => (data.people.find(p => p.id === id) || {}).name || id.slice(0, 6);
  box.innerHTML = data.clashes.map(cl => `<div>${T.clash(cl.who.map(names).map(esc).join(T.and), esc(cl.repo))}</div>`).join('');
  box.hidden = !data.clashes.length;
  const empty = document.getElementById('empty');
  empty.innerHTML = T.empty; empty.hidden = data.people.length > 0;
  for (const [id, on, label] of [['btn-notify', !!notifyOn, T.notify], ['btn-sound', soundOn, T.sound]]) {
    const b = document.getElementById(id);
    b.setAttribute('aria-pressed', on); b.title = label.replace(/^\S+\s/, ''); b.querySelector('.sr').textContent = b.title;
  }
  document.getElementById('btn-lang').textContent = T.lang;
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
function notifyChanges() {
  for (const p of data.people) {
    const before = prevStates.get(p.id);
    if (before && before !== p.state) {
      const urgent = p.state === 'needs_you' || p.state === 'waiting';
      const done = p.state === 'idle' && !['idle', 'asleep'].includes(before);
      if (done) doneUntil.set(p.id, Date.now() + 9000);
      if (urgent || done) {
        beep(urgent);
        if (notifyOn && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
          try { new Notification(`${p.name} ${T.states[p.state]}`, { body: p.title || '', tag: p.id }); } catch {}
        }
      }
    }
  }
  prevStates = new Map(data.people.map(p => [p.id, p.state]));
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
document.getElementById('btn-lang').onclick = () => { lang = lang === 'pt' ? 'en' : 'pt'; T = I18N[lang]; store.set('lang', lang); renderAll(); };
