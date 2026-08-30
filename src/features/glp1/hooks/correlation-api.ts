import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import {
  buildCorrelationSeries,
  type CorrelationInjection,
  type CorrelationSeriesPoint,
} from '@/features/glp1/domain/correlation-series';
import { correlationSeriesQueryKey } from '@/features/glp1/domain/query-keys';
import {
  getLogicalDateForTimestamp,
  getTimeRangeForLogicalDate,
} from '@/features/tracking/domain/day-boundary';
import { getDatabase } from '@/lib/db/client';
import { getSupabase } from '@/lib/supabase';

const localMedicationSchema = z.object({
  administered_at: z.string(),
  medication_name: z.string(),
  dose: z.number().nullable(),
  unit: z.string(),
  injection_site: z.string().nullable(),
});

const foodEntriesSchema = z.array(
  z.object({
    logged_on: z.string(),
    kcal: z.number().nullable(),
  }),
);

const weightEntriesSchema = z.array(
  z.object({
    measured_on: z.string(),
    measured_at: z.string().nullable(),
    weight_kg: z.number(),
  }),
);

export { correlationSeriesQueryKey } from '@/features/glp1/domain/query-keys';

function subtractDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function toInjection(row: z.infer<typeof localMedicationSchema>): CorrelationInjection {
  return {
    administeredAt: row.administered_at,
    medicationName: row.medication_name,
    dose: row.dose,
    unit: row.unit,
    injectionSite: row.injection_site,
  };
}

async function fetchMedicationInputs({
  userId,
  childProfileId,
  startDate,
  endDate,
  dayStartTime,
}: {
  userId: string;
  childProfileId?: string | null;
  startDate: string;
  endDate: string;
  dayStartTime: string;
}) {
  const { start } = getTimeRangeForLogicalDate(startDate, dayStartTime);
  const { nextStart } = getTimeRangeForLogicalDate(endDate, dayStartTime);
  const db = await getDatabase();
  const columns = 'administered_at, medication_name, dose, unit, injection_site';
  const scope = 'user_id = ? and child_profile_id is ? and deleted_at is null';
  const params = [userId, childProfileId ?? null] as const;

  const inRangeRows = await db.getAllAsync<unknown>(
    `select ${columns} from medication_logs
     where ${scope} and administered_at >= ? and administered_at < ?
     order by administered_at asc`,
    [...params, start.toISOString(), nextStart.toISOString()],
  );
  const previousRows = await db.getAllAsync<unknown>(
    `select ${columns} from medication_logs
     where ${scope} and administered_at < ?
     order by administered_at desc limit 1`,
    [...params, start.toISOString()],
  );

  const injections = z.array(localMedicationSchema).parse(inRangeRows).map(toInjection);
  const previousInjection = z.array(localMedicationSchema).parse(previousRows)[0];
  return {
    injections,
    previousInjection: previousInjection ? toInjection(previousInjection) : null,
  };
}

async function fetchFoodInputs({
  userId,
  childProfileId,
  startDate,
  endDate,
}: {
  userId: string;
  childProfileId?: string | null;
  startDate: string;
  endDate: string;
}) {
  let query = getSupabase()
    .from('food_entries')
    .select('logged_on, kcal')
    .eq('user_id', userId)
    .is('deleted_at', null);
  query = childProfileId
    ? query.eq('child_profile_id', childProfileId)
    : query.is('child_profile_id', null);
  const { data, error } = await query
    .gte('logged_on', startDate)
    .lte('logged_on', endDate)
    .order('logged_on', { ascending: true });

  if (error) throw new Error(error.message);
  return foodEntriesSchema.parse(data ?? []).map((entry) => ({
    loggedOn: entry.logged_on,
    kcal: entry.kcal,
  }));
}

async function fetchWeightInputs({
  userId,
  childProfileId,
  startDate,
  endDate,
  dayStartTime,
}: {
  userId: string;
  childProfileId?: string | null;
  startDate: string;
  endDate: string;
  dayStartTime: string;
}) {
  const { start } = getTimeRangeForLogicalDate(startDate, dayStartTime);
  const { nextStart } = getTimeRangeForLogicalDate(endDate, dayStartTime);
  let query = getSupabase()
    .from('weight_entries')
    .select('measured_on, measured_at, weight_kg')
    .eq('user_id', userId)
    .is('deleted_at', null);
  query = childProfileId
    ? query.eq('child_profile_id', childProfileId)
    : query.is('child_profile_id', null);
  const timestampRange = `and(measured_at.gte.${start.toISOString()},measured_at.lt.${nextStart.toISOString()})`;
  const legacyRange = `and(measured_at.is.null,measured_on.gte.${startDate},measured_on.lte.${endDate})`;
  const { data, error } = await query
    .or(`${timestampRange},${legacyRange}`)
    .order('measured_on', { ascending: true });

  if (error) throw new Error(error.message);
  return weightEntriesSchema.parse(data ?? []).map((entry) => ({
    measuredOn: entry.measured_at
      ? getLogicalDateForTimestamp(new Date(entry.measured_at), dayStartTime)
      : entry.measured_on,
    weightKg: entry.weight_kg,
  }));
}

async function fetchCorrelationSeries({
  userId,
  childProfileId,
  endDate,
  dayStartTime,
}: {
  userId: string;
  childProfileId?: string | null;
  endDate: string;
  dayStartTime: string;
}): Promise<CorrelationSeriesPoint[]> {
  const startDate = subtractDays(endDate, 89);
  const [medicationInputs, calorieEntries, weightEntries] = await Promise.all([
    fetchMedicationInputs({ userId, childProfileId, startDate, endDate, dayStartTime }),
    fetchFoodInputs({ userId, childProfileId, startDate, endDate }),
    fetchWeightInputs({ userId, childProfileId, startDate, endDate, dayStartTime }),
  ]);

  return buildCorrelationSeries({
    startDate,
    endDate,
    dayStartTime,
    previousInjection: medicationInputs.previousInjection,
    injections: medicationInputs.injections,
    calorieEntries,
    weightEntries,
  });
}

export function useCorrelationSeries(
  userId: string | undefined,
  childProfileId: string | null | undefined,
  endDate: string,
  dayStartTime: string,
) {
  return useQuery({
    queryKey: correlationSeriesQueryKey(userId, childProfileId, endDate, dayStartTime),
    queryFn: () =>
      fetchCorrelationSeries({
        userId: userId as string,
        childProfileId,
        endDate,
        dayStartTime,
      }),
    enabled: !!userId && !!endDate,
  });
}
