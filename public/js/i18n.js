'use strict';
// coworking-agents — draws each AI session (Claude Code, Codex, …) as a person in a pixel-art office.

// ---------------- strings ----------------
const I18N = {
  pt: {
    working: 'trabalhando', needYou: 'precisa de você', yourTurn: 'sua vez', asleep: 'dormindo', floor: n => `${n}º andar`, building: 'Ver prédio', agents: 'agentes', moreCerts: n => `+${n} certificado${n > 1 ? 's' : ''} — clique para ver todos`, subagents: n => `${n} subagente${n > 1 ? 's' : ''}`,
    help: { question: 'Tenho uma pergunta para você.', plan: 'Meu plano está pronto. Pode revisar?', run: c => `Posso rodar “${c}”?`, edit: f => `Posso editar ${f}?`, tool: t => `Posso usar ${t}? Está esperando a sua aprovação.`, done: t => `Pronto! ${t}`, see: 'Ver', waitingYou: 'Aguardando sua resposta', nextOffice: 'Ver os próximos pedidos', more: n => `+${n} precisam de você`, less: 'Mostrar menos' },
    notify: '🔔 Avisos', sound: '🔊 Som', lights: 'Luzes do escritório', lang: 'EN',
    empty: 'Nenhuma sessão de IA aberta agora. Abra o <code>claude</code> ou o <code>codex</code> num terminal e ela aparece aqui.',
    offline: 'Sem conexão com o coworking-agents. Tentando de novo…',
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
      lastPrompt: 'Seu último pedido', lastReply: 'Última resposta', timeline: 'Última hora', nowLabel: 'agora', today: 'Hoje',
      activeToday: 'ativo', toolsToday: 'ferramentas', promptsToday: 'pedidos', filesToday: 'arquivos', tokensOut: 'tokens gerados',
      filesNow: 'Mexendo agora', mode: 'Modo de permissão', modes: { auto: 'auto', default: 'pergunta tudo', acceptEdits: 'aceita edições', plan: 'plano', bypassPermissions: 'sem perguntas' },
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
    working: 'working', needYou: 'need you', yourTurn: 'your turn', asleep: 'asleep', floor: n => `Floor ${n}`, building: 'Building view', agents: 'agents', moreCerts: n => `+${n} more certificate${n > 1 ? 's' : ''} — click to see all`, subagents: n => `${n} subagent${n > 1 ? 's' : ''}`,
    help: { question: 'I have a question for you.', plan: 'My plan is ready. Can you review it?', run: c => `Can I run “${c}”?`, edit: f => `Can I edit ${f}?`, tool: t => `Can I use ${t}? Waiting for your approval.`, done: t => `Done! ${t}`, see: 'Show', waitingYou: 'Waiting for your reply', nextOffice: 'Show the next requests', more: n => `+${n} more need you`, less: 'Show less' },
    notify: '🔔 Alerts', sound: '🔊 Sound', lights: 'Office lights', lang: 'PT',
    empty: 'No AI sessions open right now. Run <code>claude</code> or <code>codex</code> in a terminal and it shows up here.',
    offline: 'Lost connection to coworking-agents. Retrying…',
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
      lastPrompt: 'Your last request', lastReply: 'Last reply', timeline: 'Last hour', nowLabel: 'now', today: 'Today',
      activeToday: 'active', toolsToday: 'tools', promptsToday: 'requests', filesToday: 'files', tokensOut: 'tokens out',
      filesNow: 'Touching now', mode: 'Permission mode', modes: { auto: 'auto', default: 'asks everything', acceptEdits: 'accepts edits', plan: 'plan', bypassPermissions: 'no prompts' },
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
  get(k, d) { try { const v = localStorage.getItem('coworking.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('coworking.' + k, JSON.stringify(v)); } catch {} },
};
const qs = new URLSearchParams(location.search);
let lang = qs.get('lang') || store.get('lang', (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en');
if (!Object.prototype.hasOwnProperty.call(I18N, lang)) lang = 'pt';
let T = I18N[lang];
// sound is on by default; alerts follow the browser permission (asked on open). Only the buttons turn them off.
let soundOn = store.get('sound', true);
let lightsOn = store.get('lights', true);
let notifyOn = store.get('notify', null);
