import { calculateDailyTotals } from '@/features/calorie-tracking/daily-totals';

describe('calculateDailyTotals', () => {
  it('summiert mehrere Eintraege', () => {
    const result = calculateDailyTotals([
      { kcal: 300, proteinG: 20, carbsG: 30, fatG: 10 },
      { kcal: 500, proteinG: 25, carbsG: 60, fatG: 15 },
    ]);
    expect(result).toEqual({ kcal: 800, proteinG: 45, carbsG: 90, fatG: 25 });
  });

  it('behandelt fehlende Naehrwerte als 0 statt NaN zu erzeugen', () => {
    const result = calculateDailyTotals([
      { kcal: null, proteinG: null, carbsG: null, fatG: null },
      { kcal: 200, proteinG: 10, carbsG: null, fatG: 5 },
    ]);
    expect(result).toEqual({ kcal: 200, proteinG: 10, carbsG: 0, fatG: 5 });
  });

  it('liefert lauter Nullen bei leerem Tag', () => {
    expect(calculateDailyTotals([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});
