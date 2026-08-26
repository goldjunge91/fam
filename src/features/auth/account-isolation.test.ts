import { QueryClient } from '@tanstack/react-query';
import type { MMKV } from 'react-native-mmkv';

import { clearLocalAccountData } from '@/features/auth/sign-out';
import {
  listFavoriteRecipeKeys,
  readStoredRecipeRating,
  setStoredRecipeFavorite,
  writeStoredRecipeRating,
} from '@/features/recipes/recipe-preferences-repository';
import { createDrizzleDatabase, type DrizzleDatabase } from '@/lib/db/drizzle-driver';
import { getBrochurePostalCode, setBrochurePostalCode } from '@/lib/storage/account-preferences';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

const mockGetDrizzleDatabase = jest.fn<Promise<DrizzleDatabase>, []>();
const mockDeleteLocalDatabase = jest.fn<Promise<void>, []>();
const mockSetActiveUserId = jest.fn();
const mockGetEncryptedAccountStorage = jest.fn<Promise<MMKV>, [string]>();
const mockDeleteEncryptedAccountStorage = jest.fn<Promise<void>, [string]>();

jest.mock('@/lib/db/client', () => ({
  getDrizzleDatabase: () => mockGetDrizzleDatabase(),
  deleteLocalDatabase: () => mockDeleteLocalDatabase(),
  setActiveUserId: (...args: unknown[]) => mockSetActiveUserId(...args),
}));

jest.mock('@/lib/storage/account-storage', () => ({
  getEncryptedAccountStorage: (userId: string) => mockGetEncryptedAccountStorage(userId),
  deleteEncryptedAccountStorage: (userId: string) => mockDeleteEncryptedAccountStorage(userId),
  forgetLocalAccountUserId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/query-client', () => ({
  removeLegacyPersistedQueryCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/sync/account-sync-gate', () => ({
  stopAccountSyncAndWait: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/auth/local-account-cache', () => ({
  resetLocalAccountModuleCaches: jest.fn(),
}));

jest.mock('@/features/household/active-household-store', () => ({
  setStoredActiveHouseholdId: jest.fn().mockResolvedValue(undefined),
}));

type FakeAccountStorage = MMKV & { values: Map<string, string> };

function createFakeAccountStorage(): FakeAccountStorage {
  const values = new Map<string, string>();
  return {
    values,
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => values.set(key, value),
    remove: (key: string) => values.delete(key),
  } as unknown as FakeAccountStorage;
}

describe('lokale Account-Isolation', () => {
  let rawDatabase: TestDatabase;
  let drizzleDatabase: DrizzleDatabase;
  const storages = new Map<string, FakeAccountStorage>();

  async function openFreshDatabase(): Promise<void> {
    rawDatabase = createTestDatabase();
    await rawDatabase.execAsync(`
      create table local_recipe_preferences (
        user_id text not null,
        recipe_key text not null,
        is_favorite integer not null default 0,
        rating integer,
        note text,
        updated_at integer not null,
        primary key (user_id, recipe_key)
      )
    `);
    drizzleDatabase = createDrizzleDatabase(rawDatabase);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    storages.clear();
    await openFreshDatabase();
    mockGetDrizzleDatabase.mockImplementation(async () => drizzleDatabase);
    mockGetEncryptedAccountStorage.mockImplementation(async (userId) => {
      const storage = storages.get(userId) ?? createFakeAccountStorage();
      storages.set(userId, storage);
      return storage;
    });
    mockDeleteEncryptedAccountStorage.mockImplementation(async (userId) => {
      storages.delete(userId);
    });
    mockDeleteLocalDatabase.mockImplementation(async () => {
      rawDatabase.close();
      await openFreshDatabase();
    });
  });

  afterEach(() => {
    rawDatabase.close();
  });

  it('zeigt Nutzer B nach Logout von A weder Favorit, Notiz noch PLZ von A', async () => {
    await setStoredRecipeFavorite('user-a', 'recipe:pasta', true);
    await writeStoredRecipeRating('user-a', 'recipe:pasta', 9, 'Familienfavorit', 123);
    await setBrochurePostalCode('user-a', '10115');

    await expect(listFavoriteRecipeKeys('user-a')).resolves.toEqual(['recipe:pasta']);
    await expect(readStoredRecipeRating('user-a', 'recipe:pasta')).resolves.toMatchObject({
      score: 9,
      note: 'Familienfavorit',
    });
    await expect(getBrochurePostalCode('user-a')).resolves.toBe('10115');

    await clearLocalAccountData(new QueryClient(), 'user-a');

    await expect(listFavoriteRecipeKeys('user-b')).resolves.toEqual([]);
    await expect(readStoredRecipeRating('user-b', 'recipe:pasta')).resolves.toBeNull();
    await expect(getBrochurePostalCode('user-b')).resolves.toBeNull();
    expect(storages.has('user-a')).toBe(false);
  });
});
