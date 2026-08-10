import {
  dedupeRecentFoods,
  type FoodHistoryEntry,
  rankFrequentFoods,
} from '@/features/calorie-tracking/food-history';

function entry(name: string, overrides: Partial<FoodHistoryEntry> = {}): FoodHistoryEntry {
  return {
    name,
    kcal: 100,
    proteinG: 5,
    carbsG: 10,
    fatG: 2,
    quantity: 100,
    unit: 'g',
    ...overrides,
  };
}

describe('dedupeRecentFoods', () => {
  it('behaelt nur die juengste Fundstelle je Name, Reihenfolge bleibt erhalten', () => {
    const result = dedupeRecentFoods([entry('Apfel'), entry('Banane'), entry('Apfel')]);
    expect(result.map((e) => e.name)).toEqual(['Apfel', 'Banane']);
  });

  it('liefert eine leere Liste fuer eine leere Historie', () => {
    expect(dedupeRecentFoods([])).toEqual([]);
  });

  it('behaelt die Werte der juengsten (ersten) Fundstelle', () => {
    const result = dedupeRecentFoods([entry('Apfel', { kcal: 55 }), entry('Apfel', { kcal: 52 })]);
    expect(result).toEqual([entry('Apfel', { kcal: 55 })]);
  });
});

describe('rankFrequentFoods', () => {
  it('sortiert nach Haeufigkeit des Namens absteigend', () => {
    const result = rankFrequentFoods([
      entry('Banane'),
      entry('Apfel'),
      entry('Apfel'),
      entry('Apfel'),
      entry('Banane'),
    ]);
    expect(result.map((e) => e.name)).toEqual(['Apfel', 'Banane']);
  });

  it('behaelt bei gleicher Haeufigkeit die juengste Fundstelle vorn', () => {
    const result = rankFrequentFoods([entry('Banane'), entry('Apfel')]);
    expect(result.map((e) => e.name)).toEqual(['Banane', 'Apfel']);
  });

  it('liefert eine leere Liste fuer eine leere Historie', () => {
    expect(rankFrequentFoods([])).toEqual([]);
  });
});
