import { migrateLegacyRecipePreferences } from '@/features/recipes/legacy-recipe-preferences';
import { Sentry } from '@/lib/sentry';
import { migrateLegacyBrochurePostalCode } from '@/lib/storage/account-preferences';
import { migrateLegacyAccountData } from './legacy-account-data';

jest.mock('@/features/recipes/legacy-recipe-preferences', () => ({
  migrateLegacyRecipePreferences: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/storage/account-preferences', () => ({
  migrateLegacyBrochurePostalCode: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/sentry', () => ({
  Sentry: { captureException: jest.fn() },
}));

describe('legacy account data migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gibt nur die initial wiederhergestellte User-ID an jeden einzelnen Migrator weiter', async () => {
    await migrateLegacyAccountData('restored-user');

    expect(migrateLegacyBrochurePostalCode).toHaveBeenCalledWith('restored-user');
    expect(migrateLegacyRecipePreferences).toHaveBeenCalledWith('restored-user');
  });

  it('führt die zweite Migration auch aus, wenn die erste fehlschlägt', async () => {
    const error = new Error('postal migration failed');
    jest.mocked(migrateLegacyBrochurePostalCode).mockRejectedValueOnce(error);

    await expect(migrateLegacyAccountData(null)).rejects.toThrow(
      'Legacy-Accountdaten konnten nicht sicher verarbeitet werden',
    );

    expect(migrateLegacyRecipePreferences).toHaveBeenCalledWith(null);
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { source: 'legacy-account-data-migration' },
    });
  });
});
