#!/bin/bash
# Hide simplify-ignore blocks while a Kiro read is in progress, restore them
# after writes, and restore every outstanding backup at Stop.

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
CACHE="$SCRIPT_DIR/.simplify-ignore-cache"
WORKSPACE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$WORKSPACE_ROOT" ]; then
  WORKSPACE_ROOT="$(CDPATH= cd -- "$WORKSPACE_ROOT" && pwd -P)" || WORKSPACE_ROOT=""
fi

# This hook must not block Kiro when optional parsing or hashing tools are absent.
if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' 'simplify-ignore: jq is unavailable; leaving the file unchanged.' >&2
  exit 0
fi

INPUT=$(cat 2>/dev/null || true)
parse_error=""
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null) || {
  parse_error="failed to parse tool_name from hook input"
  TOOL_NAME=""
}
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.path // .tool_input.file_path // empty' 2>/dev/null) || {
  parse_error="failed to parse tool path from hook input"
  FILE_PATH=""
}
if [ -n "$parse_error" ]; then
  printf 'Warning: %s (input: %.120s)\n' "$parse_error" "$INPUT" >&2
  exit 0
fi

hash_cmd() {
  if command -v shasum >/dev/null 2>&1; then shasum
  elif command -v sha1sum >/dev/null 2>&1; then sha1sum
  else return 1
  fi
}
file_id() { printf '%s' "$1" | hash_cmd | cut -c1-16; }
block_hash() { printf '%s' "$1" | hash_cmd | cut -c1-8; }

workspace_file_path() {
  local path="$1" absolute_path parent
  [ -n "$WORKSPACE_ROOT" ] && [ -n "$path" ] || return 1
  case "$path" in
    *$'\n'*) return 1 ;;
    /*) absolute_path="$path" ;;
    *) absolute_path="$PWD/$path" ;;
  esac
  [ ! -L "$absolute_path" ] || return 1
  parent="$(CDPATH= cd -- "$(dirname -- "$absolute_path")" 2>/dev/null && pwd -P)" || return 1
  case "$parent/" in
    "$WORKSPACE_ROOT/"*) printf '%s/%s' "$parent" "$(basename -- "$absolute_path")" ;;
    *) return 1 ;;
  esac
}

clear_file_cache() {
  local id="$1"
  rm -f "$CACHE/${id}.bak" "$CACHE/${id}.path" "$CACHE/${id}.filtered" \
    "$CACHE/${id}".block.* "$CACHE/${id}".reason.* "$CACHE/${id}".prefix.* \
    "$CACHE/${id}".suffix.*
}

recover_backup() {
  local backup="$1" original="$2" id="$3" recovered
  recovered="${original}.recovered.$$.${RANDOM}"
  while [ -e "$recovered" ] || [ -L "$recovered" ]; do
    recovered="${original}.recovered.$$.${RANDOM}"
  done
  if mv "$backup" "$recovered"; then
    clear_file_cache "$id"
    printf 'Warning: left %s unchanged and recovered the protected content to %s\n' \
      "$original" "$recovered" >&2
  else
    printf 'Warning: could not recover the protected content for %s; backup remains at %s\n' \
      "$original" "$backup" >&2
  fi
}

escape_glob() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\*/\\*}"
  value="${value//\?/\\?}"
  value="${value//\[/\\[}"
  printf '%s' "$value"
}

filter_file() {
  local src="$1" dest="$2" fid="$3"
  : > "$dest"
  rm -f "$CACHE/${fid}".block.* "$CACHE/${fid}".reason.* "$CACHE/${fid}".prefix.* "$CACHE/${fid}".suffix.*

  local count=0 in_block=0 buf="" reason="" prefix="" suffix=""
  while IFS= read -r line || [ -n "$line" ]; do
    if [ "$in_block" -eq 0 ]; then
      case "$line" in
        *simplify-ignore-start*)
          in_block=1
          buf="$line"
          prefix="${line%%simplify-ignore-start*}"
          suffix=""
          case "$line" in *'*/'*) suffix=" */" ;; *'-->'*) suffix=" -->" ;; esac
          reason=$(printf '%s' "$line" | sed -n 's/.*simplify-ignore-start:[[:space:]]*//p' \
            | sed 's/[[:space:]]*\*\/.*$//' | sed 's/[[:space:]]*-->.*$//' | sed 's/[[:space:]]*$//')
          case "$line" in
            *simplify-ignore-end*)
              in_block=0
              local single_hash
              single_hash=$(block_hash "$buf")
              count=$((count + 1))
              printf '%s' "$buf" > "$CACHE/${fid}.block.${single_hash}"
              [ -n "$reason" ] && printf '%s' "$reason" > "$CACHE/${fid}.reason.${single_hash}"
              printf '%s' "$prefix" > "$CACHE/${fid}.prefix.${single_hash}"
              printf '%s' "$suffix" > "$CACHE/${fid}.suffix.${single_hash}"
              if [ -n "$reason" ]; then
                printf '%s\n' "${prefix}BLOCK_${single_hash}: ${reason}${suffix}" >> "$dest"
              else
                printf '%s\n' "${prefix}BLOCK_${single_hash}${suffix}" >> "$dest"
              fi
              buf=""; reason=""; prefix=""; suffix=""
              continue
              ;;
          esac
          continue
          ;;
      esac
    fi

    if [ "$in_block" -eq 1 ]; then
      buf="${buf}
