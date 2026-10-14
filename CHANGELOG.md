# Changelog

## Unreleased
- A bar at the bottom switches Gather and Normal mode. In Gather: zoom from *all* (the whole floor fits the window) to 3× (− and +, the - and = keys, or pinch / ctrl + wheel), and look around yourself by dragging the floor or scrolling; walking (or ◎) brings the camera back to you
- Walking: you collide by your feet (the bottom of your character, about 10 px wide), so walls stop you where they are drawn and you no longer get stuck on an invisible edge in the middle of the floor; the glass meeting room, the rest room and the server corner are walls too, entered by their doors
- Gather mode (on by default while you walk; ☰ → Settings → Camera follows you): the office drawn twice as big and the view slides with you
- Walk up to an agent and a card opens over it: what it is doing or asking, its title and what you asked last, with Open/Answer and Conversation
- A garden at the bottom of the floor (trees, a fountain, flower beds, benches); agents whose turn ended take turns strolling out there
- The agents walk: after about 20 s reading or browsing an agent gets up, walks to the library and sits at a reading table; after about 20 s running commands it goes to the lab; after about 8 s on something else it walks back to its desk. Bigger rooms. Who waits on you stays at the desk, waving (the waiting room shows them when you walk in)

## 0.10.0 — 2026-10-14
- Fix: the test suite no longer stops a running office started at login (it turned the login item off through the real launchd label)
- Three new rooms on the office floor, under the game room: the library, the lab and the waiting room. The agents stay at their desks; walk into a room (arrows/WASD or a click) and you see who is reading or browsing, running commands, or waiting on you right now. A number on the door says how many; Enter next to someone opens them (the waiting room opens the question)
- Walk inside the rooftop, the trophy room and the server room too; the elevator door in the corner takes you back

