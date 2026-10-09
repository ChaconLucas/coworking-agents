'use strict';
// coworks-agents — desenha cada sessão de IA (Claude Code, Codex, …) como uma pessoa num escritório em pixel art.

// ---------------- textos ----------------
const I18N = {
  pt: {
    working: 'trabalhando', needYou: 'precisa de você', yourTurn: 'sua vez', asleep: 'dormindo', floor: n => `${n}º andar`,
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
      goto: 'Ir para o terminal', gotoCodex: 'Abrir o Codex',
      focus: {
        ok: app => `Pronto: aba do ${app} na frente.`, app: app => `Abri o ${app}, mas ele não deixa escolher a aba.`,
        automation: app => `O macOS bloqueou o controle do ${app}. Libere em Ajustes do Sistema › Privacidade e Segurança › Automação.`,
        notty: 'A sessão não está num terminal (talvez no app Desktop).', unknown: 'Não reconheci o app do terminal desta sessão.',
        platform: 'Só funciona no macOS por enquanto.', demo: 'No modo demo não há terminal de verdade.', gone: 'Essa sessão já fechou.', codex: 'Não encontrei o app do Codex.', nopid: 'Sem processo para encontrar.',
      },
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
    working: 'working', needYou: 'need you', yourTurn: 'your turn', asleep: 'asleep', floor: n => `Floor ${n}`,
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
      goto: 'Go to terminal', gotoCodex: 'Open Codex',
      focus: {
        ok: app => `Done: ${app} tab brought to front.`, app: app => `Opened ${app}, but it doesn't let me pick the tab.`,
        automation: app => `macOS blocked controlling ${app}. Allow it in System Settings › Privacy & Security › Automation.`,
        notty: "This session isn't in a terminal (maybe the Desktop app).", unknown: "Couldn't recognize this session's terminal app.",
        platform: 'macOS only for now.', demo: 'Demo mode has no real terminal.', gone: 'That session has closed.', codex: "Couldn't find the Codex app.", nopid: 'No process to find.',
      },
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

// ---------------- planta do andar ----------------
// Cada repositório é uma sala com as mesas dos seus agentes; as salas ficam em faixas à esquerda.
// À direita, uma ala comum: copa, pingue-pongue, sala de reunião e canto da soneca.
// Com muitas salas, o escritório ganha andares (cada andar tem a sua ala comum).
const TOP = 58, CELL_W = 100, CELL_H = 96, RW = 148, ROOM_PAD = 6, ROOM_HEAD = 14, SHELF_GAP = 14, MAX_SHELVES = 3;
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
Art.setCtx(ctx);
const overlay = document.getElementById('overlay');
let S = 3, W = 480, H = 300, CX = 320, RX = 330;
let data = null, selected = null, layout = [], desks = [], rooms = [], floors = [], floor = 0, spots = null, hallBox = null, boardBox = null, wing = null;

function roomKey(p) {
  if (p.repo && p.repo.name) return p.repo.name;
  const base = (p.cwd || '').split('/').filter(Boolean).pop();
  return base ? '~' + base : '—';
}

function planFloors(people, leftW) {
  // agrupa por repositório; ordem estável pelo nome
  const groups = new Map();
  for (const p of people) { const k = roomKey(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  const maxCols = Math.max(1, Math.floor((leftW - ROOM_PAD * 2) / CELL_W));
  const list = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, ps]) => {
    const cols = Math.min(maxCols, Math.max(1, Math.min(3, ps.length)));
    return { name, people: ps, cols, rows: Math.ceil(ps.length / cols), w: cols * CELL_W + ROOM_PAD * 2 };
  });
  // empacota em faixas (prateleiras) e as faixas em andares
  const out = [];
  let cur = { shelves: [] }, shelf = null;
  for (const room of list) {
    if (!shelf || shelf.used + room.w > leftW) {
      if (cur.shelves.length >= MAX_SHELVES) { out.push(cur); cur = { shelves: [] }; }
      shelf = { rooms: [], used: 0 };
      cur.shelves.push(shelf);
    }
    shelf.rooms.push(room); shelf.used += room.w + 8;
  }
  if (cur.shelves.length || !out.length) out.push(cur);
  return out;
}

function relayout() {
  const stage = document.getElementById('stage');
  const availW = Math.min(stage.clientWidth - 4, 2400);
  // com várias salas, encolhe a escala para caberem duas lado a lado; com uma só, fica grande
  const groups = new Set((data ? data.people : []).map(roomKey)).size;
  const s0 = Math.max(1.6, Math.min(3, availW / (groups > 1 ? 840 : 520)));
  W = Math.max(480, Math.min(920, Math.floor(availW / s0)));
  CX = W - RW - 14; RX = CX + 10;
  const leftW = CX - 12;
  floors = planFloors(data ? data.people : [], leftW);
  if (floor >= floors.length) floor = floors.length - 1;
  // salas do andar atual
  rooms = []; desks = [];
  let y = TOP + 4;
  for (const shelf of floors[floor].shelves) {
    let x = 8, shelfH = 0;
    for (const room of shelf.rooms) {
      const h = ROOM_HEAD + room.rows * CELL_H + 4;
      const R = { ...room, x, y, h, doorX: x + Math.round(room.w / 2) - 9 };
      R.people.forEach((p, i) => {
        const dx = x + ROOM_PAD + (i % room.cols) * CELL_W, dy = y + ROOM_HEAD + ((i / room.cols) | 0) * CELL_H;
        desks.push({ p, room: R, x: dx, y: dy, chair: { x: dx + CELL_W / 2 - 8, y: dy + 38 }, aisle: dy + 72 });
      });
      rooms.push(R);
      x += room.w + 8; shelfH = Math.max(shelfH, h);
    }
    y += shelfH + SHELF_GAP;
  }
  layout = desks.map(d => Object.assign({}, d));
  layout.forEach((c, i) => { desks[i].cell = c; });
  // ala comum
  wing = { copa: TOP, ping: TOP + 112, meet: TOP + 184, nap: TOP + 290, bottom: TOP + 372 };
  spots = {
    sofa: [0, 1, 2, 3].map(i => ({ x: RX + 12 + i * 19, y: TOP + 50, zone: 'lounge', pose: 'sit' })),
    stools: [{ x: RX + 104, y: TOP + 56, zone: 'lounge', pose: 'stand' }, { x: RX + 126, y: TOP + 56, zone: 'lounge', pose: 'stand' }],
    coffee: [{ x: RX + 48, y: TOP + 14, zone: 'lounge', pose: 'stand' }, { x: RX + 66, y: TOP + 16, zone: 'lounge', pose: 'stand' }],
    ping: [{ x: RX + 8, y: wing.ping + 16, zone: 'ping', pose: 'stand' }, { x: RX + RW - 22, y: wing.ping + 16, zone: 'ping', pose: 'stand', flip: true }],
    meetTop: [0, 1, 2].map(i => ({ x: RX + 32 + i * 32, y: wing.meet + 16, zone: 'meet', pose: 'sit' })),
    meetBot: [0, 1, 2].map(i => ({ x: RX + 32 + i * 32, y: wing.meet + 54, zone: 'meet', pose: 'back' })),
    nap: [{ x: RX + 8, y: wing.nap + 30 }, { x: RX + 46, y: wing.nap + 46 }, { x: RX + 84, y: wing.nap + 30 }].map(p => ({ ...p, zone: 'nap' })),
  };
  H = Math.max(y, wing.bottom) + 6;
  fitScale();
  renderFloors();
}

function fitScale() {
  const stage = document.getElementById('stage');
  const availW = Math.min(stage.clientWidth - 4, 2400);
  S = Math.max(1.5, Math.floor(Math.min(availW / W, 4) * 4) / 4);
  cv.width = W; cv.height = H;
  cv.style.width = W * S + 'px'; cv.style.height = H * S + 'px';
  ctx.imageSmoothingEnabled = false;
  // escala pequena: o crachá mostra nome e estado; o título fica no tooltip
  document.getElementById('office').classList.toggle('compact', S < 2.25);
}

// seletor de andares (só aparece com mais de um)
function renderFloors() {
  let bar = document.getElementById('floors');
  if (!bar) { bar = document.createElement('nav'); bar.id = 'floors'; bar.className = 'floors'; document.getElementById('stage').before(bar); bar.addEventListener('click', e => { const b = e.target.closest('[data-floor]'); if (b) goFloor(+b.dataset.floor); }); }
  if (floors.length < 2) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = floors.map((f, i) => {
    const ps = f.shelves.flatMap(s => s.rooms.flatMap(r => r.people));
    const need = ps.filter(p => p.state === 'needs_you' || p.state === 'waiting').length;
    const names = f.shelves.flatMap(s => s.rooms.map(r => r.name));
    return `<button class="floor ${i === floor ? 'on' : ''}" data-floor="${i}" title="${esc(names.join(', '))}"><b>${esc(T.floor(i + 1))}</b> <span>${esc(names.slice(0, 3).join(' · '))}${names.length > 3 ? ' +' + (names.length - 3) : ''}</span>${need ? ` <i class="dot">${need}</i>` : ''}</button>`;
  }).join('');
}
function goFloor(i) { if (i === floor || i < 0 || i >= floors.length) return; floor = i; actors.clear(); want.clear(); lastLayoutKey = ''; renderAll(); }
function floorOf(id) { return floors.findIndex(f => f.shelves.some(s => s.rooms.some(r => r.people.some(p => p.id === id)))); }

// ---------------- para onde cada pessoa vai ----------------
const ZONE_OF = { idle: 'lounge', asleep: 'nap', delegate: 'meet' };
const DWELL_MS = 3500;
const want = new Map();

function plan(now) {
  const assign = new Map();
  const zoneFor = cell => {
    const z = ZONE_OF[cell.p.state] || 'desk';
    let w = want.get(cell.p.id);
    if (!w) { w = { zone: z, since: 0, settled: z }; want.set(cell.p.id, w); }
    if (w.zone !== z) { w.zone = z; w.since = now; }
    if (z === 'desk' || now - w.since >= DWELL_MS) w.settled = w.zone;
    return w.settled;
  };
  const byZone = { lounge: [], nap: [], meet: [], desk: [] };
  for (const c of layout) byZone[zoneFor(c)].push(c);
  const lounge = byZone.lounge, free = [];
  if (lounge.length >= 2) { assign.set(lounge[0].p.id, spots.ping[0]); assign.set(lounge[1].p.id, spots.ping[1]); free.push(...lounge.slice(2)); }
  else free.push(...lounge);
  const seats = [...spots.sofa, ...spots.stools, ...spots.coffee];
  free.forEach((c, i) => assign.set(c.p.id, seats[i] || null));
  byZone.meet.forEach((c, i) => assign.set(c.p.id, spots.meetTop[i] || spots.meetBot[i - 3] || null));
  byZone.nap.forEach((c, i) => assign.set(c.p.id, spots.nap[i] || null));
  return assign;
}

// ---------------- atores ----------------
const actors = new Map();
const cat = { x: 0, y: 0, tx: 0, ty: 0, mode: 'sit', until: 0, flip: false, ready: false };
const SPEED = 52;

// cada lugar sabe sair até o corredor vertical (CX); o caminho é: sair, corredor, entrar
function exitPath(pt, cell) {
  if (pt.x < CX && cell) {
    const R = cell.room;
    return [{ x: pt.x, y: cell.aisle }, { x: R.doorX + 9, y: cell.aisle }, { x: R.doorX + 9, y: R.y + R.h + 6 }];
  }
  if (pt.y >= wing.meet && pt.y < wing.nap) return [{ x: pt.x, y: wing.meet + 40 }, { x: RX + 2, y: wing.meet + 40 }];
  return [{ x: pt.x, y: pt.y + 22 }];
}
function route(from, to, cell) {
  const out = exitPath(from, from.x < CX ? cell : null), inn = exitPath(to, to.x < CX ? cell : null).reverse();
  const a = out[out.length - 1], b = inn[0];
  return [...out, { x: CX, y: a.y }, { x: CX, y: b.y }, ...inn, { x: to.x, y: to.y }];
}

function updateActors(dt, now) {
  const assign = plan(now);
  for (const cell of layout) {
    const spot = assign.get(cell.p.id);
    const t = spot ? { x: spot.x, y: spot.y, mode: spot.zone, spot, key: spot.zone + spot.x + ',' + spot.y } : { x: cell.chair.x, y: cell.chair.y, mode: 'desk', key: 'desk' };
    let a = actors.get(cell.p.id);
    if (!a) { a = { x: t.x, y: t.y, mode: t.mode, spot: t.spot, key: t.key, path: [] }; actors.set(cell.p.id, a); }
    if (a.key !== t.key) { a.path = route({ x: a.x, y: a.y }, t, cell); a.key = t.key; a.next = t; a.mode = 'walk'; }
    if (a.mode === 'walk') {
      let step = (a.next.mode === 'desk' ? SPEED * 2 : SPEED) * dt;
      while (step > 0 && a.path.length) {
        const w = a.path[0], dx = w.x - a.x, dy = w.y - a.y, d = Math.hypot(dx, dy);
        if (d <= step) { a.x = w.x; a.y = w.y; step -= d; a.path.shift(); }
        else { a.x += dx / d * step; a.y += dy / d * step; if (Math.abs(dx) > .5) a.flip = dx < 0; step = 0; }
      }
      if (!a.path.length) { a.mode = a.next.mode; a.spot = a.next.spot; }
    }
    cell.actor = a;
  }
  for (const id of actors.keys()) if (!layout.some(c => c.p.id === id)) { actors.delete(id); want.delete(id); }
}

function updateCat(dt, t) {
  if (!cat.ready) { cat.x = RX + 60; cat.y = TOP + 90; cat.tx = cat.x; cat.ty = cat.y; cat.ready = true; }
  if (cat.mode === 'walk') {
    const dx = cat.tx - cat.x, dy = cat.ty - cat.y, d = Math.hypot(dx, dy), step = 22 * dt;
    if (d <= step) { cat.x = cat.tx; cat.y = cat.ty; cat.mode = Math.random() < .5 ? 'sit' : 'sleep'; cat.until = t + (cat.mode === 'sleep' ? 15000 : 4000) + Math.random() * 6000; }
    else { cat.x += dx / d * step; cat.y += dy / d * step; cat.flip = dx < 0; }
  } else if (t > cat.until) {
    const places = [{ x: RX + 40, y: TOP + 90 }, { x: RX + 100, y: TOP + 96 }, { x: CX - 4, y: TOP + 40 + Math.random() * (H - TOP - 60) }, { x: RX + 60, y: wing.nap + 66 }];
    const sleeper = layout.find(c => c.actor && c.actor.mode === 'nap');
    const p = sleeper && Math.random() < .5 ? { x: sleeper.actor.x + 22, y: sleeper.actor.y + 10 } : places[(Math.random() * places.length) | 0];
    cat.tx = p.x; cat.ty = p.y; cat.mode = 'walk';
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
  const nWin = Math.max(1, Math.floor((CX - 30) / 74));
  for (let i = 0; i < nWin; i++) Art.drawWindow(16 + i * 74, 9, 48, 30, sky, t, i);
  boardBox = { x: RX - 14, y: 8, w: 56, h: 30 };
  Art.drawWhiteboard(boardBox.x, boardBox.y, boardBox.w, boardBox.h, counts(), t);
  Art.drawClock(RX + 58, 20);
  hallBox = { x: RX + 74, y: 7, w: 72, h: 32 };
  Art.drawCork(hallBox.x, hallBox.y, hallBox.w, hallBox.h, data ? Object.values(data.credentials || {}).flatMap(c => c.topSkills || []).sort((a, b) => b.count - a.count) : []);
  return nWin;
}

function drawShafts(sky, nWin) {
  if (sky.phase === 'night') return;
  ctx.save();
  ctx.fillStyle = sky.phase === 'day' ? 'rgba(255,246,214,0.08)' : 'rgba(255,180,120,0.08)';
  for (let i = 0; i < nWin; i++) {
    const x = 16 + i * 74;
    ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x + 48, TOP); ctx.lineTo(x + 80, TOP + 80); ctx.lineTo(x + 32, TOP + 80); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// sala de um repositório vista de cima: carpete com a cor do repo, paredes, porta e placa
function drawRoom(R, t) {
  const h = hash(R.name), hue = ['#6b5a7a', '#5a6b7a', '#5a7a6b', '#7a6b5a', '#7a5a62', '#5f6f8a', '#6f8a5f'][h % 7];
  r(R.x, R.y, R.w, R.h, hue);
  for (let yy = 2; yy < R.h; yy += 3) for (let xx = (yy % 6) ? 1 : 3; xx < R.w; xx += 4) r(R.x + xx, R.y + yy, 1, 1, shade(hue, .9));
  // paredes: a de cima com face (dá altura), laterais e de baixo finas, porta no meio de baixo
  r(R.x - 2, R.y - 2, R.w + 4, 3, PAL.ink); r(R.x - 2, R.y + 1, R.w + 4, 6, PAL.wall); r(R.x - 2, R.y + 7, R.w + 4, 1, PAL.wallShade);
  r(R.x - 2, R.y, 3, R.h + 2, PAL.ink); r(R.x + R.w - 1, R.y, 3, R.h + 2, PAL.ink);
  r(R.x - 2, R.y + R.h, R.doorX - R.x + 2, 3, PAL.ink); r(R.doorX + 18, R.y + R.h, R.x + R.w - R.doorX - 16, 3, PAL.ink);
  r(R.doorX, R.y + R.h, 18, 3, '#8f553f'); r(R.doorX, R.y + R.h, 1, 3, PAL.ink2); r(R.doorX + 17, R.y + R.h, 1, 3, PAL.ink2);
  // placa (o texto vem por HTML, nítido)
  r(R.x + 4, R.y + 1, 6, 5, agentRoomColor(R)); 
}
function agentRoomColor(R) {
  if (R.people.some(p => p.state === 'needs_you' || p.state === 'waiting')) return PAL.red;
  if (R.people.some(p => !['idle', 'asleep'].includes(p.state))) return PAL.green;
  return '#8b9bb4';
}

function drawDesk(d, t, clashing, lights, glows, sky) {
  const { x, y } = d, p = d.cell ? d.cell.p : d.p, f = (t / 140) | 0, seed = hash(p ? p.id : 'empty' + x + y) % 997;
  const cell = d.cell;
  const a = cell && cell.actor;
  const atDesk = !!(a && a.mode === 'desk');
  const st = p ? p.state : 'asleep';
  // divisória
  const px = x + 6, py = y + 2, pw = CELL_W - 12, ph = 28;
  r(px + 2, py + ph + 1, pw, 2, '#00000022');
  r(px - 1, py - 1, pw + 2, ph + 2, clashing && f % 4 < 2 ? PAL.red : PAL.ink);
  r(px, py, pw, ph, PAL.fabric);
  for (let yy = 3; yy < ph; yy += 2) for (let xx = (yy % 4) ? 1 : 3; xx < pw; xx += 4) r(px + xx, py + yy, 1, 1, PAL.fabricDot);
  r(px, py, pw, 2, PAL.alu); r(px, py + 2, pw, 1, PAL.aluDark);
  if (cell) {
    const certs = certsOf(p), fit = Math.floor((pw - 8) / 13);
    cell.certs = [];
    certs.slice(0, fit).forEach((c, i) => {
      const cx = px + 5 + i * 13, cy = py + 6 + (i % 2) * 3;
      Art.drawCertificate(cx, cy, certColor(c), c.kind === 'badge');
      cell.certs.push({ c, x: cx, y: cy, w: 11, h: 9 });
    });
    cell.extraCerts = Math.max(0, certs.length - fit);
  }
  // monitor: desligado na mesa vazia, protetor de tela se a pessoa saiu
  const mw = 34, mh = 20, mx = x + CELL_W / 2 - mw / 2, my = y + 18;
  const screen = !p ? 'asleep' : atDesk ? st : (st === 'asleep' ? 'asleep' : 'idle');
  r(mx - 2, my - 2, mw + 4, mh + 4, PAL.ink); r(mx - 1, my - 1, mw + 2, mh + 2, PAL.bezel); r(mx - 1, my - 1, mw + 2, 1, PAL.bezelLight);
  Art.drawScreen(mx, my, mw, mh, screen, t, seed);
  r(mx + mw / 2 - 2, my + mh + 2, 4, 3, PAL.ink); r(mx + mw / 2 - 6, my + mh + 4, 12, 2, PAL.ink);
  const glow = Art.SCREEN_GLOW[screen];
  if (glow) { glows.push({ x: mx + mw / 2, y: my + mh / 2, r: 30, c: glow }); lights.push({ x: mx + mw / 2, y: my + mh, r: 26 }); }
  // mesa
  const dx = x + 14, dy = y + 42, dw = CELL_W - 28;
  r(dx + 2, dy + 18, dw, 6, '#00000026');
  r(dx - 1, dy - 1, dw + 2, 20, PAL.ink);
  r(dx, dy, dw, 9, PAL.deskTop); r(dx, dy, dw, 1, PAL.deskLight); r(dx, dy + 9, dw, 9, PAL.deskFront); r(dx, dy + 9, dw, 1, PAL.deskDark);
  r(dx + 3, dy + 18, 3, 6, PAL.ink); r(dx + dw - 6, dy + 18, 3, 6, PAL.ink);
  r(x + CELL_W / 2 - 10, dy + 2, 20, 4, PAL.ink); r(x + CELL_W / 2 - 9, dy + 2, 18, 3, '#c0cbdc'); r(x + CELL_W / 2 - 9, dy + 4, 18, 1, '#8b9bb4');
  r(x + CELL_W / 2 + 13, dy + 3, 3, 3, PAL.ink); r(x + CELL_W / 2 + 13, dy + 3, 2, 2, '#c0cbdc');
  const item = seed % 3;
  if (item === 0) { const on = !!p && sky.phase !== 'day'; Art.drawLamp(dx + 2, dy - 10, on); if (on) lights.push({ x: dx + 6, y: dy + 2, r: 40 }); }
  else if (item === 1) Art.drawPlant(dx + 1, dy - 12, false);
  else { r(dx + 3, dy + 1, 12, 6, PAL.ink); r(dx + 4, dy + 1, 10, 5, PAL.paper); r(dx + 5, dy + 2, 8, 1, PAL.paperLine); r(dx + 6, dy, 10, 5, PAL.ink); r(dx + 7, dy, 8, 4, '#ffffff'); }
  if (!p) { Art.drawEmptyChair(d.chair.x, d.chair.y); return; }
  const mugX = dx + dw - 12;
  r(mugX, dy, 6, 6, PAL.ink); r(mugX + 1, dy + 1, 4, 4, Art.SHIRT[(seed >> 2) % Art.SHIRT.length]); r(mugX + 5, dy + 2, 2, 2, PAL.ink);
  if (atDesk && st !== 'asleep' && f % 8 < 5) r(mugX + 2, dy - 3 - (f % 3), 1, 2, '#ffffff99');
  const ag = agentOf(p).color;
  r(dx + dw - 30, dy + 11, 16, 5, PAL.ink); r(dx + dw - 29, dy + 12, 14, 3, ag); r(dx + dw - 27, dy + 13, 10, 1, '#ffffffaa');
  const cx = d.chair.x, cy = d.chair.y;
  if (!atDesk) { Art.drawEmptyChair(cx, cy); return; }
  Art.drawChairBase(cx, cy + 24);
  const lk = look(p.id);
  if (st === 'needs_you' || st === 'waiting') {
    Art.drawChairBack(cx, cy + 8);
    Art.drawFront(cx, cy - 2, lk, t, { legs: Art.LEGS_SIT, legsKey: 'sit', wave: st === 'needs_you', mouth: st === 'needs_you' ? 'open' : 'flat' });
  } else if (st === 'asleep') { Art.drawSleeping(cx, cy, lk, t); Art.drawChairBack(cx, cy + 14); }
  else { Art.drawSeatedBack(cx, cy, lk, t, { typing: st === 'edit' || st === 'terminal', reading: st === 'read' }); Art.drawChairBack(cx, cy + 14); }
  // subagentes que ainda não foram para a reunião ficam em pé ao lado
  cell.interns = p.subagents || [];
  cell.interns.slice(0, 2).forEach((s, i) => {
    const ix = i ? x + 1 : x + CELL_W - 17, iy = y + 40;
    Art.drawStanding(ix, iy, look(s.id + p.id), t, false);
    r(ix + (i ? 12 : -2), iy + 12, 6, 7, PAL.ink); r(ix + (i ? 13 : -1), iy + 13, 4, 5, KIND_COLOR[s.state] || '#c0cbdc');
  });
}

function drawWing(t, lights, glows, pingPlaying, meeting) {
  r(CX - 6, TOP, 1, H - TOP, '#00000018');
  // copa com piso de ladrilho
  Art.drawTile(RX - 4, TOP, RW + 8, 104, '#e8dcc8', '#d9c9ae');
  Art.drawCounter(RX + 22, TOP - 8, 60);
  Art.drawCoffeeMachine(RX + 2, TOP - 16, t, true);
  Art.drawFridge(RX + RW - 20, TOP - 22);
  Art.drawPlant(RX + RW - 40, TOP - 6, false);
  lights.push({ x: RX + 10, y: TOP, r: 22 }); glows.push({ x: RX + 10, y: TOP - 6, r: 14, c: '#2ce8f5' });
  Art.drawRug(RX + 4, TOP + 70, 92, 26);
  Art.drawSofa(RX + 10, TOP + 46, 78);
  Art.drawRoundTable(RX + 108, TOP + 70);
  Art.drawStool(RX + 100, TOP + 82); Art.drawStool(RX + 126, TOP + 82);
  // pingue-pongue
  Art.drawPingPong(RX + 34, wing.ping + 20, 80, 30, t, pingPlaying);
  // sala de reunião de vidro
  const my = wing.meet;
  r(RX - 2, my, RW + 4, 98, '#4f5c7a');
  for (let yy = 2; yy < 98; yy += 3) for (let xx = (yy % 6) ? 1 : 3; xx < RW + 4; xx += 4) r(RX - 2 + xx, my + yy, 1, 1, '#465270');
  Art.drawGlassWall(RX - 2, my, RW + 4, 98, null);
  r(RX - 2, my + 32, 4, 18, '#4f5c7a'); // porta do lado do corredor
  Art.drawTV(RX + 8, my + 8, 18, 12, t, meeting);
  if (meeting) glows.push({ x: RX + 17, y: my + 14, r: 20, c: '#feae34' });
  lights.push({ x: RX + RW / 2, y: my + 46, r: 46 });
  // canto da soneca
  const ny = wing.nap;
  Art.drawRug(RX + 2, ny + 22, RW - 4, 50);
  Art.drawBookshelf(RX + 104, ny + 2, 40, 24);
  for (const [i, sp] of spots.nap.entries()) Art.drawBeanBag(sp.x - 2, sp.y + 2, ['#b55088', '#0099db', '#feae34'][i]);
  Art.drawPrinter(RX + 60, ny + 4, t);
  Art.drawPlant(RX + 4, ny - 2, false);
}

function drawMeeting(t, meetPeople) {
  const top = meetPeople.filter(m => m.spot.pose === 'sit'), bot = meetPeople.filter(m => m.spot.pose === 'back');
  for (const m of top) { Art.drawChairBack(m.spot.x, m.spot.y + 8); Art.drawFront(m.spot.x, m.spot.y - 2, m.lk, t, { legs: Art.LEGS_SIT, legsKey: 'sit' }); }
  Art.drawMeetingTable(RX + 24, wing.meet + 38, 104, 14);
  for (const m of bot) { Art.drawSeatedBack(m.spot.x, m.spot.y, m.lk, t, {}); Art.drawChairBack(m.spot.x, m.spot.y + 14); }
}

function drawPaddle(a, t) {
  const swing = ((t / 700) | 0) % 2 === (a.spot.flip ? 1 : 0);
  const hx = a.spot.flip ? a.x - 3 : a.x + 15, hy = a.y + (swing ? 9 : 13);
  r(hx, hy, 5, 5, PAL.ink); r(hx + 1, hy + 1, 3, 3, PAL.red); r(hx + 2, hy + 5, 1, 2, '#6e3f31');
}
function drawMugInHand(a, t) {
  const f = (t / 140) | 0;
  r(a.x + 12, a.y + 14, 5, 5, PAL.ink); r(a.x + 13, a.y + 15, 3, 3, PAL.white);
  if (f % 8 < 5) r(a.x + 14, a.y + 11 - (f % 3), 1, 2, '#ffffffaa');
}

function drawScene(t, dt) {
  const now = Date.now();
  const hr = new Date().getHours() + new Date().getMinutes() / 60;
  const sky = Art.skyFor(qs.get('hour') ? Number(qs.get('hour')) : hr);
  updateActors(dt, now);
  updateCat(dt, t);
  const lights = [], glows = [];
  Art.drawFloor(W, H, TOP);
  const nWin = drawWall(t, sky);
  drawShafts(sky, nWin);
  if (sky.phase !== 'night') for (let i = 0; i < nWin; i++) lights.push({ x: 40 + i * 74, y: TOP + 20, r: 60 });
  const arrived = z => layout.filter(c => c.actor && c.actor.mode === z);
  const meet = arrived('meet').map(c => ({ spot: c.actor.spot, lk: look(c.p.id) }));
  const used = new Set(meet.map(m => m.spot));
  const freeSeats = [...spots.meetTop, ...spots.meetBot].filter(s => !used.has(s));
  for (const c of arrived('meet')) for (const s of c.p.subagents || []) { const seat = freeSeats.shift(); if (seat) meet.push({ spot: seat, lk: look(s.id + c.p.id) }); }
  drawWing(t, lights, glows, arrived('ping').length >= 2, meet.length > 0);
  drawMeeting(t, meet);
  for (const R of rooms) drawRoom(R, t);
  const cs = clashSet();
  for (const d of desks) drawDesk(d, t, cs.has(d.p.id), lights, glows, sky);
  const movers = [];
  for (const c of layout) {
    const a = c.actor;
    if (!a || a.mode === 'desk' || a.mode === 'meet') continue;
    const lk = look(c.p.id);
    if (a.mode === 'walk') movers.push({ y: a.y, draw: () => Art.drawStanding(a.x, a.y, lk, t, true) });
    else if (a.mode === 'nap') movers.push({ y: a.y, draw: () => Art.drawLying(a.x, a.y, lk, t) });
    else if (a.spot && a.spot.pose === 'sit') movers.push({ y: a.y, draw: () => Art.drawFront(a.x, a.y, lk, t, { legs: Art.LEGS_SIT, legsKey: 'sit', mug: true }) });
    else movers.push({ y: a.y, draw: () => { Art.drawStanding(a.x, a.y, lk, t, false); if (a.mode === 'ping') drawPaddle(a, t); else if (a.mode === 'lounge') drawMugInHand(a, t); } });
  }
  movers.push({ y: cat.y, draw: () => Art.drawCat(cat.x, cat.y, cat.mode, t, cat.flip) });
  movers.sort((a, b) => a.y - b.y).forEach(m => m.draw());
  Art.applyLight(W, H, sky, lights, glows);
  for (const c of layout) {
    const st = c.p.state, a = c.actor;
    if (!a) continue;
    if (a.mode === 'nap') { Art.bubble(a.x + 16, a.y - 14, 'zz', t); continue; }
    if (a.mode !== 'desk') continue;
    const long = c.p.doing && c.p.doing.for > 60000 && !['needs_you', 'waiting'].includes(st);
    const bk = st === 'needs_you' ? 'need' : st === 'waiting' ? 'wait' : long ? 'clock' : st === 'thinking' ? 'think' : st === 'asleep' ? 'zz' : null;
    if (bk) Art.bubble(c.chair.x + 13, c.chair.y - 15, bk, t);
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
  if (p.doing && ['edit', 'read', 'terminal', 'web', 'skill', 'mcp', 'delegate', 'other'].includes(p.state)) return `${base}${p.doing.what ? ' · ' + p.doing.what : ''}${p.doing.for > 60000 ? ' · ' + T.for(ago(p.doing.for)) : ''}`;
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
  // placas das salas e nomes de quem está fora da mesa
  for (const R of rooms) tags.push(`<span class="room-sign" style="left:${(R.x + 12) * S}px;top:${(R.y - 1) * S}px;max-width:${(R.w - 16) * S}px" title="${esc(R.name)}">${esc(R.name)} <em>${R.people.length}</em></span>`);
  for (const cell of layout) {
    const a = cell.actor;
    if (a && a.mode !== 'desk' && a.mode !== 'walk') tags.push(`<span class="away" style="left:${(a.x + 8) * S}px;top:${(a.y - (a.mode === 'nap' ? 6 : 10)) * S}px">${esc(cell.p.name)}</span>`);
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
    <div class="actions"><button class="btn" id="btn-goto" data-id="${esc(p.id)}">${esc(p.agent === 'codex' && !p.pid ? P.gotoCodex : P.goto)} →</button><span class="note" id="goto-msg"></span></div>
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
panelBody.addEventListener('click', async e => {
  const b = e.target.closest('#btn-goto');
  if (!b) return;
  b.disabled = true;
  const msg = document.getElementById('goto-msg'), F = T.panel.focus;
  let out = { ok: false, reason: 'gone' };
  try { out = await fetch('api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coworks': '1' }, body: JSON.stringify({ id: b.dataset.id }) }).then(r => r.json()); } catch {}
  b.disabled = false;
  if (msg) msg.textContent = out.ok ? (out.exact ? F.ok(out.app) : F.app(out.app)) : typeof F[out.reason] === 'function' ? F[out.reason](out.app || '') : (F[out.reason] || F.unknown);
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
  const key = data.people.map(p => p.id + ':' + roomKey(p)).join(',') + '|' + floor + '|' + document.getElementById('stage').clientWidth;
  if (key !== lastLayoutKey) { lastLayoutKey = key; relayout(); }
  else {
    // mesmas pessoas: troca só os dados de cada mesa, senão o desenho fica preso ao estado antigo
    const byId = new Map(data.people.map(p => [p.id, p]));
    for (const c of layout) c.p = byId.get(c.p.id) || c.p;
    for (const d of desks) d.p = byId.get(d.p.id) || d.p;
    for (const f of floors) for (const sh of f.shelves) for (const R of sh.rooms) R.people = R.people.map(p => byId.get(p.id) || p);
    renderFloors();
  }
  renderOverlay(); renderBar(); renderPanel();
}

let lastFrame = -1, lastT = 0;
function loop(t) {
  requestAnimationFrame(loop); // agenda antes: um erro num quadro não pode parar a animação
  if (data && spots) {
    const f = (t / 70) | 0; // ~14 quadros por segundo, ritmo de pixel art
    if (f !== lastFrame) {
      const dt = lastT ? Math.min(.25, (t - lastT) / 1000) : 0;
      lastT = t; lastFrame = f;
      drawScene(t, dt);
    }
  }
}
requestAnimationFrame(loop);
window.addEventListener('resize', () => { if (data) { lastLayoutKey = ''; renderAll(); } });
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
