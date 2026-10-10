<p align="center">
  <img src="https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/logo.png" width="128" alt="coworking-agents logo">
</p>

<h1 align="center">coworking-agents</h1>

<p align="center"><b>A live pixel-art office for your AI coding agents.</b><br>Claude Code · Codex · walk around · trophies · zero dependencies · local only</p>

<p align="center"><a href="https://www.npmjs.com/package/coworking-agents"><img src="https://img.shields.io/npm/v/coworking-agents" alt="npm"></a></p>

**A live pixel-art office for your AI coding agents.** Every open session (Claude Code, Codex, …) becomes a person at a desk. At a glance you see who is working, who needs you (and what they are asking), whose turn it is, and which sessions are editing the same checkout, even across different AIs.

![The office by day](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/office-day.png)

![The office at night: monitors and desk lamps light the room](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/office-night.png)

## Tour

| | |
|---|---|
| ![Top bar](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/top-bar.png) | **Top bar.** One HUD with the counters and the usage meters; the counter below is where agents waiting on you sit (4 per office, **+** slides to the next). |
| ![Talk](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/talk.png) | **Talk.** Click a waiting agent: it says what it wants at its desk. Reply right there (typed into its Terminal/iTerm tab for Claude Code and Codex CLI) or jump to it. |
| ![Camera](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/camera.png) | **Camera.** Click an agent and the camera flies in to its desk with a spotlight; the side panel shows everything about the session. |
| ![Panel](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/panel.png) | **Agent panel.** Now, last request and reply, last-hour timeline, today's numbers, tokens, context, files, subagents, certificates. |
| ![Usage](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/usage.png) | **Usage report.** Tokens per day for 14 days, all-time totals per AI and per model, rate-limit windows with reset times. |
| ![Work site](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/work-site.png) | **Arrivals and departures.** A new session gets its room boarded up and built (planks, dust, caution tape); a closed one walks out and its desk is demolished. |
| ![Achievements](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/achievements.png) | **Achievements.** 74 of them, five tiers each, coins for every tier, the agent of the month on top. |
| ![Paper](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/paper.png) | **The Office Times.** Your week in headlines, written from measured history. |
| ![Trophy room](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/trophy-room.png) | **Trophy room.** Glass cabinets with lit shelves, legend trophies in a glass case under spotlights, a crown under a dome for Legend of Legends. Click a trophy for its card. |
| ![Christmas](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/christmas.png) | **Holidays.** Lights, snow and Santa hats at Christmas; pumpkins, bats and witch hats at Halloween; flags at Festa Junina. |
| ![Building](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/building.png) | **Building view.** Many agents? Floors, each a live thumbnail. |
| ![House wall](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/house-wall.png) | **House wall.** Podium of the most used skills, installed skills, MCP servers and plugins. |
| ![Night](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/office-night.png) | **Day and night.** Lighting follows your clock; a wall switch turns the ceiling lights on or off; the rest room stays dark. |
| ![Mobile](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/mobile.png) | **Phone.** Works on small screens too. |

## Why

When you run several AI sessions at once, you lose track of which one stopped to ask you something, which one finished, and which two are touching the same repository. coworking-agents puts all of them on one screen that you actually want to leave open.

## Quick start

```bash
npx coworking-agents              # opens http://127.0.0.1:4777 in your browser
npx coworking-agents --demo       # a fake office showing every state (no sessions needed)
npx coworking-agents --private    # hide names, branches, repos, titles and paths (screen sharing)
npx coworking-agents --port 5000  # pick a port (default 4777; falls back to a free one if taken)
npx coworking-agents --no-open    # don't open the browser
npx coworking-agents --json       # print one snapshot of the state as JSON and exit
npx coworking-agents@latest       # make sure you run the newest release (npx caches the last one)
```

Requires Node 18+. Zero dependencies. When a newer release is on npm, the terminal and the office tell you once (`--no-update-check` or `COWORKING_NO_UPDATE_CHECK=1` turns that off).

### Access token

The server only answers requests that carry a random per-run token. The CLI prints (and opens) a link like `http://127.0.0.1:4777/?t=…`; on first visit the token becomes an `HttpOnly`, `SameSite=Strict` cookie and the URL is cleaned up. Any other page, or a request without the cookie, gets a "locked" page.

