'use strict';
// Arte do escritório: paleta, sprites desenhados à mão, mobília, luz e o gato.
// Tudo em retângulos sobre um canvas de baixa resolução, ampliado sem suavização.
(() => {

// ---------------- paleta (base Endesga 32) ----------------
const PAL = {
  ink: '#2a1d27', ink2: '#3e2731',
  floor: ['#c28569', '#b97c60', '#c99071'], floorGap: '#8f553f', floorKnot: '#a86a52',
  wall: '#ead4aa', wallShade: '#d9bd8f', wallTrim: '#8f553f', base: '#6e3f31',
  deskTop: '#c37a55', deskLight: '#dc9a6c', deskFront: '#8f4f3a', deskDark: '#733e2f',
  fabric: '#5a6988', fabricDot: '#4f5c7a', alu: '#c0cbdc', aluDark: '#8b9bb4',
  bezel: '#262b44', bezelLight: '#3a4466',
  chair: '#3a4466', chairLight: '#5a6988', chairDark: '#262b44',
  leaf: '#3e8948', leafLight: '#63c74d', pot: '#be4a2f', potDark: '#8f2f24',
  sofa: '#2c6e75', sofaLight: '#3f9aa3', sofaDark: '#1f4f55',
  rug: '#b55088', rugDark: '#8e3e6c', rugLight: '#d97aa8',
  white: '#ffffff', paper: '#f4ecd8', paperLine: '#b9a88a',
  red: '#e43b44', amber: '#feae34', green: '#63c74d', blue: '#0099db', cyan: '#2ce8f5', purple: '#b55088',
};
const SKIN = [['#f2c7a5', '#d9a07c'], ['#e4a672', '#c4835a'], ['#c27c4e', '#9c5f3a'], ['#8f5637', '#6e3f28'], ['#5e3a26', '#46291b']];
const HAIR = [['#2a1d27', '#181116'], ['#5d3a28', '#43291c'], ['#8f553f', '#6e3f31'], ['#e8b04b', '#be8a2c'], ['#d9d9e0', '#a8a8b8'], ['#b13e53', '#862c3e'], ['#3b5dc9', '#2a4290'], ['#f77622', '#c4561a']];
const SHIRT = ['#e43b44', '#3e8948', '#feae34', '#0099db', '#b55088', '#f77622', '#5a6988', '#2ce8f5', '#63c74d', '#f4ecd8', '#733e39', '#68386c'];
const PANTS = ['#262b44', '#3a4466', '#3e2731', '#5d3a28'];

function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function shade(hex, f) {
  const n = parseInt(hex.slice(1, 7), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
function look(id) {
  const h = hash(id);
  const skin = SKIN[h % SKIN.length], hair = HAIR[(h >>> 3) % HAIR.length], shirt = SHIRT[(h >>> 7) % SHIRT.length];
  return {
    s: skin[0], S: skin[1], h: hair[0], H: hair[1], c: shirt, C: shade(shirt, .72), p: PANTS[(h >>> 11) % PANTS.length],
    style: ['short', 'short', 'long', 'bun', 'spiky'][(h >>> 14) % 5], glasses: (h >>> 18) % 4 === 0,
  };
}

let ctx = null;
function setCtx(c) { ctx = c; }
function r(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }

// ---------------- sprites ----------------
// Cada letra é uma cor: o contorno, s/S pele, h/H cabelo, c/C camisa, p calça, k sapato, e olho, m boca, g óculos.
const HEAD_BACK = [
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhHo..',
  '..ohhhhhhhhhHo..',
  '.oshhhhhhhhhHso.',
  '.oshhhhhhhhHHso.',
  '..oHhhhhhhhHHo..',
  '...oHHHHHHHHo...',
  '.....oSSSSo.....',
];
const HEAD_FRONT = [
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohsssssssSho..',
  '.ohssessssessho.',
  '.oSssssssssssSo.',
  '..oSsssmmsssSo..',
  '...oSSSSSSSSo...',
  '.....oSSSSo.....',
];
const BODY = [
  '..ooccccccccoo..',
  '.occcccccccccCo.',
  'occcccccccccccCo',
  'occCccccccccCcCo',
  'occCccccccccCcCo',
  'osSCccccccccCSso',
  'oooCCCCCCCCCCooo',
];
const LEGS_STAND = [
  ['....oppppppo....', '....oppooppo....', '....oppooppo....', '....oppooppo....', '....oppooppo....', '...okkkookkko...', '...oooo..oooo...'],
  ['....oppppppo....', '....oppooppo....', '....oppooppo....', '....oppooppo....', '...okkkooppo....', '...oooo.okkko...', '........oooo....'],
  ['....oppppppo....', '....oppooppo....', '....oppooppo....', '....oppooppo....', '....oppookkko...', '...okkko.oooo...', '...oooo.........'],
];
const LEGS_SIT = ['...oppppppppo...', '...opppoopppo...', '...okkkookkko...', '...oooo..oooo...'];
const CAT = {
  walk: [['f.......f.f.', 'f.......ffff', 'f.......fefe', 'fffffffffffk', '.fFfFfFffff.', '.ffffffffff.', '.f.f....f.f.'],
    ['f.......f.f.', 'f.......ffff', 'f.......fefe', 'fffffffffffk', '.fFfFfFffff.', '.ffffffffff.', '..f.f..f.f..']],
  sit: ['....f.f.', '....ffff', '....fefe', 'f...fffk', 'f..fFff.', '.ffffff.', '.ffffff.'],
  sleep: ['..........', '...f.f....', '..fFfFfff.', '.fffffffff', 'fffffffffk', '.ffffffff.'],
};

const spriteCache = new Map();
function sprite(rows, colors, key) {
  const k = key + '|' + JSON.stringify(colors);
  let cv = spriteCache.get(k);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = rows[0].length; cv.height = rows.length;
  const c = cv.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = row[x] === '.' ? null : colors[row[x]];
      if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
    }
  });
  spriteCache.set(k, cv);
  return cv;
}
function blit(cv, x, y, flip) {
  if (!flip) return ctx.drawImage(cv, x | 0, y | 0);
  ctx.save(); ctx.translate((x | 0) + cv.width, y | 0); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0); ctx.restore();
}
function colorsOf(lk, extra) {
  return Object.assign({ o: PAL.ink, s: lk.s, S: lk.S, h: lk.h, H: lk.H, c: lk.c, C: lk.C, p: lk.p, k: PAL.ink2, e: PAL.ink, m: '#8a3a3a', g: PAL.ink }, extra || {});
}

