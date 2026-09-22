---
name: ios-build-workflow
description: "Use for an explicit local Fam iOS build or upload request using !ios-build-simulator, !ios-build-testflight, or !ios-build-both. Do not use for Android, general explanations, App Review, or release planning."
---

# iOS build workflow

Use this skill only when the user explicitly asks to build or upload the local
iOS app. For questions about TestFlight or the build process, explain the
workflow without running native commands.

The public prompt triggers use hyphens: `!ios-build-simulator`,
`!ios-build-testflight`, and `!ios-build-both`. They are skill triggers, not
global zsh commands.

Before starting, use the live repository state when needed: `AGENTS.md`,
`app.json`, `eas.json`, and `native-build-lock.json` for fingerprint and
artifact state.

## One entrypoint

Use this single runner from the repository root. Invoke it with `bash`; it does
not need an executable bit:

```bash
bash .codex/skills/ios-build-workflow/scripts/run-ios-build.sh <simulator|testflight|both> [--approve-rebuild]
```

The runner owns the external-storage check, native status, fastpath, rebuild
fallback, fresh-artifact check, and upload. Do not invoke
`native-testflight-fastpath.sh`, `bun run native:rebuild`, or `eas-cli submit`
separately. Use `--approve-rebuild` only after explicit user approval for a
fingerprint drift; without that flag, the runner blocks before the rebuild.

## Process lock

Before starting a mode, the runner creates
`$IOS_BUILD_WORKFLOW_STORAGE_ROOT/native-build.lock` with `mkdir`. If it
already exists, the runner exits with status `75` and leaves the existing lock
untouched. After successful acquisition, the runner removes its empty lock on
normal success, error, `INT`, or `TERM`. A forced kill or host crash cannot run
cleanup; verify that no build is active before removing such a stale directory
manually with `rmdir`.

## Modes

- `simulator` builds and installs the local development simulator target.
- `testflight` validates native state, uses the warm-cache fastpath when
  possible, falls back to the controlled rebuild only for fastpath exit `42`,
  verifies a newly created IPA, and uploads that IPA.
- `both` runs simulator first and TestFlight second. A simulator failure must
  not prevent the TestFlight branch from running.

The TestFlight path must always use the IPA created by the current run. Never
upload a stale or previously registered artifact. The runner must not mutate a
remote EAS build number and must not use `--auto-submit`.

## Safety invariants

- All build data stays under `/Volumes/Programme`. If that volume is not
  mounted, stop; there is no local fallback.
- Once a native build or upload starts, wait for natural exit. Do not run
  `ps`, `pgrep`, `top`, `ccache -s`, or another `native:status`; never call
  `kill`, `pkill`, or `killall`.
- Do not expose credentials. Do not run `prebuild --clean`, `pod install`,
  `native:run`, `native:restore`, or unrelated tests as part of this workflow.

The runner and fastpath enforce Xcode output-path, cache, fingerprint, and
artifact checks. Do not reproduce those checks with a second hand-written
`xcodebuild` command.

## Failure handling

- Fastpath exit `42` is the runner's cache-miss signal. Let the runner perform
  its controlled rebuild; do not run that fallback yourself.
- `Too many open files in system` is an `ENFILE` resource failure, not a cache
  miss. Preserve the output and do not retry inside the active run. A retry
  with a smaller `IOS_BUILD_XCODEBUILD_JOBS` value requires explicit user
  authorization, for example `IOS_BUILD_XCODEBUILD_JOBS=1`.
- Fingerprint, build-path, or other configuration errors are blockers, not
  cache misses. After the runner exits, `bun run native:status -- --diff` may
  be used to explain fingerprint drift. Do not inspect or retry while a native
  command is still active.

## Result reporting

Report every requested mode separately:

1. mode result and exit status;
2. whether the current run produced a fresh IPA;
3. upload and submission state;
4. the concrete blocker or next user action.

After a successful upload, inspect the submission returned by EAS:

```bash
bunx eas-cli submit:view <SUBMISSION_ID> --json
```

Interpret the result precisely:

- `SUCCESS`: upload accepted; Apple processing may still be pending.
- `IN_QUEUE` or `IN_PROGRESS`: submission is pending.
- `ERRORED`, `CANCELED`, or a command failure: report the blocker.

Do not claim TestFlight success without evidence of both the fresh IPA and the
submission status.

## Triggers

- `!ios-build-simulator`
- `!ios-build-testflight`
- `!ios-build-both`
