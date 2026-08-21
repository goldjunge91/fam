import { calculateMacroTargets, type MacroPreset } from '@/features/calorie-tracking/macros';

describe('calculateMacroTargets', () => {
  it.each([
    ['balanced', 2000, { proteinG: 150, carbsG: 200, fatG: 67 }],
    ['high_protein', 2000, { proteinG: 200, carbsG: 150, fatG: 67 }],
    ['low_carb', 2000, { proteinG: 200, carbsG: 100, fatG: 89 }],
    ['keto', 2000, { proteinG: 125, carbsG: 25, fatG: 156 }],
  ] satisfies [MacroPreset, number, { proteinG: number; carbsG: number; fatG: number }][])(
    'teilt %s bei %i kcal in %o auf',
    (preset, targetKcal, erwartet) => {
      expect(calculateMacroTargets(targetKcal, preset)).toEqual(erwartet);
    },
  );

  it('rundet jeden Makrowert auf ganze Gramm', () => {
    const result = calculateMacroTargets(1850, 'balanced');
    expect(Number.isInteger(result.proteinG)).toBe(true);
    expect(Number.isInteger(result.carbsG)).toBe(true);
    expect(Number.isInteger(result.fatG)).toBe(true);
  });

  it('liefert 0 g fuer alle Makros bei 0 kcal', () => {
    expect(calculateMacroTargets(0, 'balanced')).toEqual({ proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('akzeptiert eine benutzerdefinierte Verteilung statt eines Presets', () => {
    expect(calculateMacroTargets(2000, { protein: 0.25, carbs: 0.5, fat: 0.25 })).toEqual({
      proteinG: 125,
      carbsG: 250,
      fatG: 56,
    });
  });
});
