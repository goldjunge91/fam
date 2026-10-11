# Full-page verification runtime and recovery

## Objective

Prevent the full canonical brochure workflow from spending most of its six-hour
runner window rewriting an ever-growing local hash index. Keep the catalog
publication gate unchanged: no catalog is published unless every selected BRN
has a complete ordered page vector and the final verification report is built.

## Evidence and decision

The timed-out run completed 3,164 of 4,098 BRNs and downloaded 119,127 original
pages before GitHub cancelled the job at its six-hour limit. The verifier called
`seenHashIndex.record()` once per page. Each call validated the image, cloned and
sorted the complete index, serialized it in full, and atomically replaced the
file. The accumulated rewrite work grows with the number of pages already
indexed, so a large run incurred quadratic index I/O in its hottest path.

Collect page-use records in memory during verification and persist the complete
index once, only after every BRN has verified. Verify image bytes once per
distinct hash in bounded parallel batches before the atomic index write. The
existing per-page progress checkpoint remains the recovery source for a
resumed local run; an incomplete verification continues to fail closed and
cannot reach publication.

## Acceptance evidence

- Focused tests prove batched uses are complete, duplicate-safe, atomic, and
  reject corrupt/missing assets without persisting partial state.
- Focused verifier tests prove successful full-page verification still writes
  the complete seen-hash index and resumes from already verified local assets.
- Biome, TypeScript, and workflow YAML checks pass for changed files.
- A newly dispatched full run completes before the runner limit and publishes
  only after complete verification. Until that live run completes, recurrence
  prevention is an evidence-based performance fix, not a measured runtime
  guarantee.
