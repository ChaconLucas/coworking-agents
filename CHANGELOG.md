# Changelog

## Unreleased
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
