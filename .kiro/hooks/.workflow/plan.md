# Implementation Plan: Strict Codex-Hook Port to `.kiro/hooks`

## Current implementation-step status

Steps 1 through 9 have been executed with stored evidence under
`.agents/tasks/codex-hook-portierung-evidence/`. The read-only evidence review
confirmed the three remediation artifacts against the current files:
EVIDENCE-001 has 14 structurally valid records, EVIDENCE-002 matches twelve
target and twelve protected source rows with only the documented target change,
and EVIDENCE-003 contains the required UTC/cwd/tool metadata. The static target
checks, cache inventory check, and staged / unstaged protected-source checks
also exited 0. The only runtime correction remains the existing
hash-tool/Stop ordering fix in `.kiro/hooks/simplify-ignore.sh`.

The independent review is complete and records `APPROVED`; EVIDENCE-001,
EVIDENCE-002, and EVIDENCE-003 are closed. The authoritative gate
`/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-gate.json`
records `verdict: "APPROVED"` with `findings: []` and points to
`/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-paritaet-review.md`.
The earlier `CHANGES_REQUESTED` verdict remains only as historical
`priorIndependentReview` information. Steps 8 and 9 are therefore closed in
this plan. `REAL KIRO HOST: NOT EXECUTED` remains the confirmed host boundary;
this final status synchronization does not rerun the runtime matrix.

## Scope and non-negotiable contract

This is a parity completion pass, not a redesign. The implementation must make the Kiro target behave like the already functioning Codex hook logic, adding only the explicit Kiro integration adapters listed below. It must not add hardening, modernization, new policy, new dependencies, or new lifecycle behavior.

- Work directly in `/Volumes/Programme/github/family_app/fam`.
- Do not create a worktree, commit, push, reset, delete existing work, or modify any `.codex` path.
- `.codex/hooks/**`, `.codex/hooks.json`, and `.codex/hooks/hooks.json` are protected source material. Their contents and hashes must be captured before and after validation separately from the target inventory.
- The twelve target runtime files are exactly the five Kiro v1 configurations plus their scripts:
  `session-start.json`, `session-start.sh`, `beads-context.json`, `beads-context.sh`, `guards.json`, `block-git-reset.py`, `block-bd-update-notes.py`, `sdd-cache.json`, `sdd-cache-pre.sh`, `sdd-cache-post.sh`, `simplify-ignore.json`, and `simplify-ignore.sh`.
- `.kiro/hooks/PORTING.md`, `.kiro/hooks/.workflow/*`, `.kiro/hooks/.gitignore`, and `.kiro/hooks/.sdd-cache/*.json` are documentation, workflow state, ignore rules, or existing runtime cache state. They are inventoried and preserved, but are not part of the twelve-file runtime hash set.
- Do not run `bun test`; do not run the full test suite, a build, or an Expo process. This task changes shell/Python hook integration only, so the focused shell/Python harnesses below are the relevant quality gate.
- Do not use `/tmp`, `mktemp` with its default directory, home-directory caches, or global caches. All temporary fixtures, harnesses, logs, and reports belong under the new evidence directory below.
- In every command below, set `E=/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-evidence` first. Commands using `$E` are therefore exact absolute-path commands, not placeholders.

## Explicit source-to-target mapping

