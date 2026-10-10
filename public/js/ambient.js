'use strict';
// ---------------- ambience: sky through the windows, seasons, rain on the glass, the chiptune radio ----------------

// ---- sky: the sun crosses the window during the day, the moon shows tonight's real phase, the city lights
// come on at dusk and go out late at night ----
function moonPhase(d = new Date()) { // 0 = new, .5 = full (synodic month from a known new moon)
  const days = (d - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
  return ((days % 29.530588) + 29.530588) % 29.530588 / 29.530588;
}
function drawSkyExtras(x, y, w, h, sky, t, i, hour) {
  if (sky.phase === 'night') {
    // cover the drawn crescent and paint the real phase (lit part grows from the right, then shrinks)
    const mx = x + w - 10, my = y + 2, p = moonPhase();
    r(mx - 1, my - 1, 8, 8, sky.top);
    if (p > .03 && p < .97) {
      for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 6; xx++) {
        const dx = xx - 2.5, dy = yy - 2.5;
        if (dx * dx + dy * dy > 9) continue;
        const k = (dx + 2.5) / 6, lit = p < .5 ? k > 1 - p * 2 : k < (1 - p) * 2; // waxing: right side lit
        r(mx + xx, my + yy, 1, 1, lit ? '#f4ecd8' : '#2a3050');
      }
    }
  } else if (sky.phase === 'day') {
    // the sun moves left to right from 7h to 17h30 and sinks a little near the ends
    const k = Math.max(0, Math.min(1, (hour - 7) / 10.5)), sx = x + 2 + Math.round(k * (w - 9)), sy = y + 3 + Math.round(Math.abs(k - .5) * 8);
    r(x + 4, y + 3, 5, 5, sky.top); r(sx, sy, 5, 5, '#ffe08a'); r(sx + 1, sy + 1, 2, 1, '#fff6c8');
  } else {
    // dawn/dusk: a big low sun on the horizon
    const sx = sky.phase === 'dawn' ? x + 6 : x + w - 14;
    r(sx, y + h - 9, 8, 4, '#ffd27a'); r(sx + 1, y + h - 10, 6, 1, '#ffd27a');
  }
  // city lights: a window in a building is lit by a hash threshold that follows the hour
  if (sky.phase !== 'day') {
    const on = hour >= 17 && hour < 23 ? .55 : hour >= 23 || hour < 1 ? .3 : hour < 5 ? .08 : .25;
    for (let k = 0; k < w; k += 6) {
      const hh = hash('b' + i + k) % 7;
      if (hh <= 3) continue;
      const lit = (hash('L' + i + k + ':' + ((t / 60000) | 0)) % 100) / 100 < on;
      r(x + k + 2, y + h - 2 - hh, 1, 1, lit ? '#feae34' : '#141629');
    }
  }
}

// ---- seasons, by month and hemisphere (south for South American, African and Oceanian time zones) ----
const SOUTH = /^(America\/(Sao_Paulo|Argentina|Santiago|Montevideo|Asuncion|La_Paz|Lima|Bahia|Fortaleza|Recife|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Rio_Branco|Maceio|Araguaina|Noronha)|Australia\/|Pacific\/Auckland|Africa\/(Johannesburg|Maputo|Harare|Windhoek|Lusaka))/;
function season(d = new Date()) {
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch {}
  const m = d.getMonth(), north = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][m];
  return SOUTH.test(tz) ? { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' }[north] : north;
}
// leaves in autumn, petals in spring, outside the window
function drawSeasonWindow(x, y, w, h, t) {
  const s = season();
  if (s !== 'autumn' && s !== 'spring') return;
  const cols = s === 'autumn' ? ['#d9822b', '#b5541c', '#e8b54a'] : ['#ff9ccf', '#ffffff', '#ffc0e0'];
  for (let i = 0; i < 4; i++) {
    const hh = hash('lf' + i + x), fx = x + ((hh % w) + Math.round(Math.sin(t / 600 + i) * 3) + w) % w, fy = y + ((hh >>> 6) + t / 160) % h;
    r(fx, fy, 2, 1, cols[hh % 3]);
  }
}
// the light in the room: a touch warmer in summer, cooler in winter
function seasonTint() {
  const s = season();
  if (s === 'summer') { ctx.fillStyle = 'rgba(255, 190, 90, .05)'; ctx.fillRect(0, 0, W, H); }
  if (s === 'winter') { ctx.fillStyle = 'rgba(120, 160, 230, .05)'; ctx.fillRect(0, 0, W, H); }
}

// ---- rain on the glass: drops that slide down when the real weather says rain ----
function drawGlassDrops(x, y, w, h, t) {
  if (!weather || (weather.kind !== 'rain' && weather.kind !== 'storm')) return;
  for (let i = 0; i < 6; i++) {
    const hh = hash('dr' + i + x), dx = x + 2 + hh % (w - 4), slide = ((t / 40 + (hh >>> 4)) % (h + 20)) - 10;
    if (slide < 0 || slide > h - 2) continue;
    r(dx, y + slide, 1, 2, '#cfe8ffcc'); r(dx, y + Math.max(0, slide - 4), 1, 3, '#cfe8ff55');
  }
}

