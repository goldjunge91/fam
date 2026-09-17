#!/usr/bin/env bash

# The explicit UserPromptSubmit hook delegates here so the build policy stays
# testable and the hook itself only handles prompt parsing and JSON output.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STORAGE_ROOT="${IOS_BUILD_WORKFLOW_STORAGE_ROOT:-/Volumes/Programme/fam-build-workflow}"
if [ ! -d "/Volumes/Programme" ]; then
  printf '[ios-build] Externe Build-Platte /Volumes/Programme ist nicht eingehängt; lokaler Fallback ist verboten.\n' >&2
  exit 78
fi
case "$STORAGE_ROOT" in
  /Volumes/Programme/*) ;;
  *)
    printf '[ios-build] Build-Daten müssen unter /Volumes/Programme liegen: %s\n' "$STORAGE_ROOT" >&2
    exit 78
    ;;
esac

ARTIFACT_ROOT="${IOS_BUILD_WORKFLOW_ARTIFACT_ROOT:-$STORAGE_ROOT/native-artifacts}"
ARTIFACT="$ARTIFACT_ROOT/ios-preview-testflight/fam.ipa"
mode="${1:-}"
LOCK_ROOT="${IOS_BUILD_WORKFLOW_LOCK_ROOT:-$STORAGE_ROOT}"
LOCK_DIR="$LOCK_ROOT/native-build.lock"
WORKFLOW_TMPDIR="${IOS_BUILD_WORKFLOW_TMPDIR:-$STORAGE_ROOT/tmp}"
export IOS_BUILD_WORKFLOW_STORAGE_ROOT="$STORAGE_ROOT"
export IOS_BUILD_WORKFLOW_ARTIFACT_ROOT="$ARTIFACT_ROOT"
export IOS_BUILD_WORKFLOW_ARCHIVE_ROOT="${IOS_BUILD_WORKFLOW_ARCHIVE_ROOT:-$STORAGE_ROOT/xcode_archive}"
export TMPDIR="$WORKFLOW_TMPDIR"
for workflow_path in "$ARTIFACT_ROOT" "$LOCK_ROOT" "$IOS_BUILD_WORKFLOW_ARCHIVE_ROOT" "$WORKFLOW_TMPDIR"; do
  case "$workflow_path" in
    /Volumes/Programme/*) ;;
    *)
      printf '[ios-build] Build-Daten müssen unter /Volumes/Programme liegen: %s\n' "$workflow_path" >&2
      exit 78
      ;;
  esac
done
mkdir -p "$TMPDIR"

run_step() {
  printf '\n[ios-build] %s\n' "$*" >&2
  # The child process is the active build critical section. Wait for its
  # natural exit; do not add polling, diagnostics, retries, or termination.
  "$@" >&2
}

run_simulator() {
  run_step bun run native:dev -- --target ios-development-simulator
}

run_testflight_rebuild_fallback() {
  printf '\n[ios-build] Cache-Fastpath unavailable; using the controlled rebuild fallback.\n' >&2

  # This is only the fallback for a failed status/cache preflight. It is never
  # the first TestFlight action when the existing compile caches are usable.
  run_step bun run native:rebuild -- --target ios-preview-testflight --approve-rebuild </dev/null
}

run_testflight() {
  printf '\n[ios-build] Checking the native fingerprint and registered preview artifact.\n' >&2

  # status is read-only. The workflow must create and upload the IPA produced
  # by this run; an existing artifact cannot substitute for that result.
  if ! run_step bun run native:status; then
    run_testflight_rebuild_fallback
  else
    fastpath_status=0
    run_step bash "$ROOT/scripts/native-testflight-fastpath.sh" || fastpath_status=$?
    if [ "$fastpath_status" -eq 42 ]; then
      run_testflight_rebuild_fallback
    elif [ "$fastpath_status" -ne 0 ]; then
      return "$fastpath_status"
    fi
  fi

  # Both fastpath and fallback write the newly created IPA for this run at
  # this path. The current run's artifact is always passed to eas submit.
  if [ ! -s "$ARTIFACT" ]; then
    printf '[ios-build] New artifact is missing or empty: %s\n' "$ARTIFACT" >&2
    return 1
  fi

  # Confirm the newly written artifact and lock before handing exactly this
  # path to EAS. This is intentionally after the build step.
  run_step bun run native:status
  run_step bunx eas-cli submit --platform ios --profile preview-testflight --path "$ARTIFACT"
}

mkdir -p "$LOCK_ROOT"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  printf '[ios-build] Another iOS build workflow is active: %s\n' "$LOCK_DIR" >&2
  exit 75
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

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

    printf '\n[ios-build] simulator exit=%s, testflight exit=%s\n' "$simulator_status" "$testflight_status" >&2
    if [ "$simulator_status" -ne 0 ] || [ "$testflight_status" -ne 0 ]; then
      exit 1
    fi
    ;;
  *)
    printf '[ios-build] Unknown mode: %s\n' "$mode" >&2
    exit 64
    ;;
esac
