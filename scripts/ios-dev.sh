#!/usr/bin/env bash
#
# ios-dev.sh — Universeller iOS Build & Dev Controller für Haushaltsapp
#
# PROFILE:
#   development          Dev Client für iOS Simulator (Standard)
#   development-device   Dev Client für physisches iPhone
#   preview-testflight   TestFlight Release Build (.xcarchive für Organizer)
#   production           App Store Production Release Build
#
# VERWENDUNG:
#   bash scripts/ios-dev.sh                           Interaktives Menü starten
#   bash scripts/ios-dev.sh --profile development     Dev Client (lokal) bauen, installieren & Metro starten
#   bash scripts/ios-dev.sh --reuse-last              Letzten Dev-Build wiederverwenden & Metro starten
#   bash scripts/ios-dev.sh --profile preview-testflight TestFlight Release Build erstellen
#   bash scripts/ios-dev.sh --profile production      Production Release Build erstellen
#   bash scripts/ios-dev.sh --cloud                   Cloud-Build erzwingen (statt --local)
#   bash scripts/ios-dev.sh --clean                   DerivedData & Build-Caches bereinigen
#   bash scripts/ios-dev.sh --restart-metro           Metro-Server neustarten
#   bash scripts/ios-dev.sh --stop-metro              Metro-Server stoppen
#
set -euo pipefail

say() { printf '\n\033[1;34m==>\033[0m \033[1m%s\033[0m\n' "$1"; }
ok()  { printf '\033[1;32m==> OK:\033[0m %s\n' "$1"; }
warn(){ printf '\033[1;33m==> Warnung:\033[0m %s\n' "$1"; }
die() { printf '\n\033[1;31mFehler:\033[0m %s\n' "$1" >&2; exit 1; }

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ------------------------------------------------------------- Externe Pfade & Caches
# Externe Festplatte hat Priorität für große Caches & Archive
if [ -d "/Volumes/Programme" ]; then
  BASE_CACHE_DIR="/Volumes/Programme/dev-caches/fam-builds"
  BASE_ARCHIVE_DIR="/Volumes/Programme/xcode_archive"
  DERIVED_DATA_DIR="/Volumes/Programme/XcodeDerivedData/fam"
else
  BASE_CACHE_DIR="$PROJECT_ROOT/temp/dev-caches"
  BASE_ARCHIVE_DIR="$PROJECT_ROOT/temp/xcode_archive"
  DERIVED_DATA_DIR="$PROJECT_ROOT/temp/DerivedData"
fi

TODAY="$(date +%Y-%m-%d)"
ARCHIVE_DAY_DIR="$BASE_ARCHIVE_DIR/$TODAY"
LOG_DIR="$PROJECT_ROOT/temp"

mkdir -p "$BASE_CACHE_DIR" "$ARCHIVE_DAY_DIR" "$LOG_DIR"

# ------------------------------------------------------------- Standard-Konfiguration
PROFILE=""
PROFILE_EXPLICIT=false
BUILD_MODE="local"       # "local" oder "cloud"
DEVICE_NAME="iPhone 17 Pro"
REUSE_LAST=false
APPROVE_REBUILD=false
START_METRO=true
BACKGROUND_METRO=false
RESTART_METRO=false
STOP_METRO=false
RESTART_APP=false
ONLY_ACTIONS=false
CLEAN=false
BUNDLE_ID="com.goldjunge91.fam1"
APP_JSON="$PROJECT_ROOT/app.json"
INFO_PLIST="$PROJECT_ROOT/ios/fam/Info.plist"

# ------------------------------------------------------------- Hilfsfunktionen
stop_metro_if_running() {
  if lsof -ti :8081 >/dev/null 2>&1; then
    say "Stoppe Metro-Server auf Port 8081..."
    lsof -ti :8081 | xargs kill -9 2>/dev/null || true
    sleep 1
    ok "Metro-Server gestoppt"
  else
    echo "  Metro läuft aktuell nicht."
  fi
}

