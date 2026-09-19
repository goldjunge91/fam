import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  loadSpeechGoldLabels,
} from '../../.maestro/scripts/speech-gold-labels';
import { compareSpeechGoldLabel } from '../../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/speech-gold-comparison';
import {
  runSpeechGoldEvaluation,
  type SpeechGoldDiagnosticAdapter,
  type SpeechGoldRunManifest,
} from '../../scripts/speech-gold-runner';
import type { SpeechGoldLabel } from '../../src/features/shopping-list/natuerliches-hinzufuegen-von-einkaufsartikeln-beta/domain/speech-gold-contract';

const repositoryRoot = process.cwd();
const goldLabelsPath = path.resolve(
  repositoryRoot,
  'datensätze/20-saetze-neu/20-saetze-gold-labels.jsonl',
);
const plannedAudioIds = ['satz-01.wav', 'satz-02.wav', 'satz-03.wav'] as const;

async function createOutputDirectory(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'fam-speech-gold-runner-'));
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

function labelsByAudio(labels: readonly SpeechGoldLabel[]): Map<string, SpeechGoldLabel> {
  return new Map(labels.map((label) => [label.audio, label]));
}

function exactAdapter(labels: readonly SpeechGoldLabel[]): SpeechGoldDiagnosticAdapter {
  const byAudio = labelsByAudio(labels);
  return {
    async getDiagnostic(label) {
      const expected = byAudio.get(label.audio);
      if (!expected) throw new Error(`Unbekanntes Testaudio: ${label.audio}`);
      return {
        items: expected.items,
        unparsedText: expected.expectedUnparsedText,
      };
    },
  };
}

