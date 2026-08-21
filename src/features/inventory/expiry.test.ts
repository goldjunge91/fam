import { compareByExpiry, getExpiryInfo } from '@/features/inventory/expiry';

// Fester Bezugstag, damit die Tests unabhaengig vom Ausfuehrungszeitpunkt sind.
const HEUTE = new Date(2026, 7, 5, 14, 30); // 5. August 2026, 14:30

const am = (jahr: number, monat: number, tag: number) => new Date(jahr, monat - 1, tag);

describe('getExpiryInfo', () => {
  it('meldet fehlendes MHD, ohne zu raten', () => {
    for (const wert of [null, undefined, '']) {
      const info = getExpiryInfo(wert, HEUTE);
      expect(info.bucket).toBe('none');
      expect(info.daysLeft).toBeNull();
    }
  });

  it('behandelt ein unparsbares Datum wie ein fehlendes', () => {
    expect(getExpiryInfo('kein-datum', HEUTE).bucket).toBe('none');
  });

  it('stuft ein heute ablaufendes Produkt als kritisch ein', () => {
    const info = getExpiryInfo(am(2026, 8, 5), HEUTE);
    expect(info.bucket).toBe('critical');
    expect(info.daysLeft).toBe(0);
    expect(info.label).toBe('läuft heute ab');
  });

  it('zaehlt Kalendertage, nicht 24-Stunden-Abschnitte', () => {
    // Bezugszeit ist 14:30. Ein MHD am Folgetag um 00:00 ist rechnerisch nur
    // 9,5 Stunden entfernt — fachlich aber genau ein Tag.
    expect(getExpiryInfo(am(2026, 8, 6), HEUTE).daysLeft).toBe(1);
  });

  it('erkennt abgelaufene Produkte und formuliert gestern gesondert', () => {
    expect(getExpiryInfo(am(2026, 8, 4), HEUTE).label).toBe('seit gestern abgelaufen');
    expect(getExpiryInfo(am(2026, 8, 1), HEUTE).label).toBe('seit 4 Tagen abgelaufen');
    expect(getExpiryInfo(am(2026, 8, 1), HEUTE).bucket).toBe('expired');
  });

  it.each([
    [am(2026, 8, 6), 'critical', 1],
    [am(2026, 8, 8), 'critical', 3],
    [am(2026, 8, 9), 'soon', 4],
    [am(2026, 8, 12), 'soon', 7],
    [am(2026, 8, 13), 'ok', 8],
  ])('grenzt die Stufen sauber ab: %s', (datum, erwarteteStufe, erwarteteTage) => {
    const info = getExpiryInfo(datum as Date, HEUTE);
    expect(info.bucket).toBe(erwarteteStufe);
    expect(info.daysLeft).toBe(erwarteteTage);
  });

  it('nutzt Farbe nie als einzigen Informationstraeger', () => {
    // Jede Stufe muss einen lesbaren Text mitliefern.
    for (const datum of [am(2026, 8, 1), am(2026, 8, 5), am(2026, 8, 9), am(2026, 8, 30)]) {
      expect(getExpiryInfo(datum, HEUTE).label.length).toBeGreaterThan(0);
    }
  });
});

describe('compareByExpiry', () => {
  it('sortiert dringend vor unkritisch und ohne MHD ans Ende', () => {
    const daten = [
      am(2026, 8, 30), // ok
      null, // ohne MHD
      am(2026, 8, 1), // abgelaufen
      am(2026, 8, 6), // kritisch
      am(2026, 8, 10), // bald
    ];

    const sortiert = daten
      .map((d) => getExpiryInfo(d, HEUTE))
      .sort(compareByExpiry)
      .map((i) => i.bucket);

    expect(sortiert).toEqual(['expired', 'critical', 'soon', 'ok', 'none']);
  });

  it('sortiert innerhalb einer Stufe nach Datum', () => {
    const a = getExpiryInfo(am(2026, 8, 8), HEUTE);
    const b = getExpiryInfo(am(2026, 8, 6), HEUTE);
    expect([a, b].sort(compareByExpiry).map((i) => i.daysLeft)).toEqual([1, 3]);
  });
});