start_metro() {
  say "Metro-Server starten"
  if lsof -ti :8081 >/dev/null 2>&1; then
    echo "  Port 8081 belegt — bestehender Metro-Server wird verwendet"
  else
    if [ "$BACKGROUND_METRO" = true ]; then
      (cd "$PROJECT_ROOT" && bun start >"$LOG_DIR/metro.log" 2>&1 &)
      until grep -qE "Waiting on|exp://" "$LOG_DIR/metro.log" 2>/dev/null; do sleep 2; done
      ok "Metro im Hintergrund bereit (Log: $LOG_DIR/metro.log)"
    else
      say "Starte interaktiven Metro-Server..."
      echo "  [Tipp] Drücke 'r' im Terminal zum Neuladen oder 'd' für das Dev Menu."
      echo ""
      cd "$PROJECT_ROOT" && exec bun start
    fi
  fi
}

clean_caches() {
  say "Bereinige DerivedData und temporäre Build-Caches..."
  rm -rf "$DERIVED_DATA_DIR" "$PROJECT_ROOT/ios/build" "$HOME/Library/Developer/Xcode/DerivedData/fam-*" 2>/dev/null || true
  rm -rf /Volumes/Programme/Xcode/DerivedData/fam-* 2>/dev/null || true
  ok "Build-Caches bereinigt"
}

validate_env_for_profile() {
  local prof="$1"
  local env_file=""

  case "$prof" in
    development|development-device)
      env_file="$PROJECT_ROOT/.env.development.local"
      [ -f "$env_file" ] || env_file="$PROJECT_ROOT/.env.development.local"
      ;;
    preview|preview-testflight)
      env_file="$PROJECT_ROOT/.env.preview"
      ;;
    production)
      env_file="$PROJECT_ROOT/.env.production"
      ;;
  esac

  if [ -n "$env_file" ] && [ -f "$env_file" ]; then
    say "Prüfe Umgebungsvariablen in $(basename "$env_file")..."
    node -e '
      const fs = require("fs");
      const envPath = process.argv[1];
      const profile = process.argv[2];
      const content = fs.readFileSync(envPath, "utf8");
      const env = {};
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
        }
      }

      if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_KEY) {
        console.error("Fehler: EXPO_PUBLIC_SUPABASE_URL oder EXPO_PUBLIC_SUPABASE_KEY fehlt in " + envPath);
        process.exit(1);
      }

      if (profile.includes("testflight") || profile === "production") {
        const iosKey = env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "";
        if (!iosKey.startsWith("appl_")) {
          console.error("Fehler: In " + profile + "-Builds muss EXPO_PUBLIC_REVENUECAT_IOS_API_KEY mit appl_ beginnen (aktuell: " + iosKey.slice(0, 8) + "...)");
          process.exit(1);
        }
        const forcePrem = (env.EXPO_PUBLIC_FORCE_PREMIUM || "").toLowerCase();
        if (forcePrem === "true" || forcePrem === "1") {
          console.error("Fehler: EXPO_PUBLIC_FORCE_PREMIUM ist auf true gesetzt!");
          process.exit(1);
        }
      }
    ' "$env_file" "$prof" || die "Validierung für $env_file fehlgeschlagen"
    ok "Umgebungsvariablen in $(basename "$env_file") sind gültig"
  fi
}

build_field_json() {
  eas build:view "$1" --json 2>/dev/null |
    node -e '
      let d = "";
      process.stdin.on("data", (c) => (d += c)).on("end", () => {
        try {
          const val = process.argv[1].split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), JSON.parse(d));
          console.log(val ?? "");
        } catch { console.log(""); }
      });
    ' "$2"
}

DEFAULT_PHYSICAL_UDID="00008030-001C38C41430802E"
DEVICE_EXPLICIT=false

