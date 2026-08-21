#!/usr/bin/env bash
#
# build-testflight.sh — All-in-One iOS Release Archive Build für TestFlight.
#
#   bun run ios:testflight                       Standard: zählt buildNumber automatisch hoch,
#                                                installiert Pods, baut Release-Archiv & öffnet Organizer
#   bun run ios:testflight -- --no-bump          Kein Hochzählen der Build-Nummer
#   bun run ios:testflight -- --build-number 10  Spezifische Build-Nummer setzen
#   bun run ios:testflight -- --app-version 1.1.0 App-Version (CFBundleShortVersionString) anpassen
#   bun run ios:testflight -- --skip-pods        Pod install überspringen (schnellerer Rebuild)
#
set -euo pipefail

say() { printf '\n\033[1;34m==>\033[0m \033[1m%s\033[0m\n' "$1"; }
ok()  { printf '\033[1;32m==> OK: %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31mFehler:\033[0m %s\n' "$1" >&2; exit 1; }

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

APP_JSON="$PROJECT_ROOT/app.json"
INFO_PLIST="$PROJECT_ROOT/ios/fam/Info.plist"

[ -f "$APP_JSON" ] || die "app.json nicht gefunden unter $APP_JSON"
[ -f "$INFO_PLIST" ] || die "Info.plist nicht gefunden unter $INFO_PLIST"

# ------------------------------------------------------------- CLI Arguments
BUMP_BUILD=true
EXPLICIT_BUILD_NUMBER=""
EXPLICIT_APP_VERSION=""
SKIP_PODS=false

while [ $# -gt 0 ]; do
  case "$1" in
    --no-bump)
      BUMP_BUILD=false
      shift
      ;;
    --build-number)
      EXPLICIT_BUILD_NUMBER="$2"
      BUMP_BUILD=false
      shift 2
      ;;
    --app-version)
      EXPLICIT_APP_VERSION="$2"
      shift 2
      ;;
    --skip-pods)
      SKIP_PODS=true
      shift
      ;;
    -h | --help)
      sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      die "Unbekannte Option: $1 (Hilfe mit --help)"
      ;;
  esac
done

# ------------------------------------------------------------- Voraussetzungen
for cmd in node xcodebuild pod; do
  command -v "$cmd" >/dev/null || die "Benötigtes Tool '$cmd' nicht gefunden."
done

# ------------------------------------------------------------- Version Management
CURRENT_VERSION="$(node -e 'console.log(require("./app.json").expo.version || "1.0.0")')"
CURRENT_BUILD="$(node -e 'console.log(require("./app.json").expo.ios?.buildNumber || "1")')"

NEW_VERSION="${EXPLICIT_APP_VERSION:-$CURRENT_VERSION}"

if [ -n "$EXPLICIT_BUILD_NUMBER" ]; then
  NEW_BUILD="$EXPLICIT_BUILD_NUMBER"
elif [ "$BUMP_BUILD" = true ]; then
  NEW_BUILD="$((CURRENT_BUILD + 1))"
else
  NEW_BUILD="$CURRENT_BUILD"
fi

say "App-Version: $NEW_VERSION | Build-Nummer: $NEW_BUILD (vorher: $CURRENT_VERSION / $CURRENT_BUILD)"

# Aktualisiere app.json
node -e '
  const fs = require("fs");
  const pkg = require("./app.json");
  pkg.expo.version = process.argv[1];
  pkg.expo.ios = pkg.expo.ios || {};
  pkg.expo.ios.buildNumber = process.argv[2];
  fs.writeFileSync("./app.json", JSON.stringify(pkg, null, 2) + "\n");
' "$NEW_VERSION" "$NEW_BUILD"

# Aktualisiere Info.plist
node -e '
  const fs = require("fs");
  let content = fs.readFileSync("./ios/fam/Info.plist", "utf8");
  content = content.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${process.argv[1]}$2`
  );
  content = content.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${process.argv[2]}$2`
  );
  fs.writeFileSync("./ios/fam/Info.plist", content);
' "$NEW_VERSION" "$NEW_BUILD"

ok "Versionsnummern in app.json und Info.plist aktualisiert"

# ------------------------------------------------------------- CocoaPods
if [ "$SKIP_PODS" = false ]; then
  say "CocoaPods-Abhängigkeiten synchronisieren..."
  if ! (cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install); then
    say "pod install fehlgeschlagen — versuche mit --repo-update..."
    (cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --repo-update) || die "pod install fehlgeschlagen"
  fi
  ok "Pods installiert"
else
  say "CocoaPods-Installation übersprungen (--skip-pods)"
fi

# ------------------------------------------------------------- Archiv-Pfad vorbereiten
TODAY="$(date +%Y-%m-%d)"
BASE_ARCHIVE_DIR="/Volumes/Programme/xcode_archive/$TODAY"

if [ ! -d "/Volumes/Programme" ]; then
  # Fallback auf lokalen Ordner falls SSD nicht eingehängt ist
  BASE_ARCHIVE_DIR="$PROJECT_ROOT/temp/xcode_archive/$TODAY"
fi

mkdir -p "$BASE_ARCHIVE_DIR"
ARCHIVE_PATH="$BASE_ARCHIVE_DIR/fam1_b${NEW_BUILD}.xcarchive"

say "Release-Archiv wird erstellt unter:"
echo "  $ARCHIVE_PATH"

# ------------------------------------------------------------- xcodebuild Archive
say "Starte xcodebuild archive (Konfiguration: Release)..."
START_TIME=$(date +%s)

xcodebuild archive \
  -workspace "$PROJECT_ROOT/ios/fam.xcworkspace" \
  -scheme fam \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates || die "Kompilierung oder Archivierung fehlgeschlagen"

DURATION=$(( $(date +%s) - START_TIME ))
ok "Archivierung erfolgreich abgeschlossen nach $((DURATION / 60))m $((DURATION % 60))s"

# ------------------------------------------------------------- Organizer öffnen
say "Öffne Archiv im Xcode Organizer für den TestFlight-Upload..."
open "$ARCHIVE_PATH"

printf "\n\033[1;32m═══════════════════════════════════════════════════════════════════════\033[0m\n"
printf "\033[1;32m  🎉 BUILD ERFOLGREICH: fam %s (%s)\033[0m\n" "$NEW_VERSION" "$NEW_BUILD"
printf "  Archiv:  %s\n" "$ARCHIVE_PATH"
printf "  Nächster Schritt im Xcode Organizer:\n"
printf "  1. Klicke rechts auf 'Distribute App'\n"
printf "  2. Wähle 'TestFlight & App Store' -> 'Distribute'\n"
printf "\033[1;32m═══════════════════════════════════════════════════════════════════════\033[0m\n\n"
