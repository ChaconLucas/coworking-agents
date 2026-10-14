'use strict';
// ---------------- the day's timelapse ----------------
// A picture of the office every 5 minutes while it is open, drawn without names (the visitors' mode), kept in this
// browser only (IndexedDB, the last 3 days). "Make the GIF" turns a day into a ~20 s animated GIF, encoded here.
const TL_EVERY = 5 * 60000, TL_WIDTH = 480, TL_DAYS = 3;
let tlDb = null, tlLast = 0, tlGif = null, tlBusy = '';
const tlDay = (ms = Date.now()) => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function tlOpen() {
  if (tlDb) return Promise.resolve(tlDb);
  return new Promise((res, rej) => {
    let rq; try { rq = indexedDB.open('cw-timelapse', 1); } catch (e) { return rej(e); }
    rq.onupgradeneeded = () => { const st = rq.result.createObjectStore('frames', { keyPath: 'at' }); st.createIndex('day', 'day'); };
    rq.onsuccess = () => { tlDb = rq.result; res(tlDb); }; rq.onerror = () => rej(rq.error);
  });
}
const tlTx = (mode, fn) => tlOpen().then(db => new Promise((res, rej) => { const tx = db.transaction('frames', mode), rq = fn(tx.objectStore('frames')); tx.oncomplete = () => res(rq && rq.result !== undefined ? rq.result : rq); tx.onerror = () => rej(tx.error); }));
const tlFrames = day => tlTx('readonly', (st) => st.index('day').getAll(day));
const tlCount = day => tlTx('readonly', (st) => st.index('day').count(day));
// one picture, the office without names, scaled down with hard pixels
function tlCapture() {
  if (typeof drawScene !== 'function' || !data || building) return;
  const cv = document.getElementById('cv'); if (!cv || !cv.width) return;
  tlLast = Date.now(); snapshotMode = true;
  try { drawScene(performance.now(), 0); } finally { snapshotMode = false; }
  const h = Math.round(cv.height * TL_WIDTH / cv.width), c = document.createElement('canvas'); c.width = TL_WIDTH; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(cv, 0, 0, TL_WIDTH, h);
  c.toBlob(blob => { if (!blob) return; const at = Date.now(), day = tlDay(at), old = tlDay(at - TL_DAYS * 864e5);
    tlTx('readwrite', (st) => { st.put({ at, day, blob }); st.openCursor(IDBKeyRange.upperBound(at - TL_DAYS * 864e5)).onsuccess = e => { const k = e.target.result; if (k && k.value.day <= old) { k.delete(); k.continue(); } }; }).catch(() => {}); }, 'image/png');
}
setInterval(() => { if (Date.now() - tlLast >= TL_EVERY) tlCapture(); }, 30000);