| Protected Codex source | Kiro target | Logic that remains inherited | Kiro-only adapter that is allowed |
| --- | --- | --- | --- |
| `.codex/hooks.json` | `beads-context.json`, `guards.json`, `sdd-cache.json`, `session-start.json`, `simplify-ignore.json` | Session context, Bash guards, WebFetch cache, and filter lifecycle intent | Split Codex event map into independent `version: "v1"` files; use Kiro trigger/matcher names (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `execute_bash`, `web_fetch`, `read`, `write`); omit Codex-only `PreCompact`/`PostCompact`, `async`, `statusMessage`, and Codex hook-map fields |
| `.codex/hooks/hooks.json` | `session-start.json` | One SessionStart registration with tolerant missing-script behavior | Consolidate the nested wrapper into the single Kiro v1 registration; do not register it twice |
| `.codex/hooks/session-start.sh` | `session-start.sh` plus `session-start.json` | Read the local `using-agent-skills/SKILL.md`, print the startup preface, use a non-blocking missing-file fallback, exit 0 | Resolve the target root from `.kiro/hooks` to `.kiro/skills`; emit ordinary Kiro hook stdout instead of the Codex/Claude `hookSpecificOutput` JSON envelope; no `jq` requirement for this adapter |
| `.codex/hooks/block-git-reset.py` | `guards.json` plus `block-git-reset.py` | `shlex` tokenization, wrappers, assignments, shell segments, redirections, Git options, deny semantics, exit 2 | Read Kiro's `tool_input.command` under matcher `execute_bash`; use target-neutral diagnostics and Kiro input validation. Do not alter parser policy or add detections |
| `.codex/hooks/block-bd-update-notes.py` | `guards.json` plus `block-bd-update-notes.py` | Same command parser and exact `bd update --notes`/`--notes=` deny rule; `--append-notes` remains allowed | Read Kiro's `tool_input.command` under matcher `execute_bash`; use target-neutral diagnostics and Kiro input validation. Do not add policy |
| `.codex/hooks/sdd-cache-pre.sh` | `sdd-cache.json` plus `sdd-cache-pre.sh` | URL-keyed SHA-256 cache, validator-required revalidation, HTTP 304 hit, exit 2 on confirmed hit, graceful pass-through for malformed input or missing tools | Use `.kiro/hooks/.sdd-cache` from the script directory; consume Kiro `web_fetch` payloads; print Kiro-neutral text; keep the same `jq`, `curl`, and `shasum`/`sha256sum` dependency behavior and no TTL |
| `.codex/hooks/sdd-cache-post.sh` | `sdd-cache.json` plus `sdd-cache-post.sh` | Response extraction, validator HEAD request, atomic JSON write, removal of unvalidated entries, non-blocking failures | Use `.kiro/hooks/.sdd-cache`; register as Kiro `PostToolUse` `web_fetch`; remove Codex root lookup and async/status fields. Keep all supported response shapes and validator rules |
| `.codex/hooks/simplify-ignore.sh` | `simplify-ignore.json` plus `simplify-ignore.sh` | Marker parsing, hashes, placeholder expansion, backup state, re-filtering, Stop restore, `.recovered` handling, lock recovery, newline behavior | Use `.kiro/hooks/.simplify-ignore-cache`; accept Kiro `tool_input.path` and `tool_input.file_path`; accept Kiro lower-case tool names as well as source-compatible spellings; register Kiro `read`, `write`, and matcherless `Stop`. Do not add a fallback or change marker semantics |
| `.codex/hooks/SDD-CACHE.md` | No copied runtime file | Cache invariants, validator requirement, response semantics, dependency list, test intent | Keep Kiro-specific decisions in `PORTING.md` and the target scripts; do not copy obsolete Codex/Claude setup text into an active target contract |
| `.codex/hooks/SIMPLIFY-IGNORE.md` | No copied runtime file | Marker, placeholder, restore, rename, lock, and known-limit behavior | Keep Kiro registration and Kiro Stop semantics in `PORTING.md`/`simplify-ignore.json`; do not activate the source document as a second registration |
| `.codex/hooks/session-start-test.sh` | No runtime target | Use its session payload cases as test intent | Recreate cases in the explicit-sandbox harness because the source test uses default `mktemp` and tests the Codex JSON envelope |
| `.codex/hooks/simplify-ignore-test.sh` | No runtime target | Use its marker, newline, malformed-input, and recovery cases as test intent | Recreate cases in the explicit-sandbox harness; do not execute the source test as a Kiro hook |

`beads-context.sh` has no one-file source counterpart. It is the explicitly documented Kiro adapter for the `SessionStart`/`UserPromptSubmit` intent in `.codex/hooks.json`: consume and discard hook stdin, invoke read-only `bd prime` once when `bd` exists, and remain non-blocking when it does not. It must not mutate Beads state.

## Ordered execution

