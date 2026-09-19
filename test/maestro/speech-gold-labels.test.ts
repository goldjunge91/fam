import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  loadSpeechGoldLabels,
  validateSpeechGoldLabels,
} from '../../.maestro/scripts/speech-gold-labels';

const goldLabelsPath = path.resolve(
  process.cwd(),
  'datensätze/20-saetze-neu/20-saetze-gold-labels.jsonl',
);

async function readGoldLabelLines(): Promise<Record<string, unknown>[]> {
  const content = await readFile(goldLabelsPath, 'utf8');
  return content
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function toJsonLines(labels: readonly unknown[]): string {
  return `${labels.map((label) => JSON.stringify(label)).join('\n')}\n`;
}

describe('speech gold label loader', () => {
  it('loads the complete 20-fixture gold source and normalizes missing brands', async () => {
    const labels = await loadSpeechGoldLabels(goldLabelsPath);

    expect(labels).toHaveLength(20);
    expect(labels.map((label) => label.audio)).toEqual([
      'satz-01.wav',
      'satz-02.wav',
      'satz-03.wav',
      'satz-04.wav',
      'satz-05.wav',
      'satz-06.wav',
      'satz-07.wav',
      'satz-08.wav',
      'satz-09.wav',
      'satz-10.wav',
      'satz-11.wav',
      'satz-12.wav',
      'satz-13.wav',
      'satz-14.wav',
      'satz-15.wav',
      'satz-16.wav',
      'satz-17.wav',
      'satz-18.wav',
      'satz-19.wav',
      'satz-20.wav',
    ]);
    expect(labels[0]?.items[0]?.brand).toBeNull();
  });

  it('rejects a missing gold label record', async () => {
    const content = await readFile(goldLabelsPath, 'utf8');
    const lines = content.trim().split(/\r?\n/u);
    lines[1] = 'null';

    expect(() => validateSpeechGoldLabels(`${lines.join('\n')}\n`)).toThrow(
      'Goldlabel-Zeile 2: enthält kein Goldlabel-Objekt',
    );
  });

  it('rejects duplicate audio IDs and reference lines', async () => {
    const labels = await readGoldLabelLines();
    labels[1] = { ...labels[0] };

    expect(() => validateSpeechGoldLabels(toJsonLines(labels))).toThrow(
      'Audio-ID satz-01.wav ist doppelt',
    );
  });

  it('rejects an item with an incorrectly typed quantity', async () => {
    const labels = await readGoldLabelLines();
    const firstLabel = labels[0];
    const items = firstLabel?.items;
    if (!Array.isArray(items) || !items[0]) throw new Error('Testfixture ist unvollständig.');
    items[0] = { ...(items[0] as Record<string, unknown>), quantity: '1' };

    expect(() => validateSpeechGoldLabels(toJsonLines(labels))).toThrow(
      'items[0].quantity muss eine endliche Zahl sein',
    );
  });

  it('rejects an item with an incorrectly typed unit', async () => {
    const labels = await readGoldLabelLines();
    const firstLabel = labels[0];
    const items = firstLabel?.items;
    if (!Array.isArray(items) || !items[0]) throw new Error('Testfixture ist unvollständig.');
    items[0] = { ...(items[0] as Record<string, unknown>), unit: 1 };

    expect(() => validateSpeechGoldLabels(toJsonLines(labels))).toThrow(
      'items[0].unit muss ein String oder null sein',
    );
  });

  it('rejects a non-null target list ID', async () => {
    const labels = await readGoldLabelLines();
    labels[0] = { ...labels[0], targetListId: 'shopping-list-1' };

    expect(() => validateSpeechGoldLabels(toJsonLines(labels))).toThrow(
      'targetListId muss null sein',
    );
  });

  it('rejects incomplete coverage of the satz-01..20 fixtures', async () => {
    const labels = await readGoldLabelLines();
    labels.pop();

    expect(() => validateSpeechGoldLabels(toJsonLines(labels))).toThrow(
      'Goldlabel-Abdeckung unvollständig: satz-20.wav fehlt',
    );
  });

  it('rejects an incompatible schema or fixture-set version', async () => {
    const labels = await readGoldLabelLines();
    labels[0] = { ...labels[0], schemaVersion: '1' };

    expect(() => validateSpeechGoldLabels(toJsonLines(labels))).toThrow(
      'schemaVersion muss 1 sein',
    );
  });

  it('rejects a mixed fixture-set version', async () => {
    const labels = await readGoldLabelLines();
    labels[1] = { ...labels[1], fixtureSetVersion: 'other-fixture-v1' };

    expect(() => validateSpeechGoldLabels(toJsonLines(labels))).toThrow(
      'fixtureSetVersion muss 20-saetze-neu-gold-v1 entsprechen',
    );
  });
});
