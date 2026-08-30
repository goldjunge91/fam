import { getRequiredServiceRoleKey } from '../../scripts/service-role-key';

describe('required Supabase service-role key', () => {
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  });

  it('returns the explicitly configured key without whitespace', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '  local-test-key  ';

    expect(getRequiredServiceRoleKey()).toBe('local-test-key');
  });

  it('rejects an absent key instead of falling back to a committed secret', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => getRequiredServiceRoleKey()).toThrow('SUPABASE_SERVICE_ROLE_KEY fehlt');
  });
});
