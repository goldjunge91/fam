#!/bin/bash
# Refresh Beads context without changing repository or task state.

if [ ! -t 0 ]; then
  cat >/dev/null
fi

if ! command -v bd >/dev/null 2>&1; then
  printf '%s\n' 'beads context unavailable: bd was not found on PATH.'
  exit 0
fi

if ! bd prime; then
  printf '%s\n' 'beads context unavailable: bd prime did not complete.'
fi

exit 0
