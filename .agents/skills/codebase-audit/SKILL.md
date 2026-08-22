---
name: codebase-audit
description: Audits a codebase (or a subset of it) across four generic, language-agnostic aspects — Auth & Security Patterns, Naming Conventions, Code Reuse & Duplication, and General Best Practices — and produces a self-contained, filterable HTML report. Use this whenever the user asks to audit, review, or check code quality, wants a health check of the codebase, asks about authentication/authorization patterns, variable/function naming consistency, duplicated logic, or best-practice violations, or wants an overview/dashboard of code quality issues. Trigger this proactively for phrases like "check my codebase", "audit the code", "prüfe die codebase", "review code quality", "find duplicated code", "check naming conventions", "security review of auth", even if the user only names one of the four aspects rather than all of them.
---

# Codebase Audit

Runs a structured quality audit across up to four aspects — **Auth & Security
Patterns**, **Naming Conventions**, **Code Reuse & Duplication**, and
**General Best Practices** — and renders the findings into one HTML file the
user can open, filter, and skim. The aspects are deliberately generic: they
apply to any stack, not just this repo, so treat `references/aspects.md` as
the rubric regardless of what language or framework you find.

## Step 1 — Resolve scope, mode, and aspects

Three things need to be pinned down before any code gets read. Infer as much
as you reasonably can from the user's phrasing before asking — only ask about
what's genuinely ambiguous.

**Scope** — what part of the codebase to audit:
- Full codebase (default when nothing narrower is implied)
- A specific path/feature (e.g. "audit the auth feature" → `src/features/auth`)
- Just the current diff (e.g. "review my changes", "audit this PR")

Resolve the concrete file list with the bundled script rather than hand-rolling
a `find`/`grep` — it already respects `.gitignore` and skips binary noise:

```bash
bash scripts/collect_targets.sh full                    # whole repo
bash scripts/collect_targets.sh path src/features/auth   # one path
bash scripts/collect_targets.sh diff                     # working tree: staged+unstaged+untracked
bash scripts/collect_targets.sh diff main                # committed diff vs an explicit ref
```

**Aspects** — which of the four to run. Default to all four unless the user
names a subset ("just check naming" → `naming` only).

**Mode** — how the analysis work is distributed. This genuinely changes the
tradeoff (thoroughness/cost vs. speed), so ask the user rather than guessing,
unless they already stated a preference in this request:

- **Subagents** — spawn one subagent per selected aspect (see Step 2), each
  reading `references/aspects.md` for its own aspect. Runs in parallel, more
  thorough on a large scope, costs more tokens/time.
- **Inline** — you read the target files yourself and produce findings for
  every aspect in one pass. Faster and cheaper, better for a narrow scope
  (single feature, a diff) where there isn't much to parallelize anyway.

For a diff-scoped or single-small-folder audit, inline is usually the right
call regardless of what's asked — say so and confirm, since spinning up four
subagents to read a dozen files is wasted overhead.

## Step 2 — Run the analysis

Whichever mode, an audit pass produces findings against the schema in
`references/schema.md` — read it before generating anything, it defines the
exact JSON shape `render_report.py` expects (aspect scores, severities,
per-finding file/line/title/description/recommendation).

**Subagent mode:** spawn one subagent per selected aspect with a prompt like:

```
Audit <scope description> for the "<aspect name>" aspect of a codebase audit.
Read references/aspects.md in <skill path> for what to look for under this aspect.
Read references/schema.md for the exact JSON output shape.
Target files: <list from collect_targets.sh, or "read the repo yourself under <path>">
Return ONLY the JSON for this aspect's `aspects` entry and its `findings` entries —
do not touch other aspects.
```

Merge each subagent's returned JSON fragments into one `findings.json`
(one `aspects[]` entry and some `findings[]` entries per aspect).

**Inline mode:** read `references/aspects.md` once for all selected aspects,
then read through the target files yourself, building the same `findings.json`
directly as you go.

In both modes, ground findings in the codebase's own conventions first — check
for a `CLAUDE.md`, `AGENTS.md`, `README`, or linter config before falling back
to generic best practice, per the guidance in `references/aspects.md`. A
finding that contradicts the project's own documented, deliberate choice is
usually not a finding.

Be honest about severity — see the calibration guide in `references/schema.md`.
A report where everything is `critical` or everything is `low` isn't useful;
aim for something a sharp senior engineer would actually say in review.

## Step 3 — Render the report

Once `findings.json` is assembled and validated against the schema, render it:

```bash
python3 scripts/render_report.py --findings findings.json --out codebase-audit-report.html
```

The script validates the JSON shape and fails loudly with specific errors
before writing anything — fix those rather than hand-editing the HTML output.
The resulting file is fully self-contained (inline CSS/JS, no external
requests) and includes:
- An executive summary: one score card per audited aspect (green/yellow/red
  traffic light + one-line summary + finding count).
- A single findings table across all aspects, filterable by aspect and
  severity, with a text search, sorted by severity by default. Click a row to
  expand its description and recommendation.

Save the report somewhere durable in the repo (not `/tmp`) — a `reports/`
folder at the repo root works well; check whether one already exists before
creating it. Do not commit it automatically; let the user decide whether it's
worth keeping in version control.

## Step 4 — Hand it off

Tell the user where the file is and give a one-paragraph summary of what
stood out (worst aspect, any `critical` findings) — don't make them open the
file to learn there's nothing urgent. If they're in a context where sending
the file directly is useful, do that; otherwise the path is enough.
