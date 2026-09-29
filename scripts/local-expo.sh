#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Fehler: %s\n' "$1" >&2
  exit 1
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "$script_dir/local-build-env.sh"

[[ $# -ge 1 ]] || fail 'Erwartet wird start oder ios.'
mode=$1
shift

env_file=
if [[ $# -gt 0 && "$1" == .env* ]]; then
  env_file=$1
  shift
  case "$env_file" in
    .env|.env.*) ;;
    *) fail "Ungültige Env-Datei: $env_file" ;;
  esac
  [[ -f "$local_build_env_project_root/$env_file" ]] || fail "Env-Datei fehlt: $env_file"
fi
if [[ $# -gt 0 && "$1" == -- ]]; then
  shift
fi

if [[ "$mode" == start ]]; then
  [[ -z "$env_file" ]] || fail 'Für start wird keine zusätzliche Env-Datei verwendet.'
  exec bun x expo start "$@"
fi

[[ "$mode" == ios ]] || fail "Unbekannter Befehl: $mode"
cd "$local_build_env_project_root"

prebuild_mode=--no-clean
run_args=()
for argument in "$@"; do
  if [[ "$argument" == --clean ]]; then
    prebuild_mode=--clean
  else
    run_args+=("$argument")
  fi
done

bun_args=()
if [[ -n "$env_file" ]]; then
  bun_args+=("--env-file=$env_file")
fi
bun "${bun_args[@]}" x expo prebuild "$prebuild_mode" --platform ios
pod install --project-directory="$local_build_env_project_root/ios"
exec bun "${bun_args[@]}" x expo run:ios --scheme fam "${run_args[@]}"
