#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Fehler: %s\n' "$1" >&2
  exit 1
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "$script_dir/local-build-env.sh"

[[ $# -ge 1 ]] || fail 'Verwendung: scripts/eas-ios-build.sh local|cloud <Profil> [--output build/local/... ]'
mode=$1
case "$mode" in
local | cloud) ;;
*) fail "Unbekannter Build-Modus: $mode" ;;
esac

if [[ $# -ge 2 ]]; then
  profile=$2
  shift 2
else
  fail 'Ein EAS-Profil muss angegeben werden.'
fi

output_path=
while [[ $# -gt 0 ]]; do
  case "$1" in
  --output)
    [[ $# -ge 2 && -z "$output_path" ]] || fail 'Verwendung: --output build/local/<Pfad>/<Datei>'
    output_path=$2
    shift 2
    ;;
  *) fail "Unbekanntes Argument: $1" ;;
  esac
done

case "$profile" in
development-local | preview-testflight-local | production-local | development | preview-testflight | production) ;;
*) fail "Unbekanntes iOS-EAS-Profil: $profile" ;;
esac

if [[ -n "$output_path" ]]; then
  [[ "$mode" == local ]] || fail '--output wird nur für lokale EAS-Builds unterstützt.'
  case "$output_path" in
  build/local/*) ;;
  *) fail '--output muss innerhalb von build/local/ liegen.' ;;
  esac
  case "/$output_path/" in
  */../*) fail '--output darf keine Pfadsegmente enthalten, die aus build/local/ herausführen.' ;;
  esac
fi

cd "$local_build_env_project_root"
args=(build --platform ios --profile "$profile")
if [[ "$mode" == local ]]; then
  mkdir -p "$local_build_env_project_root/build/local/eas/$profile"
  # eas-cli legt den shallow-clone der Projektkopie im TMPDIR an
  # (TMPDIR/eas-cli-nodejs/<uuid>-shallow-clone) und arbeitet im Workingdir.
  # local-build-env.sh setzt beide Pfade ins Projekt; eas-cli bricht beim
  # Komprimieren ab: "cannot copy <projekt> to a subdirectory of self".
  # Deshalb liegen beide ausserhalb des Projekts, unter /Volumes/Programme.
  eas_temp_root="/Volumes/Programme/temp_bin/eas-local/$profile"
  mkdir -p "$eas_temp_root"
  # Finder/Spotlight legen in frisch kopierten Clone-Verzeichnissen .DS_Store
  # an und eas-clis Aufräumen bricht mit ENOTEMPTY ab. Alt-Bestand entfernen
  # und Indexierung der Temp-Bäume unterbinden.
  find "$eas_temp_root" -name .DS_Store -delete 2>/dev/null || true
  touch "$eas_temp_root/.metadata_never_index"
  # Fester Workingdir statt Zufallsname: DerivedData (build/) bleibt fuer
  # inkrementelle Builds erhalten — Swift/Link/dSYM sind nicht ccache-gedeckt
  # und profitieren am meisten. Das alte Projekt-Extrakt wird entfernt.
  eas_working_directory="$eas_temp_root/work"
  export EAS_LOCAL_BUILD_WORKINGDIR="$eas_working_directory"
  if [[ -d "$eas_working_directory" ]]; then
    find "$eas_working_directory" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
  fi
  eas_tmp_dir="$(mktemp -d "$eas_temp_root/tmp.XXXXXXXX")"
  export TMPDIR="$eas_tmp_dir/"
  export EAS_LOCAL_BUILD_ARTIFACTS_DIR="$local_build_env_project_root/build/local/eas/$profile"
  args+=(--local)
  if [[ -n "$output_path" ]]; then
    mkdir -p "$(dirname "$output_path")"
    args+=(--output "$output_path")
  fi
fi

log_dir="$local_build_env_project_root/build/local/eas/$profile"
mkdir -p "$log_dir"
log_file="$log_dir/build-$(date +%Y%m%d-%H%M%S).log"
bun x eas-cli "${args[@]}" 2>&1 | tee "$log_file"
printf 'EAS-Log: %s\n' "$log_file"
