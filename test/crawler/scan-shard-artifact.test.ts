import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import { createPhaseArtifact } from '../../tools/crawler/brochures/listing-only/phase-artifact';
import { mergeScanShards } from '../../tools/crawler/brochures/listing-only/scan-shard-artifact';

const binding = {
  repository: 'goldjunge91/fam',
  runId: '38116213100',
  commitSha: 'a'.repeat(40),
};
const roots: string[] = [];
const predecessorManifestSha256 = 'b'.repeat(64);

async function createShards(count = 4, duplicateZipAt?: number, wrongBindingAt?: number) {
  const root = await mkdtemp(join(process.cwd(), '.test-scan-shards-'));
  roots.push(root);
  const shardsDir = join(root, 'shards');
  await mkdir(shardsDir);
  for (let index = 0; index < count; index++) {
    const artifactDir = join(shardsDir, String(index));
    await mkdir(artifactDir);
    const zipCode = duplicateZipAt !== undefined && index === duplicateZipAt
      ? '00001'
      : `${index + 1}`.padStart(5, '0');
    await writeFile(
      join(artifactDir, 'all-stores-full.json'),
      JSON.stringify({
        generatedAt: '2026-10-22T00:00:00.000Z',
        totalLocations: 1,
        completedLocations: 1,
        byZipCode: { [zipCode]: [] },
        shard: { index, count: 4, zipCodes: [zipCode] },
      }),
    );
    await createPhaseArtifact({
      artifactDir,
      phase: 'scan-locations',
      files: ['all-stores-full.json'],
      binding: wrongBindingAt === index ? { ...binding, runId: 'foreign-run' } : binding,
      predecessorManifestSha256: [predecessorManifestSha256],
      shard: { index, count: 4, zipCodes: [zipCode] },
    });
  }
  return { root, shardsDir, outputPath: join(root, 'merged.json') };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('scan shard merge', () => {
  it('merges exactly four complete, disjoint shard artifacts', async () => {
    const fixture = await createShards();
    const result = await mergeScanShards({
      ...fixture,
      binding,
      predecessorManifestSha256,
    });

    expect(result.predecessorManifestSha256).toHaveLength(4);
    expect(JSON.parse(await readFile(fixture.outputPath, 'utf8'))).toMatchObject({
      totalLocations: 4,
      completedLocations: 4,
      byZipCode: {
        '00001': [],
        '00002': [],
        '00003': [],
        '00004': [],
      },
    });
  });

  it('rejects missing shards, duplicate ZIPs, and foreign run bindings without a merged output', async () => {
    const missing = await createShards(3);
    await expect(mergeScanShards({
      ...missing,
      binding,
      predecessorManifestSha256,
    })).rejects.toThrow('exactly the 4 numbered shard artifacts');
    await expect(readFile(missing.outputPath, 'utf8')).rejects.toThrow();

    const duplicate = await createShards(4, 3);
    await expect(mergeScanShards({
      ...duplicate,
      binding,
      predecessorManifestSha256,
    })).rejects.toThrow('more than one scan shard');

    const foreign = await createShards(4, undefined, 2);
    await expect(mergeScanShards({
      ...foreign,
      binding,
      predecessorManifestSha256,
    })).rejects.toThrow('binding');
    await expect(readFile(foreign.outputPath, 'utf8')).rejects.toThrow();
  });
});
