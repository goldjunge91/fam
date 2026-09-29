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
  local|cloud) ;;
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
  development-local|preview-testflight-local|production-local|development|preview-testflight|production) ;;
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
args=(build --platform ios --profile "$profile" --non-interactive)
if [[ "$mode" == local ]]; then
  mkdir -p "$local_build_env_project_root/build/local/eas/$profile"
  eas_working_directory="$(mktemp -d \
    "$local_build_env_cache_root/eas/${profile}.XXXXXXXX")"
  export EAS_LOCAL_BUILD_WORKINGDIR="$eas_working_directory"
  export EAS_LOCAL_BUILD_ARTIFACTS_DIR="$local_build_env_project_root/build/local/eas/$profile"
  args+=(--local)
  if [[ -n "$output_path" ]]; then
    mkdir -p "$(dirname "$output_path")"
    args+=(--output "$output_path")
  fi
fi

exec bun x eas-cli "${args[@]}"
