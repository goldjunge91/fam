# Plan: Auth Bootstrap and Secure Storage Recovery

**Status:** Review required before implementation

**Spec:** [docs/specs/auth-bootstrap-recovery/SPEC.md](../../docs/specs/auth-bootstrap-recovery/SPEC.md)

**Parent Bead:** `fam-ya7p`

**Task list:** Beads `fam-ya7p.1`–`fam-ya7p.5`

## Goal and Boundaries

Establish one fail-closed account activation path across session restore,
encrypted local storage, ownership transitions, providers, cleanup, and
telemetry. The existing production source owners remain in place. No Supabase
or SQLite schema changes, new dependency, or second bootstrap state owner is
planned.

The child Beads were written against a removed `chunked-storage.ts` module.
The current session adapter instead encrypts the session into AsyncStorage
with an Expo SecureStore key. Work on `.1` is blocked until the maintainer
chooses whether to adapt the requirements to current storage or approve
reintroducing a chunked storage design. This plan does not authorize either
choice.

## Dependency Graph

```text
fam-ya7p.1  current storage recovery contract and implementation
     │
fam-ya7p.2  sequenced auth ownership and generation journal
     ├───────────────┐
fam-ya7p.3             fam-ya7p.4
runtime gates          cleanup and telemetry
     └──────────┬──────┘
          fam-ya7p.5
    focused regression matrix
```

`fam-ya7p.3` and `.4` can proceed independently after `.2`; `.5` depends on
all four implementation slices. The Beads' current dependency edges remain
authoritative and should be updated only if the maintainer approves a scope
change.

## Ordered Slices

| Order | Bead | Files likely touched | Verification |
| --- | --- | --- | --- |
| 0 | `fam-ya7p` | This spec and plan | Marco resolves the storage mismatch and approves the contract before implementation |
| 1 | `fam-ya7p.1` | Current session/account storage owner and adjacent tests, after path/scope correction | Fault-injection tests for resolved/rejected writes, restart/recreation, remove/tombstone, cross-key preservation, UTF-8 boundaries; `bun run test <focused storage test>` |
| 2 | `fam-ya7p.2` | `src/features/auth/session-provider.tsx`, tests, smallest ownership/sign-out seam | Deferred auth-event tests for generation, failed bootstrap, A/B snapshot mismatch, cleanup failure, explicit retry; focused `bun run test <session tests>` |
| 3 | `fam-ya7p.3` | Root navigator, both app-provider trees, direct account-bound entry points, tests | Provider and direct-entry tests for loading/error, readiness loss, stale in-flight work, iOS/Android parity; focused `bun run test <provider tests>` |
| 4 | `fam-ya7p.4` | Sign-out/orphan cleanup and telemetry owners/tests | Rejection/deduplication tests, owner checks, raw-ID allowlist/redaction tests, PostHog pseudonym and RevenueCat readiness checks |
| 5 | `fam-ya7p.5` | Tests adjacent to storage/auth/providers/telemetry; no test-only abstraction | Full focused crash-point matrix, quality report, iOS/Android SecureStore smoke evidence, then `bun run check` and `bun run typecheck` |

Exact file lists are set by each child Bead after the current source map is
reconciled. No slice may expand into unrelated product analytics, household
data, schema, or UI work.

## Verification Checkpoints

1. After `.1`, prove bounded recovery and absence of cross-key deletion before
   building ownership transitions on top of storage.
2. After `.2`, prove generation ordering and failure visibility before opening
   provider gates.
3. After `.3` and `.4`, run their focused tests independently and inspect all
   direct account-bound entry points.
4. After `.5`, run the complete focused matrix, `bun run check`, and
   `bun run typecheck`. Perform native SecureStore failure/size checks on both
   platforms. Only the owning tests and files should be staged and committed.

## Constraints and Risks

- Expo is `~57.0.26`. Match any later native API decision to the versioned
  SecureStore reference linked in the spec.
- Expo SecureStore can reject large writes and does not promise a universal
  fixed limit, atomic writes, or durable completion after a rejection.
- iOS Keychain data may survive reinstall; cleanup and ownership must account
  for stale local key material without granting it account access.
- Simulator tests cannot prove real biometric behavior. Native checks should
  test the failure modes actually used by this app and be run on both iOS and
  Android as child `.5` requires.
- Keep authentication/session retry UX available while account data stays
  gated. A failure must not silently turn into sign-out or an active account.
- Raw user IDs and access/refresh tokens must not enter diagnostics, queued
  analytics, shell output, or test snapshots.
- Native builds, new native dependencies, and data migrations are outside this
  plan unless separately approved.

## Review Gate

Before `.1` begins, Marco must approve this current source map, decide the
chunked-storage mismatch, and approve any corresponding child-Bead changes.
Until then, this plan is a concrete review artifact and runtime implementation
remains blocked.
