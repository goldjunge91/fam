---
name: ios-build-workflow
description: Run Fam's repeatable iOS Simulator and preview TestFlight workflow through explicit !ios-build triggers, with cache-aware fresh IPA builds, Xcode build-path preflight, mandatory upload, and status verification. Do not use for Android, cloud simulators, App Review submission, or production release planning.
---

# Fam iOS Build Workflow

Use this skill for the repository's local iOS verification path. Read the live project files before acting: `AGENTS.md`, `app.json`, `eas.json`, `native-build-lock.json`, and `docs/architecture/EAS_BUILD_COMMANDS.md`. For store-release policy or App Store Connect review work, also use the existing `apple-app-store-release` skill.

## Execution contract

- Treat the Simulator and TestFlight paths as independent modes. A Simulator result neither gates nor authorizes the TestFlight path, and a failed Simulator build must not stop a requested TestFlight build and upload.
- When both modes are requested, execute and report them independently. They may be run one after the other when local Xcode resources make parallel builds unsafe, but never make the second mode conditional on the first mode's result.
- The explicit triggers are `!ios-build simulator`, `!ios-build testflight`, and `!ios-build both`. `both` may run the two local branches one after the other for resource safety, but the TestFlight branch must still run after a Simulator failure.
- In this project, `!ios-build testflight` means a fresh build plus upload of the produced IPA. Do not stop after creating the IPA.
- The TestFlight path always produces a new app-specific version/build, archive, signature, and IPA, and always uploads that newly produced IPA after a successful build. A previously registered IPA must not be used as a substitute for the current run's artifact.
- Building an artifact, uploading it, submitting a version for App Review, and releasing a version remain distinct operations. TestFlight mode combines only the first two.
- The explicit hook executes the requested runner synchronously. After it has run, do not repeat the commands automatically. Ordinary prose remains non-executing and only selects this skill for guidance.
- A running native build or upload is an exclusive critical section. Once `native:dev`, the fastpath, `native:rebuild`, `xcodebuild archive`, `xcodebuild -exportArchive`, or `eas submit` has started, wait passively for that same child process to exit naturally.
- During that critical section, never run `ps`, `pgrep`, `top`, `ccache -s`, extra `native:status`, log-polling commands, or parallel builds. Never read or edit project/build files, change a version or build number, correct inputs, retry, choose a fallback, or inspect a second artifact while the process is active.
- Never call `kill`, `pkill`, `killall`, send `SIGINT`/`SIGTERM`, press Ctrl-C, terminate a shell or child process, or otherwise abort a build automatically. Only an explicit user cancellation request can authorize stopping it.
- A hook timeout, warning, apparent hang, or unexpected output is not permission to intervene. The configured hook timeout is deliberately longer than the expected 30–40 minute build and upload window; report an external timeout as incomplete/unknown and do not restart or repair the run automatically.
- Evaluate fallback and post-build status only after the relevant child process has returned. A cache-preflight fallback is a post-exit decision, never an action against a running build.
- Treat `expo.version` and `expo.ios.buildNumber` as separate values. The app version stays semantic (for example `0.0.6`); the iOS build number is an integer `CFBundleVersion` (for example `22`, followed by `23`), never `0.0.23`.
- The hook, runner, and fastpath must never invoke `eas build:version:set` or `eas build:version:sync`. If the remote EAS build number is dotted or otherwise non-integer, fail the preflight before any build/rebuild/upload and report that a separate explicit EAS version preflight is required.
- Do not expose credentials or copy secret values into output.

## Known Xcode build-location finding

The local macOS host has Xcode custom build locations configured globally. A
plain `-derivedDataPath` does not guarantee that `OBJROOT`, `SYMROOT`, and
`SHARED_PRECOMPS_DIR` use that directory. The host was observed reporting:

```text
OBJROOT = /Volumes/Programme/Xcode/DeveloperFolder/Build/Intermediates
SYMROOT = /Volumes/Programme/Xcode/DeveloperFolder/Build/Products
```

The fastpath must therefore pass explicit per-run build settings and validate
the effective values before archiving:

```bash
xcodebuild ... \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  OBJROOT="$DERIVED_DATA_PATH/Build/Intermediates.noindex" \
  SYMROOT="$DERIVED_DATA_PATH/Build/Products" \
  SHARED_PRECOMPS_DIR="$DERIVED_DATA_PATH/Build/Intermediates.noindex/PrecompiledHeaders"
```

