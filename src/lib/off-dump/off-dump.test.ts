import type { SqlDatabase, SqlParam } from '@/lib/db/types';
import {
  attachOffDump,
  forceRefreshOffDump,
  initOffDump,
  resetOffDumpAttachment,
} from './off-dump';
import { setOffDumpAttached } from './off-dump-state';
import { checkForUpdate, reconcileOnStart } from './repository';

const executedSql: string[] = [];
const executedRuns: Array<{ params: readonly SqlParam[] | undefined; source: string }> = [];

jest.mock('expo-file-system', () => {
  class MockFile {
    readonly exists = true;
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
  createExpoFileOps: jest.fn(() => ({})),
}));

jest.mock('./repository', () => ({
  checkForUpdate: jest.fn(),
  reconcileOnStart: jest.fn(),
}));

const createDb = (attachedDatabases: readonly string[] = []): SqlDatabase => ({
  execAsync: async (source) => {
    executedSql.push(source);
  },
  getAllAsync: async <T>() => attachedDatabases.map((name) => ({ name }) as T),
  getFirstAsync: async <_T>() => null,
  runAsync: async (source, params) => {
    executedRuns.push({ params, source });
    return { changes: 0, lastInsertRowId: 0 };
  },
  withExclusiveTransactionAsync: async () => undefined,
});

describe('attachOffDump', () => {
  beforeEach(() => {
    executedSql.length = 0;
    executedRuns.length = 0;
    resetOffDumpAttachment();
    jest.mocked(checkForUpdate).mockReset();
    jest.mocked(reconcileOnStart).mockReset();
  });

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
});
