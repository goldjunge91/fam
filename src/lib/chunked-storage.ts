/** Zerlegt Werte, die das iOS-Limit von SecureStore ueberschreiten. */

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Abstand zum 2048-Byte-Limit fuer mehrbytige UTF-8-Zeichen. */
export const DEFAULT_CHUNK_SIZE = 1024;

const CHUNK_PREFIX = '__chunked__:';

export function createChunkedStorage(
  store: KeyValueStore,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): KeyValueStore {
  if (chunkSize <= 0) {
    throw new Error('chunkSize muss groesser als 0 sein');
  }

  const chunkKey = (key: string, index: number) => `${key}.${index}`;

  async function removeChunks(key: string, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await store.removeItem(chunkKey(key, i));
    }
  }

  return {
    async getItem(key) {
      const head = await store.getItem(key);
      if (head === null) return null;

      if (!head.startsWith(CHUNK_PREFIX)) {
        return head;
      }

      const count = Number.parseInt(head.slice(CHUNK_PREFIX.length), 10);
      if (!Number.isInteger(count) || count < 0) return null;

      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await store.getItem(chunkKey(key, i));
        // Unvollstaendige Sessions duerfen nicht wiederhergestellt werden.
        if (part === null) return null;
        parts.push(part);
      }

      return parts.join('');
    },

    async setItem(key, value) {
      // Teile eines frueheren, laengeren Werts entfernen.
      const previous = await store.getItem(key);
      if (previous?.startsWith(CHUNK_PREFIX)) {
        const previousCount = Number.parseInt(previous.slice(CHUNK_PREFIX.length), 10);
        if (Number.isInteger(previousCount)) {
          await removeChunks(key, previousCount);
        }
      }

      if (value.length <= chunkSize) {
        await store.setItem(key, value);
        return;
      }

      const parts: string[] = [];
      for (let i = 0; i < value.length; i += chunkSize) {
        parts.push(value.slice(i, i + chunkSize));
      }

      // Der Kopf darf erst nach allen Teilen auf den neuen Zustand zeigen.
      for (const [index, part] of parts.entries()) {
        await store.setItem(chunkKey(key, index), part);
      }
      await store.setItem(key, `${CHUNK_PREFIX}${parts.length}`);
    },

    async removeItem(key) {
      const head = await store.getItem(key);

      if (head?.startsWith(CHUNK_PREFIX)) {
        const count = Number.parseInt(head.slice(CHUNK_PREFIX.length), 10);
        if (Number.isInteger(count)) {
          await removeChunks(key, count);
        }
      }

      await store.removeItem(key);
    },
  };
}
