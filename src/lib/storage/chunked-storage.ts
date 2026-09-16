export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export const DEFAULT_CHUNK_SIZE = 1024;

const LEGACY_CHUNK_PREFIX = '__chunked__:';
const CHUNKED_V2_PREFIX = '__chunked:v2:';
const MAX_CHUNK_COUNT = 256;
const MAX_RECONSTRUCTED_LENGTH = 256 * 1024;
const textEncoder = new TextEncoder();
type ChunkSlot = 'a' | 'b';

type StoredHead =
  | { kind: 'missing' }
  | { kind: 'direct'; value: string }
  | { kind: 'legacy'; count: number }
  | { kind: 'v2'; slot: ChunkSlot; count: number; length: number }
  | { kind: 'invalid' };

function parseBoundedInteger(value: string, maximum: number): number | null {
  if (!/^(0|[1-9]\d*)$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

function legacyChunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

function v2ChunkKey(key: string, slot: ChunkSlot, index: number): string {
  return `${key}.__chunked_v2.${slot}.${index}`;
}

function utf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

function splitIntoChunks(value: string, chunkSize: number): string[] {
  const parts: string[] = [];
  let start = 0;
  let byteLength = 0;

  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index);
    const characterLength = codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
    const character = value.slice(index, index + characterLength);
    const characterByteLength = utf8ByteLength(character);

    if (characterByteLength > chunkSize) {
      throw new Error('Ein Zeichen ist groesser als die SecureStore-Chunk-Groesse');
    }
    if (byteLength > 0 && byteLength + characterByteLength > chunkSize) {
      parts.push(value.slice(start, index));
      start = index;
      byteLength = 0;
    }

    byteLength += characterByteLength;
    index += characterLength;
  }

  if (start < value.length) parts.push(value.slice(start));
  return parts;
}

export function createChunkedStorage(
  store: KeyValueStore,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): KeyValueStore {
  if (chunkSize <= 0 || chunkSize > MAX_RECONSTRUCTED_LENGTH) {
    throw new Error('chunkSize muss zwischen 1 und 256 KiB liegen');
  }

  const maxChunkCount = Math.min(MAX_CHUNK_COUNT, Math.ceil(MAX_RECONSTRUCTED_LENGTH / chunkSize));
  const operations = new Map<string, Promise<void>>();

  function parseHead(value: string | null): StoredHead {
    if (value == null) return { kind: 'missing' };
    if (!value.startsWith(LEGACY_CHUNK_PREFIX) && !value.startsWith(CHUNKED_V2_PREFIX)) {
      return { kind: 'direct', value };
    }

    if (value.startsWith(LEGACY_CHUNK_PREFIX)) {
      const count = parseBoundedInteger(value.slice(LEGACY_CHUNK_PREFIX.length), maxChunkCount);
      return count === null ? { kind: 'invalid' } : { kind: 'legacy', count };
    }

    const [slot, countValue, lengthValue, ...extra] = value
      .slice(CHUNKED_V2_PREFIX.length)
      .split(':');
    const count = parseBoundedInteger(countValue ?? '', maxChunkCount);
    const length = parseBoundedInteger(lengthValue ?? '', MAX_RECONSTRUCTED_LENGTH);
    const minimumCount = length === null ? null : Math.ceil(length / chunkSize);

    if (
      (slot !== 'a' && slot !== 'b') ||
      extra.length > 0 ||
      count === null ||
      length === null ||
      (minimumCount !== null && count < minimumCount)
    ) {
      return { kind: 'invalid' };
    }

    return { kind: 'v2', slot, count, length };
  }

  async function readHead(key: string): Promise<StoredHead> {
    return parseHead(await store.getItem(key));
  }

  async function readChunks(
    count: number,
    expectedLength: number | null,
    chunkKey: (index: number) => string,
  ): Promise<string | null> {
    let value = '';

    for (let index = 0; index < count; index += 1) {
      const part = await store.getItem(chunkKey(index));
      if (part === null || utf8ByteLength(part) > chunkSize) return null;

      value += part;
      const reconstructedByteLength = utf8ByteLength(value);
      if (reconstructedByteLength > MAX_RECONSTRUCTED_LENGTH) return null;
      if (expectedLength !== null && reconstructedByteLength > expectedLength) return null;
    }

    return expectedLength === null || utf8ByteLength(value) === expectedLength ? value : null;
  }

  async function removeChunks(count: number, chunkKey: (index: number) => string): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      await store.removeItem(chunkKey(index));
    }
  }

  async function cleanupHead(key: string, head: StoredHead): Promise<void> {
    if (head.kind === 'legacy') {
      await removeChunks(head.count, (index) => legacyChunkKey(key, index));
    }
    if (head.kind === 'v2') {
      await removeChunks(head.count, (index) => v2ChunkKey(key, head.slot, index));
    }
  }

  function enqueue(key: string, operation: () => Promise<void>): Promise<void> {
    const previous = operations.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    operations.set(key, next);

    return next.finally(() => {
      if (operations.get(key) === next) operations.delete(key);
    });
  }

  return {
    async getItem(key) {
      if (operations.has(key)) {
        await operations.get(key)?.catch(() => undefined);
      }

      const head = await readHead(key);
      if (head.kind === 'missing' || head.kind === 'invalid') return null;
      if (head.kind === 'direct') return head.value;
      if (head.kind === 'legacy') {
        return readChunks(head.count, null, (index) => legacyChunkKey(key, index));
      }
      return readChunks(head.count, head.length, (index) => v2ChunkKey(key, head.slot, index));
    },

    setItem(key, value) {
      const valueByteLength = utf8ByteLength(value);
      if (valueByteLength > MAX_RECONSTRUCTED_LENGTH) {
        return Promise.reject(new Error('Wert ist fuer den SecureStore zu gross'));
      }

      return enqueue(key, async () => {
        const previous = await readHead(key);

        if (valueByteLength <= chunkSize) {
          // Der Header selbst ist der Commit. Alte Chunks werden erst danach
          // bereinigt, damit ein Abbruch den alten Wert nicht zerstoert.
          await store.setItem(key, value);
          await cleanupHead(key, previous);
          return;
        }

        const parts = splitIntoChunks(value, chunkSize);
        if (parts.length > maxChunkCount) {
          throw new Error('Wert benoetigt zu viele SecureStore-Chunks');
        }

        const slot: ChunkSlot = previous.kind === 'v2' && previous.slot === 'a' ? 'b' : 'a';
        for (const [index, part] of parts.entries()) {
          await store.setItem(v2ChunkKey(key, slot, index), part);
        }

        // Erst jetzt wird der neue Wert sichtbar. Der alte Header und seine
        // Chunks blieben bis zu diesem Punkt vollstaendig intakt.
        await store.setItem(key, `${CHUNKED_V2_PREFIX}${slot}:${parts.length}:${valueByteLength}`);
        await cleanupHead(key, previous);
      });
    },

    removeItem(key) {
      return enqueue(key, async () => {
        const previous = await readHead(key);
        await cleanupHead(key, previous);
        await store.removeItem(key);
      });
    },
  };
}
