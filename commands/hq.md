---
description: Open the claudehq pixel office in the browser (all Claude Code sessions on this machine)
argument-hint: "[--private] [--demo]"
allowed-tools: Bash(node:*)
---

Start the claudehq office server in the background and tell the user the URL it prints.

Run this with the Bash tool, `run_in_background: true`:

```
node "${CLAUDE_PLUGIN_ROOT}/bin/claudehq.js" $ARGUMENTS
```

If it says it is already running, it just reopens the browser — that is fine.
Reply in one short line with the URL. Do not explain the tool unless asked.
