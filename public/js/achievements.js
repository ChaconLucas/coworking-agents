'use strict';
// ---------------- achievements: tiers from measured history (usage scan) and the live office ----------------
// Each achievement has thresholds; the tier is how many were reached (bronze, silver, gold, diamond, ...).
// Everything is computed from data already measured: per-day activity and tokens from /api/usage, open
// sessions from the live snapshot, cat pets from clicks. Records of live-only facts are kept in this browser.
const TIER_COLOR = ['#8b9bb4', '#cd7f32', '#c0cbdc', '#ffd84d', '#2ce8f5', '#ff6ec7'];
const TIER_NAME = ['locked', 'bronze', 'silver', 'gold', 'diamond', 'legend'];
const achRecord = prog.record; // saved in progress.json (see progress.js)
const achSave = () => saveProgress();
const recordMax = (k, v) => { if (v > (achRecord[k] || 0)) { achRecord[k] = v; achSave(); } };
function achBump(k, n = 1) { achRecord[k] = (achRecord[k] || 0) + n; achSave(); }
function achAdd(k, v) { const a = Array.isArray(achRecord[k]) ? achRecord[k] : (achRecord[k] = []); if (!a.includes(v)) { a.push(v); achSave(); } }
const achCount = k => Array.isArray(achRecord[k]) ? achRecord[k].length : (achRecord[k] || 0);
// opening the office counts a visit per day; 3am visits are noted (a secret)
{ const d = new Date(); achAdd('openDays', d.toISOString().slice(0, 10)); if (d.getHours() === 3) achBump('nightShift'); }

// facts from history: the busiest day, streaks, nights, weekends, totals
function achFacts() {
  const u = usageData, days = (u && u.days) || {}, keys = Object.keys(days).sort();
  const work = k => days[k] && days[k].tools >= 10; // a day counts when there was real work
  let streak = 0, best = 0, prev = null;
  for (const k of keys) {
    if (!work(k)) continue;
    const d = new Date(k + 'T12:00:00');
    streak = prev && (d - prev) / 864e5 < 1.5 ? streak + 1 : 1;
    best = Math.max(best, streak); prev = d;
  }
  const hourOf = ts => new Date(ts).getHours(), dow = k => new Date(k + 'T12:00:00').getDay();
  const vals = keys.filter(work).map(k => days[k]);
  const byAgent = (u && u.byAgent) || {}, sum = f => Object.values(byAgent).reduce((n, g) => n + (f(g) || 0), 0);
  const models = new Set(Object.values(byAgent).flatMap(g => Object.keys(g.byModel || {})));
  const cred = Object.values((data && data.credentials) || {});
  return {
    dayHours: Math.max(0, ...vals.map(d => d.activeMs / 36e5)),
    dayTools: Math.max(0, ...vals.map(d => d.tools)),
    dayOut: Math.max(0, ...vals.map(d => d.output || 0)),
    streak: best,
    days: vals.length,
    nights: keys.filter(k => days[k] && days[k].tools && hourOf(days[k].first) < 5).length,
    early: keys.filter(k => days[k] && days[k].tools && hourOf(days[k].first) >= 5 && hourOf(days[k].first) < 7).length,
    weekends: keys.filter(k => work(k) && [0, 6].includes(dow(k))).length,
    fridays: keys.filter(k => work(k) && dow(k) === 5 && hourOf(days[k].last) >= 18).length,
    mondays: keys.filter(k => work(k) && dow(k) === 1 && hourOf(days[k].first) < 9).length,
    longDays: keys.filter(k => work(k) && days[k].last - days[k].first >= 14 * 36e5).length,
    dualAI: keys.filter(k => days[k] && days[k].agents && days[k].agents.length >= 2).length,
    output: sum(g => g.total && g.total.output), cache: sum(g => g.total && g.total.cacheRead),
    usd: sum(g => g.cost && g.cost.usd), convs: sum(g => g.sessions),
    models: models.size,
    skills: Math.max(0, ...cred.map(c => (c.skills || []).length)), mcps: Math.max(0, ...cred.map(c => (c.mcps || []).length)),
    parallel: achCount('parallel'), aiKinds: achCount('aiKinds'), pets: achCount('pets'), zeroQueue: achCount('zeroQueue'),
    clashes: achCount('clashes'), team: achCount('team'), bigCtx: achCount('bigCtx'), files: achCount('files'), sessionTools: achCount('sessionTools'),
    fast: achCount('fast'), patience: achCount('patience'), compacts: achCount('compacts'), focusDone: achCount('focusDone'),
    replay: achCount('replay'), avatars: achCount('avatars'), lights: achCount('lights'), weatherDays: achCount('weatherDays'),
    holidays: achCount('holidays'), lang: achCount('lang'), openDays: achCount('openDays'), catVisits: achCount('catVisits'),
    radio: achCount('radio'), decorate: achCount('decorate'), purchases: achCount('purchases'), photos: achCount('photos'), parties: achCount('parties'), celebrations: achCount('celebrations'), nightShift: achCount('nightShift'), konami: achCount('konami'),
  };
}

