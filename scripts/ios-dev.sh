#!/usr/bin/env bash
#
# ios-dev.sh — Development Build erstellen, herunterladen, im iOS-Simulator
# installieren und starten.
#
#   bash scripts/ios-dev.sh                 neuer Build (Standard, startet Metro im Vordergrund)
#   bash scripts/ios-dev.sh --reuse-last    letzten fertigen Build verwenden
#   bash scripts/ios-dev.sh --no-metro      nicht starten, nur installieren & App oeffnen
#   bash scripts/ios-dev.sh --background    Metro im Hintergrund starten
#   bash scripts/ios-dev.sh --device "iPhone 17"
#
# Warum ueberhaupt ein neuer Build: Native Module landen beim Build im Binary.
# Nach `expo install expo-sqlite`, `expo-camera` o. ae. reicht ein Metro-Reload
# NICHT — die App scheitert mit `Cannot find native module '…'`.

set -euo pipefail

PROFILE="development"
PLATFORM="ios"
DEVICE_NAME="iPhone 17 Pro"
REUSE_LAST=false
START_METRO=true
BACKGROUND_METRO=false
BUNDLE_ID="com.goldjunge91.fam"

while [ $# -gt 0 ]; do
  case "$1" in
    --reuse-last) REUSE_LAST=true; shift ;;
    --no-metro) START_METRO=false; shift ;;
    --background) BACKGROUND_METRO=true; shift ;;
    --device) DEVICE_NAME="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    -h | --help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 1 ;;
  esac
done

# WORK_DIR="${TMPDIR:-/tmp}/fam-ios-dev"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK_DIR="$PROJECT_ROOT/temp"
mkdir -p "$WORK_DIR"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\033[31mFehler: %s\033[0m\n' "$1" >&2; exit 1; }

# ------------------------------------------------------------- Voraussetzungen
for cmd in eas xcrun curl node; do
  command -v "$cmd" >/dev/null || die "$cmd nicht gefunden"
done

eas whoami >/dev/null 2>&1 || die "Nicht bei EAS angemeldet — 'eas login' ausfuehren"

# --------------------------------------------------------------- Build ermitteln
build_field() {
  # $1 = Build-ID, $2 = Pfad im JSON, z. B. "status" oder
  # "artifacts.applicationArchiveUrl" (die Artefakt-URL liegt verschachtelt).
  eas build:view "$1" --json 2>/dev/null |
    node -e '
      let d = "";
      process.stdin.on("data", (c) => (d += c)).on("end", () => {
        try {
          const value = process.argv[1]
            .split(".")
            .reduce((acc, key) => (acc == null ? acc : acc[key]), JSON.parse(d));
          console.log(value ?? "");
        } catch {
          console.log("");
        }
      });
    ' "$2"
}

if [ "$REUSE_LAST" = true ]; then
  say "Letzten fertigen iOS-Build suchen"
  BUILD_ID="$(eas build:list --platform ios --status finished --limit 1 --json --non-interactive 2>/dev/null |
    node -e '
      let d = "";
      process.stdin.on("data", (c) => (d += c)).on("end", () => {
        try { console.log(JSON.parse(d)[0]?.id ?? ""); } catch { console.log(""); }
      });
    ')"
  [ -n "$BUILD_ID" ] || die "Kein fertiger Build gefunden — ohne --reuse-last starten"
  echo "  $BUILD_ID"
else
  say "Neuen Build starten (Profil: $PROFILE)"
  # --no-wait, damit wir den Fortschritt selbst ausgeben koennen.
  BUILD_OUTPUT="$(eas build --profile "$PROFILE" --platform "$PLATFORM" --non-interactive --no-wait 2>&1)"
  echo "$BUILD_OUTPUT" | tail -3
  BUILD_ID="$(echo "$BUILD_OUTPUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | tail -1)"
  [ -n "$BUILD_ID" ] || die "Build-ID nicht aus der EAS-Ausgabe lesbar"

  say "Auf Build $BUILD_ID warten"
  START_TS=$(date +%s)
  while true; do
    STATUS="$(build_field "$BUILD_ID" status)"
    case "$STATUS" in
      FINISHED | finished) echo "  fertig nach $(( ($(date +%s) - START_TS) / 60 )) min"; break ;;
      ERRORED | errored | CANCELED | canceled)
        die "Build $STATUS — Logs: https://expo.dev/accounts/goldjunge91/projects/fam/builds/$BUILD_ID" ;;
      *) printf '\r  Status: %-14s (%s min)' "${STATUS:-unbekannt}" "$(( ($(date +%s) - START_TS) / 60 ))" ;;
    esac
    sleep 30
  done
fi

