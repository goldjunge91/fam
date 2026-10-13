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

The follow-up run completed page verification and report generation, then hit
the same six-hour limit during R2 publication. Separate the verification and
publication jobs so each receives its own runner window. Transfer only the
verified inputs the publisher consumes and the byte-checked page assets in a
short-lived GitHub artifact; keep the diagnostic report artifact on its
existing longer retention. Use no compression or minimal compression for page
images, and a stable artifact name per run so GitHub's "rerun failed jobs"
behavior can retry only publication without repeating the full crawl.

The publication bundle is short-lived because it contains up to the configured
7.25 GB image budget. GitHub documents per-account included artifact storage
and hourly usage billing, so the one-day artifact lifetime minimizes storage
while keeping the publisher retryable.

## Acceptance evidence

- Focused tests prove batched uses are complete, duplicate-safe, atomic, and
  reject corrupt/missing assets without persisting partial state.
- Focused verifier tests prove successful full-page verification still writes
  the complete seen-hash index and resumes from already verified local assets.
- Biome, TypeScript, and workflow YAML checks pass for changed files.
- The verification and publication jobs each have their own six-hour runner
  limit; publication depends on successful verification and downloads the
  matching run's verified bundle.
- A newly dispatched full run completes both jobs before either runner limit.
