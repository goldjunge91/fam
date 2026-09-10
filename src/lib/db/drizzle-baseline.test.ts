import {
  DRIZZLE_BASELINE_NAME,
  DRIZZLE_MIGRATIONS_TABLE,
  hashMigrationSource,
} from '@/lib/db/drizzle-baseline';
import localMigrations from '../../../drizzle/local/migrations';

describe('Drizzle-Baseline', () => {
  it('verweist auf die einzige gebündelte Vollbaseline', () => {
    expect(Object.keys(localMigrations.migrations)).toEqual([DRIZZLE_BASELINE_NAME]);
    expect(DRIZZLE_MIGRATIONS_TABLE).toBe('__drizzle_migrations');
  });

  it('bildet aus einer Migration einen stabilen Hash', () => {
    expect(hashMigrationSource('migration')).toBe('1a41c301035a106b');
    expect(hashMigrationSource('migration')).toBe(hashMigrationSource('migration'));
    expect(hashMigrationSource('migration')).not.toBe(hashMigrationSource('migration\n'));
  });
});
