export const RingPresetSize = {
  compact: { size: 58, strokeWidth: 7 },
  dashboard: { size: 94, strokeWidth: 10 },
  medium: { size: 128, strokeWidth: 12 },
  large: { size: 160, strokeWidth: 14 },
} as const;

export type RingPreset = keyof typeof RingPresetSize;

export function computeRingMetrics(size: number, strokeWidth: number) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return { radius, circumference };
}
