import type { Sex } from './bmr';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

/** PAL-Multiplikatoren (Standardwerte), siehe #82. */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateTdee(bmrKcal: number, activityLevel: ActivityLevel): number {
  return bmrKcal * ACTIVITY_MULTIPLIERS[activityLevel];
}

export type GoalType = 'lose' | 'maintain' | 'gain';

/** kcal pro kg Koerperfett — gaengiger Naeherungswert fuer die Rate-Umrechnung. */
const KCAL_PER_KG_BODY_FAT = 7700;

/**
 * Absolute Mindestwerte, unabhaengig vom individuellen Grundumsatz (#82).
 * Zusaetzlich zum Grundumsatz-Floor, falls der Grundumsatz selbst sehr
 * niedrig ausfaellt.
 */
export const MINIMUM_SAFE_KCAL: Record<Sex, number> = { male: 1500, female: 1200 };

/** Empfohlene Tempo-Spanne fuer Ab-/Zunehmen laut Schema-Dokumentation. */
export const RECOMMENDED_RATE_RANGE_KG_PER_WEEK = { min: 0.25, max: 1.0 } as const;

export type RateWarning = 'below_recommended_range' | 'above_recommended_range';
export type CappedReason = 'bmr_floor' | 'sex_minimum_floor';

export type TargetCalorieInput = {
  tdeeKcal: number;
  bmrKcal: number;
  sex: Sex;
  goalType: GoalType;
  /** Ignoriert bei goalType 'maintain'. */
  rateKgPerWeek: number;
};

export type TargetCalorieResult = {
  targetKcal: number;
  /** Wert vor der Sicherheitskappung — bleibt sichtbar, damit eine Kappung
   *  nicht "still" passiert (#82-AC). */
  uncappedKcal: number;
  capped: boolean;
  cappedReason: CappedReason | null;
  rateWarning: RateWarning | null;
};

export function calculateTargetCalories(input: TargetCalorieInput): TargetCalorieResult {
  const { tdeeKcal, bmrKcal, sex, goalType, rateKgPerWeek } = input;

  const dailyDeltaKcal = (rateKgPerWeek * KCAL_PER_KG_BODY_FAT) / 7;

  const uncappedKcal =
    goalType === 'lose'
      ? tdeeKcal - dailyDeltaKcal
      : goalType === 'gain'
        ? tdeeKcal + dailyDeltaKcal
        : tdeeKcal;

  const floor = Math.max(bmrKcal, MINIMUM_SAFE_KCAL[sex]);

  // Nur bei 'lose' kann der Floor je greifen: bei 'gain'/'maintain' liegt das
  // Ergebnis durch den PAL-Multiplikator (>= 1.2) strukturell immer darueber.
  const targetKcal = goalType === 'lose' ? Math.max(uncappedKcal, floor) : uncappedKcal;
  const capped = targetKcal !== uncappedKcal;
  const cappedReason: CappedReason | null = !capped
    ? null
    : bmrKcal >= MINIMUM_SAFE_KCAL[sex]
      ? 'bmr_floor'
      : 'sex_minimum_floor';

  let rateWarning: RateWarning | null = null;
  if (goalType !== 'maintain') {
    if (rateKgPerWeek < RECOMMENDED_RATE_RANGE_KG_PER_WEEK.min) {
      rateWarning = 'below_recommended_range';
    } else if (rateKgPerWeek > RECOMMENDED_RATE_RANGE_KG_PER_WEEK.max) {
      rateWarning = 'above_recommended_range';
    }
  }

  return { targetKcal, uncappedKcal, capped, cappedReason, rateWarning };
}
