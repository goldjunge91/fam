import type { SqlDatabase } from '@/lib/db/types';
import { createExpoFileOps as createSharedExpoFileOps } from './expo-file-ops';
import { createExpoFileOps as createAndroidExpoFileOps } from './expo-file-ops.android';
import { attachPlaintextDatabase } from './plaintext-attachment';

type MockFile = {
  uri: string;
  exists: boolean;
  size: number | undefined;
  move: jest.Mock;
  delete: jest.Mock;
  info: jest.Mock;
};

const mockFiles: MockFile[] = [];
const mockDownloadAsync = jest.fn();
const mockCancelDownload = jest.fn(async () => undefined);
const mockCreateDownloadResumable = jest.fn(
  (_url: string, _fileUri: string, _options?: { sessionType: number }) => ({
    cancelAsync: mockCancelDownload,
    downloadAsync: mockDownloadAsync,
  }),
);
const mockExecAsync = jest.fn(async (..._args: unknown[]) => undefined);
const mockGetFirstAsync = jest.fn();
let mockNextFileExists = true;
let mockFileSize: number | undefined = 42;
let mockFileMd5: string | null = 'a'.repeat(32);

jest.mock('expo-file-system', () => {
  const fileConstructor = jest.fn().mockImplementation((uri: string) => {
    const exists = mockNextFileExists;
    mockNextFileExists = true;
    const file: MockFile = {
      uri,
      exists,
      size: mockFileSize,
      move: jest.fn(),
      delete: jest.fn(),
      info: jest.fn(() => ({ md5: mockFileMd5 })),
    };
    mockFiles.push(file);
    return file;
  });
  return { File: fileConstructor };
});

jest.mock('expo-file-system/legacy', () => ({
  FileSystemSessionType: { FOREGROUND: 1 },
  createDownloadResumable: (url: string, fileUri: string, options?: { sessionType: number }) =>
    mockCreateDownloadResumable(url, fileUri, options),
}));

jest.mock('./plaintext-attachment', () => ({ attachPlaintextDatabase: jest.fn() }));

const variants = [
  { name: 'shared file operations', create: createSharedExpoFileOps, android: false },
  { name: 'Android file operations', create: createAndroidExpoFileOps, android: true },
] as const;

function createDatabase(): SqlDatabase {
  return {
    execAsync: (...args) => mockExecAsync(...args),
    runAsync: async () => ({ changes: 0, lastInsertRowId: 0 }),
    getAllAsync: async <T>() => [] as T[],
    getFirstAsync: async <T>(...args: unknown[]) => (await mockGetFirstAsync(...args)) as T | null,
    withExclusiveTransactionAsync: async () => undefined,
  };
}

