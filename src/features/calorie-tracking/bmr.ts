export type Sex = 'male' | 'female';
export type BmrFormula = 'mifflin_st_jeor' | 'harris_benedict';

export type BmrProfileInput = {
  sex: Sex | null;
  birthDate: Date | string | null;
  heightCm: number | null;
  weightKg: number | null;
};

export type BmrMissingField = 'sex' | 'birthDate' | 'heightCm' | 'weightKg';

export type BmrResult =
  | { ok: true; bmrKcal: number; formula: BmrFormula; ageYears: number }
  | { ok: false; reason: 'incomplete_profile'; missingFields: BmrMissingField[] };

export function calculateAgeYears(birthDate: Date, today: Date): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

/** Mifflin-St-Jeor (1990) — Standardformel, siehe #81. */
export function mifflinStJeorBmr(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  return input.sex === 'male' ? base + 5 : base - 161;
}

/** Harris-Benedict, revidiert nach Roza/Shizgal (1990). */
export function harrisBenedictBmr(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number {
  if (input.sex === 'male') {
    return 88.362 + 13.397 * input.weightKg + 4.799 * input.heightCm - 5.677 * input.ageYears;
  }
  return 447.593 + 9.247 * input.weightKg + 3.098 * input.heightCm - 4.33 * input.ageYears;
}

export function calculateBmr(
  input: BmrProfileInput,
  today: Date,
  formula: BmrFormula = 'mifflin_st_jeor',
): BmrResult {
  const missingFields: BmrMissingField[] = [];
  if (input.sex === null) missingFields.push('sex');
  if (input.birthDate === null) missingFields.push('birthDate');
  if (input.heightCm === null) missingFields.push('heightCm');
  if (input.weightKg === null) missingFields.push('weightKg');

  if (missingFields.length > 0) {
    return { ok: false, reason: 'incomplete_profile', missingFields };
  }

  const sex = input.sex as Sex;
  const heightCm = input.heightCm as number;
  const weightKg = input.weightKg as number;
  const birthDate =
    typeof input.birthDate === 'string' ? new Date(input.birthDate) : (input.birthDate as Date);
  const ageYears = calculateAgeYears(birthDate, today);

  const bmrKcal =
    formula === 'harris_benedict'
      ? harrisBenedictBmr({ sex, weightKg, heightCm, ageYears })
      : mifflinStJeorBmr({ sex, weightKg, heightCm, ageYears });

  return { ok: true, bmrKcal, formula, ageYears };
}
