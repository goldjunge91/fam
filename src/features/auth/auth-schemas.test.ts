import {
  fieldErrors,
  newPasswordSchema,
  profileSchema,
  signInSchema,
  signUpSchema,
} from '@/features/auth/auth-schemas';

describe('signInSchema', () => {
  it('normalisiert die E-Mail auf Kleinbuchstaben und ohne Leerzeichen', () => {
    const result = signInSchema.parse({ email: '  Alice@Example.DE ', password: 'egal' });
    expect(result.email).toBe('alice@example.de');
  });

  it.each(['kein-at-zeichen', 'a@', '@example.de', ''])(
    'lehnt die ungueltige Adresse %p ab',
    (email) => {
      expect(signInSchema.safeParse({ email, password: 'egal' }).success).toBe(false);
    },
  );

  it('prueft beim Login nur, dass ein Passwort da ist', () => {
    // Wer sein altes, kuerzeres Passwort eingibt, soll die Serverantwort
    // bekommen ("falsche Zugangsdaten") — nicht faelschlich hoeren, sein
    // Passwort sei zu kurz.
    expect(signInSchema.safeParse({ email: 'a@b.de', password: 'kurz' }).success).toBe(true);
    expect(signInSchema.safeParse({ email: 'a@b.de', password: '' }).success).toBe(false);
  });
});

describe('signUpSchema', () => {
  const gueltig = {
    email: 'alice@example.de',
    password: 'langgenug1',
    passwordConfirmation: 'langgenug1',
  };

  it('akzeptiert eine vollstaendige, stimmige Eingabe', () => {
    expect(signUpSchema.safeParse(gueltig).success).toBe(true);
  });

  it('verlangt mindestens 8 Zeichen', () => {
    const result = signUpSchema.safeParse({
      ...gueltig,
      password: 'sieben7',
      passwordConfirmation: 'sieben7',
    });
    expect(result.success).toBe(false);
  });

  it('meldet abweichende Passwoerter am Bestaetigungsfeld, nicht am ersten', () => {
    // Sonst zeigt die UI den Fehler beim bereits korrekt eingegebenen Passwort.
    const result = signUpSchema.safeParse({ ...gueltig, passwordConfirmation: 'anders12' });
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(fieldErrors(result.error)).toEqual({
      passwordConfirmation: 'Die Passwörter stimmen nicht überein.',
    });
  });

  it('begrenzt die Laenge auf 72 Zeichen', () => {
    // bcrypt schneidet darueber hinaus ab; ein laengeres Passwort waere trueglich.
    const zuLang = 'x'.repeat(73);
    expect(
      signUpSchema.safeParse({
        ...gueltig,
        password: zuLang,
        passwordConfirmation: zuLang,
      }).success,
    ).toBe(false);
  });
});

describe('newPasswordSchema', () => {
  it('verlangt Uebereinstimmung', () => {
    expect(
      newPasswordSchema.safeParse({ password: 'langgenug1', passwordConfirmation: 'x' }).success,
    ).toBe(false);
  });
});

describe('profileSchema', () => {
  it('akzeptiert ein vollstaendig leeres Profil', () => {
    // Das Onboarding ist ueberspringbar; die App muss ohne diese Angaben
    // funktionieren und das Kalorienziel spaeter ehrlich als nicht berechenbar
    // melden.
    expect(profileSchema.safeParse({}).success).toBe(true);
  });

  it('lehnt ein Geburtsdatum in der Zukunft ab', () => {
    const morgen = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(profileSchema.safeParse({ birthDate: morgen }).success).toBe(false);
  });

  it('akzeptiert ein Geburtsdatum in der Vergangenheit', () => {
    expect(profileSchema.safeParse({ birthDate: '1991-04-12' }).success).toBe(true);
  });

  it('besteht auf dem Format JJJJ-MM-TT', () => {
    expect(profileSchema.safeParse({ birthDate: '12.04.1991' }).success).toBe(false);
  });

  it.each([0, -5, 300, 1000])('lehnt die unplausible Groesse %p ab', (heightCm) => {
    expect(profileSchema.safeParse({ heightCm }).success).toBe(false);
  });

  it('akzeptiert eine plausible Groesse', () => {
    expect(profileSchema.safeParse({ heightCm: 178 }).success).toBe(true);
  });

  it('laesst nur die Werte zu, die auch die Datenbank kennt', () => {
    // Die Check-Constraints auf public.profiles erlauben genau diese Werte;
    // liefen sie auseinander, schluege erst der Insert fehl.
    expect(profileSchema.safeParse({ sex: 'divers' }).success).toBe(false);
    expect(profileSchema.safeParse({ activityLevel: 'extrem' }).success).toBe(false);
    expect(profileSchema.safeParse({ sex: 'female', activityLevel: 'moderate' }).success).toBe(
      true,
    );
  });
});

describe('fieldErrors', () => {
  it('gibt je Feld genau eine Meldung zurueck', () => {
    const result = signUpSchema.safeParse({
      email: 'kaputt',
      password: 'x',
      passwordConfirmation: 'y',
    });
    expect(result.success).toBe(false);
    if (result.success) return;

    const errors = fieldErrors(result.error);
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['email', 'password']));
    for (const message of Object.values(errors)) {
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    }
  });
});
