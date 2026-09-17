import type { MMKV } from 'react-native-mmkv';
import {
  BETA_STORAGE_KEY,
  clearNaturalLanguageAdditionBetaState,
  getNaturalLanguageAdditionBetaState,
  saveNaturalLanguageAdditionBetaState,
} from './beta-storage';
import type { BetaStorageState } from './types';

const valuesByUser = new Map<string, Map<string, string>>();
const removeCalls: string[] = [];
const mockGetEncryptedAccountStorage = jest.fn<
  Promise<Pick<MMKV, 'getString' | 'set' | 'remove'>>,
  [string]
>();

jest.mock('@/lib/storage/account-storage', () => ({
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
  conflicts: [],
  clarifications: [],
  consent: {
    qualityMetrics: 'undecided',
    contentData: 'undecided',
  },
  feedback: [],
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
