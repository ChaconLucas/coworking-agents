'use strict';
// Git state of a checkout for the room door: uncommitted changes and commits ahead/behind upstream.
// Read with `git status --porcelain --branch` in the background (never blocks a snapshot), at most
// every 15s per checkout. Read-only: no fetch, so ahead/behind is against the last fetched upstream.

const { execFile } = require('child_process');

const TTL = 15000;
const cache = new Map(); // worktree → { at, busy, state }

function parse(out) {
  const lines = String(out).split('\n').filter(Boolean);
  const head = lines[0] && lines[0].startsWith('## ') ? lines.shift() : '';
  const ahead = /\bahead (\d+)/.exec(head), behind = /\bbehind (\d+)/.exec(head);
  return { dirty: lines.length, ahead: ahead ? +ahead[1] : 0, behind: behind ? +behind[1] : 0, upstream: /\.\.\./.test(head) };
}

function refresh(worktree) {
  const c = cache.get(worktree) || { at: 0, busy: false, state: null };
  cache.set(worktree, c);
  if (c.busy) return c.busy;
  c.busy = new Promise(resolve => {
    execFile('git', ['-C', worktree, '--no-optional-locks', 'status', '--porcelain=v1', '--branch', '--untracked-files=normal'],
      { timeout: 5000, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (err, out) => {
        c.at = Date.now(); c.busy = false;
        if (!err) c.state = parse(out); // on error keep the last known state (or none)
        resolve(c.state);
      });
  });
  return c.busy;
}

// what we know now; kicks a background refresh when stale
function gitState(worktree) {
  if (!worktree) return null;
  const c = cache.get(worktree);
  if (!c || (!c.busy && Date.now() - c.at > TTL)) refresh(worktree);
  return c ? c.state : null;
}

module.exports = { gitState, refresh, parse };
