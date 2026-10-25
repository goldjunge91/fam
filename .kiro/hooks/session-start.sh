#!/bin/bash
# Load the local agent-skills meta-skill as ordinary session context.

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
META_SKILL="$(dirname "$SCRIPT_DIR")/skills/using-agent-skills/SKILL.md"

if [ -r "$META_SKILL" ] && CONTENT="$(cat "$META_SKILL")"; then
  printf '%s\n\n%s\n' \
    'agent-skills loaded. Use the skill discovery flow to choose the right skill for this task.' \
    "$CONTENT"
else
  printf '%s\n' \
    'agent-skills: the using-agent-skills meta-skill is not available. Individual skills may still be available.'
fi

exit 0