function hairExtras(lk, x, y, front) {
  const o = PAL.ink;
  if (lk.style === 'bun') { r(x + 5, y - 3, 6, 4, o); r(x + 6, y - 2, 4, 3, lk.h); r(x + 6, y - 2, 4, 1, shade(lk.h, 1.25)); }
  if (lk.style === 'spiky') { for (const sx of [4, 7, 10]) { r(x + sx, y - 2, 2, 3, o); r(x + sx, y - 1, 1, 2, lk.h); } }
  if (lk.style === 'long') {
    if (front) { r(x + 1, y + 4, 2, 8, o); r(x + 13, y + 4, 2, 8, o); r(x + 2, y + 4, 1, 7, lk.h); r(x + 13, y + 4, 1, 7, lk.h); }
    else { r(x + 3, y + 8, 10, 6, o); r(x + 4, y + 8, 8, 5, lk.h); r(x + 4, y + 12, 8, 1, lk.H); }
  }
  // brilho do cabelo
  r(x + 5, y + 1, 3, 1, shade(lk.h, 1.35));
}

// Pessoa sentada de costas, virada para o monitor.
function drawSeatedBack(x, y, lk, t, opts) {
  const f = (t / 140) | 0;
  const breathe = (t / 900 | 0) % 2;
  const col = colorsOf(lk);
  const typing = opts.typing, reading = opts.reading;
  if (typing) {
    const a = f % 2;
    r(x - 2, y + 5 - a, 4, 4, PAL.ink); r(x - 1, y + 6 - a, 2, 2, lk.s);
    r(x + 14, y + 4 + a, 4, 4, PAL.ink); r(x + 15, y + 5 + a, 2, 2, lk.s);
  }
  if (reading) {
    r(x - 3, y - 4, 22, 9, PAL.ink); r(x - 2, y - 3, 20, 7, PAL.paper);
    for (let i = 0; i < 3; i++) r(x, y - 2 + i * 2, 7 + ((i * 5) % 7), 1, PAL.paperLine), r(x + 10, y - 2 + i * 2, 5, 1, PAL.paperLine);
    r(x - 3, y + 2, 3, 3, lk.s); r(x + 16, y + 2, 3, 3, lk.s);
  }
  blit(sprite(BODY, col, 'body'), x, y + 10 + breathe);
  blit(sprite(HEAD_BACK, col, 'hb'), x, y + breathe);
  hairExtras(lk, x, y + breathe, false);
}

function drawFront(x, y, lk, t, opts) {
  const f = (t / 140) | 0;
  const blink = ((t / 140) | 0) % 30 === 0;
  const col = colorsOf(lk, blink ? { e: lk.s } : null);
  if (opts.mouth === 'open') col.m = '#5a1f2a';
  if (opts.mouth === 'flat') col.m = lk.S;
  blit(sprite(BODY, col, 'body'), x, y + 10);
  if (opts.legs) blit(sprite(opts.legs, col, 'legs' + opts.legsKey), x, y + 17);
  blit(sprite(HEAD_FRONT, col, 'hf'), x, y);
  hairExtras(lk, x, y, true);
  if (lk.glasses && !blink) { r(x + 4, y + 5, 3, 1, PAL.ink); r(x + 9, y + 5, 3, 1, PAL.ink); r(x + 7, y + 5, 2, 1, PAL.ink); }
  if (opts.wave) {
    const up = f % 2;
    r(x + 14, y + 1 + up, 4, 11, PAL.ink); r(x + 15, y + 3 + up, 2, 8, lk.c); r(x + 15, y + 1 + up, 2, 2, lk.s);
  }
  if (opts.mug) {
    r(x + 10, y + 13, 6, 6, PAL.ink); r(x + 11, y + 14, 4, 4, PAL.white); r(x + 11, y + 14, 4, 1, '#6e3f31'); r(x + 15, y + 15, 2, 2, PAL.ink);
    if (f % 8 < 5) { r(x + 12, y + 10 - (f % 3), 1, 2, '#ffffffaa'); r(x + 14, y + 9 - ((f + 1) % 3), 1, 2, '#ffffff88'); }
  }
}

function drawStanding(x, y, lk, t, walking) {
  const f = (t / 160) | 0;
  const frame = walking ? 1 + (f % 2) : 0;
  const col = colorsOf(lk);
  r(x + 2, y + 23, 12, 2, '#0000002a');
  drawFront(x, y - (walking && f % 2 ? 1 : 0), lk, t, { legs: LEGS_STAND[frame], legsKey: 's' + frame });
}

function drawSleeping(x, y, lk, t) {
  const col = colorsOf(lk);
  // braços cruzados na mesa e cabeça deitada
  r(x - 2, y + 4, 20, 6, PAL.ink); r(x - 1, y + 5, 18, 4, lk.c); r(x - 1, y + 8, 18, 1, lk.C);
  blit(sprite(HEAD_BACK.slice(0, 9), col, 'hbs'), x, y - 2);
  hairExtras(lk, x, y - 2, false);
  blit(sprite(BODY, col, 'body'), x, y + 10);
}

