'use strict';
// ---------------- weekly missions, your outfit, the arcade game, surprise events, the AI scoreboard, sharing ----------------

// ---- weekly missions: three per week, picked by the week number, measured; 100 coins each ----
const weekKey = (d = new Date()) => { const j = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-W' + Math.floor((d - j) / 6048e5 + 1); };
const weekDays = () => { const now = new Date(), out = []; const dow = (now.getDay() + 6) % 7; for (let i = 0; i <= dow; i++) { const d = new Date(now - (dow - i) * 864e5); out.push(d.toISOString().slice(0, 10)); } return out; };
// counters measured since the week began: the value at the first look this week is the baseline
function weekDelta(k) {
  const wk = weekKey(), base = store.get('missionBase', null);
  if (!base || base.week !== wk) { const b = { week: wk, v: {} }; for (const c of ['commits', 'pushes', 'talks', 'quickReplies', 'pets', 'fast', 'celebrations', 'trophyVisits']) b.v[c] = achCount(c); store.set('missionBase', b); return 0; }
  return Math.max(0, achCount(k) - (base.v[k] || 0));
}
const MISSIONS = [
  { id: 'hours', goal: 20, value: () => weekDays().reduce((n, k) => n + ((usageData && usageData.days && usageData.days[k] && usageData.days[k].activeMs) || 0), 0) / 36e5 },
  { id: 'tools', goal: 3000, value: () => weekDays().reduce((n, k) => n + ((usageData && usageData.days && usageData.days[k] && usageData.days[k].tools) || 0), 0) },
  { id: 'days', goal: 4, value: () => weekDays().filter(k => usageData && usageData.days && usageData.days[k] && usageData.days[k].tools >= 10).length },
  { id: 'commits', goal: 5, value: () => weekDelta('commits') },
  { id: 'pushes', goal: 3, value: () => weekDelta('pushes') },
  { id: 'talks', goal: 10, value: () => weekDelta('talks') },
  { id: 'quick', goal: 5, value: () => weekDelta('quickReplies') },
  { id: 'pets', goal: 10, value: () => weekDelta('pets') },
  { id: 'fast', goal: 5, value: () => weekDelta('fast') },
  { id: 'deliver', goal: 5, value: () => weekDelta('celebrations') },
];
function weekMissions() {
  const wk = weekKey(), h = hash(wk), pool = MISSIONS.slice(), out = [];
  for (let i = 0; i < 3; i++) out.push(pool.splice((h >>> (i * 5)) % pool.length, 1)[0]);
  return out.map(m => { const v = m.value(), done = achCount('missionsDone') && (prog.record.missionsDone || []).includes(wk + ':' + m.id); return { ...m, v, done: done || v >= m.goal, claimed: done, key: wk + ':' + m.id }; });
}
function checkMissions() {
  if (!usageData || !usageData.days) return;
  for (const m of weekMissions()) if (!m.claimed && m.v >= m.goal) {
    achAdd('missionsDone', m.key); achBump('missionCoins', 100);
    toast(`<b>${esc(T.missions.done)}</b>${esc(T.missions.list[m.id](m.goal))} · +100 ${esc(T.ach.coins)}`, 'ok'); playTune('trophy');
  }
}
setInterval(checkMissions, 30000);
function missionsHtml() {
  const M = T.missions, list = weekMissions();
  return `<h3>${esc(M.title)}</h3><p class="sub">${esc(M.sub)}</p><div class="achs">${list.map(m => `<div class="ach ${m.done ? 'on' : ''}" style="--c:${m.done ? '#63c74d' : '#ffd84d'}"><span class="ach-ico">${m.done ? '✓' : '🎯'}</span><div><b>${esc(M.list[m.id](m.goal))}</b><small>${esc(m.done ? M.claimed : '+100 ' + T.ach.coins)}</small>
    <div class="ach-bar"><i style="width:${Math.min(100, m.v / m.goal * 100).toFixed(1)}%"></i></div><div class="ach-foot"><span></span><span>${Math.floor(Math.min(m.v, m.goal))} / ${m.goal}</span></div></div></div>`).join('')}</div>`;
}

// ---- your outfit: hats, shades and shirts from the shop, worn by your character ----
const OUTFIT = { cap: 'hat', crown: 'hat', headphones: 'hat', party: 'hat', shades: 'face', shirt_gold: 'shirt', shirt_pink: 'shirt', shirt_black: 'shirt' };
const SHIRTS = { shirt_gold: '#d9a441', shirt_pink: '#e8579a', shirt_black: '#2a2630' };
function wearing(slot) { const w = (prog.style || {})['wear_' + slot]; return w && owns(w) ? w : ''; }
function youLook() {
  const lk = Art.look('you:' + (avatars.__you || 0)), sh = wearing('shirt');
  return sh ? { ...lk, c: SHIRTS[sh], C: Art.shade(SHIRTS[sh], .72) } : lk;
}
function drawOutfit(x, y) { // over the standing sprite's head (top at y - 2)
  const hat = wearing('hat');
  if (hat === 'cap') { r(x + 2, y - 3, 12, 4, PAL.ink); r(x + 3, y - 2, 10, 2, '#e43b44'); r(x + 10, y, 7, 2, PAL.ink); r(x + 11, y, 5, 1, '#e43b44'); }
  if (hat === 'crown') { r(x + 3, y - 4, 10, 4, '#ffd84d'); r(x + 3, y - 6, 2, 2, '#ffd84d'); r(x + 7, y - 7, 2, 3, '#ffd84d'); r(x + 11, y - 6, 2, 2, '#ffd84d'); r(x + 7, y - 3, 2, 1, '#e43b44'); }
  if (hat === 'headphones') { r(x + 1, y - 3, 14, 2, PAL.ink); r(x, y + 3, 3, 5, '#3b5dc9'); r(x + 13, y + 3, 3, 5, '#3b5dc9'); }
  if (hat === 'party') Art.drawHat('party', x, y - 2);
  if (wearing('face') === 'shades') { r(x + 3, y + 5, 10, 2, PAL.ink); r(x + 4, y + 5, 3, 1, '#3a4566'); r(x + 9, y + 5, 3, 1, '#3a4566'); }
}
function outfitHtml() {
  const O = T.outfit, have = Object.keys(OUTFIT).filter(owns);
  if (!have.length) return `<p class="note">${esc(O.none)}</p>`;
  const slot = s => `<div class="opts"><button class="opt ${!wearing(s) ? 'on' : ''}" data-wear="${s}" data-item="">${esc(O.nothing)}</button>${have.filter(i => OUTFIT[i] === s).map(i => `<button class="opt ${wearing(s) === i ? 'on' : ''}" data-wear="${s}" data-item="${i}">${esc(T.shop.items[i].name)}</button>`).join('')}</div>`;
  return ['hat', 'face', 'shirt'].filter(s => have.some(i => OUTFIT[i] === s)).map(s => `<small class="note">${esc(O.slots[s])}</small>${slot(s)}`).join('');
}
reportEl.addEventListener('click', e => {
  const w = e.target.closest('[data-wear]'); if (!w) return;
  prog.style = { ...(prog.style || {}), ['wear_' + w.dataset.wear]: w.dataset.item }; saveProgress(); achBump('outfits');
  reportEl.querySelectorAll(`[data-wear="${w.dataset.wear}"]`).forEach(b => b.classList.toggle('on', b === w));
  const f = document.getElementById('you-face'); if (f) { f.innerHTML = ''; f.appendChild(youPortrait()); }
});
function youPortrait() { // the portrait with the outfit drawn on top
  const c = Art.portrait('you:' + (avatars.__you || 0)), g = c.getContext('2d'), prev = ctx;
  const sh = wearing('shirt'); if (sh) { g.fillStyle = SHIRTS[sh]; g.fillRect(1, 12, 14, 6); }
  ctx = g; Art.setCtx(g); try { drawOutfit(0, 2); } finally { ctx = prev; Art.setCtx(prev); }
  return c;
}

// ---- the arcade: Bug Catcher, a 30-second game; best score saved ----
const arcadeEl = document.createElement('div');
arcadeEl.className = 'trophy-card'; arcadeEl.hidden = true;
document.body.appendChild(arcadeEl);
let game2 = null;
function openArcade() {
  arcadeEl.innerHTML = `<div class="tc-box arcade-box"><div><b>🕹 ${esc(T.arcade.title)}</b><p>${esc(T.arcade.help)}</p><canvas width="160" height="120" class="arcade-cv"></canvas>
    <div class="ach-foot"><span id="arcade-score"></span><span>${esc(T.arcade.best)}: ${Number(store.get('arcadeBest', 0)) || 0}</span></div><button class="btn small" data-arcade-start>${esc(T.arcade.start)}</button></div></div>`;
  arcadeEl.hidden = false; achBump('arcadeOpens');
}
function startArcade() {
  const cv2 = arcadeEl.querySelector('.arcade-cv'); if (!cv2) return;
  game2 = { cv: cv2, g: cv2.getContext('2d'), x: 72, bugs: [], score: 0, ends: performance.now() + 30000, last: performance.now(), keys: new Set() };
  requestAnimationFrame(tickArcade);
}
function tickArcade(now) {
  const G = game2; if (!G || arcadeEl.hidden) { game2 = null; return; }
  const dt = Math.min(.05, (now - G.last) / 1000); G.last = now;
  if (G.keys.has('ArrowLeft') || G.keys.has('a')) G.x -= 110 * dt; if (G.keys.has('ArrowRight') || G.keys.has('d')) G.x += 110 * dt;
  G.x = Math.max(0, Math.min(144, G.x));
  if (Math.random() < dt * (1.6 + G.score / 15)) G.bugs.push({ x: 4 + Math.random() * 148, y: -6, v: 30 + Math.random() * 30 + G.score * 1.5, gold: Math.random() < .1 });
  const g = G.g; g.fillStyle = '#11131c'; g.fillRect(0, 0, 160, 120);
  for (let i = 0; i < 20; i++) { g.fillStyle = '#1e2233'; g.fillRect((i * 37) % 160, (i * 53 + now / 40) % 120, 1, 1); }
  for (const b of G.bugs) {
    b.y += b.v * dt;
    g.fillStyle = b.gold ? '#ffd84d' : '#63c74d'; g.fillRect(b.x, b.y, 6, 4); g.fillStyle = '#1b1622'; g.fillRect(b.x + 1, b.y + 1, 1, 1); g.fillRect(b.x + 4, b.y + 1, 1, 1); g.fillRect(b.x - 1, b.y + 2, 1, 1); g.fillRect(b.x + 6, b.y + 2, 1, 1);
    if (b.y > 106 && b.y < 112 && b.x + 6 > G.x && b.x < G.x + 16) { b.hit = true; G.score += b.gold ? 5 : 1; beep(b.gold); }
  }
  G.bugs = G.bugs.filter(b => !b.hit && b.y < 120);
  g.fillStyle = '#d97757'; g.fillRect(G.x, 110, 16, 4); g.fillStyle = '#ffd84d'; g.fillRect(G.x + 2, 109, 12, 1);
  const left = Math.max(0, Math.ceil((G.ends - now) / 1000)), sc = arcadeEl.querySelector('#arcade-score');
  if (sc) sc.textContent = `${T.arcade.score}: ${G.score} · ${left}s`;
  if (now >= G.ends) {
    const best = Number(store.get('arcadeBest', 0)) || 0;
    if (G.score > best) { store.set('arcadeBest', G.score); toast(`<b>${esc(T.arcade.record)}</b>${G.score}`, 'ok'); }
    achRecord.arcadeBest = Math.max(achRecord.arcadeBest || 0, G.score); achBump('arcadeGames');
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 44, 160, 30); g.fillStyle = '#ffd84d'; g.font = 'bold 10px monospace'; g.fillText(`${T.arcade.over} ${G.score}`, 40, 62);
    game2 = null; return;
  }
  requestAnimationFrame(tickArcade);
}
arcadeEl.addEventListener('click', e => { if (e.target === arcadeEl) { arcadeEl.hidden = true; game2 = null; } if (e.target.closest('[data-arcade-start]')) startArcade(); });
document.addEventListener('keydown', e => { if (!game2) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(k)) { game2.keys.add(k); e.preventDefault(); e.stopImmediatePropagation(); } if (e.key === 'Escape') { arcadeEl.hidden = true; game2 = null; } }, true);
document.addEventListener('keyup', e => { if (game2) { game2.keys.delete(e.key); game2.keys.delete(e.key.toLowerCase()); } });
arcadeEl.addEventListener('pointermove', e => { if (!game2) return; const rc = game2.cv.getBoundingClientRect(); game2.x = (e.clientX - rc.left) / rc.width * 160 - 8; });

