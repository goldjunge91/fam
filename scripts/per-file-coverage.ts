import { readdirSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const EXCLUDED_SOURCE_NAME = /(?:\.test|\.spec)\.(?:ts|tsx|js|jsx)$/u;
const DECLARATION_FILE = /\.d\.ts$/u;

const COVERAGE_METRICS = ['statements', 'branches', 'functions', 'lines'] as const;

export type CoverageMetric = (typeof COVERAGE_METRICS)[number];

export type CoverageSummary = Record<string, Partial<Record<CoverageMetric, { pct: number }>>>;

export type CoverageViolation = {
  file: string;
  metric: CoverageMetric | 'scope';
  actual: number | null;
  minimum: 70;
};

/** Lists runtime source files without filtering platform or generated paths. */
export function collectProductiveSourceFiles(sourceRoot: string): string[] {
  const files: string[] = [];

  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }

      if (
        !entry.isFile() ||
        !SOURCE_EXTENSIONS.has(extname(entry.name)) ||
        EXCLUDED_SOURCE_NAME.test(entry.name) ||
        DECLARATION_FILE.test(entry.name)
      ) {
        continue;
      }

      files.push(path);
    }
  }

  visit(resolve(sourceRoot));
  return files.sort();
}

/** Checks every scoped source file, including files missing from Jest's summary. */
export function evaluatePerFileCoverage(
  sourceFiles: string[],
  summary: CoverageSummary,
  repositoryRoot: string,
): CoverageViolation[] {
  const violations: CoverageViolation[] = [];

  for (const sourceFile of sourceFiles) {
    const normalizedPath = resolve(sourceFile);
    const entry = summary[normalizedPath] ?? summary[relative(repositoryRoot, normalizedPath)];
    const file = relative(repositoryRoot, normalizedPath).replaceAll('\\', '/');

    if (!entry) {
      violations.push({ file, metric: 'scope', actual: null, minimum: 70 });
      continue;
    }

    for (const metric of COVERAGE_METRICS) {
      const actual = entry[metric]?.pct;
      if (actual === undefined || actual < 70) {
        violations.push({ file, metric, actual: actual ?? null, minimum: 70 });
      }
    }
  }

  return violations;
}