## 0.9.1 — 2026-10-14
- ☰ → Settings → *Open with the computer*: the start-at-login switch right in the menu, with its green dot (it also stays in Personalise)
- The browser tab shows the new app icon (the agent at its desk) instead of the old face; the menu bar keeps the small face, which reads best at that size
- Phone: always the same address (the computer's name and port 4778, whatever port the office got), so the home-screen icon added once keeps working
- Phone: turn it on from the office (☰ → 📱 → *Turn the phone on*) and it stays on, starting with the office every time with the same QR (the app and autostart included); *Turn the phone off* ends it. `--phone` still works
- ☰ menu: three groups (See, Do, Settings) side by side, every item with a pixel icon in the same style, and it scrolls instead of running off the screen

## 0.9.0 — 2026-10-14
- Tell me when… (☰ → ⏰, or the agent's panel): a notice when an agent finishes (once), when a limit passes a level you pick (again after it resets), or when any agent edits a file whose path has some text; in the office, the bell and as a system notification. Kept with your progress
- Past conversations (☰ → 🗄): every Claude Code and Codex conversation on this computer from the last 60 days, open or closed, found by name, folder or what was said (last 30 days), and read as a chat with its helpers and a search inside it. Read only; off in private mode
- A new release shows up in an office left open within about 10 minutes (it checked once an hour), and the releases board, the admin's sign and the notice follow as soon as the office knows

## 0.8.0 — 2026-10-14
- The office wall: frames, screens and windows spread evenly between the light switch and the whiteboard (same gap between each), a quiet wallpaper pattern and a chair rail with wainscot instead of plain stripes; sunlight comes in only through real windows
- Everyone in the office: click the agent count under the office name for every agent with its state and the helpers working for it; an agent opens its panel, a helper opens its conversation
- Top bar: under the office name, how many agents are in the office, with "+N 🤖" while helpers (subagents) work (hover for who); the bar keeps its size; the phone shows the same in its header and on each agent's card
- Conversation (computer and phone): every agent's helpers (Claude subagents, Codex child threads) listed above the chat, with a dot on the ones still working; pick one to read its own conversation, from the request it got to its answer, with the same search
- Conversation in the side panel: click an agent, then *Conversation* for the whole conversation as a chat, a search inside it, and a box to write to it when it finished its turn
- Tasks as a board (Tasks → *Board*): queued, running, waiting on you, done; drag a card to retry, conclude or cancel it
- When you spend (Costs and limits): output tokens per weekday and hour over the last 28 days, with the peak; and under each limit, at the measured pace of the last hour, when it would run out or that it lasts until it resets
- Day timelapse (☰ → 🎞): a picture of the office every 5 minutes while it is open, drawn without names, turned into a ~20 s GIF made in the browser; kept only in this browser for 3 days
- Fix: a stalled Read or Edit no longer shows as waiting for your approval in the modes that never ask for them (auto, accept edits, don't ask, bypass), nor a quick tool waiting on a command running beside it
- Phone app updates faster: the live link pings every 5 s (a quiet office no longer looks offline and falls back to polling), reopens at once when the app comes back from the background, and new messages reach the open conversation with each change
- Phone app: an agent's whole conversation as a chat (its own tab next to the summary), with a search inside it that also reaches older messages, and the message box at the bottom. Only what you wrote and what it answered; no tool output, reminders or command echoes; off in private mode
- Phone home-screen icon opens with its code: the code link is the page itself (no redirect) and the manifest has no fixed start, so the icon keeps the link it was added from (iOS gives a home-screen app its own cookies)
- Phone app keeps working when the Wi-Fi hands the computer a new address: the link uses the computer's own .local name (Bonjour), and the phone server moves to the new address by itself (same port and code). The address link stays shown for phones that don't resolve the name

## 0.7.0 — 2026-10-13
- Phone app, live: the office pushes every change as it happens (the 3-second poll only runs while the stream is down)
- Phone app: tap an agent to see it in full: what it is asking or doing now, your last request, its last answer, what it did, the files it touched, helpers, model, context, cost (texts hidden in private mode)
- Phone app: write to an agent that finished its turn, typed into its terminal (same rule as the office)
- Phone app: see a task's changes (summary and coloured diff) before concluding
- Menu bar (and Windows tray tip): the fullest token limit as a small bar next to the counts, so token use is visible at a glance
- macOS notifications now come from a small hidden Coworking Agents app (the menu bar script compiled with osacompile, office icon, re-signed ad hoc), so they show its name and icon instead of Script Editor's
- Phone tab bar sits lower, closer to the bottom edge
- Phone app shell: the page no longer scrolls (only the middle does), so the header stays below the notch and the tab bar stays on the bottom on iPhone, even after the keyboard
- Phone app in the office's own look: pixel font, pixel buttons and borders, each agent's face; the page names its files per run so a home-screen icon never keeps an old version
- Phone app redone: tabs for Now (who needs you, every agent and what it is doing), Tasks (reply, allow, conclude, retry, cancel, and a new task in a folder already in use), Office (the live picture without names) and Usage (today, month, goal, limits); respects the notch and the home bar
- New app icon: an agent at its desk with the laptop and the speech bubble
- Create the app on this computer (free, no store, no signing): `coworking-agents install-app` or Personalise — a Coworking Agents app in Applications (macOS), the Start Menu and Desktop (Windows) or the applications menu (Linux); opening it starts the office if needed in an app window. `uninstall-app` removes it
- The phone panel goes on the home screen like an app (iPhone and Android); its code is kept across restarts, and *Change the phone code* cuts every phone off
- First run asks once: *Install as an app* (and optionally start with the computer) or *Keep the browser*; the answer decides how it opens from the terminal next time and can be changed in Personalise
- Use it as an app, if you want: *Install as an app* (its own window and Dock/taskbar icon; nothing cached), `--app` for an app window of Chrome/Edge/Brave/Chromium, and *Start with the computer* (`coworking-agents autostart on|off`): hidden at login with the tray icon, through each system's own login entry, no shell. The browser keeps working as before
- Tray icon on Windows (PowerShell + Windows Forms: red dot, menu, balloons) and Linux (zenity icon and tooltip, or notify-send notices); on macOS a red count, today's spend, limits, who is working and tasks asking permission; system notifications when nobody has the office open, outside quiet hours
- macOS menu bar icon (Personalise or `--menubar`): how many are working and who needs you; clicking one opens the office on that agent; it goes away when the office closes. No dependency: the system's own JavaScript for Automation reads a private status file
- Office events: confetti when a task's tests pass, a PR is opened or a week ends under the cost goal; rain inside the office when tests or a task fail (calmer with reduced motion)
- Office mood: *stuck* when many agents wait on you or sit silent — the room turns grey-blue and the radio slows; a warm tone when everything flows
- Files touched most (Repositories panel): the files agent sessions edited most over the last 7 days, by repo and AI (off in private mode)
- Security: typing into Terminal re-checks, at that moment, that the agent still owns the tab (never into a bare shell); the heavy routes (search in logs, gh, cleanup) run one at a time
- TV mode (☰ → 📺 or `?tv=1`): full screen with only the office and big counters; Esc leaves
- Waiting on you today (daily report and the pasted summary): measured time the agents waited on your answers and office tasks stood blocked on you, with the longest waits
- Budgets per day and per repository: once reached, new office tasks wait and running ones stop
- Standing instructions per repository (Repositories panel): sent with every task the office creates there
- GitHub through gh: turn an open issue into a task (title, text and link), and review a pull request by number with a read-only reviewer that gets the diff as data
- Cleanup (Repositories panel): remove worktrees of finished tasks; uncommitted work is never removed and a branch is deleted only when merged or pushed
- Permission rules: always deny anything containing a text (wins over everything) and always allow an exact command, with arguments but nothing chained; one click denies the usual dangerous ones
- Secrets before commit: Ready to ship? scans the lines the task added and its new files for keys, tokens, private keys and credential files; the commit is blocked until you remove them or confirm (the value is never shown)
- Visits (with `--phone`): a one-hour, LAN-only, read-only link that shows a picture of the office drawn without names plus how many are working; its own token, PNG-only frames, ended on demand
- Sounds and do not disturb (Personalise tab): turn each sound on or off; a daily quiet window (may cross midnight) mutes sounds and system notifications while notices still land in the bell
- Compare models: a table on your finished tasks per AI, model and effort with average cost, attempts, tests passing and how many ended well
- Search what was said: the tasks search box also looks in what you asked and what Claude and Codex answered over the last 7 days (never tool output; off in private mode)
- Message several agents (☰ → 📣): one request to the agents you pick; typed into terminal sessions that are waiting, continued in the background for VS Code and app conversations, busy ones left out
- Repositories panel (☰ → 📦): who is in each repo now, what is not committed, to push or behind, worktrees, open tasks, PRs and today's activity
- Batch: repeat a new task in other folders (one per line), one task each, every folder checked by the server
- Schedules: run a saved template every day, on weekdays or on one weekday at a set time (while the office is open; catches up the same day)
- Chains: a task set to *chain* starts as soon as the previous one ended well (no need to conclude it) and gets its result; a failed step stops the chain and says so
- Security: a pentest sweep in the tests reads every route from server.js (cookie, custom header, foreign and look-alike origins, missing/foreign Host, path traversal, login redirect, security headers); XSS checks on every HTML builder; PR links only as https; importing a backup lists the templates' test commands before you accept

## 0.6.0 — 2026-10-13
- Tasks redesigned: list grouped by waiting on you / running / done with coloured state pills; detail with a clear header, alerts on top, result and review on the left, cost and model on the right, one primary action, quiet secondary ones and a red cancel, activity folded
- Backup: export and import templates, queue and economy settings, cost goal, decor, outfits and progress as one JSON file (Personalise tab)
- Achievements: First try (tasks done without a retry), Approved (reviews that said OK), Penny-wise (weeks under the cost goal)
- Weekly card: best day, the AI used most and the week's cost; a notice on Sundays when it is ready
- Ready to ship?: concluding a task first shows tests, review, files, what is not committed and the branch; commit with an editable message and open a PR with `gh`, only when you press it
- Agents that say they are working but write nothing for 10 minutes get a notice
- File clashes land in the notices, with a pause button when one side is an office task
- Month's cost goal in Usage: spent so far, end-of-month projection, and a notice when the pace or the total goes over
- Shop: beanie, bow, wizard hat, round glasses, mustache, green and blue shirts; bought outfits say *Wear* and open the wardrobe instead of *Move*
- Phone panel (opt-in `--phone`): a small page on your Wi-Fi to see who needs you and answer permissions, replies and single-choice questions; its own restricted server and token, QR code in the terminal and in the office
- Automatic review (opt-in): when a task finishes with changes, a read-only reviewer with the same AI reads the diff and its verdict shows on the original task
- Task templates: save a request you repeat with its folder and settings; fill the form or create and run with one click
- The new-task form stays open and keeps what you typed across the periodic refresh
- Daily report to paste: cost of the day's sessions, what each agent did, what is still open (tasks and agents waiting on you), as Markdown or Slack markup
- Limits: at the pace of the last hour, the office warns when a 5-hour or weekly window will run out before it resets; limit warnings also land in the 🔔 notices with a tip to make it last
- Switch in the terminal: change the model and effort of a running Claude or Codex terminal session from the office (Claude `/model` + `/effort`; Codex picker, this session only); recommendation notices do it on Apply
- Codex subagent cost counted from the subagents' own logs, once
- Compact: shrink a task's or an outside conversation's context in the background (Claude `/compact`, Codex compaction), keeping the same session
- Permissions mid-run: a task pauses when the agent wants a tool it may not use (Claude) or to leave its sandbox (Codex) and the office asks Allow / Always allow / Deny, on the card and as a notice
- Codex tasks run through `codex app-server`, the mode where Codex can ask before leaving its sandbox; cost per model call, counted once
- "Open the conversation" jumps to the exact conversation in VS Code, the Claude app or the Codex app
- Sessions opened outside are watched while they run: when there is a real reason (stuck on one step, nearly full context, the kind of work) the office sends a notice with the recommended model and effort; Apply puts it in that agent's request box
- Ask any Claude or Codex session from the office, even one opened in VS Code or the app: the request continues the same conversation with the model and effort you choose (the recommended ones come pre-picked)
- Sessions opened outside show their real effort (Codex from its log, Claude from its settings)
- Task detail shows current, pending and recommended config once, in the recommendation card
- Update check every hour and when the releases tab opens

## 0.5.0 — 2026-10-11
- Agent panel: tasks started by the office show running vs pending model and effort, cost and Save / More capacity / Apply recommendation; monitored sessions show the recommendation as not applied
- Codex models and efforts come from Codex's own model list; Claude efforts low to max
- Cost per real model id, unknown cost shown as unknown (never as zero), no double counting on resumed runs; budget says when it can't be enforced
- Ranking by AI, task and session with the spend that happened in the chosen period
- Clean retries, full diff since the task started (commits, staged, new files), worktree errors reported, no conclude while running, cancel waits for the process, running agents survive a server restart
- Roles (Backend, Frontend, Reviewer), economy mode, filtered test logs, attempt limit, new session with a summary, optional auto-apply within limits
- Notices keep arriving with the tab in the background and recover what was pending; Apply applies exactly what the notice proposed; private mode hides tasks and notices
- Releases: notes of the newer version fetched from its package, install-aware update command, "unavailable" when npm can't be reached
- Search across tasks, live sessions, today and this month; replay includes sessions that ended in the last hour

## 0.4.0 — 2026-10-11
- Tasks: create a task, pick folder, agent and profile; it runs in the background (Claude Code or Codex), in its own worktree if you want
- Answer questions, approve blocked tools, review the diff and test results, conclude, hand off or retry — all from the office
- Queue with priority, dependencies, max parallel agents and automatic agent choice
- Cost ranking by task and by AI (day, week, month), budget per task, Save / More capacity / Recommended / manual model and effort
- Recommendations with the reason, warnings for loops, retries and budget
- Notification center and a releases board with the office admin
- Read-only MCP server: `coworking-agents mcp`
- Linux: send text to agents running in tmux
- Private mode hides repo names and titles in the report and usage ranking

## 0.3.1 — 2026-10-10
- Crisp Bug Catcher, redesigned rooftop and server room
