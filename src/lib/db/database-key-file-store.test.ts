import { Platform } from 'react-native';
import {
  createSharedKeyFileStore,
  DATABASE_KEY_CLEANUP_MARKER_KEY,
  DATABASE_KEY_CLEANUP_MARKER_VALUE,
} from './database-key-file-store';

type MockSharedKeyFile = {
  exists: boolean;
  text: jest.Mock<Promise<string>>;
  create: jest.Mock;
  write: jest.Mock;
  delete: jest.Mock;
};

const mockFiles: MockSharedKeyFile[] = [];
let mockHasSharedContainer = true;
let mockNextFileExists = false;
let mockFileText = '';
let mockFileReadFails = false;
let mockFileWriteFails = false;
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => {
    const file: MockSharedKeyFile = {
      exists: mockNextFileExists,
      text: jest.fn(async () => {
        if (mockFileReadFails) throw new Error('read failed');
        return mockFileText;
      }),
      create: jest.fn(),
      write: jest.fn(() => {
        if (mockFileWriteFails) throw new Error('write failed');
      }),
      delete: jest.fn(),
    };
    mockNextFileExists = false;
    mockFiles.push(file);
    return file;
  }),
  Paths: {
    get appleSharedContainers() {
      return mockHasSharedContainer ? { 'group.com.goldjunge91.fam1': '/shared' } : undefined;
    },
  },
}));

function setPlatform(os: string) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

beforeEach(() => {
  mockFiles.length = 0;
  mockHasSharedContainer = true;
  mockNextFileExists = false;
  mockFileText = '';
  mockFileReadFails = false;
  mockFileWriteFails = false;
  jest.clearAllMocks();
});

afterEach(() => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
  }
});

describe('shared SQLCipher key file', () => {
  it('does not access the file system outside iOS or without an app-group container', async () => {
    const store = createSharedKeyFileStore();
    setPlatform('android');

    await expect(store.getItem('key')).resolves.toBeNull();
    await store.setItem('key', 'ab'.repeat(32));
    await store.removeItem('key');
    expect(mockFiles).toHaveLength(0);

    setPlatform('ios');
    mockHasSharedContainer = false;
    await expect(store.getItem('key')).resolves.toBeNull();
    await store.setItem('key', 'ab'.repeat(32));
    await store.removeItem('key');
    expect(mockFiles).toHaveLength(0);
  });

  it('reads only a valid, trimmed hexadecimal key', async () => {
    setPlatform('ios');
    const store = createSharedKeyFileStore();
    mockNextFileExists = true;
    mockFileText = `  ${'ab'.repeat(32)}\n`;
    await expect(store.getItem('key')).resolves.toBe('ab'.repeat(32));

    mockNextFileExists = true;
    mockFileText = 'not-a-key';
    await expect(store.getItem('key')).resolves.toBeNull();

    mockNextFileExists = false;
    await expect(store.getItem('key')).resolves.toBeNull();

    mockNextFileExists = true;
    mockFileReadFails = true;
    await expect(store.getItem('key')).resolves.toBeNull();
  });

  it('never writes key material and keeps the cleanup marker durable', async () => {
    setPlatform('ios');
    const store = createSharedKeyFileStore();

    await store.setItem('fam.database.sqlcipher-key.v1', 'cd'.repeat(32));
    expect(mockFiles).toHaveLength(0);

    mockNextFileExists = false;
    await store.setItem(DATABASE_KEY_CLEANUP_MARKER_KEY, DATABASE_KEY_CLEANUP_MARKER_VALUE);
    expect(mockFiles).toHaveLength(1);
    expect(mockFiles[0]?.create).toHaveBeenCalledWith({ overwrite: true });
    expect(mockFiles[0]?.write).toHaveBeenCalledWith(DATABASE_KEY_CLEANUP_MARKER_VALUE);

    mockNextFileExists = true;
    mockFileText = DATABASE_KEY_CLEANUP_MARKER_VALUE;
    await store.setItem(DATABASE_KEY_CLEANUP_MARKER_KEY, DATABASE_KEY_CLEANUP_MARKER_VALUE);
    expect(mockFiles.at(-1)?.write).not.toHaveBeenCalled();

    mockNextFileExists = true;
    mockFileText = 'unexpected';
    await expect(
      store.setItem(DATABASE_KEY_CLEANUP_MARKER_KEY, DATABASE_KEY_CLEANUP_MARKER_VALUE),
    ).rejects.toThrow('Der SQLCipher-Key-Cleanup-Marker ist ungültig.');

    mockNextFileExists = false;
    mockFileWriteFails = true;
    await expect(
      store.setItem(DATABASE_KEY_CLEANUP_MARKER_KEY, DATABASE_KEY_CLEANUP_MARKER_VALUE),
    ).rejects.toThrow('write failed');

    mockNextFileExists = true;
    await store.removeItem('key');
    expect(mockFiles.at(-1)?.delete).toHaveBeenCalledTimes(1);

    mockNextFileExists = false;
    await store.removeItem('key');
    expect(mockFiles.at(-1)?.delete).not.toHaveBeenCalled();
  });
});
