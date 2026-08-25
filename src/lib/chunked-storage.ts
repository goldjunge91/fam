/**
 * Storage-Adapter, der grosse Werte in Teile zerlegt.
 *
 * Hintergrund: `expo-secure-store` erlaubt auf iOS nur rund 2048 Byte pro
 * Eintrag. Eine Supabase-Session besteht aus Access- und Refresh-JWT plus
 * User-Metadaten und liegt regelmaessig darueber. Der Schreibvorgang schlaegt
 * dann fehl — je nach Plattform still — und der Nutzer ist nach jedem
 * App-Neustart abgemeldet, ohne dass irgendwo ein Fehler auftaucht.
 *
 * Ablauf: Unter dem eigentlichen Schluessel steht nur noch die Anzahl der
 * Teile, die Teile selbst liegen unter `key.0`, `key.1`, … Beim Lesen werden
 * sie wieder zusammengesetzt, beim Loeschen alle entfernt.
 *
 * Die Logik ist hier bewusst von der Plattform getrennt: sie bekommt einen
 * beliebigen Key-Value-Speicher uebergeben und laesst sich dadurch mit einer
 * echten In-Memory-Map testen, statt `expo-secure-store` zu ersetzen.
 */

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/**
 * Konservativ unter dem iOS-Limit von 2048 Byte. Der Abstand faengt ab, dass
 * ein Zeichen in UTF-8 mehrere Bytes belegt — `length` zaehlt UTF-16-Einheiten,
 * nicht Bytes, und Umlaute oder Emojis sind entsprechend groesser.
 */
export const DEFAULT_CHUNK_SIZE = 1024;

/** Marker, der einen gechunkten Eintrag von einem direkt gespeicherten Wert unterscheidet. */
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
      if (head == null || typeof head !== 'string') return null;

      if (!head.startsWith(CHUNK_PREFIX)) {
        // Kleiner Wert, direkt gespeichert.
        return head;
      }

      const count = Number.parseInt(head.slice(CHUNK_PREFIX.length), 10);
      if (!Number.isInteger(count) || count < 0) return null;

      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await store.getItem(chunkKey(key, i));
        // Fehlt ein Teil, ist der Wert unbrauchbar. Lieber null zurueckgeben und
        // den Nutzer neu anmelden lassen, als eine halbe Session auszuliefern.
        if (part === null) return null;
        parts.push(part);
      }

      return parts.join('');
    },

    async setItem(key, value) {
      // Reste eines frueheren, laengeren Werts zuerst wegraeumen — sonst bleiben
      // verwaiste Teile liegen und ein spaeterer Lesevorgang setzt Muell zusammen.
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

      // Teile vor dem Kopf schreiben: bricht es dazwischen ab, zeigt der Kopf
      // noch auf den alten Zustand statt auf halb geschriebene Teile.
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
