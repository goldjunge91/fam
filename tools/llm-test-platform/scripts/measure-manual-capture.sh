#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ -x "$PLATFORM_DIR/.node/node" ]]; then
  NODE_BIN="$PLATFORM_DIR/.node/node"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  echo "Node.js 22.22+ fehlt. Installiere Node.js oder lege eine portable Laufzeit unter tools/llm-test-platform/.node ab." >&2
  exit 1
fi

exec "$NODE_BIN" "$SCRIPT_DIR/measure-manual-capture.mjs" "$@"

