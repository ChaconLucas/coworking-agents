'use strict';
// A small QR code encoder (byte mode, error correction L, versions 1–6: up to 134 bytes), enough for a link.
// Returns a square matrix of booleans (true = dark), without the quiet zone.

const EC_L = [null, [19, 7, 1], [34, 10, 1], [55, 15, 1], [80, 20, 1], [108, 26, 1], [68, 18, 2]]; // data per block, ec per block, blocks
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

// GF(256) with the QR polynomial 0x11d
const EXP = new Array(512), LOG = new Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsRemainder(data, n) {
  let gen = [1];
  for (let i = 0; i < n; i++) { const next = new Array(gen.length + 1).fill(0); gen.forEach((g, j) => { next[j] ^= g; next[j + 1] ^= mul(g, EXP[i]); }); gen = next; }
  const res = new Array(n).fill(0);
  for (const d of data) { const f = d ^ res.shift(); res.push(0); for (let j = 0; j < n; j++) res[j] ^= mul(gen[j + 1], f); }
  return res;
}

function encode(text, forceMask) {
  const bytes = [...Buffer.from(String(text), 'utf8')];
  const v = EC_L.findIndex((e, i) => i && e[0] * e[2] >= bytes.length + 2);
  if (v < 1) throw new Error('too long for a QR code');
  const [per, ecn, blocks] = EC_L[v], cap = per * blocks;
  // bits: mode 0100, 8-bit length, data, terminator, pad
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  put(4, 4); put(bytes.length, 8); for (const b of bytes) put(b, 8);
  for (let i = 0; i < 4 && bits.length < cap * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);
  // blocks, error correction, interleaving
  const dataBlocks = [], ecBlocks = [];
  for (let b = 0; b < blocks; b++) { const d = data.slice(b * per, (b + 1) * per); dataBlocks.push(d); ecBlocks.push(rsRemainder(d, ecn)); }
  const words = [];
  for (let i = 0; i < per; i++) for (const d of dataBlocks) words.push(d[i]);
  for (let i = 0; i < ecn; i++) for (const e of ecBlocks) words.push(e[i]);

  const size = 17 + 4 * v, m = Array.from({ length: size }, () => new Array(size).fill(false)), fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, dark) => { m[r][c] = dark; fn[r][c] = true; };
  const finder = (r0, c0) => { for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) { const r1 = r0 + r, c1 = c0 + c; if (r1 < 0 || c1 < 0 || r1 >= size || c1 >= size) continue; set(r1, c1, r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))); } };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const r of ALIGN[v]) for (const c of ALIGN[v]) {
    if (fn[r][c]) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  set(size - 8, 8, true); // dark module
  for (let i = 0; i < 9; i++) { if (!fn[8][i]) set(8, i, false); if (!fn[i][8]) set(i, 8, false); } // reserve format areas
  for (let i = 0; i < 8; i++) { set(8, size - 1 - i, false); set(size - 1 - i, 8, false); }
  set(size - 8, 8, true);

  // data in the zigzag, right to left, skipping the vertical timing column
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j, up = ((right + 1) & 2) === 0, r = up ? size - 1 - vert : vert;
        if (fn[r][c]) continue;
        m[r][c] = k < words.length * 8 ? ((words[k >> 3] >> (7 - (k & 7))) & 1) === 1 : false; k++;
      }
    }
  }

  const MASKS = [(r, c) => (r + c) % 2 === 0, r => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];
  const withFormat = (g, mask) => {
    let d = (1 << 3) | mask, rem = d; // L = 01
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
    const bitsF = ((d << 10) | rem) ^ 0x5412, bit = i => ((bitsF >> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) g[i][8] = bit(i);
    g[7][8] = bit(6); g[8][8] = bit(7); g[8][7] = bit(8);
    for (let i = 9; i < 15; i++) g[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i++) g[8][size - 1 - i] = bit(i);
    for (let i = 8; i < 15; i++) g[size - 15 + i][8] = bit(i);
    g[size - 8][8] = true;
    return g;
  };
  const penalty = g => {
    let p = 0;
    for (const line of [g, g[0].map((_, c) => g.map(row => row[c]))]) for (const row of line) {
      let run = 1;
      for (let i = 1; i <= row.length; i++) { if (i < row.length && row[i] === row[i - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; } }
      const s = row.map(x => (x ? 1 : 0)).join('');
      p += 40 * ((s.match(/(?=10111010000|00001011101)/g) || []).length);
    }
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) { const x = g[r][c]; if (x === g[r][c + 1] && x === g[r + 1][c] && x === g[r + 1][c + 1]) p += 3; }
    const dark = g.flat().filter(Boolean).length; p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return p;
  };
  let best = null, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask !== undefined && mask !== forceMask) continue;
    const g = m.map((row, r) => row.map((x, c) => (fn[r][c] ? x : x !== MASKS[mask](r, c))));
    withFormat(g, mask); const p = penalty(g);
    if (p < bestP) { bestP = p; best = g; }
  }
  return best;
}

// the matrix as terminal text: two rows per line with half blocks, with a quiet zone, dark on light
function toTerminal(g) {
  const q = 2, n = g.length + q * 2, at = (r, c) => r >= q && c >= q && r < n - q && c < n - q && g[r - q][c - q];
  const lines = [];
  for (let r = 0; r < n; r += 2) {
    let line = '';
    for (let c = 0; c < n; c++) { const top = at(r, c), bot = at(r + 1, c); line += top && bot ? ' ' : top ? '▄' : bot ? '▀' : '█'; }
    lines.push(line);
  }
  return lines.join('\n');
}

module.exports = { encode, toTerminal };
