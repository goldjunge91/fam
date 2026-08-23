#!/usr/bin/env bash
#
# ios-dev.sh — Development Build erstellen, herunterladen, im iOS-Simulator
# ODER auf einem physischen iPhone installieren und starten.
#
#   bash scripts/ios-dev.sh                       neuer Build (Standard, startet Metro im Vordergrund)
#   bash scripts/ios-dev.sh --reuse-last          letzten fertigen Build (fuer das aktuelle Profil) verwenden
#   bash scripts/ios-dev.sh --no-metro            nicht starten, nur installieren & App oeffnen
#   bash scripts/ios-dev.sh --background          Metro im Hintergrund starten
#   bash scripts/ios-dev.sh --device "iPhone 17"  anderer Simulator
#   bash scripts/ios-dev.sh --device "iPhone von Marco"          physisches Geraet per Name
#   bash scripts/ios-dev.sh --device 00008030-001C38C41430802E   physisches Geraet per UDID
#
# Physische Geräte wechseln automatisch auf das signierte Geräteprofil.
# Neue native Module benötigen einen neuen Build statt nur Metro-Reload.

set -euo pipefail

PROFILE="development"
PROFILE_SET=false
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
    --profile) PROFILE="$2"; PROFILE_SET=true; shift 2 ;;
    -h | --help) sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 1 ;;
  esac
done

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK_DIR="$PROJECT_ROOT/temp"
mkdir -p "$WORK_DIR"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\033[31mFehler: %s\033[0m\n' "$1" >&2; exit 1; }

for cmd in eas xcrun curl node file; do
  command -v "$cmd" >/dev/null || die "$cmd nicht gefunden"
done

eas whoami >/dev/null 2>&1 || die "Nicht bei EAS angemeldet — 'eas login' ausfuehren"

# `devicectl` erkennt physische Geraete per Name oder UDID.
say "Zielgeraet ermitteln: $DEVICE_NAME"

TARGET_KIND="simulator"
PHYSICAL_ID=""
PHYSICAL_NAME=""
PHYSICAL_UDID=""

DEVICECTL_JSON="$(xcrun devicectl list devices --json-output - -q 2>/dev/null || true)"
if [ -n "$DEVICECTL_JSON" ]; then
  PHYSICAL_MATCH="$(echo "$DEVICECTL_JSON" | node -e '
    let d = "";
    process.stdin.on("data", (c) => (d += c)).on("end", () => {
      try {
        const q = process.argv[1];
        const devices = JSON.parse(d).result?.devices ?? [];
        const hit = devices.find(
          (dev) =>
            dev.deviceProperties?.name === q ||
            dev.hardwareProperties?.udid === q ||
            dev.identifier === q,
        );
        if (hit) {
          console.log(
            [hit.identifier, hit.deviceProperties?.name ?? "", hit.hardwareProperties?.udid ?? ""].join("\t"),
          );
        }
      } catch {
        // kein Treffer
      }
    });
  ' "$DEVICE_NAME")"

  if [ -n "$PHYSICAL_MATCH" ]; then
    TARGET_KIND="device"
    PHYSICAL_ID="$(echo "$PHYSICAL_MATCH" | cut -f1)"
    PHYSICAL_NAME="$(echo "$PHYSICAL_MATCH" | cut -f2)"
    PHYSICAL_UDID="$(echo "$PHYSICAL_MATCH" | cut -f3)"
    echo "  physisches Geraet erkannt: $PHYSICAL_NAME ($PHYSICAL_UDID)"
  fi
fi

if [ "$TARGET_KIND" = "device" ] && [ "$PROFILE_SET" = false ]; then
  PROFILE="development-device"
  echo "  Profil automatisch auf development-device umgestellt (physisches Geraet braucht ein geraete-signiertes Build)"
fi

build_field() {
  # $1 ist die Build-ID, $2 ein verschachtelter JSON-Pfad.
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
  say "Letzten fertigen iOS-Build fuer Profil $PROFILE suchen"
  BUILD_ID="$(eas build:list --platform ios --status finished --build-profile "$PROFILE" --limit 1 --json --non-interactive 2>/dev/null |
    node -e '
      let d = "";
      process.stdin.on("data", (c) => (d += c)).on("end", () => {
        try { console.log(JSON.parse(d)[0]?.id ?? ""); } catch { console.log(""); }
      });
    ')"
  [ -n "$BUILD_ID" ] || die "Kein fertiger Build fuer Profil $PROFILE gefunden — ohne --reuse-last starten"
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
if [ -d "$APP_DIR" ] && [ -n "$(find "$APP_DIR" -maxdepth 3 -name '*.app' -print -quit)" ]; then
  say "Build liegt schon lokal, Download uebersprungen"
else
  say "Artefakt herunterladen"
  rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR"
  ARCHIVE_PATH="$APP_DIR/build.archive"
  curl -# -L -o "$ARCHIVE_PATH" "$ARCHIVE_URL"

  # EAS-URLs verraten nicht, ob das Artefakt tar.gz oder IPA/zip ist.
  case "$(file -b --mime-type "$ARCHIVE_PATH")" in
    application/gzip | application/x-gzip) tar -xzf "$ARCHIVE_PATH" -C "$APP_DIR" ;;
    application/zip) unzip -q "$ARCHIVE_PATH" -d "$APP_DIR" ;;
    *) die "Unbekanntes Archivformat: $(file -b "$ARCHIVE_PATH")" ;;
  esac
  rm -f "$ARCHIVE_PATH"
