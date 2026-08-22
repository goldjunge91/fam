# findings.json Schema

The audit produces one JSON file that `scripts/render_report.py` turns into the
HTML report. Build it up as you go — one aspect's findings can be appended
independently of the others, which is what lets parallel subagents each own a
slice of this file without conflicting.

```jsonc
{
  "meta": {
    "generated_at": "2026-08-22T10:00:00Z",
    "scope": "full codebase" | "src/features/auth" | "git diff main..HEAD",
    "mode": "subagents" | "inline",
    "repo": "fam"
  },
  "aspects": [
    {
      "id": "auth",                 // stable slug, matches finding.aspect
      "name": "Auth & Security Patterns",
      "summary": "One or two sentences: overall impression, not a findings recap.",
      "score": "green" | "yellow" | "red"
    }
    // one entry per aspect actually run — omit aspects the user didn't select
  ],
  "findings": [
    {
      "aspect": "auth",             // must match an aspects[].id
      "severity": "critical" | "high" | "medium" | "low",
      "file": "src/features/auth/api.ts",
      "line": 42,                   // omit or null if not line-specific
      "title": "Short, specific claim (<= 80 chars)",
      "description": "What's wrong and why it matters. Concrete, not generic.",
      "recommendation": "What to change. Specific enough to act on.",
      "principle": "YAGNI"   // required for aspect="best-practices", see references/aspects.md
                              // for the tag catalog; omit for the other three aspects
    }
  ]
}
```

## Scoring an aspect

`score` is a traffic light for the executive summary, not a formula — use judgment:

- **green** — no findings above `medium`, or none at all. The aspect is in good shape.
- **yellow** — some `medium`/`high` findings, but nothing systemic or urgent.
- **red** — any `critical` finding, or a pattern of `high` findings that indicates a
  systemic problem (e.g. RLS missing on multiple tables, `any` used pervasively).

Do not let volume alone drive the color — ten `low` findings is still green;
one `critical` finding is always red.

## Severity guide

- **critical** — actively exploitable or silently corrupts data/state (e.g. missing RLS
  policy on a table with private data, auth check bypassable, unbounded `any` on a
  security-relevant boundary).
- **high** — a real bug or a maintenance trap likely to bite soon (e.g. duplicated
  business logic that will drift, a naming collision that risks wrong-data bugs).
- **medium** — a real but contained issue (e.g. a one-off cast, a locally duplicated
  helper, an inconsistent name within one feature).
- **low** — stylistic or minor consistency nit, worth mentioning but not urgent.

Keep the list honest: a report that scores everything `low` to be agreeable is
useless, and a report that scores everything `critical` to seem thorough is
just as useless. Findings should read like something a sharp senior engineer
would actually flag in review — nothing more, nothing less.
