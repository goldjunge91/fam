import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import {
  openSeenHashIndex,
  SeenHashAssetCorruptError,
  SeenHashIndexCorruptError,
} from '../../tools/crawler/brochures/listing-only/seen-hashes';
import { hashOrderedPageSet } from '../../tools/crawler/brochures/listing-only/full-brochure-signature';

const testDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    testDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createTestDirectory(): Promise<string> {
  const directory = await mkdtemp(
    join(process.cwd(), 'tools/crawler/data/retailer-seen-hashes-test-'),
  );
  testDirectories.push(directory);
  return directory;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('local seen-hash index', () => {
  it('keeps full brochure identity distinct when covers match but later pages differ', () => {
    const coverHash = 'a'.repeat(64);
    const firstBrochureHash = hashOrderedPageSet(
      [{ pageNumber: 1, sha256: coverHash }, { pageNumber: 2, sha256: 'b'.repeat(64) }],
      2,
    );
    const secondBrochureHash = hashOrderedPageSet(
      [{ pageNumber: 1, sha256: coverHash }, { pageNumber: 2, sha256: 'c'.repeat(64) }],
      2,
    );

    expect(firstBrochureHash).not.toBe(coverHash);
    expect(secondBrochureHash).not.toBe(coverHash);
    expect(secondBrochureHash).not.toBe(firstBrochureHash);
  });

  it('serializes parallel same-hash and different-hash writes without losing uses', async () => {
    const directory = await createTestDirectory();
    const assetsDir = join(directory, 'assets');
    const indexPath = join(directory, 'seen-hashes.json');
    const assetA = Buffer.from('cover image A');
    const assetB = Buffer.from('cover image B');
    const hashA = sha256(assetA);
    const hashB = sha256(assetB);
    await mkdir(assetsDir, { recursive: true });
    await writeFile(join(assetsDir, 'a.jpg'), assetA);
    await writeFile(join(assetsDir, 'b.jpg'), assetB);
    const index = await openSeenHashIndex({ indexPath, assetsDir });

    await Promise.all([
      index.record({ sha256: hashA, assetPath: 'a.jpg', use: { brochureId: 'brn-1', pageNumber: 1 } }),
      index.record({ sha256: hashA, assetPath: 'a.jpg', use: { brochureId: 'brn-2', pageNumber: 3 } }),
      index.record({ sha256: hashB, assetPath: 'b.jpg', use: { brochureId: 'brn-3', pageNumber: 2 } }),
      index.record({ sha256: hashA, assetPath: 'a.jpg', use: { brochureId: 'brn-1', pageNumber: 1 } }),
    ]);

    const snapshot = await index.snapshot();
    expect(Object.keys(snapshot.entries)).toEqual([hashA, hashB].sort());
    expect(snapshot.entries[hashA]?.assetPath).toBe('a.jpg');
    expect(snapshot.entries[hashA]?.uses).toEqual([
      { brochureId: 'brn-1', pageNumber: 1 },
      { brochureId: 'brn-2', pageNumber: 3 },
    ]);
    expect(snapshot.entries[hashB]?.uses).toEqual([{ brochureId: 'brn-3', pageNumber: 2 }]);
    expect(snapshot.revision).toBe(3);
    expect(JSON.parse(await readFile(indexPath, 'utf8'))).toMatchObject({ version: 1, revision: 3 });
    expect(await readdir(directory)).not.toContain('seen-hashes.json.tmp');
  });

  it('is idempotent after reopening and validates every indexed asset against its hash', async () => {
    const directory = await createTestDirectory();
    const assetsDir = join(directory, 'assets');
    const assetBytes = Buffer.from('recoverable asset');
    const assetHash = sha256(assetBytes);
    const assetPath = join(assetsDir, `${assetHash}.jpg`);
    const indexPath = join(directory, 'seen-hashes.json');
    await mkdir(assetsDir, { recursive: true });
    await writeFile(assetPath, assetBytes);
    const first = await openSeenHashIndex({ indexPath, assetsDir });
    const use = { brochureId: 'brn-42', pageNumber: 1 };
    expect(await first.record({ sha256: assetHash, assetPath: `${assetHash}.jpg`, use })).toBe(true);

    const reopened = await openSeenHashIndex({ indexPath, assetsDir });
    expect(await reopened.record({ sha256: assetHash, assetPath: `${assetHash}.jpg`, use })).toBe(false);
    expect(await reopened.snapshot()).toMatchObject({
      revision: 1,
      entries: {
        [assetHash]: { sha256: assetHash, assetPath: `${assetHash}.jpg`, uses: [use] },
      },
    });
  });

  it('recovers a complete atomic temporary index when the destination is absent', async () => {
    const directory = await createTestDirectory();
    const assetsDir = join(directory, 'assets');
    await mkdir(assetsDir, { recursive: true });
    const assetBytes = Buffer.from('recover from staged index');
    const assetHash = sha256(assetBytes);
    await writeFile(join(assetsDir, `${assetHash}.jpg`), assetBytes);
    const indexPath = join(directory, 'seen-hashes.json');
    const first = await openSeenHashIndex({ indexPath, assetsDir });
    await first.record({
      sha256: assetHash,
      assetPath: `${assetHash}.jpg`,
      use: { brochureId: 'brn-recovery', pageNumber: 1 },
    });

    await rename(indexPath, `${indexPath}.tmp`);
    const recovered = await openSeenHashIndex({ indexPath, assetsDir });

    expect(await recovered.snapshot()).toMatchObject({
      revision: 1,
      entries: { [assetHash]: { assetPath: `${assetHash}.jpg` } },
    });
    await expect(readFile(indexPath, 'utf8')).resolves.toContain(assetHash);
    await expect(readdir(directory)).resolves.not.toContain('seen-hashes.json.tmp');
  });

  it('rejects a damaged index without replacing it with an empty index', async () => {
    const directory = await createTestDirectory();
    const assetsDir = join(directory, 'assets');
    const indexPath = join(directory, 'seen-hashes.json');
    const damagedBytes = Buffer.from('{ damaged json');
    await writeFile(indexPath, damagedBytes);

    await expect(openSeenHashIndex({ indexPath, assetsDir })).rejects.toBeInstanceOf(
      SeenHashIndexCorruptError,
    );
    await expect(readFile(indexPath)).resolves.toEqual(damagedBytes);
  });

  it('rejects an asset whose bytes do not match the indexed SHA-256', async () => {
    const directory = await createTestDirectory();
    const assetsDir = join(directory, 'assets');
    await mkdir(assetsDir, { recursive: true });
    const actualBytes = Buffer.from('not the claimed asset');
    const expectedHash = sha256(Buffer.from('claimed asset'));
    await writeFile(join(assetsDir, 'wrong.jpg'), actualBytes);
    const index = await openSeenHashIndex({
      indexPath: join(directory, 'seen-hashes.json'),
      assetsDir,
    });

    await expect(
      index.record({
        sha256: expectedHash,
        assetPath: 'wrong.jpg',
        use: { brochureId: 'brn-wrong', pageNumber: 1 },
      }),
    ).rejects.toBeInstanceOf(SeenHashAssetCorruptError);
    await expect(readdir(directory)).resolves.not.toContain('seen-hashes.json');
  });
});