Use `xcodebuild -showBuildSettings` with the same overrides and stop before
`archive` if any build-output setting escapes `DERIVED_DATA_PATH`. Treat this
as a configuration error, not as a cache miss, so it must not fall through to
the rebuild fallback. Apple documents that `OBJROOT` and `SYMROOT` are
affected by custom Xcode build locations: [Build Setting Reference](https://developer.apple.com/library/archive/documentation/DeveloperTools/Reference/XcodeBuildSettingRef/1-Build_Setting_Reference/build_setting_ref.html).

The runner owns one filesystem lock for the complete native workflow. This
covers Simulator, TestFlight, and `both`, including archive, export, and
upload. A second invocation stops safely while the lock is held. A stale lock
is never removed automatically; first verify that no workflow is active, then
remove it deliberately before retrying.

## Active build critical section

The command that starts a native build owns the terminal until it exits. This
rule applies equally to the Simulator branch, the cache-aware TestFlight
fastpath, the controlled rebuild fallback, archive/export, and the EAS upload.
The hook and the skill must not turn progress observation into intervention:

1. Start the requested command synchronously.
2. Leave its process tree and its inputs untouched while it runs. The runner
   acquires the workflow lock before starting a native command. Do not poll
   with process or cache diagnostics, tail logs through a second command, or
   make corrective edits.
3. Continue only after the command has returned an exit code.
4. Interpret that exit code and then, if the workflow explicitly requires it,
   run the next post-exit status, fallback, or upload step.

If a command is slow, the correct behavior is still to wait. Do not infer that
it is stuck from elapsed time or warnings. The only exception is a direct,
explicit user request to cancel the active operation.

## Simulator stage

Before a release build, run the read-only lock check:

```bash
bun run native:status
```

If the status reports drift, inspect it with `bun run native:status -- --diff`. Do not hide unexpected drift. For the requested local development build, use the repository wrapper:

```bash
bun run native:dev -- --target ios-development-simulator
```

Add `--device <name>` only when the user selected a specific simulator. `native:dev` is the development inner loop and is allowed to compile without the release rebuild lock. Report a failed compile or install as the Simulator result, but do not use it to block a separately requested TestFlight build and upload. If only the final macOS automatic-open handoff fails after a confirmed successful compile/install, report that as a separate launch limitation rather than calling the compile failed.

## TestFlight stage

For this repeatable local workflow, the TestFlight path is cache-aware: validate first, use the fastpath when the native state and compile caches match, fall back to the controlled rebuild only when they do not, and then upload the new IPA. The runner starts with the read-only check:

```bash
bun run native:status
```

`native:status` verifies the native fingerprint and the registered artifact without changing either. If it fails because the artifact or fingerprint no longer matches, the runner uses the explicit fallback:

```bash
bun run native:rebuild -- --target ios-preview-testflight --approve-rebuild </dev/null
```

`native:rebuild` is therefore an exception path, not the normal TestFlight path. It may run `expo prebuild --clean`, `pod install`, and a complete local build when the reuse assumptions are no longer safe.

When `native:status` succeeds, the runner calls the fastpath. The fastpath
preflight must complete in this order:

1. Validate the required tools, ccache, CocoaPods checkout, workspace, and
   warm Release DerivedData.
2. Run `xcodebuild -showBuildSettings` with the exact `OBJROOT`, `SYMROOT`,
   and `SHARED_PRECOMPS_DIR` overrides that the archive will use.
3. Verify that `BUILD_DIR`, `CONFIGURATION_BUILD_DIR`,
   `CONFIGURATION_TEMP_DIR`, `MODULE_CACHE_DIR`, `OBJROOT`, `SYMROOT`,
   `SHARED_PRECOMPS_DIR`, and the other generated-output paths remain inside
   the selected DerivedData directory.
4. Read and validate the remote integer build number.
5. Create the new archive and IPA, then verify its metadata.

The settings preflight is read-only and must stop with a configuration error
before `xcodebuild archive` when the effective paths are unsafe. Exit code 42
continues to mean cache-preflight failure and is the only fastpath result that
may select the controlled rebuild fallback. Configuration errors, metadata
mismatches, and real compile or signing failures must not trigger a retry.

The settings parser runs with `pipefail` enabled and must consume the complete
`xcodebuild -showBuildSettings` stream. Do not let `awk` exit after the first
match in a producer-consumer pipeline, because the producer can receive
SIGPIPE and turn a successful preflight into exit 141.

The fastpath command is:

```bash
bash scripts/native-testflight-fastpath.sh
```

The fastpath requires the existing CocoaPods checkout, a populated `ccache`, and matching Release `DerivedData`. It does not run `prebuild --clean`, `pod install`, `native:run`, or `native:restore`. It reuses the compiled Expo/React-Native/Pod/Xcode inputs through `ccache` and `DerivedData`, pins Xcode's effective build paths into that DerivedData tree, overrides only the new app build/version values, creates a new signed archive and IPA with `xcodebuild`, verifies the exported IPA's `CFBundleShortVersionString` and integer `CFBundleVersion`, and refreshes the artifact hash in the lock. A cache-preflight exit code falls back to `native:rebuild`; a non-integer remote build-number configuration error, unsafe effective build paths, metadata mismatch, and real compile/signing failure are reported without a rebuild or silent retry.

The intended order is:

1. `native:status` checks fingerprint and registered artifact.
2. Existing compile caches are accepted only when `ccache` and Release `DerivedData` are present and the Pods checkout matches.
3. A new integer build number, archive, signature, and IPA are created; the IPA must contain the expected app version and `CFBundleVersion`.
4. Only that newly created IPA at `native-artifacts/ios-preview-testflight/fam.ipa` is submitted.

Confirm the newly created artifact and lock state before submitting:

```bash
bun run native:status
```

The `</dev/null` keeps the build's optional interactive upload offer disabled so the upload happens exactly once in the next step. Do not use `--auto-submit` for this workflow. Upload is mandatory for TestFlight mode. Submit the exact artifact produced by this run:

```bash
bunx eas-cli submit --platform ios --profile preview-testflight --path native-artifacts/ios-preview-testflight/fam.ipa
```

Record the EAS submission ID or URL without recording credentials. Verify it once with:

```bash
bunx eas-cli submit:view <SUBMISSION_ID> --json
```

Interpret the result precisely:

- `SUCCESS`: EAS accepted the upload; Apple processing may still be pending.
- `IN_QUEUE` or `IN_PROGRESS`: the external submission is pending, not a completed upload. Report the submission URL/ID and stop bounded local waiting.
- `ERRORED`, `CANCELED`, or a command failure: report the concrete blocker and do not claim TestFlight success.

This workflow ends at the TestFlight upload. It does not submit for App Review or release the App Store version.
