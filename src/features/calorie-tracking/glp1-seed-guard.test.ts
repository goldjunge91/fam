import { createSeedId } from '../../../scripts/glp1-seed';
import { assertSafeSeedTarget } from '../../../scripts/glp1-seed-guard';

describe('GLP-1 seed target guard', () => {
  it('allows local Supabase targets', () => {
    expect(() => assertSafeSeedTarget('http://127.0.0.1:54321')).not.toThrow();
    expect(() => assertSafeSeedTarget('http://localhost:54321')).not.toThrow();
  });

  it('rejects non-local targets without an explicit override', () => {
    expect(() => assertSafeSeedTarget('https://project.supabase.co')).toThrow('nicht lokal');
  });

  it('allows a non-local target only with an explicit override', () => {
    expect(() => assertSafeSeedTarget('https://project.supabase.co', true)).not.toThrow();
  });

  it('rejects an invalid target even when the override is set', () => {
    expect(() => assertSafeSeedTarget('not-a-url', true)).toThrow('Ungültige Ziel-URL');
  });

  it('keeps deterministic IDs isolated between target accounts', () => {
    expect(createSeedId('account-a', 'medication', 0)).toBe(
      createSeedId('account-a', 'medication', 0),
    );
    expect(createSeedId('account-a', 'medication', 0)).not.toBe(
      createSeedId('account-b', 'medication', 0),
    );
  });
});
