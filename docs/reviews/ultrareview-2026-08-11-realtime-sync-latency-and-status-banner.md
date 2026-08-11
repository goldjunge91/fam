# Ultrareview — fix/realtime-sync-latency-and-status-banner → main

**Date:** 2026-08-11
**Scope:** 19 files changed, 813 insertions(+), 94 deletions(-)
**Branch:** `fix/realtime-sync-latency-and-status-banner`
**Result:** 4 findings, all severity `nit`. No blockers.

Covers the debounced sync-nudge (#70 AC1), the sync-status banner rework,
realtime latency diagnostics, and the Gate D bug fixes (added_by/checked_by
UUID, isFetching remount, dotenv-cli override) committed on this branch.

---

## bug_001 — Leading-edge sync trigger can be lost when an in-flight sync is already running

- **File:** `src/lib/sync/sync-runner.ts:248-254`
- **Severity:** nit

### PR comment

The leading-edge branch of the outbox debounce listener in
`sync-runner.ts:248-254` calls `triggerHouseholdSync()` fire-and-forget on
the first write of a burst, but returns without scheduling any fallback
timer. When `triggerHouseholdSync` short-circuits via its `isSyncing` guard
(a concurrent initial-mount sync, 20s poll, AppState-resume sync, realtime
reconnect, or manual sync is in flight), the write's dedicated trigger is
silently lost and the row waits for the next 20s poll — defeating the <1s
AC1 target this branch was explicitly added to satisfy. Consider scheduling
a fallback debounce timer even for the leading-edge write, or chaining a
follow-up after the in-flight sync completes.

### Full reasoning

**Where the bug is**

In `src/lib/sync/sync-runner.ts:248-254`, the `onOutboxChanged` listener
uses a leading-edge + trailing-debounce strategy. On the first write of a
burst (`writesInBurst === 1`) it fires
`triggerHouseholdSync([householdIdRef.current], false, queryClient)` and
`return`s **without scheduling any timer**.

```ts
if (writesInBurst === 1) {
  burstStartedAt = now;
  if (householdIdRef.current) {
    triggerHouseholdSync([householdIdRef.current], false, queryClient);
  }
  return;   // ← no debounceTimer set
}
```

However, `triggerHouseholdSync` (line 110) has an `isSyncing` mutex:

```ts
if (isSyncing || !householdIds || householdIds.length === 0) return null;
```

The listener never awaits the call and never observes the `null` return, so
a no-op is indistinguishable from a real sync from this branch's
perspective. `writesInBurst` stays at 1 (only `flushDebouncedSync` resets
it, and no timer was scheduled). Nothing wakes anyone up until the next 20s
poll tick.

**How it manifests**

The following concurrent sync sources hold `isSyncing=true` during network
round-trips:
1. Initial mount sync (`useSyncEngine`, line 203)
2. 20s periodic poll (line 208)
3. `AppState → active` sync (line 217) — very common: user resumes app and
   immediately taps
4. Realtime reconnect (`useRealtimeSync.onReconnect`)
5. Manual sync from settings

If a user makes a lone write during any of these windows, `pushOutbox` in
the in-flight sync has already read the outbox snapshot (`push.ts:303` via
`loadDueOutboxEntries`), so the newly-committed row is not part of the
current push either. The write then waits up to ~19.8s for the next poll
tick.

**Step-by-step proof**

- t=0.00s: `AppState → active` triggers `triggerHouseholdSync`.
  `isSyncing=true`. `loadDueOutboxEntries` runs at ~t=0.02s and captures the
  outbox snapshot (empty).
- t=0.30s: User taps to check off an item. `enqueueMutation` commits the
  SQLite transaction and synchronously calls `notifyOutboxChanged()`
  (`outbox.ts:104`).
- t=0.30s: Listener fires: `writesInBurst = 1`, `burstStartedAt = 300`.
  Calls `triggerHouseholdSync` — returns `null` (isSyncing guard). `return`
  — **no `setTimeout` is scheduled**.
- t=0.80s: In-flight sync completes with `isSyncing = false`.
  `writesInBurst` and `burstStartedAt` remain set. Nothing pending.
- t=20.00s: Next 20s poll tick finally picks the row up.

Total delay: ~19.7s. This is exactly the *traege synchronisierung* failure
mode the debouncer was built to eliminate, and the code comment on line 227
explicitly cites the #70 AC1 <1s target.

**Why the tests do not catch it**

`sync-runner.test.ts:141-155` uses
`mockSyncHousehold.mockResolvedValue(...)` which resolves synchronously in
the microtask queue. After the initial mount sync + `mockClear()`,
`isSyncing` is always `false` when `__triggerOutboxChanged()` runs, so the
race window is essentially zero in tests. A test with a pending, unresolved
`mockSyncHousehold` promise would surface this.

**Impact assessment**

Data is not lost — the next 20s poll always catches it. The failure is a
delayed sync in a small race window (~5-10% of writes) rather than a crash
or data loss. But it does contradict the explicit AC1 <1s target this PR is
built for. Two of three verifiers marked this nit, one normal; classifying
as nit here because merging as-is causes a bounded latency regression, not
a concrete user-facing failure that would justify blocking the merge.

**Suggested fix**

Either (a) schedule a fallback debounce timer even when the leading-edge
trigger returns, so the trailing timer catches the race, or (b) have
`triggerHouseholdSync` return a promise/signal that lets the listener chain
a follow-up after the in-flight sync completes.

---

## bug_003 — Sync banner briefly renders "Synchronisiere … 0 ausstehend" after a local write

- **File:** `src/hooks/use-sync-status.ts:46-60`
- **Severity:** nit

### PR comment

In `src/hooks/use-sync-status.ts:46-60`, the `onOutboxChanged` listener sets
`recentLocalWrite=true` and calls `invalidateQueries` — but
`invalidateQueries` only marks the query stale, it doesn't block the
ensuing React commit. So for a frame or two, the banner renders with
`recentLocalWrite=true` **and** the still-stale `pendingCount` (often 0 for
the first write of an idle session), producing the semantically wrong label
`Synchronisiere … 0 ausstehend` before the refetch resolves and it corrects
to `… 1 ausstehend`. Small fix: either suppress the numeric suffix in the
syncing state when `pendingCount === 0`, or bump a local counter alongside
`recentLocalWrite` instead of relying on the async refetch.

### Full reasoning

**What the bug is.** After a local write, the banner briefly shows
`Synchronisiere … 0 ausstehend` — literally "syncing … 0 pending", which is
self-contradictory: there IS at least one pending row (the one just
enqueued). The label then corrects itself to `… 1 ausstehend` once the
SQLite `count(*)` refetch resolves (typically 10-30ms).

**Where it comes from.** The listener in `src/hooks/use-sync-status.ts:46-60`
runs synchronously from `notifyOutboxChanged()` (`src/lib/db/outbox.ts:82`)
right after the mutation's SQL commit, and does two things:

1. `setRecentLocalWrite(true)` — schedules a React re-render immediately.
2. `queryClient.invalidateQueries({ queryKey: ['sync-status',
   'outbox-counts'] })` — marks the query stale and kicks off an async
   refetch (the `queryFn` at line 63-83 awaits `getDb()` then two
   `getFirstAsync` calls).

The in-file comment at lines 50-52 explicitly acknowledges the stale-count
risk ("die Anzeige spraenge sofort auf Synchronisiere..., aber mit einer
veralteten (oft 0) Zahl") — but the invalidation-based fix doesn't actually
prevent that render. `invalidateQueries` is not synchronous; TanStack Query
keeps returning the previous `data` until the refetch resolves.

**Step-by-step proof of the wrong frame.**

1. App is idle; outbox is empty. `useQuery` sits on
   `initialData: { pending: 0, failed: 0 }` (line 82) or a prior poll
   result showing `0`. `recentLocalWrite = false`. `computeSyncStatusView`
   returns `{ kind: 'hidden' }`, banner is not rendered.
2. User adds an item. `enqueueMutation` commits the SQL transaction, then
   calls `notifyOutboxChanged()` synchronously (`outbox.ts:82`,
   `outbox.ts:104`).
3. Listener runs: `setRecentLocalWrite(true)`; `invalidateQueries(...)`;
   `setTimeout(hide, 1500)`. The invalidation kicks off the async refetch;
   `data.pending` in the store is still `0`.
4. React commits the state update from step 3 **before** the refetch's
   `await getDb()` / `await db.getFirstAsync(...)` resolves. At this
   commit, `useQuery` still returns `{ pending: 0, failed: 0 }`.
5. `computeSyncStatusView({ isOnline: true, pendingCount: 0, failedCount:
   0, recentLocalWrite: true })` returns `{ kind: 'syncing', pendingCount:
   0 }` (see `sync-status.ts:44-52`).
6. `sync-status-banner.tsx:58` formats the label as
   ``Synchronisiere … ${status.pendingCount} ausstehend`` → renders
   literally **"Synchronisiere … 0 ausstehend"**.
7. Milliseconds later the refetch resolves with `pending: 1` and the banner
   re-renders to `"Synchronisiere … 1 ausstehend"`.

**Why existing tests don't catch it.** The banner test at
`src/components/sync-status-banner.test.tsx:96` uses
`screen.findByText('Synchronisiere … 1 ausstehend')`, which polls until the
eventual state appears — it deliberately doesn't assert the intermediate
frame, so the transient `0 ausstehend` render slips through.

**Impact.** Brief (single-digit frames on typical hardware, ~16-50ms) and
self-correcting. Not a data-integrity issue. Reads as a UI glitch — mildly
jarring the first time you spot it, harmless otherwise.

**Fix options** (any one of these):

- **Simplest:** in `sync-status-banner.tsx:58`, drop the numeric suffix in
  the syncing state when `pendingCount === 0` (e.g. render just
  `"Synchronisiere …"`). One-liner, no extra state.
- Bump a local counter alongside `recentLocalWrite` in
  `use-sync-status.ts`: `setLocalPendingBump(n => n + 1)` on the listener,
  feed `Math.max(data.pending, localPendingBump)` into
  `computeSyncStatusView`. Guarantees the label is never smaller than the
  number of writes since mount.
- Delay `setRecentLocalWrite(true)` until `refetchQueries` (not
  `invalidateQueries`) resolves. Slightly awkward — negates the point of
  showing feedback immediately.

---

## bug_004 — Latency-average render recomputes every 2s tick and shows "0 ms" when every sample is a delete

- **File:** `src/features/settings/sync-debug-screen.tsx:246-260`
- **Severity:** nit

### PR comment

The average-latency block at `sync-debug-screen.tsx:246-260` runs the
`.map/.filter/.reduce` chain inline in JSX on every render — including the
2s `forceTick` re-render — and, more importantly, when every sample in the
ring has `latencyMs === null` (an all-deletes session; `realtime.ts`
explicitly sets `latencyMs=null` for delete events) it renders
`Durchschnitt: 0 ms`, which reads as "instant sync" on a diagnostic screen.
Extracting to a `useMemo` keyed on `latencySamples` and rendering `—` when
the post-filter array is empty would fix both. Nit, not a blocker.

### Full reasoning

**What manifests.** The average is computed inline in the JSX at
`sync-debug-screen.tsx:249-259`:

```ts
Math.round(
  latencySamples
    .map((s) => s.latencyMs)
    .filter((v): v is number => v !== null)
    .reduce((sum, v, _i, arr) => sum + v / arr.length, 0),
)
```

Two coupled quality issues.

**1. Not memoized, recomputed on every tick.** The `forceTick` `useEffect`
at `sync-debug-screen.tsx:71-73` fires `setInterval(..., 2000)` for the
lifetime of the screen and drives a re-render every 2s. Because the chain
is inline, `map + filter + reduce + Math.round` runs each time, even when
the ring content is unchanged. The ring is capped at
`MAX_LATENCY_SAMPLES = 20` (`sync-runner.ts`) so the absolute cost is tiny
— but a one-line `useMemo` keyed on `latencySamples` would eliminate it.
Same applies to the neighbouring
`latencySamples[latencySamples.length - 1].latencyMs` reads (lines 246,
253).

**2. Misleading `0 ms` for an all-delete session.**
`RealtimeRowEvent.latencyMs` in `realtime.ts:32-38` is explicitly `null`
for delete events (no `updated_at` in the `old` payload), and
`recordRealtimeLatency` in `sync-runner.ts` pushes those `null`s into the
ring. The outer conditional at line 234
(`latencySamples.length === 0`) gates on total sample count, not
usable-sample count.

**Step-by-step proof (all deletes, e.g. clearing a fridge from another
device).**

1. Device B deletes 3 `fridge_items` rows in the same household.
2. Realtime delivers 3 DELETE events; `handlePayload` in `realtime.ts` sets
   `latencyMs = null` for each; `recordRealtimeLatency` pushes 3 samples
   with `latencyMs === null`.
3. `latencySamples.length === 3` → outer conditional at line 234 does NOT
   trigger the empty-state branch, so the average block renders.
4. `.filter((v): v is number => v !== null)` yields `[]`.
5. `[].reduce((sum, v, _i, arr) => sum + v / arr.length, 0)` returns its
   initial value `0` (no iterations, no divide-by-zero — the original
   title's "NaN via 0/0" wording is inaccurate; the body correctly says
   `0 ms`).
6. `Math.round(0) === 0` → the screen shows **`Durchschnitt: 0 ms`**.

On a diagnostic screen labelled "Realtime-Latenz", `0 ms` reads as
"instant realtime sync," which is the opposite of the truth ("no
measurable samples").

**How to fix.**

```ts
const averageLatencyMs = useMemo(() => {
  const usable = latencySamples.map((s) => s.latencyMs).filter((v): v is number => v !== null);
  if (usable.length === 0) return null;
  return Math.round(usable.reduce((sum, v) => sum + v, 0) / usable.length);
}, [latencySamples]);

// …
<ThemedText type="smallBold">{averageLatencyMs === null ? '—' : `${averageLatencyMs} ms`}</ThemedText>
```

**Severity.** Quality-only finding on a dev-only diagnostic screen; not a
crash, not a data-loss risk. Correct behaviour would just make the
diagnostic tool honest when every sample happens to be a delete.

---

## bug_002 — tests.sh disables unit tests but still prints "Alle Checks erfolgreich bestanden!"

- **File:** `tests.sh:21-23`
- **Severity:** nit
- **Note:** this file is an **uncommitted, pre-existing local change** —
  not part of any commit on this branch. The cloud reviewer picked it up
  from the working tree, not the branch diff.

### PR comment

In `tests.sh` (lines 21-23), the diff comments out `bun run test` but
leaves the final `echo "Alle Checks erfolgreich bestanden!"` unchanged and
unconditional. Running `./tests.sh` now prints a green success message
while never executing any test suite — a silent divergence from CI, which
still runs the tests. The file is unstaged (`M tests.sh` in git status) and
reads like leftover debug state; either uncomment the invocation or make
the final message reflect what actually ran.

### Full reasoning

**What the bug is**

Lines 21-23 of `tests.sh` comment out the only unit-test invocation in the
local pipeline:

```bash
# echo "--> Unit-Tests..."
# bun run test
# echo ""
```

Line 58 (`echo "Alle Checks erfolgreich bestanden!"`) is unchanged and
unconditional. The script's own header (line 2) explicitly frames itself as
a local mirror of `.github/workflows/ci.yml` — but CI still runs the unit
tests unchanged, so a contributor running `./tests.sh` locally gets a green
"Alle Checks erfolgreich bestanden!" while the tests never ran.

**Step-by-step proof**

1. Check out this branch and run `./tests.sh`.
2. `bun install --frozen-lockfile` runs, then typecheck, then Biome — the
   two remaining active checks.
3. The unit-test block (lines 21-23) is skipped because all three lines are
   comments.
4. Control falls through to line 58, which prints "Alle Checks erfolgreich
   bestanden!" with exit code 0.
5. Introduce a deliberate failing test in `src/lib/sync/sync-runner.test.ts`
   (one of the new tests this branch adds) and re-run. CI (unchanged
   `ci.yml`) will fail on this test; `./tests.sh` will still print the same
   green success line locally.

**Why existing code does not prevent it**

The header comment ("Lokale Test-Pipeline, gespiegelt von
.github/workflows/ci.yml") is descriptive, not enforced. There is no
assertion that the commented-out blocks match a temporary-skip flag, and
the final message is a bare `echo`, not conditioned on which sections ran.
A previously-commented-out DB/Docker section (lines 25-53) established the
same "skip silently but still print success" pattern, so the new
comment-out slotted in without visual friction.

**Impact**

Developer-facing only — no application behavior changes, and CI remains
the actual safety net. But this branch adds/edits three test files
(`sync-runner.test.ts`, `sync-status.test.ts`, `sync-status-banner.test.tsx`)
that a contributor would reasonably expect `./tests.sh` to exercise before
pushing. Silent local/CI divergence weakens a workflow safeguard exactly
when this branch adds tests worth running locally.

**How to fix it**

Either uncomment lines 21-23, or if the temporary skip is intentional (e.g.
the DB block below has been commented out for a while), tighten the final
message to reflect what actually ran — e.g. `echo "Typecheck + Lint
bestanden (Unit-Tests und DB-Suite lokal deaktiviert)."`. The former
restores parity with CI; the latter at least stops the false green.

**Note on state**

`tests.sh` is `M` in git status (unstaged working-tree change), and the
file's changes are part of this branch's diff per the branch-comparison
metadata. No commit in this branch justifies disabling unit tests, which
is why this reads as leftover debug state rather than an intentional
configuration change.