describe.each(variants)('$name', ({ create, android }) => {
  beforeEach(() => {
    mockFiles.length = 0;
    mockNextFileExists = true;
    mockFileSize = 42;
    mockFileMd5 = 'a'.repeat(32);
    mockCreateDownloadResumable.mockClear();
    mockDownloadAsync.mockReset().mockResolvedValue({ uri: '/downloaded' });
    mockCancelDownload.mockReset().mockResolvedValue(undefined);
    mockExecAsync.mockReset().mockResolvedValue(undefined);
    mockGetFirstAsync.mockReset();
    jest.mocked(attachPlaintextDatabase).mockReset();
  });

  it('wraps native file operations and validates MD5 availability', async () => {
    const operations = create(createDatabase());
    const expectedFileUri = android ? 'file:///tmp/dump.db' : '/tmp/dump.db';

    await expect(operations.exists('/tmp/dump.db')).resolves.toBe(true);
    expect(mockFiles.at(-1)?.uri).toBe(expectedFileUri);

    mockFileSize = undefined;
    await expect(operations.size('/tmp/dump.db')).resolves.toBe(0);

    await operations.download('https://example.test/dump.db', '/tmp/dump.db');
    if (android) {
      expect(mockCreateDownloadResumable).toHaveBeenCalledWith(
        'https://example.test/dump.db',
        expectedFileUri,
        undefined,
      );
    } else {
      expect(mockCreateDownloadResumable).toHaveBeenCalledWith(
        'https://example.test/dump.db',
        expectedFileUri,
        { sessionType: 1 },
      );
    }
    expect(mockDownloadAsync).toHaveBeenCalledTimes(1);

    await operations.move('/tmp/source.db', '/tmp/target.db');
    const [source, destination] = mockFiles.slice(-2);
    expect(source.move).toHaveBeenCalledWith(destination);

    mockNextFileExists = false;
    await operations.delete('/tmp/missing.db');
    expect(mockFiles.at(-1)?.delete).not.toHaveBeenCalled();
    await operations.delete('/tmp/present.db');
    expect(mockFiles.at(-1)?.delete).toHaveBeenCalledTimes(1);

    await expect(operations.checksum('/tmp/dump.db')).resolves.toBe('a'.repeat(32));
    mockFileMd5 = null;
    await expect(operations.checksum('/tmp/dump.db')).rejects.toThrow('MD5-Prüfsumme');
  });

  it('cancels a native download when the lifecycle signal aborts', async () => {
    let finishDownload: ((result: { uri: string } | undefined) => void) | undefined;
    mockDownloadAsync.mockReturnValueOnce(
      new Promise<{ uri: string } | undefined>((resolve) => {
        finishDownload = resolve;
      }),
    );
    mockCancelDownload.mockImplementationOnce(async () => {
      finishDownload?.(undefined);
    });
    const operations = create(createDatabase());
    const controller = new AbortController();
    const pending = operations.download(
      'https://example.test/dump.db',
      '/tmp/dump.db',
      controller.signal,
    );

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      name: 'AbortError',
      message: 'OFF-Dump-Vorgang wurde angehalten.',
    });
    expect(mockCancelDownload).toHaveBeenCalledTimes(1);
  });

  it('inspects dump metadata and always detaches after a successful attach', async () => {
    const db = createDatabase();
    const inspector = create(db);
    jest.mocked(attachPlaintextDatabase).mockResolvedValue(undefined);
    mockGetFirstAsync
      .mockResolvedValueOnce({ schema_version: 8, data_version: 'v8' })
      .mockResolvedValueOnce({ quick_check: 'ok', secondary_check: 'ok' });

    await expect(inspector.inspectDump('/tmp/dump.db')).resolves.toEqual({
      schemaVersion: 8,
      dataVersion: 'v8',
      integrityOk: true,
    });
    expect(attachPlaintextDatabase).toHaveBeenCalledWith(
      db,
      '/tmp/dump.db',
      expect.stringMatching(/^off_dump_inspect_[a-z0-9]+$/),
      'sqlcipher',
    );
    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^DETACH DATABASE off_dump_inspect_[a-z0-9]+$/),
    );

    mockNextFileExists = true;
    mockGetFirstAsync
      .mockResolvedValueOnce({ schema_version: 8, data_version: 'v8' })
      .mockResolvedValueOnce({ quick_check: 'corrupt' });
    await expect(inspector.inspectDump('/tmp/corrupt.db')).resolves.toEqual({
      schemaVersion: 8,
      dataVersion: 'v8',
      integrityOk: false,
    });
  });

  it('returns null for absent, unattached, invalid, and unreadable dumps', async () => {
    const db = createDatabase();
    const inspector = create(db);

    mockNextFileExists = false;
    await expect(inspector.inspectDump('/tmp/missing.db')).resolves.toBeNull();
    expect(attachPlaintextDatabase).not.toHaveBeenCalled();

    mockNextFileExists = true;
    jest.mocked(attachPlaintextDatabase).mockRejectedValueOnce(new Error('attach failed'));
    await expect(inspector.inspectDump('/tmp/unattached.db')).resolves.toBeNull();
    expect(mockExecAsync).not.toHaveBeenCalled();

    jest.mocked(attachPlaintextDatabase).mockResolvedValue(undefined);
    mockGetFirstAsync.mockResolvedValueOnce(null);
    await expect(inspector.inspectDump('/tmp/empty.db')).resolves.toBeNull();
    expect(mockExecAsync).toHaveBeenCalledTimes(1);

    mockExecAsync.mockClear();
    mockGetFirstAsync.mockRejectedValueOnce(new Error('read failed'));
    await expect(inspector.inspectDump('/tmp/unreadable.db')).resolves.toBeNull();
    expect(mockExecAsync).toHaveBeenCalledTimes(1);
  });
});
