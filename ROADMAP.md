# Roadmap

What is planned, what is waiting on something we can't test here, and ideas. Pull requests and reports welcome.

## Waiting on real machines or real transcripts

These are written or designed, but can't be verified without hardware or data we don't have. If you can help, open an issue with what you saw.

- **Windows, real-machine test.** The process table (PowerShell/CIM), snapshot and server have never run on a real Windows box. Needed: someone running `npx coworking-agents` and `npx coworking-agents --json` there.
- **Windows CPU per process.** Other AI CLIs always show "idle" on Windows because CIM doesn't give CPU %. Needs a cheap measurement (e.g. two `Get-Process` samples) tested on a real machine.
- **Linux, real-machine test.** `ps`, `/proc/<pid>/cwd` and the "go to terminal" path (xdotool / wmctrl) were written blind.
- **Typing into a terminal on Linux and Windows.** Reply, answer and `/compact` are macOS only (AppleScript into Terminal/iTerm). Linux would need per-terminal support (tmux `send-keys` is the most portable start); Windows would need Windows Terminal/conhost support.
- **Full readers for other AIs.** Gemini CLI, OpenCode, Aider, Cursor Agent, Amp, Goose, Qwen Code, Crush, Droid and Kimi are detected by process only (working/idle). Showing what they are doing (tool, file, question, tokens) needs their on-disk session format, read from real transcripts. Share a sample (redacted) to get one added.

## Next

- **Status-line copy of the context window** set up automatically (opt-in), so the context percentage is exact from the first reply instead of only after a reply passes 200k.
- **1.0.0** once the above settles.

## Done recently

Estimated cost · wait reminder · git state on the door · daily report as Markdown · history · focus mode · avatar picker.

## Ideas

- **Seasonal decor** by date (subtle, off with a toggle).
