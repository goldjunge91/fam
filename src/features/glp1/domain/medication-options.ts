export const MEDICATION_UNITS = ['mg', 'ml', 'units', 'mcg', 'pills'] as const;
export type MedicationUnit = (typeof MEDICATION_UNITS)[number];

export const INJECTION_SITES = [
  { value: 'abdomen', label: 'Bauch' },
  { value: 'thigh', label: 'Oberschenkel' },
  { value: 'upper_arm', label: 'Oberarm' },
  { value: 'other', label: 'Andere Stelle' },
] as const;
export const INJECTION_SITE_VALUES = ['abdomen', 'thigh', 'upper_arm', 'other'] as const;
export type InjectionSite = (typeof INJECTION_SITE_VALUES)[number];

export const INJECTION_SITE_LABELS = {
  abdomen: 'Bauch',
  thigh: 'Oberschenkel',
  upper_arm: 'Oberarm',
  other: 'Andere Stelle',
} as const satisfies Record<InjectionSite, string>;

export function isInjectionSite(value: string | null): value is InjectionSite {
  return value !== null && value in INJECTION_SITE_LABELS;
}

export function toMedicationUnit(value: string): MedicationUnit {
  for (const unit of MEDICATION_UNITS) {
    if (unit === value) return unit;
  }
  return 'mg';
}
