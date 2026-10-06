#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
temporary_root="$project_root/build/tmp"
mkdir -p "$temporary_root"
temporary_directory="$(mktemp -d "$temporary_root/db-types.XXXXXXXX")"
trap 'rm -rf "$temporary_directory"' EXIT

generated_file="$temporary_directory/database.types.ts"
formatter_config="$temporary_directory/oxfmt.json"
ignore_file="$temporary_directory/oxfmt.ignore"

cat > "$formatter_config" <<'EOF'
{
  "endOfLine": "lf",
  "insertFinalNewline": true
}
EOF
: > "$ignore_file"

cd "$project_root"
supabase gen types typescript --local > "$generated_file"
bunx oxfmt --config "$formatter_config" --ignore-path "$ignore_file" "$generated_file"
mv "$generated_file" "$project_root/src/lib/database.types.ts"
