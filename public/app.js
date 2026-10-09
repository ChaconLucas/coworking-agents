'use strict';
// claudehq — desenha cada sessão do Claude Code como uma pessoa num escritório em pixel art.

// ---------------- textos ----------------
const I18N = {
  pt: {
    working: 'trabalhando', needYou: 'precisa de você', yourTurn: 'sua vez', asleep: 'dormindo',
    notify: '🔔 Avisos', sound: '🔊 Som', lang: 'EN',
    empty: 'Nenhuma sessão do Claude Code aberta agora. Abra o <code>claude</code> num terminal e ela aparece aqui.',
    offline: 'Sem ligação ao claudehq. Tentando de novo…',
    clash: (who, repo) => `<b>Atenção:</b> ${who} estão editando o mesmo clone <b>${repo}</b>. Commitem cedo ou usem worktrees.`,
    and: ' e ',
    states: {
      edit: 'editando', read: 'lendo', terminal: 'no terminal', web: 'na web', delegate: 'delegando',
      skill: 'usando skill', mcp: 'usando MCP', other: 'trabalhando', thinking: 'pensando',
      needs_you: 'tem uma pergunta para você', waiting: 'rodando há um tempo ou esperando permissão',
      idle: 'terminou — sua vez', asleep: 'parada há muito tempo', ask: 'perguntando',
    },
    for: s => `há ${s}`,
    panel: {
      doing: 'Agora', where: 'Onde', repo: 'Repositório', branch: 'Branch', worktree: 'Worktree', folder: 'Pasta',
      model: 'Modelo', context: 'Contexto', started: 'Aberta', turns: 'Turnos', recent: 'Últimas ações',
      certs: 'Certificados na parede', tools: 'Ferramentas mais usadas', team: 'Estagiários (subagentes)',
      noCerts: 'Ainda sem certificados nesta sessão.', session: 'Sessão', version: 'Versão',
      hall: 'Mural da casa', topSkills: 'Skills mais usadas (todas as sessões)', installed: 'Skills instaladas',
      mcps: 'Servidores MCP', plugins: 'Plugins', tokens: n => `${n} tokens`, editingIn: 'Editando em',
      ctxNote: 'Tokens enviados na última resposta. Quando enche, a conversa é resumida.',
      waitNote: 'Não dá para distinguir pelo disco se o comando ainda roda ou se espera a sua permissão — dê uma olhada no terminal.',
    },
    kinds: { skill: 'Skill', mcp: 'MCP', badge: 'Conquista' },
    badges: {
      tools100: ['Cem ferramentas', 'usou 100+ ferramentas'], tools1000: ['Mil ferramentas', 'usou 1000+ ferramentas'],
      marathon: ['Maratonista', 'sessão aberta há mais de 4h'], immortal: ['Imortal', 'sessão aberta há mais de 24h'],
      boss: ['Chefe de equipe', 'delegou para subagentes'], elephant: ['Memória de elefante', '500k+ tokens de contexto'],
      chat: ['Papo longo', '50+ turnos'], terminal: ['Mestre do terminal', '50+ comandos'], writer: ['Escritor', '50+ edições'],
      research: ['Pesquisador', 'pesquisou na web'],
    },
    ago: { s: 's', m: 'min', h: 'h', d: 'd' },
  },
  en: {
    working: 'working', needYou: 'need you', yourTurn: 'your turn', asleep: 'asleep',
    notify: '🔔 Alerts', sound: '🔊 Sound', lang: 'PT',
    empty: 'No Claude Code sessions open right now. Run <code>claude</code> in a terminal and it shows up here.',
    offline: 'Lost connection to claudehq. Retrying…',
    clash: (who, repo) => `<b>Heads up:</b> ${who} are editing the same checkout <b>${repo}</b>. Commit early or use worktrees.`,
    and: ' and ',
    states: {
      edit: 'editing', read: 'reading', terminal: 'in the terminal', web: 'on the web', delegate: 'delegating',
      skill: 'using a skill', mcp: 'using MCP', other: 'working', thinking: 'thinking',
      needs_you: 'has a question for you', waiting: 'running for a while or waiting for permission',
      idle: 'done — your turn', asleep: 'idle for a long time', ask: 'asking',
    },
    for: s => `for ${s}`,
    panel: {
      doing: 'Now', where: 'Where', repo: 'Repository', branch: 'Branch', worktree: 'Worktree', folder: 'Folder',
      model: 'Model', context: 'Context', started: 'Opened', turns: 'Turns', recent: 'Recent actions',
      certs: 'Certificates on the wall', tools: 'Most used tools', team: 'Interns (subagents)',
      noCerts: 'No certificates in this session yet.', session: 'Session', version: 'Version',
      hall: 'House wall', topSkills: 'Most used skills (all sessions)', installed: 'Installed skills',
      mcps: 'MCP servers', plugins: 'Plugins', tokens: n => `${n} tokens`, editingIn: 'Editing in',
      ctxNote: 'Tokens sent on the last reply. When it fills up, the conversation gets compacted.',
      waitNote: "The disk can't tell whether the command is still running or waiting for your permission — check the terminal.",
    },
    kinds: { skill: 'Skill', mcp: 'MCP', badge: 'Achievement' },
    badges: {
      tools100: ['Hundred tools', 'used 100+ tools'], tools1000: ['Thousand tools', 'used 1000+ tools'],
      marathon: ['Marathoner', 'session open for 4h+'], immortal: ['Immortal', 'session open for 24h+'],
      boss: ['Team lead', 'delegated to subagents'], elephant: ['Elephant memory', '500k+ context tokens'],
      chat: ['Long talk', '50+ turns'], terminal: ['Terminal master', '50+ commands'], writer: ['Writer', '50+ edits'],
      research: ['Researcher', 'searched the web'],
    },
    ago: { s: 's', m: 'min', h: 'h', d: 'd' },
  },
};

