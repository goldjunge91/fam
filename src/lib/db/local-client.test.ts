import {
  closeDatabaseForLifecycle,
  deleteLocalDatabase,
  getActiveDatabaseAccount,
  getDatabase,
  getDrizzleDatabase,
  runWithCurrentDatabase,
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
  getFirstAsync: jest
    .fn()
    .mockImplementation((source: string) =>
      Promise.resolve(source === 'PRAGMA journal_mode' ? { journal_mode: 'wal' } : null),
    ),
  prepareAsync: jest.fn(),
  closeAsync: jest.fn().mockResolvedValue(undefined),
};

const mockExpoDrizzleDatabase = {};
let mockLifecycleState = 'active';
const mockWriterLeases: Array<{ name: string; end: jest.Mock<void, []> }> = [];

jest.mock('@/lib/apple/shared-store-lifecycle', () => ({
  getSharedStoreLifecycleState: jest.fn(() => mockLifecycleState),
  createSharedStoreWriterOwner: jest.fn(() => ({
    beginWriterLease: jest.fn((name: string) => {
      let ended = false;
      const end = jest.fn(() => {
        ended = true;
      });
      mockWriterLeases.push({ name, end });
      return {
        signal: new AbortController().signal,
        get ended() {
          return ended;
        },
        end,
      };
    }),
  })),
  withSharedStoreWriter: jest.fn(async (_owner, _name, operation) =>
    operation({
      signal: new AbortController().signal,
      ended: false,
      end: jest.fn(),
    }),
  ),
}));

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
  it('verifiziert den Journalmodus nach dem Setzen und bricht bei einem anderen Modus ab', async () => {
    setActiveUserId('journal-mode-user');
    mockRawDatabase.getFirstAsync.mockClear();
    mockRawDatabase.execAsync.mockClear();
    mockRawDatabase.getFirstAsync
      .mockResolvedValueOnce({ journal_mode: 'delete' })
      .mockResolvedValueOnce({ journal_mode: 'delete' });

    await expect(getDatabase()).rejects.toThrow(
      'SQLite-Journalmodus ist nicht WAL (beobachtet: delete).',
    );
    expect(mockRawDatabase.execAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
    expect(mockRawDatabase.getFirstAsync).toHaveBeenNthCalledWith(1, 'PRAGMA journal_mode', []);
    expect(mockRawDatabase.getFirstAsync).toHaveBeenNthCalledWith(2, 'PRAGMA journal_mode', []);
  });

  it('akzeptiert WAL erst nach der Verifikation des gesetzten Modus', async () => {
    setActiveUserId('journal-mode-user');
    mockRawDatabase.getFirstAsync.mockClear();
    mockRawDatabase.execAsync.mockClear();
    mockRawDatabase.getFirstAsync
      .mockResolvedValueOnce({ journal_mode: 'delete' })
      .mockResolvedValueOnce({ journal_mode: 'wal' });

    await getDatabase();

    expect(mockRawDatabase.execAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
    expect(mockRawDatabase.getFirstAsync).toHaveBeenNthCalledWith(1, 'PRAGMA journal_mode', []);
    expect(mockRawDatabase.getFirstAsync).toHaveBeenNthCalledWith(2, 'PRAGMA journal_mode', []);
    await closeDatabaseForLifecycle();
  });

  it('öffnet dieselbe App-Group-Datei, die Siri beschreibt', async () => {
    setActiveUserId('user-a');
    mockRawDatabase.getFirstAsync.mockClear();
    mockRawDatabase.execAsync.mockClear();
    mockRawDatabase.closeAsync.mockClear();
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
    expect(createExpoDatabaseFileOps).toHaveBeenCalledWith(
      '/mock/app-group',
      expect.objectContaining({ writerOwner: expect.any(Object) }),
    );
    expect(mockRawDatabase.execAsync).not.toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
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

  it('propagiert Close-Fehler, warnt und erlaubt einen bestätigten Wiederholungsversuch', async () => {
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
    await expect(closeDatabaseForLifecycle()).rejects.toThrow('temporary close failure');

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

  it('behält die Migrations-Lease nach fehlgeschlagenem Rollback und Raw-Close bis zur Recovery', async () => {
    await closeDatabaseForLifecycle();
    setActiveUserId('migration-cleanup-user');
    const { migrate } = jest.requireMock('drizzle-orm/expo-sqlite/migrator') as {
      migrate: jest.Mock;
    };
    const leaseCountBefore = mockWriterLeases.length;
    mockRawDatabase.closeAsync.mockClear();
    let migrationLeaseEnd: jest.Mock<void, []> | undefined;
    migrate.mockImplementationOnce(async () => {
      migrationLeaseEnd = mockWriterLeases
        .slice(leaseCountBefore)
        .find(({ name }) => name === 'db.migrations')?.end;
      throw new Error('migration rollback failed', {
        cause: new Error('migration statement failed'),
      });
    });
    mockRawDatabase.closeAsync
      .mockRejectedValueOnce(new Error('migration recovery close failed'))
      .mockRejectedValueOnce(new Error('startup cleanup close failed'))
      .mockImplementationOnce(async () => {
        expect(migrationLeaseEnd).not.toHaveBeenCalled();
      });

    try {
      await expect(getDatabase()).rejects.toThrow(
        'Die fehlgeschlagene Datenbanköffnung konnte nicht geschlossen werden.',
      );
      expect(migrationLeaseEnd).toBeDefined();
      expect(migrationLeaseEnd).not.toHaveBeenCalled();

      await expect(closeDatabaseForLifecycle()).resolves.toMatchObject({ status: 'closed' });
      expect(migrationLeaseEnd).toHaveBeenCalledTimes(1);
      expect(mockRawDatabase.closeAsync).toHaveBeenCalledTimes(3);
    } finally {
      mockRawDatabase.closeAsync.mockReset().mockResolvedValue(undefined);
      await closeDatabaseForLifecycle().catch(() => undefined);
      setActiveUserId(null);
    }
  });

  it('hält einen unresolved Cutover-Handle für den erwarteten Account bis zum Close-Retry', async () => {
    await closeDatabaseForLifecycle();
    setActiveUserId('cutover-cleanup-user');
    const expectedAccount = getActiveDatabaseAccount();
    const retryCleanup = jest
      .fn()
      .mockRejectedValueOnce(new Error('cutover raw close failed'))
      .mockResolvedValueOnce(undefined);
    jest.mocked(openEncryptedDatabaseWithCutover).mockImplementationOnce(async (dependencies) => {
      dependencies.retainUnresolvedSourceCleanup?.(mockRawDatabase, retryCleanup);
      throw new Error('detach failed');
    });

    try {
      await expect(getDatabase()).rejects.toThrow('detach failed');
      await expect(closeDatabaseForLifecycle(expectedAccount)).rejects.toThrow(
        'cutover raw close failed',
      );
      await expect(closeDatabaseForLifecycle(expectedAccount)).resolves.toEqual({
        status: 'closed',
        account: expectedAccount,
      });
      expect(retryCleanup).toHaveBeenCalledTimes(2);
    } finally {
      await closeDatabaseForLifecycle().catch(() => undefined);
      setActiveUserId(null);
    }
  });

  it('behält einen verschlüsselten Handle nach einem fehlgeschlagenen stale Close', async () => {
    await closeDatabaseForLifecycle();
    setActiveUserId('encrypted-opening-user');
    const expectedAccount = getActiveDatabaseAccount();
    const opened = {
      ...mockRawDatabase,
      closeAsync: jest
        .fn()
        .mockRejectedValueOnce(new Error('encrypted helper close failed'))
        .mockResolvedValueOnce(undefined),
    };
    const SQLite = jest.requireMock('expo-sqlite') as { openDatabaseAsync: jest.Mock };
    let resolveNativeOpen: ((database: typeof opened) => void) | undefined;
    let markNativeOpenStarted: (() => void) | undefined;
    const nativeOpenStarted = new Promise<void>((resolve) => {
      markNativeOpenStarted = resolve;
    });
    SQLite.openDatabaseAsync.mockImplementationOnce(
      () =>
        new Promise<typeof opened>((resolve) => {
          resolveNativeOpen = resolve;
          markNativeOpenStarted?.();
        }),
    );
    jest
      .mocked(openEncryptedDatabaseWithCutover)
      .mockImplementationOnce((dependencies, key) =>
        dependencies.openEncrypted(dependencies.mainFileName, key),
      );

    try {
      const opening = getDatabase();
      await nativeOpenStarted;
      setActiveUserId(null);
      resolveNativeOpen?.(opened);

      await expect(opening).rejects.toThrow('encrypted helper close failed');
      expect(opened.closeAsync).toHaveBeenCalledTimes(1);
      await expect(closeDatabaseForLifecycle(expectedAccount)).resolves.toEqual({
        status: 'closed',
        account: expectedAccount,
      });
      expect(opened.closeAsync).toHaveBeenCalledTimes(2);
    } finally {
      await closeDatabaseForLifecycle().catch(() => undefined);
      mockLifecycleState = 'active';
      setActiveUserId(null);
    }
  });

  it('behält einen Klartext-Handle nach einem fehlgeschlagenen stale Close', async () => {
    await closeDatabaseForLifecycle();
    setActiveUserId('plaintext-opening-user');
    const expectedAccount = getActiveDatabaseAccount();
    const opened = {
      ...mockRawDatabase,
      closeAsync: jest
        .fn()
        .mockRejectedValueOnce(new Error('plaintext helper close failed'))
        .mockResolvedValueOnce(undefined),
    };
    const SQLite = jest.requireMock('expo-sqlite') as { openDatabaseAsync: jest.Mock };
    let resolveNativeOpen: ((database: typeof opened) => void) | undefined;
    let markNativeOpenStarted: (() => void) | undefined;
    const nativeOpenStarted = new Promise<void>((resolve) => {
      markNativeOpenStarted = resolve;
    });
    SQLite.openDatabaseAsync.mockImplementationOnce(
      () =>
        new Promise<typeof opened>((resolve) => {
          resolveNativeOpen = resolve;
          markNativeOpenStarted?.();
        }),
    );
    jest
      .mocked(openEncryptedDatabaseWithCutover)
      .mockImplementationOnce((dependencies) =>
        dependencies.openPlaintext(dependencies.mainFileName),
      );

    try {
      const opening = getDatabase();
      await nativeOpenStarted;
      setActiveUserId(null);
      resolveNativeOpen?.(opened);

      await expect(opening).rejects.toThrow('plaintext helper close failed');
      expect(opened.closeAsync).toHaveBeenCalledTimes(1);
      await expect(closeDatabaseForLifecycle(expectedAccount)).resolves.toEqual({
        status: 'closed',
        account: expectedAccount,
      });
      expect(opened.closeAsync).toHaveBeenCalledTimes(2);
    } finally {
      await closeDatabaseForLifecycle().catch(() => undefined);
      mockLifecycleState = 'active';
      setActiveUserId(null);
    }
  });

  it('registriert den Cutover-Rückgabewert vor der letzten Admission-Prüfung', async () => {
    await closeDatabaseForLifecycle();
    setActiveUserId('cutover-result-user');
    const expectedAccount = getActiveDatabaseAccount();
    const cancellation = new AbortController();
    const backgroundContext = {
      kind: 'background' as const,
      name: 'cutover-result-test',
      token: 'cutover-result-token',
      signal: cancellation.signal,
      ended: false,
      end: jest.fn(),
    };
    const opened = {
      ...mockRawDatabase,
      closeAsync: jest
        .fn()
        .mockRejectedValueOnce(new Error('cutover result close failed'))
        .mockResolvedValueOnce(undefined),
    };
    let resolveCutover: ((database: typeof opened) => void) | undefined;
    let markCutoverStarted: (() => void) | undefined;
    const cutoverStarted = new Promise<void>((resolve) => {
      markCutoverStarted = resolve;
    });
    jest.mocked(openEncryptedDatabaseWithCutover).mockImplementationOnce(
      () =>
        new Promise<typeof opened>((resolve) => {
          resolveCutover = resolve;
          markCutoverStarted?.();
        }),
    );

    try {
      const opening = getDatabase({
        kind: 'background',
        backgroundContext,
        signal: cancellation.signal,
      });
      await cutoverStarted;
      cancellation.abort('background-task-expired');
      resolveCutover?.(opened);

      await expect(opening).rejects.toThrow(/abgelaufen|konnte nicht geschlossen/);
      expect(opened.closeAsync).toHaveBeenCalledTimes(1);
      expect(backgroundContext.end).not.toHaveBeenCalled();
      await expect(closeDatabaseForLifecycle(expectedAccount)).resolves.toEqual({
        status: 'closed',
        account: expectedAccount,
      });
      expect(opened.closeAsync).toHaveBeenCalledTimes(2);
      expect(backgroundContext.end).not.toHaveBeenCalled();
    } finally {
      await closeDatabaseForLifecycle().catch(() => undefined);
      mockLifecycleState = 'active';
      setActiveUserId(null);
    }
  });

  it('wartet einen OFF-Lifecycle-Aufruf ab, wenn der App-Close dazwischen startet', async () => {
    setActiveUserId('user-a');
    await getDatabase();

    let finishClose: (() => void) | undefined;
    mockRawDatabase.closeAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        }),
    );

    let markActionStarted: (() => void) | undefined;
    const actionStarted = new Promise<void>((resolve) => {
      markActionStarted = resolve;
    });
    let attempts = 0;
    const action = runWithCurrentDatabase(async (db) => {
      attempts += 1;
      markActionStarted?.();
      return db.withLifecycleOperationAsync((operationDb) =>
        operationDb.getFirstAsync<{ value: number }>('select 1'),
      );
    });

    const closing = closeDatabaseForLifecycle();
    await actionStarted;
    await Promise.resolve();
    finishClose?.();
    await closing;

    await expect(action).resolves.toBeNull();
    expect(attempts).toBe(2);
  });

  it('startet einen wiederholten Lifecycle-Aufruf nach Accountwechsel nicht im neuen Konto', async () => {
    setActiveUserId('user-a');
    await getDatabase();

    let finishClose: (() => void) | undefined;
    mockRawDatabase.closeAsync.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        }),
    );

    let markActionStarted: (() => void) | undefined;
    const actionStarted = new Promise<void>((resolve) => {
      markActionStarted = resolve;
    });
    let releaseAction: (() => void) | undefined;
    const actionReleased = new Promise<void>((resolve) => {
      releaseAction = resolve;
    });
    let attempts = 0;
    const action = runWithCurrentDatabase(async (db) => {
      attempts += 1;
      markActionStarted?.();
      await actionReleased;
      return db.withLifecycleOperationAsync((operationDb) =>
        operationDb.getFirstAsync<{ value: number }>('select 1'),
      );
    });

    await actionStarted;
    const closing = closeDatabaseForLifecycle();
    setActiveUserId('user-b');
    releaseAction?.();
    await Promise.resolve();
    finishClose?.();
    await closing;

    await expect(action).rejects.toThrow(/Accountwechsel/);
    expect(attempts).toBe(1);
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

  it('weist einen normalen Datenbank-Open nach native resigning synchron zurück', async () => {
    const SQLite = jest.requireMock('expo-sqlite') as typeof import('expo-sqlite');
    const openCallsBefore = jest.mocked(SQLite.openDatabaseAsync).mock.calls.length;
    setActiveUserId('lifecycle-resigning-user');
    mockLifecycleState = 'resigning';

    await expect(getDatabase()).rejects.toThrow(/Lifecycle nicht zugelassen/);
    expect(jest.mocked(SQLite.openDatabaseAsync).mock.calls.length).toBe(openCallsBefore);

    mockLifecycleState = 'active';
    setActiveUserId(null);
  });

  it('erlaubt einen expliziten Background-Kontext und schließt ihn danach regulär', async () => {
    setActiveUserId('background-user');
    mockLifecycleState = 'background';
    mockRawDatabase.getFirstAsync.mockResolvedValueOnce({ journal_mode: 'wal' });
    const context = {
      kind: 'background' as const,
      backgroundContext: {
        kind: 'background' as const,
        name: 'background-sync',
        token: 'background-token',
        signal: new AbortController().signal,
        ended: false,
        end: jest.fn(),
      },
    };

    await expect(getDatabase(context)).resolves.toBeDefined();
    await closeDatabaseForLifecycle();
    expect(context.backgroundContext.end).not.toHaveBeenCalled();

    mockLifecycleState = 'active';
    setActiveUserId(null);
  });

  it('schließt die Background-Connection trotz eines bereits gestarteten Accountwechsels', async () => {
    setActiveUserId('background-transition-old');
    mockLifecycleState = 'active';
    mockRawDatabase.getFirstAsync.mockResolvedValueOnce({ journal_mode: 'wal' });
    await getDatabase();
    const oldAccount = getActiveDatabaseAccount();
    mockRawDatabase.closeAsync.mockClear();

    setActiveUserId(null);
    await expect(closeDatabaseForLifecycle(oldAccount)).resolves.toEqual({
      status: 'closed',
      account: oldAccount,
    });

    expect(mockRawDatabase.closeAsync).toHaveBeenCalledTimes(1);
    mockLifecycleState = 'active';
  });

  it('schließt keine neue Account-Connection mit einer stale Background-Ownership', async () => {
    setActiveUserId('background-old');
    mockLifecycleState = 'active';
    mockRawDatabase.getFirstAsync.mockResolvedValueOnce({ journal_mode: 'wal' });
    await getDatabase();
    const oldAccount = getActiveDatabaseAccount();

    setActiveUserId('background-new');
    await getDatabase();
    mockRawDatabase.closeAsync.mockClear();

    await expect(closeDatabaseForLifecycle(oldAccount)).resolves.toEqual({
      status: 'ownership-mismatch',
      account: getActiveDatabaseAccount(),
    });

    expect(mockRawDatabase.closeAsync).not.toHaveBeenCalled();

    await closeDatabaseForLifecycle();
    mockLifecycleState = 'active';
    setActiveUserId(null);
  });

  it('öffnet nach dem Lifecycle-Close im resigning-Zustand nicht erneut', async () => {
    setActiveUserId('reopen-user');
    mockLifecycleState = 'active';
    mockRawDatabase.getFirstAsync.mockResolvedValueOnce({ journal_mode: 'wal' });
    await getDatabase();
    const SQLite = jest.requireMock('expo-sqlite') as typeof import('expo-sqlite');
    const openCallsBeforeClose = jest.mocked(SQLite.openDatabaseAsync).mock.calls.length;

    mockLifecycleState = 'resigning';
    await closeDatabaseForLifecycle();
    await expect(getDatabase()).rejects.toThrow(/Lifecycle nicht zugelassen/);
    expect(jest.mocked(SQLite.openDatabaseAsync).mock.calls.length).toBe(openCallsBeforeClose);

    mockLifecycleState = 'active';
    setActiveUserId(null);
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
