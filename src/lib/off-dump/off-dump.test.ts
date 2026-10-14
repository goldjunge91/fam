import type { SqlDatabase, SqlParam } from '@/lib/db/types';
import {
  attachOffDump,
  checkOffDumpIntegrity,
  forceRefreshOffDump,
  getOffDumpStatus,
  initOffDump,
  reinstallOffDumpBaseline,
  resetOffDumpAttachment,
} from './off-dump';
import { setOffDumpAttached } from './off-dump-state';
import { checkForUpdate, reconcileOnStart } from './repository';

const executedSql: string[] = [];
const executedRuns: Array<{ params: readonly SqlParam[] | undefined; source: string }> = [];
const mockFileOps = {
  inspectDump: jest.fn(),
  exists: jest.fn(async () => true),
  size: jest.fn(async () => 123),
  download: jest.fn(async () => undefined),
  move: jest.fn(async () => undefined),
  delete: jest.fn(async () => undefined),
  checksum: jest.fn(async () => 'checksum'),
};
const mockAttachPlaintextDatabase = jest.fn(
  async (db: SqlDatabase, path: string, alias: string, mode: 'sqlcipher' | 'sqlite') => {
    const keyClause = mode === 'sqlcipher' ? " KEY ''" : '';
    await db.execAsync(`ATTACH DATABASE '${path}' AS ${alias}${keyClause}`);
  },
);
let mockFileExists = true;
let mockFileSize = 123;

jest.mock('expo-file-system', () => {
  class MockFile {
    readonly exists = mockFileExists;
    readonly size = mockFileSize;
    readonly uri: string;

    constructor(...parts: string[]) {
      this.uri = parts.join('/');
    }
  }

  return {
    File: MockFile,
    Paths: { document: '/documents' },
  };
});

jest.mock('./expo-file-ops', () => ({
  createExpoFileOps: jest.fn(() => mockFileOps),
}));

jest.mock('./baseline-installer', () => ({
  installBaseline: (...args: unknown[]) => mockInstallBaseline(...args),
}));

jest.mock('./manifest', () => ({
  fetchManifest: (...args: unknown[]) => mockFetchManifest(...args),
}));

jest.mock('./plaintext-attachment', () => ({
  attachPlaintextDatabase: (
    db: SqlDatabase,
    path: string,
    alias: string,
    mode: 'sqlcipher' | 'sqlite',
  ) => mockAttachPlaintextDatabase(db, path, alias, mode),
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugLog: jest.fn(),
  debugWarn: (...args: unknown[]) => mockDebugWarn(...args),
}));

jest.mock('./repository', () => ({
  checkForUpdate: jest.fn(),
  reconcileOnStart: jest.fn(),
}));

const mockInstallBaseline = jest.fn();
const mockFetchManifest = jest.fn();
const mockDebugWarn = jest.fn();

type DbOptions = {
  metadata?: Record<string, string | null>;
  attachedMeta?: { schema_version: number; data_version: string } | null;
  quickCheck?: Record<string, string> | null;
  attachError?: Error;
};

function createDb(attachedDatabases: readonly string[] = [], options: DbOptions = {}): SqlDatabase {
  const metadata = new Map(Object.entries(options.metadata ?? {}));
  return {
    execAsync: async (source) => {
      executedSql.push(source);
      if (source.startsWith('ATTACH DATABASE') && options.attachError) throw options.attachError;
    },
    getAllAsync: async <T>(source: string) =>
      source === 'PRAGMA database_list' ? attachedDatabases.map((name) => ({ name }) as T) : [],
    getFirstAsync: async <T>(source: string, params?: readonly SqlParam[]) => {
      if (source.includes('from app_meta')) {
        return { value: metadata.get(String(params?.[0])) ?? null } as T;
      }
      if (source.includes('off_dump.dump_meta')) return (options.attachedMeta ?? null) as T | null;
      if (source.includes('off_dump.quick_check')) return (options.quickCheck ?? null) as T | null;
      return null;
    },
    runAsync: async (source, params) => {
      executedRuns.push({ params, source });
      if (source.includes('insert into app_meta') && params) {
        metadata.set(String(params[0]), params[1] === null ? null : String(params[1]));
      }
      return { changes: 0, lastInsertRowId: 0 };
    },
    withExclusiveTransactionAsync: async () => undefined,
  };
}

