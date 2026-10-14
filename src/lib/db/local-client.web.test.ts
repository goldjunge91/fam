import {
  deleteLocalDatabase,
  getDatabase,
  getDrizzleDatabase,
  setActiveUserId,
} from '@/lib/db/local-client.web';
import localMigrations from '../../../drizzle/local/migrations';

const mockRawDatabase = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 0, changes: 0 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  prepareAsync: jest.fn(),
  closeAsync: jest.fn().mockResolvedValue(undefined),
};
const mockExpoDrizzleDatabase = {};
const mockDrizzleDatabase = {};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() => Promise.resolve(mockRawDatabase)),
  deleteDatabaseAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  drizzle: jest.fn(() => mockExpoDrizzleDatabase),
}));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  migrate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/db/drizzle-driver', () => ({
  createDrizzleDatabase: jest.fn(() => mockDrizzleDatabase),
}));
jest.mock('@/lib/db/ownership', () => ({
  ensureDatabaseBelongsTo: jest.fn(async (db: unknown) => db),
}));
jest.mock('@/lib/off-dump/off-dump-state', () => ({ resetOffDumpAttachment: jest.fn() }));
jest.mock('@/lib/telemetry', () => ({
  measureOperation: (_name: string, operation: () => Promise<unknown>) => operation(),
}));
jest.mock('@/lib/observability/debug-log', () => ({
  debugLog: jest.fn(),
  debugWarn: jest.fn(),
}));

const mockSQLite = jest.requireMock('expo-sqlite') as {
  openDatabaseAsync: jest.Mock;
  deleteDatabaseAsync: jest.Mock;
};
const mockMigrator = jest.requireMock('drizzle-orm/expo-sqlite/migrator') as {
  migrate: jest.Mock;
};
const mockCreateDrizzleDatabase = jest.requireMock('@/lib/db/drizzle-driver')
  .createDrizzleDatabase as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSQLite.openDatabaseAsync.mockResolvedValue(mockRawDatabase);
  mockSQLite.deleteDatabaseAsync.mockResolvedValue(undefined);
  mockRawDatabase.execAsync.mockResolvedValue(undefined);
  mockRawDatabase.runAsync.mockResolvedValue({ lastInsertRowId: 0, changes: 0 });
  mockRawDatabase.getAllAsync.mockResolvedValue([]);
  mockRawDatabase.getFirstAsync.mockResolvedValue(null);
  mockRawDatabase.prepareAsync.mockReset();
  mockRawDatabase.closeAsync.mockResolvedValue(undefined);
});

afterEach(async () => {
  setActiveUserId(null);
  await deleteLocalDatabase();
});

describe('web local database client', () => {
  it('opens and migrates the web database, caches Drizzle, and reopens after deletion', async () => {
    await expect(getDatabase()).rejects.toThrow(/Ohne angemeldeten Nutzer/);

    setActiveUserId('user-a');
    const database = await getDatabase();

    expect(mockSQLite.openDatabaseAsync).toHaveBeenCalledWith('fam-v2.web.db', {
      useNewConnection: true,
    });
    expect(mockRawDatabase.execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
    expect(mockMigrator.migrate).toHaveBeenCalledWith(mockExpoDrizzleDatabase, localMigrations);

    const drizzleDatabase = await getDrizzleDatabase();
    await expect(getDrizzleDatabase()).resolves.toBe(drizzleDatabase);
    expect(mockCreateDrizzleDatabase).toHaveBeenCalledTimes(1);

    await deleteLocalDatabase();

    expect(mockRawDatabase.closeAsync).toHaveBeenCalledTimes(1);
    expect(mockSQLite.deleteDatabaseAsync).toHaveBeenCalledWith('fam-v2.web.db');
    await expect(getDatabase()).resolves.not.toBe(database);
    expect(mockSQLite.openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it('forwards SQL calls and finalizes prepared raw-result statements', async () => {
    setActiveUserId('user-a');
    const database = await getDatabase();
    const rows: (string | number | null)[][] = [[1, 'milk', null]];
    const rawResult = { getAllAsync: jest.fn().mockResolvedValue(rows) };
    const statement = {
      executeForRawResultAsync: jest.fn().mockResolvedValue(rawResult),
      finalizeAsync: jest.fn().mockResolvedValue(undefined),
    };
    mockRawDatabase.prepareAsync.mockResolvedValue(statement);
    mockRawDatabase.getFirstAsync.mockResolvedValueOnce({ id: 'item-a' });

    await database.runAsync('INSERT INTO items DEFAULT VALUES');
    await database.getAllAsync<{ id: string }>('SELECT id FROM items', ['family-a']);
    await database.getAllAsync<{ id: string }>('SELECT id FROM items');
    await expect(database.getFirstAsync<{ id: string }>('SELECT id FROM items')).resolves.toEqual({
      id: 'item-a',
    });
    await expect(database.getAllRawAsync?.('SELECT * FROM items', ['family-a'])).resolves.toEqual(
      rows,
    );
    await expect(database.getAllRawAsync?.('SELECT * FROM items')).resolves.toEqual(rows);

    expect(mockRawDatabase.runAsync).toHaveBeenCalledWith('INSERT INTO items DEFAULT VALUES', []);
    expect(mockRawDatabase.getAllAsync).toHaveBeenCalledWith('SELECT id FROM items', ['family-a']);
    expect(mockRawDatabase.getAllAsync).toHaveBeenCalledWith('SELECT id FROM items', []);
    expect(mockRawDatabase.getFirstAsync).toHaveBeenCalledWith('SELECT id FROM items', []);
    expect(mockRawDatabase.prepareAsync).toHaveBeenCalledTimes(2);
    expect(statement.executeForRawResultAsync).toHaveBeenNthCalledWith(1, ['family-a']);
    expect(statement.executeForRawResultAsync).toHaveBeenNthCalledWith(2, []);
    expect(rawResult.getAllAsync).toHaveBeenCalledTimes(2);
    expect(statement.finalizeAsync).toHaveBeenCalledTimes(2);
  });

  it('joins a concurrent open and re-verifies the cached connection after an account switch', async () => {
    let finishOpen: ((database: typeof mockRawDatabase) => void) | undefined;
    mockSQLite.openDatabaseAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOpen = resolve;
        }),
    );
    setActiveUserId('user-a');

    const opening = getDatabase();
    const joinedOpening = getDatabase();
    expect(joinedOpening).toBe(opening);
    finishOpen?.(mockRawDatabase);
    const database = await opening;

    setActiveUserId('user-b');

    await expect(getDatabase()).resolves.toBe(database);
    expect(mockSQLite.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('closes the opened connection when migrations fail without deleting its database file', async () => {
    setActiveUserId('user-a');
    mockMigrator.migrate.mockRejectedValueOnce(new Error('migration failed'));

    await expect(getDatabase()).rejects.toThrow('migration failed');

    expect(mockRawDatabase.closeAsync).toHaveBeenCalledTimes(1);
    expect(mockSQLite.deleteDatabaseAsync).not.toHaveBeenCalled();
  });

  it('rejects database access during a wipe and reports a failed file deletion', async () => {
    setActiveUserId('user-a');
    await getDatabase();
    mockSQLite.deleteDatabaseAsync.mockRejectedValueOnce(new Error('delete failed'));

    const wipe = deleteLocalDatabase();

    expect(deleteLocalDatabase()).toBe(wipe);
    await expect(getDatabase()).rejects.toThrow(/gerade gelöscht/);
    await expect(wipe).rejects.toThrow(/nicht gelöscht/);
  });
});
