#!/usr/bin/env bash
#
# ios-dev.sh — Development Build & Simulator Controller (Interactive Loop)
#
#   bash scripts/ios-dev.sh                 Interaktives Menü starten (Dauerschleife)
#   bash scripts/ios-dev.sh --reuse-last    Direkt ausführen mit Flag
#

set -euo pipefail

PROFILE="development"
PLATFORM="ios"
DEVICE_NAME="iPhone 17 Pro"
REUSE_LAST=false
START_METRO=true
RESTART_METRO=false
STOP_METRO=false
RESTART_APP=false
ONLY_ACTIONS=false
BUNDLE_ID="com.goldjunge91.fam"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK_DIR="$PROJECT_ROOT/temp"
mkdir -p "$WORK_DIR"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\033[31mFehler: %s\033[0m\n' "$1" >&2; exit 1; }

reset_flags() {
  REUSE_LAST=false
  START_METRO=true
  RESTART_METRO=false
  STOP_METRO=false
  RESTART_APP=false
  ONLY_ACTIONS=false
}

for cmd in xcrun node; do
  command -v "$cmd" >/dev/null || die "$cmd nicht gefunden"
done

stop_metro_if_running() {
  if lsof -ti :8081 >/dev/null 2>&1; then
    say "Stoppe Metro auf Port 8081..."
    lsof -ti :8081 | xargs kill -9 2>/dev/null || true
    sleep 1
    echo "  Metro gestoppt."
  else
    echo "  Metro läuft aktuell nicht."
  fi
}

start_metro() {
  say "Metro starten"
  if lsof -ti :8081 >/dev/null 2>&1; then
    echo "  Port 8081 belegt — bestehender Metro wird weiterverwendet"
  else
    (cd "$PROJECT_ROOT" && bun start >"$WORK_DIR/metro.log" 2>&1 &)
    until grep -qE "Waiting on|exp://" "$WORK_DIR/metro.log" 2>/dev/null; do sleep 2; done
    echo "  bereit — Log: $WORK_DIR/metro.log"
  fi
}

run_action() {
  if [ "$STOP_METRO" = true ] && [ "$RESTART_METRO" = false ] && [ "$RESTART_APP" = false ]; then
    stop_metro_if_running
    say "Fertig (Metro gestoppt)"
    return 0
  fi

  if [ "$ONLY_ACTIONS" = false ]; then
    eas whoami >/dev/null 2>&1 || die "Nicht bei EAS angemeldet — 'eas login' ausfuehren"

    build_field() {
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
      [ -n "$BUILD_ID" ] || die "Kein fertiger Build gefunden"
      echo "  $BUILD_ID"
    else
      say "Neuen Build starten (Profil: $PROFILE)"
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
  fi

  say "Simulator vorbereiten: $DEVICE_NAME"

  UDID="$(xcrun simctl list devices available |
    grep -F "$DEVICE_NAME (" | head -1 | grep -oE '[0-9A-F-]{36}' || true)"

  if [ -z "$UDID" ]; then
    RUNTIME="$(xcrun simctl list runtimes | grep -oE 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+' | tail -1)"
    [ -n "$RUNTIME" ] || die "Keine iOS-Runtime installiert"
    DEVICE_TYPE="com.apple.CoreSimulator.SimDeviceType.$(echo "$DEVICE_NAME" | tr ' ' '-')"
    echo "  lege $DEVICE_NAME an"
    UDID="$(xcrun simctl create "$DEVICE_NAME" "$DEVICE_TYPE" "$RUNTIME")"
  fi
  echo "  $UDID"

  xcrun simctl boot "$UDID" 2>/dev/null || true
  xcrun simctl bootstatus "$UDID" -b >/dev/null

  if [ "$ONLY_ACTIONS" = false ]; then
    say "App installieren"
    xcrun simctl uninstall "$UDID" "$BUNDLE_ID" 2>/dev/null || true
    xcrun simctl install "$UDID" "$APP_PATH"
  fi

  open -a Simulator

  if [ "$RESTART_METRO" = true ]; then stop_metro_if_running; fi

  if [ "$START_METRO" = true ]; then
    start_metro
  fi

  if [ "$RESTART_APP" = true ] || [ "$ONLY_ACTIONS" = false ]; then
    say "App starten"
    xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
    xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
  fi

  say "Fertig"
  [ "$START_METRO" = true ] && echo "  Metro-Log: $WORK_DIR/metro.log"
}

if [ $# -gt 0 ]; then
  while [ $# -gt 0 ]; do
    case "$1" in
      --reuse-last) REUSE_LAST=true; shift ;;
      --no-metro) START_METRO=false; shift ;;
      --restart-metro) RESTART_METRO=true; ONLY_ACTIONS=true; shift ;;
      --stop-metro) STOP_METRO=true; START_METRO=false; ONLY_ACTIONS=true; shift ;;
      --restart-app|--relaunch) RESTART_APP=true; ONLY_ACTIONS=true; shift ;;
      --device) DEVICE_NAME="$2"; shift 2 ;;
      --profile) PROFILE="$2"; shift 2 ;;
      -h | --help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
      *) echo "Unbekannte Option: $1" >&2; exit 1 ;;
    esac
  done
  run_action
  exit 0
fi

while true; do
  reset_flags
  echo ""
  echo "=========================================="
  echo "   📱 iOS Dev Helper — Interaktiv"
  echo "=========================================="
  echo "1) 🚀 Neuen EAS Build erstellen & installieren"
  echo "2) 🔄 Letzten EAS Build wiederverwenden & installieren"
  echo "3) ♻️  Metro neustarten"
  echo "4) 🛑 Metro stoppen"
  echo "5) 📱 App im Simulator neu starten (Relaunch)"
  echo "6) 🔀 Metro & App gemeinsam neustarten"
  echo "q) Beenden"
  echo "=========================================="
  read -rp "Option wählen [1-6 / q]: " choice
  echo ""

  case "$choice" in
    1) REUSE_LAST=false; run_action ;;
    2) REUSE_LAST=true; run_action ;;
    3) RESTART_METRO=true; ONLY_ACTIONS=true; run_action ;;
    4) STOP_METRO=true; START_METRO=false; ONLY_ACTIONS=true; run_action ;;
    5) RESTART_APP=true; ONLY_ACTIONS=true; run_action ;;
    6) RESTART_METRO=true; RESTART_APP=true; ONLY_ACTIONS=true; run_action ;;
    q|Q) echo "Tschüss!"; exit 0 ;;
    *) echo "Ungültige Auswahl, bitte erneut versuchen." ;;
  esac
done
