#!/usr/bin/env bash
# Resolves the audit scope into a concrete file list.
#
# Usage:
#   collect_targets.sh full                 # every tracked file in the repo
#   collect_targets.sh path <dir-or-file>   # everything under a path
#   collect_targets.sh diff [<base-ref>]    # files changed vs base-ref; with no ref, uses the
#                                            # working tree (staged + unstaged + untracked) since
#                                            # that's what "review my changes" usually means locally
#
# Prints one relative path per line, tracked files only (respects .gitignore
# since it's all backed by `git ls-files`/`git diff`), skips binary-ish noise
# by extension so the audit doesn't waste tokens reading lockfiles or images.

set -euo pipefail

NOISE_PATTERN='\.(lock|pyc|png|jpg|jpeg|gif|webp|ico|svg|ttf|otf|woff|woff2|mp4|mov|zip|tar|gz|pdf)$|__pycache__|^(package-lock\.json|bun\.lock|bun\.lockb|yarn\.lock)$'

mode="${1:-full}"

case "$mode" in
  full)
    git ls-files
    ;;
  path)
    target="${2:?usage: collect_targets.sh path <dir-or-file>}"
    git ls-files -- "$target"
    ;;
  diff)
    base="${2:-}"
    if [ -z "$base" ]; then
      # No explicit ref: audit the working tree (staged + unstaged + untracked),
      # since that's what "review my changes" means before a commit exists.
      { git diff --name-only --diff-filter=ACMR HEAD; \
        git ls-files --others --exclude-standard; } | sort -u
    else
      git diff --name-only --diff-filter=ACMR "$base"...HEAD
    fi
    ;;
  *)
    echo "unknown scope mode: $mode (expected full|path|diff)" >&2
    exit 1
    ;;
esac | grep -vE "$NOISE_PATTERN" || true
