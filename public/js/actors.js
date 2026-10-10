'use strict';
// ---------------- where each person goes ----------------
const ZONE_OF = { idle: 'lounge', asleep: 'nap', delegate: 'meet' };
const DWELL_MS = 3500;
const want = new Map();

function plan(now) {
  const assign = new Map();
  const zoneFor = cell => {
    const p = cell.p, asking = p.state === 'needs_you' || p.state === 'waiting';
    // anyone with subagents takes the whole team to the meeting room (unless they're asking you something)
    if (p.leaving) return 'leave';
    const z = asking ? 'desk' : (p.subagents && p.subagents.length) || p.state === 'delegate' ? 'meet' : ZONE_OF[p.state] || 'desk';
    let w = want.get(cell.p.id);
    if (!w) { w = { zone: z, since: 0, settled: z }; want.set(cell.p.id, w); }
    if (w.zone !== z) { w.zone = z; w.since = now; }
    if (z === 'desk' || now - w.since >= DWELL_MS) w.settled = w.zone;
    return w.settled;
  };
  const byZone = { lounge: [], nap: [], meet: [], desk: [], leave: [] };
  for (const c of layout) byZone[zoneFor(c)].push(c);
  const lounge = byZone.lounge, free = [];
  if (lounge.length >= 2) { assign.set(lounge[0].p.id, spots.ping[0]); assign.set(lounge[1].p.id, spots.ping[1]); free.push(...lounge.slice(2)); }
  else free.push(...lounge);
  const seats = [...spots.sofa, ...spots.stools, ...spots.coffee];
  free.forEach((c, i) => assign.set(c.p.id, seats[i] || null));
  byZone.meet.forEach((c, i) => assign.set(c.p.id, spots.meetTop[i] || spots.meetBot[i - 3] || spots.meetStand[i - 6] || null));
  byZone.nap.forEach((c, i) => assign.set(c.p.id, spots.nap[i] || null));
  byZone.leave.forEach(c => assign.set(c.p.id, { x: CX - 8, y: H + 30, zone: 'gone', pose: 'stand' }));
  return assign;
}

// ---------------- actors ----------------
const actors = new Map();
// who showed up after the first load, and when (drives the build + walk-in animation)
const arrivals = new Map(), seenPeople = new Set();
let firstLoad = true;
function noteArrivals() {
  if (!data) return;
  const now = Date.now();
  for (const p of data.people) { if (!seenPeople.has(p.id)) { seenPeople.add(p.id); if (!firstLoad) arrivals.set(p.id, now); } }
  firstLoad = false;
}
const cat = { x: 0, y: 0, tx: 0, ty: 0, mode: 'sit', until: 0, flip: false, ready: false };
const SPEED = 52;

// every spot knows its way out to the vertical corridor (CX); the path is: exit, corridor, enter
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
    if (!a) {
      a = { x: t.x, y: t.y, mode: t.mode, spot: t.spot, key: t.key, path: [] };
      // a newcomer (not there on first load) walks in through the room door carrying their computer
      const born = arrivals.get(cell.p.id);
      if (born && now - born < 4000 && cell.room) {
        // comes up the corridor, waits for the desk to be built, then walks in through the door
        const R = cell.room, door = { x: R.doorX + 1, y: R.y + R.h + 8 };
        Object.assign(a, { x: CX - 8, y: door.y + 30, mode: 'walk', carry: true, next: t, waitUntil: born + 1200,
          path: [{ x: CX - 8, y: door.y }, { x: door.x, y: door.y }, { x: door.x, y: cell.aisle }, { x: t.x, y: cell.aisle }, { x: t.x, y: t.y }] });
      }
      actors.set(cell.p.id, a);
    }
    if (a.key !== t.key) {
      a.path = route({ x: a.x, y: a.y }, t, cell); a.key = t.key; a.next = t; a.mode = 'walk';
      if (t.mode === 'gone') { // pack up, leave the room by its door and walk down the corridor until off screen
        const out = exitPath({ x: a.x, y: a.y }, a.x < CX ? cell : null), last = out[out.length - 1];
        a.carry = true; a.path = [...out, { x: CX - 8, y: last.y }, { x: CX - 8, y: H + 30 }];
      }
    }
    if (a.mode === 'walk') {
      let step = (a.carry ? SPEED * .7 : a.next.mode === 'desk' ? SPEED * 2 : SPEED) * dt;
      if (a.waitUntil && Date.now() < a.waitUntil) step = Math.min(step, 4 * dt);
      while (step > 0 && a.path.length) {
        const w = a.path[0], dx = w.x - a.x, dy = w.y - a.y, d = Math.hypot(dx, dy);
        if (d <= step) { a.x = w.x; a.y = w.y; step -= d; a.path.shift(); }
        else { a.x += dx / d * step; a.y += dy / d * step; if (Math.abs(dx) > .5) a.flip = dx < 0; step = 0; }
      }
      if (!a.path.length) { a.mode = a.next.mode; a.spot = a.next.spot; a.carry = a.mode === 'gone' && a.carry; }
    }
    cell.actor = a;
  }
  if (data) { const alive = new Set(data.people.map(p => p.id)); for (const id of actors.keys()) if (!alive.has(id)) { actors.delete(id); want.delete(id); } }
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
