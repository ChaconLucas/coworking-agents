'use strict';
// coworks-agents — desenha cada sessão de IA (Claude Code, Codex, …) como uma pessoa num escritório em pixel art.

// ---------------- textos ----------------
const I18N = {
  pt: {
    working: 'trabalhando', needYou: 'precisa de você', yourTurn: 'sua vez', asleep: 'dormindo',
    notify: '🔔 Avisos', sound: '🔊 Som', lang: 'EN',
    empty: 'Nenhuma sessão de IA aberta agora. Abra o <code>claude</code> ou o <code>codex</code> num terminal e ela aparece aqui.',
    offline: 'Sem conexão com o coworks-agents. Tentando de novo…',
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
      mcps: 'Servidores MCP', plugins: 'Plugins', tokens: n => `${n} tokens`, editingIn: 'Editando em', agent: 'IA',
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
    empty: 'No AI sessions open right now. Run <code>claude</code> or <code>codex</code> in a terminal and it shows up here.',
    offline: 'Lost connection to coworks-agents. Retrying…',
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
      mcps: 'MCP servers', plugins: 'Plugins', tokens: n => `${n} tokens`, editingIn: 'Editing in', agent: 'AI',
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
  get(k, d) { try { const v = localStorage.getItem('coworks.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('coworks.' + k, JSON.stringify(v)); } catch {} },
};
const qs = new URLSearchParams(location.search);
let lang = qs.get('lang') || store.get('lang', (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en');
let T = I18N[lang] || I18N.pt;
let notifyOn = store.get('notify', false);
let soundOn = store.get('sound', false);

// ---------------- cores de estado e certificados ----------------
const { PAL, hash, shade, look, r } = Art;
const KIND_COLOR = {
  edit: '#7aa2f7', read: '#d9cdb0', terminal: '#63c74d', web: '#2ce8f5', delegate: '#feae34', skill: '#b55088',
  mcp: '#2ce8f5', other: '#8b9bb4', thinking: '#b4a0f0', needs_you: '#e43b44', waiting: '#feae34', ask: '#e43b44',
  idle: '#3b5dc9', asleep: '#5a6988',
};
const AGENT = { claude: { label: 'Claude Code', color: '#d97757' }, codex: { label: 'Codex', color: '#10a37f' } };
const agentOf = p => AGENT[p.agent] || { label: p.agent || '?', color: '#8a8f98' };
const CERT = { skill: '#e8b04b', mcp: '#2c9a8f', badge: '#e43b44' };
const BADGE_COLOR = { tools100: '#e43b44', tools1000: '#b55088', marathon: '#f77622', immortal: '#68386c', boss: '#3b5dc9', elephant: '#8b9bb4', chat: '#3e8948', terminal: '#265c42', writer: '#b86f50', research: '#0099db' };

// ---------------- geometria ----------------
const CELL_W = 112, CELL_H = 108, TOP = 58, PAD = 10, LOUNGE_W = 136;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
Art.setCtx(ctx);
const overlay = document.getElementById('overlay');
let S = 3, W = 0, H = 0, cols = 1;
let data = null, selected = null, layout = [], lounge = null, hallBox = null, boardBox = null;

function relayout() {
  const avail = Math.min(document.getElementById('stage').clientWidth - 2, 1700);
  const n = data ? Math.max(1, data.people.length) : 1;
  // escala 3 só quando cabem mesas suficientes; senão 2 (e no celular sempre 2)
  const fits = s => Math.floor((avail / s - PAD * 2 - LOUNGE_W) / CELL_W);
  S = avail < 560 ? 2 : fits(3) >= Math.min(n, 3) ? 3 : 2;
  const sideCols = Math.floor((avail / S - PAD * 2 - LOUNGE_W) / CELL_W);
  const side = sideCols >= Math.min(n, 2);
  cols = Math.max(1, Math.min(n, side ? sideCols : Math.floor((avail / S - PAD * 2) / CELL_W)));
  const rows = Math.ceil(n / cols);
  if (side) {
    W = PAD * 2 + cols * CELL_W + LOUNGE_W;
    H = TOP + Math.max(rows * CELL_H, 132) + 6;
    lounge = { x: PAD + cols * CELL_W + 6, y: TOP, w: LOUNGE_W - 10, h: H - TOP - 6, side: true };
  } else {
    W = Math.max(PAD * 2 + cols * CELL_W, 250);
    H = TOP + rows * CELL_H + 96;
    lounge = { x: PAD, y: TOP + rows * CELL_H, w: W - PAD * 2, h: 90, side: false };
  }
  cv.width = W; cv.height = H;
  cv.style.width = W * S + 'px'; cv.style.height = H * S + 'px';
  ctx.imageSmoothingEnabled = false;
  const x0 = side ? PAD : ((W - cols * CELL_W) / 2) | 0;
  layout = (data ? data.people : []).map((p, i) => {
    const x = x0 + (i % cols) * CELL_W, y = TOP + ((i / cols) | 0) * CELL_H;
    return { p, x, y, chair: { x: x + CELL_W / 2 - 8, y: y + 38 }, aisle: y + CELL_H - 30 };
  });
  // lugares na copa: sofá primeiro, depois em pé perto da máquina de café
  const L = lounge, seats = [];
  const sofaW = Math.min(L.w - 26, 4 * 20);
  L.sofa = L.side ? { x: L.x + 14, y: L.y + 44, w: sofaW } : { x: L.x + 18, y: L.y + 30, w: sofaW };
  for (let i = 0; i < Math.floor(sofaW / 20); i++) seats.push({ x: L.sofa.x + 2 + i * 20, y: L.sofa.y - 6, mode: 'sofa' });
  for (let i = 0; i < 6; i++) seats.push(L.side ? { x: L.x + 10 + (i % 4) * 26, y: L.y + 84 + ((i / 4) | 0) * 30, mode: 'stand' } : { x: L.sofa.x + sofaW + 30 + i * 20, y: L.y + 40, mode: 'stand' });
  L.seats = seats;
}

// ---------------- atores (pessoas que andam e o gato) ----------------
const actors = new Map();
const cat = { x: 0, y: 0, tx: 0, ty: 0, mode: 'sit', until: 0, flip: false, ready: false };
const SPEED = 46; // px por segundo

function targetFor(cell, loungeIdx) {
  if (cell.p.state === 'idle' && loungeIdx >= 0 && lounge.seats[loungeIdx]) {
    const s = lounge.seats[loungeIdx];
    return { x: s.x, y: s.y, mode: s.mode, key: 'l' + loungeIdx };
  }
  return { x: cell.chair.x, y: cell.chair.y, mode: 'desk', key: 'd' };
}

function updateActors(dt) {
  let li = 0;
  for (const cell of layout) {
    const t = targetFor(cell, cell.p.state === 'idle' ? li++ : -1);
    let a = actors.get(cell.p.id);
    if (!a) { a = { x: t.x, y: t.y, mode: t.mode, key: t.key, path: [] }; actors.set(cell.p.id, a); }
    if (a.key !== t.key) {
      // desce até o corredor da mesa, anda na horizontal e sobe até o destino
      const ay = cell.aisle;
      a.path = [{ x: a.x, y: ay }, { x: t.x, y: ay }, { x: t.x, y: t.y }];
      a.key = t.key; a.next = t.mode; a.mode = 'walk';
    }
    if (a.mode === 'walk') {
      let step = SPEED * dt;
      while (step > 0 && a.path.length) {
        const w = a.path[0], dx = w.x - a.x, dy = w.y - a.y, d = Math.hypot(dx, dy);
        if (d <= step) { a.x = w.x; a.y = w.y; step -= d; a.path.shift(); }
        else { a.x += dx / d * step; a.y += dy / d * step; a.flip = dx < 0; step = 0; }
      }
      if (!a.path.length) a.mode = a.next;
    }
    cell.actor = a;
  }
  for (const id of actors.keys()) if (!layout.some(c => c.p.id === id)) actors.delete(id);
}

function updateCat(dt, t) {
  const minX = PAD, maxX = W - PAD - 12, minY = TOP + 24, maxY = H - 12;
  if (!cat.ready) { cat.x = lounge.x + lounge.w / 2; cat.y = lounge.sofa.y + 30; cat.tx = cat.x; cat.ty = cat.y; cat.ready = true; }
  if (cat.mode === 'walk') {
    const dx = cat.tx - cat.x, dy = cat.ty - cat.y, d = Math.hypot(dx, dy), step = 22 * dt;
    if (d <= step) { cat.x = cat.tx; cat.y = cat.ty; cat.mode = Math.random() < .5 ? 'sit' : 'sleep'; cat.until = t + (cat.mode === 'sleep' ? 15000 : 4000) + Math.random() * 6000; }
    else { cat.x += dx / d * step; cat.y += dy / d * step; cat.flip = dx < 0; }
  } else if (t > cat.until) {
    // prefere deitar ao pé de quem está dormindo
    const sleeper = layout.find(c => c.p.state === 'asleep');
    if (sleeper && Math.random() < .6) { cat.tx = sleeper.x + CELL_W - 26; cat.ty = sleeper.y + 64; }
    else { cat.tx = minX + Math.random() * (maxX - minX); cat.ty = Math.random() < .5 ? lounge.sofa.y + 28 + Math.random() * 20 : minY + Math.random() * (maxY - minY); }
    cat.tx = Math.max(minX, Math.min(maxX, cat.tx)); cat.ty = Math.max(minY, Math.min(maxY, cat.ty));
    cat.mode = 'walk';
  }
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
  if ((tools.Agent || 0) + (tools.Task || 0) + (tools.Workflow || 0) + (tools.spawn_agent || 0) > 0) add('boss');
  if (p.ctx >= 5e5) add('elephant');
  if (p.turns >= 50) add('chat');
  if ((tools.Bash || 0) + (tools.exec_command || 0) + (tools.exec || 0) >= 50) add('terminal');
  if ((tools.Edit || 0) + (tools.Write || 0) + (tools.apply_patch || 0) >= 50) add('writer');
  if ((tools.WebSearch || 0) + (tools.WebFetch || 0) + (tools.web_search || 0) > 0) add('research');
  return out;
}
function certColor(c) { return c.kind === 'badge' ? BADGE_COLOR[c.key] || CERT.badge : CERT[c.kind]; }

function clashSet() {
  const s = new Set();
  for (const c of (data && data.clashes) || []) for (const id of c.who) s.add(id);
  return s;
}

function counts() {
  const c = { work: 0, need: 0, turn: 0, sleep: 0 };
  for (const p of data.people) {
    if (p.state === 'needs_you' || p.state === 'waiting') c.need++;
    else if (p.state === 'idle') c.turn++;
    else if (p.state === 'asleep') c.sleep++;
    else c.work++;
  }
  return c;
}

// ---------------- cena ----------------
function drawWall(t, sky) {
  r(0, 0, W, TOP - 6, PAL.wall);
  for (let x = 0; x < W; x += 24) r(x, 0, 1, TOP - 6, PAL.wallShade);
  r(0, 0, W, 3, PAL.wallTrim); r(0, 3, W, 1, PAL.ink2);
  r(0, TOP - 8, W, 2, PAL.wallShade); r(0, TOP - 6, W, 5, PAL.base); r(0, TOP - 6, W, 1, '#8f553f'); r(0, TOP - 1, W, 1, PAL.ink);
  // janelas, quadro branco, mural e relógio dividem a parede
  const right = W - 8;
  hallBox = { x: right - 78, y: 8, w: 74, h: 34 };
  Art.drawCork(hallBox.x, hallBox.y, hallBox.w, hallBox.h, data ? Object.values(data.credentials || {}).flatMap(c => c.topSkills || []).sort((a, b) => b.count - a.count) : []);
  Art.drawClock(hallBox.x - 18, 22);
  boardBox = { x: hallBox.x - 84, y: 9, w: 56, h: 32 };
  if (boardBox.x > 80) Art.drawWhiteboard(boardBox.x, boardBox.y, boardBox.w, boardBox.h, counts(), t); else boardBox = null;
  const winEnd = (boardBox ? boardBox.x : hallBox.x - 26) - 14;
  const nWin = Math.max(1, Math.floor((winEnd - 12) / 74));
  for (let i = 0; i < nWin; i++) Art.drawWindow(14 + i * 74, 9, 48, 30, sky, t, i);
  return nWin;
}

function drawShafts(nWin, sky) {
  if (sky.phase === 'night') return;
  ctx.save();
  ctx.fillStyle = sky.phase === 'day' ? 'rgba(255,246,214,0.10)' : 'rgba(255,180,120,0.10)';
  for (let i = 0; i < nWin; i++) {
    const x = 14 + i * 74;
    ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x + 48, TOP); ctx.lineTo(x + 78, TOP + 70); ctx.lineTo(x + 30, TOP + 70); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawDesk(cell, t, clashing, lights, glows, sky) {
  const { p, x, y } = cell, st = p.state, f = (t / 140) | 0, seed = hash(p.id) % 997;
  const a = cell.actor || { mode: 'desk' };
  const atDesk = a.mode === 'desk';
  // divisória com os certificados
  const px = x + 6, py = y + 2, pw = CELL_W - 12, ph = 28;
  r(px + 2, py + ph + 1, pw, 2, '#00000022');
  r(px - 1, py - 1, pw + 2, ph + 2, clashing && f % 4 < 2 ? PAL.red : PAL.ink);
  r(px, py, pw, ph, PAL.fabric);
  for (let yy = 3; yy < ph; yy += 2) for (let xx = (yy % 4) ? 1 : 3; xx < pw; xx += 4) r(px + xx, py + yy, 1, 1, PAL.fabricDot);
  r(px, py, pw, 2, PAL.alu); r(px, py + 2, pw, 1, PAL.aluDark);
  const certs = certsOf(p), fit = Math.floor((pw - 8) / 13);
  cell.certs = [];
  certs.slice(0, fit).forEach((c, i) => {
    const cx = px + 5 + i * 13, cy = py + 6 + (i % 2) * 3;
    Art.drawCertificate(cx, cy, certColor(c), c.kind === 'badge');
    cell.certs.push({ c, x: cx, y: cy, w: 11, h: 9 });
  });
  cell.extraCerts = Math.max(0, certs.length - fit);
  // monitor
  const mw = 34, mh = 20, mx = x + CELL_W / 2 - mw / 2, my = y + 18;
  const screenState = atDesk ? st : (st === 'idle' ? 'idle' : st);
  r(mx - 2, my - 2, mw + 4, mh + 4, PAL.ink); r(mx - 1, my - 1, mw + 2, mh + 2, PAL.bezel); r(mx - 1, my - 1, mw + 2, 1, PAL.bezelLight);
  Art.drawScreen(mx, my, mw, mh, screenState, t, seed);
  r(mx + mw / 2 - 2, my + mh + 2, 4, 3, PAL.ink); r(mx + mw / 2 - 6, my + mh + 4, 12, 2, PAL.ink);
  const glow = Art.SCREEN_GLOW[screenState];
  if (glow) { glows.push({ x: mx + mw / 2, y: my + mh / 2, r: 30, c: glow }); lights.push({ x: mx + mw / 2, y: my + mh, r: 26 }); }
  // mesa
  const dx = x + 16, dy = y + 42, dw = CELL_W - 32;
  r(dx + 2, dy + 18, dw, 6, '#00000026');
  r(dx - 1, dy - 1, dw + 2, 20, PAL.ink);
  r(dx, dy, dw, 9, PAL.deskTop); r(dx, dy, dw, 1, PAL.deskLight); r(dx, dy + 9, dw, 9, PAL.deskFront); r(dx, dy + 9, dw, 1, PAL.deskDark);
  r(dx + 3, dy + 18, 3, 6, PAL.ink); r(dx + dw - 6, dy + 18, 3, 6, PAL.ink);
  // teclado e mouse
  r(x + CELL_W / 2 - 10, dy + 2, 20, 4, PAL.ink); r(x + CELL_W / 2 - 9, dy + 2, 18, 3, '#c0cbdc'); r(x + CELL_W / 2 - 9, dy + 4, 18, 1, '#8b9bb4');
  r(x + CELL_W / 2 + 13, dy + 3, 3, 3, PAL.ink); r(x + CELL_W / 2 + 13, dy + 3, 2, 2, '#c0cbdc');
  // objetos da mesa (fixos por pessoa)
  const item = seed % 3;
  if (item === 0) { const on = sky.phase !== 'day'; Art.drawLamp(dx + 2, dy - 10, on); if (on) lights.push({ x: dx + 6, y: dy + 2, r: 40 }); }
  else if (item === 1) Art.drawPlant(dx + 1, dy - 12, false);
  else { r(dx + 3, dy + 1, 12, 6, PAL.ink); r(dx + 4, dy + 1, 10, 5, PAL.paper); r(dx + 5, dy + 2, 8, 1, PAL.paperLine); r(dx + 6, dy, 10, 5, PAL.ink); r(dx + 7, dy, 8, 4, '#ffffff'); }
  // caneca e plaquinha da IA
  const mugX = dx + dw - 12;
  r(mugX, dy, 6, 6, PAL.ink); r(mugX + 1, dy + 1, 4, 4, Art.SHIRT[(seed >> 2) % Art.SHIRT.length]); r(mugX + 5, dy + 2, 2, 2, PAL.ink);
  if (atDesk && st !== 'asleep' && f % 8 < 5) r(mugX + 2, dy - 3 - (f % 3), 1, 2, '#ffffff99');
  const ag = agentOf(p).color;
  r(dx + dw - 30, dy + 11, 16, 5, PAL.ink); r(dx + dw - 29, dy + 12, 14, 3, ag); r(dx + dw - 27, dy + 13, 10, 1, '#ffffffaa');
  // cadeira e pessoa
  const cx = cell.chair.x, cy = cell.chair.y;
  Art.drawChairBase(cx, cy + 24);
  if (atDesk) {
    const lk = look(p.id);
    if (st === 'needs_you' || st === 'waiting') {
      Art.drawChairBack(cx, cy + 8);
      Art.drawFront(cx, cy - 2, lk, t, { legs: Art.LEGS_SIT, legsKey: 'sit', wave: st === 'needs_you', mouth: st === 'needs_you' ? 'open' : 'flat' });
    } else if (st === 'asleep') {
      Art.drawSleeping(cx, cy, lk, t);
      Art.drawChairBack(cx, cy + 14);
    } else {
      Art.drawSeatedBack(cx, cy, lk, t, { typing: st === 'edit' || st === 'terminal', reading: st === 'read' });
      Art.drawChairBack(cx, cy + 14);
    }
  } else Art.drawChairBack(cx, cy + 14);
  // estagiários (subagentes) em pé ao lado da mesa
  cell.interns = p.subagents || [];
  cell.interns.slice(0, 2).forEach((s, i) => {
    const ix = i ? x + 1 : x + CELL_W - 17, iy = y + 40;
    Art.drawStanding(ix, iy, look(s.id + p.id), t, false);
    r(ix + (i ? 12 : -2), iy + 12, 6, 7, PAL.ink); r(ix + (i ? 13 : -1), iy + 13, 4, 5, KIND_COLOR[s.state] || '#c0cbdc');
  });
}

function drawLounge(t, glows, lights) {
  const L = lounge;
  if (L.side) { r(L.x - 4, TOP, 2, L.h + 6, '#00000014'); }
  const rugX = L.x + 4, rugY = L.sofa.y + 26, rugW = L.w - 8, rugH = Math.min(L.h - (rugY - L.y) - 4, L.side ? 56 : 52);
  if (rugH > 12) Art.drawRug(rugX, rugY, rugW, rugH);
  // encostados à parede
  const busyCoffee = layout.some(c => c.actor && c.actor.mode === 'walk');
  if (L.side) {
    Art.drawCoffeeMachine(L.x + L.w - 20, L.y - 16, t, busyCoffee);
    Art.drawCooler(L.x + L.w - 40, L.y - 18, t);
    Art.drawPlant(L.x + 2, L.y - 12, true);
  } else {
    Art.drawCoffeeMachine(L.x + L.w - 22, L.y + 8, t, busyCoffee);
    Art.drawCooler(L.x + L.w - 42, L.y + 6, t);
    Art.drawPlant(L.x + 2, L.y + 22, true);
  }
  lights.push({ x: L.x + L.w - 12, y: L.y, r: 22 });
  glows.push({ x: L.x + L.w - 12, y: L.y - 6, r: 14, c: '#2ce8f5' });
  Art.drawSofa(L.sofa.x, L.sofa.y, L.sofa.w);
}

function drawLoungePeople(t) {
  const out = [];
  for (const cell of layout) {
    const a = cell.actor;
    if (!a || a.mode === 'desk') continue;
    const lk = look(cell.p.id);
    if (a.mode === 'sofa') Art.drawFront(a.x, a.y, lk, t, { legs: Art.LEGS_SIT, legsKey: 'sit', mug: true });
    else out.push({ y: a.y, draw: () => Art.drawStanding(a.x, a.y, lk, t, a.mode === 'walk') });
  }
  return out;
}

function drawScene(t, dt) {
  const hr = new Date().getHours() + new Date().getMinutes() / 60;
  const sky = Art.skyFor(qs.get('hour') ? Number(qs.get('hour')) : hr);
  updateActors(dt);
  updateCat(dt, t);
  const lights = [], glows = [];
  Art.drawFloor(W, H, TOP);
  const nWin = drawWall(t, sky);
  drawShafts(nWin, sky);
  if (sky.phase !== 'night') for (let i = 0; i < nWin; i++) lights.push({ x: 38 + i * 74, y: TOP + 20, r: 60 });
  drawLounge(t, glows, lights);
  const cs = clashSet();
  for (const cell of layout) drawDesk(cell, t, cs.has(cell.p.id), lights, glows, sky);
  // quem está no sofá, quem anda e o gato, por ordem de profundidade
  const movers = drawLoungePeople(t);
  movers.push({ y: cat.y, draw: () => Art.drawCat(cat.x, cat.y, cat.mode, t, cat.flip) });
  movers.sort((a, b) => a.y - b.y).forEach(m => m.draw());
  Art.applyLight(W, H, sky, lights, glows);
  // balões por cima da luz
  for (const cell of layout) {
    const st = cell.p.state, a = cell.actor;
    if (!a || a.mode !== 'desk') continue;
    const bk = st === 'needs_you' ? 'need' : st === 'waiting' ? 'wait' : st === 'thinking' ? 'think' : st === 'asleep' ? 'zz' : null;
    if (bk) Art.bubble(cell.chair.x + 13, cell.chair.y - 15, bk, t);
  }
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
    parts.push(`<div class="desk-hit" data-id="${esc(p.id)}" style="left:${x * S}px;top:${(y + 14) * S}px;width:${CELL_W * S}px;height:${54 * S}px"></div>`);
    tags.push(`<button class="tag ${cls} ${selected === p.id ? 'sel' : ''}" data-id="${esc(p.id)}" style="left:${(x + CELL_W / 2) * S}px;top:${(y + 72) * S}px;max-width:${CELL_W * S - 8}px">
      <span class="nm" style="--ag:${agentOf(p).color}" title="${esc(agentOf(p).label)}">${esc(p.name)}</span>
      <span class="tt" title="${esc(p.title)}">${esc(p.title || repo || '—')}</span>
      <span class="st">${esc(stateText(p))}${repo && p.title ? ' · ' + esc(repo) : ''}</span></button>`);
    for (const c of cell.certs || []) {
      const label = c.c.kind === 'badge' ? `${T.kinds.badge}: ${c.c.name} — ${c.c.desc}` : `${T.kinds[c.c.kind]}: ${c.c.name} (${c.c.n}×)`;
      parts.push(`<div class="hit" title="${esc(label)}" style="left:${c.x * S}px;top:${c.y * S}px;width:${c.w * S}px;height:${c.h * S}px"></div>`);
    }
    if (cell.extraCerts) parts.push(`<span class="more" style="left:${(x + CELL_W - 22) * S}px;top:${(y + 20) * S}px">+${cell.extraCerts}</span>`);
    (cell.interns || []).slice(0, 2).forEach((a, i) => {
      const ix = i ? x + 1 : x + CELL_W - 17;
      parts.push(`<div class="hit" title="${esc(a.type)}${a.description ? ': ' + esc(a.description) : ''}${a.doing ? ' — ' + esc(a.doing) : ''}" style="left:${ix * S}px;top:${(y + 40) * S}px;width:${16 * S}px;height:${24 * S}px"></div>`);
    });
    if ((cell.interns || []).length > 2) parts.push(`<span class="more" style="left:${(x + CELL_W - 12) * S}px;top:${(y + 64) * S}px">+${cell.interns.length - 2}</span>`);
    // quem foi para a copa continua clicável lá
    const a = cell.actor;
    if (a && a.mode !== 'desk' && a.mode !== 'walk') parts.push(`<div class="desk-hit" data-id="${esc(p.id)}" title="${esc(p.name)} · ${esc(T.states[p.state] || '')}" style="left:${Math.round(a.x) * S}px;top:${Math.round(a.y - 2) * S}px;width:${18 * S}px;height:${24 * S}px"></div>`);
  }
  if (boardBox && data) { const c = counts(); parts.push(`<div class="hit" title="${c.work} ${esc(T.working)} · ${c.need} ${esc(T.needYou)} · ${c.turn} ${esc(T.yourTurn)} · ${c.sleep} ${esc(T.asleep)}" style="left:${boardBox.x * S}px;top:${boardBox.y * S}px;width:${boardBox.w * S}px;height:${boardBox.h * S}px"></div>`); }
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
    const section = (id, c) => {
      const a = AGENT[id] || { label: id, color: '#888' };
      return `<h3 style="color:${a.color}">${esc(a.label)}</h3>
      ${c.topSkills.length ? `<p class="note">${esc(P.topSkills)}</p><ul class="list">${c.topSkills.map((s, i) => `<li><span class="k">${['🥇', '🥈', '🥉'][i] || '·'}</span>${esc(s.name)}<span class="t">${s.count}×</span></li>`).join('')}</ul>` : ''}
      ${c.skills.length ? `<p class="note">${esc(P.installed)}</p><div class="certs">${c.skills.map(s => `<div class="cert" style="--c:${CERT.skill}"><small>${T.kinds.skill}</small>${esc(s)}</div>`).join('')}</div>` : ''}
      ${c.mcps.length ? `<p class="note">${esc(P.mcps)}</p><div class="certs">${c.mcps.map(s => `<div class="cert" style="--c:${CERT.mcp}"><small>MCP</small>${esc(s)}</div>`).join('')}</div>` : ''}
      ${c.plugins.length ? `<p class="note">${esc(P.plugins)}</p><ul class="list">${c.plugins.map(s => `<li>${esc(s.name)}<span class="t">${s.count}×</span></li>`).join('')}</ul>` : ''}`;
    };
    panelBody.innerHTML = `<h2>${esc(P.hall)}</h2><p class="sub">${esc(data.host)}</p>` +
      Object.entries(data.credentials || {}).map(([id, c]) => section(id, c)).join('');
    return;
  }
  const p = data.people.find(x => x.id === selected);
  if (!p) { selected = null; panel.hidden = true; return; }
  const col = KIND_COLOR[p.state] || '#888';
  const ctxMax = p.ctxMax || (p.ctx > 2e5 ? 1e6 : 2e5);
  const certs = certsOf(p);
  const tools = Object.entries(p.tools || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
  panelBody.innerHTML = `
    <h2>${esc(p.name)}</h2><p class="sub">${esc(p.title || '—')}</p>
    <span class="pill" style="background:${agentOf(p).color}">${esc(agentOf(p).label)}</span>
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
      <dt>${P.version}</dt><dd>${esc(p.version || '')}${p.pid ? ' · pid ' + p.pid : ''}</dd>
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
  document.title = (c.need ? `(${c.need}) ` : '') + 'coworks-agents';
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
  renderOverlay(); renderBar(); renderPanel();
}

let lastFrame = -1, lastT = 0;
function loop(t) {
  if (data && W) {
    const f = (t / 70) | 0; // ~14 quadros por segundo, ritmo de pixel art
    if (f !== lastFrame) {
      const dt = lastT ? Math.min(.25, (t - lastT) / 1000) : 0;
      lastT = t; lastFrame = f;
      drawScene(t, dt);
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener('resize', () => { lastLayoutKey = ''; renderAll(); });
setInterval(() => { if (data) renderOverlay(); }, 500);

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
