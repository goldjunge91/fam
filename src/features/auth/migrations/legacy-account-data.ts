import { migrateLegacyRecipePreferences } from '@/features/recipes/data/legacy-recipe-preferences';
import { migrateLegacyBrochurePostalCode } from '@/lib/storage/account-preferences';
import { reportError } from '@/lib/telemetry';

export async function migrateLegacyAccountData(restoredUserId: string | null): Promise<void> {
  const migrations = await Promise.allSettled([
    migrateLegacyBrochurePostalCode(restoredUserId),
    migrateLegacyRecipePreferences(restoredUserId),
  ]);

  const errors: unknown[] = [];
  for (const migration of migrations) {
    if (migration.status === 'rejected') {
      errors.push(migration.reason);
      reportError(migration.reason, {
        operation: 'auth.legacy_data_migration',
        error_code: 'legacy_account_data_migration_failed',
      });
    }
  }

  // Ohne Session ist ein fehlgeschlagener Purge sicherheitsrelevant: Beim
  // nächsten Start dürften dieselben globalen Altwerte sonst einem späteren
  // Login zugeordnet werden. Der SessionProvider bleibt bei diesem Fehler
  // fail-closed und aktiviert weder Account noch SQLite.
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      'Legacy-Accountdaten konnten nicht sicher verarbeitet werden.',
    );
  }
}