function drawChairBack(x, y) {
  r(x - 1, y, 18, 11, PAL.ink); r(x, y + 1, 16, 9, PAL.chair); r(x, y + 1, 16, 2, PAL.chairLight); r(x + 2, y + 8, 12, 1, PAL.chairDark);
}
function drawChairBase(x, y) {
  r(x + 7, y, 2, 5, PAL.ink); r(x + 1, y + 5, 14, 2, PAL.ink); r(x, y + 6, 2, 2, PAL.ink2); r(x + 14, y + 6, 2, 2, PAL.ink2); r(x + 7, y + 7, 2, 1, PAL.ink2);
}

function drawCat(x, y, mode, t, flip) {
  const col = { f: '#f77622', F: '#be4a2f', e: PAL.ink, k: '#f4a6b0' };
  const f = (t / 180) | 0;
  r(x + 1, y + 7, 10, 1, '#0000002a');
  if (mode === 'sleep') { blit(sprite(CAT.sleep, col, 'cs'), x, y + 1, flip); if (f % 10 < 5) r(x + (flip ? -2 : 10), y - 3 - (f % 5 < 3 ? 1 : 0), 2, 2, '#ffffffaa'); }
  else if (mode === 'sit') blit(sprite(CAT.sit, col, 'ct'), x + 2, y, flip);
  else blit(sprite(CAT.walk[f % 2], col, 'cw' + (f % 2)), x, y, flip);
}

// ---------------- balões ----------------
function bubble(x, y, kind, t) {
  const f = (t / 140) | 0;
  if (kind === 'need') y += f % 4 < 2 ? 0 : -1;
  r(x + 1, y + 1, 15, 11, '#00000033');
  r(x - 1, y - 1, 15, 11, PAL.ink); r(x, y, 13, 9, PAL.white); r(x + 3, y + 10, 3, 2, PAL.ink); r(x + 4, y + 9, 2, 2, PAL.white);
  if (kind === 'need') { r(x + 5, y + 1, 3, 5, PAL.red); r(x + 5, y + 7, 3, 1, PAL.red); }
  else if (kind === 'wait') { r(x + 4, y + 1, 5, 1, PAL.amber); r(x + 8, y + 2, 1, 2, PAL.amber); r(x + 6, y + 4, 2, 2, PAL.amber); r(x + 6, y + 7, 2, 1, PAL.amber); }
  else if (kind === 'think') { for (let k = 0; k < 3; k++) r(x + 2 + k * 4, y + 4 - (k === f % 3 ? 1 : 0), 2, 2, '#68386c'); }
  else if (kind === 'zz') {
    const p = f % 6 > 2 ? 0 : 1, c = '#3a4466';
    r(x + 2, y + 1 + p, 5, 1, c); r(x + 5, y + 2 + p, 1, 1, c); r(x + 4, y + 3 + p, 1, 1, c); r(x + 3, y + 4 + p, 1, 1, c); r(x + 2, y + 5 + p, 5, 1, c);
    r(x + 8, y + 1, 3, 1, '#8b9bb4'); r(x + 9, y + 2, 1, 1, '#8b9bb4'); r(x + 8, y + 3, 3, 1, '#8b9bb4');
  }
}