# ------------------------------------------------------------------ Herunterladen
ARCHIVE_URL="$(build_field "$BUILD_ID" artifacts.applicationArchiveUrl)"
[ -n "$ARCHIVE_URL" ] || die "Keine Artefakt-URL fuer Build $BUILD_ID"

APP_DIR="$WORK_DIR/$BUILD_ID"
if [ -d "$APP_DIR" ] && [ -n "$(find "$APP_DIR" -maxdepth 1 -name '*.app' -print -quit)" ]; then
  say "Build liegt schon lokal, Download uebersprungen"
else
  say "Artefakt herunterladen"
  rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR"
  curl -# -L -o "$APP_DIR/build.tar.gz" "$ARCHIVE_URL"
  tar -xzf "$APP_DIR/build.tar.gz" -C "$APP_DIR"
  rm -f "$APP_DIR/build.tar.gz"
fi

APP_PATH="$(find "$APP_DIR" -maxdepth 1 -name '*.app' -print -quit)"
[ -n "$APP_PATH" ] || die "Keine .app im Artefakt gefunden"
echo "  $APP_PATH ($(du -sh "$APP_PATH" | cut -f1))"

# -------------------------------------------------------------------- Simulator
say "Simulator vorbereiten: $DEVICE_NAME"

UDID="$(xcrun simctl list devices available |
  grep -F "$DEVICE_NAME (" | head -1 | grep -oE '[0-9A-F-]{36}' || true)"

if [ -z "$UDID" ]; then
  # Kein passendes Geraet — eines fuer die neueste installierte Runtime anlegen.
  RUNTIME="$(xcrun simctl list runtimes | grep -oE 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+' | tail -1)"
  [ -n "$RUNTIME" ] || die "Keine iOS-Runtime installiert — 'xcodebuild -downloadPlatform iOS' ausfuehren"
  DEVICE_TYPE="com.apple.CoreSimulator.SimDeviceType.$(echo "$DEVICE_NAME" | tr ' ' '-')"
  echo "  lege $DEVICE_NAME an"
  UDID="$(xcrun simctl create "$DEVICE_NAME" "$DEVICE_TYPE" "$RUNTIME")"
fi
echo "  $UDID"

# Erststart einer frischen Runtime braucht mehrere GB fuer die dyld-Caches.
FREE_GB="$(df -g /System/Volumes/Data | tail -1 | awk '{print $4}')"
if [ "${FREE_GB:-99}" -lt 10 ]; then
  echo "  Warnung: nur ${FREE_GB} GB frei. Unter ~10 GB bootet der Simulator haeufig nicht durch." >&2
fi

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null

say "App installieren"
# Alte Version zuerst entfernen: sonst bleiben Reste eines Builds mit anderen
# nativen Modulen liegen.
xcrun simctl uninstall "$UDID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP_PATH"
open -a Simulator

# ------------------------------------------------------------------------ Metro
if [ "$START_METRO" = true ]; then
  if [ "$BACKGROUND_METRO" = true ]; then
    say "Metro im Hintergrund starten"
    if lsof -ti :8081 >/dev/null 2>&1; then
      echo "  Port 8081 belegt — bestehender Metro wird weiterverwendet"
    else
      (cd "$PROJECT_ROOT" && bun start >"$WORK_DIR/metro.log" 2>&1 &)
      until grep -qE "Waiting on|exp://" "$WORK_DIR/metro.log" 2>/dev/null; do sleep 2; done
      echo "  bereit — Log: $WORK_DIR/metro.log"
    fi

    say "App starten"
    xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null

    say "Fertig"
    echo "  Build:     $BUILD_ID"
    echo "  Simulator: $DEVICE_NAME ($UDID)"
    echo "  Metro-Log: $WORK_DIR/metro.log"
  else
    say "App im Simulator starten"
    xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null

    if lsof -ti :8081 >/dev/null 2>&1; then
      say "Beende alten/hintergruendigen Metro-Prozess auf Port 8081..."
      lsof -ti :8081 | xargs kill -9 2>/dev/null || true
      sleep 1
    fi

    say "Fertig! Starte interaktiven Metro-Server..."
    echo "  Build:     $BUILD_ID"
    echo "  Simulator: $DEVICE_NAME ($UDID)"
    echo "  [Tipp] Druecke 'r' im Terminal zum Neuladen oder 'd' fuer das Dev Menu."
    echo ""
    cd "$PROJECT_ROOT" && exec bun start
  fi
else
  say "App starten (ohne Metro)"
  xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null

  say "Fertig"
  echo "  Build:     $BUILD_ID"
  echo "  Simulator: $DEVICE_NAME ($UDID)"
fi