${line}"
    fi
    case "$line" in
      *simplify-ignore-end*)
        if [ "$in_block" -eq 1 ]; then
          local block_id
          block_id=$(block_hash "$buf")
          count=$((count + 1))
          printf '%s' "$buf" > "$CACHE/${fid}.block.${block_id}"
          [ -n "$reason" ] && printf '%s' "$reason" > "$CACHE/${fid}.reason.${block_id}"
          printf '%s' "$prefix" > "$CACHE/${fid}.prefix.${block_id}"
          printf '%s' "$suffix" > "$CACHE/${fid}.suffix.${block_id}"
          if [ -n "$reason" ]; then
            printf '%s\n' "${prefix}BLOCK_${block_id}: ${reason}${suffix}" >> "$dest"
          else
            printf '%s\n' "${prefix}BLOCK_${block_id}${suffix}" >> "$dest"
          fi
          in_block=0; buf=""; reason=""; prefix=""; suffix=""
          continue
        fi
        ;;
    esac
    [ "$in_block" -eq 0 ] && printf '%s\n' "$line" >> "$dest"
  done < "$src"

  if [ "$in_block" -eq 1 ] && [ -n "$buf" ]; then
    printf 'Warning: unclosed simplify-ignore-start in %s (block not hidden)\n' "$src" >&2
    printf '%s\n' "$buf" >> "$dest"
  fi

  if [ -s "$dest" ] && [ -s "$src" ] && [ -n "$(tail -c 1 "$src")" ]; then
    perl -pe 'chomp if eof' "$dest" > "${dest}.nnl"
    cat "${dest}.nnl" > "$dest"
    rm -f "${dest}.nnl"
  fi

  [ "$count" -gt 0 ]
}

