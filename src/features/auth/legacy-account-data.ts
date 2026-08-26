import { migrateLegacyRecipePreferences } from '@/features/recipes/legacy-recipe-preferences';
import { Sentry } from '@/lib/sentry';
import { migrateLegacyBrochurePostalCode } from '@/lib/storage/account-preferences';

/**
 * Einziger Einstieg für globale Altwerte beim App-Upgrade. `restoredUserId`
 * stammt ausschließlich aus dem initialen getSession-Snapshot, niemals aus
 * einem späteren Login.
 */
export async function migrateLegacyAccountData(restoredUserId: string | null): Promise<void> {
  const migrations = await Promise.allSettled([
    migrateLegacyBrochurePostalCode(restoredUserId),
    migrateLegacyRecipePreferences(restoredUserId),
  ]);

  const errors: unknown[] = [];
  for (const migration of migrations) {
    if (migration.status === 'rejected') {
      errors.push(migration.reason);
      Sentry.captureException(migration.reason, {
        tags: { source: 'legacy-account-data-migration' },
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
