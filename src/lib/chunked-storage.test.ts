import { createChunkedStorage, type KeyValueStore } from '@/lib/chunked-storage';

/**
 * Echter In-Memory-Speicher, kein Testdouble: Er verhaelt sich wie der
 * plattformseitige Key-Value-Store, nur ohne Keychain. Zusaetzlich erzwingt er
 * das iOS-Limit, damit ein zu grosser Einzelwert im Test genauso auffliegt wie
 * auf dem Geraet.
 */
function createMemoryStore(maxValueLength = 2048) {
  const data = new Map<string, string>();

  const store: KeyValueStore = {
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      if (value.length > maxValueLength) {
        throw new Error(`Wert zu gross fuer den Speicher: ${value.length} > ${maxValueLength}`);
      }
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
  };

  return { store, data };
}

describe('createChunkedStorage', () => {
  it('speichert kleine Werte unveraendert und ohne Zusatzschluessel', async () => {
    const { store, data } = createMemoryStore();
    const storage = createChunkedStorage(store);

    await storage.setItem('session', 'kurz');

    expect(await storage.getItem('session')).toBe('kurz');
    expect([...data.keys()]).toEqual(['session']);
  });

  it('schreibt und liest einen 8-KB-Wert verlustfrei', async () => {
    const { store } = createMemoryStore();
    const storage = createChunkedStorage(store);
    // Nicht nur 'a' wiederholen — ein variabler Inhalt deckt Fehler beim
    // Zusammensetzen auf, die bei gleichen Zeichen unsichtbar blieben.
    const gross = Array.from({ length: 8192 }, (_, i) => String.fromCharCode(33 + (i % 90))).join(
      '',
    );

    await storage.setItem('session', gross);

    expect(await storage.getItem('session')).toBe(gross);
  });

  it('haelt jeden Einzelwert unter dem iOS-Limit', async () => {
    const { store, data } = createMemoryStore(2048);
    const storage = createChunkedStorage(store);

    // Wuerde der Adapter nicht chunken, wuerfe der Speicher hier.
    await expect(storage.setItem('session', 'x'.repeat(20_000))).resolves.toBeUndefined();

    for (const wert of data.values()) {
      expect(wert.length).toBeLessThanOrEqual(2048);
    }
  });

  it('laesst nach removeItem keine verwaisten Teile zurueck', async () => {
    const { store, data } = createMemoryStore();
    const storage = createChunkedStorage(store);

    await storage.setItem('session', 'y'.repeat(5000));
    expect(data.size).toBeGreaterThan(1);

    await storage.removeItem('session');

    expect(data.size).toBe(0);
    expect(await storage.getItem('session')).toBeNull();
  });

  it('raeumt beim Ueberschreiben mit einem kuerzeren Wert auf', async () => {
    const { store, data } = createMemoryStore();
    const storage = createChunkedStorage(store);

    await storage.setItem('session', 'z'.repeat(6000));
    await storage.setItem('session', 'klein');

    expect(await storage.getItem('session')).toBe('klein');
    // Genau ein Schluessel: die Teile des laengeren Werts sind weg. Blieben sie
    // liegen, wuerde ein spaeterer langer Wert sie teilweise ueberschreiben und
    // beim Lesen Muell ergeben.
    expect([...data.keys()]).toEqual(['session']);
  });

  it('gibt null zurueck, wenn ein Teil fehlt', async () => {
    const { store, data } = createMemoryStore();
    const storage = createChunkedStorage(store);

    await storage.setItem('session', 'w'.repeat(5000));
    data.delete('session.1');

    // Eine halbe Session ist schlimmer als keine — sie fuehrt zu unerklaerlichen
    // Auth-Fehlern statt zu einem sauberen Neu-Anmelden.
    expect(await storage.getItem('session')).toBeNull();
  });

  it('gibt null zurueck fuer unbekannte Schluessel', async () => {
    const { store } = createMemoryStore();
    const storage = createChunkedStorage(store);

    expect(await storage.getItem('gibtsnicht')).toBeNull();
  });

  it('kommt mit Mehrbyte-Zeichen an der Chunk-Grenze klar', async () => {
    const { store } = createMemoryStore();
    const storage = createChunkedStorage(store, 10);
    const text = 'äöüß🥗'.repeat(50);

    await storage.setItem('session', text);

    expect(await storage.getItem('session')).toBe(text);
  });

  it('lehnt eine unsinnige Chunk-Groesse ab', () => {
    const { store } = createMemoryStore();
    expect(() => createChunkedStorage(store, 0)).toThrow();
  });
});
