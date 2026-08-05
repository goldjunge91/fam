import { MissingEnvError, requireEnv } from '@/lib/env';

describe('requireEnv', () => {
  it('gibt einen gesetzten Wert zurueck', () => {
    expect(requireEnv('EXPO_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')).toBe(
      'http://127.0.0.1:54321',
    );
  });

  it('entfernt umgebende Leerzeichen', () => {
    // Kommt in der Praxis vor, wenn ein Wert aus dem Dashboard kopiert wird.
    expect(requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '  sb_publishable_abc  ')).toBe(
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
    // Der Name muss in der Meldung stehen — sonst weiss niemand, was fehlt.
    expect(() => requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', undefined)).toThrow(
      /EXPO_PUBLIC_SUPABASE_ANON_KEY/,
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