// group: where it comes from (history, live, you); secret: hidden as ??? until the first tier
const ACH = [
  { id: 'marathon', g: 'history', icon: '⏱', fact: 'dayHours', steps: [2, 4, 8, 12, 20] },
  { id: 'hands', g: 'history', icon: '✎', fact: 'dayTools', steps: [100, 500, 1000, 3000, 6000] },
  { id: 'sprint', g: 'history', icon: '⚡', fact: 'dayOut', steps: [2e5, 1e6, 3e6, 6e6, 1e7] },
  { id: 'streak', g: 'history', icon: '🔥', fact: 'streak', steps: [3, 7, 14, 30, 60] },
  { id: 'veteran', g: 'history', icon: '★', fact: 'days', steps: [7, 30, 90, 180, 365] },
  { id: 'longday', g: 'history', icon: '🌗', fact: 'longDays', steps: [1, 5, 15, 40, 100] },
  { id: 'owl', g: 'history', icon: '☾', fact: 'nights', steps: [1, 5, 15, 40, 100] },
  { id: 'early', g: 'history', icon: '☀', fact: 'early', steps: [1, 5, 15, 40, 100] },
  { id: 'monday', g: 'history', icon: '☕', fact: 'mondays', steps: [1, 4, 12, 26, 52] },
  { id: 'friday', g: 'history', icon: '🍕', fact: 'fridays', steps: [1, 4, 12, 26, 52] },
  { id: 'weekend', g: 'history', icon: '⛱', fact: 'weekends', steps: [1, 4, 12, 30, 80] },
  { id: 'duo', g: 'history', icon: '⚭', fact: 'dualAI', steps: [1, 5, 20, 50, 100] },
  { id: 'tokens', g: 'history', icon: '◉', fact: 'output', steps: [1e6, 1e7, 5e7, 1e8, 5e8] },
  { id: 'elephant', g: 'history', icon: '🐘', fact: 'cache', steps: [1e9, 1e10, 5e10, 1e11, 5e11] },
  { id: 'whale', g: 'history', icon: '$', fact: 'usd', steps: [100, 1000, 10000, 50000, 100000] },
  { id: 'talker', g: 'history', icon: '❝', fact: 'convs', steps: [10, 50, 200, 500, 1000] },
  { id: 'collector', g: 'history', icon: '🧩', fact: 'models', steps: [2, 4, 6, 10, 15] },
  { id: 'swiss', g: 'history', icon: '🔧', fact: 'skills', steps: [5, 20, 50, 100, 200] },
  { id: 'wired', g: 'history', icon: '🔌', fact: 'mcps', steps: [1, 3, 8, 15, 30] },
  { id: 'orchestra', g: 'live', icon: '♫', fact: 'parallel', steps: [3, 5, 8, 12, 20] },
  { id: 'polyglot', g: 'live', icon: '◆', fact: 'aiKinds', steps: [2, 3, 4, 5, 6] },
  { id: 'boss', g: 'live', icon: '⚑', fact: 'team', steps: [2, 4, 8, 12, 20] },
  { id: 'giant', g: 'live', icon: '🧠', fact: 'bigCtx', steps: [2e5, 4e5, 6e5, 8e5, 9.5e5] },
  { id: 'writer', g: 'live', icon: '📄', fact: 'files', steps: [5, 15, 30, 60, 100] },
  { id: 'workaholic', g: 'live', icon: '⚙', fact: 'sessionTools', steps: [200, 500, 1000, 2000, 4000] },
  { id: 'bump', g: 'live', icon: '💥', fact: 'clashes', steps: [1, 5, 20, 50, 100] },
  { id: 'fast', g: 'live', icon: '🏃', fact: 'fast', steps: [1, 10, 50, 200, 500] },
  { id: 'patience', g: 'live', icon: '🗿', fact: 'patience', steps: [1, 5, 15, 40, 100] },
  { id: 'inbox', g: 'live', icon: '✓', fact: 'zeroQueue', steps: [1, 10, 50, 150, 500] },
  { id: 'regular', g: 'you', icon: '🏢', fact: 'openDays', steps: [1, 7, 30, 100, 365] },
  { id: 'janitor', g: 'you', icon: '🧹', fact: 'compacts', steps: [1, 5, 20, 50, 100] },
  { id: 'monk', g: 'you', icon: '🧘', fact: 'focusDone', steps: [1, 5, 25, 60, 150] },
  { id: 'timetravel', g: 'you', icon: '⏪', fact: 'replay', steps: [1, 10, 30, 100, 300] },
  { id: 'stylist', g: 'you', icon: '🎲', fact: 'avatars', steps: [1, 10, 50, 150, 500] },
  { id: 'electrician', g: 'you', icon: '💡', fact: 'lights', steps: [1, 20, 100, 300, 1000] },
  { id: 'weatherman', g: 'you', icon: '🌦', fact: 'weatherDays', steps: [1, 7, 30, 100, 365] },
  { id: 'bilingual', g: 'you', icon: '🗣', fact: 'lang', steps: [1, 10, 30, 100, 300] },
  { id: 'party', g: 'you', icon: '🎉', fact: 'holidays', steps: [1, 3, 6, 12, 24] },
  { id: 'delivery', g: 'live', icon: '🎊', fact: 'celebrations', steps: [1, 10, 50, 200, 500] },
  { id: 'shopper', g: 'you', icon: '🛍', fact: 'purchases', steps: [1, 2, 4, 6, 8] },
  { id: 'photographer', g: 'you', icon: '📸', fact: 'photos', steps: [1, 5, 20, 50, 100] },
  { id: 'decorator', g: 'you', icon: '🎨', fact: 'decorate', steps: [1, 5, 15, 40, 100] },
  { id: 'dj', g: 'you', icon: '📻', fact: 'radio', steps: [1, 5, 20, 50, 100] },
  { id: 'cat', g: 'you', icon: '♥', fact: 'pets', steps: [1, 10, 50, 200, 1000] },
  { id: 'catwatch', g: 'live', icon: '🐈', fact: 'catVisits', steps: [1, 10, 50, 150, 500] },
  { id: 'nightshift', g: 'you', icon: '🌙', fact: 'nightShift', steps: [1, 3, 7, 15, 30], secret: true },
  { id: 'dancer', g: 'you', icon: '🪩', fact: 'parties', steps: [1, 3, 10, 25, 50], secret: true },
  { id: 'konami', g: 'you', icon: '🕹', fact: 'konami', steps: [1, 3, 10, 25, 50], secret: true },
];

