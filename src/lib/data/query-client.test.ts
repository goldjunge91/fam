import { dehydrate, QueryClient } from '@tanstack/react-query';
import type { MMKV } from 'react-native-mmkv';

import { startAccountQueryPersistence } from '@/lib/data/query-client';

const mockGetEncryptedAccountStorage = jest.fn<Promise<MMKV>, [string]>();

jest.mock('@/lib/storage/local-account-storage', () => ({
  getEncryptedAccountStorage: (userId: string) => mockGetEncryptedAccountStorage(userId),
}));

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
    source.clear();
    const client = new QueryClient();

    const unsubscribe = await startAccountQueryPersistence(client, 'user-1');

    expect(mockGetEncryptedAccountStorage).toHaveBeenCalledWith('user-1');
    expect(client.getQueryData(['profile', 'user-1'])).toEqual({ name: 'Marco' });
    unsubscribe();
    client.clear();
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
    client.clear();
  });
});
