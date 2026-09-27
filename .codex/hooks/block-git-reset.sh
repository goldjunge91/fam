#!/bin/bash
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' 'Blocked: jq is required to validate Codex Bash commands.' >&2
  exit 2
fi

input=$(cat)
if ! command=$(printf '%s' "$input" | jq -er '.tool_input.command // empty' 2>/dev/null); then
  printf '%s\n' 'Blocked: Codex did not provide a readable Bash command.' >&2
  exit 2
fi

# Keep the guard conservative: a command segment containing git followed by
# reset is rejected, including common Git options and shell chaining.
if printf '%s\n' "$command" | grep -Eq '(^|[[:space:];&|])([^[:space:];&|]+/)?git(\.exe)?([^;&|]*[[:space:]])reset([[:space:];&|]|$)'; then
  printf '%s\n' 'Blocked: git reset is disabled by the repository Codex hook.' >&2
  exit 2
fi

exit 0