// coins: every tier reached pays out; the super achievement pays 1000. Spent coins are in prog.spent.
const TIER_COINS = [0, 10, 20, 30, 40, 50];
const superDone = st => st.every(a => a.tier >= 5);
function coinsEarned(st = achState()) { return st.reduce((n, a) => n + TIER_COINS.slice(1, a.tier + 1).reduce((x, y) => x + y, 0), 0) + (superDone(st) ? 1000 : 0); }
const coins = () => Math.max(0, coinsEarned() - prog.spent);

function achState() {
  const f = achFacts();
  return ACH.map(a => {
    const v = f[a.fact] || 0, tier = a.steps.filter(s => v >= s).length;
    const next = a.steps[tier], prevStep = tier ? a.steps[tier - 1] : 0;
    return { ...a, value: v, tier, max: a.steps.length, next, progress: next ? Math.max(0, Math.min(1, (v - prevStep) / (next - prevStep))) : 1 };
  });
}

// live facts: how many sessions at once, how many different AIs at once, and emptying a long queue
let achQueueWas = 0;
const achWait = new Map(); // id → when it started asking
function checkAchievements() {
  if (!data || replayAt) return;
  const live = data.people.filter(p => !p.leaving);
  recordMax('parallel', live.length);
  recordMax('aiKinds', new Set(live.map(p => p.agent)).size);
  for (const p of live) {
    recordMax('team', (p.subagents || []).length);
    recordMax('bigCtx', p.ctx || 0);
    recordMax('files', (p.files || []).length);
    recordMax('sessionTools', (p.today && p.today.tools) || 0);
    // how fast you answer: a request that ends within 30s; a wait over 30 min is patience (theirs)
    const w = achWait.get(p.id), asking = p.state === 'needs_you' || p.state === 'waiting';
    if (asking && !w) achWait.set(p.id, data.now - ((p.doing && p.doing.for) || 0));
    if (!asking && w) { const took = data.now - w; noteReply(took); if (took < 30000) achBump('fast'); else if (took > 30 * 60000) achBump('patience'); achWait.delete(p.id); }
  }
  for (const c of data.fileClashes || []) achAdd('clashes', c.file + '|' + c.who.slice().sort().join(','));
  const need = live.filter(p => p.state === 'needs_you' || p.state === 'waiting').length;
  if (achQueueWas >= 2 && need === 0) achBump('zeroQueue');
  achQueueWas = need;
  if (!usageData || !usageData.days) return; // history not scanned yet: don't announce half the picture
  const st = achState(), now = Object.fromEntries(st.map(a => [a.id, a.tier]));
  if (prog.levels) {
    // only achievements that existed last time get announced (new ones in an update join quietly), 3 at most
    const ups = st.filter(a => a.id in prog.levels && a.tier > prog.levels[a.id]);
    if (ups.length > 3) toast(`<b>${esc(T.ach.many(ups.length - 3))}</b>`, 'ok');
    for (const a of ups.slice(0, 3)) {
      const A = T.ach, info = A.list[a.id];
      toast(`<b>${esc(A.unlocked)} · ${esc(A.tiers[a.tier])}</b>${esc(info.name)} — ${esc(info.desc(a.steps[a.tier - 1]))}`, 'ok');
      playTune('trophy');
      trophyFlash = Date.now(); if (a.tier >= 5 || a.secret) confettiAt = Date.now();
    }
  }
  if (!prog.super && superDone(st)) { prog.super = Date.now(); toast(`<b>${esc(T.ach.superUnlocked)}</b>${esc(T.ach.superDone)}`, 'ok sticky'); playTune('trophy'); confettiAt = Date.now(); }
  prog.levels = now; saveProgress();
}
let trophyFlash = 0;