// ---- surprise events: now and then something appears; click it for coins ----
let surprise = null; // { kind, x, y, until, coins }
function maybeSurprise() {
  if (surprise || !data || trophyView || document.hidden || Math.random() > .25) return;
  const kinds = [
    { kind: 'cake', x: RX + 90, y: TOP - 12, coins: 10 },
    { kind: 'pigeon', x: windowBoxes.length ? windowBoxes[(Math.random() * windowBoxes.length) | 0].x + 20 : CX - 40, y: 30, coins: 5 },
    { kind: 'ticket', x: CX - 4, y: TOP + 40 + Math.random() * (H - TOP - 120), coins: 25 },
  ];
  surprise = { ...kinds[(Math.random() * kinds.length) | 0], until: Date.now() + 90000 };
}
setInterval(maybeSurprise, 5 * 60000);
function drawSurprise(t) {
  if (!surprise) return; if (Date.now() > surprise.until) { surprise = null; return; }
  const { x, y, kind } = surprise, b = ((t / 300) | 0) % 2;
  if (kind === 'cake') { r(x, y + 4, 12, 6, '#f4dfc6'); r(x, y + 4, 12, 2, '#ff6ec7'); r(x + 5, y, 1, 4, '#2ce8f5'); if (b) r(x + 5, y - 2, 1, 2, '#ffd84d'); }
  if (kind === 'pigeon') { r(x, y + 2, 8, 5, '#9aa6b8'); r(x + 6, y, 4, 4, '#9aa6b8'); r(x + 9, y + 1, 2, 1, '#feae34'); r(x + 7, y + 1, 1, 1, PAL.ink); r(x + 2, y + 7, 1, 2 - b, '#feae34'); r(x + 5, y + 7, 1, 1 + b, '#feae34'); }
  if (kind === 'ticket') { r(x - 1, y - 1, 12, 8, PAL.ink); r(x, y, 10, 6, '#ffd84d'); r(x + 2, y + 2, 6, 1, '#b07d2a'); if (b) r(x + 9, y - 2, 1, 1, '#ffffff'); }
  surpriseBox = { x: x - 4, y: y - 4, w: 20, h: 16 };
}
let surpriseBox = null;
function claimSurprise() {
  if (!surprise) return;
  achBump('eventCoins', surprise.coins); achBump('surprises');
  toast(`<b>${esc(T.surprise[surprise.kind])}</b>+${surprise.coins} ${esc(T.ach.coins)}`, 'ok'); playTune('done');
  surprise = null; surpriseBox = null; lastHits = ''; renderOverlay();
}