fi

APP_PATH="$(find "$APP_DIR" -maxdepth 3 -name '*.app' -print -quit)"
[ -n "$APP_PATH" ] || die "Keine .app im Artefakt gefunden"
echo "  $APP_PATH ($(du -sh "$APP_PATH" | cut -f1))"

if [ "$TARGET_KIND" = "device" ]; then
  say "Geraet vorbereiten: $PHYSICAL_NAME"
  UDID="$PHYSICAL_ID"
  echo "  $PHYSICAL_UDID (devicectl: $UDID)"

  # Bei fehlenden DDI-Diensten liefert devicectl spaeter die konkrete Ursache.
  READY="$(echo "$DEVICECTL_JSON" | node -e '
    let d = "";
    process.stdin.on("data", (c) => (d += c)).on("end", () => {
      const devices = JSON.parse(d).result?.devices ?? [];
      const dev = devices.find((x) => x.identifier === process.argv[1]);
      console.log(dev?.deviceProperties?.ddiServicesAvailable ? "yes" : "no");
    });
  ' "$UDID")"
  if [ "$READY" != "yes" ]; then
    echo "  Warnung: Geraet aktuell nicht entwicklungsbereit (ddiServicesAvailable=false)." >&2
    echo "  Per Kabel verbinden, entsperren und ggf. 'Diesem Computer vertrauen' bestaetigen." >&2
  fi

  say "App installieren"
  # Verhindert Reste eines Builds mit anderer nativer Modulliste.
  xcrun devicectl device uninstall app --device "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun devicectl device install app --device "$UDID" "$APP_PATH"

  TARGET_LABEL="Geraet"
  TARGET_NAME="$PHYSICAL_NAME"
else
  say "Simulator vorbereiten: $DEVICE_NAME"

  UDID="$(xcrun simctl list devices available |
    grep -F "$DEVICE_NAME (" | head -1 | grep -oE '[0-9A-F-]{36}' || true)"

  if [ -z "$UDID" ]; then
    # Fehlende Simulatoren werden gegen die neueste Runtime angelegt.
    RUNTIME="$(xcrun simctl list runtimes | grep -oE 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+' | tail -1)"
    [ -n "$RUNTIME" ] || die "Keine iOS-Runtime installiert — 'xcodebuild -downloadPlatform iOS' ausfuehren"
    DEVICE_TYPE="com.apple.CoreSimulator.SimDeviceType.$(echo "$DEVICE_NAME" | tr ' ' '-')"
    echo "  lege $DEVICE_NAME an"
    UDID="$(xcrun simctl create "$DEVICE_NAME" "$DEVICE_TYPE" "$RUNTIME")"
  fi
  echo "  $UDID"

  # Frische Runtimes brauchen mehrere GB fuer dyld-Caches.
  FREE_GB="$(df -g /System/Volumes/Data | tail -1 | awk '{print $4}')"
  if [ "${FREE_GB:-99}" -lt 10 ]; then
    echo "  Warnung: nur ${FREE_GB} GB frei. Unter ~10 GB bootet der Simulator haeufig nicht durch." >&2
  fi

  xcrun simctl boot "$UDID" 2>/dev/null || true
  xcrun simctl bootstatus "$UDID" -b >/dev/null

  say "App installieren"
  # Verhindert Reste eines Builds mit anderer nativer Modulliste.
  xcrun simctl uninstall "$UDID" "$BUNDLE_ID" 2>/dev/null || true
  xcrun simctl install "$UDID" "$APP_PATH"
  open -a Simulator

  TARGET_LABEL="Simulator"
  TARGET_NAME="$DEVICE_NAME"
fi

launch_app() {
  if [ "$TARGET_KIND" = "device" ]; then
    xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID" >/dev/null
  else
    xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
  fi
}

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
    launch_app

    say "Fertig"
    echo "  Build:     $BUILD_ID"
    echo "  $TARGET_LABEL: $TARGET_NAME ($UDID)"
    echo "  Metro-Log: $WORK_DIR/metro.log"
  else
    say "App starten"
    launch_app

    if lsof -ti :8081 >/dev/null 2>&1; then
      say "Beende alten/hintergruendigen Metro-Prozess auf Port 8081..."
      lsof -ti :8081 | xargs kill -9 2>/dev/null || true
      sleep 1
    fi

    say "Fertig! Starte interaktiven Metro-Server..."
    echo "  Build:     $BUILD_ID"
    echo "  $TARGET_LABEL: $TARGET_NAME ($UDID)"
    echo "  [Tipp] Druecke 'r' im Terminal zum Neuladen oder 'd' fuer das Dev Menu."
    echo ""
    cd "$PROJECT_ROOT" && exec bun start
  fi
else
  say "App starten (ohne Metro)"
  launch_app

  say "Fertig"
  echo "  Build:     $BUILD_ID"
  echo "  $TARGET_LABEL: $TARGET_NAME ($UDID)"
fi
