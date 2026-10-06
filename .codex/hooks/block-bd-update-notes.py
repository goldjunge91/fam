#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shlex
import sys

COMMAND_WRAPPERS = {"builtin", "command", "doas", "env", "exec", "nice", "nohup", "setsid", "sudo"}
REDIRECTION_OPERATORS = {"&>", "&>>", "<", "<<", "<<<", "<&", ">", ">>", ">&", ">|"}
SHELL_BOUNDARIES = {"(", ")", ";", "&&", "||", "|", "&", "{", "}"}
SHELL_KEYWORDS = {"case", "do", "done", "elif", "else", "esac", "fi", "for", "if", "in", "then", "until", "while"}
ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=.*$")


def reject(reason: str) -> None:
    print(f"Blocked: {reason}", file=sys.stderr)
    raise SystemExit(2)


def is_assignment(token: str) -> bool:
    return bool(ASSIGNMENT.fullmatch(token))


def executable_name(token: str) -> str:
    return token.rsplit("/", maxsplit=1)[-1]


def split_segments(tokens: list[str]) -> list[list[str]]:
    segments: list[list[str]] = []
    current: list[str] = []
    for token in tokens:
        if token in SHELL_BOUNDARIES:
            if current:
                segments.append(current)
                current = []
        else:
            current.append(token)
    if current:
        segments.append(current)
    return segments


def skip_redirection(segment: list[str], index: int) -> int | None:
    token = segment[index]
    if token in REDIRECTION_OPERATORS:
        return min(index + 2, len(segment))
    if token.isdigit() and index + 1 < len(segment) and segment[index + 1] in REDIRECTION_OPERATORS:
        return min(index + 3, len(segment))
    return None


def command_index(segment: list[str]) -> int | None:
    index = 0
    while index < len(segment):
        token = segment[index]
        redirection_end = skip_redirection(segment, index)
        if redirection_end is not None:
            index = redirection_end
            continue
        if token in SHELL_KEYWORDS or is_assignment(token):
            index += 1
            continue
        if token in COMMAND_WRAPPERS:
            index += 1
            while index < len(segment):
                wrapper_token = segment[index]
                if wrapper_token == "--":
                    index += 1
                    break
                if is_assignment(wrapper_token):
                    index += 1
                    continue
                if not wrapper_token.startswith("-"):
                    break
                index += 1
                if wrapper_token in {"-a", "-C", "-n", "-u", "--chdir", "--user"} and index < len(segment):
                    index += 1
            continue
        return index
    return None


def is_bd_update_with_notes(segment: list[str]) -> bool:
    index = command_index(segment)
    if index is None or executable_name(segment[index]) not in {"bd", "bd.exe"}:
        return False

    args = segment[index + 1 :]
    if not args or args[0] != "update":
        return False

    for token in args[1:]:
        if token == "--":
            return False
        if token == "--notes" or token.startswith("--notes="):
            return True
    return False


try:
    payload = json.load(sys.stdin)
except (json.JSONDecodeError, OSError) as error:
    reject(f"Codex hook input could not be parsed: {error}")

if not isinstance(payload, dict):
    reject("Codex hook input must be a JSON object.")

tool_input = payload.get("tool_input")
if not isinstance(tool_input, dict):
    reject("Codex did not provide a readable Bash command.")

command = tool_input.get("command")
if not isinstance(command, str) or not command:
    reject("Codex did not provide a readable Bash command.")

try:
    lexer = shlex.shlex(command, posix=True, punctuation_chars="();<>|&{}")
    lexer.commenters = ""
    lexer.whitespace_split = True
    tokens = list(lexer)
except ValueError as error:
    reject(f"Bash command could not be tokenized safely: {error}")

if any(is_bd_update_with_notes(segment) for segment in split_segments(tokens)):
    reject("bd update --notes is disabled by the repository policy.")
