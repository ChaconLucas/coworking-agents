# Roadmap

| # | Phase | Status |
|---|-------|--------|
| 1 | Claude Code collector + SSE server + basic office | done |
| 2 | Per-AI sources (Codex) and the coworking-agents name | done |
| 3 | Art: sprites, time-of-day lighting, kitchen, cat | done |
| 4 | Floor with zones (desks, kitchen, ping-pong, meeting room, nap corner) | done |
| 5 | State truth: live transcript, child shell for Bash, permission mode | done |
| 6 | Go to terminal (Terminal/iTerm by tty) | done |
| 7 | **Rooms per repository + floors + building view** (many agents) | done |
| 8 | **Help toasts with portraits** ("needs you" with the question) + names over agents away from their desks | done |
| 9 | Timeline, file map and daily report UI (data already served by `/api/state` timeline+files and `/api/report`; the screen is missing) | to do |
| 10 | Keyboard shortcuts + search and filter | to do |
| 11 | Security audit (pentest) and fixes | done |
| 12 | Publishing: README and plugin done; npm publish | to do |

## Out of scope (decided)
- Answering/approving requests from inside the office for terminal sessions: there is no official API, and simulating keystrokes is unsafe. Alternative: a button that jumps to the right terminal.
- Embedded chat: only for `claude --bg` sessions (future).
