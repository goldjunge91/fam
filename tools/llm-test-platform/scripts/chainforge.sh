#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ -x "$PLATFORM_DIR/.venv-chainforge/bin/chainforge" ]]; then
  CHAINFORGE_BIN="$PLATFORM_DIR/.venv-chainforge/bin/chainforge"
elif [[ -x "$PLATFORM_DIR/.venv-chainforge/Scripts/chainforge.exe" ]]; then
  CHAINFORGE_BIN="$PLATFORM_DIR/.venv-chainforge/Scripts/chainforge.exe"
else
  echo "ChainForge fehlt unter tools/llm-test-platform/.venv-chainforge." >&2
  exit 1
fi

if [[ "$CHAINFORGE_BIN" == *.exe ]] && ! "$CHAINFORGE_BIN" --help >/dev/null 2>&1; then
  echo "Die Windows-ChainForge-Laufzeit kann aus dieser Bash-Umgebung nicht gestartet werden. Verwende Git Bash oder installiere ChainForge in der Linux-Umgebung neu." >&2
  exit 1
fi

exec "$CHAINFORGE_BIN" "$@"
