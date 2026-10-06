#!/usr/bin/env bash

set +e

archive_path=${1:-ios/build/App.xcarchive}
dsym_directory="$archive_path/dSYMs"
info_plist="$archive_path/Products/Applications/fam.app/Info.plist"
cli_path=${POSTHOG_CLI_PATH:-"$(dirname "$0")/../node_modules/.bin/posthog-cli"}

if [ ! -d "$dsym_directory" ]; then
  printf 'warning: no dSYM directory found in %s; skipping PostHog upload.\n' "$archive_path"
  exit 0
fi

if [ ! -x "$cli_path" ]; then
  printf 'warning: PostHog CLI not found at %s; skipping dSYM upload.\n' "$cli_path"
  exit 0
fi

if [ ! -f "$info_plist" ]; then
  printf 'warning: archive Info.plist not found at %s; skipping dSYM upload.\n' "$info_plist"
  exit 0
fi

"$cli_path" dsym upload \
  --directory "$dsym_directory" \
  --release-name com.goldjunge91.fam1 \
  --info-plist "$info_plist" \
  --main-dsym fam.app.dSYM \
  --skip-on-conflict
status=$?
if [ "$status" -ne 0 ]; then
  printf 'warning: PostHog dSYM upload failed with exit code %s after the archive completed.\n' "$status"
fi
exit 0