# ------------------------------------------------------------- Target Device Erkennung
detect_target_device() {
  TARGET_KIND="simulator"
  PHYSICAL_ID=""
  PHYSICAL_NAME=""
  PHYSICAL_UDID=""

  local search_query="$DEVICE_NAME"
  if [ "$PROFILE" = "development-device" ] && [ "$DEVICE_EXPLICIT" = false ]; then
    search_query="$DEFAULT_PHYSICAL_UDID"
  fi

  DEVICECTL_JSON="$(xcrun devicectl list devices --json-output - -q 2>/dev/null || true)"
  if [ -n "$DEVICECTL_JSON" ]; then
    PHYSICAL_MATCH="$(echo "$DEVICECTL_JSON" | node -e '
      let d = "";
      process.stdin.on("data", (c) => (d += c)).on("end", () => {
        try {
          const q = process.argv[1];
          const prof = process.argv[2];
          const devices = JSON.parse(d).result?.devices ?? [];
          let hit = devices.find(
            (dev) =>
              dev.deviceProperties?.name === q ||
              dev.hardwareProperties?.udid === q ||
              dev.identifier === q,
          );
          if (!hit && prof === "development-device") {
            // Fallback auf das erste verfügbare physische Gerät
            hit = devices[0];
          }
          if (hit) {
            console.log([hit.identifier, hit.deviceProperties?.name ?? "", hit.hardwareProperties?.udid ?? ""].join("\t"));
          }
        } catch {}
      });
    ' "$search_query" "$PROFILE")"

    if [ -n "$PHYSICAL_MATCH" ]; then
      TARGET_KIND="device"
      PHYSICAL_ID="$(echo "$PHYSICAL_MATCH" | cut -f1)"
      PHYSICAL_NAME="$(echo "$PHYSICAL_MATCH" | cut -f2)"
      PHYSICAL_UDID="$(echo "$PHYSICAL_MATCH" | cut -f3)"
      ok "Physisches Gerät erkannt: $PHYSICAL_NAME ($PHYSICAL_UDID)"
    fi
  fi

  if [ "$TARGET_KIND" = "device" ] && [ "$PROFILE_EXPLICIT" = false ]; then
    PROFILE="development-device"
  fi

  if [ "$PROFILE" = "development-device" ] && [ "$TARGET_KIND" != "device" ]; then
    die "Kein physisches iPhone gefunden. Bitte verbinde dein iPhone ($DEFAULT_PHYSICAL_UDID) per USB/WLAN."
  fi
}

# ------------------------------------------------------------- Release Archive Build (TestFlight / Store)
run_release_archive() {
  local prof="$1"
  [ "$APPROVE_REBUILD" = true ] || die "Release-Build blockiert. Bitte explizit --approve-rebuild angeben."
  validate_env_for_profile "$prof"

  say "Erstelle iOS Release-Archiv für Profil: $prof"
  echo "  Zielordner: $ARCHIVE_DAY_DIR"

  CURRENT_VERSION="$(node -e 'console.log(require("./app.json").expo.version || "1.0.0")')"
  CURRENT_BUILD="$(node -e 'console.log(require("./app.json").expo.ios?.buildNumber || "1")')"
  NEW_BUILD="$((CURRENT_BUILD + 1))"

  # app.json & Info.plist Version aktualisieren
  node -e '
    const fs = require("fs");
    const pkg = require("./app.json");
    pkg.expo.ios = pkg.expo.ios || {};
    pkg.expo.ios.buildNumber = process.argv[1];
    fs.writeFileSync("./app.json", JSON.stringify(pkg, null, 2) + "\n");
  ' "$NEW_BUILD"

  if [ -f "$INFO_PLIST" ]; then
    node -e '
      const fs = require("fs");
      let content = fs.readFileSync("./ios/fam/Info.plist", "utf8");
      content = content.replace(
        /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
        `$1${process.argv[1]}$2`
      );
      fs.writeFileSync("./ios/fam/Info.plist", content);
    ' "$NEW_BUILD"
  fi

  say "Build-Nummer hochgezählt: $NEW_BUILD (App-Version: $CURRENT_VERSION)"

  say "Synchronisiere CocoaPods..."
  (cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install) || (cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --repo-update)

  ARCHIVE_PATH="$ARCHIVE_DAY_DIR/fam1_b${NEW_BUILD}.xcarchive"
  say "Starte Xcode Archivierung..."
  START_TIME=$(date +%s)

  export SENTRY_ALLOW_FAILURE=true

  xcodebuild archive \
    -workspace "$PROJECT_ROOT/ios/fam.xcworkspace" \
    -scheme fam \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE_PATH" \
    -derivedDataPath "$DERIVED_DATA_DIR" \
    -allowProvisioningUpdates || die "Archivierung fehlgeschlagen"

  DURATION=$(( $(date +%s) - START_TIME ))
  ok "Archivierung erfolgreich abgeschlossen nach $((DURATION / 60))m $((DURATION % 60))s"

  say "Öffne Archiv im Xcode Organizer..."
  open "$ARCHIVE_PATH"

  printf "\n\033[1;32m═══════════════════════════════════════════════════════════════════════\033[0m\n"
  printf "\033[1;32m  🎉 BUILD ERFOLGREICH: fam %s (%s)\033[0m\n" "$CURRENT_VERSION" "$NEW_BUILD"
  printf "  Profil:  %s\n" "$prof"
  printf "  Archiv:  %s\n" "$ARCHIVE_PATH"
  printf "  Nächster Schritt im Xcode Organizer:\n"
  printf "  1. Klicke rechts auf 'Distribute App'\n"
  if [ "$prof" = "preview-testflight" ]; then
    printf "  2. Wähle 'TestFlight & App Store' -> 'Distribute'\n"
  else
    printf "  2. Wähle 'App Store Connect' -> 'Upload'\n"
  fi
  printf "\033[1;32m═══════════════════════════════════════════════════════════════════════\033[0m\n\n"
}