beforeEach(() => {
  executedSql.length = 0;
  executedRuns.length = 0;
  mockFileExists = true;
  mockFileSize = 123;
  resetOffDumpAttachment();
  jest.mocked(checkForUpdate).mockReset();
  jest.mocked(reconcileOnStart).mockReset();
  mockInstallBaseline.mockReset().mockResolvedValue({ ok: false, reason: 'corrupted' });
  mockFetchManifest.mockReset().mockResolvedValue(null);
  mockAttachPlaintextDatabase.mockReset().mockImplementation(async (db, path, alias, mode) => {
    const keyClause = mode === 'sqlcipher' ? " KEY ''" : '';
    await db.execAsync(`ATTACH DATABASE '${path}' AS ${alias}${keyClause}`);
  });
  mockDebugWarn.mockClear();
  for (const mock of Object.values(mockFileOps)) mock.mockReset();
  mockFileOps.inspectDump.mockResolvedValue({
    schemaVersion: 3,
    dataVersion: '2026-10-01T00:00:00.000Z',
    integrityOk: true,
  });
  mockFileOps.exists.mockResolvedValue(true);
  mockFileOps.size.mockResolvedValue(123);
  mockFileOps.download.mockResolvedValue(undefined);
  mockFileOps.move.mockResolvedValue(undefined);
  mockFileOps.delete.mockResolvedValue(undefined);
  mockFileOps.checksum.mockResolvedValue('checksum');
});

describe('attachOffDump', () => {
  it('attaches the active dump writable for in-place patches', async () => {
    await attachOffDump(createDb());

    expect(executedSql).toEqual(["ATTACH DATABASE '/documents/off-dump-v2.db' AS off_dump KEY ''"]);
  });

  it('detaches the dump before replacing an existing attachment', async () => {
    await attachOffDump(createDb(['off_dump']));

    expect(executedSql).toEqual([
      'DETACH DATABASE off_dump',
      "ATTACH DATABASE '/documents/off-dump-v2.db' AS off_dump KEY ''",
    ]);
  });

  it('verifiziert ein vorhandenes Attach-Flag gegen die aktuelle Connection', async () => {
    setOffDumpAttached(true);
    const db = createDb();
    db.getFirstAsync = async <T>(source: string) => {
      if (source.includes('dump_meta')) return null;
      return { quick_check: 'ok' } as T;
    };

    await attachOffDump(db);

    expect(executedSql).toEqual(["ATTACH DATABASE '/documents/off-dump-v2.db' AS off_dump KEY ''"]);
  });

  it('überspringt den Attach nur bei einem tatsächlich erreichbaren Dump', async () => {
    setOffDumpAttached(true);
    const db = createDb();
    db.getFirstAsync = async <T>(source: string) => {
      if (source.includes('dump_meta')) {
        return { schema_version: 3, data_version: '2026-09-01T00:00:00.000Z' } as T;
      }
      return { quick_check: 'ok' } as T;
    };

    await attachOffDump(db);

    expect(executedSql).toEqual([]);
  });

  it('keeps local update errors visible and does not suppress the next retry', async () => {
    jest
      .mocked(checkForUpdate)
      .mockRejectedValue(new Error('attempt to write a readonly database'));

    await expect(forceRefreshOffDump(createDb())).rejects.toThrow(
      'attempt to write a readonly database',
    );
    expect(executedRuns.map(({ params }) => params?.[0])).toEqual(['off_dump_last_error']);
  });

  it('teilt parallele Initialisierungen pro Datenbankverbindung', async () => {
    jest.mocked(checkForUpdate).mockResolvedValue({ kind: 'up-to-date' });

    const db = createDb();
    const firstInitialization = initOffDump(db);
    const secondInitialization = initOffDump(db);

    expect(secondInitialization).toBe(firstInitialization);

    await Promise.all([firstInitialization, secondInitialization]);

    expect(reconcileOnStart).toHaveBeenCalledTimes(1);
    expect(executedSql).toEqual(["ATTACH DATABASE '/documents/off-dump-v2.db' AS off_dump KEY ''"]);
  });

  it('returns false when the active dump file is absent', async () => {
    mockFileExists = false;

    await expect(attachOffDump(createDb())).resolves.toBe(false);
    expect(executedSql).toEqual([]);
  });

  it('treats an already-in-use alias as attached and rethrows other attach errors', async () => {
    mockAttachPlaintextDatabase.mockRejectedValueOnce(
      new Error('database off_dump is already in use'),
    );
    await expect(attachOffDump(createDb())).resolves.toBe(true);

    resetOffDumpAttachment();
    mockAttachPlaintextDatabase.mockRejectedValueOnce(new Error('disk is readonly'));
    await expect(attachOffDump(createDb())).rejects.toThrow('disk is readonly');
  });
});

