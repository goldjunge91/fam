import { createChunkedStorage, type KeyValueStore } from '@/lib/storage/chunked-storage';

const textEncoder = new TextEncoder();

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
      const byteLength = textEncoder.encode(value).byteLength;
      if (byteLength > maxValueLength) {
        throw new Error(`Wert zu gross fuer den Speicher: ${byteLength} > ${maxValueLength}`);
      }
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
  };

  return { store, data };
}

function createFaultInjectingStore(maxValueLength = 2048) {
  const memory = createMemoryStore(maxValueLength);
  let writeCount = 0;
  let failAtWrite: number | null = null;

  const store: KeyValueStore = {
    ...memory.store,
    async setItem(key, value) {
      if (failAtWrite !== null && writeCount === failAtWrite) {
        writeCount += 1;
        throw new Error('simulierter SecureStore-Abbruch');
      }
      writeCount += 1;
      await memory.store.setItem(key, value);
    },
  };

  return {
    store,
    data: memory.data,
    failAfterWrites(count: number) {
      writeCount = 0;
      failAtWrite = count;
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function createDeferredStore() {
  const memory = createMemoryStore();
  let getItemCalls = 0;
  let deferredWrite: {
    gate: ReturnType<typeof createDeferred<void>>;
    started: ReturnType<typeof createDeferred<void>>;
  } | null = null;

  const store: KeyValueStore = {
    ...memory.store,
    async getItem(key) {
      getItemCalls += 1;
      return memory.store.getItem(key);
    },
    async setItem(key, value) {
      const pending = deferredWrite;
      if (pending !== null) {
        deferredWrite = null;
        pending.started.resolve();
        await pending.gate.promise;
      }
      await memory.store.setItem(key, value);
    },
  };

  return {
    store,
    data: memory.data,
    getItemCallCount() {
      return getItemCalls;
    },
    deferNextWrite() {
      const pending = {
        gate: createDeferred<void>(),
        started: createDeferred<void>(),
      };
      deferredWrite = pending;
      return pending;
    },
  };
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
      expect(textEncoder.encode(wert).byteLength).toBeLessThanOrEqual(2048);
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
    const header = data.get('session');
    const slot = header?.split(':')[2];
    data.delete(`session.__chunked_v2.${slot}.1`);

    // Eine halbe Session ist schlimmer als keine — sie fuehrt zu unerklaerlichen
    // Auth-Fehlern statt zu einem sauberen Neu-Anmelden.
    expect(await storage.getItem('session')).toBeNull();
  });

  it('bewahrt den letzten gueltigen Wert bei einem abgebrochenen Write', async () => {
    const { store, failAfterWrites } = createFaultInjectingStore();
    const storage = createChunkedStorage(store);
    const previous = 'alter-session-wert'.repeat(400);

    await storage.setItem('session', previous);
    // Der erste neue Chunk darf noch geschrieben werden, danach bricht der
    // SecureStore ab. Der alte Header muss weiterhin lesbar bleiben.
    const next = 'neuer-session-wert'.repeat(400);
    failAfterWrites(1);

    await expect(storage.setItem('session', next)).rejects.toThrow('SecureStore-Abbruch');
    expect(await storage.getItem('session')).toBe(previous);
  });

  it('wartet bei getItem auf einen laufenden Write', async () => {
    const { store, deferNextWrite } = createDeferredStore();
    const storage = createChunkedStorage(store);
    const previous = 'alter-session-wert';
    const next = 'neuer-session-wert'.repeat(100);

    await storage.setItem('session', previous);
    const pendingWrite = deferNextWrite();
    const write = storage.setItem('session', next);
    await pendingWrite.started.promise;

    let readCompleted = false;
    const read = storage.getItem('session').then((value) => {
      readCompleted = true;
      return value;
    });

    expect(readCompleted).toBe(false);
    pendingWrite.gate.resolve();

    await expect(write).resolves.toBeUndefined();
    await expect(read).resolves.toBe(next);
  });

  it('liest nach einem fehlgeschlagenen laufenden Write den letzten Wert', async () => {
    const { store, deferNextWrite, getItemCallCount } = createDeferredStore();
    const storage = createChunkedStorage(store);
    const previous = 'alter-session-wert'.repeat(100);
    const next = 'neuer-session-wert'.repeat(100);

    await storage.setItem('session', previous);
    const pendingWrite = deferNextWrite();
    const write = storage.setItem('session', next);
    await pendingWrite.started.promise;
    const readsWhileWriteIsPending = getItemCallCount();

    let readCompleted = false;
    const read = storage.getItem('session').then((value) => {
      readCompleted = true;
      return value;
    });

    expect(readCompleted).toBe(false);
    expect(getItemCallCount()).toBe(readsWhileWriteIsPending);
    pendingWrite.gate.reject(new Error('simulierter SecureStore-Abbruch'));

    await expect(write).rejects.toThrow('SecureStore-Abbruch');
    await expect(read).resolves.toBe(previous);
  });

  it('verwirft ungueltige oder ueberdimensionierte v2-Header', async () => {
    const { store } = createMemoryStore();
    const storage = createChunkedStorage(store);

    await store.setItem('session', '__chunked:v2:a:999999:1');
    expect(await storage.getItem('session')).toBeNull();

    await store.setItem('session', '__chunked:v2:a:1:999999999');
    expect(await storage.getItem('session')).toBeNull();

    await store.setItem('session', '__chunked:v2:a:1x:1024');
    expect(await storage.getItem('session')).toBeNull();
  });

  it('liest das v2-Format weiter', async () => {
    const { store } = createMemoryStore();
    const storage = createChunkedStorage(store);

    await store.setItem('session', '__chunked:v2:a:2:10');
    await store.setItem('session.__chunked_v2.a.0', 'alter-');
    await store.setItem('session.__chunked_v2.a.1', 'wert');

    expect(await storage.getItem('session')).toBe('alter-wert');
  });

  it('serialisiert parallele Writes pro Schluessel', async () => {
    const { store } = createMemoryStore();
    const storage = createChunkedStorage(store);
    const first = 'erste-session'.repeat(500);
    const second = 'zweite-session'.repeat(500);

    await Promise.all([storage.setItem('session', first), storage.setItem('session', second)]);

    expect(await storage.getItem('session')).toBe(second);
  });

  it('gibt null zurueck fuer unbekannte Schluessel', async () => {
    const { store } = createMemoryStore();
    const storage = createChunkedStorage(store);

    expect(await storage.getItem('gibtsnicht')).toBeNull();
  });

  it('liest das bisherige v1-Format weiter', async () => {
    const { store } = createMemoryStore();
    const storage = createChunkedStorage(store);

    await store.setItem('session', '__chunked__:2');
    await store.setItem('session.0', 'alter-');
    await store.setItem('session.1', 'wert');

    expect(await storage.getItem('session')).toBe('alter-wert');
  });

  it('kommt mit Mehrbyte-Zeichen an der Chunk-Grenze klar', async () => {
    const { store } = createMemoryStore();
    const storage = createChunkedStorage(store, 10);
    const text = 'äöüß🥗'.repeat(50);

    await storage.setItem('session', text);

    expect(await storage.getItem('session')).toBe(text);
  });

  it('begrenzt Mehrbyte-Chunks in UTF-8 und trennt keine Surrogate', async () => {
    const { store, data } = createMemoryStore();
    const storage = createChunkedStorage(store, 10);
    const text = '🥗äöüß'.repeat(30);

    await storage.setItem('session', text);

    const header = data.get('session');
    expect(header).toMatch(/^__chunked:v2:[ab]:\d+:\d+$/);
    const slot = header?.split(':')[2];
    const chunks = [...data.entries()]
      .filter(([key]) => key.startsWith(`session.__chunked_v2.${slot}.`))
      .sort(([left], [right]) => left.localeCompare(right));

    expect(chunks.length).toBeGreaterThan(1);
    for (const [, chunk] of chunks) {
      expect(textEncoder.encode(chunk).byteLength).toBeLessThanOrEqual(10);
      const firstCodeUnit = chunk.charCodeAt(0);
      const lastCodeUnit = chunk.charCodeAt(chunk.length - 1);
      expect(firstCodeUnit >= 0xdc00 && firstCodeUnit <= 0xdfff).toBe(false);
      expect(lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff).toBe(false);
    }
    expect(await storage.getItem('session')).toBe(text);
  });

  it('teilt einen direkten Mehrbyte-Wert auf, wenn er das Byte-Limit ueberschreitet', async () => {
    const { store, data } = createMemoryStore();
    const storage = createChunkedStorage(store, 10);

    await storage.setItem('session', 'äöüß🥗');

    expect(data.get('session')).toMatch(/^__chunked:v2:[ab]:\d+:\d+$/);
    expect(await storage.getItem('session')).toBe('äöüß🥗');
  });

  it('wendet das maximale Wertlimit auf UTF-8-Bytes an', async () => {
    const { store } = createMemoryStore();
    const storage = createChunkedStorage(store);

    await expect(storage.setItem('session', '🥗'.repeat(65_537))).rejects.toThrow(
      'SecureStore zu gross',
    );
  });

  it('lehnt eine unsinnige Chunk-Groesse ab', () => {
    const { store } = createMemoryStore();
    expect(() => createChunkedStorage(store, 0)).toThrow();
  });
});