# ------------------------------------------------------------- Dev Client Build & Run
run_dev_client() {
  validate_env_for_profile "$PROFILE"
  detect_target_device

  if [ "$REUSE_LAST" = false ] && { [ "$TARGET_KIND" = "device" ] || [ "$BUILD_MODE" = "cloud" ]; }; then
    [ "$APPROVE_REBUILD" = true ] || die "Dieser Pfad kompiliert nativ. Bitte --approve-rebuild angeben oder --reuse-last verwenden."
  fi

  if [ "$REUSE_LAST" = true ]; then
    local locked_target="ios-development-simulator"
    if [ "$TARGET_KIND" = "device" ]; then
      locked_target="ios-development-device"
    fi

    say "Starte zuletzt registriertes Native-Artefakt ($locked_target)..."
    # --reuse-last ist absichtlich kein EAS-Latest-Fallback: ausschließlich der
    # versionierte Lock darf ein Binary zum Start freigeben.
    if [ "$TARGET_KIND" = "device" ]; then
      bun run native:run -- --target "$locked_target" --device "$PHYSICAL_ID"
    else
      bun run native:run -- --target "$locked_target" --device "$DEVICE_NAME"
    fi
    [ "$START_METRO" = true ] && start_metro
    return 0
  fi

  if [ "$BUILD_MODE" = "local" ]; then
    say "Starte LOKALEN Build (0 EAS Cloud-Credits, Xcode auf diesem Mac)..."
    if [ "$TARGET_KIND" = "simulator" ]; then
      if [ "$APPROVE_REBUILD" = true ]; then
        bun run native:rebuild -- --target ios-development-simulator --approve-rebuild
      else
        bun run ios
      fi
      return 0
    fi

    say "Baue Dev Client lokal für physisches Gerät via den Native-Guard..."
    bun run native:rebuild -- --target ios-development-device --approve-rebuild
    APP_PATH="$PROJECT_ROOT/native-artifacts/ios-development-device/fam.ipa"
  else
    say "Starte EAS Cloud-Build (Profil: $PROFILE)..."
    BUILD_OUTPUT="$(eas build --profile "$PROFILE" --platform ios --non-interactive --no-wait 2>&1)"
    BUILD_ID="$(echo "$BUILD_OUTPUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | tail -1)"
    [ -n "$BUILD_ID" ] || die "Cloud-Build konnte nicht gestartet werden: $BUILD_OUTPUT"

    say "Warte auf Cloud-Build $BUILD_ID..."
    START_TS=$(date +%s)
    while true; do
      STATUS="$(build_field_json "$BUILD_ID" status)"
      case "$STATUS" in
        FINISHED | finished) echo "  fertig nach $(( ($(date +%s) - START_TS) / 60 )) min"; break ;;
        ERRORED | errored | CANCELED | canceled)
          die "Build $STATUS — Logs: https://expo.dev/accounts/goldjunge91/projects/fam/builds/$BUILD_ID" ;;
        *) printf '\r  Status: %-14s (%s min)' "${STATUS:-unbekannt}" "$(( ($(date +%s) - START_TS) / 60 ))" ;;
      esac
      sleep 30
    done

    ARCHIVE_URL="$(build_field_json "$BUILD_ID" artifacts.applicationArchiveUrl)"
    APP_DIR="$BASE_CACHE_DIR/$BUILD_ID"
    mkdir -p "$APP_DIR"
    curl -# -L -o "$APP_DIR/build.archive" "$ARCHIVE_URL"
    case "$(file -b --mime-type "$APP_DIR/build.archive")" in
      application/gzip | application/x-gzip) tar -xzf "$APP_DIR/build.archive" -C "$APP_DIR" ;;
      application/zip) unzip -q "$APP_DIR/build.archive" -d "$APP_DIR" ;;
    esac
    rm -f "$APP_DIR/build.archive"
    APP_PATH="$(find "$APP_DIR" -maxdepth 3 -name '*.app' -print -quit)"
  fi

  # ------------------------------------------------------------- Installation & Simulator/Device Start
  if [ "$TARGET_KIND" = "device" ]; then
    say "Installiere auf physischem Gerät: $PHYSICAL_NAME"
    xcrun devicectl device uninstall app --device "$PHYSICAL_ID" "$BUNDLE_ID" >/dev/null 2>&1 || true
    xcrun devicectl device install app --device "$PHYSICAL_ID" "$APP_PATH"
    xcrun devicectl device process launch --device "$PHYSICAL_ID" "$BUNDLE_ID" >/dev/null
  else
    say "Bereite iOS Simulator vor ($DEVICE_NAME)..."
    UDID="$(xcrun simctl list devices available | grep -F "$DEVICE_NAME (" | head -1 | grep -oE '[0-9A-F-]{36}' || true)"
    if [ -z "$UDID" ]; then
      RUNTIME="$(xcrun simctl list runtimes | grep -oE 'com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+' | tail -1)"
      DEVICE_TYPE="com.apple.CoreSimulator.SimDeviceType.$(echo "$DEVICE_NAME" | tr ' ' '-')"
      UDID="$(xcrun simctl create "$DEVICE_NAME" "$DEVICE_TYPE" "$RUNTIME")"
    fi

    xcrun simctl boot "$UDID" 2>/dev/null || true
    xcrun simctl bootstatus "$UDID" -b >/dev/null
    open -a Simulator

    if [ -n "$APP_PATH" ]; then
      say "Installiere App im Simulator ($APP_PATH)..."
      xcrun simctl uninstall "$UDID" "$BUNDLE_ID" 2>/dev/null || true
      xcrun simctl install "$UDID" "$APP_PATH"
      xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
    fi
  fi

  if [ "$START_METRO" = true ]; then
    start_metro
  fi
}