// ---------------- telas ----------------
const SCREEN_GLOW = { edit: '#7aa2f7', read: '#f4ecd8', terminal: '#63c74d', web: '#2ce8f5', delegate: '#feae34', skill: '#b55088', mcp: '#2ce8f5', other: '#c0cbdc', thinking: '#b4a0f0', needs_you: '#e43b44', waiting: '#feae34', idle: '#3b5dc9', asleep: null };
function drawScreen(x, y, w, h, state, t, seed) {
  const f = (t / 140) | 0;
  if (state === 'asleep') { r(x, y, w, h, '#14141c'); r(x + 2, y + 1, 4, 1, '#ffffff10'); return; }
  if (state === 'idle') {
    r(x, y, w, h, '#181a2e');
    for (let k = 0; k < 6; k++) { const hh = hash(seed + 's' + k); r(x + (hh % w), y + ((hh >>> 8) + f) % h, 1, 1, '#ffffff66'); }
    const px = Math.abs(((f + seed) % (2 * (w - 4))) - (w - 4)), py = Math.abs(((f * 2 + seed) % (2 * (h - 4))) - (h - 4));
    return r(x + px, y + py, 4, 3, SHIRT[(f / 20 | 0) % SHIRT.length]);
  }
  if (state === 'terminal') {
    r(x, y, w, h, '#0c1410');
    const lines = (h / 2 | 0) - 1;
    for (let i = 0; i < lines; i++) { const hh = hash(seed + ':' + (i + f)); r(x + 2, y + 1 + i * 2, 1, 1, '#feae34'); r(x + 4, y + 1 + i * 2, 2 + hh % (w - 7), 1, '#63c74d'); }
    if (f % 2) r(x + 4, y + 1 + lines * 2, 3, 1, '#63c74d');
    return;
  }
  if (state === 'edit') {
    r(x, y, w, h, '#1e2233'); r(x, y, 5, h, '#171a29');
    const lines = (h / 2) | 0, typed = f % (lines * 3);
    for (let i = 0; i < lines; i++) {
      r(x + 1, y + 1 + i * 2, 2, 1, '#3a4466');
      const hh = hash(seed + 'e' + i), ind = (hh % 3) * 2, len = 3 + (hh >>> 4) % (w - 10 - ind);
      const show = i < typed / 3 ? len : i === ((typed / 3) | 0) ? Math.min(len, (typed % 3) * 4) : 0;
      if (show) r(x + 6 + ind, y + 1 + i * 2, show, 1, ['#7aa2f7', '#bb9af7', '#9ece6a', '#e0af68', '#f7768e'][hh % 5]);
      if (i === ((typed / 3) | 0) && f % 2) r(x + 6 + ind + show, y + i * 2, 1, 2, '#fff');
    }
    return;
  }
  if (state === 'read') {
    r(x, y, w, h, '#f4ecd8'); r(x, y, w, 2, '#d9cdb0');
    for (let i = 0; i < h / 2 - 1; i++) { const hh = hash(seed + 'r' + (i + (f >> 1))); r(x + 3, y + 3 + i * 2, 4 + hh % (w - 10), 1, '#9a8f7d'); }
    r(x + w - 2, y + 2 + ((f >> 1) % (h - 5)), 1, 3, '#7a6f5d');
    return;
  }
  if (state === 'web') {
    r(x, y, w, h, '#dff3fb'); r(x, y, w, 3, '#c0cbdc'); r(x + 2, y + 1, 1, 1, PAL.red); r(x + 4, y + 1, 1, 1, PAL.amber); r(x + 6, y + 1, 1, 1, PAL.green);
    const cx = x + w / 2, cy = y + h / 2 + 2, R = Math.min(w, h) / 2 - 3;
    for (let a = 0; a < 28; a++) r(cx + Math.cos(a / 28 * 6.283) * R, cy + Math.sin(a / 28 * 6.283) * R, 1, 1, '#0099db');
    const m = Math.cos(f / 3) * R;
    for (let k = -R; k <= R; k++) r(cx + m * Math.sqrt(Math.max(0, 1 - (k / R) ** 2)), cy + k, 1, 1, '#0099db');
    r(cx - R, cy, R * 2, 1, '#0099db');
    return;
  }
  if (state === 'delegate') {
    r(x, y, w, h, '#2a2620');
    const c = '#feae34';
    r(x + w / 2 - 4, y + 2, 8, 4, c); r(x + w / 2, y + 6, 1, 3, c); r(x + 4, y + 9, w - 8, 1, c);
    for (let k = 0; k < 3; k++) { const bx = x + 4 + k * ((w - 10) / 2); r(bx, y + 9, 1, 3, c); r(bx - 2, y + 12, 5, 4, (f + k) % 3 === 0 ? '#fff' : c); }
    return;
  }
  if (['skill', 'mcp', 'other', 'thinking'].includes(state)) {
    r(x, y, w, h, { skill: '#2b1f33', mcp: '#10302d', other: '#262b33', thinking: '#221f38' }[state]);
    const c = SCREEN_GLOW[state], cx = x + w / 2 | 0, cy = y + h / 2 | 0, p = f % 4;
    if (state === 'mcp') { r(cx - 4, cy - 2, 8, 6, c); r(cx - 3, cy - 6, 2, 4, c); r(cx + 1, cy - 6, 2, 4, c); r(cx - 1, cy + 4, 2, 3 + (f % 2), c); }
    else if (state === 'skill') { const s = p === 0 ? 3 : 5; r(cx, cy - s, 1, s * 2 + 1, c); r(cx - s, cy, s * 2 + 1, 1, c); r(cx - 1, cy - 1, 3, 3, '#fff'); }
    else for (let k = 0; k < 3; k++) r(cx - 6 + k * 5, cy - (k === p ? 1 : 0), 3, 3, c);
    return;
  }
  const c = SCREEN_GLOW[state] || '#888';
  r(x, y, w, h, f % 4 < 2 ? c : shade(c, .55));
  r(x + w / 2 - 1, y + 3, 3, h - 9, '#fff'); r(x + w / 2 - 1, y + h - 5, 3, 3, '#fff');
}

// ---------------- mobília ----------------
function drawPlant(x, y, big) {
  const s = big ? 1.4 : 1;
  r(x + 1, y + 13 * s, 10, 2, '#0000002a');
  r(x, y + 8 * s, 12, 7 * s, PAL.ink); r(x + 1, y + 8 * s + 1, 10, 7 * s - 2, PAL.pot); r(x + 1, y + 8 * s + 1, 10, 1, '#e06a4a'); r(x + 1, y + 14 * s - 2, 10, 1, PAL.potDark);
  const leaves = [[5, 0, 3, 9], [1, 3, 4, 6], [8, 2, 4, 7], [3, -2, 2, 6], [9, -1, 2, 5]];
  for (const [lx, ly, lw, lh] of leaves) { r(x + lx - 1, y + ly * s - 1, lw + 2, lh * s + 1, PAL.ink); }
  for (const [lx, ly, lw, lh] of leaves) { r(x + lx, y + ly * s, lw, lh * s, PAL.leaf); r(x + lx, y + ly * s, 1, lh * s - 1, PAL.leafLight); }
}

function drawCertificate(x, y, color, badge) {
  r(x + 1, y + 1, 11, 9, '#00000033');
  r(x, y, 11, 9, PAL.ink); r(x + 1, y + 1, 9, 7, color); r(x + 2, y + 2, 7, 5, PAL.paper);
  r(x + 3, y + 3, 5, 1, PAL.paperLine); r(x + 3, y + 5, 3, 1, PAL.paperLine);
  r(x + 7, y + 5, 2, 2, badge ? PAL.red : '#e8b04b');
  if (badge) { r(x + 7, y + 7, 1, 2, PAL.red); r(x + 8, y + 7, 1, 2, '#be4a2f'); }
}

function drawLamp(x, y, on) {
  r(x + 2, y + 10, 6, 2, PAL.ink); r(x + 4, y + 3, 2, 7, PAL.ink);
  r(x, y, 9, 4, PAL.ink); r(x + 1, y + 1, 7, 2, on ? '#feae34' : '#5a6988');
  if (on) r(x + 1, y + 3, 7, 1, '#ffe08a');
}