Running `npx coworking-agents` a second time reuses the office that is already running instead of starting another: the link is stored in `~/.config/coworking-agents/session.json` (mode `0600`, readable only by you) and checked with a ping before reuse. `--demo`, `--private` and `--port` always start a fresh server.

### As a Claude Code plugin

```
/plugin marketplace add ChaconLucas/coworking-agents
/plugin install coworking-agents@coworking-agents
/coworking
```

`/coworking` starts the office in the background and replies with the URL. It accepts the same flags, e.g. `/coworking --private`.

## Supported AIs

| AI | What is read | A session counts as open when |
|---|---|---|
| **Claude Code** | `~/.claude/sessions/<pid>.json` (live-session registry) and `~/.claude/projects/**/<id>.jsonl` (transcripts, including subagents) | it is in the official registry and its pid is alive |
| **Codex** (CLI and app) | `~/.codex/sessions/YYYY/MM/DD/*.jsonl` and `session_index.jsonl` (titles) | a Codex process is running and the conversation was touched in the last 3 hours |

`CLAUDE_CONFIG_DIR` and `CODEX_HOME` are respected. The colored nameplate on each desk and the badge border show which AI a person is. Want another AI? See [Adding a new AI source](#adding-a-new-ai-source).

## The floor plan

- **One room per repository.** Each room has its agents' desks, a carpet in the repo's color and a sign with its name. Worktrees of the same repo share the room. A room with more than 9 agents splits into several (`api 1`, `api 2`, …).
- **A shared wing** on the right of every floor:
  - **Kitchen / lounge:** agents whose turn ended walk over for a coffee or a seat on the sofa. When **2 or more** are idle, two of them play **ping-pong**.
  - **Glass meeting room:** agents that are delegating sit here together with their subagents (shown as interns).
  - **Nap corner:** sessions idle for a long time (20+ min) lie down on bean bags.
- **Floors and Building view.** With many rooms the office gains floors, each with its own shared wing. A floor picker appears at the top, and **Building view** shows every floor as a live thumbnail with counts of who is working and who needs you; click one to go there.

![Building view: every floor as a live thumbnail](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/building.png)

## States

| In the office | Meaning |
|---|---|
| Monitor with code being typed | **editing** a file |
| Black monitor with green text | running a command in the **terminal** |
| Monitor with a sheet of paper | **reading** or searching |
| Monitor with a globe | on the **web** |
| Thought bubble with dots | **thinking** (turn open, no tool running) |
| Off to the meeting room with interns | **delegating** to subagents |
| Turned toward you, red **!** bubble | **needs you**: it asked a question; the toast shows the actual question (or "my plan is ready" for plan mode) |
| Turned toward you, amber **?** bubble | **waiting for approval**. For a pending Bash in Claude Code this is measured: if Claude Code spawned the shell for the command, it is running; if not, it is waiting for you. Other stalled tools are judged by the permission mode |
| Hourglass bubble | a tool has been running for more than a minute |
| Walks to the kitchen / lounge | done, **your turn** |
| Lying in the nap corner, **zZ** | **asleep**: idle for 20+ minutes |
| Divider flashing red, banner on top | two sessions, of any AI, edited the same checkout in the last 15 minutes |

Click a person for the side panel: repository, branch, worktree, model, context size, turns, recent actions, subagents, most-used tools and certificates.

![Side panel for one agent](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/panel.png)

## Help toasts

When someone needs you, a toast appears with the **agent's pixel portrait**, its name and repo, and what it wants: the question it asked, the command it wants to run, or the file it wants to edit. Finished turns show a short "Done!" toast. Up to 3 toasts show at once; the rest go behind a "+N more" button.

Each toast has **Show** (switches floor, opens the panel and scrolls to the desk) and **Go to terminal**, which brings the exact Terminal.app or iTerm2 tab running that session to the front by matching its tty (macOS only; other terminal apps such as VS Code, Cursor, Warp, Ghostty, WezTerm, kitty and Alacritty are just activated). For Codex sessions without a known process it opens the Codex app.

Agents away from their desks (kitchen, meeting room, nap corner) carry a name tag over their heads. Optional sound and system notifications can be turned on from the top bar.

## Working with your agents

- **Talk and reply:** click a waiting agent to read what it wants; type the next instruction and send it straight to its Terminal/iTerm tab (Claude Code, and Codex CLI when its terminal process can be matched), or copy it and jump there. Sessions in the Claude or Codex desktop apps can't be typed into: the button copies and opens the app.
- **Answer questions:** a single-choice question from Claude Code can be answered by clicking an option.
- **Compact:** when a Claude session that finished its turn passes 75% of its context window, a **Compact** button shows over it and sends `/compact` to its terminal tab (macOS).
- **Alerts:** a toast and a system notification when a rate limit crosses 80% / 95%, a context passes 85%, or an agent has waited 5 minutes for you; chiptunes for requests, done work, arrivals and departures.
- **Same file, same repo:** a red banner when two sessions edit the same file or checkout.
- **Git on the door:** each room sign shows uncommitted files (●), commits to push (↑) and to pull (↓), read with `git status` in the background (no fetch).
- **History and daily report:** the last 24 hours of arrivals, departures, requests and finished work; a daily report with active time, tools and files that copies as Markdown for a standup; your reply times.
- **Estimated cost:** what the tokens would cost at official API list prices (table in `src/prices.js`, dated; override in `~/.config/coworking-agents/prices.json`), priced per reply with Claude's cache-write split. Unknown models are never guessed. On a subscription this is not what you pay.
- **Focus mode:** sounds and system notifications pause for 25 or 50 minutes.
- **Replay:** scrub or play back the last hour.

## Walk around (Gather-style)

You're in the office too, with a **YOU** tag. **WASD** or the arrow keys walk (hold **Shift** to run), a click on the floor walks you there through the doors, and walls stop you. Near an agent, a prop or a door, **Enter** talks, opens or enters. Turn it off in the ☰ menu.

## The game room and the trophy room

![The game room](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/game-room.png)

Under the team rooms there's a game room with four doors: arcades, foosball, a pool table, an aquarium, a water cooler and bean bags, where idle agents hang out. Its props open the reports: the **newspaper rack** (the weekly paper), the **vending machine** (the shop), the **easel** (customise), the **guestbook** (history) and the **cork board** (today's date, files edited today, the daily report).

