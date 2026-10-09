---
name: coworking-agents
description: Open the coworking-agents pixel office, a live view of every AI coding session (Claude Code, Codex) on this machine. Use when the user wants to see, monitor or check on their agents or sessions, asks which session needs them, or says "open the office" / "abre o escritório".
---

# Open the coworking-agents office

It is a zero-dependency Node app (Node 18+). Do not `npm install` anything.

1. Start it in the background with the Bash tool (`run_in_background: true`):

   ```
   node "${CLAUDE_PLUGIN_ROOT}/bin/coworking-agents.js"
   ```

   If `CLAUDE_PLUGIN_ROOT` is empty (not running as a plugin), use `npx -y coworking-agents` or, from a clone of the repo, `node bin/coworking-agents.js`.

2. It prints `coworking-agents → http://127.0.0.1:<port>/?t=<token>` and opens the browser. Give the user that link in one line. The token is their key to the page; don't paste it anywhere else.

3. If it says `already running`, it just reopened the existing office. That's fine.

Options the user may ask for: `--private` (hide titles, paths, branches, repo names; for screen sharing), `--demo 40` (fake office with 40 agents), `--no-open`, `--port N`.

Notes to pass on only if relevant: "Go to terminal" focuses the right Terminal/iTerm tab and is macOS-only; the first click makes macOS ask for Automation permission.
