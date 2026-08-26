import type { KeyValueStore } from '@/lib/chunked-storage';
import {
  type CipherDatabase,
  createDatabaseKeyManager,
  type DatabaseEncryptionCutoverDependencies,
  keyAndVerifyDatabase,
  migratePlaintextDatabase,
  openEncryptedDatabaseWithCutover,
  toSqlCipherKeyPragma,
} from '@/lib/db/database-encryption';
import type { DatabaseFileOps } from '@/lib/db/database-files';

function createStore(initial: string | null = null) {
  let value = initial;
  const storage: KeyValueStore = {
    getItem: jest.fn(async () => value),
    setItem: jest.fn(async (_key, next) => {
      value = next;
    }),
    removeItem: jest.fn(async () => {
      value = null;
    }),
  };
  return storage;
}

describe('SQLCipher-Schlüsselverwaltung', () => {
  it('verwendet einen vorhandenen gültigen Schlüssel unverändert', async () => {
    const existing = 'ab'.repeat(32);
    const storage = createStore(existing);
    const randomBytes = jest.fn();

    await expect(createDatabaseKeyManager({ storage, randomBytes })()).resolves.toBe(existing);
    expect(randomBytes).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('erzeugt genau 256 Bit und persistiert sie als Hex', async () => {
    const storage = createStore();
    const randomBytes = jest.fn(async () => Uint8Array.from({ length: 32 }, (_, i) => i));

    const key = await createDatabaseKeyManager({ storage, randomBytes })();

    expect(randomBytes).toHaveBeenCalledWith(32);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(storage.setItem).toHaveBeenCalledWith('fam.database.sqlcipher-key.v1', key);
  });

  it('teilt einen parallelen Erzeugungslauf und schreibt nur einmal', async () => {
    const storage = createStore();
    const randomBytes = jest.fn(async () => new Uint8Array(32).fill(7));
    const getKey = createDatabaseKeyManager({ storage, randomBytes });

    const [first, second] = await Promise.all([getKey(), getKey()]);

    expect(first).toBe(second);
    expect(randomBytes).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('ersetzt einen beschädigten Schlüssel nicht still durch einen neuen', async () => {
    const storage = createStore('kaputt');
    const randomBytes = jest.fn(async () => new Uint8Array(32));

    await expect(createDatabaseKeyManager({ storage, randomBytes })()).rejects.toThrow(/ungültig/);
    expect(randomBytes).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('baut das PRAGMA nur aus einem validierten Raw-Key', () => {
    const key = '01'.repeat(32);
    expect(toSqlCipherKeyPragma(key)).toBe(`PRAGMA key = "x'${key}'"`);
    expect(() => toSqlCipherKeyPragma("' ; drop table app_meta; --")).toThrow(/Ungültiger/);
  });
});

type Snapshot = {
  schemaVersion: number;
  ownerUserId: string | null;
  outboxCount: number;
};

function createCutoverHarness(options?: {
  corruptExport?: boolean;
  failActivation?: boolean;
  failRecoveryCleanup?: boolean;
  failRecoveryCleanupOnce?: boolean;
  encryptedOpenAlwaysFails?: boolean;
  mainStartsPlaintext?: boolean;
  plaintextOpenFails?: boolean;
  plaintextReadFails?: boolean;
}) {
  const main = 'fam-v2.db';
  const next = 'fam-v2.encrypted.next.db';
  const recovery = 'fam-v2.plaintext.recovery.db';
  const sourceSnapshot: Snapshot = {
    schemaVersion: 11,
    ownerUserId: 'user-a',
    outboxCount: 7,
  };
  const snapshots = new Map<string, Snapshot>([[main, sourceSnapshot]]);
  const files = new Set([main]);
  const moves: Array<[string, string]> = [];
  const deleted: string[] = [];
  const executed: string[] = [];
  const encryptedFiles = new Set<string>(options?.mainStartsPlaintext ? [] : [main]);
  let recoveryCleanupFailures = 0;

  const fileOps: DatabaseFileOps = {
    exists: (name) => files.has(name),
    async delete(name) {
      deleted.push(name);
      if (
        name === recovery &&
        files.has(recovery) &&
        (options?.failRecoveryCleanup ||
          (options?.failRecoveryCleanupOnce && recoveryCleanupFailures === 0))
      ) {
        recoveryCleanupFailures += 1;
        throw new Error('simulierter Cleanup-Fehler');
      }
      files.delete(name);
      snapshots.delete(name);
      encryptedFiles.delete(name);
    },
    async move(from, to) {
      moves.push([from, to]);
      if (options?.failActivation && from === next && to === main) {
        throw new Error('simulierter Abbruch beim Aktivieren');
      }
      if (!files.has(from)) throw new Error(`Datei fehlt: ${from}`);
      files.delete(from);
      files.add(to);
      if (encryptedFiles.delete(from)) encryptedFiles.add(to);
      else encryptedFiles.delete(to);
      const snapshot = snapshots.get(from);
      snapshots.delete(from);
      if (snapshot) snapshots.set(to, snapshot);
    },
    path: (name) => `/sqlite/${name}`,
  };

  class FakeDatabase implements CipherDatabase {
    private attachedFile: string | null = null;

    constructor(private readonly fileName: string) {}

    async execAsync(source: string) {
      executed.push(`${this.fileName}:${source}`);
      if (source.startsWith('ATTACH DATABASE')) {
        this.attachedFile = next;
        files.add(next);
        encryptedFiles.add(next);
        return;
      }
      if (source.startsWith('PRAGMA encrypted.user_version')) {
        const version = Number(source.split('=').at(-1)?.trim());
        const target = snapshots.get(next);
        if (target) snapshots.set(next, { ...target, schemaVersion: version });
      }
    }

    async getFirstAsync<T>(source: string, params?: readonly (string | number | null)[]) {
      if (options?.plaintextReadFails && this.fileName === main) {
        throw new Error('file is not a database');
      }
      if (source === 'PRAGMA cipher_status' || source === 'PRAGMA encrypted.cipher_status') {
        return { cipher_status: 1 } as T;
      }
      if (source.includes("sqlcipher_export('encrypted')")) {
        const sourceValue = snapshots.get(this.fileName);
        if (!sourceValue || !this.attachedFile) throw new Error('Exportquelle fehlt');
        snapshots.set(this.attachedFile, {
          ...sourceValue,
          schemaVersion: 0,
          outboxCount: options?.corruptExport
            ? sourceValue.outboxCount - 1
            : sourceValue.outboxCount,
        });
        return { exported: null } as T;
      }

      const targetName =
        source.includes('encrypted.') || source.includes('encrypted_') ? next : this.fileName;
      const snapshot = snapshots.get(targetName);
      if (!snapshot) throw new Error(`Snapshot fehlt: ${targetName}`);

      if (source.includes('quick_check')) return { quick_check: 'ok' } as T;
      if (source.includes('user_version')) return { user_version: snapshot.schemaVersion } as T;
      if (source.includes('sqlite_master') && params?.[0] === 'app_meta') {
        return { present: 1 } as T;
      }
      if (source.includes('sqlite_master') && params?.[0] === 'outbox') {
        return { present: 1 } as T;
      }
      if (source.includes('app_meta')) return { value: snapshot.ownerUserId } as T;
      if (source.includes('outbox')) return { count: snapshot.outboxCount } as T;
      if (source.includes('sqlite_master')) return { count: 2 } as T;
      return null;
    }

    async closeAsync() {}
  }

  const dependencies: DatabaseEncryptionCutoverDependencies<FakeDatabase> = {
    files: fileOps,
    mainFileName: main,
    encryptedNextFileName: next,
    plaintextRecoveryFileName: recovery,
    async openPlaintext(fileName) {
      if (options?.plaintextOpenFails) throw new Error('kein Klartext');
      return new FakeDatabase(fileName);
    },
    async openEncrypted(fileName) {
      if (options?.encryptedOpenAlwaysFails || !encryptedFiles.has(fileName)) {
        throw new Error('falscher Schlüssel');
      }
      return new FakeDatabase(fileName);
    },
  };

  return {
    dependencies,
    files,
    moves,
    deleted,
    executed,
    snapshots,
    main,
    next,
    recovery,
    sourceSnapshot,
  };
}

describe('SQLCipher-Cutover', () => {
  const key = '42'.repeat(32);

  it('setzt den Schlüssel vor jeder anderen Operation und prüft cipher_status fail-closed', async () => {
    const calls: string[] = [];
    const db: CipherDatabase = {
      async execAsync(source) {
        calls.push(source);
      },
      async getFirstAsync<T>(source: string) {
        calls.push(source);
        return null as T | null;
      },
      async closeAsync() {},
    };

    await expect(keyAndVerifyDatabase(db, key)).rejects.toThrow(/nicht aktiv/);
    expect(calls).toEqual([
      toSqlCipherKeyPragma(key),
      'PRAGMA cipher_status',
      'PRAGMA cipher_version',
    ]);
  });

  it('erkennt den von Expo 57 gebündelten SQLCipher-4.7-Codec ohne cipher_status', async () => {
    const calls: string[] = [];
    const db: CipherDatabase = {
      async execAsync(source) {
        calls.push(source);
      },
      async getFirstAsync<T>(source: string) {
        calls.push(source);
        if (source === 'PRAGMA cipher_version') return { cipher_version: '4.7.0 community' } as T;
        if (source.includes('sqlite_master')) return { count: 1 } as T;
        return null;
      },
      async closeAsync() {},
    };

    await expect(keyAndVerifyDatabase(db, key)).resolves.toBeUndefined();
    expect(calls.at(-1)).toContain('sqlite_master');
  });

  it('behandelt einen falschen Schlüssel als unlesbar, obwohl cipher_status aktiv ist', async () => {
    const db: CipherDatabase = {
      async execAsync() {},
      async getFirstAsync<T>(source: string) {
        if (source === 'PRAGMA cipher_status') return { cipher_status: 1 } as T;
        throw new Error('file is not a database');
      },
      async closeAsync() {},
    };

    await expect(keyAndVerifyDatabase(db, key)).rejects.toThrow('file is not a database');
  });

  it('erhält Schemaversion, Ownership und Outbox und entfernt Recovery erst nach Reopen', async () => {
    const harness = createCutoverHarness();

    const active = await migratePlaintextDatabase(harness.dependencies, key);
    await active.closeAsync();

    expect(harness.snapshots.get(harness.main)).toEqual(harness.sourceSnapshot);
    expect(harness.files.has(harness.recovery)).toBe(false);
    expect(harness.files.has(harness.next)).toBe(false);
    expect(harness.moves).toEqual([
      [harness.main, harness.recovery],
      [harness.next, harness.main],
    ]);
  });

  it('lässt die Klartextquelle bei abweichender Outbox-Parität unangetastet', async () => {
    const harness = createCutoverHarness({ corruptExport: true });

    await expect(migratePlaintextDatabase(harness.dependencies, key)).rejects.toThrow(/Outbox/);

    expect(harness.files.has(harness.main)).toBe(true);
    expect(harness.snapshots.get(harness.main)).toEqual(harness.sourceSnapshot);
    expect(harness.moves).toEqual([]);
  });

  it('stellt die Klartextquelle wieder her, wenn der Prozess beim Aktivieren abbricht', async () => {
    const harness = createCutoverHarness({ failActivation: true });

    await expect(migratePlaintextDatabase(harness.dependencies, key)).rejects.toThrow(/Abbruch/);

    expect(harness.files.has(harness.main)).toBe(true);
    expect(harness.files.has(harness.recovery)).toBe(false);
    expect(harness.snapshots.get(harness.main)).toEqual(harness.sourceSnapshot);
  });

  it('rollt nach validiertem Commit bei einem Recovery-Cleanup-Fehler nicht zurück', async () => {
    const harness = createCutoverHarness({ failRecoveryCleanup: true });

    const active = await migratePlaintextDatabase(harness.dependencies, key);
    await active.closeAsync();

    expect(harness.files.has(harness.main)).toBe(true);
    expect(harness.files.has(harness.recovery)).toBe(true);
    expect(harness.snapshots.get(harness.main)).toEqual(harness.sourceSnapshot);
    expect(harness.moves).toEqual([
      [harness.main, harness.recovery],
      [harness.next, harness.main],
    ]);
  });

  it('behält nach Restart eine weiterentwickelte encrypted main trotz veralteter Recovery', async () => {
    const harness = createCutoverHarness({ failRecoveryCleanup: true });
    harness.files.add(harness.recovery);
    harness.snapshots.set(harness.recovery, { ...harness.sourceSnapshot });
    harness.snapshots.set(harness.main, { ...harness.sourceSnapshot, outboxCount: 8 });

    const active = await openEncryptedDatabaseWithCutover(harness.dependencies, key);
    await active.closeAsync();

    expect(harness.files.has(harness.main)).toBe(true);
    expect(harness.files.has(harness.recovery)).toBe(true);
    expect(harness.snapshots.get(harness.main)?.outboxCount).toBe(8);
    expect(harness.moves).toEqual([]);
  });

  it('erhält bei Restart mit unlesbarer main sowohl main als auch Recovery fail-closed', async () => {
    const harness = createCutoverHarness({
      encryptedOpenAlwaysFails: true,
      plaintextReadFails: true,
    });
    harness.files.add(harness.recovery);
    harness.snapshots.set(harness.recovery, { ...harness.sourceSnapshot });

    await expect(openEncryptedDatabaseWithCutover(harness.dependencies, key)).rejects.toThrow(
      /mehrdeutig/,
    );

    expect(harness.files.has(harness.main)).toBe(true);
    expect(harness.files.has(harness.recovery)).toBe(true);
    expect(harness.moves).toEqual([]);
    expect(
      harness.deleted.filter(
        (name) => name.startsWith(harness.main) || name.startsWith(harness.recovery),
      ),
    ).toEqual([]);
  });

  it('wiederholt nach einem Pre-Swap-Cleanup-Fehler den Cutover von der intakten Klartext-main', async () => {
    const harness = createCutoverHarness({
      failRecoveryCleanupOnce: true,
      mainStartsPlaintext: true,
    });
    harness.files.add(harness.recovery);
    harness.snapshots.set(harness.recovery, { ...harness.sourceSnapshot, outboxCount: 1 });

    await expect(migratePlaintextDatabase(harness.dependencies, key)).rejects.toThrow(
      /Cleanup-Fehler/,
    );
    expect(harness.snapshots.get(harness.main)).toEqual(harness.sourceSnapshot);

    const active = await openEncryptedDatabaseWithCutover(harness.dependencies, key);
    await active.closeAsync();

    expect(harness.snapshots.get(harness.main)).toEqual(harness.sourceSnapshot);
    expect(harness.files.has(harness.recovery)).toBe(false);
    expect(harness.files.has(harness.next)).toBe(false);
  });

  it('löscht bei falschem Schlüssel keine bestehende verschlüsselte Datei', async () => {
    const harness = createCutoverHarness({
      encryptedOpenAlwaysFails: true,
      plaintextReadFails: true,
    });

    await expect(openEncryptedDatabaseWithCutover(harness.dependencies, key)).rejects.toThrow(
      /file is not a database/,
    );

    expect(harness.files.has(harness.main)).toBe(true);
    expect(harness.snapshots.get(harness.main)).toEqual(harness.sourceSnapshot);
    expect(harness.moves).toEqual([]);
    expect(harness.executed).toEqual([]);
    expect(harness.deleted.filter((name) => name.startsWith(harness.main))).toEqual([]);
  });
});