restore_backups() {
  [ -d "$CACHE" ] || return 0
  for backup in "$CACHE"/*.bak; do
    [ -f "$backup" ] || continue
    local id="${backup##*/}" path_file original filtered
    id="${id%.bak}"
    path_file="$CACHE/${id}.path"
    filtered="$CACHE/${id}.filtered"
    [ -f "$path_file" ] || {
      printf 'Warning: backup %s has no path record and was left in place\n' "$backup" >&2
      continue
    }
    original=$(cat "$path_file")
    original="$(workspace_file_path "$original" 2>/dev/null)" || {
      printf 'Warning: backup for an out-of-workspace or symbolic path was left at %s\n' "$backup" >&2
      continue
    }
    if [ -f "$original" ] && [ -f "$filtered" ] && command -v cmp >/dev/null 2>&1 \
      && cmp -s "$original" "$filtered"; then
      cat "$backup" > "$original"
      clear_file_cache "$id"
      rmdir "$CACHE/${id}.lock" 2>/dev/null || true
    else
      recover_backup "$backup" "$original" "$id"
      rmdir "$CACHE/${id}.lock" 2>/dev/null || true
    fi
  done

  for lockdir in "$CACHE"/*.lock; do
    [ -d "$lockdir" ] || continue
    rmdir "$lockdir" 2>/dev/null || true
  done
}

# Kiro's matcherless Stop invocation has no tool_name. It restores backups and
# never emits a blocking decision. A valid empty payload remains useful for
# manual crash recovery as well.
if [ -z "$TOOL_NAME" ]; then
  restore_backups
  exit 0
fi

if ! command -v shasum >/dev/null 2>&1 && ! command -v sha1sum >/dev/null 2>&1; then
  printf '%s\n' 'simplify-ignore: shasum or sha1sum is unavailable; leaving files unchanged.' >&2
  exit 0
fi

[ -n "$FILE_PATH" ] || exit 0
FILE_PATH="$(workspace_file_path "$FILE_PATH" 2>/dev/null)" || exit 0

case "$TOOL_NAME" in
  read|Read|fs_read|read_file)
    [ -f "$FILE_PATH" ] || exit 0
    case "$(basename -- "$FILE_PATH")" in simplify-ignore*|SIMPLIFY-IGNORE*) exit 0 ;; esac
    mkdir -p "$CACHE"
    ID=$(file_id "$FILE_PATH")
    [ -f "$CACHE/${ID}.bak" ] && exit 0
    grep -q 'simplify-ignore-start' -- "$FILE_PATH" || exit 0

    if ! mkdir "$CACHE/${ID}.lock" 2>/dev/null; then
      if [ ! -f "$CACHE/${ID}.bak" ] && [ -n "$(find "$CACHE/${ID}.lock" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then
        rmdir "$CACHE/${ID}.lock" 2>/dev/null || true
        mkdir "$CACHE/${ID}.lock" 2>/dev/null || exit 0
      else
        exit 0
      fi
    fi

    cp -p "$FILE_PATH" "$CACHE/${ID}.bak" 2>/dev/null || cp "$FILE_PATH" "$CACHE/${ID}.bak"
    printf '%s' "$FILE_PATH" > "$CACHE/${ID}.path"
    FILTERED="$CACHE/${ID}.$$.tmp"
    rm -f "$FILTERED"
    if filter_file "$FILE_PATH" "$FILTERED" "$ID"; then
      mv "$FILTERED" "$CACHE/${ID}.filtered"
      cat "$CACHE/${ID}.filtered" > "$FILE_PATH"
      rm -f "$FILTERED"
    else
      rm -f "$FILTERED" "$CACHE/${ID}.bak" "$CACHE/${ID}.path"
      rmdir "$CACHE/${ID}.lock" 2>/dev/null || true
    fi
    exit 0
    ;;

  write|Write|edit|Edit|fs_write|fs_append|str_replace)
    ID=$(file_id "$FILE_PATH")
    [ -f "$CACHE/${ID}.bak" ] || exit 0
    [ -f "$FILE_PATH" ] || exit 0
    ls "$CACHE/${ID}".block.* >/dev/null 2>&1 || exit 0

    EXPANDED="$CACHE/${ID}.$$.expanded"
    rm -f "$EXPANDED"
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in
        *BLOCK_*)
          for block_file in "$CACHE/${ID}".block.*; do
            [ -f "$block_file" ] || continue
            block_id="${block_file##*.}"
            case "$line" in
              *"BLOCK_${block_id}"*)
                block_prefix=""; block_suffix=""; block_reason=""
                [ -f "$CACHE/${ID}.prefix.${block_id}" ] && block_prefix=$(cat "$CACHE/${ID}.prefix.${block_id}")
                [ -f "$CACHE/${ID}.suffix.${block_id}" ] && block_suffix=$(cat "$CACHE/${ID}.suffix.${block_id}")
                [ -f "$CACHE/${ID}.reason.${block_id}" ] && block_reason=$(cat "$CACHE/${ID}.reason.${block_id}")
                if [ -n "$block_reason" ]; then
                  placeholder="${block_prefix}BLOCK_${block_id}: ${block_reason}${block_suffix}"
                else
                  placeholder="${block_prefix}BLOCK_${block_id}${block_suffix}"
                fi
                block_content=$(cat "$block_file"; printf x)
                block_content="${block_content%x}"
                escaped_placeholder=$(escape_glob "$placeholder")
                line="${line//$escaped_placeholder/$block_content}"
                case "$block_content" in *"BLOCK_${block_id}"*) ;; *)
                  case "$line" in *"BLOCK_${block_id}"*)
                    printf 'Warning: placeholder BLOCK_%s was modified; using fuzzy match\n' "$block_id" >&2
                    escaped_fuzzy=$(escape_glob "${block_prefix}BLOCK_${block_id}${block_suffix}")
                    line="${line//$escaped_fuzzy/$block_content}"
                    case "$line" in *"BLOCK_${block_id}"*) line="${line//BLOCK_${block_id}/$block_content}" ;; esac
                  ;; esac
                ;; esac
                ;;
            esac
          done
          ;;
      esac
      printf '%s\n' "$line" >> "$EXPANDED"
    done < "$FILE_PATH"

    if [ -s "$EXPANDED" ] && [ -s "$FILE_PATH" ] && [ -n "$(tail -c 1 "$FILE_PATH")" ]; then
      perl -pe 'chomp if eof' "$EXPANDED" > "${EXPANDED}.nnl"
      cat "${EXPANDED}.nnl" > "$EXPANDED"
      rm -f "${EXPANDED}.nnl"
    fi

    for block_file in "$CACHE/${ID}".block.*; do
      [ -f "$block_file" ] || continue
      block_id="${block_file##*.}"
      if ! grep -qF "BLOCK_${block_id}" "$EXPANDED" 2>/dev/null; then
        first_line=$(head -1 "$block_file")
        if ! grep -qF "$first_line" "$EXPANDED" 2>/dev/null; then
          printf 'Warning: protected block BLOCK_%s was deleted by the tool\n' "$block_id" >&2
        fi
      fi
    done

    cat "$EXPANDED" > "$FILE_PATH"
    rm -f "$EXPANDED"
    cp "$FILE_PATH" "$CACHE/${ID}.bak"
    FILTERED="$CACHE/${ID}.$$.tmp"
    rm -f "$FILTERED"
    if filter_file "$FILE_PATH" "$FILTERED" "$ID"; then
      mv "$FILTERED" "$CACHE/${ID}.filtered"
      cat "$CACHE/${ID}.filtered" > "$FILE_PATH"
      rm -f "$FILTERED"
    fi
    cp "$FILE_PATH" "$CACHE/${ID}.filtered"
    exit 0
    ;;
esac

exit 0
