import { idempotentDeclaredExtensions } from '../../scripts/db-diff';

describe('declarative migration extension normalization', () => {
  it('preserves source idempotence for generated extension statements', () => {
    const migration = 'CREATE EXTENSION "pg_net" SCHEMA "extensions";';

    expect(idempotentDeclaredExtensions(migration, new Set(['pg_net']))).toBe(
      'CREATE EXTENSION IF NOT EXISTS "pg_net" SCHEMA "extensions";',
    );
  });

  it('leaves extension statements alone when the schema source does not declare idempotence', () => {
    const migration = 'CREATE EXTENSION "pg_net" SCHEMA "extensions";';

    expect(idempotentDeclaredExtensions(migration, new Set())).toBe(migration);
  });
});
