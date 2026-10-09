#!/usr/bin/env bash
# Regenerates the README screenshots from demo mode. Run after any visual change:
#   npm run screenshots
# Requires agent-browser (https://github.com/vercel-labs/agent-browser) on PATH.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v agent-browser >/dev/null || { echo "agent-browser not found"; exit 1; }

shot() { # count, query, output, js-before-shot, viewport
  local count=$1 query=$2 out=$3 js=${4:-} vp=${5:-"1440 900"}
  local log; log=$(mktemp)
  COWORKS_DEMO_COUNT=$count node bin/coworks-agents.js --demo --no-open --port 0 >"$log" 2>&1 &
  local pid=$!
  for _ in $(seq 1 50); do grep -q "http://" "$log" && break; sleep 0.1; done
  local url; url=$(grep -o "http://[^ ]*" "$log" | head -1)
  agent-browser set viewport $vp >/dev/null
  agent-browser open "${url}&${query}" >/dev/null
  sleep 5
  [ -n "$js" ] && { agent-browser eval "$js" >/dev/null; sleep 3; }
  agent-browser screenshot "$PWD/$out" >/dev/null # agent-browser resolves paths from its own daemon cwd
  kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true
  rm -f "$log"
  echo "✓ $out"
}

shot 10 "lang=en&hour=11" docs/office-day.png
shot 10 "lang=en&hour=22" docs/office-night.png
shot 40 "lang=en&hour=15" docs/building.png "setBuilding(true)"
shot 10 "lang=en&hour=11" docs/panel.png "showPerson(data.people[5].id)"
shot 10 "lang=en&hour=20" docs/mobile.png "" "390 844"
agent-browser close >/dev/null 2>&1 || true
