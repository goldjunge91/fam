#!/bin/bash
# Revalidate a cached web_fetch response before the tool runs.
# A cache entry is used only after the origin returns HTTP 304.

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
CACHE_DIR="$SCRIPT_DIR/.sdd-cache"

# Missing optional tooling must never prevent the actual fetch.
command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0
command -v shasum >/dev/null 2>&1 || command -v sha256sum >/dev/null 2>&1 || exit 0

INPUT=$(cat 2>/dev/null || true)

log_debug() {
  [ "${SDD_CACHE_DEBUG:-0}" = "1" ] || [ -f "$CACHE_DIR/.debug" ] || return 0
  mkdir -p "$CACHE_DIR"
  printf '%s [pre] %s\n' "$(date -u +%FT%TZ)" "$*" >> "$CACHE_DIR/.debug.log"
}

URL=$(printf '%s' "$INPUT" | jq -r '.tool_input.url // empty' 2>/dev/null || true)
[ -n "$URL" ] || { log_debug "no tool_input.url"; exit 0; }

hash_key() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | cut -c1-32
  else
    printf '%s' "$1" | sha256sum | cut -c1-32
  fi
}

CACHE_FILE="$CACHE_DIR/$(hash_key "$URL").json"
[ -f "$CACHE_FILE" ] || { log_debug "cache miss"; exit 0; }

ETAG=$(jq -r '.etag // empty' "$CACHE_FILE" 2>/dev/null || true)
LAST_MODIFIED=$(jq -r '.last_modified // empty' "$CACHE_FILE" 2>/dev/null || true)
# Without an origin validator, serving the entry would be an unverified cache hit.
[ -n "$ETAG" ] || [ -n "$LAST_MODIFIED" ] || { log_debug "no validator"; exit 0; }

HEADERS=()
[ -n "$ETAG" ] && HEADERS+=(-H "If-None-Match: $ETAG")
[ -n "$LAST_MODIFIED" ] && HEADERS+=(-H "If-Modified-Since: $LAST_MODIFIED")
STATUS=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 5 -L "${HEADERS[@]}" "$URL" 2>/dev/null || true)
log_debug "revalidation status=$STATUS"
[ "$STATUS" = "304" ] || exit 0

CONTENT=$(jq -r '.content // empty' "$CACHE_FILE" 2>/dev/null || true)
[ -n "$CONTENT" ] || { log_debug "cached content is empty"; exit 0; }

FETCHED_AT=$(jq -r '.fetched_at // 0' "$CACHE_FILE" 2>/dev/null || echo 0)
VERIFIED_AT=$(date -u -r "$FETCHED_AT" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || date -u -d "@$FETCHED_AT" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || printf '%s' 'unknown')
PROMPT=$(jq -r '.prompt // empty' "$CACHE_FILE" 2>/dev/null || true)

{
  printf '[sdd-cache] Cache hit for %s\n\n' "$URL"
  printf 'Revalidated via HTTP 304; unchanged since %s. Use the cached\n' "$VERIFIED_AT"
  printf 'content below as if web_fetch had just returned it.\n\n'
  if [ -n "$PROMPT" ]; then
    printf 'Original web_fetch prompt: "%s". If your angle differs, judge\n' "$PROMPT"
    printf 'whether this reading still covers it.\n\n'
  fi
  printf -- '----- BEGIN CACHED CONTENT -----\n'
  printf '%s\n' "$CONTENT"
  printf -- '----- END CACHED CONTENT -----\n'
} >&2

# Kiro treats exit 2 from this PreToolUse command as the intentional block.
exit 2