function drawWhiteboard(x, y, w, h, counts, t) {
  r(x - 1, y - 1, w + 2, h + 2, PAL.ink); r(x, y, w, h, '#f4f4f8'); r(x, y + h - 2, w, 2, '#c0cbdc');
  r(x + 2, y + h, w - 4, 2, PAL.aluDark); r(x + 6, y + h, 4, 1, PAL.red); r(x + 12, y + h, 4, 1, PAL.blue);
  // gráfico de barras com o estado do escritório
  const bars = [[counts.work, PAL.green], [counts.need, PAL.red], [counts.turn, PAL.blue], [counts.sleep, '#8b9bb4']];
  const max = Math.max(1, ...bars.map(b => b[0]));
  const bw = Math.floor((w - 10) / bars.length);
  bars.forEach(([n, c], i) => {
    const bh = Math.round((h - 9) * n / max);
    const bx = x + 5 + i * bw;
    r(bx, y + h - 4 - bh, bw - 3, bh, c);
    for (let k = 0; k < n && k < 9; k++) r(bx + 1 + (k % 3) * 2, y + 2 + ((k / 3) | 0) * 2, 1, 1, PAL.ink);
  });
  r(x + 3, y + h - 4, w - 6, 1, PAL.ink2);
}

function drawCork(x, y, w, h, top) {
  r(x - 2, y - 2, w + 4, h + 4, PAL.ink); r(x - 1, y - 1, w + 2, h + 2, '#8f553f'); r(x, y, w, h, '#d29a5c');
  for (let k = 0; k < 50; k++) { const hh = hash('cork' + k); r(x + hh % w, y + (hh >>> 8) % h, 1, 1, '#b97c48'); }
  const medal = [['#feae34', '#be8a2c'], ['#c0cbdc', '#8b9bb4'], ['#e07a4a', '#a8552e']];
  top.slice(0, 3).forEach((s, i) => {
    const mx = x + 5 + i * Math.floor((w - 6) / 3), my = y + 3;
    r(mx + 2, my, 2, 6, PAL.red); r(mx + 6, my, 2, 6, PAL.blue);
    r(mx, my + 6, 10, 10, PAL.ink); r(mx + 1, my + 7, 8, 8, medal[i][0]); r(mx + 1, my + 13, 8, 2, medal[i][1]); r(mx + 3, my + 9, 2, 2, '#ffffffaa');
    r(mx - 1, my + 19, 12, 6, PAL.paper); r(mx, my + 21, 9, 1, PAL.paperLine); r(mx, my + 23, 6, 1, PAL.paperLine);
  });
  if (!top.length) for (let i = 0; i < 3; i++) { r(x + 6 + i * 22, y + 6, 14, 10, PAL.paper); r(x + 12 + i * 22, y + 4, 2, 2, PAL.red); }
}

function drawClock(cx, cy) {
  r(cx - 8, cy - 8, 17, 17, PAL.ink); r(cx - 7, cy - 7, 15, 15, PAL.paper); r(cx - 7, cy - 7, 15, 1, '#ffffff');
  for (const [dx, dy] of [[0, -6], [6, 0], [0, 6], [-6, 0]]) r(cx + dx, cy + dy, 1, 1, PAL.ink2);
  const now = new Date(), a1 = (now.getHours() % 12 + now.getMinutes() / 60) / 12 * Math.PI * 2, a2 = now.getMinutes() / 60 * Math.PI * 2;
  for (let k = 0; k < 4; k++) r(cx + Math.round(Math.sin(a1) * k), cy - Math.round(Math.cos(a1) * k), 1, 1, PAL.ink);
  for (let k = 0; k < 6; k++) r(cx + Math.round(Math.sin(a2) * k), cy - Math.round(Math.cos(a2) * k), 1, 1, PAL.red);
}

function skyFor(hr) {
  if (hr < 5.5 || hr >= 20) return { top: '#1b1f3b', bot: '#2a3466', phase: 'night' };
  if (hr < 7) return { top: '#f77622', bot: '#feae34', phase: 'dawn' };
  if (hr >= 17.5) return { top: '#b55088', bot: '#f77622', phase: 'dusk' };
  return { top: '#0099db', bot: '#7fd3f5', phase: 'day' };
}

function drawWindow(x, y, w, h, sky, t, i) {
  r(x - 3, y - 3, w + 6, h + 6, PAL.ink); r(x - 2, y - 2, w + 4, h + 4, '#f4f4f8');
  r(x, y, w, h / 2, sky.top); r(x, y + h / 2, w, h / 2, sky.bot);
  if (sky.phase === 'night') {
    for (let k = 0; k < 7; k++) { const hh = hash(i + ':' + k); r(x + hh % w, y + (hh >>> 8) % (h - 4), 1, 1, ((t / 700) + k) % 4 < 3 ? '#ffffff' : '#8b9bb4'); }
    r(x + w - 9, y + 3, 5, 5, '#f4ecd8'); r(x + w - 7, y + 3, 3, 3, sky.top);
  } else {
    const cx = x - 14 + ((t / 220 + i * 37) % (w + 28));
    for (const [dx, dy, ww] of [[0, 6, 12], [3, 4, 6], [-2, 8, 16]]) {
      const a = Math.max(x, cx + dx), b = Math.min(x + w, cx + dx + ww);
      if (b > a) r(a, y + dy, b - a, 2, '#ffffffd0');
    }
    if (sky.phase === 'day') { r(x + 4, y + 3, 5, 5, '#ffe08a'); }
  }
  // prédios ao longe
  for (let k = 0; k < w; k += 6) { const hh = hash('b' + i + k) % 7; r(x + k, y + h - 3 - hh, 5, 3 + hh, sky.phase === 'night' ? '#141629' : '#00000030'); if (sky.phase === 'night' && hh > 3) r(x + k + 2, y + h - 2 - hh, 1, 1, '#feae34'); }
  r(x + w / 2 - 1, y, 2, h, '#f4f4f8'); r(x, y + h / 2 - 1, w, 2, '#f4f4f8');
  r(x - 4, y + h + 3, w + 8, 2, PAL.ink); r(x - 3, y + h + 3, w + 6, 1, '#f4f4f8');
}

