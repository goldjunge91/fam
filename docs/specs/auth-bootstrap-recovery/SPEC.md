# Spec: Auth Bootstrap and Secure Storage Recovery

**Status:** Review required before implementation

**Parent Bead:** `fam-ya7p`

**Plan:** [tasks/auth-bootstrap-recovery/plan.md](../../../tasks/auth-bootstrap-recovery/plan.md)

This is a current, reviewable replacement for the former specification. The
former 983-line file was deleted in `bbd73ce5` while storage and local/remote
boundaries were refactored. Its storage module paths and some implementation
assumptions no longer match the repository. The open child Beads remain the
source of requested behavior until this replacement is reviewed.

## Objective

Restore a local Supabase session without activating account-bound app work
until encrypted local storage, account ownership, and the required providers
have completed a single safe bootstrap. On read, write, cleanup, or ownership
failure, retain enough state for explicit retry while preventing data or
identity from crossing account boundaries.

The design covers five related capabilities: secure session storage,
authoritative account ownership transitions, account-runtime gating,
cleanup and privacy-safe telemetry, and a focused regression/runtime matrix.
It does not change Supabase schema, local SQLite schema, account identity
semantics, or introduce a storage or telemetry dependency.

## Capability Map and Build Order

| Capability | Responsibility | Depends on |
| --- | --- | --- |
| `session-storage` | Durable, integrity-checked local session/key storage and bounded recovery | — |
| `session-ownership` | Sequenced auth ingress, ownership journal, generations, explicit readiness | `session-storage` |
| `account-runtime-gate` | Gate every account-bound provider and direct entry point on valid ownership | `session-ownership` |
| `cleanup-telemetry` | Retryable owner-scoped cleanup and privacy-safe diagnostic identity | `session-ownership` |
| `regression-matrix` | Verify storage, transition, provider, and native failure behavior | all prior capabilities |

Implementation order is `session-storage` → `session-ownership` →
`account-runtime-gate` and `cleanup-telemetry` → `regression-matrix`.
`account-runtime-gate` and `cleanup-telemetry` may proceed independently after
the ownership contract is implemented.

## Current Source Map

The repository was re-read on 2026-10-06. These paths describe the current
implementation, not the removed 2026-09 specification:

- `src/lib/storage/local-supabase-session-storage.ts` encrypts the Supabase
  session with AES-GCM, stores ciphertext in AsyncStorage, and stores a small
  key in Expo SecureStore.
- `src/lib/storage/local-account-storage.ts` owns encrypted account MMKV
  creation, in-process opening generations, tombstones, and key cleanup.
- `src/features/auth/session-provider.tsx` restores the session, exposes
  `accountReady`, sequences auth callbacks, and activates local account state.
- `src/features/app-shell/app-providers.tsx` and
  `src/features/app-shell/app-providers.android.tsx` compose
  `AccountProviderGate`; `src/features/navigation/root-navigator.tsx` owns
  navigation and database startup decisions.
- `src/features/auth/sign-out.ts` owns account cleanup.
- `src/features/app-shell/posthog-identity-sync.tsx` gates PostHog identity;
  `src/lib/telemetry/index.ts` currently supports a mutable active user ID.
- Focused tests live next to these owners, including
  `local-supabase-session-storage.test.ts`, `session-provider.test.tsx`,
  `sign-out.test.ts`, provider tests, and telemetry tests.

The child Bead `fam-ya7p.1` still describes a `chunked-storage.ts` v2-to-v3
journal, but that module is absent and the current session adapter stores an
encrypted value rather than chunked SecureStore payloads. This is a material
contract mismatch. Before implementation, the maintainer must decide whether
`.1` should harden the current adapters or whether the removed chunked-storage
architecture is intentionally to be restored. This spec does not silently
choose the latter.

## Contract

### Session and Readiness

- `session` records the Supabase-authenticated session snapshot.
- `accountReady` is true only after the local owner, encrypted storage,
  account-scoped query persistence, and required sync gate have committed.
- A session snapshot alone is never permission to read or mutate account data.
- Bootstrap and cleanup errors remain visible and retryable. Automatic
  `INITIAL_SESSION` or `TOKEN_REFRESHED` events cannot clear a failed bootstrap.
