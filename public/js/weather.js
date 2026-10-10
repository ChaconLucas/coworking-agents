'use strict';
// ---------------- real weather in the windows (opt-in) ----------------
// Off until you click a window: then the browser asks for your location; if allowed, the browser itself
// asks Open-Meteo (free, no key) for the current weather every 15 min. Nothing goes through our server.
let weather = null; // { kind: 'clear'|'cloud'|'rain'|'snow'|'storm'|'fog', at }
const WEATHER_KEY = 'weather';
function codeToKind(c) {
  if (c >= 95) return 'storm';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if (c === 45 || c === 48) return 'fog';
  if (c >= 2) return 'cloud';
  return 'clear';
}
async function fetchWeather(lat, lon) {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=weather_code,temperature_2m`;
    const j = await fetch(u).then(r => r.json());
    weather = { kind: codeToKind(Number(j.current.weather_code)), temp: Math.round(j.current.temperature_2m), at: Date.now() };
  } catch {}
}
function enableWeather(ask) {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(pos => {
    store.set(WEATHER_KEY, true);
    achAdd('weatherDays', new Date().toISOString().slice(0, 10));
    const { latitude, longitude } = pos.coords; // rounded to ~1 km before leaving the browser
    fetchWeather(latitude, longitude);
    clearInterval(enableWeather.t);
    enableWeather.t = setInterval(() => fetchWeather(latitude, longitude), 15 * 60 * 1000);
    if (ask) toast(`<b>${esc(T.weather.on)}</b>${esc(T.weather.onSub)}`, 'ok');
  }, () => { if (ask) toast(`<b>${esc(T.weather.denied)}</b>${esc(T.weather.deniedSub)}`, 'warn'); store.set(WEATHER_KEY, false); }, { maximumAge: 3600e3, timeout: 15000 });
}
if (store.get(WEATHER_KEY, false)) enableWeather(false);

// rain, snow, storm flashes and clouds drawn over a window
function drawWeather(x, y, w, h, t) {
  if (!weather) return;
  const f = (t / 60) | 0;
  if (weather.kind === 'cloud' || weather.kind === 'rain' || weather.kind === 'storm' || weather.kind === 'snow') {
    for (let i = 0; i < 3; i++) { const cx = x + ((t / 300 + i * 19) % (w + 16)) - 8; for (const [dx, dy, ww] of [[0, 4, 10], [2, 2, 6], [-2, 6, 14]]) { const a = Math.max(x, cx + dx), b = Math.min(x + w, cx + dx + ww); if (b > a) r(a, y + dy + i * 3, b - a, 2, weather.kind === 'cloud' ? '#e8eef6' : '#9aa6b8'); } }
  }
  if (weather.kind === 'rain' || weather.kind === 'storm') for (let i = 0; i < 14; i++) { const hh = hash('rn' + i), px = x + hh % w, py = y + ((hh >>> 5) + f * 2) % h; r(px, py, 1, 2, '#9fd3ff'); }
  if (weather.kind === 'snow') for (let i = 0; i < 12; i++) { const hh = hash('sn' + i), px = x + (hh + Math.round(Math.sin((f + i) / 6) * 2)) % w, py = y + ((hh >>> 5) + f) % h; r(px, py, 1, 1, '#ffffff'); }
  if (weather.kind === 'fog') { ctx.fillStyle = 'rgba(220,226,235,.45)'; ctx.fillRect(x, y, w, h); }
  if (weather.kind === 'storm' && f % 50 < 2) { ctx.fillStyle = 'rgba(255,255,240,.6)'; ctx.fillRect(x, y, w, h); }
}
