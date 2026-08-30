import { getLogicalDateForTimestamp } from '@/features/calorie-tracking/day-boundary';

export type CorrelationInjection = {
  administeredAt: string;
  medicationName: string;
  dose: number | null;
  unit: string;
  injectionSite?: string | null;
};

export type CorrelationCalorieEntry = {
  loggedOn: string;
  kcal: number | null;
};

export type CorrelationWeightEntry = {
  measuredOn: string;
  weightKg: number;
};

export type CorrelationSeriesPoint = {
  date: string;
  daysSinceInjection: number | null;
  calories: number | null;
  weightKg: number | null;
  injection: CorrelationInjection | null;
  doseChanged: boolean;
};

type BuildCorrelationSeriesInput = {
  startDate: string;
  endDate: string;
  dayStartTime?: string;
  previousInjection?: CorrelationInjection | null;
  injections: CorrelationInjection[];
  calorieEntries: CorrelationCalorieEntry[];
  weightEntries: CorrelationWeightEntry[];
};

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function addUtcDay(date: Date): void {
  date.setUTCDate(date.getUTCDate() + 1);
}

function daysBetween(startDate: string, endDate: string): number {
  return Math.round((parseDate(endDate).getTime() - parseDate(startDate).getTime()) / 86_400_000);
}

export function buildCorrelationSeries({
  startDate,
  endDate,
  dayStartTime = '00:00',
  previousInjection = null,
  injections,
  calorieEntries,
  weightEntries,
}: BuildCorrelationSeriesInput): CorrelationSeriesPoint[] {
  const datedInjections = [
    ...(previousInjection ? [{ injection: previousInjection, isInRange: false }] : []),
    ...injections.map((injection) => ({ injection, isInRange: true })),
  ]
    .map((entry) => ({
      ...entry,
      date: getLogicalDateForTimestamp(new Date(entry.injection.administeredAt), dayStartTime),
    }))
    .sort((left, right) =>
      left.injection.administeredAt.localeCompare(right.injection.administeredAt),
    );

  const injectionsByDate = new Map<
    string,
    { injection: CorrelationInjection; doseChanged: boolean }
  >();
  for (const [index, entry] of datedInjections.entries()) {
    if (!entry.isInRange) continue;
    const predecessor = datedInjections[index - 1]?.injection;
    injectionsByDate.set(entry.date, {
      injection: entry.injection,
      doseChanged:
        predecessor !== undefined &&
        (predecessor.dose !== entry.injection.dose || predecessor.unit !== entry.injection.unit),
    });
  }

  const caloriesByDate = new Map<string, number>();
  for (const entry of calorieEntries) {
    if (entry.kcal === null) continue;
    caloriesByDate.set(entry.loggedOn, (caloriesByDate.get(entry.loggedOn) ?? 0) + entry.kcal);
  }

  const weightByDate = new Map(
    weightEntries.map((entry) => [entry.measuredOn, entry.weightKg] as const),
  );

  const points: CorrelationSeriesPoint[] = [];
  const cursor = parseDate(startDate);
  const lastDate = parseDate(endDate);

  while (cursor <= lastDate) {
    const date = cursor.toISOString().slice(0, 10);
    const latestInjection = datedInjections.findLast((entry) => entry.date <= date);
    const injectionEvent = injectionsByDate.get(date);
    points.push({
      date,
      daysSinceInjection: latestInjection ? daysBetween(latestInjection.date, date) : null,
      calories: caloriesByDate.get(date) ?? null,
      weightKg: weightByDate.get(date) ?? null,
      injection: injectionEvent?.injection ?? null,
      doseChanged: injectionEvent?.doseChanged ?? false,
    });
    addUtcDay(cursor);
  }

  return points;
}
