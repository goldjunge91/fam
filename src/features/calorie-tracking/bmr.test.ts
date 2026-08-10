import {
  calculateAgeYears,
  calculateBmr,
  harrisBenedictBmr,
  mifflinStJeorBmr,
} from '@/features/calorie-tracking/bmr';

// Fester Bezugstag, damit die Tests unabhaengig vom Ausfuehrungszeitpunkt sind.
const HEUTE = new Date(2026, 7, 9, 10, 0); // 9. August 2026, 10:00

const am = (jahr: number, monat: number, tag: number, stunde = 12) =>
  new Date(jahr, monat - 1, tag, stunde);

describe('calculateAgeYears', () => {
  it('zaehlt das Alter unveraendert, wenn der Geburtstag heute ist', () => {
    expect(calculateAgeYears(am(1990, 8, 9), HEUTE)).toBe(36);
  });

  it('zaehlt ein Jahr weniger, wenn der Geburtstag noch bevorsteht', () => {
    expect(calculateAgeYears(am(1990, 8, 10), HEUTE)).toBe(35);
  });

  it('zaehlt das laufende Alter, wenn der Geburtstag schon vorbei ist', () => {
    expect(calculateAgeYears(am(1990, 8, 8), HEUTE)).toBe(36);
  });

  it('behandelt einen 29. Februar so, als sei er am 1. Maerz eines Nicht-Schaltjahrs bereits vorbei', () => {
    const geburtstag = am(2000, 2, 29);
    const heuteNichtSchaltjahr = am(2026, 3, 1);
    expect(calculateAgeYears(geburtstag, heuteNichtSchaltjahr)).toBe(26);
  });

  it('haengt nur vom Kalendertag ab, nicht von der Uhrzeit', () => {
    const geburtstagFrueh = new Date(1990, 7, 9, 0, 1);
    const geburtstagSpaet = new Date(1990, 7, 9, 23, 59);
    expect(calculateAgeYears(geburtstagFrueh, HEUTE)).toBe(36);
    expect(calculateAgeYears(geburtstagSpaet, HEUTE)).toBe(36);
  });
});

describe('mifflinStJeorBmr', () => {
  it('berechnet den Referenzwert fuer einen Mann korrekt (80kg, 180cm, 25 Jahre)', () => {
    const bmr = mifflinStJeorBmr({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 25 });
    expect(bmr).toBeCloseTo(1805, 5);
  });

  it('berechnet den Referenzwert fuer eine Frau korrekt (65kg, 165cm, 30 Jahre)', () => {
    const bmr = mifflinStJeorBmr({ sex: 'female', weightKg: 65, heightCm: 165, ageYears: 30 });
    expect(bmr).toBeCloseTo(1370.25, 5);
  });

  it.each([
    [18, 'male' as const],
    [90, 'male' as const],
    [18, 'female' as const],
    [90, 'female' as const],
  ])('liefert bei Grenzaltern (%i, %s) einen endlichen, positiven Wert', (ageYears, sex) => {
    const bmr = mifflinStJeorBmr({ sex, weightKg: 70, heightCm: 170, ageYears });
    expect(Number.isFinite(bmr)).toBe(true);
    expect(bmr).toBeGreaterThan(0);
  });
});

describe('harrisBenedictBmr', () => {
  it('berechnet den Referenzwert fuer einen Mann korrekt (80kg, 180cm, 25 Jahre)', () => {
    const bmr = harrisBenedictBmr({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 25 });
    expect(bmr).toBeCloseTo(1882.017, 2);
  });

  it('berechnet den Referenzwert fuer eine Frau korrekt (65kg, 165cm, 30 Jahre)', () => {
    const bmr = harrisBenedictBmr({ sex: 'female', weightKg: 65, heightCm: 165, ageYears: 30 });
    expect(bmr).toBeCloseTo(1429.918, 2);
  });
});

describe('calculateBmr', () => {
  const vollstaendig = {
    sex: 'male' as const,
    birthDate: am(1990, 8, 9),
    heightCm: 180,
    weightKg: 80,
  };

  it('berechnet mit Mifflin-St-Jeor als Default-Formel', () => {
    const result = calculateBmr(vollstaendig, HEUTE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.formula).toBe('mifflin_st_jeor');
      expect(result.ageYears).toBe(36);
      expect(result.bmrKcal).toBe(
        mifflinStJeorBmr({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 36 }),
      );
    }
  });

  it('berechnet mit Harris-Benedict, wenn explizit angefordert', () => {
    const result = calculateBmr(vollstaendig, HEUTE, 'harris_benedict');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.formula).toBe('harris_benedict');
      expect(result.bmrKcal).toBe(
        harrisBenedictBmr({ sex: 'male', weightKg: 80, heightCm: 180, ageYears: 36 }),
      );
    }
  });

  it('akzeptiert das Geburtsdatum auch als ISO-String', () => {
    const result = calculateBmr({ ...vollstaendig, birthDate: '1990-08-09T12:00:00' }, HEUTE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ageYears).toBe(36);
  });

  it.each([
    ['sex', { ...vollstaendig, sex: null }],
    ['birthDate', { ...vollstaendig, birthDate: null }],
    ['heightCm', { ...vollstaendig, heightCm: null }],
    ['weightKg', { ...vollstaendig, weightKg: null }],
  ])('meldet fehlendes Feld "%s" explizit, statt zu raten', (feld, input) => {
    const result = calculateBmr(input, HEUTE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('incomplete_profile');
      expect(result.missingFields).toEqual([feld]);
    }
  });

  it('sammelt alle fehlenden Felder, wenn mehrere gleichzeitig fehlen', () => {
    const result = calculateBmr({ sex: null, birthDate: null, heightCm: 180, weightKg: 80 }, HEUTE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingFields).toEqual(['sex', 'birthDate']);
    }
  });
});