function drawSofa(x, y, w) {
  r(x + 2, y + 22, w - 4, 3, '#00000030');
  r(x - 1, y - 1, w + 2, 22, PAL.ink);
  r(x, y, w, 10, PAL.sofaDark); r(x, y, w, 1, PAL.sofaLight);
  for (let k = 1; k < 3; k++) r(x + (w / 3) * k, y + 1, 1, 8, PAL.ink2);
  r(x, y + 10, w, 8, PAL.sofa); r(x, y + 10, w, 1, PAL.sofaLight);
  r(x - 4, y + 4, 6, 16, PAL.ink); r(x - 3, y + 5, 4, 14, PAL.sofa); r(x - 3, y + 5, 4, 1, PAL.sofaLight);
  r(x + w - 2, y + 4, 6, 16, PAL.ink); r(x + w - 1, y + 5, 4, 14, PAL.sofa); r(x + w - 1, y + 5, 4, 1, PAL.sofaLight);
  r(x, y + 18, w, 2, PAL.sofaDark); r(x + 1, y + 20, 2, 3, PAL.ink); r(x + w - 3, y + 20, 2, 3, PAL.ink);
}

function drawCoffeeMachine(x, y, t, busy) {
  const f = (t / 160) | 0;
  r(x + 1, y + 26, 16, 2, '#00000030');
  r(x - 1, y - 1, 18, 28, PAL.ink); r(x, y, 16, 26, '#5a6988'); r(x, y, 16, 2, '#8b9bb4'); r(x + 13, y + 2, 3, 24, '#4f5c7a');
  r(x + 2, y + 4, 8, 4, PAL.ink); r(x + 3, y + 5, 6, 2, PAL.cyan);
  r(x + 11, y + 4, 2, 2, f % 6 < 3 ? PAL.red : '#7a2a30'); r(x + 11, y + 7, 2, 2, PAL.green);
  r(x + 3, y + 12, 9, 10, PAL.ink); r(x + 4, y + 13, 7, 8, '#262b44'); r(x + 7, y + 13, 1, 2, '#6e3f31');
  r(x + 5, y + 17, 5, 4, PAL.white);
  if (busy && f % 6 < 4) r(x + 6, y + 14 - (f % 2), 1, 2, '#ffffffaa');
}

function drawCooler(x, y, t) {
  const f = (t / 300) | 0;
  r(x + 1, y + 30, 12, 2, '#00000030');
  r(x + 2, y - 1, 10, 13, PAL.ink); r(x + 3, y, 8, 11, '#7fd3f5'); r(x + 3, y, 2, 11, '#c4ecfb'); r(x + 4 + (f % 3) * 2, y + 9 - (f % 8), 1, 1, '#ffffff');
  r(x, y + 11, 14, 20, PAL.ink); r(x + 1, y + 12, 12, 18, '#f4f4f8'); r(x + 1, y + 12, 12, 1, '#ffffff');
  r(x + 3, y + 16, 2, 2, PAL.blue); r(x + 9, y + 16, 2, 2, PAL.red); r(x + 3, y + 22, 8, 1, '#c0cbdc');
}

function drawRug(x, y, w, h) {
  r(x, y, w, h, PAL.rugDark); r(x + 2, y + 2, w - 4, h - 4, PAL.rug);
  for (let k = 0; k < w - 8; k += 4) { r(x + 4 + k, y + 4, 2, 1, PAL.rugLight); r(x + 4 + k, y + h - 5, 2, 1, PAL.rugLight); }
  for (let k = 0; k < h - 8; k += 4) { r(x + 4, y + 4 + k, 1, 2, PAL.rugLight); r(x + w - 5, y + 4 + k, 1, 2, PAL.rugLight); }
  for (let k = 0; k < w; k += 3) { r(x + k, y - 1, 1, 1, PAL.rugDark); r(x + k, y + h, 1, 1, PAL.rugDark); }
}

function drawFloor(W, H, top) {
  const ph = 6;
  for (let y = top, row = 0; y < H; y += ph, row++) {
    let x = -((row * 29) % 52);
    for (let n = 0; x < W; n++) {
      const len = 34 + hash(row + ':' + n) % 28;
      r(x, y, len, ph, PAL.floor[hash(n + 'f' + row) % 3]);
      r(x, y, len, 1, '#d29d7c');
      r(x + len - 1, y, 1, ph, PAL.floorGap);
      if (hash('k' + row + n) % 9 === 0) r(x + 8, y + 3, 2, 1, PAL.floorKnot);
      x += len;
    }
    r(0, y + ph - 1, W, 1, PAL.floorGap);
  }
}

// ---------------- luz ----------------
let lightCv = null;
function applyLight(W, H, sky, lights, glows) {
  if (sky.phase === 'day') return;
  if (!lightCv) lightCv = document.createElement('canvas');
  if (lightCv.width !== W || lightCv.height !== H) { lightCv.width = W; lightCv.height = H; }
  const l = lightCv.getContext('2d');
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, W, H);
  l.fillStyle = sky.phase === 'night' ? 'rgba(14,16,48,0.55)' : 'rgba(90,30,70,0.18)';
  l.fillRect(0, 0, W, H);
  l.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const g = l.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.55, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g; l.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  ctx.drawImage(lightCv, 0, 0);
  if (sky.phase !== 'night') return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const G of glows) {
    const g = ctx.createRadialGradient(G.x, G.y, 0, G.x, G.y, G.r);
    g.addColorStop(0, G.c + '40'); g.addColorStop(1, G.c + '00');
    ctx.fillStyle = g; ctx.fillRect(G.x - G.r, G.y - G.r, G.r * 2, G.r * 2);
  }
  ctx.restore();
}

