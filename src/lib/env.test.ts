import { env, isFlagEnabled, MissingEnvError, requireEnv } from '@/lib/env';

describe('requireEnv', () => {
  it('gibt einen gesetzten Wert zurueck', () => {
    expect(requireEnv('EXPO_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')).toBe(
      'http://127.0.0.1:54321',
    );
  });

  it('entfernt umgebende Leerzeichen', () => {
    expect(requireEnv('EXPO_PUBLIC_SUPABASE_KEY', '  sb_publishable_abc  ')).toBe(
      'sb_publishable_abc',
    );
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['leerer String', ''],
    ['nur Leerzeichen', '   '],
  ])('wirft bei %s', (_beschreibung, wert) => {
    expect(() => requireEnv('EXPO_PUBLIC_SUPABASE_URL', wert)).toThrow(MissingEnvError);
  });

  it('nennt die fehlende Variable beim Namen', () => {
    expect(() => requireEnv('EXPO_PUBLIC_SUPABASE_KEY', undefined)).toThrow(
      /EXPO_PUBLIC_SUPABASE_KEY/,
    );
  });

  it('verweist auf supabase status und das README', () => {
    try {
      requireEnv('EXPO_PUBLIC_SUPABASE_URL', undefined);
      throw new Error('haette werfen muessen');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError);
      expect((error as MissingEnvError).message).toContain('supabase status');
      expect((error as MissingEnvError).variableName).toBe('EXPO_PUBLIC_SUPABASE_URL');
    }
  });
});

describe('env.forceOnboarding', () => {
  const originalEnv = process.env.EXPO_PUBLIC_FORCE_ONBOARDING;

  afterEach(() => {
    process.env.EXPO_PUBLIC_FORCE_ONBOARDING = originalEnv;
  });

  it('gibt true zurueck wenn EXPO_PUBLIC_FORCE_ONBOARDING auf true oder 1 gesetzt ist', () => {
    const { env } = require('@/lib/env');
    process.env.EXPO_PUBLIC_FORCE_ONBOARDING = 'true';
    expect(env.forceOnboarding).toBe(true);

    process.env.EXPO_PUBLIC_FORCE_ONBOARDING = '1';
    expect(env.forceOnboarding).toBe(true);
  });

  it('gibt false zurueck wenn EXPO_PUBLIC_FORCE_ONBOARDING nicht true oder 1 ist', () => {
    const { env } = require('@/lib/env');
    process.env.EXPO_PUBLIC_FORCE_ONBOARDING = 'false';
    expect(env.forceOnboarding).toBe(false);

    process.env.EXPO_PUBLIC_FORCE_ONBOARDING = undefined;
    expect(env.forceOnboarding).toBe(false);
  });
});

describe('isFlagEnabled', () => {
  it.each([['true'], ['1'], ['TRUE'], ['  true  ']])('erkennt %s als eingeschaltet', (wert) => {
    expect(isFlagEnabled(wert)).toBe(true);
  });

  it.each([['false'], ['0'], ['ja'], [''], [undefined], [null]])(
    'behandelt %s als ausgeschaltet',
    (wert) => {
      expect(isFlagEnabled(wert as string | undefined | null)).toBe(false);
    },
  );
});

describe('env.devTools', () => {
  const original = process.env.EXPO_PUBLIC_DEV_TOOLS;

  afterEach(() => {
    process.env.EXPO_PUBLIC_DEV_TOOLS = original;
  });

  it('ist ohne gesetzte Variable aus', () => {
    process.env.EXPO_PUBLIC_DEV_TOOLS = undefined;
    expect(env.devTools).toBe(false);
  });

  it('laesst sich unabhaengig vom Onboarding-Schalter einschalten', () => {
    process.env.EXPO_PUBLIC_DEV_TOOLS = 'true';
    process.env.EXPO_PUBLIC_FORCE_ONBOARDING = 'false';
    expect(env.devTools).toBe(true);
    expect(env.forceOnboarding).toBe(false);
  });
});