- Explicit retry or explicit authentication begins a new generation.
- Stale asynchronous work must not publish a newer owner, start provider work,
  or commit writes after ownership changes.

### Ownership Transitions

- Persist the previous committed owner, candidate owner, pending cleanup owner,
  generation, and transition phase before destructive cleanup.
- Clear the old local owner before cleanup. Do not activate the candidate until
  old-owner cleanup succeeds and the candidate's local setup commits.
- Compare each auth event to the ownership snapshot captured for that
  transition; never infer cleanup authority from a later session snapshot.
- A storage/runtime capability must bind owner and generation. A boolean or
  session object alone is not a low-level authorization token.
- Every asynchronous worker catches failures and rechecks the current
  capability before publishing identity, writing local state, or sending sync.

### Storage and Recovery

- Serialize get/set/remove operations for a key and backing store.
- Persist enough state before a mutation to distinguish prepared, committed,
  cleanup-pending, and removed values after process recreation.
- Validate payload integrity before returning secret material. Unknown or
  malformed commit state fails closed and preserves evidence needed for retry.
- Recovery is bounded to keys and slots known to the requested operation; it
  never sweeps unrelated accounts or keys.
- Removal is a staged tombstone operation; a cleanup error leaves the tombstone
  or journal available for a safe retry.
- Keep legacy reads only where the selected current storage design has a real
  legacy format. Do not add compatibility code for a deleted format without
  confirming that installed app data still uses it.
- Measure any SecureStore payload limit in UTF-8 bytes and verify it against
  the active adapter and SDK. Do not assume that native writes are atomic or
  durable: Expo documents rejection for large values and does not promise a
  universal fixed payload limit.

### Account Runtime and Cleanup

- No account-bound database, household query, sync, RevenueCat, PostHog,
  private persistence, or module-cache side effect starts while loading, in an
  error fallback, or without a valid owner-generation capability.
- On readiness loss, clear local active-user state and neutralize provider
  identities/subscriptions before another account can become active.
- Orphan cleanup is rejection-safe, deduplicated by owner and generation, and
  retryable. Key material is removed only after the corresponding encrypted
  storage has been successfully removed.

### Telemetry and Product Identity

- Diagnostics use curated stage and error codes; never include raw Supabase
  user IDs, tokens, sessions, ciphertext, or secret keys.
- PostHog diagnostics use only a stable install-scoped pseudonym when its salt
  is available. Queued legacy events with raw account identifiers are dropped
  or redacted before send.
- RevenueCat retains its canonical App User ID contract, but identity calls
  occur only after `accountReady` and a current ownership check.
- No pseudonym is invented when its salt is unavailable; diagnostics remain
  anonymous.

## Commands and Verification

- Storage adapter test: `bun run test src/lib/storage/local-supabase-session-storage.test.ts`.
- Session transition test: `bun run test src/features/auth/session-provider.test.tsx`.
- Cleanup test: `bun run test src/features/auth/sign-out.test.ts`.
- Provider identity test: `bun run test src/features/app-shell/posthog-identity-sync.test.tsx`.
- Provider gate test: `bun run test src/features/app-shell/account-provider-gate.test.tsx`.
- Lint/format check for the completed source changes: `bun run check`.
- Type check: `bun run typecheck`.
- Focused native verification, once implementation exists: the repository's
  approved iOS Simulator and Android workflows, limited to SecureStore
  rejection, storage-size failure, adapter recreation, and provider
  no-side-effect behavior.
- Never run `bun test`; do not run the full Jest suite for a slice.
- Native builds and device workflows require their separately documented
  approval. Do not start or stop a build as part of this specification task.

## Project Structure and Ownership

Production owners remain feature-first:

