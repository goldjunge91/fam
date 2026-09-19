#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildQualityCohortReport,
  parseQualitySnapshotInput,
  type QualityCohortReport,
  renderQualityCohortText,
} from '@/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/quality-cohort-report';

export const QUALITY_COHORT_REPORT_FILE_NAMES = {
  html: 'quality-cohort-report.html',
  json: 'quality-cohort-report.json',
  text: 'quality-cohort-report.txt',
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderQualityCohortHtml(report: QualityCohortReport): string {
  const json = escapeHtml(JSON.stringify(report, null, 2));
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>fam Qualitäts-Kohortenreport</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 1rem; border: 1px solid #999; border-radius: .5rem; }
</style>
</head>
<body>
<h1>fam Qualitäts-Kohortenreport</h1>
<p>Offline-Auswertung aus sanitisierten Qualitäts-Snapshots.</p>
<pre>${json}</pre>
</body>
</html>
`;
}

export async function runQualityCohortReport(
  inputPath: string,
  outputDirectory = path.dirname(inputPath),
): Promise<QualityCohortReport> {
  const input = await readFile(inputPath, 'utf8');
  const snapshots = parseQualitySnapshotInput(input);
  const report = buildQualityCohortReport(snapshots);

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDirectory, QUALITY_COHORT_REPORT_FILE_NAMES.json),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      path.join(outputDirectory, QUALITY_COHORT_REPORT_FILE_NAMES.text),
      `${renderQualityCohortText(report)}\n`,
      'utf8',
    ),
    writeFile(
      path.join(outputDirectory, QUALITY_COHORT_REPORT_FILE_NAMES.html),
      renderQualityCohortHtml(report),
      'utf8',
    ),
  ]);

  return report;
}

async function main(): Promise<void> {
  const [inputPathArg, outputDirectoryArg] = process.argv.slice(2);
  if (!inputPathArg) {
    throw new Error(
      'Verwendung: bun scripts/quality-cohort-report.ts <snapshot.json|snapshot.jsonl> [output-directory]',
    );
  }

  const inputPath = path.resolve(inputPathArg);
  const outputDirectory = path.resolve(outputDirectoryArg ?? path.dirname(inputPath));
  const report = await runQualityCohortReport(inputPath, outputDirectory);

  console.log(
    `Qualitäts-Kohortenreport geschrieben: ${outputDirectory} (${report.snapshotCount} Snapshot(s))`,
  );
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
