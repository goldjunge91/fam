import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createStorageBudget, type StorageBudget } from '../storage-policy';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class OriginalPageAssetCorruptError extends Error {
  constructor(readonly key: string) {
    super(`Original page asset does not match its SHA-256 filename: ${key}`);
    this.name = 'OriginalPageAssetCorruptError';
  }
}

export type OriginalPageAssetStore = {
  storageBudget: StorageBudget;
  put: (sha256: string, bytes: Uint8Array) => Promise<boolean>;
  read: (sha256: string) => Promise<Uint8Array | undefined>;
};

function assertSha256(sha256: string): void {
  if (!SHA256_PATTERN.test(sha256)) {
    throw new Error('Original page SHA-256 must be 64 lowercase hexadecimal characters.');
  }
}

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function loadExistingAssets(directory: string) {
  const assets: Array<{ key: string; bytes: number }> = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile()) {
      throw new Error(`Original page asset store must contain only files: ${entry.name}`);
    }

    const path = join(directory, entry.name);
    const file = await stat(path);
    let bytesOnDisk = file.size;
    if (entry.name.endsWith('.bin')) {
      const sha256 = entry.name.slice(0, -'.bin'.length);
      assertSha256(sha256);
      const bytes = await readFile(path);
      if (hashBytes(bytes) !== sha256) {
        throw new OriginalPageAssetCorruptError(entry.name);
      }
      bytesOnDisk = bytes.byteLength;
    }

    // Temporary and other regular files still occupy the required disk budget.
    assets.push({ key: entry.name, bytes: bytesOnDisk });
  }

  return assets;
}

/** Opens a dedicated content-addressed directory and accounts for its current bytes. */
export async function createOriginalPageAssetStore(
  directory: string,
  budgetBytes: number,
): Promise<OriginalPageAssetStore> {
  const storageBudget = createStorageBudget({ budgetBytes });
  await mkdir(directory, { recursive: true });
  const existingAssets = await loadExistingAssets(directory);
  for (const asset of existingAssets) storageBudget.markExisting(asset.key, asset.bytes);

  const pendingWrites = new Map<string, Promise<boolean>>();

  async function read(sha256: string): Promise<Uint8Array | undefined> {
    assertSha256(sha256);
    const key = `${sha256}.bin`;
    const path = join(directory, key);
    let bytes: Buffer;
    try {
      bytes = await readFile(path);
    } catch (error) {
      if (isMissingFile(error)) {
        storageBudget.markMissing(key);
        return undefined;
      }
      throw error;
    }

    if (hashBytes(bytes) !== sha256) throw new OriginalPageAssetCorruptError(key);
    storageBudget.markExisting(key, bytes.byteLength);
    return new Uint8Array(bytes);
  }

  async function putAsset(sha256: string, bytes: Uint8Array): Promise<boolean> {
    const key = `${sha256}.bin`;
    const existing = await read(sha256);
    if (existing) return false;

    const reservation = storageBudget.reserve(key, bytes.byteLength);
    const temporaryPath = join(directory, `.${sha256}.${process.pid}.${randomUUID()}.tmp`);
    let temporaryMayExist = true;

    try {
      await writeFile(temporaryPath, Buffer.from(bytes), { flag: 'wx' });
      await rename(temporaryPath, join(directory, key));
      temporaryMayExist = false;
      reservation.commit(bytes.byteLength);
      return true;
    } catch (error) {
      if (temporaryMayExist) {
        try {
          await rm(temporaryPath);
          reservation.release();
        } catch (cleanupError) {
          if (isMissingFile(cleanupError)) reservation.release();
          // Keep the reservation when cleanup cannot confirm the temporary write is gone.
        }
      } else {
        reservation.release();
      }
      throw error;
    }
  }

  async function put(sha256: string, bytes: Uint8Array): Promise<boolean> {
    assertSha256(sha256);
    if (hashBytes(bytes) !== sha256) {
      throw new Error('Original page bytes do not match the supplied SHA-256.');
    }

    const pending = pendingWrites.get(sha256);
    if (pending) return pending;

    const operation = putAsset(sha256, bytes);
    pendingWrites.set(sha256, operation);
    try {
      return await operation;
    } finally {
      if (pendingWrites.get(sha256) === operation) pendingWrites.delete(sha256);
    }
  }

  return { storageBudget, put, read };
}
