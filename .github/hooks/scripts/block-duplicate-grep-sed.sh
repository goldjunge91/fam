#!/bin/sh
# PreToolUse hook: blocks repeated tool calls within one agent session.
#
# Rules:
#   - ANY tool called with the exact same arguments twice is denied.
#   - Shell commands containing grep/sed are additionally compared with
#     fuzzy matching (flags stripped, whitespace collapsed, 70% token
#     overlap or subchain counts as "similar") and denied too.
#   - Every allowed call gets a systemMessage explaining why it passed.
#
# Input (stdin): JSON payload from VS Code, e.g.
#   {"toolName":"shell","toolArgs":{"command":"grep -rn foo src/"},"sessionId":"..."}
# Output (stdout): JSON permission decision.

set -eu

STATE_DIR="${TMPDIR:-/tmp}/vscode-hook-dedupe"
mkdir -p "$STATE_DIR"

payload=$(cat)

# Extract fields without requiring jq (best effort, tolerant parsing).
tool=$(printf '%s' "$payload" | sed -n 's/.*"toolName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
session=$(printf '%s' "$payload" | sed -n 's/.*"sessionId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)

[ -n "$tool" ] || exit 0

# Canonical argument fingerprint: the whole payload minus volatile fields,
# whitespace-collapsed and lowercased. Same tool + same args => same key.
key=$(printf '%s' "$payload" \
  | sed 's/"sessionId"[[:space:]]*:[[:space:]]*"[^"]*"//g; s/"timestamp"[[:space:]]*:[[:space:]]*"[^"]*"//g' \
  | tr -s '[:space:]' ' ' | tr '[:upper:]' '[:lower:]' | sed 's/^ //; s/ $//')

[ -n "$key" ] || exit 0

hist_file="$STATE_DIR/history-${session:-default}.txt"
touch "$hist_file"

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}

allow() {
  # Explain on every allowed call why it was not blocked.
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"%s"},"systemMessage":"%s"}\n' "$1" "$1"
  exit 0
}

# --- Rule 1: exact duplicate for ANY tool -----------------------------------
if grep -Fxq "$key" "$hist_file"; then
  deny "Dieser Tool-Aufruf ($tool mit identischen Argumenten) wurde in dieser Session bereits ausgefuehrt. Nutze das bestehende Ergebnis statt den Aufruf zu wiederholen."
fi

# --- Rule 2: fuzzy duplicate for shell grep/sed chains ----------------------
cmd=$(printf '%s' "$payload" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)

case "$tool" in
  shell|bash|terminal|run_in_terminal) ;;
  *) printf '%s\n' "$key" >> "$hist_file"; allow "Erster Aufruf von $tool mit diesen Argumenten: erlaubt und vermerkt." ;;
esac

case "$cmd" in
  *grep*|*sed*) ;;
  *) printf '%s\n' "$key" >> "$hist_file"; allow "Shell-Befehl ohne grep/sed: nur exakte-Duplikat-Regel aktiv, kein frueherer identischer Aufruf." ;;
esac

# Normalize: strip flags, collapse whitespace, lowercase.
norm=$(printf '%s' "$cmd" | tr -s '[:space:]' ' ' | sed 's/ -[a-zA-Z]\+//g; s/ -\{1,2\}[a-zA-Z]\+ [^ ]*//g' | tr '[:upper:]' '[:lower:]' | sed 's/^ //; s/ $//')

[ -n "$norm" ] || { printf '%s\n' "$key" >> "$hist_file"; allow "grep/sed-Befehl konnte nicht normalisiert werden: nur exakte-Duplikat-Regel aktiv." ; }

norm_file="$STATE_DIR/norm-${session:-default}.txt"
touch "$norm_file"

while IFS= read -r prev; do
  [ -n "$prev" ] || continue

  if [ "$norm" = "$prev" ]; then
    deny "Identischer grep/sed-Befehl wurde in dieser Session bereits ausgefuehrt: $prev. Nutze das bestehende Ergebnis oder variiere gezielt."
  fi

  # Subchain: one command fully contained in the other.
  case "$prev" in
    *"$norm"*)
      deny "Aehnliche grep/sed-Befehlskette (Teilmenge von $prev) wurde bereits ausgefuehrt. Pruefe zuerst das fruehere Ergebnis."
      ;;
  esac

  # Token overlap >= 70% counts as "similar chain".
  overlap=$(printf '%s' "$norm" | tr ' ' '\n' | sort > "/tmp/.h_new.$$"; printf '%s' "$prev" | tr ' ' '\n' | sort > "/tmp/.h_old.$$"; comm -12 /tmp/.h_new.$$ /tmp/.h_old.$$ | wc -l; rm -f /tmp/.h_new.$$ /tmp/.h_old.$$)
  total=$(printf '%s' "$norm" | tr ' ' '\n' | sort -u | wc -l)
  if [ "$total" -gt 0 ] && [ "$overlap" -ge $(( total * 7 / 10 )) ]; then
    deny "grep/sed-Befehl ist zu aehnlich einem bereits ausgefuehrten Befehl ($prev): $overlap von $total Token ueberlappen (Schwelle 70%). Variiere das Muster oder die Zieldateien deutlich."
  fi
done < "$norm_file"

# Not blocked: record and allow.
printf '%s\n' "$key" >> "$hist_file"
printf '%s\n' "$norm" >> "$norm_file"
allow "Neuer grep/sed-Befehl: keine identische oder aehnliche (>=70% Token-Overlap) fruehere Kette gefunden. Aufruf wird vermerkt."