A marble portal leads to the **trophy room**, its own screen: legends with wings and a flame in lit niches between marble columns, a stained-glass arch over the crown of **Legend of Legends**, every other trophy under its own glass dome or in the side cabinets, locked ones as silhouettes. Each tier has its own award (bronze cup, silver star cup, gold ruby cup, diamond crystal, winged legend). Click one for its card.

![The trophy room](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/trophy-room.png)

## Achievements, coins and the shop

- **74 achievements**, each with five tiers from bronze to legend, measured from your history (hours, actions, streaks, nights, Friday evenings, weeks and months with work, tokens, cache, models, cost), the live office (parallel sessions, subagents, giant contexts, commits and pushes, repos and branches, quick answers, clean desks) and what you do in the office (walking, talking, the radio, the shop, customising). A few are secret.
- **Legend of Legends** when every achievement is at legend.
- **Coins:** each tier pays 10 to 50 coins (the super achievement 1000). Spend them in the **shop** on decor that appears in the office: corridor plants, a rug, a COFFEE neon, floor lamps, a disco ball, a golden statue of the agent of the month, a piano, a fountain.
- **Agent of the month:** a framed portrait on the wall of the conversation with the most active time this month; the top 5 are in the achievements tab.
- **The weekly paper**, *The Office Times*, tells your week in headlines, all from measured data.
- **Progress file:** achievements, coins, purchases, avatars and settings live in `~/.config/coworking-agents/progress.json` (mode `0600`). No account needed: the app runs on your machine, so the progress is yours.

## Make it yours

![Customise](https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/customise.png)

