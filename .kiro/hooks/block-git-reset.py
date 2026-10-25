#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shlex
import sys

COMMAND_WRAPPERS = {"builtin", "command", "doas", "env", "exec", "nice", "nohup", "setsid", "sudo"}
GIT_OPTIONS_WITH_VALUES = {"-C", "-c", "--exec-path", "--git-dir", "--namespace", "--super-prefix", "--work-tree"}
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


def is_git_reset(segment: list[str]) -> bool:
    index = command_index(segment)
    if index is None or executable_name(segment[index]) not in {"git", "git.exe"}:
        return False

    index += 1
    while index < len(segment):
        token = segment[index]
        if token == "reset":
            return True
        if token == "--":
            return index + 1 < len(segment) and segment[index + 1] == "reset"
        if token in GIT_OPTIONS_WITH_VALUES:
            index += 2
            continue
        if token.startswith(("--exec-path=", "--git-dir=", "--namespace=", "--super-prefix=", "--work-tree=")):
            index += 1
            continue
        if token.startswith("-C") or token.startswith("-c"):
            index += 1
            continue
        if token.startswith("-"):
            index += 1
            continue
        return False
    return False


def is_powershell_command(tool_name: object) -> bool:
    return isinstance(tool_name, str) and tool_name.lower() in {"execute_pwsh", "powershell", "pwsh"}


def may_contain_powershell_git_reset(command: str) -> bool:
    # PowerShell can pass nested commands to Invoke-Expression or another
    # process. If both terms appear, fail closed instead of parsing it as POSIX.
    has_git = re.search(r"(?i)(?<![\w.-])git(?:\.exe)?(?![\w.-])", command)
    has_reset = re.search(r"(?i)(?<![\w-])reset(?![\w-])", command)
    return bool(has_git and has_reset)


try:
    payload = json.load(sys.stdin)
except (json.JSONDecodeError, OSError, UnicodeDecodeError) as error:
    reject(f"Hook input could not be parsed: {error}")

if not isinstance(payload, dict):
    reject("Hook input must be a JSON object.")

tool_input = payload.get("tool_input")
if not isinstance(tool_input, dict):
    reject("Hook input did not contain a readable shell command.")

command = tool_input.get("command")
if not isinstance(command, str) or not command:
    reject("Hook input did not contain a readable shell command.")

if is_powershell_command(payload.get("tool_name")):
    if may_contain_powershell_git_reset(command):
        reject("PowerShell command contains git and reset tokens and cannot be safely validated.")
    raise SystemExit(0)

try:
    lexer = shlex.shlex(command, posix=True, punctuation_chars="();<>|&{}")
    lexer.commenters = ""
    lexer.whitespace_split = True
    tokens = list(lexer)
except ValueError as error:
    reject(f"Shell command could not be tokenized safely: {error}")

if any(is_git_reset(segment) for segment in split_segments(tokens)):
    reject("git reset is disabled by repository policy.")
