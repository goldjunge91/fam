#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Fehler: %s\n' "$1" >&2
  exit 1
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "$script_dir/local-build-env.sh"
project_root="$local_build_env_project_root"

command -v bun >/dev/null 2>&1 || fail 'Bun wurde nicht gefunden.'
command -v node >/dev/null 2>&1 || fail 'Node.js wurde nicht gefunden; Expo CLI benötigt Node.js.'
command -v pod >/dev/null 2>&1 || fail 'CocoaPods wurde nicht gefunden.'
command -v xcodebuild >/dev/null 2>&1 || fail 'xcodebuild wurde nicht gefunden.'
[[ -d "$project_root/node_modules/expo" ]] || fail 'Expo fehlt in node_modules. Führe zuerst bun install aus.'

build_root="$project_root/build/cache/ios/watch-build"
derived_data_path="$build_root/DerivedData"
module_cache_path="$build_root/ClangModuleCache"
swift_module_cache_path="$build_root/SwiftModuleCache"
source_packages_path="$build_root/SourcePackages"
result_parent="$build_root/results"
mkdir -p \
  "$derived_data_path/ModuleCache.noindex" \
  "$module_cache_path" \
  "$swift_module_cache_path" \
  "$source_packages_path" \
  "$result_parent"

export FAM_HARNESS_UI=1
export FAM_IOS_MLKIT_OCR=0
export FAM_UPDATE_CHANNEL=development
export CLANG_MODULES_BUILD_SESSION_FILE="$derived_data_path/ModuleCache.noindex/Session.modulevalidation"
: > "$CLANG_MODULES_BUILD_SESSION_FILE"

cd "$project_root"
soft_open_files="$(ulimit -Sn)"
if [[ "$soft_open_files" =~ ^[0-9]+$ ]] && (( soft_open_files < 4096 )); then
  ulimit -Sn 4096 2>/dev/null || fail "Das offene-Dateien-Limit ist $soft_open_files und kann für diesen Prozess nicht auf 4096 angehoben werden."
  printf 'Offene-Dateien-Limit für diesen Build-Prozess auf 4096 angehoben.\n'
fi

printf 'Aktualisiere das iOS-Projekt und installiere CocoaPods aus der Expo-Konfiguration.\n'
bun x expo prebuild --no-clean --platform ios
printf 'Installiere die Pods für alle Apple-Targets.\n'
pod install --project-directory="$project_root/ios"

workspace="$project_root/ios/fam.xcworkspace"
[[ -d "$workspace" ]] || fail 'Expo oder CocoaPods hat ios/fam.xcworkspace nicht erzeugt.'

result_directory="$(mktemp -d "$result_parent/run.XXXXXXXX")"
result_bundle="$result_directory/watch.xcresult"
printf 'Baue fam einschließlich des Watch-Targets für den arm64 iOS-Simulator.\n'
printf 'Buildprodukte, Modul-Caches und temporäre Dateien: %s\n' "$build_root"

xcodebuild \
  -quiet \
  -workspace "$workspace" \
  -scheme fam \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -jobs 5 \
  -derivedDataPath "$derived_data_path" \
  -clonedSourcePackagesDirPath "$source_packages_path" \
  -resultBundlePath "$result_bundle" \
  SYMROOT="$build_root/Products" \
  OBJROOT="$build_root/Intermediates.noindex" \
  SHARED_PRECOMPS_DIR="$build_root/PrecompiledHeaders" \
  DSTROOT="$build_root/dstroot" \
  CACHE_ROOT="$build_root/XcodeCache" \
  CLANG_MODULE_CACHE_PATH="$module_cache_path" \
  SWIFT_MODULE_CACHE_PATH="$swift_module_cache_path" \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=YES \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build

fam_app="$build_root/Products/Debug-iphonesimulator/fam.app"
[[ -d "$fam_app" ]] || fail "Der Build war erfolgreich, aber das Host-App-Produkt fehlt: $fam_app"

watch_target_app="$build_root/Products/Debug-watchsimulator/watch.app"
[[ -d "$watch_target_app" ]] || fail "Der fam-Scheme-Build war erfolgreich, aber das Watch-App-Target-Produkt fehlt: $watch_target_app"
embedded_watch_app="$fam_app/Watch/watch.app"
[[ -d "$embedded_watch_app" ]] || fail "Das Watch-App-Produkt wurde nicht in fam.app eingebettet: $embedded_watch_app"

fam_build_number="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$fam_app/Info.plist")"
watch_build_number="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$embedded_watch_app/Info.plist")"
[[ "$fam_build_number" == "$watch_build_number" ]] || fail "Buildnummern stimmen nicht überein: fam=$fam_build_number, Watch=$watch_build_number"
printf 'OK: fam wurde gebaut: %s\n' "$fam_app"
printf 'OK: Watch wurde gebaut und eingebettet: %s\n' "$embedded_watch_app"
printf 'OK: fam und Watch verwenden Buildnummer %s.\n' "$fam_build_number"