// ---- the AI scoreboard: this week's hours, actions and tokens per AI ----
function scoreboardHtml() {
  const S2 = T.scoreboard, days = weekDays(), sum = {};
  for (const k of days) { const d = usageData && usageData.days && usageData.days[k]; if (!d || !d.byAgent) continue; for (const [a, v] of Object.entries(d.byAgent)) { const s = sum[a] || (sum[a] = { activeMs: 0, tools: 0, output: 0 }); s.activeMs += v.activeMs; s.tools += v.tools; s.output += v.output || 0; } }
  const rows = Object.entries(sum).sort((a, b) => b[1].activeMs - a[1].activeMs);
  if (!rows.length) return '';
  return `<article><h4>${esc(S2.title)}</h4><table class="score"><tr><th></th><th>${esc(S2.hours)}</th><th>${esc(S2.actions)}</th><th>${esc(S2.tokens)}</th></tr>${rows.map(([a, s], i) => `<tr><td>${i ? '' : '🥇 '}${esc((AGENT[a] || {}).label || a)}</td><td>${(s.activeMs / 36e5).toFixed(1)}h</td><td>${fmtK(s.tools)}</td><td>${fmtK(s.output)}</td></tr>`).join('')}</table></article>`;
}

// ---- share card: a picture of your week, ready to post ----
function shareCard() {
  const c = document.createElement('canvas'); c.width = 600; c.height = 315;
  const g = c.getContext('2d'), days = weekDays(), d = k => (usageData && usageData.days && usageData.days[k]) || {};
  const hours = days.reduce((n, k) => n + (d(k).activeMs || 0), 0) / 36e5, tools = days.reduce((n, k) => n + (d(k).tools || 0), 0);
  const st = achState(), tiers = st.reduce((n, a) => n + a.tier, 0), legends = st.filter(a => a.tier >= 5).length;
  g.fillStyle = '#1b1622'; g.fillRect(0, 0, 600, 315);
  g.drawImage(document.getElementById('cv'), 0, 0, Math.min(W, 380), Math.min(H, 220), 300, 40, 280, 170 * Math.min(1, Math.min(H, 220) / 220));
  g.fillStyle = '#ffd84d'; g.font = 'bold 26px system-ui, sans-serif'; g.fillText(prog.officeName || 'coworking-agents', 24, 52);
  g.fillStyle = '#c0cbdc'; g.font = '14px system-ui, sans-serif'; g.fillText(T.share.week, 24, 76);
  const stat = (y, big, label) => { g.fillStyle = '#ffffff'; g.font = 'bold 30px system-ui, sans-serif'; g.fillText(big, 24, y); g.fillStyle = '#9a9187'; g.font = '13px system-ui, sans-serif'; g.fillText(label, 24, y + 18); };
  stat(126, hours.toFixed(1) + 'h', T.share.hours); stat(186, fmtK(tools), T.share.actions); stat(246, `${tiers} · ${legends}★`, T.share.trophies);
  g.fillStyle = '#d97757'; g.fillRect(0, 290, 600, 25); g.fillStyle = '#ffffff'; g.font = 'bold 13px system-ui, sans-serif'; g.fillText('npx coworking-agents', 24, 307);
  c.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `coworking-week-${weekKey()}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast(`<b>${esc(T.share.saved)}</b>${esc(a.download)}`, 'ok'); achBump('shares'); }, 'image/png');
}

// ---- a photo for visitors: the office without names, branches or the office name ----
let snapshotMode = false;
function visitPhoto() {
  snapshotMode = true;
  try { drawScene(performance.now(), 0); const cv = document.getElementById('cv');
    cv.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `coworking-visit-${new Date().toISOString().slice(0, 10)}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast(`<b>${esc(T.share.visitSaved)}</b>${esc(T.share.visitNote)}`, 'ok'); achBump('shares'); }, 'image/png');
  } finally { snapshotMode = false; }
}
