#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type CoverageSummary,
  collectProductiveSourceFiles,
  evaluatePerFileCoverage,
} from './per-file-coverage';

const repositoryRoot = process.cwd();
const coverageSummaryPath = resolve(repositoryRoot, 'coverage/coverage-summary.json');

let summary: CoverageSummary;
try {
  summary = JSON.parse(readFileSync(coverageSummaryPath, 'utf8')) as CoverageSummary;
} catch (error) {
  console.error(`Cannot read ${coverageSummaryPath}: ${String(error)}`);
  process.exit(1);
}

const sourceFiles = collectProductiveSourceFiles(resolve(repositoryRoot, 'src'));
const violations = evaluatePerFileCoverage(sourceFiles, summary, repositoryRoot);

if (violations.length > 0) {
  console.error(`Per-file coverage failed: ${violations.length} violation(s).`);
  for (const violation of violations) {
    const actual = violation.actual === null ? 'missing' : `${violation.actual}%`;
    console.error(
      `  ${violation.file}: ${violation.metric} ${actual} (minimum ${violation.minimum}%)`,
    );
  }
  process.exit(1);
}

console.log(`Per-file coverage passed: ${sourceFiles.length} productive source file(s) meet 70%.`);
