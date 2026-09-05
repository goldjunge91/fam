import { deleteLocalDatabase, getDatabase, setActiveUserId } from '@/lib/db/client';
import {
  deleteDatabaseEncryptionKey,
  openEncryptedDatabaseWithCutover,
} from '@/lib/db/database-encryption';

const mockExistingFiles = new Set(['fam-v2.db', 'fam-v2.db-wal']);
const mockDeleteFile = jest.fn(async (fileName: string) => {
  if (fileName === 'fam-v2.db') throw new Error('native delete failed');
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

jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: '/mock/sqlite',
  openDatabaseAsync: jest.fn(() => Promise.resolve(mockRawDatabase)),
}));

jest.mock('@/lib/db/database-encryption', () => ({
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

jest.mock('@/lib/db/migrator', () => ({ runMigrations: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/db/drizzle-migrator', () => ({
  runDrizzleMigrations: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/db/drizzle-driver', () => ({ createDrizzleDatabase: jest.fn() }));
jest.mock('@/lib/db/ownership', () => ({
  ensureDatabaseBelongsTo: jest.fn(async (db) => db),
}));
jest.mock('@/lib/off-dump/off-dump-state', () => ({ resetOffDumpAttachment: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({
  measureOperation: (_name: string, operation: () => Promise<unknown>) => operation(),
}));

describe('database client lifecycle', () => {
  it('blockiert ohne Session und drained eine laufende Query vor einem fail-closed Wipe', async () => {
    setActiveUserId(null);
    await expect(getDatabase()).rejects.toThrow(/Ohne angemeldeten Nutzer/);

    setActiveUserId('user-a');
    const db = await getDatabase();
    expect(mockRawDatabase.execAsync.mock.calls.slice(0, 2)).toEqual([
      ['PRAGMA busy_timeout = 5000'],
      ['PRAGMA journal_mode = WAL'],
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
});
