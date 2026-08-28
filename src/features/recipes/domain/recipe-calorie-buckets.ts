export type CalorieBucket = { min: number; max: number; label: string };

export const CALORIE_BUCKETS: CalorieBucket[] = [
  { min: 50, max: 100, label: '50–100' },
  { min: 100, max: 200, label: '100–200' },
  { min: 200, max: 300, label: '200–300' },
  { min: 300, max: 400, label: '300–400' },
  { min: 400, max: 500, label: '400–500' },
  { min: 500, max: 600, label: '500–600' },
  { min: 600, max: 700, label: '600–700' },
  { min: 700, max: 800, label: '700–800' },
  { min: 800, max: 900, label: '800–900' },
  { min: 900, max: 1000, label: '900–1000' },
];

export function isInCalorieBucket(kcal: number, bucket: CalorieBucket): boolean {
  return kcal > bucket.min && kcal <= bucket.max;
}
