'use strict';
// ---------------- achievements: tiers from measured history (usage scan) and the live office ----------------
// Each achievement has thresholds; the tier is how many were reached (bronze, silver, gold, diamond, ...).
// Everything is computed from data already measured: per-day activity and tokens from /api/usage, open
// sessions from the live snapshot, cat pets from clicks. Records of live-only facts are kept in this browser.
const TIER_COLOR = ['#8b9bb4', '#cd7f32', '#c0cbdc', '#ffd84d', '#2ce8f5', '#ff6ec7'];
const TIER_NAME = ['locked', 'bronze', 'silver', 'gold', 'diamond', 'legend'];
let achRecord = store.get('achRecord', {});
if (!achRecord || typeof achRecord !== 'object') achRecord = {};
const recordMax = (k, v) => { if (v > (achRecord[k] || 0)) { achRecord[k] = v; store.set('achRecord', achRecord); } };

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
  const hourOf = ts => new Date(ts).getHours();
  const vals = keys.filter(work).map(k => days[k]);
  const byAgent = (u && u.byAgent) || {};
  const out = Object.values(byAgent).reduce((n, g) => n + ((g.total && g.total.output) || 0), 0);
  const usd = Object.values(byAgent).reduce((n, g) => n + ((g.cost && g.cost.usd) || 0), 0);
  const convs = Object.values(byAgent).reduce((n, g) => n + (g.sessions || 0), 0);
  return {
    dayHours: Math.max(0, ...vals.map(d => d.activeMs / 36e5)),
    dayTools: Math.max(0, ...vals.map(d => d.tools)),
    streak: best,
    days: vals.length,
    nights: keys.filter(k => days[k] && days[k].tools && hourOf(days[k].first) < 5).length,
    early: keys.filter(k => days[k] && days[k].tools && hourOf(days[k].first) >= 5 && hourOf(days[k].first) < 7).length,
    weekends: keys.filter(k => work(k) && [0, 6].includes(new Date(k + 'T12:00:00').getDay())).length,
    dualAI: keys.filter(k => days[k] && days[k].agents && days[k].agents.length >= 2).length,
    output: out, usd, convs,
    parallel: achRecord.parallel || 0,
    aiKinds: achRecord.aiKinds || 0,
    pets: achRecord.pets || 0,
    zeroQueue: achRecord.zeroQueue || 0,
  };
}

const ACH = [
  { id: 'marathon', icon: '⏱', fact: 'dayHours', steps: [2, 4, 8, 12, 20] },
  { id: 'hands', icon: '✎', fact: 'dayTools', steps: [100, 500, 1000, 3000, 6000] },
  { id: 'streak', icon: '🔥', fact: 'streak', steps: [3, 7, 14, 30, 60] },
  { id: 'veteran', icon: '★', fact: 'days', steps: [7, 30, 90, 180, 365] },
  { id: 'orchestra', icon: '♫', fact: 'parallel', steps: [3, 5, 8, 12, 20] },
  { id: 'polyglot', icon: '◆', fact: 'aiKinds', steps: [2, 3, 4] },
  { id: 'duo', icon: '⚭', fact: 'dualAI', steps: [1, 5, 20] },
  { id: 'tokens', icon: '◉', fact: 'output', steps: [1e6, 1e7, 5e7, 1e8, 5e8] },
  { id: 'whale', icon: '$', fact: 'usd', steps: [100, 1000, 10000, 50000] },
  { id: 'talker', icon: '❝', fact: 'convs', steps: [10, 50, 200, 500] },
  { id: 'owl', icon: '☾', fact: 'nights', steps: [1, 5, 15, 40] },
  { id: 'early', icon: '☀', fact: 'early', steps: [1, 5, 15, 40] },
  { id: 'weekend', icon: '⛱', fact: 'weekends', steps: [1, 4, 12, 30] },
  { id: 'inbox', icon: '✓', fact: 'zeroQueue', steps: [1, 10, 50] },
  { id: 'cat', icon: '♥', fact: 'pets', steps: [1, 10, 50, 200] },
];

function achState() {
  const f = achFacts();
  return ACH.map(a => {
    const v = f[a.fact] || 0, tier = a.steps.filter(s => v >= s).length;
    const next = a.steps[tier], prevStep = tier ? a.steps[tier - 1] : 0;
    return { ...a, value: v, tier, max: a.steps.length, next, progress: next ? Math.max(0, Math.min(1, (v - prevStep) / (next - prevStep))) : 1 };
  });
}

// live facts: how many sessions at once, how many different AIs at once, and emptying a long queue
let achLevels = store.get('achLevels', null), achQueueWas = 0;
function checkAchievements() {
  if (!data || replayAt) return;
  const live = data.people.filter(p => !p.leaving);
  recordMax('parallel', live.length);
  recordMax('aiKinds', new Set(live.map(p => p.agent)).size);
  const need = live.filter(p => p.state === 'needs_you' || p.state === 'waiting').length;
  if (achQueueWas >= 2 && need === 0) { achRecord.zeroQueue = (achRecord.zeroQueue || 0) + 1; store.set('achRecord', achRecord); }
  achQueueWas = need;
  if (!usageData || !usageData.days) return; // history not scanned yet: don't announce half the picture
  const st = achState(), now = Object.fromEntries(st.map(a => [a.id, a.tier]));
  if (achLevels) {
    for (const a of st) if (a.tier > (achLevels[a.id] || 0)) {
      const A = T.ach, info = A.list[a.id];
      toast(`<b>${esc(A.unlocked)} · ${esc(A.tiers[a.tier])}</b>${esc(info.name)} — ${esc(info.desc(a.steps[a.tier - 1]))}`, 'ok');
      playTune('trophy');
      trophyFlash = Date.now();
    }
  }
  achLevels = now; store.set('achLevels', now);
}
let trophyFlash = 0;

function fmtStep(a, n) {
  if (a.fact === 'output') return fmtK(n);
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
    const info = A.list[a.id], c = TIER_COLOR[a.tier];
    const pips = a.steps.map((s, i) => `<i style="background:${i < a.tier ? TIER_COLOR[i + 1] : 'transparent'}" title="${esc(A.tiers[i + 1])}: ${esc(fmtStep(a, s))}"></i>`).join('');
    return `<div class="ach ${a.tier ? 'on' : ''}" style="--c:${c}"><span class="ach-ico">${a.icon}</span><div><b>${esc(info.name)}</b><small>${esc(a.tier ? A.tiers[a.tier] : A.locked)}</small><p>${esc(info.desc(a.next || a.steps[a.max - 1]))}</p>
      <div class="ach-bar"><i style="width:${(a.progress * 100).toFixed(1)}%"></i></div><div class="ach-foot"><span class="pips">${pips}</span><span>${a.next ? `${esc(fmtStep(a, a.value))} / ${esc(fmtStep(a, a.next))}` : esc(A.maxed)}</span></div></div></div>`;
  };
  body.innerHTML = tabsHtml() + `<h3>${esc(A.aotm)} · ${esc(monthName)}</h3><p class="sub">${esc(A.aotmSub)}</p>${podium}
    <h3>${esc(A.title)} · ${got}/${all}</h3><p class="sub">${esc(A.sub)}</p>
    <div class="achs">${st.sort((x, y) => y.tier / y.max - x.tier / x.max || y.progress - x.progress).map(card).join('')}</div>`;
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
