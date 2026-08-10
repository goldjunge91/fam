import { calculateTargetCalories, calculateTdee } from '@/features/calorie-tracking/tdee';

describe('calculateTdee', () => {
  it.each([
    ['sedentary', 2040],
    ['light', 2337.5],
    ['moderate', 2635],
    ['active', 2932.5],
    ['very_active', 3230],
  ] as const)(
    'berechnet für "%s" den korrekten TDEE-Wert %i kcal',
    (activityLevel, expectedTdee) => {
      expect(calculateTdee(1700, activityLevel)).toBe(expectedTdee);
    },
  );
});

describe('calculateTargetCalories', () => {
  it('ignoriert die Rate bei "maintain" und kappt nicht', () => {
    const result = calculateTargetCalories({
      tdeeKcal: 2500,
      bmrKcal: 1700,
      sex: 'male',
      goalType: 'maintain',
      rateKgPerWeek: 5, // unsinniger Wert, muss ohne Effekt bleiben
    });
    expect(result.targetKcal).toBe(2500);
    expect(result.uncappedKcal).toBe(2500);
    expect(result.capped).toBe(false);
    expect(result.cappedReason).toBeNull();
    expect(result.rateWarning).toBeNull();
  });

  it('berechnet ein moderates Defizit ohne Kappung', () => {
    const result = calculateTargetCalories({
      tdeeKcal: 2500,
      bmrKcal: 1700,
      sex: 'male',
      goalType: 'lose',
      rateKgPerWeek: 0.5,
    });
    expect(result.uncappedKcal).toBeCloseTo(1950, 5);
    expect(result.targetKcal).toBeCloseTo(1950, 5);
    expect(result.capped).toBe(false);
    expect(result.cappedReason).toBeNull();
    expect(result.rateWarning).toBeNull();
  });

  it('erzeugt bei "gain" einen Ueberschuss und kappt niemals', () => {
    const result = calculateTargetCalories({
      tdeeKcal: 2500,
      bmrKcal: 1700,
      sex: 'male',
      goalType: 'gain',
      rateKgPerWeek: 0.5,
    });
    expect(result.uncappedKcal).toBeCloseTo(3050, 5);
    expect(result.targetKcal).toBeCloseTo(3050, 5);
    expect(result.capped).toBe(false);
    expect(result.cappedReason).toBeNull();
  });

  it('kappt ein zu aggressives Defizit auf den Grundumsatz und zeigt das sichtbar an', () => {
    const result = calculateTargetCalories({
      tdeeKcal: 1900,
      bmrKcal: 1700,
      sex: 'male',
      goalType: 'lose',
      rateKgPerWeek: 1.5, // ausserhalb der empfohlenen Spanne
    });
    expect(result.uncappedKcal).toBeCloseTo(250, 5);
    expect(result.targetKcal).toBe(1700);
    expect(result.capped).toBe(true);
    expect(result.cappedReason).toBe('bmr_floor');
    expect(result.rateWarning).toBe('above_recommended_range');
  });

  it('kappt auf das Geschlechts-Minimum, wenn der Grundumsatz selbst sehr niedrig ist', () => {
    const result = calculateTargetCalories({
      tdeeKcal: 1300,
      bmrKcal: 1000,
      sex: 'female',
      goalType: 'lose',
      rateKgPerWeek: 0.5,
    });
    expect(result.targetKcal).toBe(1200);
    expect(result.capped).toBe(true);
    expect(result.cappedReason).toBe('sex_minimum_floor');
    expect(result.rateWarning).toBeNull();
  });

  it.each([
    [0.1, 'below_recommended_range'],
    [0.24, 'below_recommended_range'],
    [0.25, null],
    [1.0, null],
    [1.01, 'above_recommended_range'],
    [2, 'above_recommended_range'],
  ])('bewertet die Rate %s kg/Woche mit Warnung %s (inklusive Grenzen)', (rate, erwartet) => {
    const result = calculateTargetCalories({
      tdeeKcal: 3000,
      bmrKcal: 1700,
      sex: 'male',
      goalType: 'lose',
      rateKgPerWeek: rate,
    });
    expect(result.rateWarning).toBe(erwartet);
  });
});
