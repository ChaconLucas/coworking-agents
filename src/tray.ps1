# Windows tray icon for coworking-agents (PowerShell + Windows Forms, both part of Windows).
# It only reads one status file the office writes (%USERPROFILE%\.config\coworking-agents\menubar.json):
# counts, who needs you, what costs and limits look like, and links to the local office. No network of its own.
# Strings live here because this runs outside the page (no i18n.js); the language follows Windows.
param([string]$StatusFile, [string]$IconFile)
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

$pt = (Get-Culture).Name -like 'pt*'
if ($pt) {
  $L = @{ open = 'Abrir o escritório'; hide = 'Esconder o ícone'; closed = 'O escritório está fechado'; need = 'Precisam de você'; asks = 'Pedem permissão'; working = 'Trabalhando'; nobody = 'Ninguém precisa de você agora'; today = 'Hoje'; title = 'precisa de você' }
} else {
  $L = @{ open = 'Open the office'; hide = 'Hide the icon'; closed = 'The office is closed'; need = 'Need you'; asks = 'Asking permission'; working = 'Working'; nobody = 'Nobody needs you right now'; today = 'Today'; title = 'needs you' }
}

# the icon, and the same with a red dot when someone needs you
$base = $null
try { $base = New-Object System.Drawing.Bitmap $IconFile } catch {}
function New-TrayIcon([bool]$red) {
  $bmp = New-Object System.Drawing.Bitmap 16, 16
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  if ($base) { $g.DrawImage($base, 0, 0, 16, 16) } else { $g.FillRectangle([System.Drawing.Brushes]::DimGray, 1, 1, 14, 14) }
  if ($red) { $g.FillEllipse([System.Drawing.Brushes]::Red, 8, 8, 8, 8) }
  $g.Dispose()
  return [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}
$iconOk = New-TrayIcon $false
$iconRed = New-TrayIcon $true

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $iconOk
$tray.Text = 'coworking-agents'
$tray.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$tray.ContextMenuStrip = $menu

$script:last = ''
$script:url = ''
$script:seen = @{}
$script:staleSince = 0
$script:first = $true

# only ever opens the office running on this machine
function Open-Office([string]$u) { if ($u -match '^http://(127\.0\.0\.1|localhost):\d+/') { Start-Process $u } }
function Add-Item([string]$text, [string]$link, [bool]$enabled) {
  $item = $menu.Items.Add($text)
  $item.Enabled = $enabled
  if ($link) { $target = $link; $item.add_Click({ Open-Office $target }.GetNewClosure()) }
}
function Stop-Tray { $timer.Stop(); $tray.Visible = $false; $tray.Dispose(); [System.Windows.Forms.Application]::Exit() }
function Short([string]$s, [int]$n) { if ($s.Length -gt $n) { return $s.Substring(0, $n - 1) + '…' } return $s }

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.add_Tick({
  $s = $null
  try { $s = Get-Content -Raw -Encoding UTF8 $StatusFile | ConvertFrom-Json } catch {}
  $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $alive = $s -and ($nowMs - [int64]$s.at) -lt 15000
  if (-not $alive) { if (-not $script:staleSince) { $script:staleSince = $nowMs } elseif ($nowMs - $script:staleSince -gt 60000) { Stop-Tray; return } }
  else { $script:staleSince = 0 }

  # a system balloon for each agent that just started needing you (not for what was already true at start)
  if ($alive) {
    foreach ($p in @($s.list)) {
      if (-not $script:seen.ContainsKey($p.id)) {
        $script:seen[$p.id] = 1
        if (-not $script:first -and $s.notify) { $tray.ShowBalloonTip(5000, "$($p.name) $($L.title)", (Short ([string]$p.title) 120), [System.Windows.Forms.ToolTipIcon]::Info) }
      }
    }
    $script:first = $false
  }

  $key = if ($alive) { ($s | Select-Object work, need, usd, list, asks, workers, limits, url | ConvertTo-Json -Depth 5 -Compress) } else { 'closed' }
  if ($key -eq $script:last) { return }
  $script:last = $key
  $menu.Items.Clear()
  if (-not $alive) {
    $tray.Icon = $iconOk; $tray.Text = Short "coworking-agents · $($L.closed)" 63
    Add-Item $L.closed '' $false
  } else {
    $script:url = [string]$s.url
    $tray.Icon = if ($s.need -gt 0) { $iconRed } else { $iconOk }
    $tray.Text = Short ("coworking-agents · ●$($s.work)" + $(if ($s.need -gt 0) { " · ❗$($s.need)" } else { '' })) 63
    Add-Item ("●$($s.work) · ❗$($s.need)" + $(if ($s.usd) { " · $($L.today) US$ " + ('{0:N2}' -f [double]$s.usd) } else { '' })) '' $false
    foreach ($l in @($s.limits)) { Add-Item "$($l.label): $($l.pct)%" '' $false }
    [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    if (@($s.list).Count) { Add-Item $L.need '' $false; foreach ($p in @($s.list)) { Add-Item ("❗ " + (Short "$($p.name) — $($p.title)" 70)) $p.url $true } }
    else { Add-Item $L.nobody '' $false }
    if (@($s.asks).Count) { Add-Item $L.asks '' $false; foreach ($a in @($s.asks)) { Add-Item ("🔐 " + (Short "$($a.title) — $($a.tool)" 70)) $a.url $true } }
    if (@($s.workers).Count) { Add-Item $L.working '' $false; foreach ($w in @($s.workers)) { Add-Item ("● " + (Short "$($w.name) — $($w.doing)" 70)) '' $false } }
    [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    Add-Item $L.open $s.url $true
  }
  $hide = $menu.Items.Add($L.hide); $hide.add_Click({ Stop-Tray })
})
$tray.add_DoubleClick({ if ($script:url) { Open-Office $script:url } })
$timer.Start()
[System.Windows.Forms.Application]::Run()
