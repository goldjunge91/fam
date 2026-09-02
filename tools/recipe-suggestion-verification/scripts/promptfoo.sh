#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
VERIFICATION_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
UNAME_S="$(uname -s 2>/dev/null || printf 'unknown')"

if [[ -n "${FAM_NODE_BIN:-}" ]]; then
  NODE_BIN="$FAM_NODE_BIN"
elif [[ -x "$VERIFICATION_DIR/.node/node" ]]; then
  NODE_BIN="$VERIFICATION_DIR/.node/node"
elif [[ "$UNAME_S" == Linux* || "$UNAME_S" == Darwin* ]] && command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [[ -x "$VERIFICATION_DIR/.node/node.exe" ]]; then
  NODE_BIN="$VERIFICATION_DIR/.node/node.exe"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  echo "Node.js 22.22+ fehlt. Lege eine portable Runtime unter tools/recipe-suggestion-verification/.node ab oder setze FAM_NODE_BIN." >&2
  exit 1
fi

ENTRYPOINT="$VERIFICATION_DIR/node_modules/promptfoo/dist/src/entrypoint.js"
if [[ ! -f "$ENTRYPOINT" ]]; then
  echo "Promptfoo fehlt. Fuehre zuerst bun install in tools/recipe-suggestion-verification aus." >&2
  exit 1
fi
if [[ "$NODE_BIN" == *.exe ]] && ! "$NODE_BIN" --version >/dev/null 2>&1; then
  echo "Die Windows-Node-Laufzeit kann aus dieser Bash-Umgebung nicht gestartet werden." >&2
  exit 1
fi

export PROMPTFOO_CONFIG_DIR="${PROMPTFOO_CONFIG_DIR:-$VERIFICATION_DIR/.promptfoo}"
export PROMPTFOO_DISABLE_WAL_MODE="${PROMPTFOO_DISABLE_WAL_MODE:-true}"
PRELOAD_PATH="$VERIFICATION_DIR/scripts/promptfoo-node-preload.cjs"
if [[ "$NODE_BIN" == *.exe ]] && command -v cygpath >/dev/null 2>&1; then
  PRELOAD_ARG="$(cygpath -aw "$PRELOAD_PATH")"
else
  PRELOAD_ARG="$PRELOAD_PATH"
fi
export NODE_OPTIONS="--require=$PRELOAD_ARG ${NODE_OPTIONS:-}"
cd -- "$VERIFICATION_DIR"
exec "$NODE_BIN" "$ENTRYPOINT" "$@"
