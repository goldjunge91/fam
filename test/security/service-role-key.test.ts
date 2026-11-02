import { getRequiredServiceRoleKey } from '../../scripts/service-role-key';

describe('required Supabase service-role key', () => {
  const originalKey = process.env.SUPABASE_SECRET_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.SUPABASE_SECRET_KEY;
    } else {
      process.env.SUPABASE_SECRET_KEY = originalKey;
    }
  });

  it('returns the explicitly configured key without whitespace', () => {
    process.env.SUPABASE_SECRET_KEY = '  local-test-key  ';

    expect(getRequiredServiceRoleKey()).toBe('local-test-key');
  });

  it('rejects an absent key instead of falling back to a committed secret', () => {
    delete process.env.SUPABASE_SECRET_KEY;

    expect(() => getRequiredServiceRoleKey()).toThrow('SUPABASE_SECRET_KEY fehlt');
  });
});
