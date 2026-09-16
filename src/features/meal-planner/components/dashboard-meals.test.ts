import { getUpcomingMealEntries } from './dashboard-meals';

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