// ---------------- zonas novas ----------------
function drawTile(x, y, w, h, a, b) {
  for (let yy = 0; yy < h; yy += 8) for (let xx = 0; xx < w; xx += 8) r(x + xx, y + yy, Math.min(8, w - xx), Math.min(8, h - yy), ((xx + yy) / 8) % 2 ? a : b);
}

function drawGlassWall(x, y, w, h, doorAt) {
  // parede de vidro vista de cima: moldura escura, vidro azulado e reflexos
  ctx.save(); ctx.fillStyle = 'rgba(160,220,240,0.16)'; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h); ctx.restore();
  r(x, y, w, 1, PAL.aluDark); r(x, y + 4, w, 1, PAL.aluDark);
  r(x, y, 1, h, PAL.aluDark); r(x + 3, y + 4, 1, h - 4, PAL.aluDark); r(x + w - 1, y, 1, h, PAL.aluDark); r(x + w - 4, y + 4, 1, h - 4, PAL.aluDark);
  for (let k = 12; k < w - 6; k += 24) { r(x + k, y + 1, 1, 3, '#ffffff99'); }
  if (doorAt != null) { r(x + doorAt, y, 18, 5, PAL.floor[0]); r(x + doorAt, y, 1, 5, PAL.aluDark); r(x + doorAt + 17, y, 1, 5, PAL.aluDark); }
}

function drawMeetingTable(x, y, w, h) {
  r(x + 2, y + h + 1, w, 4, '#00000026');
  r(x - 1, y - 1, w + 2, h + 6, PAL.ink);
  r(x, y, w, h, '#a8693f'); r(x, y, w, 1, '#c9855a'); r(x, y + h, w, 4, '#7a4428');
  for (let k = 8; k < w - 8; k += 18) { r(x + k, y + 3, 8, 5, PAL.paper); r(x + k + 1, y + 4, 5, 1, PAL.paperLine); }
}

function drawTV(x, y, w, h, t, active) {
  const f = (t / 160) | 0;
  r(x - 2, y - 2, w + 4, h + 4, PAL.ink); r(x - 1, y - 1, w + 2, h + 2, PAL.bezel);
  if (!active) { r(x, y, w, h, '#14141c'); r(x + 2, y + 1, 6, 1, '#ffffff14'); return; }
  r(x, y, w, h, '#1e2233');
  const c = '#feae34';
  r(x + w / 2 - 4, y + 2, 8, 3, c); r(x + w / 2, y + 5, 1, 2, c); r(x + 4, y + 7, w - 8, 1, c);
  for (let k = 0; k < 4; k++) { const bx = x + 4 + k * ((w - 10) / 3); r(bx, y + 7, 1, 2, c); r(bx - 2, y + 9, 5, 3, (f + k) % 4 === 0 ? '#fff' : '#63c74d'); }
}

function drawPingPong(x, y, w, h, t, playing) {
  r(x + 3, y + h + 4, w - 2, 4, '#00000026');
  r(x - 1, y - 1, w + 2, h + 6, PAL.ink);
  r(x, y, w, h, '#2f7f5a'); r(x, y, w, 1, '#4ca37a'); r(x, y + h, w, 4, '#1f5a40');
  r(x + 1, y + 1, w - 2, 1, '#ffffff'); r(x + 1, y + h - 2, w - 2, 1, '#ffffff'); r(x + 1, y + 1, 1, h - 2, '#ffffff'); r(x + w - 2, y + 1, 1, h - 2, '#ffffff');
  r(x + 1, y + h / 2, w - 2, 1, '#ffffff88');
  r(x + w / 2, y - 3, 1, h + 5, '#e8e8f0'); r(x + w / 2 - 1, y - 4, 3, 2, PAL.ink); r(x + w / 2 - 1, y + h, 3, 2, PAL.ink);
  r(x + 3, y + h + 4, 2, 4, PAL.ink); r(x + w - 5, y + h + 4, 2, 4, PAL.ink);
  if (!playing) { r(x + w / 4, y + h / 2 - 3, 4, 4, PAL.red); r(x + w / 4 + 1, y + h / 2 + 1, 1, 3, '#6e3f31'); return; }
  // bolinha indo e voltando num arco
  const period = 1400, p = (t % period) / period, dir = ((t / period) | 0) % 2;
  const u = dir ? 1 - p : p;
  const bx = x + 4 + u * (w - 8), arc = Math.sin(u * Math.PI) * 9;
  r(bx, y + h / 2 - 3 - arc, 2, 2, '#ffffff'); r(bx, y + h / 2 + 1, 2, 1, '#00000040');
}

function drawBeanBag(x, y, color) {
  r(x + 1, y + 13, 20, 3, '#00000026');
  r(x + 2, y - 1, 18, 16, PAL.ink); r(x, y + 3, 22, 10, PAL.ink);
  r(x + 3, y, 16, 14, color); r(x + 1, y + 4, 20, 8, color);
  r(x + 4, y + 1, 6, 2, shade(color, 1.3)); r(x + 2, y + 10, 18, 2, shade(color, .75));
}

// pessoa deitada: o sprite de frente girado 90°, pixel a pixel
function drawLying(x, y, lk, t) {
  const col = colorsOf(lk, { e: PAL.ink2 });
  const key = 'lying|' + JSON.stringify(col);
  let cv = spriteCache.get(key);
  if (!cv) {
    const src = document.createElement('canvas'); src.width = 16; src.height = 21;
    const c = src.getContext('2d');
    c.drawImage(sprite(BODY, col, 'body'), 0, 10); c.drawImage(sprite(LEGS_SIT, col, 'legssit'), 0, 17); c.drawImage(sprite(HEAD_FRONT, col, 'hf'), 0, 0);
    // olhos fechados
    c.fillStyle = lk.S; c.fillRect(5, 5, 1, 1); c.fillRect(10, 5, 1, 1); c.fillStyle = PAL.ink; c.fillRect(4, 6, 2, 1); c.fillRect(10, 6, 2, 1);
    cv = document.createElement('canvas'); cv.width = 21; cv.height = 16;
    const d = cv.getContext('2d'); d.translate(0, 16); d.rotate(-Math.PI / 2); d.drawImage(src, 0, 0);
    spriteCache.set(key, cv);
  }
  const breathe = (t / 1200 | 0) % 2;
  ctx.drawImage(cv, x | 0, (y - breathe) | 0);
}

