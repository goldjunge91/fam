import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const INDEX_VERSION = 1;

export type SeenHashUse = { brochureId: string; pageNumber: number };
export type SeenHashEntry = { sha256: string; assetPath: string; uses: SeenHashUse[] };
export type SeenHashSnapshot = {
  version: typeof INDEX_VERSION;
  revision: number;
  entries: Record<string, SeenHashEntry>;
};

export class SeenHashIndexCorruptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeenHashIndexCorruptError';
  }
}

export class SeenHashAssetCorruptError extends Error {
  constructor(readonly assetPath: string) {
    super(`Indexed asset is missing or does not match its SHA-256: ${assetPath}`);
    this.name = 'SeenHashAssetCorruptError';
  }
}

export type OpenSeenHashIndexOptions = { indexPath: string; assetsDir: string };
export type SeenHashIndex = {
  record(input: { sha256: string; assetPath: string; use: SeenHashUse }): Promise<boolean>;
  snapshot(): Promise<SeenHashSnapshot>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertHash(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new SeenHashIndexCorruptError(`${label} must be a lowercase SHA-256 hex digest.`);
  }
}

function parseIndex(value: unknown): SeenHashSnapshot {
  if (!isRecord(value) || value.version !== INDEX_VERSION ||
      !Number.isSafeInteger(value.revision) || (value.revision as number) < 0 ||
      !isRecord(value.entries)) {
    throw new SeenHashIndexCorruptError('Seen-hash index has an invalid version, revision, or entries map.');
  }

  const entries: Record<string, SeenHashEntry> = {};
  for (const [key, rawEntry] of Object.entries(value.entries).sort(([left], [right]) => left.localeCompare(right))) {
    assertHash(key, 'Index key');
    if (!isRecord(rawEntry) || rawEntry.sha256 !== key || typeof rawEntry.assetPath !== 'string' ||
        !Array.isArray(rawEntry.uses)) {
      throw new SeenHashIndexCorruptError(`Seen-hash entry ${key} is malformed.`);
    }
    const uses: SeenHashUse[] = [];
    for (const rawUse of rawEntry.uses) {
      if (!isRecord(rawUse) || typeof rawUse.brochureId !== 'string' || rawUse.brochureId.length === 0 ||
          !Number.isSafeInteger(rawUse.pageNumber) || (rawUse.pageNumber as number) < 1) {
        throw new SeenHashIndexCorruptError(`Seen-hash entry ${key} has a malformed use.`);
      }
      uses.push({ brochureId: rawUse.brochureId, pageNumber: rawUse.pageNumber as number });
    }
    entries[key] = { sha256: key, assetPath: rawEntry.assetPath, uses: sortUses(uses) };
  }
  return { version: INDEX_VERSION, revision: value.revision as number, entries };
}

function sortUses(uses: SeenHashUse[]): SeenHashUse[] {
  const unique = new Map(uses.map((use) => [`${use.brochureId}\0${use.pageNumber}`, use]));
  return [...unique.values()].sort((left, right) =>
    left.brochureId.localeCompare(right.brochureId) || left.pageNumber - right.pageNumber,
  );
}

function assetFilePath(assetsDir: string, assetPath: string): string {
  if (!assetPath || isAbsolute(assetPath)) throw new SeenHashIndexCorruptError('Asset path must be relative to the asset directory.');
  const root = resolve(assetsDir);
  const path = resolve(root, assetPath);
  const fromRoot = relative(root, path);
  if (fromRoot === '..' || fromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(fromRoot)) {
    throw new SeenHashIndexCorruptError(`Asset path escapes the asset directory: ${assetPath}`);
  }
  return path;
}

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function readValidIndex(path: string, assetsDir: string): Promise<SeenHashSnapshot> {
  const content = await readFile(path, 'utf8');
  let parsed: SeenHashSnapshot;
  try {
    parsed = parseIndex(JSON.parse(content) as unknown);
  } catch (error) {
    if (error instanceof SeenHashIndexCorruptError) throw error;
    throw new SeenHashIndexCorruptError(`Cannot read seen-hash index ${path}: ${String(error)}`);
  }

  for (const entry of Object.values(parsed.entries)) {
    const filePath = assetFilePath(assetsDir, entry.assetPath);
    let bytes: Buffer;
    try {
      bytes = await readFile(filePath);
    } catch {
      throw new SeenHashAssetCorruptError(entry.assetPath);
    }
    if (hashBytes(bytes) !== entry.sha256) throw new SeenHashAssetCorruptError(entry.assetPath);
  }
  return parsed;
}

/** Opens the durable index and recovers a complete atomic write left as `<indexPath>.tmp`. */
export async function openSeenHashIndex({ indexPath, assetsDir }: OpenSeenHashIndexOptions): Promise<SeenHashIndex> {
  await Promise.all([mkdir(dirname(indexPath), { recursive: true }), mkdir(assetsDir, { recursive: true })]);
  const temporaryPath = `${indexPath}.tmp`;
  let state: SeenHashSnapshot;
  try {
    state = await readValidIndex(indexPath, assetsDir);
    await rm(temporaryPath, { force: true });
  } catch (error) {
    if (!isMissingFile(error)) throw error;
    try {
      state = await readValidIndex(temporaryPath, assetsDir);
      await rename(temporaryPath, indexPath);
    } catch (temporaryError) {
      if (temporaryError instanceof SeenHashAssetCorruptError) throw temporaryError;
      if (!isMissingFile(temporaryError)) throw temporaryError;
      state = { version: INDEX_VERSION, revision: 0, entries: {} };
    }
  }

  let serialized = Promise.resolve();
  async function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const current = serialized.then(operation);
    serialized = current.then(() => undefined, () => undefined);
    return current;
  }

  async function persist(next: SeenHashSnapshot): Promise<void> {
    await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, indexPath);
  }

  return {
    record: ({ sha256, assetPath, use }) => serialize(async () => {
      assertHash(sha256, 'Asset SHA-256');
      if (!use.brochureId || !Number.isSafeInteger(use.pageNumber) || use.pageNumber < 1) {
        throw new Error('A seen-hash use needs a brochure ID and positive page number.');
      }
      const path = assetFilePath(assetsDir, assetPath);
      let bytes: Buffer;
      try {
        bytes = await readFile(path);
      } catch {
        throw new SeenHashAssetCorruptError(assetPath);
      }
      if (hashBytes(bytes) !== sha256) throw new SeenHashAssetCorruptError(assetPath);

      const current = state.entries[sha256];
      if (current && current.assetPath !== assetPath) {
        throw new SeenHashIndexCorruptError(`Byte hash ${sha256} already points to ${current.assetPath}.`);
      }
      const nextUses = sortUses([...(current?.uses ?? []), use]);
      const changed = !current || nextUses.length !== current.uses.length;
      if (!changed) return false;
      const next: SeenHashSnapshot = {
        version: INDEX_VERSION,
        revision: state.revision + 1,
        entries: Object.fromEntries(Object.entries({
          ...state.entries,
          [sha256]: { sha256, assetPath, uses: nextUses },
        }).sort(([left], [right]) => left.localeCompare(right))),
      };
      await persist(next);
      state = next;
      return true;
    }),
    snapshot: () => serialize(async () => ({
      version: state.version,
      revision: state.revision,
      entries: Object.fromEntries(Object.entries(state.entries).map(([hash, entry]) => [
        hash,
        { ...entry, uses: entry.uses.map((use) => ({ ...use })) },
      ])),
    })),
  };
}
