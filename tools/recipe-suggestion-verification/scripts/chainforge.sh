#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
VERIFICATION_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ -n "${FAM_CHAINFORGE_BIN:-}" ]]; then
  CHAINFORGE_BIN="$FAM_CHAINFORGE_BIN"
elif [[ -x "$VERIFICATION_DIR/.venv/bin/chainforge" ]]; then
  CHAINFORGE_BIN="$VERIFICATION_DIR/.venv/bin/chainforge"
elif [[ -x "$VERIFICATION_DIR/.venv/Scripts/chainforge.exe" ]]; then
  CHAINFORGE_BIN="$VERIFICATION_DIR/.venv/Scripts/chainforge.exe"
else
  echo "ChainForge fehlt unter recipe-suggestion-verification/.venv oder über FAM_CHAINFORGE_BIN." >&2
  exit 1
fi

if [[ "$CHAINFORGE_BIN" == *.exe ]] && ! "$CHAINFORGE_BIN" --help >/dev/null 2>&1; then
  echo "Die Windows-ChainForge-Laufzeit kann aus dieser Bash-Umgebung nicht gestartet werden." >&2
  exit 1
fi

exec "$CHAINFORGE_BIN" "$@"
