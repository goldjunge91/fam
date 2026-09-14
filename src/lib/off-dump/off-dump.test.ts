import type { SqlDatabase, SqlParam } from '@/lib/db/types';
import { attachOffDump, forceRefreshOffDump, resetOffDumpAttachment } from './off-dump';
import { checkForUpdate } from './repository';

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

const createDb = (): SqlDatabase => ({
  execAsync: async (source) => {
    executedSql.push(source);
  },
  getAllAsync: async <_T>() => [],
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
  });

  it('attaches the active dump writable for in-place patches', async () => {
    await attachOffDump(createDb());

    expect(executedSql).toEqual(["ATTACH DATABASE '/documents/off-dump-v2.db' AS off_dump KEY ''"]);
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
});
