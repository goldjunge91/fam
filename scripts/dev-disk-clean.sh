#!/usr/bin/env bash
#
# dev-disk-clean.sh — raeumt nur eindeutig regenerierbare Entwickler-Caches
# auf der Boot-Disk auf (Xcode/Simulator/Metro/Paketmanager). Ruehrt NIE
# Dokumente, App-Daten, Downloads, Docker-Volumes oder ~/Library/Application
# Support an — nur Caches, die das jeweilige Tool beim naechsten Lauf
# klaglos neu aufbaut.
#
# Hintergrund: Metro/Xcode haengen sich lautlos auf, wenn die Boot-Disk
# voll ist (ENOSPC statt Fehlermeldung). Dieses Script ist die Gegenmassnahme.
#
# Standardmaessig ein Dry-Run (zeigt nur Groessen, loescht nichts).
#
#   bash scripts/dev-disk-clean.sh            Dry-Run, zeigt was weg koennte
#   bash scripts/dev-disk-clean.sh --apply    Loescht tatsaechlich
#
set -euo pipefail

APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

bytes_of() {
  # 0 statt Fehler, falls Pfad fehlt oder ohne Leserechte (SIP-geschuetzte
  # Caches wie Safari/HomeKit ueberspringen wir dadurch sauber).
  du -sk "$1" 2>/dev/null | awk '{print $1 * 1024}' || echo 0
}

human() {
  awk -v b="$1" 'BEGIN {
    split("B K M G T", u, " ")
    i = 1
    while (b >= 1024 && i < 5) { b /= 1024; i++ }
    printf "%.1f%s", b, u[i]
  }'
}

TOTAL_RECLAIMED=0

# path, beschreibung
clean_path() {
  local path="$1" desc="$2"
  [ -e "$path" ] || return 0
  local size
  size="$(bytes_of "$path")"
  [ "$size" -eq 0 ] && return 0
  echo "  $(human "$size")	$desc"
  echo "    $path"
  if [ "$APPLY" = true ]; then
    rm -rf -- "${path:?}"/* 2>/dev/null || true
    rm -rf -- "${path:?}" 2>/dev/null || true
    TOTAL_RECLAIMED=$((TOTAL_RECLAIMED + size))
  fi
}

echo "==> $( [ "$APPLY" = true ] && echo "Loesche" || echo "Dry-Run — wuerde loeschen" ) folgende Caches:"
echo ""

# --- Xcode / Simulator --------------------------------------------------
echo "-- Xcode & Simulator --"
if command -v xcrun >/dev/null 2>&1; then
  # Nur echte Leichen: Simulatoren, deren Runtime deinstalliert wurde und die
  # `simctl` selbst als "unavailable" fuehrt. Aktive Geraete bleiben unberuehrt.
  UNAVAILABLE_UDIDS=$(xcrun simctl list devices unavailable 2>/dev/null \
    | grep -Eo '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' || true)
  if [ -n "$UNAVAILABLE_UDIDS" ]; then
    while IFS= read -r udid; do
      clean_path "$HOME/Library/Developer/CoreSimulator/Devices/$udid" "Verwaister Simulator: $udid"
    done <<< "$UNAVAILABLE_UDIDS"
    if [ "$APPLY" = true ]; then
      xcrun simctl delete unavailable 2>/dev/null || true
    fi
  else
    echo "  keine verwaisten Simulator-Runtimes gefunden"
  fi
fi
clean_path "$HOME/Library/Developer/Xcode/DerivedData" "Xcode DerivedData (wird bei naechstem Build neu erzeugt)"

# iOS DeviceSupport: nur alte Versionen loeschen, die 3 neuesten behalten
# (fuer Debugging/Symbolication auf aktuellen Geraeten).
DEVSUPPORT="$HOME/Library/Developer/Xcode/iOS DeviceSupport"
if [ -d "$DEVSUPPORT" ]; then
  OLD_VERSIONS=$(ls -1t "$DEVSUPPORT" 2>/dev/null | tail -n +4)
  if [ -n "$OLD_VERSIONS" ]; then
    while IFS= read -r v; do
      clean_path "$DEVSUPPORT/$v" "Alte iOS DeviceSupport-Version: $v"
    done <<< "$OLD_VERSIONS"
  fi
fi

echo ""
echo "-- ccache --"
# ccache gehoert bewusst NICHT auf die Boot-Disk (siehe
# docs/native-fingerprint-drift-debugging.md, Abschnitt "ccache zeigte
# 0 Hits"): der von react-native mitgelieferte Ccache-Wrapper ersetzt die
# primaere Nutzer-Config (CCACHE_CONFIGPATH) und faellt ohne eigenen
# 'cache_dir' auf den internen Default ~/.cache/ccache zurueck. Wenn das
# hier auftaucht, ist entweder scripts/native-build.ts's CCACHE_DIR-Fix nicht
# gegriffen, oder ein anderes Tool/Projekt schreibt ccache ohne eigene
# Config auf die Boot-Disk.
if command -v ccache >/dev/null 2>&1; then
  CCACHE_CONFIGURED_DIR="$(ccache -p 2>/dev/null | awk -F'= ' '/cache_dir *=/{print $2; exit}')"
  echo "  konfigurierter cache_dir: ${CCACHE_CONFIGURED_DIR:-unbekannt}"
  if [ -d "$HOME/.cache/ccache" ]; then
    echo "  WARNUNG: $HOME/.cache/ccache existiert — ccache ist (teilweise) auf der Boot-Disk gelandet."
    clean_path "$HOME/.cache/ccache" "ccache auf der Boot-Disk (sollte extern liegen)"
  else
    echo "  $HOME/.cache/ccache existiert nicht — ccache landet wie vorgesehen ausserhalb der Boot-Disk."
  fi
else
  echo "  ccache nicht installiert, uebersprungen"
fi

echo ""
echo "-- Paketmanager-Caches (werden beim naechsten Install neu geladen) --"
clean_path "$HOME/Library/Caches/CocoaPods" "CocoaPods-Cache"
# Absichtlich NICHT mehr pauschal $HOME/.cache loeschen: das ist der Default-
# Fallback-Ordner fuer ccache (siehe oben) und weitere Unix-Tools, die dort
# durchaus wiederverwendbare, teils grosse Caches ablegen. Gezielt statt
# pauschal, seit wir wissen, was dort eigentlich nicht hingehoert.
if command -v brew >/dev/null 2>&1; then
  echo "  brew cleanup -s  (alte Homebrew-Downloads/Versionen)"
  [ "$APPLY" = true ] && brew cleanup -s >/dev/null 2>&1 || true
fi

echo ""
echo "-- Metro / Watchman (dieses Projekt) --"
for d in "$TMPDIR"metro-* "$TMPDIR"haste-map-* "$TMPDIR"react-*; do
  clean_path "$d" "Metro/Haste-Map Temp-Cache"
done
if command -v watchman >/dev/null 2>&1; then
  echo "  watchman watch-del-all  (Watchman-Watches zuruecksetzen, unschaedlich)"
  [ "$APPLY" = true ] && watchman watch-del-all >/dev/null 2>&1 || true
fi

echo ""
if [ "$APPLY" = true ]; then
  echo "==> Fertig. Rueckgewonnen (grobe Schaetzung): $(human "$TOTAL_RECLAIMED")"
else
  echo "==> Dry-Run beendet. Zum tatsaechlichen Loeschen:"
  echo "    bash scripts/dev-disk-clean.sh --apply"
fi
df -h / | tail -2
