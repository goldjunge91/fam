#!/usr/bin/env bash

if [ "$EAS_BUILD_PLATFORM" != "ios" ]; then
  exit 0
fi

working_dir=${EAS_BUILD_WORKINGDIR:-$(cd "$(dirname "$0")/.." && pwd)}
archive_path="$working_dir/ios/build/App.xcarchive"

if [ ! -d "$archive_path" ]; then
  archive_path=$(find "$working_dir/ios" -type d -name '*.xcarchive' -prune -print -quit 2>/dev/null)
fi

if [ -z "$archive_path" ]; then
  printf 'warning: no iOS archive found under %s; skipping PostHog dSYM upload.\n' "$working_dir"
  exit 0
fi

exec "$(dirname "$0")/posthog-upload-ios-dsyms.sh" "$archive_path"
