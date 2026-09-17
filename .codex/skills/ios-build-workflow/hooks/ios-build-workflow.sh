#!/usr/bin/env bash

# Execute only an explicit build command. Normal prose must never start a
# potentially long native build or an external TestFlight upload.

set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
payload="$(cat || true)"
prompt="$(printf '%s' "$payload" | jq -r '
  (.prompt // .user_prompt // .userPrompt // .input.prompt // "")
  | if type == "string" then . else "" end
' 2>/dev/null || true)"

mode=""
case "$prompt" in
  '!ios-build simulator') mode='simulator' ;;
  '!ios-build testflight') mode='testflight' ;;
  '!ios-build both') mode='both' ;;
  *) exit 0 ;;
esac

runner="${IOS_BUILD_WORKFLOW_RUNNER:-$SCRIPT_DIR/ios-build-workflow-runner.sh}"
if [ ! -f "$runner" ]; then
  jq -cn --arg context "The explicit !ios-build $mode command could not run because its build runner file is missing: $runner" \
    '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $context}}'
  exit 0
fi

# Keep command output out of stdout so the hook returns one valid JSON payload.
set +e
bash "$runner" "$mode" >&2
runner_status=$?
set -e

if [ "$runner_status" -eq 0 ]; then
  result="completed successfully"
else
  result="finished with exit code $runner_status"
fi

jq -cn --arg context "The explicit !ios-build $mode command already ran and $result. Do not repeat the build automatically. Review the runner output above and report Simulator and TestFlight results independently. For testflight, success requires the new IPA build followed by its upload; a pending EAS submission must be reported as pending. While any build or upload process is active, wait for its natural exit: do not inspect, poll, edit, correct, interrupt, kill, or restart it." \
  '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $context}}'

exit 0
