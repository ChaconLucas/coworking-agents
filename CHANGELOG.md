# Changelog

## Unreleased
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
