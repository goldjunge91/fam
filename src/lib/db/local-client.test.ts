import {
  closeDatabaseForLifecycle,
  deleteLocalDatabase,
  getDatabase,
  getDrizzleDatabase,
  setActiveUserId,
} from '@/lib/db/local-client';
import {
  deleteDatabaseEncryptionKey,
  openEncryptedDatabaseWithCutover,
} from '@/lib/db/local-database-encryption';
import { debugLog } from '@/lib/observability/debug-log';
import localMigrations from '../../../drizzle/local/migrations';

const mockExistingFiles = new Set(['fam-v2.db', 'fam-v2.db-wal']);
let failMainFileDeletion = true;
const mockDeleteFile = jest.fn(async (fileName: string) => {
  if (fileName === 'fam-v2.db' && failMainFileDeletion) {
    throw new Error('native delete failed');
  }
  mockExistingFiles.delete(fileName);
});
const mockRawDatabase = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 0 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  prepareAsync: jest.fn(),
  closeAsync: jest.fn().mockResolvedValue(undefined),
};

const mockExpoDrizzleDatabase = {};

jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/mock/sqlite',
  openDatabaseAsync: jest.fn(() => Promise.resolve(mockRawDatabase)),
}));

jest.mock('expo-file-system', () => ({
  Paths: {
    appleSharedContainers: {
      'group.com.goldjunge91.fam1': { uri: '/mock/app-group' },
    },
  },
}));

jest.mock('@/lib/db/local-database-encryption', () => ({
  deleteDatabaseEncryptionKey: jest.fn().mockResolvedValue(undefined),
  getOrCreateDatabaseEncryptionKey: jest.fn().mockResolvedValue('key'),
  keyAndVerifyDatabase: jest.fn().mockResolvedValue(undefined),
  openEncryptedDatabaseWithCutover: jest.fn(() => Promise.resolve(mockRawDatabase)),
}));

jest.mock('@/lib/db/database-files', () => ({
  DATABASE_FILE_NAMES: {
    main: 'fam-v2.db',
    encryptedNext: 'fam-v2.encrypted.next.db',
    plaintextRecovery: 'fam-v2.plaintext.recovery.db',
    offDump: 'off-dump-v2.db',
  },
  createExpoDatabaseFileOps: jest.fn(() => ({
    exists: (fileName: string) => mockExistingFiles.has(fileName),
    delete: (fileName: string) => mockDeleteFile(fileName),
    move: jest.fn(),
    path: jest.fn(),
  })),
}));

