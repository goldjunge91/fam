# Legacy brochure crawler tools

The Bring-specific tools in this directory are archived and are not used by the
Expo app or a GitHub Actions workflow. Their publisher targets an old schema and
must not be run against the current project.

The active KaufDA runner is [`scripts/scrapers/run-kaufda.ts`](../../../scripts/scrapers/run-kaufda.ts)
and runs from [`.github/workflows/scrape-brochures.yml`](../../../.github/workflows/scrape-brochures.yml). It reuses the postal-code data file in this directory and stores no image bytes.
