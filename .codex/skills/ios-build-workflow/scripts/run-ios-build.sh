#!/usr/bin/env bash
# Single entry point for the local iOS build workflow (Simulator / TestFlight / both).
#
# Usage: run-ios-build.sh <simulator|testflight|both>
#
# This script is the ONLY thing that should be invoked to run a build. It owns
# the whole thing end to end: the lock, the cache-aware fastpath, the rebuild
# fallback, fresh-artifact verification, and the TestFlight upload. The caller
# (agent or human) starts it once and waits for it to exit — nothing else.
#
# All build data (Xcode DerivedData, ccache, archives, the produced IPA) lives
# under the external drive at /Volumes/Programme so the internal disk never
# fills up with build artifacts. There is no local fallback: if the drive
# isn't mounted, this script refuses to run rather than silently writing to
# the internal disk.

set -euo pipefail

mode="${1:?usage: run-ios-build.sh <simulator|testflight|both>}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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

ROOT="$(find_project_root "$PWD" || find_project_root "$SCRIPT_DIR")" || {
  printf '[ios-build] Project root with native-build-lock.json was not found.\n' >&2
  exit 78
}
cd "$ROOT"

FASTPATH="$ROOT/scripts/native-build/native-testflight-fastpath.sh"

STORAGE_ROOT="${IOS_BUILD_WORKFLOW_STORAGE_ROOT:-/Volumes/Programme/fam-build-workflow}"
if [ ! -d "/Volumes/Programme" ]; then
  printf '[ios-build] Externe Build-Platte /Volumes/Programme ist nicht eingehaengt; Abbruch (kein lokaler Fallback erlaubt).\n' >&2
  exit 78
fi
case "$STORAGE_ROOT" in
  /Volumes/Programme/*) ;;
  *)
    printf '[ios-build] Build-Daten muessen unter /Volumes/Programme liegen: %s\n' "$STORAGE_ROOT" >&2
    exit 78
    ;;
esac

ARTIFACT_ROOT="$STORAGE_ROOT/native-artifacts"
ARTIFACT="$ARTIFACT_ROOT/ios-preview-testflight/fam.ipa"
LOCK_DIR="$STORAGE_ROOT/native-build.lock"

export TMPDIR="$STORAGE_ROOT/tmp"
export IOS_BUILD_WORKFLOW_STORAGE_ROOT="$STORAGE_ROOT"
export IOS_BUILD_WORKFLOW_ARTIFACT_ROOT="$ARTIFACT_ROOT"
export IOS_BUILD_WORKFLOW_ARCHIVE_ROOT="${IOS_BUILD_WORKFLOW_ARCHIVE_ROOT:-$STORAGE_ROOT/xcode_archive}"
mkdir -p "$TMPDIR" "$STORAGE_ROOT"

run_step() {
  printf '\n[ios-build] %s\n' "$*" >&2
  # This child process is the active build critical section. Wait for its
  # natural exit; never poll, inspect, kill, or restart it.
  "$@" >&2
}

cleanup_lock() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  printf '[ios-build] Ein anderer iOS-Build laeuft bereits: %s\n' "$LOCK_DIR" >&2
  exit 75
fi

# Install cleanup only after this process acquired the lock. A blocked second
# invocation must never remove the first invocation's lock on EXIT.
trap cleanup_lock EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

run_simulator() {
  run_step bun run native:dev -- --target ios-development-simulator
}

run_testflight() {
  run_step bun run native:status

  fastpath_status=0
  run_step bash "$FASTPATH" || fastpath_status=$?
  if [ "$fastpath_status" -eq 42 ]; then
    printf '\n[ios-build] Fastpath nicht nutzbar (kein warmer Cache/Artefakt) -> kontrollierter Rebuild.\n' >&2
    run_step bun run native:rebuild -- --target ios-preview-testflight </dev/null
  elif [ "$fastpath_status" -ne 0 ]; then
    return "$fastpath_status"
  fi

  # Both fastpath and the rebuild fallback write the newly created IPA for
  # this run at exactly this path. This run's artifact is always what gets
  # uploaded -- never a stale or previously registered build.
  if [ ! -s "$ARTIFACT" ]; then
    printf '[ios-build] Neues Artefakt fehlt oder ist leer: %s\n' "$ARTIFACT" >&2
    return 1
  fi

  # Re-validate fingerprint + sha256 of the freshly written artifact before
  # handing exactly this path to EAS.
  run_step bun run native:status
  run_step bunx eas-cli submit --platform ios --profile preview-testflight --path "$ARTIFACT"
}

case "$mode" in
  simulator)
    run_simulator
    ;;
  testflight)
    run_testflight
    ;;
  both)
    simulator_status=0
    run_simulator || simulator_status=$?

    testflight_status=0
    run_testflight || testflight_status=$?

    printf '\n[ios-build] simulator exit=%s testflight exit=%s\n' "$simulator_status" "$testflight_status" >&2
    [ "$simulator_status" -eq 0 ] && [ "$testflight_status" -eq 0 ]
    ;;
  *)
    printf '[ios-build] Unbekannter Modus: %s\n' "$mode" >&2
    exit 64
    ;;
esac