jest.mock('drizzle-orm/expo-sqlite', () => ({
  drizzle: jest.fn(() => mockExpoDrizzleDatabase),
}));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  migrate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/db/drizzle-driver', () => ({ createDrizzleDatabase: jest.fn() }));
jest.mock('@/lib/db/ownership', () => ({
  ensureDatabaseBelongsTo: jest.fn(async (db) => db),
}));
jest.mock('@/lib/off-dump/off-dump-state', () => ({ resetOffDumpAttachment: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({
  measureOperation: (_name: string, operation: () => Promise<unknown>) => operation(),
}));
jest.mock('@/lib/observability/debug-log', () => ({
  debugLog: jest.fn(),
  debugWarn: jest.fn(),
}));

describe('database client lifecycle', () => {
  it('öffnet dieselbe App-Group-Datei, die Siri beschreibt', async () => {
    setActiveUserId('user-a');
    mockRawDatabase.getFirstAsync.mockResolvedValueOnce({ journal_mode: 'wal' });
    jest
      .mocked(openEncryptedDatabaseWithCutover)
      .mockImplementationOnce((dependencies, key) =>
        dependencies.openEncrypted(dependencies.mainFileName, key),
      );

    await getDatabase();

    const SQLite = jest.requireMock('expo-sqlite') as typeof import('expo-sqlite');
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith(
      'fam-v2.db',
      { useNewConnection: true },
      '/mock/app-group',
    );

    const { createExpoDatabaseFileOps } = jest.requireMock('@/lib/db/database-files') as {
      createExpoDatabaseFileOps: jest.Mock;
    };
    expect(createExpoDatabaseFileOps).toHaveBeenCalledWith('/mock/app-group');
  });

  it('reicht SQL-Parameter weiter und schließt Raw-Statements auch nach Fehlern', async () => {
    setActiveUserId('user-a');
    const db = await getDatabase();
    const rows = [{ id: 'item-a' }];
    const rawResult = { getAllAsync: jest.fn().mockResolvedValue(rows) };
    const statement = {
      executeForRawResultAsync: jest.fn().mockResolvedValue(rawResult),
      finalizeAsync: jest.fn().mockResolvedValue(undefined),
    };
    mockRawDatabase.runAsync.mockResolvedValueOnce({ lastInsertRowId: 4, changes: 1 });
    mockRawDatabase.getAllAsync.mockResolvedValueOnce(rows);
    mockRawDatabase.getFirstAsync.mockResolvedValueOnce(rows[0]);
    mockRawDatabase.prepareAsync.mockResolvedValueOnce(statement);

    await expect(db.runAsync('UPDATE items SET checked = ?', [1])).resolves.toEqual({
      lastInsertRowId: 4,
      changes: 1,
    });
    await expect(db.getAllAsync('SELECT id FROM items', ['list-a'])).resolves.toEqual(rows);
    await expect(db.getFirstAsync('SELECT id FROM items', ['item-a'])).resolves.toEqual(rows[0]);
    await expect(db.getAllRawAsync?.('SELECT * FROM items', ['list-a'])).resolves.toEqual(rows);

    expect(mockRawDatabase.runAsync).toHaveBeenCalledWith('UPDATE items SET checked = ?', [1]);
    expect(mockRawDatabase.getAllAsync).toHaveBeenCalledWith('SELECT id FROM items', ['list-a']);
    expect(mockRawDatabase.getFirstAsync).toHaveBeenCalledWith('SELECT id FROM items', ['item-a']);
    expect(statement.executeForRawResultAsync).toHaveBeenCalledWith(['list-a']);
    expect(rawResult.getAllAsync).toHaveBeenCalledTimes(1);
    expect(statement.finalizeAsync).toHaveBeenCalledTimes(1);

    const failedStatement = {
      executeForRawResultAsync: jest.fn().mockRejectedValue(new Error('raw read failed')),
      finalizeAsync: jest.fn().mockResolvedValue(undefined),
    };
    mockRawDatabase.prepareAsync.mockResolvedValueOnce(failedStatement);

    await expect(db.getAllRawAsync?.('SELECT * FROM broken')).rejects.toThrow('raw read failed');
    expect(failedStatement.finalizeAsync).toHaveBeenCalledTimes(1);
  });

  it('schließt den Lifecycle-Handle, warnt bei Close-Fehlern und cached Drizzle', async () => {
    setActiveUserId('user-a');
    const { createDrizzleDatabase } = jest.requireMock('@/lib/db/drizzle-driver') as {
      createDrizzleDatabase: jest.Mock;
    };
    createDrizzleDatabase.mockClear();
    createDrizzleDatabase.mockReturnValue(mockExpoDrizzleDatabase);
    const firstDrizzle = await getDrizzleDatabase();
    await expect(getDrizzleDatabase()).resolves.toBe(firstDrizzle);
    expect(createDrizzleDatabase).toHaveBeenCalledTimes(1);

    mockRawDatabase.closeAsync.mockRejectedValueOnce(new Error('temporary close failure'));
    await closeDatabaseForLifecycle();

    const { debugWarn } = jest.requireMock('@/lib/observability/debug-log') as {
      debugWarn: jest.Mock;
    };
    expect(debugWarn).toHaveBeenCalledWith(
      '[db] Verbindung beim App-Wechsel konnte nicht geschlossen werden:',
      expect.any(Error),
    );

    let finishClose: (() => void) | undefined;
    mockRawDatabase.closeAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        }),
    );
    const closing = closeDatabaseForLifecycle();
    const joinedClose = closeDatabaseForLifecycle();
    expect(joinedClose).toBe(closing);
    const reopening = getDatabase();
    await Promise.resolve();
    finishClose?.();
    await closing;
    await expect(reopening).resolves.toBeDefined();
    await getDrizzleDatabase();
    expect(createDrizzleDatabase).toHaveBeenCalledTimes(2);
    expect(mockRawDatabase.closeAsync).toHaveBeenCalledTimes(2);
  });

  it('blockiert ohne Session und drained eine laufende Query vor einem fail-closed Wipe', async () => {
    mockRawDatabase.closeAsync.mockClear();
    setActiveUserId(null);
    await expect(getDatabase()).rejects.toThrow(/Ohne angemeldeten Nutzer/);

    setActiveUserId('user-a');
    mockRawDatabase.getFirstAsync.mockResolvedValueOnce({ journal_mode: 'wal' });
    const db = await getDatabase();
    const { migrate } = jest.requireMock('drizzle-orm/expo-sqlite/migrator') as {
      migrate: jest.Mock;
    };
    expect(migrate).toHaveBeenCalledWith(mockExpoDrizzleDatabase, localMigrations);
    jest.mocked(debugLog).mockClear();
    await getDatabase();
    expect(
      jest
        .mocked(debugLog)
        .mock.calls.filter(([message]) => message === '[DBTRACE:REQUEST-CACHED]'),
    ).toHaveLength(0);
    expect(mockRawDatabase.execAsync.mock.calls.slice(0, 2)).toEqual([
      ['PRAGMA busy_timeout = 5000'],
      ['PRAGMA foreign_keys = ON'],
    ]);
    mockRawDatabase.closeAsync
      .mockRejectedValueOnce(new Error('native close failed'))
      .mockResolvedValueOnce(undefined);
    let finishQuery: (() => void) | undefined;
    mockRawDatabase.execAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishQuery = resolve;
        }),
    );
    const query = db.execAsync('select slow');
    await Promise.resolve();

    setActiveUserId(null);
    let wipeSettled = false;
    const wipe = deleteLocalDatabase().finally(() => {
      wipeSettled = true;
    });
    await Promise.resolve();

    expect(wipeSettled).toBe(false);
    expect(mockRawDatabase.closeAsync).not.toHaveBeenCalled();
    await expect(getDatabase()).rejects.toThrow(/Ohne angemeldeten Nutzer/);

    finishQuery?.();
    await query;
    await expect(wipe).rejects.toThrow(/nicht geschlossen/);
    expect(mockDeleteFile).not.toHaveBeenCalled();

    await expect(deleteLocalDatabase()).rejects.toThrow(/Wipe ist fehlgeschlagen/);
    expect(mockRawDatabase.closeAsync).toHaveBeenCalledTimes(2);
    expect(deleteDatabaseEncryptionKey).not.toHaveBeenCalled();

    let finishOpen: ((value: typeof mockRawDatabase) => void) | undefined;
    jest.mocked(openEncryptedDatabaseWithCutover).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOpen = resolve;
        }),
    );
    setActiveUserId('user-b');
    const staleOpening = getDatabase();
    await Promise.resolve();
    await Promise.resolve();
    setActiveUserId(null);
    let deferredWipeSettled = false;
    const deferredWipe = deleteLocalDatabase().finally(() => {
      deferredWipeSettled = true;
    });
    await Promise.resolve();
    expect(deferredWipeSettled).toBe(false);

    finishOpen?.(mockRawDatabase);
    await expect(staleOpening).rejects.toThrow(/Accountwechsel/);
    await expect(deferredWipe).rejects.toThrow(/Wipe ist fehlgeschlagen/);
    await expect(getDatabase()).rejects.toThrow(/Ohne angemeldeten Nutzer/);
  });

  it('löscht Dateien aus dem Standardverzeichnis, wenn kein App-Group-Pfad verfügbar ist', async () => {
    const fileSystem = jest.requireMock('expo-file-system') as {
      Paths: { appleSharedContainers?: Record<string, { uri: string }> };
    };
    const { createExpoDatabaseFileOps } = jest.requireMock('@/lib/db/database-files') as {
      createExpoDatabaseFileOps: jest.Mock;
    };
    const { deleteDatabaseEncryptionKey: deleteKey } = jest.requireMock(
      '@/lib/db/local-database-encryption',
    ) as { deleteDatabaseEncryptionKey: jest.Mock };
    const { debugWarn } = jest.requireMock('@/lib/observability/debug-log') as {
      debugWarn: jest.Mock;
    };
    const originalFailMainFileDeletion = failMainFileDeletion;
    const originalExistingFiles = new Set(mockExistingFiles);
    const originalAppGroupDescriptor = Object.getOwnPropertyDescriptor(
      fileSystem.Paths,
      'appleSharedContainers',
    );

    try {
      failMainFileDeletion = false;
      setActiveUserId('user-c');
      mockRawDatabase.getFirstAsync.mockResolvedValueOnce({ journal_mode: 'wal' });
      await getDatabase();

      fileSystem.Paths.appleSharedContainers = undefined;
      createExpoDatabaseFileOps.mockClear();
      mockDeleteFile.mockClear();
      deleteKey.mockClear();
      debugWarn.mockClear();
      await deleteLocalDatabase();

      expect(createExpoDatabaseFileOps).toHaveBeenCalledTimes(1);
      expect(createExpoDatabaseFileOps).toHaveBeenLastCalledWith('/mock/sqlite');
      expect(mockDeleteFile).toHaveBeenCalledTimes(12);
      expect(mockDeleteFile).toHaveBeenNthCalledWith(1, 'fam-v2.db');
      expect(deleteKey).toHaveBeenCalledTimes(1);
      expect(debugWarn).not.toHaveBeenCalled();

      Object.defineProperty(fileSystem.Paths, 'appleSharedContainers', {
        configurable: true,
        get() {
          throw new Error('shared-container API unavailable');
        },
      });
      createExpoDatabaseFileOps.mockClear();
      mockDeleteFile.mockClear();
      deleteKey.mockClear();
      debugWarn.mockClear();
      await deleteLocalDatabase();

      expect(createExpoDatabaseFileOps).toHaveBeenCalledTimes(1);
      expect(createExpoDatabaseFileOps).toHaveBeenLastCalledWith('/mock/sqlite');
      expect(mockDeleteFile).toHaveBeenCalledTimes(12);
      expect(mockDeleteFile).toHaveBeenNthCalledWith(1, 'fam-v2.db');
      expect(deleteKey).toHaveBeenCalledTimes(1);
      expect(debugWarn).toHaveBeenCalledTimes(1);
      expect(debugWarn).toHaveBeenLastCalledWith(
        '[db] App-Group-Container nicht verfügbar; verwende Standardverzeichnis.',
        expect.any(Error),
      );
    } finally {
      failMainFileDeletion = originalFailMainFileDeletion;
      mockExistingFiles.clear();
      for (const fileName of originalExistingFiles) mockExistingFiles.add(fileName);
      if (originalAppGroupDescriptor) {
        Object.defineProperty(
          fileSystem.Paths,
          'appleSharedContainers',
          originalAppGroupDescriptor,
        );
      } else {
        delete fileSystem.Paths.appleSharedContainers;
      }
      createExpoDatabaseFileOps.mockClear();
      mockDeleteFile.mockClear();
      deleteKey.mockClear();
      debugWarn.mockClear();
      mockRawDatabase.closeAsync.mockClear();
      setActiveUserId(null);
    }
  });
});
