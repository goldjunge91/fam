#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
UNAME_S="$(uname -s 2>/dev/null || printf 'unknown')"

if [[ -x "$PLATFORM_DIR/.node/node" ]]; then
  NODE_BIN="$PLATFORM_DIR/.node/node"
elif [[ "$UNAME_S" == Linux* || "$UNAME_S" == Darwin* ]] && command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [[ -x "$PLATFORM_DIR/.node/node.exe" ]]; then
  NODE_BIN="$PLATFORM_DIR/.node/node.exe"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  echo "Node.js 22.22+ fehlt. Installiere Node.js oder lege eine portable Laufzeit unter tools/llm-test-platform/.node ab." >&2
  exit 1
fi

ENTRYPOINT="$PLATFORM_DIR/node_modules/promptfoo/dist/src/entrypoint.js"
if [[ "$NODE_BIN" == *.exe ]]; then
  if ! "$NODE_BIN" --version >/dev/null 2>&1; then
    echo "Die Windows-Node-Laufzeit kann aus dieser Bash-Umgebung nicht gestartet werden. Verwende Git Bash oder installiere Linux-Node.js 22.22+ in WSL." >&2
    exit 1
  fi
fi
exec "$NODE_BIN" "$ENTRYPOINT" "$@"
