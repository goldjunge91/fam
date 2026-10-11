import { createExpoDatabaseFileOps as createSharedDatabaseFileOps } from './database-files';
import { createExpoDatabaseFileOps as createAndroidDatabaseFileOps } from './database-files.android';

type MockFile = {
  uri: string;
  exists: boolean;
  delete: jest.Mock;
  move: jest.Mock;
};

const mockFiles: MockFile[] = [];
let mockNextFileExists = true;
let mockPrefixFileUris = false;

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((...parts: string[]) => {
    const joinedPath = parts.join('/');
    const file: MockFile = {
      uri:
        mockPrefixFileUris && !joinedPath.startsWith('file://')
          ? `file://${joinedPath}`
          : joinedPath,
      exists: mockNextFileExists,
      delete: jest.fn(),
      move: jest.fn(async () => undefined),
    };
    mockNextFileExists = true;
    mockFiles.push(file);
    return file;
  }),
}));

const variants = [
  {
    name: 'shared database files',
    create: createSharedDatabaseFileOps,
    expectedDirectory: '/data/sqlite',
    expectedPath: '/data/sqlite/main.db',
  },
  {
    name: 'Android database files',
    create: createAndroidDatabaseFileOps,
    expectedDirectory: 'file:///data/sqlite',
    expectedPath: '/data/sqlite/main.db',
  },
] as const;

describe.each(variants)('$name', ({ create, expectedDirectory, expectedPath }) => {
  beforeEach(() => {
    mockFiles.length = 0;
    mockNextFileExists = true;
    mockPrefixFileUris = false;
    jest.clearAllMocks();
  });

  it('wraps existence, deletion, moves, and native paths', async () => {
    const files = create('/data/sqlite');

    expect(files.exists('main.db')).toBe(true);
    expect(mockFiles.at(-1)?.uri).toBe(`${expectedDirectory}/main.db`);

    mockNextFileExists = false;
    await files.delete('missing.db');
    expect(mockFiles.at(-1)?.delete).not.toHaveBeenCalled();

    await files.delete('old.db');
    expect(mockFiles.at(-1)?.delete).toHaveBeenCalledTimes(1);

    await files.move('old.db', 'new.db');
    const [source, destination] = mockFiles.slice(-2);
    expect(source.move).toHaveBeenCalledWith(destination);

    expect(files.path('main.db')).toBe(expectedPath);
  });

  it('strips a file URI prefix from the returned native path', () => {
    const files = create('/data/sqlite');
    mockPrefixFileUris = true;

    expect(files.path('main.db')).toBe(expectedPath);
  });

  if (create === createAndroidDatabaseFileOps) {
    it('keeps an existing Android file URI without adding another prefix', () => {
      const files = create('file:///data/sqlite');

      expect(files.exists('main.db')).toBe(true);
      expect(mockFiles.at(-1)?.uri).toBe('file:///data/sqlite/main.db');
    });
  }
});
