#!/usr/bin/env bash

set +e
output=$("$@" 2>&1)
status=$?
printf '%s\n' "$output"

if [ "$status" -eq 0 ]; then
  exit 0
fi

if printf '%s\n' "$output" | grep -q '^error: posthog-cli hermes upload failed with exit code '; then
  printf '%s\n' 'warning: PostHog Hermes source-map upload failed; continuing the native archive.'
  exit 0
fi

exit "$status"
