#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
VERIFICATION_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ -n "${FAM_CHAINFORGE_BIN:-}" ]]; then
  exec "$FAM_CHAINFORGE_BIN" "$@"
elif [[ -x "$VERIFICATION_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="$VERIFICATION_DIR/.venv/bin/python"
elif [[ -x "$VERIFICATION_DIR/.venv/Scripts/python.exe" ]]; then
  PYTHON_BIN="$VERIFICATION_DIR/.venv/Scripts/python.exe"
else
  echo "ChainForge fehlt unter recipe-suggestion-verification/.venv oder über FAM_CHAINFORGE_BIN." >&2
  exit 1
fi

# Console-Launcher speichern den ursprünglichen absoluten venv-Pfad. Der
# Python-Einstieg bleibt nach einem Verschieben der Eval-Umgebung verwendbar.
exec "$PYTHON_BIN" -c 'from chainforge import main; main()' "$@"
