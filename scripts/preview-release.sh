#!/usr/bin/env bash
set -euo pipefail

readonly DEFAULT_PROJECT_REF='ivvebtqasotqpikuydov'
readonly DEFAULT_OTA_BRANCH='preview-testflight'
readonly DEFAULT_OTA_ENVIRONMENT='preview'
readonly DEFAULT_OTA_PLATFORM='ios'
readonly DEFAULT_OTA_MESSAGE='Testing Supabase mit Update-Screen'
readonly DEFAULT_EDGE_FUNCTIONS='ai-gateway'

project_ref="${FAM_SUPABASE_PROJECT_REF:-$DEFAULT_PROJECT_REF}"
ota_branch="${FAM_UPDATE_BRANCH:-$DEFAULT_OTA_BRANCH}"
ota_environment="${FAM_UPDATE_ENVIRONMENT:-$DEFAULT_OTA_ENVIRONMENT}"
ota_platform="${FAM_UPDATE_PLATFORM:-$DEFAULT_OTA_PLATFORM}"
ota_message="${FAM_UPDATE_MESSAGE:-$DEFAULT_OTA_MESSAGE}"
edge_functions="${FAM_EDGE_FUNCTIONS:-$DEFAULT_EDGE_FUNCTIONS}"

fail() {
  printf 'Fehler: %s\n' "$1" >&2
  exit 1
}

if [[ "$project_ref" != "$DEFAULT_PROJECT_REF" && "${FAM_ALLOW_OTHER_PROJECT:-0}" != '1' ]]; then
  fail "Remote-Projekt ist nicht freigegeben: $project_ref"
fi

usage() {
  cat <<'EOF'
Verwendung: bash scripts/preview-release.sh <schema|edge|ota|all>

Standardziel: Supabase-Projekt ivvebtqasotqpikuydov
Standard-Edge-Function: ai-gateway

Optionale Umgebungsvariablen:
  FAM_EDGE_FUNCTIONS="ai-gateway auth-confirmed"
  FAM_UPDATE_MESSAGE="Eigene EAS-Update-Nachricht"
  FAM_UPDATE_BRANCH="preview-testflight"
  FAM_UPDATE_ENVIRONMENT="preview"
  FAM_ALLOW_OTHER_PROJECT=1  # nur für bewusst abweichende Ziele
EOF
}

migrate_schema() {
  printf '%s\n' "==> Schema remote migrieren: $project_ref"
  supabase db push --remote="$project_ref" --yes
}

deploy_edge_functions() {
  for function_name in $edge_functions; do
    printf '%s\n' "==> Edge Function deployen: $function_name"
    supabase functions deploy "$function_name" \
      --remote="$project_ref" \
      --use-api \
      --jobs=1 \
      --yes
  done
}

publish_ota() {
  printf '%s\n' "==> OTA veröffentlichen: $ota_branch / $ota_environment / $ota_platform"
  env \
    FAM_SHOW_UPDATE_EXPERIENCE=1 \
    FAM_UPDATE_CHANNEL="$ota_branch" \
    eas update \
      --branch "$ota_branch" \
      --environment "$ota_environment" \
      --platform "$ota_platform" \
      --message "$ota_message"
}

[[ $# -eq 1 ]] || { usage; exit 2; }

case "$1" in
  schema)
    migrate_schema
    ;;
  edge)
    deploy_edge_functions
    ;;
  ota)
    publish_ota
    ;;
  all)
    migrate_schema
    deploy_edge_functions
    publish_ota
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
