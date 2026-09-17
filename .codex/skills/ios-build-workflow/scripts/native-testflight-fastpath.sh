#!/usr/bin/env bash

# Build a new signed TestFlight IPA from the existing native checkout. This is
# deliberately not a prebuild/rebuild path: the native fingerprint and the
# registered IPA are checked by the caller, while this script reuses Pods,
# ccache, and the matching Release DerivedData.

set -euo pipefail

find_project_root() {
  local candidate="$1"
  while [ "$candidate" != "/" ]; do
    if [ -f "$candidate/native-build-lock.json" ] && [ -f "$candidate/package.json" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
    candidate="$(dirname "$candidate")"
  done
  return 1
}

PROJECT_ROOT="${IOS_BUILD_WORKFLOW_PROJECT_ROOT:-${CLAUDE_PROJECT_DIR:-$PWD}}"
if ! PROJECT_ROOT="$(find_project_root "$PROJECT_ROOT")"; then
  PROJECT_ROOT="$(find_project_root "$(cd "$(dirname "$0")" && pwd)")" || {
    printf '[ios-build] Project root with native-build-lock.json was not found.\n' >&2
    exit 78
  }
fi
STORAGE_ROOT="${IOS_BUILD_WORKFLOW_STORAGE_ROOT:-/Volumes/Programme/fam-build-workflow}"
ARTIFACT_ROOT="${IOS_BUILD_WORKFLOW_ARTIFACT_ROOT:-$STORAGE_ROOT/native-artifacts}"
ARTIFACT="$ARTIFACT_ROOT/ios-preview-testflight/fam.ipa"
FALLBACK_STATUS=42
CONFIGURATION_ERROR_STATUS=43

fallback() {
  printf '[ios-build] Fastpath unavailable: %s\n' "$1" >&2
  exit "$FALLBACK_STATUS"
}

configuration_error() {
  printf '[ios-build] Fastpath configuration error: %s\n' "$1" >&2
  exit "$CONFIGURATION_ERROR_STATUS"
}

if [ ! -d "/Volumes/Programme" ]; then
  configuration_error 'externe Build-Platte /Volumes/Programme ist nicht eingehängt; lokaler Fallback ist verboten'
fi
for workflow_path in "$STORAGE_ROOT" "$ARTIFACT_ROOT" "${IOS_BUILD_WORKFLOW_ARCHIVE_ROOT:-$STORAGE_ROOT/xcode_archive}"; do
  case "$workflow_path" in
    /Volumes/Programme/*) ;;
    *) configuration_error "Build-Daten müssen unter /Volumes/Programme liegen: $workflow_path" ;;
  esac
done
export TMPDIR="${IOS_BUILD_WORKFLOW_TMPDIR:-$STORAGE_ROOT/tmp}"
case "$TMPDIR" in
  /Volumes/Programme/*) ;;
  *) configuration_error "temporäre Build-Daten müssen unter /Volumes/Programme liegen: $TMPDIR" ;;
esac
mkdir -p "$TMPDIR"

for command_name in bunx node plutil unzip xcodebuild; do
  command -v "$command_name" >/dev/null 2>&1 || fallback "missing $command_name"
done

if [ -n "${CCACHE_BINARY:-}" ] && [ -x "$CCACHE_BINARY" ]; then
  CCACHE_BIN="$CCACHE_BINARY"
elif [ -x /opt/homebrew/bin/ccache ]; then
  CCACHE_BIN=/opt/homebrew/bin/ccache
elif command -v ccache >/dev/null 2>&1; then
  CCACHE_BIN="$(command -v ccache)"
else
  fallback 'ccache is not installed'
fi

CCACHE_DIR_VALUE="${CCACHE_DIR:-}"
if [ -z "$CCACHE_DIR_VALUE" ] && [ -f "$PROJECT_ROOT/ios/.ccache-wrapper-clang.sh" ]; then
  CCACHE_DIR_VALUE="$(sed -n 's/^export CCACHE_DIR="\([^"]*\)"/\1/p' "$PROJECT_ROOT/ios/.ccache-wrapper-clang.sh")"
fi
if [ -z "$CCACHE_DIR_VALUE" ]; then
  CCACHE_DIR_VALUE="$($CCACHE_BIN --get-config cache_dir 2>/dev/null || true)"
fi
[ -n "$CCACHE_DIR_VALUE" ] || fallback 'ccache cache_dir is not configured'
[ -d "$CCACHE_DIR_VALUE" ] || fallback "ccache cache_dir is missing: $CCACHE_DIR_VALUE"
case "$CCACHE_DIR_VALUE" in
  /Volumes/Programme/*) ;;
  *) configuration_error "ccache cache_dir liegt nicht auf /Volumes/Programme: $CCACHE_DIR_VALUE" ;;
esac
"$CCACHE_BIN" -s >/dev/null 2>&1 || fallback 'ccache statistics are unavailable'

if [ ! -d "$PROJECT_ROOT/ios/Pods" ] || [ ! -f "$PROJECT_ROOT/ios/Podfile.lock" ]; then
  fallback 'CocoaPods checkout is incomplete'
fi
if [ ! -f "$PROJECT_ROOT/ios/Pods/Manifest.lock" ]; then
  fallback 'CocoaPods manifest is missing'
fi
if ! cmp -s \
  "$PROJECT_ROOT/ios/Podfile.lock" "$PROJECT_ROOT/ios/Pods/Manifest.lock"; then
  fallback 'Podfile.lock and Pods/Manifest.lock do not match'
fi
if [ ! -f "$PROJECT_ROOT/ios/fam.xcworkspace/contents.xcworkspacedata" ]; then
  fallback 'iOS workspace is missing'
fi

DERIVED_DATA_PATH="${IOS_DERIVED_DATA_PATH:-}"
if [ -n "$DERIVED_DATA_PATH" ] && [ ! -d "$DERIVED_DATA_PATH" ]; then
  fallback "configured DerivedData path is missing: $DERIVED_DATA_PATH"
fi
if [ -z "$DERIVED_DATA_PATH" ]; then
  for candidate in \
    /Volumes/Programme/Xcode/DerivedData/fam-*; do
    [ -d "$candidate" ] || continue
    if [ -d "$candidate/Build/Intermediates.noindex/ArchiveIntermediates/fam/BuildProductsPath/Release-iphoneos" ]; then
      DERIVED_DATA_PATH="$candidate"
      break
    fi
  done
fi
[ -n "$DERIVED_DATA_PATH" ] || fallback 'no warm Release DerivedData found'
case "$DERIVED_DATA_PATH" in
  /Volumes/Programme/*) ;;
  *) configuration_error "DerivedData liegt nicht auf /Volumes/Programme: $DERIVED_DATA_PATH" ;;
esac

# Xcode can be configured globally to use custom build locations. In that
# mode -derivedDataPath does not necessarily control OBJROOT/SYMROOT, which
# would send this fastpath back into a shared build directory. Keep the
# effective build graph inside the selected DerivedData tree instead.
BUILD_INTERMEDIATES="$DERIVED_DATA_PATH/Build/Intermediates.noindex"
BUILD_PRODUCTS="$DERIVED_DATA_PATH/Build/Products"
SHARED_PRECOMPS="$BUILD_INTERMEDIATES/PrecompiledHeaders"

BUILD_SETTINGS_OUTPUT="$({
  xcodebuild \
    -workspace "$PROJECT_ROOT/ios/fam.xcworkspace" \
    -scheme fam \
    -configuration Release \
    -derivedDataPath "$DERIVED_DATA_PATH" \
    -showBuildSettings \
    OBJROOT="$BUILD_INTERMEDIATES" \
    SYMROOT="$BUILD_PRODUCTS" \
    SHARED_PRECOMPS_DIR="$SHARED_PRECOMPS"
} 2>&1)" || configuration_error 'xcodebuild build-settings preflight failed'

effective_build_setting() {
  local name="$1"
  printf '%s\n' "$BUILD_SETTINGS_OUTPUT" \
    | awk -v name="$name" '
      $1 == name && $2 == "=" && value == "" { value = $3 }
      END { if (value != "") print value }
    '
}

assert_build_setting_under_derived_data() {
  local name="$1"
  local value
  value="$(effective_build_setting "$name")"
  case "$value" in
    "$DERIVED_DATA_PATH"/*)
      ;;
    *)
      configuration_error "xcodebuild $name escapes DerivedData: ${value:-missing}"
      ;;
  esac
}

for setting in \
  BUILD_DIR \
  BUILD_ROOT \
  CONFIGURATION_BUILD_DIR \
  CONFIGURATION_TEMP_DIR \
  DERIVED_FILE_DIR \
  MODULE_CACHE_DIR \
  OBJROOT \
  PODS_CONFIGURATION_BUILD_DIR \
  PROJECT_TEMP_DIR \
  SHARED_PRECOMPS_DIR \
  SYMROOT \
  TARGET_TEMP_DIR; do
  assert_build_setting_under_derived_data "$setting"
done

mkdir -p "$BUILD_INTERMEDIATES" "$BUILD_PRODUCTS" "$SHARED_PRECOMPS"
printf '[ios-build] Fastpath: Xcode build paths verified under %s\n' "$DERIVED_DATA_PATH" >&2

[ -s "$ARTIFACT" ] || fallback "registered preview IPA is missing: $ARTIFACT"

cd "$PROJECT_ROOT"
APP_VERSION="$(node -p "require('./app.json').expo.version || '1.0.0'")"
REMOTE_BUILD_OUTPUT="$(bunx eas-cli build:version:get --platform ios --json 2>/dev/null)" || \
  fallback 'remote EAS build number could not be read'
CURRENT_BUILD="$(printf '%s\n' "$REMOTE_BUILD_OUTPUT" | node -e '
  const fs = require("node:fs");
  const input = fs.readFileSync(0, "utf8");
  const matches = [...input.matchAll(/"buildNumber"\s*:\s*"([^"]+)"/g)];
  if (matches.length === 0) process.exit(1);
  process.stdout.write(matches.at(-1)[1]);
')" || fallback 'remote EAS build number has an unexpected format'
case "$CURRENT_BUILD" in
  '' | *[!0-9]*)
    configuration_error "remote EAS build number must be an integer, got: $CURRENT_BUILD; normalize it in a separate explicit EAS preflight before starting this workflow"
    ;;
esac
NEW_BUILD="$((10#$CURRENT_BUILD + 1))"

DOTENV="$PROJECT_ROOT/.env.preview"
[ -f "$DOTENV" ] || fallback '.env.preview is missing'
set -a
# shellcheck disable=SC1090
. "$DOTENV"
set +a
export CCACHE_DIR="$CCACHE_DIR_VALUE"
export USE_CCACHE=1
export FAM_HARNESS_UI=0
export SENTRY_ALLOW_FAILURE=true

ARCHIVE_ROOT="${IOS_BUILD_WORKFLOW_ARCHIVE_ROOT:-$STORAGE_ROOT/xcode_archive}"
mkdir -p "$ARCHIVE_ROOT"
BUILD_ROOT="$(mktemp -d "$ARCHIVE_ROOT/fastpath-${NEW_BUILD}.XXXXXX")"
ARCHIVE_PATH="$BUILD_ROOT/fam.xcarchive"
EXPORT_PATH="$BUILD_ROOT/export"
EXPORT_OPTIONS="$BUILD_ROOT/ExportOptions.plist"
mkdir -p "$EXPORT_PATH"

node - "$EXPORT_OPTIONS" "${APPLE_TEAM_ID:-SW8RP7PA3W}" <<'NODE'
const fs = require('node:fs');

const [outputPath, teamId] = process.argv.slice(2);
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>destination</key><string>export</string>
<key>method</key><string>app-store</string>
<key>signingStyle</key><string>automatic</string>
<key>stripSwiftSymbols</key><true/>
<key>teamID</key><string>${teamId}</string>
</dict></plist>
`;
fs.writeFileSync(outputPath, plist);
NODE

printf '[ios-build] Fastpath: ccache=%s\n' "$CCACHE_DIR_VALUE" >&2
printf '[ios-build] Fastpath: DerivedData=%s\n' "$DERIVED_DATA_PATH" >&2
printf '[ios-build] Fastpath: remote build %s -> new build %s\n' "$CURRENT_BUILD" "$NEW_BUILD" >&2
printf '[ios-build] Fastpath: creating new IPA for build %s\n' "$NEW_BUILD" >&2

xcodebuild archive \
  -workspace "$PROJECT_ROOT/ios/fam.xcworkspace" \
  -scheme fam \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  SYMROOT="$BUILD_PRODUCTS" \
  OBJROOT="$BUILD_INTERMEDIATES" \
  SHARED_PRECOMPS_DIR="$SHARED_PRECOMPS" \
  CURRENT_PROJECT_VERSION="$NEW_BUILD" \
  MARKETING_VERSION="$APP_VERSION"

# Precompiled frameworks keep their matching symbols outside the archive.
# Copy only dSYMs whose DWARF UUID matches the archived binary, before export.
bash "$PROJECT_ROOT/scripts/collect-ios-dsyms.sh" "$ARCHIVE_PATH" "$PROJECT_ROOT"

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates

EXPORTED_IPA=""
for candidate in "$EXPORT_PATH"/*.ipa; do
  [ -f "$candidate" ] || continue
  EXPORTED_IPA="$candidate"
  break
done
[ -n "$EXPORTED_IPA" ] || { printf '[ios-build] xcodebuild export produced no IPA\n' >&2; exit 1; }

INFO_PLIST="$BUILD_ROOT/Info.plist"
unzip -p "$EXPORTED_IPA" 'Payload/*.app/Info.plist' > "$INFO_PLIST"
[ -s "$INFO_PLIST" ] || { printf '[ios-build] exported IPA has no app Info.plist\n' >&2; exit 1; }

ACTUAL_APP_VERSION="$(plutil -extract CFBundleShortVersionString raw -o - "$INFO_PLIST")"
ACTUAL_BUILD="$(plutil -extract CFBundleVersion raw -o - "$INFO_PLIST")"
if [ "$ACTUAL_APP_VERSION" != "$APP_VERSION" ] || [ "$ACTUAL_BUILD" != "$NEW_BUILD" ]; then
  printf '[ios-build] exported IPA metadata mismatch: expected version=%s build=%s, got version=%s build=%s\n' \
    "$APP_VERSION" "$NEW_BUILD" "$ACTUAL_APP_VERSION" "$ACTUAL_BUILD" >&2
  exit 1
fi
printf '[ios-build] IPA metadata verified: CFBundleShortVersionString=%s CFBundleVersion=%s\n' \
  "$ACTUAL_APP_VERSION" "$ACTUAL_BUILD" >&2

mkdir -p "$(dirname "$ARTIFACT")"
cp "$EXPORTED_IPA" "$ARTIFACT"

node - "$PROJECT_ROOT" "$ARTIFACT" <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const [projectRoot, artifactPath] = process.argv.slice(2);
const lockPath = path.join(projectRoot, 'native-build-lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const targetName = 'ios-preview-testflight';
const fingerprint = lock.nativeFingerprints?.ios?.hash;
if (!fingerprint) throw new Error('native-build-lock.json has no iOS fingerprint');
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');

lock.artifacts ??= {};
lock.artifacts[targetName] = {
  ...lock.artifacts[targetName],
  fingerprint,
  configuration: 'Release',
  kind: 'ipa',
  relativePath: path.relative(projectRoot, artifactPath),
  sha256,
};
fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
NODE

printf '[ios-build] Fastpath IPA ready: %s\n' "$ARTIFACT" >&2