describe('off-dump status and integrity', () => {
  it('reports an absent dump without inspecting the file', async () => {
    mockFileExists = false;
    const status = await getOffDumpStatus(
      createDb([], {
        metadata: {
          off_dump_last_check_at: '2026-10-11T09:00:00.000Z',
          off_dump_last_successful_update_at: '2026-10-10T09:00:00.000Z',
          off_dump_last_error: 'previous failure',
        },
      }),
    );

    expect(status).toEqual({
      attached: false,
      fileExists: false,
      fileSizeBytes: 0,
      schemaVersion: null,
      dataVersion: null,
      lastCheckAt: '2026-10-11T09:00:00.000Z',
      lastSuccessfulUpdateAt: '2026-10-10T09:00:00.000Z',
      lastError: 'previous failure',
    });
    expect(mockFileOps.inspectDump).not.toHaveBeenCalled();
  });

  it('uses active-connection metadata when the dump is already attached', async () => {
    const status = await getOffDumpStatus(
      createDb(['off_dump'], {
        attachedMeta: { schema_version: 7, data_version: 'v7' },
        quickCheck: { quick_check: 'ok' },
        metadata: { off_dump_last_error: '' },
      }),
    );

    expect(status).toEqual({
      attached: true,
      fileExists: true,
      fileSizeBytes: 123,
      schemaVersion: 7,
      dataVersion: 'v7',
      lastCheckAt: null,
      lastSuccessfulUpdateAt: null,
      lastError: null,
    });
    expect(mockFileOps.inspectDump).not.toHaveBeenCalled();
  });

  it('falls back to file inspection and reports failed integrity checks', async () => {
    mockFileOps.inspectDump.mockResolvedValueOnce({
      schemaVersion: 3,
      dataVersion: 'v3',
      integrityOk: false,
    });
    const db = createDb();

    await expect(checkOffDumpIntegrity(db)).resolves.toBe(false);
    expect(mockFileOps.inspectDump).toHaveBeenCalledWith('/documents/off-dump-v2.db');
  });
});

describe('off-dump update operations', () => {
  const manifest = {
    schemaVersion: 3,
    latestVersion: 'v3',
    baseline: {
      url: 'https://example.test/baseline.db',
      size: 10,
      checksum: 'checksum',
      version: 'v3',
    },
    patches: [],
  };

  it('maps an unavailable manifest to the user-facing refresh error', async () => {
    jest.mocked(checkForUpdate).mockResolvedValue({ kind: 'manifest-unavailable' });

    await expect(forceRefreshOffDump(createDb())).rejects.toThrow('Kein Manifest gefunden');
  });

  it('records failed baseline updates and maps them to the user-facing error', async () => {
    jest.mocked(checkForUpdate).mockResolvedValue({ kind: 'baseline-failed' });
    const db = createDb();

    await expect(forceRefreshOffDump(db)).rejects.toThrow('Baseline-Installation fehlgeschlagen');
    expect(executedRuns.map(({ params }) => params?.[0])).toContain('off_dump_last_error');
  });

  it('records a successful patch and reattaches the updated dump', async () => {
    jest.mocked(checkForUpdate).mockResolvedValue({ kind: 'patched', dataVersion: 'v3' });

    await expect(forceRefreshOffDump(createDb())).resolves.toEqual({
      kind: 'patched',
      dataVersion: 'v3',
    });
    expect(mockAttachPlaintextDatabase).toHaveBeenCalledWith(
      expect.anything(),
      '/documents/off-dump-v2.db',
      'off_dump',
      'sqlcipher',
    );
    expect(executedRuns.map(({ params }) => params?.[0])).toEqual([
      'off_dump_last_check_at',
      'off_dump_last_successful_update_at',
      'off_dump_last_error',
    ]);
  });

  it('reinstalls a manifest baseline and maps manifest or installer failures', async () => {
    await expect(reinstallOffDumpBaseline(createDb())).rejects.toThrow('Kein Manifest gefunden');

    mockFetchManifest.mockResolvedValueOnce(manifest);
    mockInstallBaseline.mockResolvedValueOnce({ ok: false, reason: 'checksum_mismatch' });
    await expect(reinstallOffDumpBaseline(createDb())).rejects.toThrow(
      'Baseline-Installation fehlgeschlagen',
    );

    mockFetchManifest.mockResolvedValueOnce(manifest);
    mockInstallBaseline.mockResolvedValueOnce({ ok: true, dataVersion: 'v3' });
    await expect(reinstallOffDumpBaseline(createDb())).resolves.toEqual({
      kind: 'baseline-installed',
      dataVersion: 'v3',
    });
    expect(mockInstallBaseline).toHaveBeenCalledWith(
      expect.anything(),
      mockFileOps,
      expect.objectContaining({
        downloadUrl: manifest.baseline.url,
        expectedChecksum: manifest.baseline.checksum,
        expectedSchemaVersion: 3,
        attachmentMode: 'sqlcipher',
      }),
    );
  });
});
