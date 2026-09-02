#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { dirname, resolve } from 'node:path';

const DEFAULT_TEXT = 'Noch zwei Paprika und etwas Spinat';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseManualProposal(value) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return { itemCount: null, valid: false };
    return {
      itemCount: parsed.length,
      valid: parsed.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.normalizedName === 'string' &&
          'quantity' in item &&
          'unit' in item &&
          'storage' in item &&
          'date' in item,
      ),
    };
  } catch {
    return { itemCount: null, valid: false };
  }
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
}

const rl = createInterface({ input, output });
const providedText = option('--input', null);
const text = providedText ?? ((await rl.question(`Inventartext [${DEFAULT_TEXT}]: `)) || DEFAULT_TEXT);
const runs = positiveInteger(option('--runs', '3'), 3);
const proposalOption = option('--proposal', null);
const outputPath = resolve(option('--output', `reports/manual-capture-${Date.now()}.json`));
const records = [];

console.log('\nManuelle Baseline-Messung');
console.log('Ziel: normalizedName, quantity, unit, storage und date als JSON-Array erfassen.');
console.log('Beispiel: [{"normalizedName":"Paprika","quantity":2,"unit":"piece","storage":"fridge","date":null}]');
console.log('Die Zeit läuft erst nach der Startbestätigung und endet mit dem Absenden der JSON-Zeile.');

for (let index = 0; index < runs; index += 1) {
  if (proposalOption === null) {
    await rl.question(`\nDurchlauf ${index + 1}/${runs}: Enter zum Starten `);
  }
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const proposal = proposalOption ?? (await rl.question('Manuelle Erfassung als JSON-Array: '));
  const durationMs = Math.round(performance.now() - start);
  const finishedAt = new Date().toISOString();
  const parsed = parseManualProposal(proposal);
  records.push({
    run: index + 1,
    fixtureId: 'manual-capture-baseline-001',
    inputText: text,
    startedAt,
    finishedAt,
    durationMs,
    itemCount: parsed.itemCount,
    proposalValid: parsed.valid,
  });
  console.log(`Dauer: ${durationMs} ms${parsed.valid ? '' : ' (JSON/Minimalfelder nicht validiert)'}`);
}

const durations = records.map((record) => record.durationMs);
const report = {
  schema: 'fam.manual_capture_baseline.v1',
  measuredAt: new Date().toISOString(),
  fixtureId: 'manual-capture-baseline-001',
  inputText: text,
  runs: records,
  summary: {
    count: durations.length,
    minMs: Math.min(...durations),
    maxMs: Math.max(...durations),
    p50Ms: percentile(durations, 0.5),
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`\nReport gespeichert: ${outputPath}`);
console.log(`p50: ${report.summary.p50Ms} ms | min: ${report.summary.minMs} ms | max: ${report.summary.maxMs} ms`);
await rl.close();
