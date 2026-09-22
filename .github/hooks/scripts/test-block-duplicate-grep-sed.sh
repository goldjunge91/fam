#!/bin/sh
# Tests for .github/hooks/scripts/block-duplicate-grep-sed.sh
#
# Usage: sh .github/hooks/scripts/test-block-duplicate-grep-sed.sh
# Exits non-zero on the first failure.

SCRIPT="$(dirname "$0")/block-duplicate-grep-sed.sh"
STATE_DIR="${TMPDIR:-/tmp}/vscode-hook-dedupe"

pass=0
fail=0

# run <sessionId> <json> -> prints decision (allow|deny) and reason
run() {
  printf '%s' "$2" | sh "$SCRIPT" \
    | sed -n 's/.*"permissionDecision"[[:space:]]*:[[:space:]]*"\([a-z]*\)".*/\1/p'
}

reset_state() {
  rm -rf "$STATE_DIR"
}

check() {
  # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1))
    printf 'PASS  %s\n' "$1"
  else
    fail=$((fail + 1))
    printf 'FAIL  %s (expected %s, got %s)\n' "$1" "$2" "$3"
  fi
}

shell_json() {
  printf '{"toolName":"shell","toolArgs":{"command":"%s"},"sessionId":"%s"}' "$1" "${2:-t1}"
}

# --- Rule 1: exact duplicate for ANY tool -----------------------------------
reset_state
check "first shell call allowed" \
  allow "$(run t1 "$(shell_json 'grep -rn foo src/')")"
check "identical shell call denied" \
  deny "$(run t1 "$(shell_json 'grep -rn foo src/')")"

reset_state
check "first read_file allowed" \
  allow "$(run t1 '{"toolName":"read_file","toolArgs":{"filePath":"src/a.ts"},"sessionId":"t1"}')"
check "identical read_file denied" \
  deny "$(run t1 '{"toolName":"read_file","toolArgs":{"filePath":"src/a.ts"},"sessionId":"t1"}')"

reset_state
check "same args, different tool allowed" \
  allow "$(run t1 '{"toolName":"read_file","toolArgs":{"filePath":"src/a.ts"},"sessionId":"t1"}')"
check "same args, other tool allowed" \
  allow "$(run t1 '{"toolName":"list_dir","toolArgs":{"filePath":"src/a.ts"},"sessionId":"t1"}')"

# --- Rule 2: fuzzy grep/sed chains ------------------------------------------
reset_state
run t1 "$(shell_json 'grep -rn foo src/')" > /dev/null
check "grep variant with reordered flags denied" \
  deny "$(run t1 "$(shell_json 'grep  -r -n foo src/')")"

reset_state
run t1 "$(shell_json 'grep -rn foo src/')" > /dev/null
check "grep with extra token (>=70% overlap) denied" \
  deny "$(run t1 "$(shell_json 'grep -rn foo src lib')")"

reset_state
check "different grep pattern allowed" \
  allow "$(run t1 "$(shell_json 'grep -rn bar lib/')")"

reset_state
run t1 "$(shell_json 'grep -rn foo src/')" > /dev/null
check "sed command not compared against grep chain" \
  allow "$(run t1 "$(shell_json 'sed -n 1,5p src/a.ts')")"

reset_state
run t1 "$(shell_json 'sed -n 1,5p src/a.ts')" > /dev/null
check "identical sed denied" \
  deny "$(run t1 "$(shell_json 'sed -n 1,5p src/a.ts')")"

# --- Session isolation -------------------------------------------------------
reset_state
run t1 "$(shell_json 'grep -rn foo src/')" > /dev/null
check "same command in other session allowed" \
  allow "$(run t2 "$(shell_json 'grep -rn foo src/' t2)")"

# --- Non-shell tools are not fuzzy-matched -----------------------------------
reset_state
run t1 '{"toolName":"read_file","toolArgs":{"filePath":"src/a.ts"},"sessionId":"t1"}' > /dev/null
check "similar (not identical) read_file allowed" \
  allow "$(run t1 '{"toolName":"read_file","toolArgs":{"filePath":"src/a.ts","startLine":1,"endLine":50},"sessionId":"t1"}')"

# --- systemMessage on allowed calls ------------------------------------------
reset_state
msg=$(printf '%s' "$(shell_json 'grep -rn bar lib/')" | sh "$SCRIPT" \
  | sed -n 's/.*"systemMessage"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
check "allowed call carries explanation" "1" "$([ -n "$msg" ] && echo 1 || echo 0)"

reset_state
msg=$(printf '%s' "$(shell_json 'grep -rn foo src/')" | sh "$SCRIPT" \
  | sed -n 's/.*"permissionDecisionReason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
check "denied call carries reason" "1" "$([ -n "$msg" ] && echo 1 || echo 0)"

# --- Summary -----------------------------------------------------------------
printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
