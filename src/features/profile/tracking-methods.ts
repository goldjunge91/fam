import type { TrackingMethodOverrides } from '@/constants/dev-settings';
import type { TrackingMethod } from '@/features/calorie-tracking/api';
import type { FeatureFlagKey, FeatureFlagValues } from '@/lib/posthog';

export type TrackingMethodOption = {
  id: TrackingMethod;
  label: string;
  desc: string;
  featureFlag: FeatureFlagKey | true;
};

export const TRACKING_METHODS: readonly TrackingMethodOption[] = [
  {
    id: 'standard',
    label: 'Klassisch (CICO)',
    desc: 'Kalorien- & Makronährstoff-Tracking ohne Spezialregeln',
    featureFlag: true,
  },
  {
    id: 'glp1',
    label: 'GLP-1 & Medikation',
    desc: 'Injektionsintervalle, Dosierungen & Symptome erfassen',
    featureFlag: true,
  },
  {
    id: 'fasting',
    label: 'Intervallfasten',
    desc: 'Fastenphasen-Timer & individuelle Essensfenster',
    featureFlag: 'tracking-method-fasting',
  },
  {
    id: 'low_carb',
    label: 'Low-Carb',
    desc: 'Netto-Kohlenhydrate & Ballaststoffe fokussieren',
    featureFlag: 'low-carb-tracking',
  },
  {
    id: 'keto',
    label: 'Keto (Ketogen)',
    desc: 'Ketose-Ernährung (<20–50g Carbs) & Keton-Logs',
    featureFlag: 'tracking-method-keto',
  },
  {
    id: 'workouts',
    label: 'Kraftsport',
    desc: 'Übungen, Sätze, Wiederholungen & Gewichte dokumentieren',
    featureFlag: 'workout-log',
  },
  {
    id: 'cgm',
    label: 'Blutzucker & CGM',
    desc: 'Glukosemessungen vor & nach den Mahlzeiten loggen',
    featureFlag: 'tracking-method-cgm',
  },
  {
    id: 'volumetrics',
    label: 'Volumetrics',
    desc: 'Energiedichte-Ampel & Sättigungs-Scoring nutzen',
    featureFlag: 'tracking-method-volumetrics',
  },
];

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