☰ → **Customise** has 13 options: the office name (on a plaque by the elevator and in the top bar), your own look, floor (wood, dark wood, carpet, concrete, tiles, checker, marble, grass), walls (10 colours), room carpets (5 palettes), desks (5), the window view (city, beach, mountains, forest, space), the sky (automatic, always day, sunset, always night), lighting (natural, warm, cool, neon), the mascot (cat, dog, robot, fox, penguin, bunny), plants (normal or jungle), the radio station and the accent colour. The die next to an agent's face in its panel gives that agent a new look.

## A living office

- **Life:** after a long task an agent goes for a coffee or celebrates with confetti; at lunch idle agents eat a sandwich; idle ones play ping-pong and foosball or chat at the water cooler; a request waiting 2+ minutes rings the desk phone; uncommitted files pile up as paper on the desk; the desk plant grows with the session's age; a week-old session gets a cake; a room where everyone works hangs a do-not-disturb sign; after 6pm idle rooms turn their lights off; a janitor mops at night; Friday evenings bring pizza; newcomers step out of the elevator next to a punch clock; long-idle agents think funny thoughts.
- **Sky, seasons and weather:** the sun crosses the windows, the moon shows tonight's real phase, city lights follow the hour, leaves and petals fall by season (hemisphere from your time zone). Real weather is opt-in: click a window and the browser fetches it from Open-Meteo (coordinates rounded to ~1 km); rain slides down the glass.
- **Chiptune radio** (off by default): the station follows the AI working the most, the beat follows the office mood; an **ON AIR** sign lights up while anyone works.
- **Holidays:** Christmas, New Year, Halloween, Festa Junina, Carnaval and the office's birthday decorate the room and put hats on everyone (`E` turns decor off).
- **Pets:** the mascot visits whoever has waited on you the longest and likes being petted; a dog joins at 8 achievements at gold, a parrot at 16.
- **Certificates** for the skills and MCP servers each session used hang on its partition.
- **Office photo:** ☰ → Office photo saves the scene as a PNG. And something happens if you click the `</>` neon three times.
- **Languages:** English and Brazilian Portuguese.

<p align="center"><img src="https://raw.githubusercontent.com/ChaconLucas/coworking-agents/main/docs/mobile.png" alt="The office on a phone" width="300"></p>

## Shortcuts

| Key | Does |
|---|---|
| `1`–`9` | open the n-th agent |
| `N` | next agent that needs you (opens its talk modal) |
| `/` | quick search by name, title, repository or state |
| `R` / `T` / `G` / `C` | usage report / daily report (today) / history / achievements |
| WASD or arrows, Shift, Enter | walk, run, interact with what's near you |
| `F` | focus mode (25 min, again 50, again off) |
| `H` | replay the last hour |
| `L` | ceiling lights on/off |
| `E` | holiday decor on/off |
| `B` | building view (when there are floors) |

## Platforms

| | macOS | Linux | Windows |
|---|---|---|---|
| See sessions (Claude Code, Codex, other CLIs) | ✓ | ✓ | ✓ |
| Go to terminal | exact tab (Terminal, iTerm2) | window (needs `xdotool` or `wmctrl`) | window |
| Reply / answer / compact from the office | ✓ | copy and go | copy and go |