describe('runSpeechGoldEvaluation', () => {
  let outputDirectory: string;

  beforeEach(async () => {
    outputDirectory = await createOutputDirectory();
  });

  afterEach(async () => {
    await rm(outputDirectory, { recursive: true, force: true });
  });

  it('writes a complete comparison, summary and manifest for every planned audio', async () => {
    const labels = await loadSpeechGoldLabels(goldLabelsPath);

    const result = await runSpeechGoldEvaluation({
      goldLabelsPath,
      outputDirectory,
      plannedAudioIds,
      adapter: exactAdapter(labels),
      now: () => new Date('2026-09-19T10:00:00.000Z'),
    });

    expect(result.manifest.status).toBe('completed');
    expect(result.manifest.plannedAudioIds).toEqual(plannedAudioIds);
    expect(result.manifest.lastCompletedAudio).toBe('satz-03.wav');
    expect(result.manifest.counts).toEqual({ planned: 3, completed: 3, exactMatch: 3 });
    expect(result.summary).toMatchObject({
      fixtureCount: 3,
      completedFixtureCount: 3,
      exactMatchFixtureCount: 3,
    });
    expect(
      (await readFile(path.join(outputDirectory, 'comparisons.jsonl'), 'utf8')).trim().split('\n'),
    ).toHaveLength(3);
    expect(await readJson(path.join(outputDirectory, 'summary.json'))).toMatchObject({
      fixtureCount: 3,
      completedFixtureCount: 3,
    });
    expect(
      await readJson<SpeechGoldRunManifest>(path.join(outputDirectory, 'manifest.json')),
    ).toMatchObject({
      status: 'completed',
      lastCompletedAudio: 'satz-03.wav',
      counts: { planned: 3, completed: 3 },
    });
  });

  it('marks a failed fixture and resumes by repeating only that fixture', async () => {
    const labels = await loadSpeechGoldLabels(goldLabelsPath);
    const byAudio = labelsByAudio(labels);

    await expect(
      runSpeechGoldEvaluation({
        goldLabelsPath,
        outputDirectory,
        plannedAudioIds,
        adapter: {
          async getDiagnostic(label) {
            if (label.audio === 'satz-02.wav') throw new Error('diagnostic unavailable');
            const expected = byAudio.get(label.audio);
            if (!expected) throw new Error(`Unbekanntes Testaudio: ${label.audio}`);
            return { items: expected.items, unparsedText: expected.expectedUnparsedText };
          },
        },
      }),
    ).rejects.toThrow('diagnostic unavailable');

    const failedManifest = await readJson<SpeechGoldRunManifest>(
      path.join(outputDirectory, 'manifest.json'),
    );
    expect(failedManifest).toMatchObject({
      status: 'failed',
      lastCompletedAudio: 'satz-01.wav',
      counts: { planned: 3, completed: 1 },
    });

    const resumedAudio: string[] = [];
    const result = await runSpeechGoldEvaluation({
      goldLabelsPath,
      outputDirectory,
      plannedAudioIds,
      resume: true,
      adapter: {
        async getDiagnostic(label) {
          resumedAudio.push(label.audio);
          const expected = byAudio.get(label.audio);
          if (!expected) throw new Error(`Unbekanntes Testaudio: ${label.audio}`);
          return { items: expected.items, unparsedText: expected.expectedUnparsedText };
        },
      },
    });

    expect(resumedAudio).toEqual(['satz-02.wav', 'satz-03.wav']);
    expect(result.manifest.status).toBe('completed');
    expect(result.manifest.counts.completed).toBe(3);
  });

  it('rejects malformed nested comparison data during resume', async () => {
    const labels = await loadSpeechGoldLabels(goldLabelsPath);
    const comparison = compareSpeechGoldLabel(labels[0]!, {
      items: labels[0]!.items,
      unparsedText: labels[0]!.expectedUnparsedText,
    });

    await writeFile(
      path.join(outputDirectory, 'comparisons.jsonl'),
      `${JSON.stringify({ ...comparison, missing: [{ name: 'not-a-gold-item' }] })}\n`,
    );
    await writeFile(
      path.join(outputDirectory, 'manifest.json'),
      `${JSON.stringify({ createdAt: '2026-09-19T10:00:00.000Z' })}\n`,
    );

    await expect(
      runSpeechGoldEvaluation({
        goldLabelsPath,
        outputDirectory,
        plannedAudioIds: ['satz-01.wav'],
        resume: true,
        adapter: exactAdapter(labels),
      }),
    ).rejects.toThrow('vollständigen Vergleich');
  });

  it('rejects a structurally valid comparison whose mismatch fields are forged', async () => {
    const labels = await loadSpeechGoldLabels(goldLabelsPath);
    const comparison = compareSpeechGoldLabel(labels[0]!, {
      items: labels[0]!.items,
      unparsedText: labels[0]!.expectedUnparsedText,
    });
    const forgedComparison = {
      ...comparison,
      mismatched: [
        {
          expected: labels[0]!.items[0]!,
          actual: labels[0]!.items[0]!,
          fields: ['quantity'],
        },
      ],
      matchedItemCount: comparison.matchedItemCount - 1,
      exactMatch: false,
    };

    await writeFile(
      path.join(outputDirectory, 'comparisons.jsonl'),
      `${JSON.stringify(forgedComparison)}\n`,
    );
    await writeFile(
      path.join(outputDirectory, 'manifest.json'),
      `${JSON.stringify({ createdAt: '2026-09-19T10:00:00.000Z' })}\n`,
    );

    await expect(
      runSpeechGoldEvaluation({
        goldLabelsPath,
        outputDirectory,
        plannedAudioIds: ['satz-01.wav'],
        resume: true,
        adapter: exactAdapter(labels),
      }),
    ).rejects.toThrow(/nicht konsistent|inconsistent/i);
  });

  it('does not trust an incomplete manifest marked completed during resume', async () => {
    const labels = await loadSpeechGoldLabels(goldLabelsPath);
    const byAudio = labelsByAudio(labels);
    const firstTwo = labels.filter((label) =>
      plannedAudioIds.slice(0, 2).includes(label.audio as (typeof plannedAudioIds)[number]),
    );
    const partialComparisons = firstTwo.map((label) =>
      compareSpeechGoldLabel(label, {
        items: label.items,
        unparsedText: label.expectedUnparsedText,
      }),
    );

    await writeFile(
      path.join(outputDirectory, 'comparisons.jsonl'),
      `${partialComparisons.map((comparison) => JSON.stringify(comparison)).join('\n')}\n`,
    );
    await writeFile(
      path.join(outputDirectory, 'manifest.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        status: 'completed',
        plannedAudioIds,
        lastCompletedAudio: 'satz-02.wav',
        counts: { planned: 3, completed: 2, exactMatch: 2 },
        createdAt: '2026-09-19T10:00:00.000Z',
        updatedAt: '2026-09-19T10:00:01.000Z',
      })}\n`,
    );

    const resumedAudio: string[] = [];
    const result = await runSpeechGoldEvaluation({
      goldLabelsPath,
      outputDirectory,
      plannedAudioIds,
      resume: true,
      adapter: {
        async getDiagnostic(label) {
          resumedAudio.push(label.audio);
          const expected = byAudio.get(label.audio);
          if (!expected) throw new Error(`Unbekanntes Testaudio: ${label.audio}`);
          return { items: expected.items, unparsedText: expected.expectedUnparsedText };
        },
      },
    });

    expect(resumedAudio).toEqual(['satz-03.wav']);
    expect(result.manifest.status).toBe('completed');
    expect(result.manifest.counts).toEqual({ planned: 3, completed: 3, exactMatch: 3 });
  });
});
