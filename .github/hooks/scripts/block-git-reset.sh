#!/bin/sh
# PreToolUse hook adapter for VS Code Local.
#
# The Local payload uses tool_name/tool_input. The legacy camelCase fields are
# accepted as well so older runners fail safely during the transition.
# The reset policy lives in .codex/hooks/block-git-reset.py. This adapter only
# translates the hook payload into the Codex payload that policy reads.

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
  and (
    ((.tool_name? | type == "string") and (.tool_name | length > 0))
    or ((.toolName? | type == "string") and (.toolName | length > 0))
  )
  and (
    ((.tool_input? | type == "object"))
    or ((.toolArgs? | type == "object"))
  )
' >/dev/null 2>&1; then
  deny
fi

if ! tool=$(printf '%s' "$payload" | jq -er '(.tool_name // .toolName) | select(type == "string" and length > 0)'); then
  deny
fi

shell_tool=false
case "$tool" in
  shell|bash|terminal|run_in_terminal|runInTerminal|execute_command|executeCommand)
    shell_tool=true
esac

command=$(printf '%s' "$payload" | jq -er '
  [
    .tool_input.command,
    .tool_input.cmd,
    .toolArgs.command
  ]
  | map(select(type == "string" and length > 0))
  | first // empty
' 2>/dev/null) || command=

if [ -z "$command" ]; then
  [ "$shell_tool" = false ] && allow
  deny
fi

codex_payload=$(jq -cn --arg command "$command" '{tool_input: {command: $command}}') || deny

if printf '%s' "$codex_payload" | python3 "$policy" >/dev/null 2>&1; then
  allow
fi

deny
