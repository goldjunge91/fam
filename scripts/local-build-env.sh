#!/usr/bin/env bash
set -euo pipefail

local_build_env_project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
local_build_env_cache_root="$local_build_env_project_root/build/cache"
export EAS_LOCAL_BUILD_ROOT="${EAS_LOCAL_BUILD_ROOT:-/Volumes/Programme/temp_bin/eas-local}"

if [[ "${CI:-}" != "true" && "${CI:-}" != "1" ]]; then
  case "$local_build_env_project_root/" in
    /Volumes/Programme/*) ;;
    *)
      printf 'Fehler: Lokale Builds müssen unter /Volumes/Programme liegen: %s\n' \
        "$local_build_env_project_root" >&2
      exit 1
      ;;
  esac
fi

mkdir -p \
  "$local_build_env_cache_root/bun/install" \
  "$local_build_env_cache_root/bun/runtime-transpiler" \
  "$local_build_env_cache_root/eas" \
  "$local_build_env_cache_root/expo-home" \
  "$local_build_env_cache_root/node/compile" \
  "$local_build_env_cache_root/npm" \
  "$local_build_env_cache_root/tmp" \
  "$local_build_env_cache_root/xdg" \
  "$local_build_env_cache_root/ios/cocoapods"

export TMPDIR="$local_build_env_cache_root/tmp/"
export BUN_INSTALL_CACHE_DIR="$local_build_env_cache_root/bun/install"
export BUN_RUNTIME_TRANSPILER_CACHE_PATH="$local_build_env_cache_root/bun/runtime-transpiler"
export CP_HOME_DIR="$local_build_env_cache_root/ios/cocoapods"
export NPM_CONFIG_CACHE="$local_build_env_cache_root/npm"
export npm_config_cache="$NPM_CONFIG_CACHE"
export NODE_COMPILE_CACHE="$local_build_env_cache_root/node/compile"
export XDG_CACHE_HOME="$local_build_env_cache_root/xdg"
export __UNSAFE_EXPO_HOME_DIRECTORY="$local_build_env_cache_root/expo-home"

if local_build_env_ccache="$(command -v ccache 2>/dev/null)"; then
  mkdir -p "$local_build_env_cache_root/ios/ccache"
  export CCACHE_BINARY="$local_build_env_ccache"
  export CCACHE_DIR="$local_build_env_cache_root/ios/ccache"
else
  unset CCACHE_BINARY CCACHE_DIR
fi

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  if [[ $# -lt 2 || "$1" != "--" ]]; then
    printf 'Verwendung: bash scripts/local-build-env.sh -- <Befehl> [Argumente ...]\n' >&2
    exit 2
  fi
  shift
  exec "$@"
fi
