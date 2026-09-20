import {
  getDailyMealPlanEmptyArtworkVariant,
  getDailyMealPlanEmptyMessageKey,
  getMealPlanEmptyVariant,
  getUpcomingMealEntries,
} from './dashboard-meals';

const entries = [
  { id: 'breakfast-today', entry_date: '2026-09-16', meal_slot: 'breakfast' as const },
  { id: 'lunch-today', entry_date: '2026-09-16', meal_slot: 'lunch' as const },
  { id: 'dinner-today', entry_date: '2026-09-16', meal_slot: 'dinner' as const },
  { id: 'breakfast-tomorrow', entry_date: '2026-09-17', meal_slot: 'breakfast' as const },
  { id: 'lunch-tomorrow', entry_date: '2026-09-17', meal_slot: 'lunch' as const },
];

describe('getUpcomingMealEntries', () => {
  it('startet um 12 Uhr mit Mittag, Abendessen und dem Folgetag', () => {
    const result = getUpcomingMealEntries(entries, new Date(2026, 8, 16, 12, 0));

    expect(result.map((entry) => entry.id)).toEqual([
      'lunch-today',
      'dinner-today',
      'breakfast-tomorrow',
    ]);
  });

  it('startet um 17 Uhr mit Abendessen, Frühstück und Mittag am Folgetag', () => {
    const result = getUpcomingMealEntries(entries, new Date(2026, 8, 16, 17, 0));

    expect(result.map((entry) => entry.id)).toEqual([
      'dinner-today',
      'breakfast-tomorrow',
      'lunch-tomorrow',
    ]);
  });
});

describe('getDailyMealPlanEmptyMessageKey', () => {
  it('waehlt fuer denselben Tag stabil und fuer den Folgetag einen anderen Text', () => {
    const today = new Date(2026, 8, 16, 12, 0);

    expect(getDailyMealPlanEmptyMessageKey(today)).toBe(
      getDailyMealPlanEmptyMessageKey(new Date(2026, 8, 16, 18, 30)),
    );
    expect(getDailyMealPlanEmptyMessageKey(today)).not.toBe(
      getDailyMealPlanEmptyMessageKey(new Date(2026, 8, 17, 12, 0)),
    );
  });

  it('liefert innerhalb einer Woche sieben verschiedene Textschluessel', () => {
    const messageKeys = Array.from({ length: 7 }, (_, offset) =>
      getDailyMealPlanEmptyMessageKey(new Date(2026, 8, 16 + offset, 12, 0)),
    );

    expect(new Set(messageKeys).size).toBe(7);
  });
});

describe('getMealPlanEmptyVariant', () => {
  it('ordnet den kleinen und großen Karten ihre ausgewählte Empty-State-Variante zu', () => {
    expect(getMealPlanEmptyVariant('small')).toBe('weeklyStrip');
    expect(getMealPlanEmptyVariant('large')).toBe('kitchenNote');
  });
});

describe('getDailyMealPlanEmptyArtworkVariant', () => {
  it('bleibt am selben lokalen Tag gleich und wechselt am Folgetag', () => {
    const today = new Date(2026, 8, 20, 12, 0);

    expect(getDailyMealPlanEmptyArtworkVariant(today)).toBe(
      getDailyMealPlanEmptyArtworkVariant(new Date(2026, 8, 20, 20, 0)),
    );
    expect(getDailyMealPlanEmptyArtworkVariant(today)).not.toBe(
      getDailyMealPlanEmptyArtworkVariant(new Date(2026, 8, 21, 12, 0)),
    );
  });
});
