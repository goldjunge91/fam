#!/usr/bin/env bun
/**
 * classify.ts — Ad-hoc-Trace für die Einkaufslisten-Kategorisierung (Issue #223).
 *
 *   bun run scripts/classify.ts "2 Schnitzel vom Schwein Spar Fein Küche"
 *   bun run scripts/classify.ts "Fruchtsaft" --tags en:vegetables,en:fruit-juices
 *
 * Ruft direkt `explainCategory()` aus `src/features/shopping-list/classification/`
 * auf — keine zweite Implementierung der Klassifikationslogik. EAN-Lookup gegen
 * den Offline-Dump folgt, sobald `off-dump-v2.db` (Paket 4) existiert.
 */

import { explainCategory } from '../src/features/shopping-list/classification/shopping-category-classifier';

function parseArgs(argv: string[]): { name: string; categoryTags: string[] } {
  const nameParts: string[] = [];
  let categoryTags: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--tags') {
      const value = argv[i + 1] ?? '';
      categoryTags = value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      i++;
      continue;
    }
    nameParts.push(arg);
  }

  return { name: nameParts.join(' '), categoryTags };
}

function main() {
  const { name, categoryTags } = parseArgs(process.argv.slice(2));
  if (!name.trim()) {
    console.error('Nutzung: bun run scripts/classify.ts "<Artikelname>" [--tags en:tag1,en:tag2]');
    process.exit(1);
  }

  const trace = explainCategory({ name, categoryTags, source: 'free_text' });

  console.log(`\nEingabe:            "${name}"`);
  if (categoryTags.length > 0) console.log(`OFF-Tags:           ${categoryTags.join(', ')}`);
  console.log(`Normalisierter Name: ${trace.input.normalizedName ?? '(kein Token)'}`);
  console.log(`Classifier-Version:  ${trace.classifierVersion}`);
  console.log('');
  console.log(
    `Ergebnis: ${trace.winner.categoryId ?? 'Sonstiges'}  (Quelle: ${trace.winner.source ?? 'kein Signal'})`,
  );
  if (trace.winner.evidence) {
    console.log(`Beleg:    ${trace.winner.evidence.kind} = "${trace.winner.evidence.value}"`);
  }
  if (trace.conflictReason) {
    console.log(`Konflikt: ${trace.conflictReason}`);
  }

  if (trace.candidates.length > 0) {
    console.log('\nAlle Kandidaten:');
    for (const candidate of trace.candidates) {
      const isWinner =
        candidate.categoryId === trace.winner.categoryId &&
        candidate.value === trace.winner.evidence?.value;
      console.log(
        `  ${isWinner ? '✓' : ' '} ${candidate.kind.padEnd(9)} ${candidate.categoryId.padEnd(14)} "${candidate.value}" (Gewicht ${candidate.weight})`,
      );
    }
  }

  if (trace.rejectedCandidates.length > 0) {
    console.log('\nVerworfen:');
    for (const candidate of trace.rejectedCandidates) {
      console.log(
        `    ${candidate.kind.padEnd(9)} ${candidate.categoryId.padEnd(14)} "${candidate.value}" (Gewicht ${candidate.weight}, ${candidate.reason})`,
      );
    }
  }
  console.log('');
}

main();
