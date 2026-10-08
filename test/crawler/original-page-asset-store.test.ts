import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import {
  createOriginalPageAssetStore,
  OriginalPageAssetCorruptError,
} from '../../tools/crawler/brochures/listing-only/original-page-asset-store';

const testDirectories: string[] = [];

async function createTestDirectory(): Promise<string> {
  const root = await mkdtemp(join(process.cwd(), '.test-original-page-asset-store-'));
  const directory = join(root, 'assets');
  await mkdir(directory);
  testDirectories.push(root);
  return directory;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

afterEach(async () => {
  await Promise.all(testDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('original page asset store', () => {
  it('stores verified bytes atomically, reloads the occupied budget, and deduplicates', async () => {
    const directory = await createTestDirectory();
    const bytes = new TextEncoder().encode('original page bytes');
    const hash = sha256(bytes);
    const store = await createOriginalPageAssetStore(directory, bytes.byteLength);

    await expect(store.put(hash, bytes)).resolves.toBe(true);
    expect(await readFile(join(directory, `${hash}.bin`))).toEqual(Buffer.from(bytes));
    await expect(readdir(directory)).resolves.toEqual([`${hash}.bin`]);
    expect(store.storageBudget.snapshot()).toMatchObject({
      occupiedBytes: bytes.byteLength,
      reservedBytes: 0,
      remainingBudgetBytes: 0,
    });

    const reloaded = await createOriginalPageAssetStore(directory, bytes.byteLength);
    await expect(reloaded.put(hash, bytes)).resolves.toBe(false);
    await expect(reloaded.read(hash)).resolves.toEqual(bytes);
    expect(reloaded.storageBudget.snapshot().occupiedBytes).toBe(bytes.byteLength);
  });

  it('rejects supplied hashes that do not match the original bytes', async () => {
    const directory = await createTestDirectory();
    const store = await createOriginalPageAssetStore(directory, 100);
    const bytes = new TextEncoder().encode('original bytes');

    await expect(store.put('0'.repeat(64), bytes)).rejects.toThrow(/do not match/i);
  });

  it('rejects corrupted hash-named assets during startup and reads', async () => {
    const directory = await createTestDirectory();
    const expected = new TextEncoder().encode('expected bytes');
    const corrupted = new TextEncoder().encode('corrupted bytes');
    const hash = sha256(expected);
    await writeFile(join(directory, `${hash}.bin`), corrupted);

    await expect(createOriginalPageAssetStore(directory, 100)).rejects.toBeInstanceOf(
      OriginalPageAssetCorruptError,
    );

    await rm(join(directory, `${hash}.bin`));
    const store = await createOriginalPageAssetStore(directory, 100);
    await store.put(hash, expected);
    await writeFile(join(directory, `${hash}.bin`), corrupted);

    await expect(store.read(hash)).rejects.toBeInstanceOf(OriginalPageAssetCorruptError);
  });

  it('counts existing files against the required byte budget', async () => {
    const directory = await createTestDirectory();
    const existing = new TextEncoder().encode('already on disk');
    const next = new TextEncoder().encode('another original page');
    const existingHash = sha256(existing);
    await writeFile(join(directory, `${existingHash}.bin`), existing);
    const store = await createOriginalPageAssetStore(directory, existing.byteLength);

    await expect(store.put(sha256(next), next)).rejects.toThrow(/budget/i);
    expect(store.storageBudget.snapshot()).toMatchObject({
      occupiedBytes: existing.byteLength,
      reservedBytes: 0,
    });
  });
});