# ------------------------------------------------------------- CLI Arguments Parsing
while [ $# -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="$2"; PROFILE_EXPLICIT=true; shift 2 ;;
    --local) BUILD_MODE="local"; shift ;;
    --cloud) BUILD_MODE="cloud"; shift ;;
    --reuse-last) REUSE_LAST=true; shift ;;
    --approve-rebuild) APPROVE_REBUILD=true; shift ;;
    --device) DEVICE_NAME="$2"; DEVICE_EXPLICIT=true; shift 2 ;;
    --clean) CLEAN=true; ONLY_ACTIONS=true; shift ;;
    --no-metro) START_METRO=false; shift ;;
    --background) BACKGROUND_METRO=true; shift ;;
    --restart-metro) RESTART_METRO=true; ONLY_ACTIONS=true; shift ;;
    --stop-metro) STOP_METRO=true; START_METRO=false; ONLY_ACTIONS=true; shift ;;
    --relaunch|--restart-app) RESTART_APP=true; ONLY_ACTIONS=true; shift ;;
    -h|--help)
      echo ""
      echo "ios-dev.sh — Universeller iOS Build & Dev Controller für Haushaltsapp"
      echo ""
      echo "PROFILE:"
      echo "  development          Dev Client für iOS Simulator (Standard)"
      echo "  development-device   Dev Client für physisches iPhone ($DEFAULT_PHYSICAL_UDID)"
      echo "  preview-testflight   TestFlight Release Build (.xcarchive für Organizer)"
      echo "  production           App Store Production Release Build"
      echo ""
      echo "VERWENDUNG:"
      echo "  bash scripts/ios-dev.sh                           Interaktives Menü starten"
      echo "  bash scripts/ios-dev.sh --profile development     Dev Client (lokal) bauen, installieren & Metro starten"
      echo "  bash scripts/ios-dev.sh --reuse-last              Letzten Dev-Build wiederverwenden & Metro starten"
      echo "  bash scripts/ios-dev.sh --device <UDID/Name>      Gezieltes Gerät / Simulator angeben"
      echo "  bash scripts/ios-dev.sh --profile preview-testflight TestFlight Release Build erstellen"
      echo "  bash scripts/ios-dev.sh --profile production      Production Release Build erstellen"
      echo "  bash scripts/ios-dev.sh --cloud                   Cloud-Build erzwingen (statt --local)"
      echo "  bash scripts/ios-dev.sh --approve-rebuild         Native Kompilierung explizit erlauben"
      echo "  bash scripts/ios-dev.sh --clean                   DerivedData & Build-Caches bereinigen"
      echo "  bash scripts/ios-dev.sh --restart-metro           Metro-Server neustarten"
      echo "  bash scripts/ios-dev.sh --stop-metro              Metro-Server stoppen"
      echo ""
      exit 0
      ;;
    *) die "Unbekannte Option: $1 (Hilfe mit --help)" ;;
  esac