// ---- the radio: generative chiptune; the station follows the AI that's working the most, the tempo
// follows the office mood. Off by default (☰ menu or click the radio in the kitchen). ----
let radioOn = store.get('radio', false) === true;
const STATIONS = {
  claude: { scale: [0, 2, 4, 7, 9], root: 57, wave: 'triangle', bass: 'triangle' },  // warm pentatonic
  codex: { scale: [0, 3, 5, 7, 10], root: 52, wave: 'square', bass: 'square' },       // minor, punchier
  other: { scale: [0, 2, 3, 7, 8], root: 55, wave: 'sawtooth', bass: 'triangle' },     // a little exotic
};
let radioTimer = 0, radioStep = 0, radioNext = 0, rainNode = null;
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
function radioStation() {
  const pick = opt('station'); if (pick !== 'auto') return { lofi: 'claude', upbeat: 'codex', retro: 'other' }[pick];
  if (!data) return 'claude';
  const n = {};
  for (const p of data.people) if (!p.leaving && !['idle', 'asleep'].includes(p.state)) n[p.agent] = (n[p.agent] || 0) + 1;
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return top ? (STATIONS[top[0]] ? top[0] : 'other') : 'claude';
}
function radioNote(freq, at, len, wave, vol) {
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = wave; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(.0001, at + len);
  o.connect(g).connect(audio.destination); o.start(at); o.stop(at + len + .02);
}
function radioTick() {
  if (!radioOn || !soundOn) return;
  const mood = officeMood(), bpm = mood === 'rush' ? 132 : mood === 'calm' ? 78 : 104, step = 60 / bpm / 2;
  const st = STATIONS[radioStation()];
  while (radioNext < audio.currentTime + .25) {
    const bar = Math.floor(radioStep / 16), beat = radioStep % 16, chord = [0, 3, 4, 2][bar % 4];
    const h = Art.hash('rad' + bar + ':' + beat + st.root);
    if (beat % 2 === 0 && h % 3 !== 0) radioNote(midi(st.root + 12 + st.scale[(chord + (h >>> 3)) % st.scale.length] + (h % 7 === 0 ? 12 : 0)), radioNext, step * .9, st.wave, .018);
    if (beat % 4 === 0) radioNote(midi(st.root - 12 + st.scale[chord % st.scale.length]), radioNext, step * 1.8, st.bass, .03);
    if (mood === 'rush' && beat % 4 === 2) radioNote(1800 + (h % 400), radioNext, .03, 'square', .006); // hi-hat tick
    radioNext += step; radioStep++;
  }
}
function rainSound(on) {
  try {
    if (on && !rainNode) {
      const len = audio.sampleRate * 2, buf = audio.createBuffer(1, len, audio.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
      src.buffer = buf; src.loop = true; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = .012;
      src.connect(f).connect(g).connect(audio.destination); src.start();
      rainNode = { src, g };
    } else if (!on && rainNode) { rainNode.src.stop(); rainNode = null; }
  } catch {}
}
function setRadio(on) {
  radioOn = on; store.set('radio', on);
  try { audio = audio || new AudioContext(); if (audio.state === 'suspended') audio.resume(); } catch {}
  clearInterval(radioTimer);
  if (on) { radioNext = audio.currentTime + .1; radioTimer = setInterval(() => { radioTick(); rainSound(radioOn && soundOn && weather && (weather.kind === 'rain' || weather.kind === 'storm')); }, 100); achBump('radio'); }
  else rainSound(false);
  if (data) renderBar();
}
if (radioOn) document.addEventListener('pointerdown', () => setRadio(true), { once: true }); // browsers need a gesture before sound

// the radio on the kitchen counter: notes float out while it plays; click to switch it
function drawRadio(x, y, t) {
  r(x - 1, y - 1, 14, 9, PAL.ink); r(x, y, 12, 7, '#b5541c'); r(x + 1, y + 1, 5, 5, '#3b2a20');
  for (let k = 0; k < 3; k++) r(x + 2 + (k % 2) * 2, y + 2 + k, 1, 1, '#6b4a33');
  r(x + 8, y + 2, 3, 1, radioOn ? '#63c74d' : '#5a4a3a'); r(x + 8, y + 4, 1, 1, '#ffd84d'); r(x + 10, y + 4, 1, 1, '#ffd84d');
  r(x + 9, y - 4, 1, 4, PAL.ink);
  if (radioOn) for (let i = 0; i < 2; i++) { const k = ((t / 1400 + i / 2) % 1), nx = x + 6 + Math.round(Math.sin(k * 6 + i) * 3) + i * 4, ny = y - 4 - Math.round(k * 12); r(nx, ny, 2, 2, '#ffd84d'); r(nx + 1, ny - 3, 1, 3, '#ffd84d'); }
  radioBox = { x: x - 1, y: y - 5, w: 14, h: 13 };
}
let radioBox = null;
