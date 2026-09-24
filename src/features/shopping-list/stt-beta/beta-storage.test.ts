import type { MMKV } from 'react-native-mmkv';
import {
  BETA_STORAGE_KEY,
  clearNaturalLanguageAdditionBetaState,
  getNaturalLanguageAdditionBetaState,
  saveNaturalLanguageAdditionBetaState,
} from './beta-storage';
import { getNameCorrections, NAME_CORRECTIONS_KEY, updateNameCorrection } from './name-corrections';
import type { BetaStorageState } from './types';

const valuesByUser = new Map<string, Map<string, string>>();
const removeCalls: string[] = [];
const mockGetEncryptedAccountStorage = jest.fn<
  Promise<Pick<MMKV, 'getString' | 'set' | 'remove'>>,
  [string]
>();

jest.mock('@/lib/storage/local-account-storage', () => ({
  getEncryptedAccountStorage: (userId: string) => mockGetEncryptedAccountStorage(userId),
}));

function createStorage(userId: string): Pick<MMKV, 'getString' | 'set' | 'remove'> {
  const values = valuesByUser.get(userId) ?? new Map<string, string>();
  valuesByUser.set(userId, values);

  return {
    getString: (key: string) => values.get(key),
    set: (key: string, value: boolean | string | number | ArrayBuffer) => {
      if (typeof value === 'string') values.set(key, value);
    },
    remove: (key: string) => {
      removeCalls.push(key);
      return values.delete(key);
    },
  };
}

const storedState: BetaStorageState = {
  version: 1,
  session: {
    id: 'session-1',
    source: 'text',
    startedAt: '2026-09-16T10:00:00.000Z',
  },
  learningRules: [
    {
      id: 'rule-1',
      itemName: 'Skyr',
      brand: 'JA',
      targetListId: 'rewe-list',
      confirmationCount: 2,
      createdAt: '2026-09-16T10:00:00.000Z',
      updatedAt: '2026-09-16T10:00:00.000Z',
    },
  ],
  confirmations: [],
  autoAssign: 'unset',
};

mockGetEncryptedAccountStorage.mockImplementation(async (userId) => {
  return createStorage(userId);
});

describe('natural-language addition beta storage', () => {
  beforeEach(() => {
    valuesByUser.clear();
    removeCalls.length = 0;
    mockGetEncryptedAccountStorage.mockClear();
  });

  it('persists state in the encrypted account namespace only', async () => {
    await saveNaturalLanguageAdditionBetaState('user-a', storedState);

    await expect(getNaturalLanguageAdditionBetaState('user-a')).resolves.toEqual(storedState);
    await expect(getNaturalLanguageAdditionBetaState('user-b')).resolves.toMatchObject({
      version: 1,
      session: null,
    });
    expect(mockGetEncryptedAccountStorage).toHaveBeenCalledWith('user-a');
    expect(valuesByUser.get('user-a')?.has(BETA_STORAGE_KEY)).toBe(true);
  });

  it('remembers, replaces and forgets corrections only in the selected account', async () => {
    await saveNaturalLanguageAdditionBetaState('user-a', storedState);
    await updateNameCorrection('user-a', 'Ski er', 'Skyr');
    await updateNameCorrection('user-b', 'Ski er', 'Skyr');
    await updateNameCorrection('user-a', '  SKI   ER ', 'Skyr natur');
    await expect(getNameCorrections('user-a')).resolves.toEqual([
      { original: 'SKI   ER', corrected: 'Skyr natur' },
    ]);
    await updateNameCorrection('user-a', 'ski er', null);
    await expect(getNameCorrections('user-a')).resolves.toEqual([]);
    await expect(getNameCorrections('user-b')).resolves.toEqual([
      { original: 'Ski er', corrected: 'Skyr' },
    ]);
    await expect(getNaturalLanguageAdditionBetaState('user-a')).resolves.toEqual(storedState);
  });

  it('ignores damaged correction storage and rejects empty replacements', async () => {
    createStorage('user-a').set(NAME_CORRECTIONS_KEY, '{broken');
    await expect(getNameCorrections('user-a')).resolves.toEqual([]);
    await expect(updateNameCorrection('user-a', 'Ski er', ' ')).rejects.toThrow();
    createStorage('user-a').set(
      NAME_CORRECTIONS_KEY,
      JSON.stringify([
        { original: 'Ski er', corrected: 'Skyr' },
        { original: 'invalid', corrected: 3 },
      ]),
    );
    await expect(getNameCorrections('user-a')).resolves.toEqual([
      { original: 'Ski er', corrected: 'Skyr' },
    ]);
  });

  it('normalizes a V1 snapshot created before automatic assignment existed', async () => {
    const storage = createStorage('user-legacy');
    const legacyState = {
      ...storedState,
      autoAssign: undefined,
      consent: {
        automaticApplication: 'undecided' as const,
      },
    };
    storage.set(BETA_STORAGE_KEY, JSON.stringify(legacyState));

    await expect(getNaturalLanguageAdditionBetaState('user-legacy')).resolves.toMatchObject({
      autoAssign: 'unset',
    });
    expect(removeCalls).toEqual([]);
  });

  it('clears only the selected account state', async () => {
    await saveNaturalLanguageAdditionBetaState('user-a', storedState);
    await saveNaturalLanguageAdditionBetaState('user-b', storedState);

    await clearNaturalLanguageAdditionBetaState('user-a');

    await expect(getNaturalLanguageAdditionBetaState('user-a')).resolves.toMatchObject({
      session: null,
    });
    await expect(getNaturalLanguageAdditionBetaState('user-b')).resolves.toEqual(storedState);
    expect(removeCalls).toEqual([BETA_STORAGE_KEY]);
  });

  it('recovers from malformed local state without leaking it to the workflow', async () => {
    const storage = createStorage('user-corrupt');
    storage.set(BETA_STORAGE_KEY, '{malformed');

    await expect(getNaturalLanguageAdditionBetaState('user-corrupt')).resolves.toMatchObject({
      version: 1,
      session: null,
      learningRules: [],
    });
    expect(removeCalls).toEqual([BETA_STORAGE_KEY]);
  });
});
