import { applyUnitTestEnv, UNIT_TEST_ENV } from './unit-test-env';

describe('Unit-Test-Umgebung', () => {
  it('laedt den Vertrag bereits im Jest-Setup', () => {
    expect(process.env.EXPO_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
    expect(process.env.EXPO_PUBLIC_SUPABASE_KEY).toBe('test-supabase-anon-key');
    expect(process.env.EXPO_PUBLIC_FORCE_PREMIUM).toBe('false');
    expect(process.env.EXPO_PUBLIC_DEBUG_LOGS).toBe('false');
  });

  it('ueberschreibt persoenliche Projektwerte mit reproduzierbaren Defaults', () => {
    const environment = {
      NODE_ENV: 'test' as const,
      EXPO_PUBLIC_SUPABASE_URL: 'https://personal-project.supabase.co',
      EXPO_PUBLIC_SUPABASE_KEY: 'personal-key',
      EXPO_PUBLIC_FORCE_PREMIUM: 'true',
      EXPO_PUBLIC_DEBUG_LOGS: 'true',
    };

    applyUnitTestEnv(environment);

    expect(environment).toEqual(expect.objectContaining(UNIT_TEST_ENV));
    expect(environment.EXPO_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
    expect(environment.EXPO_PUBLIC_SUPABASE_KEY).toBe('test-supabase-anon-key');
    expect(environment.EXPO_PUBLIC_FORCE_PREMIUM).toBe('false');
    expect(environment.EXPO_PUBLIC_DEBUG_LOGS).toBe('false');
  });
});
