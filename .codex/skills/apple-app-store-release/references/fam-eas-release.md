# fam EAS release path

Use this repository-specific reference before suggesting or executing iOS release commands. Re-read the files named below because profiles and scripts may change.

## Inspect first

- `AGENTS.md` for the active project rules.
- `app.json` for bundle ID, app version, permissions, privacy manifest, encryption declaration, plugins, and EAS project ID.
- `eas.json` for the current build and submit profiles.
- `native-build-lock.json` and `docs/native-fingerprint-drift-debugging.md` for the native fingerprint contract.
- `docs/EAS_BUILD_COMMANDS.md` for repository-approved command forms.
- `docs/revenuecat/App Subscription Launch Checklist.md` when subscriptions are in the release.
- Environment selection and release keys without printing secret values.

Do not reuse values copied into this reference as truth. The live files win.

## Current profile intent

- `preview-testflight`: store-distribution iOS build for TestFlight validation, using the preview environment.
- `production`: store-distribution iOS build for the production App Store release, using the production environment.
- EAS uses remote app-version state. Check current remote version and build behavior before assuming values from `app.json`.

The upload destination alone does not distinguish a beta from a production release. EAS submission uploads to App Store Connect and TestFlight; the selected App Store version and explicit App Review submission determine production review.

## Repository release lock

Run the read-only native status check before proposing a release build:

```bash
bun run native:status
```

If it reports drift, inspect the source:

```bash
bun run native:status -- --diff
```

Do not paper over drift. Read `docs/native-fingerprint-drift-debugging.md`, determine whether the change is intentional, and explain the rebuild consequence. A baseline update or rebuild requires the project's explicit `--approve-rebuild` switch and user authorization.

Project-controlled local release builds are:

```bash
bun run native:rebuild -- --target ios-preview-testflight --approve-rebuild
bun run native:rebuild -- --target ios-production --approve-rebuild
```

Direct cloud operations documented by the repository include:

```bash
eas build --profile preview-testflight --platform ios
eas submit --profile preview-testflight --platform ios
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

Never run these from the skill merely because they are listed. Confirm build cost, target profile, environment, app, version and build, and requested mutation first. Prefer a specific build ID or artifact path for submission when ambiguity about `latest` could select the wrong build.

## Project-specific release checks

- Ensure production notification entitlements and push credentials are correct for store distribution.
- Verify the production Supabase and backend environment and public support and privacy URLs stay reachable during review.
- Verify RevenueCat uses the App Store production key and that products, offerings, entitlements, restore, and review access work. Never ship a Test Store key.
- Reconcile PostHog, Sentry, ads, location, notifications, camera and photos, Apple sign-in, and other SDK behavior with App Privacy answers and consent flows.
- Test strict private and household data separation, offline and outbox behavior, and account deletion on the release candidate because they are core trust promises.
- Follow the repository's targeted-test rule and required quality gates. Never substitute `bun test` for the configured Jest command.

## Submission configuration gap check

At the time this reference was created, `preview-testflight` contained an App Store Connect app ID while `production` did not. Re-read `eas.json`; if production submission cannot resolve the app record unambiguously, stop and ask the owner to confirm the intended App Store Connect app before changing configuration or submitting.
