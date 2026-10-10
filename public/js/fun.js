'use strict';
// ---------------- fun: holiday decor, office mood, the cat's errands, agent of the month ----------------

// ---- holidays: from the date (?date=MM-DD overrides it for testing); off with the "decor" setting ----
let decorOn = store.get('decor', true) !== false;
function easter(y) { // anonymous Gregorian algorithm
  const a = y % 19, b = (y / 100) | 0, c = y % 100, d = (b / 4) | 0, e = b % 4, f = ((b + 8) / 25) | 0, g = ((b - f + 1) / 3) | 0;
  const h = (19 * a + b - d - g + 15) % 30, i = (c / 4) | 0, k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = ((a + 11 * h + 22 * l) / 451) | 0;
  const month = ((h + l - 7 * m + 114) / 31) | 0, day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
function holidayToday() {
  if (!decorOn) return null;
  const now = new Date(), o = /^(\d\d)-(\d\d)$/.exec(qs.get('date') || '');
  const d = o ? new Date(now.getFullYear(), Number(o[1]) - 1, Number(o[2])) : now;
  const mo = d.getMonth() + 1, da = d.getDate();
  if ((mo === 12 && da === 31) || (mo === 1 && da === 1)) return 'newyear';
  if (mo === 12 && da <= 26) return 'xmas';
  if (mo === 10 && da >= 24) return 'halloween';
  if (mo === 6) return 'junina';
  const carnaval = easter(d.getFullYear()); carnaval.setDate(carnaval.getDate() - 47); // Shrove Tuesday
  const diff = Math.round((d - new Date(carnaval.getFullYear(), carnaval.getMonth(), carnaval.getDate())) / 864e5);
  if (diff >= -3 && diff <= 0) return 'carnaval';
  if (mo === 10 && da === 9) return 'birthday'; // the office opened on 2026-10-09
  return null;
}

// wall decor, drawn right after the wall (under the lighting, so lamps and the night apply)
const HATS = { xmas: 'santa', halloween: 'witch', newyear: 'party', birthday: 'party', carnaval: 'party', junina: 'straw' };
function drawHolidayWall(t, nWin) {
  const h = holidayToday();
  Art.setHat(h ? HATS[h] : null); // everyone dresses up for the day
  if (h && !qs.get('date')) achAdd('holidays', h + new Date().getFullYear());
  if (!h) return;
  const f = (t / 400) | 0;
  if (h === 'xmas' || h === 'newyear') {
    // a string of blinking bulbs along the top of the wall
    const wy = x => 5 + Math.round(Math.abs(Math.sin(x / 22)) * 4);
    for (let x = 4; x < CX - 8; x++) r(x, wy(x), 1, 1, '#1f3a1f');
    for (let x = 8, i = 0; x < CX - 10; x += 11, i++) {
      const y = wy(x) + 1, c = ['#e43b44', '#ffd84d', '#2ce8f5', '#63c74d', '#ff6ec7'][i % 5], lit = (i + f) % 4 !== 0;
      r(x, y, 2, 1, '#1f3a1f'); r(x - 1, y + 1, 4, 4, PAL.ink); r(x, y + 1, 2, 3, lit ? c : shadeHex(c, .4)); if (lit) r(x, y + 1, 1, 1, '#ffffffaa');
      if (lit && i % 2 === 0) wallGlows.push({ x: x + 1, y: y + 3, r: 9, c });
    }
  }
  if (h === 'junina' || h === 'carnaval') {
    // bandeirinhas: little coloured flags on two strings
    const cols = h === 'junina' ? ['#e43b44', '#ffd84d', '#0099db', '#63c74d', '#ff6ec7', '#feae34'] : ['#ff6ec7', '#ffd84d', '#2ce8f5', '#b55088', '#63c74d'];
    for (let x = 4, i = 0; x < CX - 8; x += 7, i++) {
      const y = 4 + Math.round(Math.abs(Math.sin(x / 40)) * 3), c = cols[i % cols.length], sway = ((f + i) % 4 === 0) ? 1 : 0;
      r(x, y, 7, 1, '#6b4a33');
      r(x + 1, y + 1, 5, 2, c); r(x + 2, y + 3, 3, 1, c); r(x + 3 + sway - 0, y + 4, 1, 1, c);
    }
  }
  if (h === 'halloween') {
    // cobwebs in the wall corners and bats crossing
    const web = (x, y, sx) => { const N = 16; for (let i = 0; i < N; i++) { r(x + sx * i, y + i, 1, 1, '#f0f0f8'); r(x + sx * i, y, 1, 1, '#f0f0f8cc'); r(x, y + i, 1, 1, '#f0f0f8cc'); } for (let k = 4; k < N; k += 4) for (let i = 0; i <= k; i++) r(x + sx * i, y + k - i, 1, 1, '#f0f0f8aa'); r(x + sx * 9, y + 14, 3, 3, PAL.ink); r(x + sx * 10, y + 10, 1, 4, '#f0f0f8aa'); };
    web(1, 4, 1); web(CX - 2, 4, -1);
    for (let i = 0; i < 4; i++) {
      const bx = ((t / 28 + i * 230) % (CX + 40)) - 20, by = 8 + i * 6 + Math.round(Math.sin(t / 200 + i) * 3), w = ((t / 110) | 0) % 2;
      r(bx, by, 4, 3, '#1b1622'); r(bx + 1, by - 1, 1, 1, '#1b1622'); r(bx + 2, by - 1, 1, 1, '#1b1622'); r(bx + 1, by + 1, 1, 1, '#e43b44');
      r(bx - 4, by - w, 4, 2, '#1b1622'); r(bx + 4, by - w, 4, 2, '#1b1622'); r(bx - 5, by + 1 - w * 2, 1, 1, '#1b1622'); r(bx + 8, by + 1 - w * 2, 1, 1, '#1b1622');
    }
  }
  if (h === 'carnaval') for (let i = 0; i < 26; i++) { const hh = hash('cf' + i), x = (hh % CX + t / 40 * ((hh >>> 3) % 3 + 1)) % CX, y = ((hh >>> 7) % 34 + t / 25 * ((hh >>> 9) % 2 + 1)) % 36; r(x, y + 2, 1, 1, ['#ff6ec7', '#ffd84d', '#2ce8f5', '#63c74d'][hh % 4]); }
  if (h === 'newyear' || h === 'birthday') {
    const txt = h === 'newyear' ? 'FELIZ ' + (new Date().getMonth() === 11 ? new Date().getFullYear() + 1 : new Date().getFullYear()) : 'HAPPY BIRTHDAY OFFICE';
    const label = h === 'newyear' && lang !== 'pt' ? txt.replace('FELIZ', 'HAPPY') : txt, w = label.length * 4 + 8, x = Math.max(4, ((CX / 2) | 0) - w / 2);
    r(x - 1, 13, w + 2, 11, PAL.ink); r(x, 14, w, 9, h === 'newyear' ? '#1b1d2e' : '#b55088');
    pixText(x + 4, 16, label, ((t / 300) | 0) % 2 ? '#ffd84d' : '#ffffff');
  }
}

// floor decor: a Christmas tree in the corridor, pumpkins, a cake in the kitchen
function drawHolidayFloor(t, glows) {
  drawRadio(RX + 58, TOP - 15, t);
  const h = holidayToday();
  if (!h) return;
  const f = (t / 350) | 0;
  if (h === 'xmas') {
    const x = CX - 10, y = TOP + 6;
    r(x + 8, y + 26, 4, 4, '#6b4a33');
    for (let i = 0; i < 4; i++) { const w = 6 + i * 4; r(x + 10 - w / 2, y + 4 + i * 6, w, 6, i % 2 ? '#2f7a3b' : '#3a8f46'); }
    r(x + 9, y, 2, 2, '#ffd84d'); r(x + 8, y + 1, 4, 1, '#ffd84d');
    for (let i = 0; i < 9; i++) { const hh = hash('orn' + i), oy = y + 6 + (hh % 22), ow = 6 + ((oy - y - 4) / 6 | 0) * 4; r(x + 10 - ow / 2 + 1 + (hh >>> 5) % Math.max(1, ow - 2), oy, 1, 1, ['#e43b44', '#ffd84d', '#2ce8f5', '#ffffff'][(i + f) % 4]); }
    r(x + 3, y + 30, 5, 4, '#e43b44'); r(x + 5, y + 30, 1, 4, '#ffd84d'); r(x + 13, y + 30, 5, 4, '#0099db'); r(x + 15, y + 30, 1, 4, '#ffffff');
    glows.push({ x: x + 10, y: y + 16, r: 26, c: '#ffd84d' });
  }
  if (h === 'halloween') for (const [i, py] of [TOP + 30, TOP + 160, TOP + 290].entries()) {
    if (py > H - 20) continue;
    const x = CX - 6;
    r(x, py, 12, 9, '#f77622'); r(x + 1, py - 1, 10, 1, '#f77622'); r(x + 5, py - 3, 2, 2, '#3a8f46');
    r(x + 2, py + 3, 2, 2, '#1b1622'); r(x + 8, py + 3, 2, 2, '#1b1622'); r(x + 3, py + 6, 6, 1, '#1b1622');
    if ((f + i) % 5) glows.push({ x: x + 6, y: py + 4, r: 18, c: '#feae34' });
  }
  if (h === 'birthday') {
    const x = RX + 40, y = TOP - 14;
    r(x, y + 6, 16, 6, '#f4dfc6'); r(x, y + 6, 16, 2, '#ff6ec7'); r(x - 1, y + 12, 18, 1, PAL.ink);
    for (let i = 0; i < 3; i++) { r(x + 3 + i * 5, y + 2, 1, 4, '#2ce8f5'); if ((f + i) % 3) r(x + 3 + i * 5, y, 1, 2, '#ffd84d'); }
    glows.push({ x: x + 8, y: y + 2, r: 16, c: '#ffd84d' });
  }
}
// snow (Christmas) or fireworks (New Year's Eve, at night) inside a window
function drawHolidayWindow(x, y, w, h, t, sky) {
  const hd = holidayToday();
  if (hd === 'xmas') { for (let i = 0; i < 16; i++) { const hh = hash('sn' + i + x), big = hh % 3 === 0, fx = x + 1 + ((hh % (w - 3)) + Math.round(Math.sin(t / 700 + i) * 1.5) + w) % (w - 3), fy = y + 1 + ((hh >>> 6) + t / 80 * (1 + (hh >>> 12) % 2)) % (h - 3); r(fx, fy, big ? 2 : 1, big ? 2 : 1, '#ffffff'); } r(x + 1, y + h - 4, w - 2, 3, '#f4f4fa'); }
  if (hd === 'newyear' && sky.phase !== 'day') {
    const cyc = (t / 1600 + x) % 3, cx = x + 10 + (hash('fw' + ((t / 1600) | 0) + x) % (w - 20)), cy = y + 10;
    if (cyc < 1.2) { const rr = Math.round(cyc * 8), c = ['#ffd84d', '#ff6ec7', '#2ce8f5'][((t / 1600) | 0) % 3]; for (let a = 0; a < 8; a++) r(cx + Math.round(Math.cos(a * Math.PI / 4) * rr), cy + Math.round(Math.sin(a * Math.PI / 4) * rr), 1, 1, c); }
  }
}

// ---- office mood: how busy the office is changes the room ----
// rush = most of the office working (the ON AIR sign lights, the coffee machine never stops),
// calm = nobody working (the lights dim a little and the robot vacuum gets to work)
function officeMood() {
  if (!data) return 'normal';
  const live = data.people.filter(p => !p.leaving);
  const work = live.filter(p => !['idle', 'asleep', 'needs_you', 'waiting'].includes(p.state)).length;
  if (work >= 3 && work / Math.max(1, live.length) >= .6) return 'rush';
  if (live.length && work === 0) return 'calm';
  return 'normal';
}
function drawMoodSign(x, y, t, glows) {
  const rush = officeMood() === 'rush', blink = rush && ((t / 900) | 0) % 6 !== 0;
  r(x - 1, y - 1, 26, 10, PAL.ink); r(x, y, 24, 8, blink ? '#5a0f16' : '#1b1622');
  pixText(x + 2, y + 2, 'ON AIR', blink ? '#ff4d57' : '#4a2a30');
  if (blink) glows.push({ x: x + 12, y: y + 4, r: 22, c: '#ff4d57' });
  moodBox = { x: x - 1, y: y - 1, w: 26, h: 10 };
}
let moodBox = null;
function moodShade() { // drawn over everything but the lit things, before the lights
  if (officeMood() !== 'calm') return;
  ctx.fillStyle = 'rgba(20, 18, 40, .12)'; ctx.fillRect(0, 0, W, H);
}

// ---- the cat: visits whoever has been waiting on you the longest, and likes being petted ----
let catHeart = 0;
function catErrand() {
  const waiting = layout.filter(c => c.actor && c.actor.mode === 'desk' && (c.p.state === 'needs_you' || c.p.state === 'waiting') && c.p.doing && c.p.doing.for > 60000)
    .sort((a, b) => b.p.doing.for - a.p.doing.for)[0];
  return waiting ? { x: waiting.chair.x + 22, y: waiting.chair.y + 12, id: waiting.p.id } : null;
}
function petCat() {
  catHeart = Date.now();
  achBump('pets');
  playTune('purr');
  checkAchievements();
}
function drawCatExtras(t) {
  if (Date.now() - catHeart < 1600) { const k = (Date.now() - catHeart) / 1600, y = cat.y - 12 - k * 10; r(cat.x + 3, y, 2, 1, '#ff6ec7'); r(cat.x + 6, y, 2, 1, '#ff6ec7'); r(cat.x + 2, y + 1, 7, 2, '#ff6ec7'); r(cat.x + 3, y + 3, 5, 1, '#ff6ec7'); r(cat.x + 4, y + 4, 3, 1, '#ff6ec7'); r(cat.x + 5, y + 5, 1, 1, '#ff6ec7'); }
  else if (cat.visit && cat.mode !== 'walk' && ((t / 500) | 0) % 2) Art.bubble(cat.x + 10, cat.y - 8, 'need', t);
  catBox = { x: cat.x - 2, y: cat.y - 10, w: 16, h: 14 };
}
let catBox = null;

// ---- agent of the month: a framed portrait on the wall, from the month's ranking (usage scan) ----
function drawAgentOfMonth(x, y, t, glows) {
  const m = usageData && usageData.month, top = m && m.top && m.top[0];
  r(x - 1, y - 1, 22, 26, PAL.ink); r(x, y, 20, 24, '#d9a441'); r(x + 1, y + 1, 18, 22, '#b07d2a'); r(x + 2, y + 2, 16, 20, '#2b2336');
  if (top) Art.blit(Art.portrait(top.id), x + 2, y + 3);
  else pixText(x + 8, y + 9, '?', '#5a4a3a');
  if (((t / 220) | 0) % 9 === 0) r(x + 17, y + 1, 1, 1, '#ffffff');
  // a dark plaque so the words read on the light wall
  r(x + 22, y - 2, 29, 29, PAL.ink); r(x + 23, y - 1, 27, 27, '#2b2336'); r(x + 23, y - 1, 27, 1, '#d9a441'); r(x + 23, y + 25, 27, 1, '#8a6420');
  pixText(x + 25, y + 1, 'AGENT', '#ffd84d'); pixText(x + 25, y + 7, 'OF THE', '#ffd84d'); pixText(x + 25, y + 13, 'MONTH', '#ffd84d');
  if (top) { const hh = Math.round(top.activeMs / 36e5) + 'H'; r(x + 25, y + 19, 23, 1, '#4a3d5a'); pixText(x + 49 - hh.length * 4, y + 20, hh, '#ffffff'); }
  glows.push({ x: x + 10, y: y + 12, r: 22, c: '#ffd84d' });
  aotmBox = { x: x - 1, y: y - 2, w: 53, h: 29 };
}
let aotmBox = null;

// petting: a click on the cat (it moves, so it's hit-tested on click instead of an overlay button)
overlay.addEventListener('click', e => {
  if (!catBox || e.target.closest('button,[data-id],[data-hall]')) return;
  const rc = overlay.getBoundingClientRect(), x = (e.clientX - rc.left) / S, y = (e.clientY - rc.top) / S;
  if (x >= catBox.x && x <= catBox.x + catBox.w && y >= catBox.y && y <= catBox.y + catBox.h) petCat();
});
