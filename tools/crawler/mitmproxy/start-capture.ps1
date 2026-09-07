# PowerShell-Starter für Bring!-Token-Capture mit mitmproxy (SSL/HTTPS)
[CmdletBinding()]
param(
    [int]$ProxyPort = 8080,
    [int]$WebPort = 8082
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvDir = Join-Path $ScriptDir '.venv'
$PythonExe = Join-Path $VenvDir 'Scripts\python.exe'
$MitmwebExe = Join-Path $VenvDir 'Scripts\mitmweb.exe'
$AddonScript = Join-Path $ScriptDir 'capture_bring.py'

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  🛒 Fam Bring! Token Capture (mitmproxy SSL Interceptor)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Virtual Environment prüfen / erstellen
if (-not (Test-Path $PythonExe)) {
    Write-Host "[1/3] Python Virtual Environment wird erstellt (.venv)..." -ForegroundColor Yellow
    python -m venv $VenvDir
    if (-not (Test-Path $PythonExe)) {
        Write-Error "Virtual Environment konnte nicht erstellt werden. Bitte stelle sicher, dass Python installiert ist."
        exit 1
    }
}

# 2. mitmproxy in .venv prüfen / installieren
if (-not (Test-Path $MitmwebExe)) {
    Write-Host "[2/3] Installiere mitmproxy im Virtual Environment..." -ForegroundColor Yellow
    & $PythonExe -m pip install mitmproxy
}

# 3. Lokale IPv4-Adresse ermitteln
$LocalIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|VirtualBox|VMware' -and
    $_.IPAddress -notmatch '^169\.254\.' -and
    $_.IPAddress -notmatch '^127\.'
} | Select-Object -First 1).IPAddress

if (-not $LocalIp) {
    $LocalIp = "DEINE_PC_IP"
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  PROXY BEREIT ZUM START" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Proxy-Adresse:   $LocalIp" -ForegroundColor Yellow
Write-Host "  Proxy-Port:      $ProxyPort" -ForegroundColor Yellow
Write-Host "  Web-Oberfläche:  http://127.0.0.1:$WebPort" -ForegroundColor Gray
Write-Host ""
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "EINRICHTUNG AUF DEINEM SMARTPHONE (iOS / Android):" -ForegroundColor Cyan
Write-Host "  1. Handy ins selbe WLAN wie dieser PC einwählen."
Write-Host "  2. WLAN-Einstellungen -> Proxy auf 'Manuell':"
Write-Host "     - Server/Host: $LocalIp" -ForegroundColor Yellow
Write-Host "     - Port:        $ProxyPort" -ForegroundColor Yellow
Write-Host "  3. Im Browser auf dem Handy 'http://mitm.it' aufrufen."
Write-Host "  4. Passendes Zertifikat herunterladen und installieren."
Write-Host "  5. WICHTIG BEI iOS:" -ForegroundColor Magenta
Write-Host "     Einstellungen -> Allgemein -> Info -> Zertifikatsvertrauenseinstellungen"
Write-Host "     -> Den Schalter für 'mitmproxy' aktivieren!" -ForegroundColor Magenta
Write-Host "  6. Bring!-App öffnen (oder neu laden/einloggen)."
Write-Host "     -> Die Tokens werden sofort automatisch gespeichert in:"
Write-Host "        - tokens_backup.env"
Write-Host "        - tools/crawler/.env"
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Starte mitmweb... (Beenden mit Strg+C)" -ForegroundColor Cyan
Write-Host ""

& $MitmwebExe --listen-port $ProxyPort --web-port $WebPort -s $AddonScript
