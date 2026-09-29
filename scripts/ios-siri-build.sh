#!/usr/bin/env bash
# Prüft die Siri-Pod-Integration oder baut die App über das fam-Workspace-Scheme.
# Der Standardlauf ist read-only. Ein Build braucht --build und eine Simulator-UDID.

set -euo pipefail

usage() {
  cat <<'USAGE'
Verwendung:
  bash scripts/ios-siri-build.sh [--check]
  bash scripts/ios-siri-build.sh --build <SIMULATOR-UDID>

Ohne Argumente prüft das Skript nur Workspace, Pods, Lockfiles und Siri-Konfiguration.
--build kompiliert zuerst über das fam-Workspace-Scheme für den angegebenen Simulator.
USAGE
}

fail() {
  printf 'Fehler: %s\n' "$1" >&2
  exit 1
}

mode=check
destination_id=
if [[ $# -eq 1 && "$1" == "--check" ]]; then
  mode=check
elif [[ $# -eq 2 && "$1" == "--build" ]]; then
  mode=build
  destination_id=$2
elif [[ $# -eq 1 && ( "$1" == "--help" || "$1" == "-h" ) ]]; then
  usage
  exit 0
elif [[ $# -ne 0 ]]; then
  usage >&2
  exit 2
fi

if [[ "$mode" == "build" && ! "$destination_id" =~ ^[[:xdigit:]]{8}-([[:xdigit:]]{4}-){3}[[:xdigit:]]{12}$ ]]; then
  fail "Für --build ist eine vollständige Simulator-UDID erforderlich, kein Gerätename oder generisches Ziel."
fi

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
case "$project_root/" in
  /Volumes/Programme/*) ;;
  *) fail "Projektpfad liegt nicht unter /Volumes/Programme: $project_root" ;;
esac

workspace="$project_root/ios/fam.xcworkspace"
workspace_data="$workspace/contents.xcworkspacedata"
pods_project="$project_root/ios/Pods/Pods.xcodeproj/project.pbxproj"
main_project="$project_root/ios/fam.xcodeproj/project.pbxproj"
scheme="$project_root/ios/fam.xcodeproj/xcshareddata/xcschemes/fam.xcscheme"
podfile_lock="$project_root/ios/Podfile.lock"
manifest_lock="$project_root/ios/Pods/Manifest.lock"
siri_pods="$project_root/targets/siri/pods.rb"
siri_xcconfig="$project_root/ios/Pods/Target Support Files/Pods-siri/Pods-siri.debug.xcconfig"
sqlite_modulemap="$project_root/ios/Pods/Headers/Public/ExpoSQLite/ExpoSQLite.modulemap"

require_file() {
  [[ -f "$1" ]] || fail "Datei fehlt: ${1#"$project_root/"}"
}

require_text() {
  local file=$1
  local text=$2
  grep -Fq -- "$text" "$file" || fail "Erwarteter Eintrag fehlt in ${file#"$project_root/"}: $text"
}

require_file "$workspace_data"
require_file "$pods_project"
require_file "$main_project"
require_file "$scheme"
require_file "$podfile_lock"
require_file "$manifest_lock"
require_file "$siri_pods"
require_file "$siri_xcconfig"
require_file "$sqlite_modulemap"

cmp -s "$podfile_lock" "$manifest_lock" || fail "Podfile.lock und Pods/Manifest.lock weichen voneinander ab. Bitte Pods-Status prüfen."
require_text "$workspace_data" 'group:Pods/Pods.xcodeproj'
require_text "$scheme" 'buildImplicitDependencies = "YES"'
require_text "$siri_pods" "pod 'ExpoSQLite'"
require_text "$siri_xcconfig" "\${PODS_CONFIGURATION_BUILD_DIR}/ExpoSQLite/ExpoSQLite.modulemap"
require_text "$main_project" 'libPods-siri.a'
require_text "$main_project" 'siri.app in Embed ExtensionKit Extensions'

if ! awk '
  /\/\* Pods-siri \*\/ = \{/ && $0 !~ /PBXFileReference/ { finding_siri = 1 }
  finding_siri && /isa = PBXNativeTarget;/ { in_siri_target = 1; finding_siri = 0 }
  in_siri_target && /dependencies = \(/ { in_siri_dependencies = 1; next }
  in_siri_dependencies && /\);/ { in_siri_dependencies = 0; next }
  in_siri_dependencies && /PBXTargetDependency/ { siri_dependency_ids[$1] = 1 }
  in_siri_target && /^[[:space:]]*};/ { in_siri_target = 0 }

  /\/\* PBXTargetDependency \*\/ = \{/ { dependency_id = $1; dependency_body = ""; in_dependency = 1 }
  in_dependency {
    dependency_body = dependency_body " " $0
    if ($0 ~ /};/) {
      if (dependency_body ~ /name = ExpoSQLite;/) sqlite_dependency_ids[dependency_id] = 1
      in_dependency = 0
    }
  }

  END {
    for (dependency_id in siri_dependency_ids) {
      if (sqlite_dependency_ids[dependency_id]) exit 0
    }
    exit 1
  }
' "$pods_project"; then
  fail 'Das generierte Pods-siri-Target hängt nicht direkt von ExpoSQLite ab.'
fi

printf 'OK: Siri ist im fam-Workspace eingebunden, ExpoSQLite ist in Pods-siri konfiguriert und die CocoaPods-Lockfiles stimmen überein.\n'

if [[ "$mode" == "check" ]]; then
  printf 'Keine Build-Dateien erstellt; kein Build, Prebuild oder pod install ausgeführt.\n'
  exit 0
fi

command -v xcodebuild >/dev/null 2>&1 || fail 'xcodebuild wurde nicht gefunden.'
command -v xcrun >/dev/null 2>&1 || fail 'xcrun wurde nicht gefunden.'

simulator_list="$(xcrun simctl list devices available)" || fail 'Simulator-Geräte konnten nicht abgefragt werden.'
grep -Fq "$destination_id" <<< "$simulator_list" || fail "Simulator-UDID ist nicht verfügbar: $destination_id"

soft_open_files="$(ulimit -Sn)"
if [[ "$soft_open_files" =~ ^[0-9]+$ ]] && (( soft_open_files < 4096 )); then
  ulimit -Sn 4096 2>/dev/null || fail "Das offene-Dateien-Limit ist $soft_open_files und kann für diesen Prozess nicht auf 4096 angehoben werden."
  printf 'Offene-Dateien-Limit für diesen Build-Prozess auf 4096 angehoben.\n'
fi

build_root="$project_root/build/cache/ios/siri-build"
derived_data_path="$build_root/DerivedData"
temporary_path="$build_root/tmp"
mkdir -p "$derived_data_path" "$temporary_path"
export TMPDIR="$temporary_path/"

printf 'Baue fam einschließlich Siri über das Workspace-Scheme für %s.\n' "$destination_id"
printf 'DerivedData und temporäre Build-Dateien: %s\n' "$build_root"

xcodebuild \
  -workspace "$workspace" \
  -scheme fam \
  -configuration Debug \
  -destination "platform=iOS Simulator,id=$destination_id" \
  -jobs 5 \
  -derivedDataPath "$derived_data_path" \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build