| Concern | Owner |
| --- | --- |
| Encrypted Supabase session adapter | `src/lib/storage/local-supabase-session-storage.ts` |
| Per-account storage keys, MMKV lifecycle, remembered local owner | `src/lib/storage/local-account-storage.ts` |
| Session restore and transitions | `src/features/auth/session-provider.tsx` |
| Provider activation | `src/features/app-shell/` and direct account-bound entry points |
| Account cleanup | `src/features/auth/sign-out.ts` and its existing cleanup helpers |
| Diagnostic identity and filtering | `src/lib/telemetry/` and observability provider adapters |
| Verification | Tests colocated with each owner; Beads `fam-ya7p.1`–`.5` |

Do not add a second global auth/bootstrap store or a parallel telemetry
identity layer. Put pure transition rules in the smallest existing auth/domain
owner that can be tested without React or native storage.

## Boundaries

- **Always:** preserve offline session restore; fail closed on uncertain owner
  or storage state; test iOS and Android behavior at the owning boundaries;
  keep telemetry free of raw account IDs and secrets.
- **Ask first:** replacing the current encrypted AsyncStorage/SecureStore
  adapter with chunked SecureStore; changing provider identity semantics;
  adding native dependencies; changing native configuration or data schema.
- **Never:** expose a secret after an unknown commit; clean another account's
  storage based on a late auth event; use a session alone as runtime
  authorization; send raw Supabase IDs to diagnostic telemetry; swallow
  cleanup rejections.

## Binding Decisions

- `accountReady` remains the app-facing readiness signal; session presence
  alone does not activate private account work.
- Storage, ownership, provider gating, cleanup, and telemetry stay with their
  current feature/library owners; no parallel bootstrap store is introduced.
- Supabase and SQLite schemas and installed dependencies stay unchanged.
- Ambiguous native persistence fails closed and is retried only through an
  explicit recovery path.
- RevenueCat keeps its existing canonical user identity after readiness;
  PostHog diagnostics use an install-scoped pseudonym and never raw user IDs.
- Implementation stays blocked until Marco approves this replacement spec and
  resolves the child `.1` storage-architecture mismatch.

## Success Criteria

1. A restored session is visible for explicit retry but cannot activate account
   work until storage, ownership, and provider setup commit.
2. Writes, removals, account switches, and app recreation fail closed on
   ambiguous native storage outcomes and never delete a valid neighboring
   account's data.
3. Auth transition tests cover Snapshot A / Event B / Marker B and prove only
   the captured owner is cleaned.
4. Both provider trees and direct data entry points require the same current
   owner-generation capability; in-flight work rechecks it before commit/send.
5. Cleanup is rejection-safe and retryable; telemetry includes no raw account
   identifiers and gates RevenueCat/PostHog identity correctly.
6. Focused unit/integration tests pass; native rejection and size behavior are
   verified on iOS and Android; `bun run check` and `bun run typecheck` pass.
7. The storage architecture mismatch recorded above is resolved in the parent
   and `.1` Beads before any implementation slice starts.

## Source and Doubt Review

Source review on 2026-10-06 used the current files listed in “Current Source
Map”, all five child Beads, repository `CONTEXT.md`, and Expo SDK 57 SecureStore
documentation: <https://docs.expo.dev/versions/v57.0.0/sdk/securestore/>.
Expo documents that native SecureStore writes can reject, that large values
may be rejected by the platform, and that iOS Keychain entries may outlive an
app reinstall. It does not promise transactional storage or a universal size
limit. The implementation and tests must therefore verify observed behavior
without treating a simulator as proof of biometric behavior or assuming a
write's rejection means no bytes were persisted.

Open doubts are deliberately explicit:

1. The approved historical spec and chunked-storage module were removed, while
   `.1` still depends on their v2/v3 format. Decide whether to re-scope `.1` to
   current adapters or approve a new storage architecture.
2. `accountReady` and `AccountProviderGate` now exist, but Beads `.2` and `.3`
   require stronger generation capabilities and guards at every direct entry
   point. Inventory all entry points before deciding whether to add a shared
   capability type.
3. Current telemetry still supports `activeUserId`, while `.4` requires an
   install-scoped pseudonym for PostHog diagnostics. Preserve RevenueCat's
   separate product identity behavior.

These are review questions, not permission to choose a broader architecture
silently. Implementation remains blocked until Marco reviews this replacement
specification and resolves the storage mismatch.