done

# Wenn direkte Aktionen gewählt wurden
if [ "$CLEAN" = true ]; then clean_caches; exit 0; fi
if [ "$STOP_METRO" = true ]; then stop_metro_if_running; exit 0; fi
if [ "$RESTART_METRO" = true ]; then stop_metro_if_running; start_metro; exit 0; fi

# Wenn ein Profil direkt per Flag übergeben wurde
if [ -n "$PROFILE" ]; then
  case "$PROFILE" in
    preview-testflight|preview) run_release_archive "preview-testflight" ;;
    production) run_release_archive "production" ;;
    development|development-device) run_dev_client ;;
    *) die "Unbekanntes Profil: $PROFILE" ;;
  esac
  exit 0
fi

# ------------------------------------------------------------- Interaktives Menü (Standard ohne Flags)
while true; do
  echo ""
  echo "======================================================"
  echo "   📱 iOS Build & Dev Controller (fam)"
  echo "======================================================"
  echo "  1) 🛠️  Dev Client (Simulator) — Lokal bauen & starten"
  echo "  2) 📱  Dev Client (Physisches Gerät) — Lokal bauen"
  echo "  3) 🔄  Letzten Dev-Build wiederverwenden (Schnellstart)"
  echo "  4) ✈️  TestFlight Release Build (preview-testflight)"
  echo "  5) 🚀  Production App Store Build (production)"
  echo "  6) ♻️  Metro-Server neustarten"
  echo "  7) 🛑  Metro-Server stoppen"
  echo "  8) 🧹  Build-Caches & DerivedData bereinigen"
  echo "  q) Beenden"
  echo "======================================================"
  read -rp "Option wählen [1-8 / q]: " choice
  echo ""

  case "$choice" in
    1) PROFILE="development"; BUILD_MODE="local"; REUSE_LAST=false; run_dev_client; break ;;
    2) PROFILE="development-device"; BUILD_MODE="local"; REUSE_LAST=false; run_dev_client; break ;;
    3) PROFILE="development"; REUSE_LAST=true; run_dev_client; break ;;
    4) run_release_archive "preview-testflight"; break ;;
    5) run_release_archive "production"; break ;;
    6) stop_metro_if_running; start_metro; break ;;
    7) stop_metro_if_running ;;
    8) clean_caches ;;
    q|Q) echo "Tschüss!"; exit 0 ;;
    *) echo "Ungültige Auswahl, bitte erneut versuchen." ;;
  esac
done