- [x] **1. Freeze the protected source and establish the evidence workspace.**
      Refuse to proceed if the protected Codex paths already have a staged or unstaged diff. Create the evidence root only if it does not already exist: `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-evidence/`. Write `runtime-files.txt` with the twelve target paths and `codex-source-files.txt` with the twelve protected source paths, then capture byte counts and SHA-256 hashes before any validation. Capture the existing `.kiro/hooks/.sdd-cache` inventory separately and record whether `.kiro/hooks/.simplify-ignore-cache` exists. Never use the evidence directory to overwrite an earlier run.
      Files: `/Volumes/Programme/github/family_app/fam/.kiro/hooks/.workflow/plan.md`, the new evidence files under `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-evidence/`; read-only checks on `.codex/hooks/**`, `.codex/hooks.json`, `.kiro/hooks/**`.
      Verify: run `cd /Volumes/Programme/github/family_app/fam && git diff --quiet -- .codex/hooks .codex/hooks.json && git diff --cached --quiet -- .codex/hooks .codex/hooks.json`; both commands must exit 0. Run the retained manifest command `bash /Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-evidence/capture-manifests.sh before`; it must report exactly 12 target runtime rows and exactly 12 protected source rows, with path, byte count, and SHA-256 in `runtime-before.tsv` and `codex-source-before.tsv`.

