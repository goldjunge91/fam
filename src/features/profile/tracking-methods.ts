import type { TFunction } from 'i18next';
import type { TrackingMethodOverrides } from '@/constants/dev-settings';
import type { TrackingMethod } from '@/features/calorie-tracking/api';
import type { FeatureFlagKey, FeatureFlagValues } from '@/lib/observability/providers/posthog';

export type TrackingMethodOption = {
  id: TrackingMethod;
  featureFlag: FeatureFlagKey | true;
};

export const TRACKING_METHODS: readonly TrackingMethodOption[] = [
  { id: 'standard', featureFlag: true },
  { id: 'glp1', featureFlag: true },
  { id: 'fasting', featureFlag: 'tracking-method-fasting' },
  { id: 'low_carb', featureFlag: 'low-carb-tracking' },
  { id: 'keto', featureFlag: 'tracking-method-keto' },
  { id: 'workouts', featureFlag: 'workout-log' },
  { id: 'cgm', featureFlag: 'tracking-method-cgm' },
  { id: 'volumetrics', featureFlag: 'tracking-method-volumetrics' },
];

export function getTrackingMethodLabel(t: TFunction, method: TrackingMethod): string {
  switch (method) {
    case 'standard':
      return t('profile.tracking.methods.standard.label');
    case 'glp1':
      return t('profile.tracking.methods.glp1.label');
    case 'fasting':
      return t('profile.tracking.methods.fasting.label');
    case 'low_carb':
      return t('profile.tracking.methods.lowCarb.label');
    case 'keto':
      return t('profile.tracking.methods.keto.label');
    case 'workouts':
      return t('profile.tracking.methods.workouts.label');
    case 'cgm':
      return t('profile.tracking.methods.cgm.label');
    case 'volumetrics':
      return t('profile.tracking.methods.volumetrics.label');
  }
}

export function getTrackingMethodDescription(t: TFunction, method: TrackingMethod): string {
  switch (method) {
    case 'standard':
      return t('profile.tracking.methods.standard.description');
    case 'glp1':
      return t('profile.tracking.methods.glp1.description');
    case 'fasting':
      return t('profile.tracking.methods.fasting.description');
    case 'low_carb':
      return t('profile.tracking.methods.lowCarb.description');
    case 'keto':
      return t('profile.tracking.methods.keto.description');
    case 'workouts':
      return t('profile.tracking.methods.workouts.description');
    case 'cgm':
      return t('profile.tracking.methods.cgm.description');
    case 'volumetrics':
      return t('profile.tracking.methods.volumetrics.description');
  }
}

export function isTrackingMethodEnabled(
  method: TrackingMethod,
  featureFlags: FeatureFlagValues,
  overrides: TrackingMethodOverrides,
): boolean {
  const override = overrides[method];
  if (override !== undefined) return override;

  const option = TRACKING_METHODS.find((candidate) => candidate.id === method);
  if (!option) return false;
  if (option.featureFlag === true) return true;
  return featureFlags?.[option.featureFlag] === true;
}

export function getTrackingMethodSettings(
  featureFlags: FeatureFlagValues,
  overrides: TrackingMethodOverrides,
): Record<TrackingMethod, boolean> {
  return {
    standard: isTrackingMethodEnabled('standard', featureFlags, overrides),
    glp1: isTrackingMethodEnabled('glp1', featureFlags, overrides),
    fasting: isTrackingMethodEnabled('fasting', featureFlags, overrides),
    low_carb: isTrackingMethodEnabled('low_carb', featureFlags, overrides),
    keto: isTrackingMethodEnabled('keto', featureFlags, overrides),
    workouts: isTrackingMethodEnabled('workouts', featureFlags, overrides),
    cgm: isTrackingMethodEnabled('cgm', featureFlags, overrides),
    volumetrics: isTrackingMethodEnabled('volumetrics', featureFlags, overrides),
  };
}
