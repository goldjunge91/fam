#!/bin/sh
# PreToolUse hook adapter for VS Code.
#
# The reset policy lives in .codex/hooks/block-git-reset.py. This adapter only
# translates the VS Code hook payload into the Codex payload that policy reads.

set -eu

deny() {
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Git-Befehl wurde aus Sicherheitsgruenden blockiert."}}'
  exit 0
}

allow() {
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
}

command -v jq >/dev/null 2>&1 || deny
command -v python3 >/dev/null 2>&1 || deny

script_dir=$(CDPATH= cd -- "$(dirname "$0")" 2>/dev/null && pwd -P) || deny
repo_root=$(CDPATH= cd -- "$script_dir/../../.." 2>/dev/null && pwd -P) || deny
policy="$repo_root/.codex/hooks/block-git-reset.py"
[ -r "$policy" ] || deny

payload=$(cat) || deny

if ! printf '%s' "$payload" | jq -e '
  type == "object"
  and (.toolName | type == "string")
  and (.toolName | length > 0)
' >/dev/null 2>&1; then
  deny
fi

tool=$(printf '%s' "$payload" | jq -r '.toolName')
case "$tool" in
  shell|bash|terminal|run_in_terminal) ;;
  *) allow ;;
esac

if ! command=$(printf '%s' "$payload" | jq -er '
  .toolArgs.command
  | select(type == "string" and length > 0)
'); then
  deny
fi

codex_payload=$(jq -cn --arg command "$command" '{tool_input: {command: $command}}') || deny

if printf '%s' "$codex_payload" | python3 "$policy" >/dev/null 2>&1; then
  allow
fi

deny
