# Audit Aspects

Four aspects, each independent — a subagent (or an inline pass) working on one
of these should not need to read the others' findings to do its job. Keep
each pass grounded in the codebase's own stated conventions (CLAUDE.md,
AGENTS.md, README, linter config) before falling back to general best
practice — a codebase that has deliberately chosen a pattern isn't "wrong"
for using it.

## 1. Auth & Security Patterns (`auth`)

Look for how the codebase authenticates requests, authorizes actions, and
isolates data that shouldn't be visible cross-tenant/cross-user. This is
language- and backend-agnostic — the same questions apply to a Supabase RLS
policy, an Express middleware, or a Django permission class.

Check for:
- Missing or overly permissive authorization checks (an endpoint/query that
  trusts a client-supplied user/tenant ID instead of the authenticated session).
- Data-isolation gaps — shared vs. private data mixed without a clear boundary
  enforced at the data layer (not just in UI code, which is bypassable).
- Secrets or tokens hardcoded, logged, or shipped into a client bundle.
- Auth state handled inconsistently across entry points (e.g. one route checks
  a session, a sibling route forgets to).
- Password/token handling: plaintext storage, weak hashing, tokens with no
  expiry, no rotation on privilege change.
- Missing tests for the negative case (a user *cannot* access another user's
  data) — presence of the happy-path test alone is not enough.

Don't flag things that are actually fine: a public read on genuinely public
data isn't a finding.

## 2. Naming Conventions (`naming`)

Look for names (files, variables, functions, types, routes) that mislead,
collide, or drift from the codebase's own established vocabulary.

Check for:
- Names that lie about what the thing does (a function called `getUser` that
  also mutates, a boolean named `isValid` that's actually "is present").
- Inconsistent vocabulary for the same concept across the codebase (e.g.
  `user`, `account`, and `profile` used interchangeably for the same entity).
- Abbreviations or single-letter names outside of tight, obviously-scoped loops.
- File/folder names that don't match the codebase's own stated structure
  conventions (check CLAUDE.md/AGENTS.md/README for a documented layout first).
- Generic dumping-ground names (`utils.ts`, `helpers.ts`, `misc.ts`) that have
  grown to hide unrelated logic — the name itself becomes a maintenance smell.

This aspect is about clarity and consistency, not personal taste — don't
flag a convention just because it's not the one you'd have picked, only when
it's inconsistent with itself or actively confusing.

## 3. Code Reuse & Duplication (`reuse`)

Look for logic that's been copy-pasted or reinvented instead of shared, and
for the opposite failure mode — abstractions built before they were needed.

Check for:
- The same non-trivial logic (validation, formatting, a calculation, an API
  call shape) implemented more than once with small variations that will
  drift out of sync.
- A generic-looking wrapper that only forwards its arguments or casts a type,
  adding a layer without adding behavior.
- Copy-pasted components/screens that differ only in a couple of hardcoded
  values, where a prop would do.
- Premature abstraction: a "generic" utility or config system built for one
  caller, guessing at future needs that haven't materialized (YAGNI territory) —
  this is duplication's mirror image and just as worth flagging.
- Dead code: exports nothing imports, feature flags with only one live branch,
  commented-out blocks left in place "just in case."

Weigh the fix, not just the symptom: duplication that would require a risky,
speculative abstraction to remove is sometimes the right call to leave alone —
say so if that's your judgment, rather than flagging it reflexively.

## 4. General Best Practices (`best-practices`)

The catch-all for idiomatic, maintainable code that doesn't fit the other
three buckets. Calibrate this to the codebase's actual stack and its own
documented standards rather than a generic checklist.

**Tag every finding in this aspect with which named principle it violates**,
using the `principle` field in the schema (see `references/schema.md`). A bare
"this could be cleaner" is a matter of taste; "this violates YAGNI because X"
is a claim someone can agree or disagree with on the merits. Pick the closest
fit from this table — most findings map cleanly to exactly one:

| Tag | Meaning | Flag when... |
|---|---|---|
| `YAGNI` | Built for a need that doesn't exist yet | speculative abstraction, config option, or generality with no current caller that needs it |
| `KISS` | A simpler solution was available | unnecessary indirection or cleverness for what the problem actually requires |
| `Magic Numbers/Strings` | An unexplained literal | a literal encodes meaning beyond a simple index/counter/loop bound and has no named constant explaining it |
| `Robustheit (Hoare)` | Hard to misuse, kind to errors | swallowed errors, missing validation at a boundary, an API shape that invites misuse |
| `Effizienz (Hoare/Weinberg)` | Fast/resource-light enough for its environment | wasteful loops, avoidable re-renders, continuous animations, N+1 queries, unbounded growth |
| `Anpassungsfähigkeit (Weinberg)` | Copes with requirements that will plausibly change | hardcoded values that obviously need to vary soon, brittle coupling to one caller's shape |
| `Konformität zu Standards (Hoare)` | Follows the project's own documented rules | violates something CLAUDE.md/AGENTS.md/README/linter config explicitly states — this is the right tag for "the codebase's own non-negotiable says X, this does Y" |
| `Korrektheit (Weinberg)` | Produces correct output for its actual inputs | a real logic bug or an unhandled edge case, not just a style concern |

If a finding genuinely doesn't fit any row, use a short label of your own — but
check first, because most best-practice complaints do fit one of these once
you ask "which of these am I actually objecting to?"

Check for:
- Type-safety escape hatches used where a proper type was available (`any`,
  `as unknown as X`, `@ts-ignore`) — especially at boundaries where they hide
  real bugs rather than genuinely unknowable shapes.
- Error handling that swallows failures silently (empty `catch`, ignored
  promise rejections) or handles errors so generically that debugging them
  later is guesswork.
- Missing tests for the "reverse state" of a feature (if there's a test for
  turning something on, is there one for turning it off?), per the codebase's
  own testing conventions where documented.
- Obvious performance traps stated as anti-patterns in the project's own docs
  (e.g. this repo's CLAUDE.md calls out continuously-repainting CSS animations
  as a GPU cost — check for those if the project has similar stated concerns).
- Dependency hygiene: a new dependency pulled in for something the stack
  already provides, or a native dependency added without the documented
  rebuild step being mentioned anywhere.

If the project's own CLAUDE.md/AGENTS.md documents specific non-negotiables
(a required workflow, a banned pattern, a required file layout), treat
violations of those as first-class findings here even if they wouldn't be
flagged by generic best-practice checklists — the codebase's own rules take
precedence over generic ones.
