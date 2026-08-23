export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Layout = {
  floatingActionAreaHeight: Spacing.four + Spacing.six,
  floatingActionClearance: Spacing.six,
} as const;

export const ControlSize = {
  compactHeight: 34,
} as const;

export const ButtonSize = {
  formHeight: 54,
  navHero: 58,
  backArrow: 45,
  headerAction: 39,
  modalClose: 32,
  fab: 75,
} as const;

export const IconSize = {
  xs: 14,
  header: 20,
  nav: 24,
  hero: 26,
  backArrow: 45,
} as const;

export const Radius = {
  hairline: 2,
  xs: 4,
  sm: 8,
  control: 12,
  controlLarge: 14,
  card: 16,
  sheet: 20,
  large: 28,
  pill: 999,
} as const;

export const MaxContentWidth = 800;

export { computeRingMetrics, type RingPreset, RingPresetSize } from './rings';
