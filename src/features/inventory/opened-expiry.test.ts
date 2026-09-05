import {
  calculateOpenedExpiryDate,
  estimateOpenedExpiryDays,
  getVacuumExpiryDays,
} from './opened-expiry';

const OPENED_AT = new Date(2026, 7, 5, 14, 30);

describe('estimateOpenedExpiryDays', () => {
  it.each([
    ['Salz', 'fridge', 9999],
    ['Gin', 'fridge', 730],
    ['Kaffee', 'pantry', 365],
    ['Sojasauce', 'pantry', 90],
  ])('wendet ortsunabhängige Regeln an: %s', (name, locationKind, expected) => {
    expect(estimateOpenedExpiryDays({ name, locationKind })).toBe(expected);
  });

  it.each([
    ['Brot', 'freezer', 90],
    ['Lachsfilet', 'freezer', 120],
    ['Hackfleisch', 'freezer', 120],
    ['Gemüse-Mix', 'freezer', 270],
    ['Eis', 'freezer', 365],
  ])('wendet Tiefkühler-Regeln an: %s', (name, locationKind, expected) => {
    expect(estimateOpenedExpiryDays({ name, locationKind })).toBe(expected);
  });

  it.each([
    ['Müsli', 'pantry', 60],
    ['Milch', 'pantry', 1],
    ['Karotten', 'pantry', 14],
    ['Pasta', 'pantry', 365],
  ])('wendet Speisekammer-Regeln an: %s', (name, locationKind, expected) => {
    expect(estimateOpenedExpiryDays({ name, locationKind })).toBe(expected);
  });

  it.each([
    ['Frische Milch', 'fridge', 3],
    ['Joghurt', 'fridge', 5],
    ['Mozzarella', 'fridge', 3],
    ['Hartkäse', 'fridge', 28],
    ['Frischer Fisch', 'fridge', 2],
    ['Salat', 'fridge', 4],
  ])('wendet Kühlschrank-Regeln an: %s', (name, locationKind, expected) => {
    expect(estimateOpenedExpiryDays({ name, locationKind })).toBe(expected);
  });

  it('nutzt pro Lagerort einen konservativen Fallback', () => {
    expect(estimateOpenedExpiryDays({ name: 'Unbekannt', locationKind: 'freezer' })).toBe(180);
    expect(estimateOpenedExpiryDays({ name: 'Unbekannt', locationKind: 'pantry' })).toBe(60);
    expect(estimateOpenedExpiryDays({ name: 'Unbekannt', locationKind: 'fridge' })).toBe(5);
  });

  it('normalisiert Produktgruppe und Lagerort unabhängig von Schreibweise', () => {
    expect(estimateOpenedExpiryDays({ name: '  JOGHURT  ', locationKind: 'KÜHLSCHRANK' })).toBe(5);
  });
});

describe('calculateOpenedExpiryDate', () => {
  it('berechnet das Datum aus Öffnungsdatum und Regelwert', () => {
    expect(
      calculateOpenedExpiryDate({ name: 'Joghurt', locationKind: 'fridge', openedAt: OPENED_AT }),
    ).toBe('2026-08-10');
  });

  it('verlängert vakuumierte Produkte mit dem dokumentierten Platzhalterwert', () => {
    const baseDays = estimateOpenedExpiryDays({ name: 'Joghurt', locationKind: 'fridge' });
    expect(getVacuumExpiryDays(baseDays)).toBeGreaterThan(baseDays);
    expect(
      calculateOpenedExpiryDate({
        name: 'Joghurt',
        locationKind: 'fridge',
        openedAt: OPENED_AT,
        vacuumSealed: true,
      }),
    ).toBe('2026-08-18');
  });

  it('behält ein manuell gesetztes früheres Datum als Sicherheitsgrenze', () => {
    expect(
      calculateOpenedExpiryDate({
        name: 'Joghurt',
        locationKind: 'fridge',
        openedAt: OPENED_AT,
        currentExpiryDate: '2026-08-07',
        expiryUserSet: true,
      }),
    ).toBe('2026-08-07');
  });

  it('ersetzt ein manuell gesetztes späteres Datum durch die konservativere Berechnung', () => {
    expect(
      calculateOpenedExpiryDate({
        name: 'Joghurt',
        locationKind: 'fridge',
        openedAt: OPENED_AT,
        currentExpiryDate: '2026-12-31',
        expiryUserSet: true,
      }),
    ).toBe('2026-08-10');
  });
});
