#!/usr/bin/env bun

/**
 * Floor-Check fuer neue oder stark veraenderte Quelldateien.
 *
 * Liest coverage/coverage-summary.json aus dem vorigen Coverage-Lauf und
 * meldet Dateien, die unter MIN_PERCENT liegen. Sinn: verhindert, dass eine
 * neue Datei ohne Tests entsteht, waehrend der globale Floor in
 * jest.config.js (70/60/65/72) eine leichte Gesamtverschlechterung weiter
 * zulässt.
 *
 * Es wird bewusst nicht die Coverage des Base-Branches gemessen: das
 * braeuchte zwei vollstaendige Laeufe (je ~10 min). Der Floor ist die
 * billige Variante, der echte Diff-Check waere die teure.
 *
 * Aufruf: bun scripts/check-new-file-coverage.ts [--staged]
 *   --staged  nur Dateien pruefen, die in der Git-Area liegen (fuer pre-commit)
 *   ohne     alle Dateien pruefen, die nicht vollstaendig abgedeckt sind
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Mindestabdeckung pro Metrik, in Prozent. Ein Datei-Eintrag unterhalb eines
 * dieser Werte wird gemeldet. Lines ist der uebergreifende Wert; die drei
 * anderen Metriken koennen nicht alle gleichzeitig 80 erreichen, ohne dass
 * triviale Dateien (Index, Layouts) den Check dauerhaft rot halten.
 */
const MIN_PERCENT = {
  lines: 80,
  statements: 80,
} as const;

const COVERAGE_SUMMARY = 'coverage/coverage-summary.json';
const REPORT_PREFIX = 'src/';
const PLATFORM_SOURCE = /\.(?:android|ios|web)\.tsx$/u;

type CoverageEntry = {
  lines: { pct: number };
  statements: { pct: number };
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readCoverageSummary(): Record<string, CoverageEntry> {
  let raw: string;
  try {
    raw = readFileSync(COVERAGE_SUMMARY, 'utf8');
  } catch {
    fail(
      `${COVERAGE_SUMMARY} fehlt. Der Floor-Check braucht den Lauf von\n` +
        `  bun run test:coverage:unit\n` +
        `der json-summary unter coverageReporters in jest.config.js aktiviert.`,
    );
  }

  let parsed: { total?: CoverageEntry } & Record<string, CoverageEntry>;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`${COVERAGE_SUMMARY} ist kein gueltiges JSON: ${String(error)}`);
  }

  // Keys sind absolute Pfade aus der Laufzeitumgebung. Auf den Repo-Root
  // normalisieren, damit sie unabhängig vom Arbeitsverzeichnis gültig sind.
  const normalized: Record<string, CoverageEntry> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'total' || !value || typeof value.lines?.pct !== 'number') continue;
    const relative = key.slice(key.indexOf(REPORT_PREFIX));
    if (relative === key) continue;
    normalized[relative] = value;
  }
  return normalized;
}

function stagedSourceFiles(): string[] {
  let output: string;
  try {
    output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      encoding: 'utf8',
    });
  } catch {
    // Ohne Git-Index (z. B. erster Lauf) ist nichts gestaged.
    return [];
  }

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith(REPORT_PREFIX) &&
        /\.tsx?$/u.test(line) &&
        !PLATFORM_SOURCE.test(line) &&
        !line.endsWith('.test.ts') &&
        !line.endsWith('.test.tsx') &&
        !line.endsWith('.d.ts'),
    );
}

const useStaged = process.argv.includes('--staged');
const summary = readCoverageSummary();

const candidates = useStaged ? stagedSourceFiles() : Object.keys(summary).sort();
const violations: string[] = [];

for (const file of candidates) {
  const entry = summary[file];
  if (!entry) {
    const extension = file.endsWith('.tsx') ? '.tsx' : '.ts';
    const platformAlternativeIsMeasured = ['android', 'ios', 'web'].some(
      (platform) => summary[`${file.slice(0, -extension.length)}.${platform}${extension}`],
    );

    // Datei kam in die Pipeline, wurde aber nie geladen: nicht von Jest
    // ausgefuehrt. Plattform-Alternativen werden nur fuer die aktive Jest-
    // Plattform gemessen.
    if (useStaged && !platformAlternativeIsMeasured) {
      violations.push(`${file}: nicht im Coverage-Lauf enthalten`);
    }
    continue;
  }

  for (const [metric, floor] of Object.entries(MIN_PERCENT)) {
    const actual = entry[metric as keyof typeof MIN_PERCENT].pct;
    if (actual < floor) {
      violations.push(`${file}: ${metric} ${actual.toFixed(1)}% < ${floor}%`);
    }
  }
}

if (violations.length > 0) {
  console.error('');
  console.error('Neue oder geaenderte Quelldateien unter dem Coverage-Floor:');
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  console.error('');
  console.error(
    `Mindestwerte: ${Object.entries(MIN_PERCENT)
      .map(([metric, floor]) => `${metric} ${floor}%`)
      .join(', ')}`,
  );
  console.error('Bitte Tests ergaenzen oder im Ausnahmefall im Beads-Task begruenden.');
  process.exit(1);
}

const scope = useStaged
  ? `${candidates.length} gestaged Datei(en)`
  : `${candidates.length} Datei(en)`;
console.log(`Coverage-Floor geprueft: ${scope}, keine Verstoesse.`);