function drawFridge(x, y) {
  r(x + 1, y + 34, 16, 2, '#00000030');
  r(x - 1, y - 1, 18, 36, PAL.ink); r(x, y, 16, 34, '#e8ecf4'); r(x, y, 16, 1, '#ffffff'); r(x + 13, y + 1, 3, 33, '#c0cbdc');
  r(x, y + 12, 16, 1, PAL.ink); r(x + 2, y + 4, 1, 6, '#8b9bb4'); r(x + 2, y + 16, 1, 8, '#8b9bb4');
  r(x + 5, y + 18, 4, 4, PAL.amber); r(x + 9, y + 20, 3, 3, PAL.red); r(x + 6, y + 4, 5, 3, '#0099db');
}

function drawCounter(x, y, w) {
  r(x - 1, y - 1, w + 2, 22, PAL.ink); r(x, y, w, 6, '#d9d9e0'); r(x, y, w, 1, '#ffffff'); r(x, y + 6, w, 14, '#8f553f');
  for (let k = 0; k < w - 4; k += 16) { r(x + k + 2, y + 8, 13, 10, PAL.ink); r(x + k + 3, y + 9, 11, 8, '#a86a52'); r(x + k + 8, y + 12, 2, 1, '#e8b04b'); }
  r(x + 6, y + 1, 12, 4, PAL.ink); r(x + 7, y + 1, 10, 3, '#8b9bb4'); r(x + 11, y - 3, 2, 4, '#8b9bb4');
  r(x + w - 18, y - 6, 14, 7, PAL.ink); r(x + w - 17, y - 5, 12, 5, '#3a4466'); r(x + w - 15, y - 4, 6, 3, '#14141c'); r(x + w - 7, y - 4, 1, 1, PAL.green);
}

function drawBookshelf(x, y, w, h) {
  r(x - 1, y - 1, w + 2, h + 2, PAL.ink); r(x, y, w, h, '#6e3f31');
  const shelves = Math.floor((h - 2) / 11);
  for (let s = 0; s < shelves; s++) {
    const sy = y + 2 + s * 11;
    r(x + 1, sy + 9, w - 2, 1, '#8f553f');
    for (let bx = x + 2, k = 0; bx < x + w - 3; k++) {
      const hh = hash('book' + x + s + k), bw = 2 + hh % 3, bh = 6 + (hh >>> 4) % 3;
      if (bx + bw > x + w - 2) break;
      r(bx, sy + 9 - bh, bw, bh, ['#e43b44', '#0099db', '#feae34', '#3e8948', '#b55088', '#f4ecd8', '#5a6988'][hh % 7]);
      bx += bw + (hh % 5 === 0 ? 2 : 0);
    }
  }
}

function drawPrinter(x, y, t) {
  const f = (t / 300) | 0;
  r(x + 1, y + 14, 18, 2, '#00000030');
  r(x - 1, y - 1, 20, 16, PAL.ink); r(x, y, 18, 14, '#d9d9e0'); r(x, y, 18, 1, '#ffffff'); r(x + 2, y + 3, 14, 2, PAL.ink2);
  r(x + 3, y + 1 - (f % 3), 12, 3, PAL.white); r(x + 13, y + 8, 2, 2, f % 4 < 2 ? PAL.green : '#2a5a2a');
  r(x + 2, y + 15, 3, 3, PAL.ink); r(x + 13, y + 15, 3, 3, PAL.ink);
}

function drawStool(x, y) { r(x, y, 10, 4, PAL.ink); r(x + 1, y, 8, 3, '#b86f50'); r(x + 4, y + 4, 2, 5, PAL.ink); r(x + 1, y + 9, 8, 1, PAL.ink); }
function drawRoundTable(x, y) { r(x + 2, y + 14, 16, 2, '#00000026'); r(x, y, 20, 8, PAL.ink); r(x + 1, y + 1, 18, 6, '#c37a55'); r(x + 1, y + 1, 18, 1, '#dc9a6c'); r(x + 9, y + 8, 2, 6, PAL.ink); r(x + 5, y + 14, 10, 1, PAL.ink); r(x + 4, y + 2, 4, 3, PAL.white); }
function drawEmptyChair(x, y) { drawChairBase(x, y + 24); r(x - 1, y + 13, 18, 11, PAL.ink); r(x, y + 14, 16, 9, PAL.chair); r(x, y + 14, 16, 2, PAL.chairLight); }

window.Art = {
  PAL, SKIN, HAIR, SHIRT, SCREEN_GLOW, hash, shade, look, setCtx, r, sprite, blit,
  drawSeatedBack, drawFront, drawStanding, drawSleeping, drawChairBack, drawChairBase, drawCat, bubble, drawScreen,
  drawPlant, drawCertificate, drawLamp, drawWhiteboard, drawCork, drawClock, skyFor, drawWindow, drawSofa, drawCoffeeMachine,
  drawCooler, drawRug, drawFloor, applyLight, LEGS_SIT,
  drawTile, drawGlassWall, drawMeetingTable, drawTV, drawPingPong, drawBeanBag, drawLying, drawFridge, drawCounter, drawBookshelf, drawPrinter, drawStool, drawRoundTable, drawEmptyChair,
};
})();