- [x] **2. Validate the Kiro v1 configuration and the complete mapping before exercising runtime behavior.**
      Check all five target JSON files with `python3 -m json.tool`, all five target shell files with `bash -n`, and both Python guards with `ast.parse` without generating bytecode. The retained structural checker must verify `version: "v1"`, `hooks` arrays, unique hook names, supported trigger/matcher assignments, command-only actions, and exact script targets. It must also fail on `hookSpecificOutput`, `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `PreCompact`, `PostCompact`, `statusMessage`, or `async` in target configurations. Verify the path-root, payload-field, trigger, and matcher mapping above rather than accepting a structurally valid but semantically wrong registration.
      Files: twelve target runtime files under `/Volumes/Programme/github/family_app/fam/.kiro/hooks/`; retained checker and log under `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-evidence/`.
      Verify: the temporary structural harness `python3 $E/check_static.py` was run with exit 0; its exact invocation and result are retained in `commands.log` and `static.log`, and the harness was removed after validation.

- [x] **3. Prove SessionStart, UserPromptSubmit, and guard behavior with stored case-level evidence.**
      Use isolated payloads and an explicit PATH sandbox. Cover `session-start.sh` with `{}` and non-JSON input, the present skill, and a copied missing-skill fixture; cover `beads-context.sh` with no `bd` and with a stub that records exactly one `prime` call for each event. Do not invoke the real `bd prime`. For each guard, run source and target parser copies with the same payloads: all existing allow/deny cases, wrapper/assignment/redirection/pipeline/multiple-segment cases, and 11 malformed or incomplete payloads per guard. A guard case must include case name, exact JSON payload, expected source and target exit codes, actual exit codes, stdout/stderr, and a sentinel proving no payload command ran.
      Files: target runtime files `session-start.sh`, `beads-context.sh`, `block-git-reset.py`, `block-bd-update-notes.py`; source files are read-only; evidence in `session-beads.jsonl`, `guards.jsonl`, `commands.log`, and the sandbox under `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-evidence/`.
      Verify: the temporary harness `python3 $E/run_session_guards.py` was run with exit 0 and wrote `PASS` records for every case. Its exact invocation is in `commands.log`; the harness was removed after validation.

- [x] **4. Validate `sdd-cache` entirely in a private local sandbox and preserve the existing target cache.**
      Copy the target cache scripts into an evidence sandbox so their script-directory cache resolves inside that sandbox, and run a local `ThreadingHTTPServer` bound only to `127.0.0.1`. Exercise cache miss, HTTP 200 and 304, ETag, Last-Modified, validator mismatch, missing validator, missing/invalid payloads, empty/unknown responses, and response forms `tool_response.result`, `output`, `text`, `content`, `body`, and a string. Compare source and target exit/output semantics for the common cases; treat the Kiro `web_fetch` matcher and `.kiro/hooks/.sdd-cache` path as adapters. Capture each request, expected/actual exit code, relevant stdout/stderr, created cache file/hash, and cleanup result. Do not write the pre-existing target cache during the matrix.
      Files: target `sdd-cache.json`, `sdd-cache-pre.sh`, `sdd-cache-post.sh`; read-only source counterparts; evidence `sdd-cache.jsonl`, `sdd-cache-server.log`, `sdd-cache-before.tsv`, `sdd-cache-after.tsv`, and private sandbox under the evidence root.
      Verify: the temporary harness `python3 $E/run_cache_matrix.py` was run with exit 0, recorded local 200/304 responses, and left the test sandbox absent after cleanup. Its exact invocation is in `commands.log`; the harness was removed after validation. The local matrix did not write the pre-existing target cache.

- [x] **5. Run the `simplify-ignore` read/write/Stop matrix and the source-vs-target tool-limit differential.**
      Use separate copied source and target scripts and separate fixtures/caches. Cover both `tool_input.path` and `tool_input.file_path`, `read`/`Read`, `write`/`Write`/`edit`/`Edit`, multiple closed blocks, reason/no-reason blocks, an unclosed block, HTML/comment suffixes, no-marker input, idempotent repeated reads, a missing/deleted source before Stop, `.recovered` recovery, changed placeholders, no trailing newline, orphan locks, and complete cleanup. Every case stores the payload, expected/actual exit code, relevant output, resulting file bytes, cache artifact inventory, and cleanup proof.
      Then run the same Stop/read/write fixtures against source and target while selectively hiding `jq`, hash tools, and `perl` through an explicit PATH sandbox. This is the required parity decision for HOOK-003 and HOOK-004:
      - If missing `jq` produces the same source and target result, document it as inherited source behavior and do not edit the target.
      - If missing hash tools shows the expected source restore but the target exits before `Stop` because the target has a global hash precheck, make only the minimal target change that places that precheck after the matcherless Stop restore; this aligns the target with the source and is not new hardening. Re-run the differential and normal matrix.
      - If missing `perl` has the same source and target result, document the inherited `perl` dependency and host/tool limit; do not add a shell fallback or install anything. If the target demonstrably differs, align only the target's control flow with the source and record the before/after target hash. Never change `.codex`.
      Files: target `simplify-ignore.json`, `simplify-ignore.sh`; source `.codex/hooks/simplify-ignore.sh` and `.codex/hooks/SIMPLIFY-IGNORE.md` read-only; evidence `simplify-ignore.jsonl`, `tool-availability.txt`, `simplify-cleanup.tsv`, and isolated sandbox under the evidence root.
      Verify: the temporary harness `python3 $E/run_simplify_matrix.py` was run with exit 0, recorded every normal and differential case, left the final sandbox absent, and passed the post-fix hash-tool Stop regression. Its exact invocation is in `commands.log`; the temporary harness was removed after execution.

- [x] **6. Make no runtime edit unless the evidence proves a source/target parity defect.**
      For the current evidence, the observed outcome is one minimal target runtime edit: the target-only hash-tool precheck was moved below the matcherless Stop restore branch after `missing-hash-stop-after-read` proved a source/target state difference. No fallback tooling, new error recovery, new policy, or “modernized” shell/Python code was added. The `jq` and `perl` dependency cases remain documented inherited limits.
      Files: only the demonstrated target runtime file, most likely `/Volumes/Programme/github/family_app/fam/.kiro/hooks/simplify-ignore.sh`; decision record under the evidence root. Never modify `.codex` files.
      Verify: rerun the target manifest as `runtime-after.tsv`; compare it to `runtime-before.tsv` row by row. Every changed hash must have a corresponding parity decision record and focused regression case. The final comparison must show only the documented `simplify-ignore.sh` parity correction; all eleven other target hashes and all twelve protected source hashes must remain byte-identical. HOOK-003/004 must explicitly disposition the inherited `jq`/`perl` limits and the corrected hash-tool Stop flow.

- [x] **7. Reconcile the host-semantic boundary without overstating local simulations.**
      Record what was checked against the official Kiro v1, trigger, and action documentation linked from `PORTING.md`, including whether the pages were machine-readable and which URLs/date were used. State separately that local JSON validation and direct STDIN execution prove only configuration shape, script syntax, payload handling, and the local command exit behavior. A real Kiro IDE activation, event dispatch, matcher resolution, hook ordering, and host handling of exit 2 must be marked `NOT EXECUTED` unless the actual Kiro host is run; never call the local harness an end-to-end host test. The local HTTP server and `bd` stub must likewise be labeled simulations.
      Files: evidence `host-boundary.md`; `.kiro/hooks/.workflow/implementation.md`, `.kiro/hooks/.workflow/review.md`, `.kiro/hooks/.workflow/review.json`, and the final report `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-final.md`.
      Verify: review `host-boundary.md` and require explicit `LOCAL/STATIC`, `SIMULATED`, and `REAL KIRO HOST: NOT EXECUTED` sections. No approval text may claim that a local STDIN or HTTP test proves Kiro host dispatch.

- [x] **8. Store the reproducible reports and resolve the prior gate from evidence, not summaries.**
      The stored implementation, review, and gate reports were reconciled against the evidence. The current reports document every required case log, the target before/after twelve-file inventory, the separate protected Codex source hashes and staged/unstaged protection checks, the single demonstrated runtime parity correction, and the host boundary. The authoritative gate is now `APPROVED` with an empty findings list; the historical `CHANGES_REQUESTED` review remains only as prior-review history. No runtime matrix was rerun for this final documentation synchronization.
      Files: `/Volumes/Programme/github/family_app/fam/.kiro/hooks/.workflow/implementation.md`, `/Volumes/Programme/github/family_app/fam/.kiro/hooks/.workflow/review.md`, `/Volumes/Programme/github/family_app/fam/.kiro/hooks/.workflow/review.json`, `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-final.md`, the independent review `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-paritaet-review.md`, the authoritative gate `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-gate.json`, and evidence files under `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-evidence/`.
      Verify: the stored JSON and focused validation results were reviewed; every report points to stored evidence, and EVIDENCE-001 through EVIDENCE-003 are explicitly closed.

- [x] **9. Perform the final focused gate and protected-source check without committing or pushing.**
      The stored final focused gate, manifest, cache, cleanup, and protected-source checks all passed. The authoritative gate remains `APPROVED` with `findings: []`; the twelve protected Codex source paths remain byte-identical, and the existing target cache and cleanup state remain accounted for. This status synchronization performed no runtime execution and made no commit, push, reset, or staged change.
      Files: the five synchronized status/report files and the read-only evidence, gate, independent-review, cache, cleanup, and protected-source records; no runtime file and no `.codex` file.
      Verify: the recorded final sequence contains `python3 $E/check_static.py`, `python3 $E/run_session_guards.py`, `python3 $E/run_cache_matrix.py`, `python3 $E/run_simplify_matrix.py`, `python3 $E/capture_manifests.py after`, and the protected-path diff checks, all with exit 0. The final status pass did not rerun that sequence or any runtime matrix.

## Evidence file contract

The implementation step must retain this minimum evidence set under `/Volumes/Programme/github/family_app/fam/.agents/tasks/codex-hook-portierung-evidence/` rather than relying on prose summaries:

- `runtime-files.txt`, `runtime-before.tsv`, `runtime-after.tsv`: the twelve target runtime paths, byte counts, and SHA-256 values.
- `codex-source-files.txt`, `codex-source-before.tsv`, `codex-source-after.tsv`, `codex-protection.txt`: the twelve protected source paths, byte counts, SHA-256 values, staged/unstaged diff results, and explicit `.codex` unchanged proof.
- `commands.log`: exact commands, working directory, tool versions, timestamps, and exit codes.
- `session-beads.jsonl`, `guards.jsonl`, `sdd-cache.jsonl`, `simplify-ignore.jsonl`: one structured record per focused case. Every record includes case ID, payload or fixture description, expected exit code, actual exit code, relevant stdout/stderr, and cleanup result.
- `sdd-cache-before.tsv`, `sdd-cache-after.tsv`, `simplify-cleanup.tsv`, `tool-availability.txt`, `host-boundary.md`: cache preservation, cleanup proof, missing-tool observations, and the local/static versus real-host boundary.
- `decision-HOOK-003-004.md` when those findings are evaluated, and `runtime-change-record.md` only if a target runtime file changes.

The evidence harness itself may live in this evidence directory and must use only its private sandbox beneath that directory. It must not be registered as a hook, copied into `.codex`, or left in `.kiro/hooks`.

## Completion criteria

The port is complete only when the source-to-target mapping is reflected in the target files, all focused evidence is stored, the twelve target files have a defensible before/after hash comparison, the twelve protected Codex sources have a separate unchanged hash/diff comparison, HOOK-003 and HOOK-004 are either corrected solely for a proven parity difference or documented as inherited source/tool limits, and HOOK-005 clearly separates static/local simulation from real Kiro host activation. The final report must not claim more than the evidence proves.
