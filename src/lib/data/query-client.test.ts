import {
  dehydrate,
  focusManager,
  onlineManager,
  QueryClient,
  type QueryKey,
  type QueryOptions,
} from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, type AppStateStatus } from 'react-native';
import type { MMKV } from 'react-native-mmkv';

import {
  queryClient,
  shouldPersistQuery,
  startAccountQueryPersistence,
  startQueryEnvironmentSync,
} from '@/lib/data/query-client';

const mockGetEncryptedAccountStorage = jest.fn<Promise<MMKV>, [string]>();
const mockReportError = jest.fn();

jest.mock('@/lib/storage/local-account-storage', () => ({
  getEncryptedAccountStorage: (userId: string) => mockGetEncryptedAccountStorage(userId),
}));

jest.mock('@/lib/telemetry', () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
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
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    queryClient.clear();
    onlineManager.setOnline(true);
    jest.restoreAllMocks();
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

  it('persistiert erfolgreiche Modul-Praeferenzen accountgebunden und stellt sie wieder her', async () => {
    const client = new QueryClient();
    const unsubscribe = await startAccountQueryPersistence(client, 'user-1');

    client.setQueryData(['settings', 'module-preferences', 'user-1'], {
      fridge: true,
      shoppingList: false,
      calories: true,
      recipes: true,
      mealPlanner: false,
    });

    const persisted = JSON.parse(jest.mocked(storage.set).mock.calls.at(-1)?.[1] as string);
    expect(persisted.queries).toHaveLength(1);
    expect(persisted.queries[0].queryKey).toEqual(['settings', 'module-preferences', 'user-1']);

    unsubscribe();
    client.clear();

    const restoredClient = new QueryClient();
    const restoredUnsubscribe = await startAccountQueryPersistence(restoredClient, 'user-1');
    expect(restoredClient.getQueryData(['settings', 'module-preferences', 'user-1'])).toEqual({
      fridge: true,
      shoppingList: false,
      calories: true,
      recipes: true,
      mealPlanner: false,
    });

    restoredUnsubscribe();
    restoredClient.clear();
  });

  it('behält den gespeicherten Snapshot bei einem späteren Refetch-Fehler', async () => {
    const client = new QueryClient();
    const unsubscribe = await startAccountQueryPersistence(client, 'user-1');
    const queryKey = ['settings', 'module-preferences', 'user-1'] as const;
    client.setQueryData(queryKey, { fridge: true });
    const persistedBeforeError = jest.mocked(storage.set).mock.calls.at(-1)?.[1];

    const query = client.getQueryCache().find({ queryKey });
    query?.setState({
      status: 'error',
      error: new Error('offline'),
      fetchStatus: 'idle',
    });

    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(jest.mocked(storage.set).mock.calls.at(-1)?.[1]).toBe(persistedBeforeError);
    unsubscribe();
    client.clear();
  });

  it('verwirft einen nicht lesbaren Snapshot und meldet den Wiederherstellungsfehler', async () => {
    values.set('react-query-cache.v1', '{broken json');
    const client = new QueryClient();

    const unsubscribe = await startAccountQueryPersistence(client, 'user-1');

    expect(storage.remove).toHaveBeenCalledWith('react-query-cache.v1');
    expect(mockReportError).toHaveBeenCalledWith(expect.any(SyntaxError), {
      operation: 'query_cache.restore',
    });
    unsubscribe();
    client.clear();
  });

  it('meldet Schreibfehler beim Persistieren, ohne Query-Aufrufer zu werfen', async () => {
    const error = new Error('storage full');
    jest.mocked(storage.set).mockImplementationOnce(() => {
      throw error;
    });
    const client = new QueryClient();
    const unsubscribe = await startAccountQueryPersistence(client, 'user-1');

    expect(() => client.setQueryData(['profile', 'user-1'], { name: 'Marco' })).not.toThrow();
    expect(mockReportError).toHaveBeenCalledWith(error, {
      operation: 'query_cache.persist',
    });
    unsubscribe();
    client.clear();
  });

  it('persistiert nur erfolgreiche Queries mit freigegebenem Schluessel und Zeitstempel', () => {
    const client = new QueryClient();
    const buildQuery = (queryKey: QueryKey) => {
      const options: QueryOptions<unknown, Error, unknown, QueryKey> & { queryKey: QueryKey } = {
        queryKey,
        queryFn: async () => null,
      };
      return client.getQueryCache().build(client, options);
    };
    const pending = buildQuery(['profile', 'pending']);
    const unsupported = buildQuery(['settings', 'other', 'user-1']);
    const missingOwner = buildQuery(['settings', 'module-preferences', 42]);
    client.setQueryData(['profile', 'ready'], { name: 'Marco' });
    const ready = client.getQueryCache().find({ queryKey: ['profile', 'ready'] });

    expect(shouldPersistQuery(pending)).toBe(false);
    expect(shouldPersistQuery(unsupported)).toBe(false);
    expect(shouldPersistQuery(missingOwner)).toBe(false);
    expect(ready && shouldPersistQuery(ready)).toBe(true);

    client.clear();
  });

  it('forwards Query-Fehler nur bei Online-Verbindung und ordnet unbekannte Entities ein', async () => {
    const error = new Error('profile unavailable');
    onlineManager.setOnline(false);

    await expect(
      queryClient.fetchQuery({
        queryKey: ['profile', 'offline-error'],
        queryFn: async () => {
          throw error;
        },
        networkMode: 'always',
        retry: false,
      }),
    ).rejects.toBe(error);
    expect(mockReportError).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    await expect(
      queryClient.fetchQuery({
        queryKey: [],
        queryFn: async () => {
          throw error;
        },
        networkMode: 'always',
        retry: false,
      }),
    ).rejects.toBe(error);

    expect(mockReportError).toHaveBeenCalledWith(error, {
      operation: 'react_query.request',
      entity: 'unknown',
    });
  });

  it('meldet Mutationsfehler mit ihrer Entity', async () => {
    const error = new Error('inventory update failed');
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['inventory', 'update'],
      gcTime: Number.POSITIVE_INFINITY,
      mutationFn: async () => {
        throw error;
      },
    });

    await expect(mutation.execute(undefined)).rejects.toBe(error);
    expect(mockReportError).toHaveBeenCalledWith(error, {
      operation: 'react_query.request',
      entity: 'inventory',
    });
  });

  it('binds app focus and network reachability to React Query and removes listeners', () => {
    let appStateListener: ((status: AppStateStatus) => void) | undefined;
    let networkStateListener: Parameters<typeof Network.addNetworkStateListener>[0] | undefined;
    const appStateSubscription = {
      remove: jest.fn(),
    } as ReturnType<typeof AppState.addEventListener>;
    const networkSubscription = {
      remove: jest.fn(),
    } as ReturnType<typeof Network.addNetworkStateListener>;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appStateListener = listener;
      return appStateSubscription;
    });
    jest.spyOn(Network, 'addNetworkStateListener').mockImplementation((listener) => {
      networkStateListener = listener;
      return networkSubscription;
    });

    const stopSync = startQueryEnvironmentSync();
    const unsubscribeOnline = onlineManager.subscribe(() => {});

    appStateListener?.('background');
    expect(focusManager.isFocused()).toBe(false);
    appStateListener?.('active');
    expect(focusManager.isFocused()).toBe(true);

    networkStateListener?.({ isInternetReachable: false, isConnected: true });
    expect(onlineManager.isOnline()).toBe(false);
    networkStateListener?.({ isConnected: false });
    expect(onlineManager.isOnline()).toBe(false);
    networkStateListener?.({});
    expect(onlineManager.isOnline()).toBe(true);

    unsubscribeOnline();
    stopSync();
    expect(networkSubscription.remove).toHaveBeenCalledTimes(1);
    expect(appStateSubscription.remove).toHaveBeenCalledTimes(1);
  });
});
