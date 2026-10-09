# coworks-agents

A live pixel-art office for the AI coding sessions (Claude Code, Codex, …) on one machine.

## Principles
- **Truth before decoration:** every on-screen state comes from a measured signal (transcript, session registry, processes). When the disk can't tell, the screen says it doesn't know.
- **Read-only, local-only:** no hooks, no tokens, no network. Server on 127.0.0.1, never reads credentials.
- **Zero dependencies:** plain Node + Canvas. Installs with `npx`.
- **Secure by default:** Host allowlist, access token cookie, CSP, POST with a custom header, `--private` mode.

## Audience
People who run several AI sessions at once and lose track of which one needs attention.
