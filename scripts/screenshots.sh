#!/usr/bin/env bash
# Regenerates the README screenshots from demo mode. Run after any visual change:
#   npm run screenshots
# Requires agent-browser (https://github.com/vercel-labs/agent-browser) on PATH.
set -euo pipefail
export AGENT_BROWSER_SESSION="${AGENT_BROWSER_SESSION:-coworking-shots}" # its own browser session: other agents may be using the default one
cd "$(dirname "$0")/.."
command -v agent-browser >/dev/null || { echo "agent-browser not found"; exit 1; }

shot() { # count, query, output, js-before-shot, viewport
  local count=$1 query=$2 out=$3 js=${4:-} vp=${5:-"1440 900"}
  local log; log=$(mktemp)
  COWORKING_DEMO_STATIC=1 COWORKING_DEMO_COUNT=$count node bin/coworking-agents.js --demo --no-open --port 0 >"$log" 2>&1 &
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

# date=05-05 keeps holiday decor out of the regular shots
shot 10 "lang=en&hour=11&date=05-05" docs/office-day.png
shot 10 "lang=en&hour=22&date=05-05" docs/office-night.png
shot 40 "lang=en&hour=15&date=05-05" docs/building.png "setBuilding(true)"
shot 10 "lang=en&hour=11&date=05-05" docs/panel.png "showPerson(data.people[5].id)"
shot 10 "lang=en&hour=20&date=05-05" docs/mobile.png "" "390 844"
shot 12 "lang=en&hour=21&date=05-05" docs/talk.png "openTalk((data.people.find(p => p.state === 'idle') || data.people[0]).id)"
shot 12 "lang=en&hour=21&date=05-05" docs/usage.png "openReport()"
shot 12 "lang=en&hour=21&date=05-05" docs/house-wall.png "selected='__hall'; renderPanel()"
shot 12 "lang=en&hour=21&date=05-05" docs/top-bar.png "" "1440 160"
shot 12 "lang=en&hour=15&date=05-05" docs/work-site.png "arrivals.set(layout[layout.length - 1].p.id, Date.now() - 1200); lastLayoutKey = ''; renderAll()"
shot 12 "lang=en&hour=21&date=05-05" docs/camera.png "showPerson(data.people[2].id)"
shot 12 "lang=en&hour=21&date=05-05" docs/achievements.png "openReport('ach')"
shot 12 "lang=en&hour=21&date=05-05" docs/trophy-room.png "setTrophyView(true)"
shot 10 "lang=en&hour=11&date=05-05" docs/game-room.png "document.querySelectorAll('.help').forEach(h => h.remove()); scrollTo(0, document.body.scrollHeight)"
shot 12 "lang=en&hour=11&date=05-05" docs/servers.png "setView('servers')"
shot 12 "lang=en&hour=11&date=05-05" docs/customise.png "openReport('office')"
shot 12 "lang=en&hour=11&date=05-05" docs/paper.png "openReport('paper')"
shot 10 "lang=en&hour=21&date=12-20" docs/christmas.png
shot 10 "lang=en&hour=17&date=10-31" docs/halloween.png
agent-browser close >/dev/null 2>&1 || true
