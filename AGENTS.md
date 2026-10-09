# For AI assistants

If a user shares this repository and wants to use it, you can install and run it for them. No dependencies, no build step.

```bash
git clone https://github.com/ChaconLucas/coworking-agents.git
cd coworking-agents
node bin/coworking-agents.js        # Node 18+
```

It prints a link like `http://127.0.0.1:4777/?t=<token>` and opens the browser. Hand that link to the user. Useful flags: `--private`, `--demo 40`, `--no-open`, `--port N`.

As a Claude Code plugin instead: `/plugin marketplace add ChaconLucas/coworking-agents`, then `/plugin install coworking-agents@coworking-agents`, then `/coworking`.

Working on the code itself? Read `CLAUDE.md` first (rules: English, zero dependencies, `npm test` before every commit, `npm run screenshots` after visual changes).
