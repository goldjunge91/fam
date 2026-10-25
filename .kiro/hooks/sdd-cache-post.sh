#!/bin/bash
# Store a successful web_fetch response only when the origin supplies a validator.

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
CACHE_DIR="$SCRIPT_DIR/.sdd-cache"

command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0
command -v shasum >/dev/null 2>&1 || command -v sha256sum >/dev/null 2>&1 || exit 0

INPUT=$(cat 2>/dev/null || true)

log_debug() {
  [ "${SDD_CACHE_DEBUG:-0}" = "1" ] || [ -f "$CACHE_DIR/.debug" ] || return 0
  mkdir -p "$CACHE_DIR"
  printf '%s [post] %s\n' "$(date -u +%FT%TZ)" "$*" >> "$CACHE_DIR/.debug.log"
}

URL=$(printf '%s' "$INPUT" | jq -r '.tool_input.url // empty' 2>/dev/null || true)
PROMPT=$(printf '%s' "$INPUT" | jq -r '.tool_input.prompt // empty' 2>/dev/null || true)
[ -n "$URL" ] || { log_debug "no tool_input.url"; exit 0; }

# Kiro may expose the response under result, output, text, content, or body.
# A string response is accepted as-is for older/custom integrations.
CONTENT=$(printf '%s' "$INPUT" | jq -r '
  if (.tool_response | type) == "object" then
    (.tool_response.result
     // .tool_response.output
     // .tool_response.text
     // .tool_response.content
     // .tool_response.body
     // empty)
  elif (.tool_response | type) == "string" then
    .tool_response
  else
    empty
  end
' 2>/dev/null || true)
[ -n "$CONTENT" ] || { log_debug "no response content"; exit 0; }

hash_key() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | cut -c1-32
  else
    printf '%s' "$1" | sha256sum | cut -c1-32
  fi
}

mkdir -p "$CACHE_DIR"
CACHE_FILE="$CACHE_DIR/$(hash_key "$URL").json"
HEAD_OUT=$(curl -sI -L --max-time 5 "$URL" 2>/dev/null | tr -d '\r' || true)
FINAL_HEADERS=$(printf '%s' "$HEAD_OUT" | awk '
  BEGIN { RS = ""; last = "" }
  { last = $0 }
  END { print last }
')

extract_header() {
  local name="$1"
  printf '%s' "$FINAL_HEADERS" | awk -v header="$name" '
    BEGIN { FS = ":" }
    tolower($1) == tolower(header) {
      sub(/^[^:]*:[ \t]*/, "")
      sub(/[ \t]+$/, "")
      print
      exit
    }
  '
}

ETAG=$(extract_header ETag)
LAST_MODIFIED=$(extract_header Last-Modified)
log_debug "validator etag=$ETAG last_modified=$LAST_MODIFIED"

# An unvalidated response must not become a reusable cache entry.
if [ -z "$ETAG" ] && [ -z "$LAST_MODIFIED" ]; then
  rm -f "$CACHE_FILE"
  exit 0
fi

NOW=$(date +%s)
TMP_FILE="$CACHE_FILE.$$.tmp"
if jq -n \
  --arg url "$URL" \
  --arg prompt "$PROMPT" \
  --arg etag "$ETAG" \
  --arg last_modified "$LAST_MODIFIED" \
  --arg content "$CONTENT" \
  --argjson fetched_at "$NOW" \
  '{url: $url, prompt: $prompt, etag: $etag, last_modified: $last_modified, content: $content, fetched_at: $fetched_at}' \
  > "$TMP_FILE"; then
  mv "$TMP_FILE" "$CACHE_FILE"
else
  rm -f "$TMP_FILE"
fi

exit 0
