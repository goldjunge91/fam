import type { TFunction } from 'i18next';

export const MEDICATION_UNITS = ['mg', 'ml', 'units', 'mcg', 'pills'] as const;
export type MedicationUnit = (typeof MEDICATION_UNITS)[number];

export const INJECTION_SITE_VALUES = ['abdomen', 'thigh', 'upper_arm', 'other'] as const;
export type InjectionSite = (typeof INJECTION_SITE_VALUES)[number];

export const INJECTION_SITES: readonly { value: InjectionSite }[] = INJECTION_SITE_VALUES.map(
  (value) => ({ value }),
);

export function getInjectionSiteLabel(t: TFunction, site: InjectionSite): string {
  switch (site) {
    case 'abdomen':
      return t('glp1.sites.abdomen');
    case 'thigh':
      return t('glp1.sites.thigh');
    case 'upper_arm':
      return t('glp1.sites.upperArm');
    case 'other':
      return t('glp1.sites.other');
  }
}

export function isInjectionSite(value: string | null): value is InjectionSite {
  return value !== null && INJECTION_SITE_VALUES.includes(value as InjectionSite);
}

export function toMedicationUnit(value: string): MedicationUnit {
  for (const unit of MEDICATION_UNITS) {
    if (unit === value) return unit;
  }
  return 'mg';
}
