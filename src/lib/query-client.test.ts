import AsyncStorage from '@react-native-async-storage/async-storage';
import { dehydrate, QueryClient } from '@tanstack/react-query';
import type { MMKV } from 'react-native-mmkv';

import { removeLegacyPersistedQueryCache, startAccountQueryPersistence } from '@/lib/query-client';
import { reportError } from '@/lib/telemetry';

const mockGetEncryptedAccountStorage = jest.fn<Promise<MMKV>, [string]>();

jest.mock('@/lib/storage/account-storage', () => ({
  getEncryptedAccountStorage: (userId: string) => mockGetEncryptedAccountStorage(userId),
}));

jest.mock('@/lib/telemetry', () => ({
  reportError: jest.fn(),
}));

describe('removeLegacyPersistedQueryCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('entfernt den unverschluesselten Query-Cache alter App-Versionen', async () => {
    await removeLegacyPersistedQueryCache();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@fam/react-query-cache');
  });

  it('meldet einen fehlgeschlagenen Cleanup und reicht den Fehler weiter', async () => {
    const error = new Error('storage unavailable');
    jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(error);

    await expect(removeLegacyPersistedQueryCache()).rejects.toThrow('storage unavailable');
    expect(reportError).toHaveBeenCalledWith(error, {
      operation: 'query_cache.legacy_cleanup',
    });
  });
});

describe('verschluesselte Query-Persistierung', () => {
  const values = new Map<string, string>();
  const storage = {
    getString: jest.fn((key: string) => values.get(key)),
    set: jest.fn((key: string, value: string) => values.set(key, value)),
    remove: jest.fn((key: string) => values.delete(key)),
  } as unknown as MMKV;

  beforeEach(() => {
    jest.clearAllMocks();
    values.clear();
    mockGetEncryptedAccountStorage.mockResolvedValue(storage);
  });

  it('stellt nur den kontogebunden gespeicherten Cache wieder her', async () => {
    const source = new QueryClient();
    source.setQueryData(['profile', 'user-1'], { name: 'Marco' });
    values.set('react-query-cache.v1', JSON.stringify(dehydrate(source)));
    const client = new QueryClient();

    const unsubscribe = await startAccountQueryPersistence(client, 'user-1');

    expect(mockGetEncryptedAccountStorage).toHaveBeenCalledWith('user-1');
    expect(client.getQueryData(['profile', 'user-1'])).toEqual({ name: 'Marco' });
    unsubscribe();
  });

  it('persistiert nur freigegebene Query-Domaenen', async () => {
    const client = new QueryClient();
    const unsubscribe = await startAccountQueryPersistence(client, 'user-1');

    client.setQueryData(['recipes', 'hh-1'], [{ id: 'recipe-1' }]);
    expect(storage.set).not.toHaveBeenCalled();

    client.setQueryData(['profile', 'user-1'], { name: 'Marco' });
    const persisted = JSON.parse(jest.mocked(storage.set).mock.calls.at(-1)?.[1] as string);

    expect(persisted.queries).toHaveLength(1);
    expect(persisted.queries[0].queryKey).toEqual(['profile', 'user-1']);
    unsubscribe();
  });
});