Linux and Windows support is written against their process tools but has not been tested on real machines yet; reports welcome. See the [roadmap](https://github.com/ChaconLucas/coworking-agents/blob/main/ROADMAP.md) for what's waiting on testing and what's next.

## Privacy and security

- **Read-only.** No hooks, nothing installed into the AIs, no configuration changed.
- **No tokens spent.** It never calls a model. The only network calls are the update check (asks npm for the latest version number, nothing else is sent; `--no-update-check` turns it off) and, only if you turn on real weather, the forecast your browser fetches from Open-Meteo.
- **Local only.** The server binds to `127.0.0.1`.
- **Host allowlist.** Requests whose `Host` header isn't `127.0.0.1`, `localhost` or `[::1]` are rejected, which blocks DNS-rebinding attacks.
- **Access token.** Every request needs the per-run token cookie (see [Access token](#access-token)). The "Go to terminal" endpoint additionally requires a custom header and a local origin.
- **Strict CSP.** `default-src 'self'`, no frames, no external scripts or fonts; the only outside connection allowed is Open-Meteo for the opt-in weather.
- **Never reads credentials.** Not Claude Code's `*.key` files, not Codex's `auth.json`. From `~/.claude.json` it reads only `skillUsage`, `pluginUsage` and `mcpServers`.
- **Secrets are masked.** Tokens, passwords, API keys and `Bearer` values inside commands are replaced with `•••` before display.
- **`--private` mode** for screen sharing hides agent names, branches, repo names (replaced by aliases like `repo A`), session titles, paths, file names, questions, skills, MCP names and the host name.

## Claude rate limits and context window

Claude Code only hands these numbers to your **status line** script, so the office reads a copy that the script saves. Add this to your status line (Python; `d` is the JSON Claude Code sends on stdin):

```python
import os, json, time
base = os.path.expanduser('~/.config/coworking-agents'); os.makedirs(base, exist_ok=True)
rl = d.get('rate_limits') or {}
if rl:
    json.dump({'at': int(time.time() * 1000), 'five_hour': rl.get('five_hour'), 'seven_day': rl.get('seven_day')}, open(base + '/claude-limits.json', 'w'))
size = (d.get('context_window') or {}).get('context_window_size')
if size and d.get('session_id'):
    p = base + '/claude-context.json'
    try: m = json.load(open(p))
    except Exception: m = {}
    m[d['session_id']] = size; json.dump(dict(list(m.items())[-200:]), open(p, 'w'))
```

Without it, the context percentage shows only once it is measurable (a reply past 200k tokens proves a 1M window); until then the panel shows the token count and "window size unknown", and no compact button appears.

## Limitations

- **Codex has no live-session registry.** "Open" means a Codex process is running and the conversation was touched in the last 3 hours, so a closed Codex chat can linger for a while.
- **Waiting vs. running** is told apart by inspecting processes (`ps`): for Claude Code's Bash it checks whether the command's shell was spawned. When the disk can't tell, the panel says so instead of guessing.
- **"Go to terminal" is macOS only.**


### Other AIs

Besides the full readers for Claude Code and Codex, these CLIs are **detected by their running process** when open in a terminal: Gemini CLI, OpenCode, Aider, Cursor Agent, Amp, Goose, Qwen Code, Crush, Droid and Kimi CLI. They get their own colour and sit in the room of their working directory; their state is coarse (CPU in use = working, otherwise idle) and "Go to terminal" works for them too.

Any other tool can be added in `~/.config/coworking-agents/agents.json`:

```json
[{ "id": "mytool", "label": "My Tool", "color": "#ff8800", "match": "(^|/)mytool(\\s|$)" }]
```

`match` is a regular expression tested against the process command line.

## Adding a new AI source

Each AI is one file in `src/sources/` that exports:

```js
module.exports = {
  id: 'my-ai', label: 'My AI',
  // live sessions: { agent, id, name, pid, kind, version, status: 'busy'|'idle', since, startedAt, cwd, st, subagents }
  sessions(now) { return []; },
  // conversations touched since `since` (midnight), for the daily report: { agent, id, st, title? }
  today(since) { return []; },
  // what the cork board shows
  credentials() { return { topSkills: [], skills: [], mcps: [], plugins: [] }; },
};
```

`st` comes from `incremental()` in `src/util.js`: you write only an `absorb(state, line)` that understands your AI's transcript format and call `track()` for each tool call (and `event()` for turn starts and ends). Then register the file in `SOURCES` in `src/collect.js`, give it a color in `AGENT` in `public/js/palette.js`, and add a case to `test/run.js`.

## Development

```bash
npm test             # builds fake ~/.claude and ~/.codex folders and checks the collector and the server
npm run demo         # the fake office with every state
npm run screenshots  # regenerates docs/*.png from demo mode (needs agent-browser on PATH)
node bin/coworking-agents.js --json   # one snapshot of the state, as JSON
```

The server also exposes `/api/state` (the snapshot, including a per-session timeline and recently edited files) and `/api/report` (today's sessions, active time, tool calls, files and output tokens).

## License

MIT, see [LICENSE](LICENSE). The Silkscreen font is under the SIL Open Font License (`public/fonts/OFL.txt`).