function fmtStep(a, n) {
  if (['output', 'dayOut', 'cache', 'bigCtx'].includes(a.fact)) return fmtK(n);
  if (a.fact === 'usd') return 'US$ ' + Math.round(n).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en');
  if (a.fact === 'dayHours') return n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, '') + 'h';
  return String(Math.round(n));
}

// the report tab: agent of the month first, then every achievement with its tiers and progress
function renderAchievements() {
  const A = T.ach, body = reportEl.querySelector('.report-body'), st = achState();
  const got = st.reduce((n, a) => n + a.tier, 0), all = st.reduce((n, a) => n + a.max, 0);
  const m = usageData && usageData.month, top = (m && m.top) || [];
  const live = new Map(((data && data.people) || []).map(p => [p.id, p]));
  const hrs = ms => { const x = Math.round(ms / 60000); return x >= 60 ? `${(x / 60) | 0}h${String(x % 60).padStart(2, '0')}` : `${x}min`; };
  const monthName = m ? new Date(m.key + '-15').toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en', { month: 'long', year: 'numeric' }) : '';
  const podium = top.length ? `<ol class="aotm">${top.map((x, i) => `<li class="${i ? '' : 'first'}" data-aotm="${esc(x.id)}"><span class="aotm-face" data-face="${esc(x.id)}"></span><span><b>${esc((live.get(x.id) || {}).name || x.title || x.id.slice(0, 8))}</b>${x.title && live.get(x.id) ? `<br><span class="note">${esc(x.title)}</span>` : ''}</span><span class="t">${esc(hrs(x.activeMs))} · ${Number(x.tools) || 0} ${esc(A.actions)}</span></li>`).join('')}</ol>` : `<p class="note">${esc(usageData && usageData.scanning ? T.usage.scanning : A.noMonth)}</p>`;
  const card = a => {
    const hidden = a.secret && !a.tier, info = hidden ? { name: '???', desc: () => A.secret } : A.list[a.id], c = TIER_COLOR[a.tier];
    if (hidden) return `<div class="ach secret"><span class="ach-ico">?</span><div><b>???</b><small>${esc(A.locked)}</small><p>${esc(A.secret)}</p></div></div>`;
    const pips = a.steps.map((s, i) => `<i style="background:${i < a.tier ? TIER_COLOR[i + 1] : 'transparent'}" title="${esc(A.tiers[i + 1])}: ${esc(fmtStep(a, s))}"></i>`).join('');
    return `<div class="ach ${a.tier ? 'on' : ''}" style="--c:${c}"><span class="ach-ico">${a.icon}</span><div><b>${esc(info.name)}</b><small>${esc(a.tier ? A.tiers[a.tier] : A.locked)}</small><p>${esc(info.desc(a.next || a.steps[a.max - 1]))}</p>
      <div class="ach-bar"><i style="width:${(a.progress * 100).toFixed(1)}%"></i></div><div class="ach-foot"><span class="pips">${pips}</span><span>${a.next ? `${esc(fmtStep(a, a.value))} / ${esc(fmtStep(a, a.next))}` : esc(A.maxed)}</span></div></div></div>`;
  };
  const legends = st.filter(a => a.tier >= 5).length, done = superDone(st);
  const superCard = `<div class="ach super ${done ? 'on' : ''}"><span class="ach-ico">👑</span><div><b>${esc(A.superName)}</b><small>${esc(done ? A.tiers[5] : A.locked)}</small><p>${esc(done ? A.superDone : A.superDesc)}</p><div class="ach-bar"><i style="width:${(legends / st.length * 100).toFixed(1)}%"></i></div><div class="ach-foot"><span></span><span>${legends} / ${st.length}</span></div></div></div>`;
  const wallet = `<div class="wallet"><span class="coin"></span><b>${coins().toLocaleString(lang === 'pt' ? 'pt-BR' : 'en')}</b> ${esc(A.coins)}<span class="note">${esc(A.coinsHow)}</span></div>`;
  body.innerHTML = tabsHtml() + `${wallet}${superCard}<h3>${esc(A.aotm)} · ${esc(monthName)}</h3><p class="sub">${esc(A.aotmSub)}</p>${podium}
    <h3>${esc(A.title)} · ${got}/${all}</h3><p class="sub">${esc(A.sub)}</p>
    ${['history', 'live', 'you'].map(g => `<h4 class="ach-g">${esc(A.groups[g])}</h4><div class="achs">${st.filter(a => a.g === g).sort((x, y) => (x.secret && !x.tier) - (y.secret && !y.tier) || y.tier / y.max - x.tier / x.max || y.progress - x.progress).map(card).join('')}</div>`).join('')}`;
  body.querySelectorAll('[data-face]').forEach(el => el.appendChild(Art.portrait(el.dataset.face)));
}
reportEl.addEventListener('click', e => {
  const li = e.target.closest('[data-aotm]');
  if (li && data.people.some(p => p.id === li.dataset.aotm && !p.leaving)) { closeReport(); showPerson(li.dataset.aotm); }
});

