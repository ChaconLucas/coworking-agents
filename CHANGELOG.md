# Changelog

## Unreleased
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