// ---- GIF89a encoder: one palette for every frame (the art's own colours when they fit in 256), LZW per frame ----
function gifEncode(frames, w, h, delayCs, onStep) {
  const seen = new Map(); let exact = true;
  for (const f of frames) { for (let i = 0; i < f.length && exact; i += 4) { const k = (f[i] << 16) | (f[i + 1] << 8) | f[i + 2]; if (!seen.has(k)) { if (seen.size === 256) exact = false; else seen.set(k, seen.size); } } if (!exact) break; }
  const pal = new Uint8Array(768), index = exact ? (r, g, b) => seen.get((r << 16) | (g << 8) | b) : (r, g, b) => Math.round(r / 51) * 42 + Math.round(g / 42.5) * 6 + Math.round(b / 51);
  if (exact) for (const [k, i] of seen) { pal[i * 3] = k >> 16; pal[i * 3 + 1] = (k >> 8) & 255; pal[i * 3 + 2] = k & 255; }
  else for (let r = 0; r < 6; r++) for (let g = 0; g < 7; g++) for (let b = 0; b < 6; b++) { const i = r * 42 + g * 6 + b; pal[i * 3] = r * 51; pal[i * 3 + 1] = Math.round(g * 42.5); pal[i * 3 + 2] = b * 51; }
  const out = [], u16 = n => out.push(n & 255, n >> 8), bytes = s => { for (const ch of s) out.push(ch.charCodeAt(0)); };
  bytes('GIF89a'); u16(w); u16(h); out.push(0xf7, 0, 0); for (const v of pal) out.push(v);
  out.push(0x21, 0xff, 11); bytes('NETSCAPE2.0'); out.push(3, 1, 0, 0, 0); // loop forever
  frames.forEach((f, n) => {
    const px = new Uint8Array(w * h); for (let i = 0, j = 0; j < px.length; i += 4, j++) px[j] = index(f[i], f[i + 1], f[i + 2]) || 0;
    out.push(0x21, 0xf9, 4, 0); u16(delayCs); out.push(0, 0);
    out.push(0x2c); u16(0); u16(0); u16(w); u16(h); out.push(0, 8);
    const data = gifLzw(px, 8); for (let i = 0; i < data.length; i += 255) { const part = data.subarray(i, i + 255); out.push(part.length); for (const v of part) out.push(v); }
    out.push(0); if (onStep) onStep(n + 1);
  });
  out.push(0x3b); return new Uint8Array(out);
}
function gifLzw(px, min) {
  const clear = 1 << min, eoi = clear + 1, out = [], dict = new Map(); let size = min + 1, next = eoi + 1, cur = 0, bits = 0;
  const emit = c => { cur |= c << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
  emit(clear); let prefix = px[0];
  for (let i = 1; i < px.length; i++) {
    const k = px[i], key = (prefix << 8) | k, v = dict.get(key);
    if (v !== undefined) { prefix = v; continue; }
    emit(prefix);
    if (next >= 4096) { emit(clear); dict.clear(); size = min + 1; next = eoi + 1; } else { if (next >= (1 << size)) size++; dict.set(key, next++); }
    prefix = k;
  }
  emit(prefix); emit(eoi); if (bits > 0) out.push(cur & 255);
  return new Uint8Array(out);
}
async function tlMake(day) {
  const L = T.timelapse; tlBusy = L.reading; renderTimelapse();
  const list = (await tlFrames(day).catch(() => [])).sort((a, b) => a.at - b.at); if (list.length < 2) { tlBusy = ''; tlGif = { day, error: L.few }; return renderTimelapse(); }
  const frames = []; let w = 0, h = 0;
  for (const f of list) {
    const bm = await createImageBitmap(f.blob).catch(() => null); if (!bm) continue;
    if (!w) { w = bm.width; h = bm.height; } const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(bm, 0, 0, w, h); frames.push(g.getImageData(0, 0, w, h).data);
  }
  tlBusy = L.making; renderTimelapse(); await new Promise(r => setTimeout(r, 30));
  const gif = gifEncode(frames, w, h, Math.max(5, Math.min(50, Math.round(2000 / frames.length))));
  if (tlGif && tlGif.url) URL.revokeObjectURL(tlGif.url);
  const blob = new Blob([gif], { type: 'image/gif' }), src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); // the page's CSP shows data: images, not blob:
  tlGif = { day, url: URL.createObjectURL(blob), src, size: gif.length, frames: frames.length };
  tlBusy = ''; renderTimelapse(); achBump && achBump('shares');
}
async function renderTimelapse() {
  const L = T.timelapse, body = reportEl.querySelector('.report-body'), today = tlDay(), yday = tlDay(Date.now() - 864e5);
  const [nt, ny] = await Promise.all([tlCount(today).catch(() => 0), tlCount(yday).catch(() => 0)]);
  if (reportTab !== 'timelapse' || reportEl.hidden) return;
  const kb = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB';
  body.innerHTML = tabsHtml() + `<h2>🎞 ${esc(L.title)}</h2><p class="sub">${esc(L.sub)}</p>
    <p><button class="btn small" data-tl-make="${today}" ${tlBusy || nt < 2 ? 'disabled' : ''}>🎞 ${esc(L.today(nt))}</button> <button class="btn small ghost" data-tl-make="${yday}" ${tlBusy || ny < 2 ? 'disabled' : ''}>${esc(L.yesterday(ny))}</button> <button class="btn small ghost" data-tl-now>📸 ${esc(L.now)}</button></p>
    ${tlBusy ? `<p class="note">${esc(tlBusy)}</p>` : ''}
    ${tlGif && tlGif.error ? `<p class="note">⚠ ${esc(tlGif.error)}</p>` : ''}
    ${tlGif && tlGif.url ? `<div class="tl-out"><img src="${tlGif.src}" alt="${esc(L.alt)}"><p><a class="btn small" href="${tlGif.url}" download="coworking-timelapse-${esc(tlGif.day)}.gif">⬇ ${esc(L.save)}</a> <small class="note">${esc(L.info(tlGif.frames, kb(tlGif.size)))}</small></p></div>` : ''}
    <p class="note">${esc(L.note)}</p>`;
}
reportEl.addEventListener('click', e => {
  if (reportTab !== 'timelapse') return;
  const m = e.target.closest('[data-tl-make]'); if (m && !tlBusy) return tlMake(m.dataset.tlMake);
  if (e.target.closest('[data-tl-now]')) { tlCapture(); setTimeout(renderTimelapse, 800); }
});