// trophy shelf on the wall: one cup per achievement with a tier, best first
function drawTrophyShelf(x, y, w, t) {
  const st = achState().filter(a => a.tier).sort((a, b) => b.tier - a.tier);
  r(x, y + 20, w, 3, '#6b4a33'); r(x, y + 23, w, 1, PAL.ink); r(x + 2, y + 24, 2, 3, '#4a3324'); r(x + w - 4, y + 24, 2, 3, '#4a3324');
  const n = Math.min(st.length, Math.floor((w - 4) / 9)), flash = Date.now() - trophyFlash < 4000;
  for (let i = 0; i < n; i++) {
    const a = st[i], c = TIER_COLOR[a.tier], cx = x + 3 + i * 9 + ((w - 4 - n * 9) / 2 | 0), big = a.tier >= 4;
    const top = y + (big ? 9 : 11);
    r(cx, top, 5, 4, c); r(cx - 1, top, 1, 2, c); r(cx + 5, top, 1, 2, c); // cup and handles
    r(cx + 2, top + 4, 1, 3, c); r(cx + 1, top + 7, 3, 2, shadeHex(c, .7)); r(cx, y + 18, 5, 2, '#3b2a20');
    r(cx + 1, top + 1, 1, 2, '#ffffff99');
    if (big || (flash && i === 0)) { const s = ((t / 160) | 0) + i; if (s % 6 < 2) r(cx + 4, top - 2, 1, 1, '#ffffff'); }
  }
  if (!st.length) pixText(x + w / 2 - 6, y + 12, '---', '#5a4a3a');
  trophyBox = { x, y: y + 4, w, h: 24 };
}
let trophyBox = null;
const shadeHex = (hex, f) => Art.shade(hex, f);

// the classic code unlocks a secret (and a little party)
{ const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']; let at = 0;
  document.addEventListener('keydown', e => {
    at = e.key === seq[at] || e.key.toLowerCase() === seq[at] ? at + 1 : e.key === seq[0] ? 1 : 0;
    if (at === seq.length) { at = 0; achBump('konami'); confettiAt = Date.now(); checkAchievements(); }
  });
}
// confetti over the office (konami, or any legend-tier unlock)
let confettiAt = 0;
function drawConfetti(t) {
  const age = Date.now() - confettiAt;
  if (age > 4000) return;
  for (let i = 0; i < 90; i++) {
    const h = Art.hash('cf' + i), x = (h % W) + Math.sin(age / 300 + i) * 6, y = ((h >>> 8) % 60) - 60 + age / 1000 * (60 + (h >>> 16) % 80);
    if (y > H) continue;
    r(x, y, 2, (h >>> 4) % 2 + 1, TIER_COLOR[1 + (h % 5)]);
  }
}