const store = {
  get(k, d) { try { const v = localStorage.getItem('claudehq.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('claudehq.' + k, JSON.stringify(v)); } catch {} },
};
const qs = new URLSearchParams(location.search);
let lang = qs.get('lang') || store.get('lang', (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en');
let T = I18N[lang] || I18N.pt;
let notifyOn = store.get('notify', false);
let soundOn = store.get('sound', false);

// ---------------- paleta ----------------
const SKIN = ['#f6d5b8', '#eab98f', '#c98d62', '#9a6442', '#664128'];
const HAIR = ['#2b1d14', '#5a3a1e', '#a0522d', '#d9b36c', '#1d1d33', '#8a8a8a', '#b8432f', '#3d5a80', '#e8e0d0'];
const SHIRT = ['#e76f51', '#2a9d8f', '#e9b949', '#3a5a6b', '#8e7dbe', '#f4a261', '#457b9d', '#d1495b', '#66a182', '#d97757'];
const KIND_COLOR = {
  edit: '#7aa2f7', read: '#e0d6c2', terminal: '#3ddc84', web: '#5fb3e6', delegate: '#d9a441', skill: '#b48ead',
  mcp: '#4fb8a8', other: '#9aa0a6', thinking: '#c8b8f0', needs_you: '#d6453d', waiting: '#d9952b', ask: '#d6453d',
  idle: '#88a', asleep: '#556',
};
const CERT = { skill: '#c9a227', mcp: '#3f9e93', badge: '#c0453f' };
const BADGE_COLOR = { tools100: '#c0453f', tools1000: '#8e2f6b', marathon: '#d9772b', immortal: '#5b3fa0', boss: '#3d6fb0', elephant: '#6f7f8f', chat: '#2f9e6e', terminal: '#1f6f4a', writer: '#b06a3d', research: '#2f86b0' };

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function look(id) {
  const h = hash(id);
  return { skin: SKIN[h % SKIN.length], hair: HAIR[(h >>> 3) % HAIR.length], shirt: SHIRT[(h >>> 7) % SHIRT.length], long: (h >>> 11) % 3 === 0, glasses: (h >>> 13) % 4 === 0 };
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

// ---------------- geometria ----------------
const CELL_W = 120, CELL_H = 104, TOP = 46, PAD = 8;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const overlay = document.getElementById('overlay');
let S = 3, W = 0, H = 0, cols = 1;
let data = null, selected = null, layout = [], hallBox = null;

function r(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }

function relayout() {
  const avail = Math.min(document.getElementById('stage').clientWidth - 2, 1600);
  S = avail < 520 ? 2 : 3;
  const n = data ? Math.max(1, data.people.length) : 1;
  cols = Math.max(1, Math.min(n, Math.floor((avail / S - PAD * 2) / CELL_W)));
  const rows = Math.ceil(n / cols);
  W = Math.max(cols * CELL_W + PAD * 2, Math.min(avail / S | 0, 260));
  H = TOP + rows * CELL_H + 14;
  cv.width = W; cv.height = H;
  cv.style.width = W * S + 'px'; cv.style.height = H * S + 'px';
  ctx.imageSmoothingEnabled = false;
  const x0 = ((W - cols * CELL_W) / 2) | 0;
  layout = (data ? data.people : []).map((p, i) => ({ p, x: x0 + (i % cols) * CELL_W, y: TOP + ((i / cols) | 0) * CELL_H }));
}

// ---------------- cenário ----------------
function drawRoom(t) {
  // chão de tábuas corridas
  r(0, TOP - 4, W, H, '#d2ad86');
  for (let y = TOP - 4, row = 0; y < H; y += 7, row++) {
    r(0, y, W, 1, '#bf9770');
    for (let x = -((row * 23) % 46); x < W; x += 46) r(x, y + 1, 1, 6, '#c49d77');
    if (row % 3 === 1) r(0, y + 3, W, 1, '#d8b48e');
  }
  // parede
  r(0, 0, W, TOP - 4, '#ece3d3');
  r(0, TOP - 6, W, 2, '#d8ccb6');
  r(0, TOP - 4, W, 2, '#8a6a4a');
  // janelas com o céu da hora local
  const hr = new Date().getHours() + new Date().getMinutes() / 60;
  const sky = hr < 5.5 || hr > 20 ? ['#1b2240', '#2b3560'] : hr < 7.5 ? ['#f2a65a', '#f7d39a'] : hr > 18 ? ['#e3735e', '#f2b57a'] : ['#7cc3ef', '#bfe4f8'];
  const night = hr < 5.5 || hr > 20;
  const nWin = Math.max(1, Math.floor((W - 120) / 90));
  for (let i = 0; i < nWin; i++) {
    const wx = 14 + i * 90, wy = 6, ww = 46, wh = 28;
    r(wx - 2, wy - 2, ww + 4, wh + 4, '#fff');
    r(wx, wy, ww, wh / 2, sky[0]); r(wx, wy + wh / 2, ww, wh / 2, sky[1]);
    if (night) { for (let k = 0; k < 5; k++) { const h = hash(i + ':' + k); r(wx + h % ww, wy + (h >>> 8) % (wh - 4), 1, 1, (t / 600 + k) % 3 < 2 ? '#fff' : '#99a'); } }
    else { const cx = (wx + ((t / 200 + i * 30) % (ww + 20))) - 10; r(Math.max(wx, cx), wy + 6, Math.min(12, wx + ww - Math.max(wx, cx)), 3, '#ffffffcc'); }
    r(wx + ww / 2 - 1, wy, 2, wh, '#fff'); r(wx, wy + wh / 2 - 1, ww, 2, '#fff');
    // vaso
    r(wx + ww + 10, 26, 8, 8, '#b5651d'); r(wx + ww + 8, 16, 4, 10, '#4c9a52'); r(wx + ww + 13, 12, 4, 14, '#5fb366'); r(wx + ww + 17, 18, 3, 8, '#3f8a46');
  }
  // relógio
  const cx = W - 104, cy = 18;
  r(cx - 9, cy - 9, 18, 18, '#3a3226'); r(cx - 8, cy - 8, 16, 16, '#fbf7ea');
  const now = new Date(), a1 = (now.getHours() % 12 + now.getMinutes() / 60) / 12 * Math.PI * 2, a2 = now.getMinutes() / 60 * Math.PI * 2;
  for (let k = 1; k < 5; k++) r(cx + Math.sin(a1) * k, cy - Math.cos(a1) * k, 1, 1, '#3a3226');
  for (let k = 1; k < 7; k++) r(cx + Math.sin(a2) * k, cy - Math.cos(a2) * k, 1, 1, '#c0453f');
  // mural (quadro de cortiça) com as medalhas da casa
  const bx = W - 84, by = 5, bw = 76, bh = 32;
  hallBox = { x: bx, y: by, w: bw, h: bh };
  r(bx - 2, by - 2, bw + 4, bh + 4, '#7a5534'); r(bx, by, bw, bh, '#c89a62');
  for (let k = 0; k < 40; k++) { const h = hash('cork' + k); r(bx + h % bw, by + (h >>> 8) % bh, 1, 1, '#b5864f'); }
  const top = data ? data.credentials.topSkills.slice(0, 3) : [];
  const medal = ['#e4b83a', '#c4ccd4', '#c9834a'];
  top.forEach((s, i) => {
    const mx = bx + 6 + i * 24, my = by + 4;
    r(mx + 3, my, 2, 6, '#c0453f'); r(mx + 7, my, 2, 6, '#3d5a80');
    r(mx + 1, my + 6, 10, 10, shade(medal[i], .7)); r(mx + 2, my + 7, 8, 8, medal[i]); r(mx + 4, my + 9, 2, 2, '#fff8');
    r(mx, my + 19, 14, 6, '#fbf7ea'); r(mx + 2, my + 21, 10, 1, '#998'); r(mx + 2, my + 23, 7, 1, '#998');
  });
}

// ---------------- telas dos monitores ----------------
function drawScreen(x, y, w, h, state, t, seed) {
  const f = (t / 140) | 0;
  if (state === 'asleep') return r(x, y, w, h, '#15151c');
  if (state === 'idle') {
    r(x, y, w, h, '#1d1f2e');
    const px = Math.abs(((f + seed) % (2 * (w - 3))) - (w - 3)), py = Math.abs(((f * 2 + seed) % (2 * (h - 3))) - (h - 3));
    return r(x + px, y + py, 3, 3, SHIRT[(f / 20 | 0) % SHIRT.length]);
  }
  if (state === 'terminal') {
    r(x, y, w, h, '#0e1410');
    for (let i = 0; i < h / 2 - 1; i++) { const hh = hash(seed + ':' + (i + f)); r(x + 1, y + 1 + i * 2, 2 + hh % (w - 4), 1, i === ((h / 2 - 2) | 0) && f % 2 ? '#0e1410' : '#3ddc84'); }
    return;
  }
  if (state === 'edit') {
    r(x, y, w, h, '#1e2233');
    const lines = (h / 2) | 0, typed = f % (lines * 3);
    for (let i = 0; i < lines; i++) {
      const hh = hash(seed + 'e' + i), ind = (hh % 3) * 2, len = 3 + (hh >>> 4) % (w - 8 - ind);
      const show = i < typed / 3 ? len : i === ((typed / 3) | 0) ? Math.min(len, (typed % 3) * 4) : 0;
      if (show) r(x + 1 + ind, y + 1 + i * 2, show, 1, ['#7aa2f7', '#bb9af7', '#9ece6a', '#e0af68'][hh % 4]);
      if (i === ((typed / 3) | 0) && f % 2) r(x + 1 + ind + show, y + 1 + i * 2, 1, 1, '#fff');
    }
    return;
  }
  if (state === 'read') {
    r(x, y, w, h, '#f4efe2');
    for (let i = 0; i < h / 2; i++) { const hh = hash(seed + 'r' + (i + (f >> 1))); r(x + 2, y + 1 + i * 2, 4 + hh % (w - 7), 1, '#9a8f7d'); }
    return r(x + w - 2, y + ((f >> 1) % (h - 3)), 1, 3, '#7a6f5d');
  }
  if (state === 'web') {
    r(x, y, w, h, '#d9eefa'); r(x, y, w, 2, '#5fb3e6');
    const cx = x + w / 2, cy = y + h / 2 + 1, R = Math.min(w, h) / 2 - 2;
    for (let a = 0; a < 24; a++) r(cx + Math.cos(a / 24 * 6.283) * R, cy + Math.sin(a / 24 * 6.283) * R, 1, 1, '#2f7fb3');
    const m = Math.cos(f / 3) * R;
    for (let k = -R; k <= R; k++) { r(cx + m * Math.sqrt(1 - (k / R) ** 2), cy + k, 1, 1, '#2f7fb3'); r(cx - R + 1 + (R * 2 - 2) * ((k + R) / (2 * R)), cy, 1, 1, '#2f7fb3'); }
    return;
  }
  if (state === 'delegate') {
    r(x, y, w, h, '#2c2a24');
    r(x + w / 2 - 3, y + 2, 6, 3, '#d9a441');
    r(x + w / 2, y + 5, 1, 2, '#d9a441'); r(x + 3, y + 7, w - 6, 1, '#d9a441');
    for (let k = 0; k < 3; k++) { const bx = x + 2 + k * ((w - 6) / 2); r(bx, y + 8, 1, 2, '#d9a441'); r(bx - 1, y + 10, 4, 3, (f + k) % 3 === 0 ? '#fff' : '#d9a441'); }
    return;
  }
  if (state === 'skill' || state === 'mcp' || state === 'other' || state === 'thinking') {
    const bg = { skill: '#2b2233', mcp: '#15302d', other: '#2a2d31', thinking: '#25223a' }[state];
    r(x, y, w, h, bg);
    const c = KIND_COLOR[state], cx = x + w / 2 | 0, cy = y + h / 2 | 0, p = f % 4;
    if (state === 'mcp') { r(cx - 3, cy - 2, 6, 5, c); r(cx - 2, cy - 5, 1, 3, c); r(cx + 1, cy - 5, 1, 3, c); r(cx, cy + 3, 1, 3 + (f % 2), c); }
    else if (state === 'skill') { r(cx, cy - 4 + (p === 0 ? 1 : 0), 1, 9 - (p === 0 ? 2 : 0), c); r(cx - 4 + (p === 0 ? 1 : 0), cy, 9 - (p === 0 ? 2 : 0), 1, c); r(cx - 1, cy - 1, 3, 3, '#fff'); }
    else for (let k = 0; k < 3; k++) r(cx - 5 + k * 4, cy - (k === p ? 1 : 0), 2, 2, c);
    return;
  }
  // needs_you / waiting: tela piscando em alerta
  const c = KIND_COLOR[state] || '#888';
  r(x, y, w, h, f % 4 < 2 ? c : shade(c, .55));
  r(x + w / 2 - 1, y + 2, 2, h - 7, '#fff'); r(x + w / 2 - 1, y + h - 4, 2, 2, '#fff');
}

// ---------------- pessoas ----------------
function drawPerson(x, y, lk, state, t) {
  const f = (t / 140) | 0;
  const front = state === 'needs_you' || state === 'waiting';
  const hairC = lk.hair, skin = lk.skin, shirt = lk.shirt;
  if (state === 'asleep') {
    // cabeça deitada na mesa, braços cruzados
    r(x - 2, y + 6, 16, 4, shirt);
    r(x + 1, y + 2, 10, 7, hairC); r(x + 1, y + 7, 10, 2, shade(hairC, .8));
    r(x - 1, y + 10, 14, 10, shirt); r(x - 1, y + 18, 14, 2, shade(shirt, .8));
    return;
  }
  if (front) {
    r(x + 1, y, 10, 9, skin);
    r(x, y - 1, 12, 3, hairC); r(x, y + 2, 1, lk.long ? 8 : 3, hairC); r(x + 11, y + 2, 1, lk.long ? 8 : 3, hairC);
    const blink = f % 18 === 0;
    r(x + 3, y + 4, 2, blink ? 1 : 2, '#222'); r(x + 7, y + 4, 2, blink ? 1 : 2, '#222');
    if (lk.glasses) { r(x + 2, y + 3, 4, 1, '#333'); r(x + 6, y + 3, 4, 1, '#333'); }
    r(x + 5, y + 7, 2, 1, state === 'needs_you' ? '#7a2a2a' : '#a55');
    r(x + 4, y + 9, 4, 1, skin);
    r(x - 1, y + 10, 14, 10, shirt); r(x - 1, y + 18, 14, 2, shade(shirt, .8));
    // aceno
    const up = state === 'needs_you' && f % 2 === 0;
    r(x - 3, y + 11, 2, 7, shirt); r(x - 3, y + 18, 2, 2, skin);
    if (state === 'needs_you') { r(x + 13, y + (up ? 2 : 4), 2, 8, shirt); r(x + 13, y + (up ? 0 : 2), 2, 2, skin); }
    else { r(x + 13, y + 11, 2, 7, shirt); r(x + 13, y + 18, 2, 2, skin); }
    return;
  }
  // de costas, virada para o monitor
  const typing = state === 'edit' || state === 'terminal';
  const a = typing ? f % 2 : 0;
  // mãos no teclado (ao lado da cabeça)
  if (state === 'idle') { r(x - 4, y + 4, 2, 2, skin); r(x + 14, y + 3, 3, 4, '#fbf7ea'); r(x + 17, y + 4, 1, 2, '#fbf7ea'); if (f % 6 < 3) r(x + 15, y + 1 - (f % 3), 1, 1, '#fff9'); }
  else if (state === 'read') { r(x - 2, y - 2, 16, 6, '#fbf7ea'); r(x, y - 1, 10, 1, '#998'); r(x, y + 1, 8, 1, '#998'); r(x - 3, y + 2, 2, 2, skin); r(x + 13, y + 2, 2, 2, skin); }
  else { r(x - 3, y + 3 - a, 2, 2, skin); r(x + 13, y + 3 - (typing ? 1 - a : 0), 2, 2, skin); }
  const lean = state === 'idle' ? 1 : 0;
  r(x + 1, y + lean, 10, 9, hairC);
  if (lk.long) r(x + 1, y + 9 + lean, 10, 3, hairC);
  r(x, y + 4 + lean, 1, 2, skin); r(x + 11, y + 4 + lean, 1, 2, skin);
  r(x + 4, y + 9 + lean, 4, 1, skin);
  r(x - 1, y + 10, 14, 10, shirt); r(x - 1, y + 18, 14, 2, shade(shirt, .8));
  r(x - 3, y + 10, 2, 6 - a, shirt); r(x + 13, y + 10, 2, 6 - (typing ? 1 - a : 0), shirt);
  if (lk.long) r(x + 1, y + 10, 10, 2, hairC);
}

function bubble(x, y, kind, t) {
  const f = (t / 140) | 0;
  const bob = kind === 'need' ? (f % 4 < 2 ? 0 : -1) : 0;
  y += bob;
  const w = 15, h = 11;
  r(x - 1, y - 1, w + 2, h + 2, '#2a2622'); r(x, y, w, h, '#fff'); r(x + 4, y + h + 1, 3, 2, '#2a2622'); r(x + 5, y + h, 2, 2, '#fff');
  if (kind === 'need') { r(x + 7, y + 2, 2, 5, '#d6453d'); r(x + 7, y + 8, 2, 2, '#d6453d'); }
  else if (kind === 'wait') { r(x + 5, y + 2, 5, 1, '#d9952b'); r(x + 9, y + 3, 1, 2, '#d9952b'); r(x + 7, y + 5, 2, 2, '#d9952b'); r(x + 7, y + 8, 2, 1, '#d9952b'); }
  else if (kind === 'think') { for (let k = 0; k < 3; k++) r(x + 3 + k * 4, y + 5 - (k === f % 3 ? 1 : 0), 2, 2, '#7a6fb0'); }
  else if (kind === 'zz') { const p = f % 6; r(x + 3, y + 3 + (p > 2 ? 0 : 1), 4, 1, '#556'); r(x + 5, y + 4 + (p > 2 ? 0 : 1), 1, 1, '#556'); r(x + 3, y + 5 + (p > 2 ? 0 : 1), 4, 1, '#556'); r(x + 9, y + 2, 3, 1, '#889'); r(x + 10, y + 3, 1, 1, '#889'); r(x + 9, y + 4, 3, 1, '#889'); }
}

function drawIntern(x, y, a, t) {
  const lk = look(a.id), f = (t / 140) | 0;
  r(x - 1, y + 16, 12, 2, '#6b5a4a'); r(x + 4, y + 18, 2, 4, '#555'); // banquinho
  r(x + 1, y, 8, 7, lk.hair); r(x + 2, y + 5, 6, 3, lk.skin); r(x + 3, y + 6, 1, 1, '#222'); r(x + 6, y + 6, 1, 1, '#222');
  r(x, y + 8, 10, 8, lk.shirt);
  // laptop no colo com a cor do que ele faz
  r(x - 1, y + 11, 12, 1, '#555'); r(x, y + 7, 10, 4, f % 4 < 3 ? KIND_COLOR[a.state] || '#999' : shade(KIND_COLOR[a.state] || '#999', .7));
  r(x - 2, y + 10 - (f % 2), 2, 2, lk.skin); r(x + 10, y + 10 - ((f + 1) % 2), 2, 2, lk.skin);
}

// ---------------- certificados ----------------
function certsOf(p) {
  const out = [];
  for (const [k, n] of Object.entries(p.skills || {}).sort((a, b) => b[1] - a[1])) out.push({ kind: 'skill', name: k, n });
  for (const [k, n] of Object.entries(p.mcps || {}).sort((a, b) => b[1] - a[1])) out.push({ kind: 'mcp', name: k, n });
  const tools = p.tools || {}, total = Object.values(tools).reduce((s, v) => s + v, 0);
  const age = data ? data.now - p.startedAt : 0;
  const B = T.badges, add = (key) => out.push({ kind: 'badge', key, name: B[key][0], desc: B[key][1] });
  if (total >= 1000) add('tools1000'); else if (total >= 100) add('tools100');
  if (age > 864e5) add('immortal'); else if (age > 4 * 36e5) add('marathon');
  if ((tools.Agent || 0) + (tools.Task || 0) + (tools.Workflow || 0) > 0) add('boss');
  if (p.ctx >= 5e5) add('elephant');
  if (p.turns >= 50) add('chat');
  if ((tools.Bash || 0) >= 50) add('terminal');
  if ((tools.Edit || 0) + (tools.Write || 0) >= 50) add('writer');
  if ((tools.WebSearch || 0) + (tools.WebFetch || 0) > 0) add('research');
  return out;
}

function certColor(c) { return c.kind === 'badge' ? BADGE_COLOR[c.key] || CERT.badge : CERT[c.kind]; }
function drawCert(x, y, c, t) {
  const col = certColor(c);
  r(x, y, 11, 9, shade(col, .7)); r(x + 1, y + 1, 9, 7, col); r(x + 2, y + 2, 7, 5, '#fbf7ea');
  r(x + 3, y + 3, 5, 1, '#a99'); r(x + 3, y + 5, 3, 1, '#a99');
  r(x + 7, y + 5, 2, 2, c.kind === 'badge' ? '#c0453f' : '#d9a441');
}

// ---------------- desenho de uma mesa ----------------
function clashSet() {
  const s = new Set();
  for (const c of (data && data.clashes) || []) for (const id of c.who) s.add(id);
  return s;
}

function drawDesk(cell, t, clashing) {
  const { p, x, y } = cell, lk = look(p.id), st = p.state, f = (t / 140) | 0;
  const seed = hash(p.id) % 997;
  // divisória com certificados
  const px = x + 8, py = y + 2, pw = CELL_W - 16, ph = 26;
  r(px - 1, py - 1, pw + 2, ph + 2, clashing && f % 4 < 2 ? '#d6453d' : '#6b7d8c');
  r(px, py, pw, ph, '#8fa3b3');
  for (let k = 0; k < pw; k += 4) r(px + k, py + ((k / 4) % 2), 1, ph - 1, '#86998a00');
  r(px, py, pw, 2, '#a9bccb');
  const certs = certsOf(p);
  const fit = Math.floor((pw - 6) / 13);
  cell.certs = [];
  certs.slice(0, fit).forEach((c, i) => {
    const cx = px + 4 + i * 13, cy = py + 5 + (i % 2) * 3;
    drawCert(cx, cy, c, t);
    cell.certs.push({ c, x: cx, y: cy, w: 11, h: 9 });
  });
  cell.extraCerts = Math.max(0, certs.length - fit);
  // mesa
  const dx = x + 18, dy = y + 40, dw = 78;
  r(dx, dy, dw, 8, '#a8794f'); r(dx, dy, dw, 1, '#c4936a'); r(dx, dy + 8, dw, 9, '#8a5f3b'); r(dx + 2, dy + 17, 3, 6, '#6b4a2e'); r(dx + dw - 5, dy + 17, 3, 6, '#6b4a2e');
  // monitor
  const mx = x + CELL_W / 2 - 16, my = y + 21;
  r(mx - 1, my - 1, 34, 20, '#2f2f36'); drawScreen(mx, my, 32, 18, st, t, seed);
  r(mx + 14, my + 19, 4, 2, '#2f2f36'); r(mx + 10, my + 20, 12, 1, '#2f2f36');
  r(x + CELL_W / 2 - 9, dy + 3, 18, 3, '#d8d4cc'); r(x + CELL_W / 2 - 8, dy + 4, 16, 1, '#bdb8ae');
  // caneca do pc da pessoa
  r(dx + 6, dy + 2, 4, 4, SHIRT[(seed >> 2) % SHIRT.length]);
  // cadeira e pessoa
  const cx = x + CELL_W / 2 - 6, cy = y + 38;
  const front = st === 'needs_you' || st === 'waiting';
  r(cx - 2, cy + 22, 16, 3, '#3b3b44'); r(cx + 5, cy + 25, 2, 5, '#2b2b33'); r(cx, cy + 30, 12, 1, '#2b2b33');
  if (front) r(cx - 1, cy + 8, 14, 14, '#4a4a55');
  drawPerson(cx, cy, lk, st, t);
  if (!front) { r(cx - 2, cy + 15, 16, 8, '#4a4a55'); r(cx - 2, cy + 15, 16, 1, '#5b5b68'); }
  // balão
  const bk = st === 'needs_you' ? 'need' : st === 'waiting' ? 'wait' : st === 'thinking' ? 'think' : st === 'asleep' ? 'zz' : null;
  if (bk) bubble(cx + 12, cy - 16, bk, t);
  // estagiários (subagentes)
  cell.interns = p.subagents || [];
  cell.interns.slice(0, 2).forEach((a, i) => drawIntern(x + (i ? 3 : CELL_W - 15), y + 46, a, t));
  // seleção
}

// ---------------- etiquetas HTML (texto nítido) ----------------
function ago(ms) {
  const s = Math.max(0, ms / 1000) | 0, a = T.ago;
  if (s < 60) return s + a.s;
  if (s < 3600) return ((s / 60) | 0) + a.m;
  if (s < 86400) return ((s / 3600) | 0) + a.h;
  return ((s / 86400) | 0) + a.d;
}

function stateText(p) {
  const base = T.states[p.state] || p.state;
  if (p.doing && ['edit', 'read', 'terminal', 'web', 'skill', 'mcp', 'delegate', 'other'].includes(p.state)) return `${base}${p.doing.what ? ' · ' + p.doing.what : ''}`;
  if (p.state === 'waiting' && p.doing) return `${p.doing.tool} ${T.for(ago(p.doing.for))}`;
  if (p.state === 'idle' || p.state === 'asleep') return `${base} · ${ago(data.now - (p.since || p.lastActivity))}`;
  return base;
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

let lastHits = '', lastTags = '';
const hitsLayer = document.createElement('div'), tagsLayer = document.createElement('div');
overlay.append(hitsLayer, tagsLayer);
function renderOverlay() {
  // duas camadas: as áreas de toque quase nunca mudam (e não perdem o tooltip); as etiquetas mudam todo segundo
  const parts = [], tags = [];
  for (const cell of layout) {
    const { p, x, y } = cell;
    const cls = p.state === 'needs_you' ? 'need' : p.state === 'waiting' ? 'wait' : '';
    const repo = p.repo ? `${p.repo.name}${p.branch && p.branch !== 'HEAD' ? ' · ' + p.branch : ''}` : '';
    parts.push(`<div class="desk-hit" data-id="${esc(p.id)}" style="left:${x * S}px;top:${(y + 18) * S}px;width:${CELL_W * S}px;height:${66 * S}px"></div>`);
    tags.push(`<button class="tag ${cls} ${selected === p.id ? 'sel' : ''}" data-id="${esc(p.id)}" style="left:${(x + CELL_W / 2) * S}px;top:${(y + 72) * S}px;max-width:${CELL_W * S - 8}px">
      <span class="nm">${esc(p.name)}</span>
      <span class="tt" title="${esc(p.title)}">${esc(p.title || repo || '—')}</span>
      <span class="st">${esc(stateText(p))}${repo && p.title ? ' · ' + esc(repo) : ''}</span></button>`);
    for (const c of cell.certs || []) {
      const label = c.c.kind === 'badge' ? `${T.kinds.badge}: ${c.c.name} — ${c.c.desc}` : `${T.kinds[c.c.kind]}: ${c.c.name} (${c.c.n}×)`;
      parts.push(`<div class="hit" title="${esc(label)}" style="left:${c.x * S}px;top:${c.y * S}px;width:${c.w * S}px;height:${c.h * S}px"></div>`);
    }
    if (cell.extraCerts) parts.push(`<span class="more" style="left:${(x + CELL_W - 22) * S}px;top:${(y + 20) * S}px">+${cell.extraCerts}</span>`);
    (cell.interns || []).slice(0, 2).forEach((a, i) => {
      const ix = x + (i ? 3 : CELL_W - 15);
      parts.push(`<div class="hit" title="${esc(a.type)}${a.description ? ': ' + esc(a.description) : ''}${a.doing ? ' — ' + esc(a.doing) : ''}" style="left:${ix * S}px;top:${(y + 46) * S}px;width:${12 * S}px;height:${22 * S}px"></div>`);
    });
    if ((cell.interns || []).length > 2) parts.push(`<span class="more" style="left:${(x + CELL_W - 12) * S}px;top:${(y + 70) * S}px">+${cell.interns.length - 2}</span>`);
  }
  if (hallBox) parts.push(`<div class="desk-hit" data-hall="1" title="${esc(T.panel.hall)}" style="left:${hallBox.x * S}px;top:${hallBox.y * S}px;width:${hallBox.w * S}px;height:${hallBox.h * S}px"></div>`);
  const h = parts.join(''), g = tags.join('');
  if (h !== lastHits) { hitsLayer.innerHTML = h; lastHits = h; }
  if (g !== lastTags) { tagsLayer.innerHTML = g; lastTags = g; }
}

// ---------------- painel lateral ----------------
const panel = document.getElementById('panel'), panelBody = document.getElementById('panel-body');
function fmtK(n) { return n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n); }
const KIND_ICON = { edit: '✎', read: '👁', terminal: '›_', web: '🌐', delegate: '👥', skill: '✦', mcp: '🔌', other: '•', ask: '?' };

function renderPanel() {
  if (!selected || !data) { panel.hidden = true; return; }
  panel.hidden = false;
  const P = T.panel;
  if (selected === '__hall') {
    const c = data.credentials;
    panelBody.innerHTML = `<h2>${esc(P.hall)}</h2><p class="sub">${esc(data.host)}</p>
      <h3>${esc(P.topSkills)}</h3>${c.topSkills.length ? `<ul class="list">${c.topSkills.map((s, i) => `<li><span class="k">${['🥇', '🥈', '🥉'][i] || '·'}</span>${esc(s.name)}<span class="t">${s.count}×</span></li>`).join('')}</ul>` : '<p class="note">—</p>'}
      <h3>${esc(P.installed)}</h3><div class="certs">${c.skills.map(s => `<div class="cert" style="--c:${CERT.skill}"><small>${T.kinds.skill}</small>${esc(s)}</div>`).join('') || '—'}</div>
      <h3>${esc(P.mcps)}</h3><div class="certs">${c.mcps.map(s => `<div class="cert" style="--c:${CERT.mcp}"><small>MCP</small>${esc(s)}</div>`).join('') || '—'}</div>
      ${c.plugins.length ? `<h3>${esc(P.plugins)}</h3><ul class="list">${c.plugins.map(s => `<li>${esc(s.name)}<span class="t">${s.count}×</span></li>`).join('')}</ul>` : ''}`;
    return;
  }
  const p = data.people.find(x => x.id === selected);
  if (!p) { selected = null; panel.hidden = true; return; }
  const col = KIND_COLOR[p.state] || '#888';
  const ctxMax = p.ctx > 2e5 ? 1e6 : 2e5;
  const certs = certsOf(p);
  const tools = Object.entries(p.tools || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
  panelBody.innerHTML = `
    <h2>${esc(p.name)}</h2><p class="sub">${esc(p.title || '—')}</p>
    <span class="pill" style="background:${col}">${esc(T.states[p.state] || p.state)}</span>
    ${p.doing ? `<dl style="margin-top:10px"><dt>${P.doing}</dt><dd><code>${esc(p.doing.tool)}</code> ${esc(p.doing.what)} <span class="note">${esc(T.for(ago(p.doing.for)))}</span></dd></dl>` : ''}
    ${p.state === 'waiting' ? `<p class="note">${esc(P.waitNote)}</p>` : ''}
    <h3>${P.where}</h3><dl>
      ${p.repo ? `<dt>${P.repo}</dt><dd>${esc(p.repo.name)}${p.repo.isWorktree ? ` <span class="note">(${P.worktree})</span>` : ''}</dd>` : ''}
      ${p.branch ? `<dt>${P.branch}</dt><dd><code>${esc(p.branch)}</code></dd>` : ''}
      ${p.cwd ? `<dt>${P.folder}</dt><dd><code>${esc(p.cwd)}</code></dd>` : ''}
      ${p.editing.length ? `<dt>${P.editingIn}</dt><dd>${p.editing.map(e => esc(e.repo)).join(', ')}</dd>` : ''}
      ${p.model ? `<dt>${P.model}</dt><dd><code>${esc(p.model)}</code></dd>` : ''}
      <dt>${P.started}</dt><dd>${esc(ago(data.now - p.startedAt))} · ${P.turns}: ${p.turns}</dd>
      <dt>${P.version}</dt><dd>${esc(p.version || '')} · pid ${p.pid}</dd>
    </dl>
    ${p.ctx ? `<h3>${P.context}</h3><div>${esc(P.tokens(fmtK(p.ctx)))}</div><div class="meter"><i style="width:${Math.min(100, p.ctx / ctxMax * 100)}%"></i></div><p class="note">${esc(P.ctxNote)}</p>` : ''}
    ${p.subagents.length ? `<h3>${P.team}</h3><ul class="list">${p.subagents.map(a => `<li><span class="k">${KIND_ICON[a.state] || '•'}</span><span><b>${esc(a.type)}</b> ${esc(a.description)}${a.doing ? `<br><span class="note">${esc(a.doing)}</span>` : ''}</span></li>`).join('')}</ul>` : ''}
    <h3>${P.recent}</h3><ul class="list">${p.recent.map(a => `<li><span class="k">${KIND_ICON[a.kind] || '•'}</span><span><code>${esc(a.tool)}</code> ${esc(a.what)}</span><span class="t">${esc(ago(data.now - a.ts))}</span></li>`).join('') || '<li>—</li>'}</ul>
    <h3>${P.certs}</h3>${certs.length ? `<div class="certs">${certs.map(c => `<div class="cert" style="--c:${certColor(c)}"><small>${T.kinds[c.kind]}</small>${esc(c.name)}${c.kind === 'badge' ? `<br><span class="note">${esc(c.desc)}</span>` : ` <span class="note">${c.n}×</span>`}</div>`).join('')}</div>` : `<p class="note">${P.noCerts}</p>`}
    ${tools.length ? `<h3>${P.tools}</h3><ul class="list">${tools.map(([k, n]) => `<li><code>${esc(k)}</code><span class="t">${n}×</span></li>`).join('')}</ul>` : ''}
    <p class="note" style="margin-top:18px">${P.session}: <code>${esc(p.id)}</code></p>`;
}

overlay.addEventListener('click', e => {
  const el = e.target.closest('[data-id],[data-hall]');
  if (!el) return;
  const id = el.dataset.hall ? '__hall' : el.dataset.id;
  selected = selected === id ? null : id;
  renderOverlay(); renderPanel();
});
document.getElementById('panel-close').onclick = () => { selected = null; renderOverlay(); renderPanel(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && selected) { selected = null; renderOverlay(); renderPanel(); } });

// ---------------- barra de cima ----------------
function renderBar() {
  document.getElementById('host').textContent = data.host || '';
  const c = { work: 0, need: 0, turn: 0, sleep: 0 };
  for (const p of data.people) {
    if (p.state === 'needs_you' || p.state === 'waiting') c.need++;
    else if (p.state === 'idle') c.turn++;
    else if (p.state === 'asleep') c.sleep++;
    else c.work++;
  }
  document.getElementById('counts').innerHTML = [
    `<span><i style="background:${KIND_COLOR.terminal}"></i>${c.work} ${T.working}</span>`,
    c.need ? `<span class="need"><i style="background:${KIND_COLOR.needs_you}"></i>${c.need} ${T.needYou}</span>` : '',
    `<span><i style="background:${KIND_COLOR.idle}"></i>${c.turn} ${T.yourTurn}</span>`,
    c.sleep ? `<span><i style="background:${KIND_COLOR.asleep}"></i>${c.sleep} ${T.asleep}</span>` : '',
  ].join('');
  document.title = (c.need ? `(${c.need}) ` : '') + 'claudehq';
  const box = document.getElementById('clashes');
  const names = id => (data.people.find(p => p.id === id) || {}).name || id.slice(0, 6);
  box.innerHTML = data.clashes.map(cl => `<div>${T.clash(cl.who.map(names).map(esc).join(T.and), esc(cl.repo))}</div>`).join('');
  box.hidden = !data.clashes.length;
  const empty = document.getElementById('empty');
  empty.innerHTML = T.empty; empty.hidden = data.people.length > 0;
  document.getElementById('btn-notify').textContent = T.notify;
  document.getElementById('btn-notify').setAttribute('aria-pressed', notifyOn);
  document.getElementById('btn-sound').textContent = T.sound;
  document.getElementById('btn-sound').setAttribute('aria-pressed', soundOn);
  document.getElementById('btn-lang').textContent = T.lang;
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
}

// ---------------- avisos ----------------
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

document.getElementById('btn-notify').onclick = async () => {
  if (!notifyOn && 'Notification' in window && Notification.permission !== 'granted') {
    try { await Notification.requestPermission(); } catch {}
  }
  notifyOn = !notifyOn; store.set('notify', notifyOn); renderBar();
};
document.getElementById('btn-sound').onclick = () => { soundOn = !soundOn; store.set('sound', soundOn); if (soundOn) beep(false); renderBar(); };
document.getElementById('btn-lang').onclick = () => { lang = lang === 'pt' ? 'en' : 'pt'; T = I18N[lang]; store.set('lang', lang); renderAll(); };

// ---------------- laço ----------------
let lastLayoutKey = '';
function renderAll() {
  if (!data) return;
  const key = data.people.map(p => p.id).join(',') + '|' + document.getElementById('stage').clientWidth;
  if (key !== lastLayoutKey) { lastLayoutKey = key; relayout(); }
  frame(performance.now(), true);
  renderBar(); renderPanel();
}

let lastFrame = -1;
function frame(t, force) {
  const f = (t / 140) | 0;
  if (f !== lastFrame || force) {
    lastFrame = f;
    drawRoom(t);
    const cs = clashSet();
    for (const cell of layout) drawDesk(cell, t, cs.has(cell.p.id));
    if (force) renderOverlay();
  }
}
function loop(t) { if (data) frame(t, false); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
window.addEventListener('resize', () => { lastLayoutKey = ''; renderAll(); });

// ---------------- dados ----------------
const offline = document.getElementById('offline');
function connect() {
  const es = new EventSource('events');
  es.onmessage = e => {
    offline.hidden = true;
    const d = JSON.parse(e.data);
    if (d.error) return;
    data = d;
    notifyChanges();
    renderAll();
  };
  es.onerror = () => { offline.textContent = T.offline; offline.hidden = false; };
}
connect();
