import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/database.types';
import { assertSafeSeedTarget } from './glp1-seed-guard';

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const DEFAULT_EMAIL = 'maestro-e2e@example.com';
const SEED_NAMESPACE = 'nutritrack-glp1-ui-seed-v1';
const DAY_COUNT = 84;

type Supabase = SupabaseClient<Database>;
type MedicationInsert = Database['public']['Tables']['medication_logs']['Insert'];
type SymptomInsert = Database['public']['Tables']['symptom_logs']['Insert'];
type FoodInsert = Database['public']['Tables']['food_entries']['Insert'];
type WeightInsert = Database['public']['Tables']['weight_entries']['Insert'];

const PRODUCTS = {
  oats: {
    name: 'Zarte Haferflocken',
    kcal: 372,
    protein: 13.5,
    carbs: 58.7,
    fat: 7,
    fiber: 10,
  },
  milk: {
    name: 'frische Vollmilch 3,5%',
    kcal: 65,
    protein: 3.4,
    carbs: 4.8,
    fat: 3.6,
    fiber: 0,
  },
  chicken: {
    name: 'Hähnchenbrustfilet',
    kcal: 110,
    protein: 23,
    carbs: 0,
    fat: 2,
    fiber: 0,
  },
  rice: {
    name: 'Basmatireis',
    kcal: 352,
    protein: 8.6,
    carbs: 77,
    fat: 0.2,
    fiber: 1,
  },
  oliveOil: {
    name: 'Natives Olivenöl Extra',
    kcal: 822,
    protein: 0,
    carbs: 0,
    fat: 91.3,
    fiber: 0,
  },
  yogurt: {
    name: 'Joghurt mild 3,8% Fett',
    kcal: 65,
    protein: 4.1,
    carbs: 3.7,
    fat: 3.8,
    fiber: 0,
  },
  apple: {
    name: 'Äpfel',
    kcal: 52,
    protein: 0.3,
    carbs: 14,
    fat: 0.2,
    fiber: 2.4,
  },
  honey: {
    name: 'Blütenhonig flüssig',
    kcal: 300,
    protein: 0.5,
    carbs: 75,
    fat: 0.5,
    fiber: 0,
  },
} as const;

const INJECTION_DOSES = [0.25, 0.5, 0.5, 1, 1, 0.5, 1.7, 1.7, 2.4, 2.4, 2.4, 2.4];
const INJECTION_UNITS = ['mg', 'mg', 'mg', 'mg', 'mg', 'ml', 'mg', 'mg', 'mg', 'mg', 'mg', 'mg'];
const INJECTION_SITES = ['abdomen', 'thigh', 'upper_arm', 'other'] as const;
const DAILY_VARIATION = [0.97, 1.02, 1.01, 0.98, 1.04, 1.08, 1.03];

function stableId(kind: string, index: number): string {
  const digest = createHash('sha256').update(`${SEED_NAMESPACE}:${kind}:${index}`).digest();
  const bytes = [...digest.subarray(0, 16)];
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function localDate(daysAgo: number, hour = 12, minute = 0): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function injectionDayIndexes(): number[] {
  return Array.from({ length: DAY_COUNT / 7 }, (_, week) => week * 7);
}

function lastInjectionIndex(dayIndex: number): number {
  return Math.floor(dayIndex / 7) * 7;
}

function buildMedicationRows(): MedicationInsert[] {
  return injectionDayIndexes().map((dayIndex, week) => {
    const administeredAt = localDate(DAY_COUNT - 1 - dayIndex, 8, 15);
    const unit = INJECTION_UNITS[week];

    return {
      id: stableId('medication', week),
      user_id: '',
      child_profile_id: null,
      medication_name: 'Semaglutid',
      dose: INJECTION_DOSES[week],
      unit,
      injection_site: INJECTION_SITES[week % INJECTION_SITES.length],
      administered_at: administeredAt.toISOString(),
      notes:
        unit === 'units'
          ? 'Randfall: Pen-Einheit statt mg'
          : week === 0
            ? 'Start der Demo-Titration'
            : null,
    };
  });
}

function symptomValues(dayIndex: number): {
  appetiteLevel: number;
  satietyLevel: number;
  nauseaLevel: number;
  sideEffects: string[];
} {
  const week = Math.floor(dayIndex / 7);
  const daysSinceInjection = dayIndex - lastInjectionIndex(dayIndex);
  const titrationEffect = Math.floor(week / 4);
  const postInjectionSuppression = daysSinceInjection <= 2 ? 1 : daysSinceInjection <= 4 ? 0 : -1;
  const appetiteLevel = clamp(4 - titrationEffect - postInjectionSuppression, 1, 5);
  const nauseaLevel = daysSinceInjection <= 3 ? 4 - daysSinceInjection : 0;
  const sideEffects =
    daysSinceInjection === 0
      ? ['Übelkeit', 'Müdigkeit']
      : daysSinceInjection === 1
        ? ['Übelkeit']
        : daysSinceInjection === 2
          ? ['Völlegefühl']
          : [];

  return {
    appetiteLevel,
    satietyLevel: clamp(6 - appetiteLevel, 1, 5),
    nauseaLevel,
    sideEffects,
  };
}

function buildSymptomRows(): SymptomInsert[] {
  const rows = Array.from({ length: DAY_COUNT }, (_, dayIndex) => {
    const values = symptomValues(dayIndex);
    const isSymptomOnlyDay = dayIndex === 30;
    const isEarlyMorningEdgeCase = dayIndex === 31;
    const loggedAt = localDate(
      DAY_COUNT - 1 - dayIndex,
      isEarlyMorningEdgeCase ? 5 : 14,
      isEarlyMorningEdgeCase ? 15 : 0,
    );

    return {
      id: stableId('symptom', dayIndex),
      user_id: '',
      child_profile_id: null,
      logged_at: loggedAt.toISOString(),
      appetite_level: values.appetiteLevel,
      satiety_level: values.satietyLevel,
      nausea_level: values.nauseaLevel,
      side_effects: values.sideEffects,
      notes: isSymptomOnlyDay
        ? 'Randfall: Symptomtag ohne Medikationseintrag'
        : isEarlyMorningEdgeCase
          ? 'Randfall: vor dem Tagesstart um 06:00 erfasst'
          : null,
    };
  });

  return rows;
}

type FoodTemplate = {
  mealType: 'breakfast' | 'lunch' | 'dinner';
  product: (typeof PRODUCTS)[keyof typeof PRODUCTS];
  baseGrams: number;
  hour: number;
};

const FOOD_TEMPLATES: FoodTemplate[] = [
  { mealType: 'breakfast', product: PRODUCTS.oats, baseGrams: 70, hour: 8 },
  { mealType: 'breakfast', product: PRODUCTS.milk, baseGrams: 250, hour: 8 },
  { mealType: 'lunch', product: PRODUCTS.chicken, baseGrams: 180, hour: 13 },
  { mealType: 'lunch', product: PRODUCTS.rice, baseGrams: 180, hour: 13 },
  { mealType: 'lunch', product: PRODUCTS.oliveOil, baseGrams: 15, hour: 13 },
  { mealType: 'dinner', product: PRODUCTS.yogurt, baseGrams: 200, hour: 19 },
  { mealType: 'dinner', product: PRODUCTS.apple, baseGrams: 150, hour: 19 },
  { mealType: 'dinner', product: PRODUCTS.honey, baseGrams: 15, hour: 19 },
];

function buildFoodRows(): FoodInsert[] {
  return Array.from({ length: DAY_COUNT }, (_, dayIndex) => {
    const day = localDate(DAY_COUNT - 1 - dayIndex);
    const { appetiteLevel } = symptomValues(dayIndex);
    const appetiteMultiplier = 0.75 + appetiteLevel * 0.09;
    const variation = DAILY_VARIATION[dayIndex % DAILY_VARIATION.length];

    return FOOD_TEMPLATES.map((template, mealIndex) => {
      const quantity = round(template.baseGrams * appetiteMultiplier * variation, 1);
      const multiplier = quantity / 100;
      const loggedAt = localDate(DAY_COUNT - 1 - dayIndex, template.hour, mealIndex === 0 ? 0 : 10);

      return {
        id: stableId('food', dayIndex * FOOD_TEMPLATES.length + mealIndex),
        user_id: '',
        child_profile_id: null,
        product_id: null,
        logged_on: dateOnly(day),
        logged_at: loggedAt.toISOString(),
        meal_type: template.mealType,
        quantity,
        unit: 'g',
        name: template.product.name,
        kcal: round(template.product.kcal * multiplier),
        protein_g: round(template.product.protein * multiplier),
        carbs_g: round(template.product.carbs * multiplier),
        fat_g: round(template.product.fat * multiplier),
        fiber_g: round(template.product.fiber * multiplier),
      };
    });
  }).flat();
}

function buildWeightRows(): WeightInsert[] {
  const weeklyVariation = [0, 0.3, -0.2, 0.15, -0.25, 0.1, -0.15, 0.2, -0.1, 0.15, -0.2, 0.05];

  return injectionDayIndexes().map((dayIndex, week) => ({
    id: stableId('weight', week),
    user_id: '',
    child_profile_id: null,
    measured_on: dateOnly(localDate(DAY_COUNT - 1 - dayIndex)),
    weight_kg: round(112 - week * 0.65 + weeklyVariation[week]),
    waist_cm: null,
    chest_cm: null,
    hip_cm: null,
  }));
}

function withUserId<T extends { user_id: string }>(rows: T[], userId: string): T[] {
  return rows.map((row) => ({ ...row, user_id: userId }));
}

function throwOnError(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

async function deleteGeneratedRows(
  supabase: Supabase,
  table: 'medication_logs' | 'symptom_logs' | 'food_entries' | 'weight_entries' | 'user_goals',
  userId: string,
  ids: string[],
): Promise<void> {
  const batchSize = 100;
  for (let start = 0; start < ids.length; start += batchSize) {
    const batch = ids.slice(start, start + batchSize);
    const { error } = await supabase.from(table).delete().eq('user_id', userId).in('id', batch);
    throwOnError(error, `Demo-Daten aus ${table} löschen`);
  }
}

async function insertRows<T extends object>(
  supabase: Supabase,
  table: 'medication_logs' | 'symptom_logs' | 'food_entries' | 'weight_entries',
  rows: T[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows as never[]);
  throwOnError(error, `Demo-Daten in ${table} schreiben`);
}

function resolveConfig() {
  const url =
    process.env.GLP1_SEED_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    LOCAL_SUPABASE_URL;
  const allowNonLocal = process.env.GLP1_SEED_ALLOW_NON_LOCAL === 'true';

  assertSafeSeedTarget(url, allowNonLocal);

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY fehlt. Lies den lokalen Key mit supabase status aus und übergib ihn ausschließlich als Umgebungsvariable.',
    );
  }

  return {
    url,
    serviceRoleKey,
    email: process.argv[2]?.trim() || process.env.GLP1_SEED_EMAIL?.trim() || DEFAULT_EMAIL,
  };
}

async function findUser(supabase: Supabase, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  throwOnError(error, 'Testaccount suchen');
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
}

async function seedAccount(supabase: Supabase, userId: string): Promise<void> {
  const medicationRows = withUserId(buildMedicationRows(), userId);
  const symptomRows = withUserId(buildSymptomRows(), userId);
  const foodRows = withUserId(buildFoodRows(), userId);
  const weightRows = withUserId(buildWeightRows(), userId);
  const goalId = stableId('goal', 0);

  await deleteGeneratedRows(
    supabase,
    'medication_logs',
    userId,
    medicationRows.map((row) => row.id as string),
  );
  await deleteGeneratedRows(
    supabase,
    'symptom_logs',
    userId,
    symptomRows.map((row) => row.id as string),
  );
  await deleteGeneratedRows(
    supabase,
    'food_entries',
    userId,
    foodRows.map((row) => row.id as string),
  );
  await deleteGeneratedRows(
    supabase,
    'weight_entries',
    userId,
    weightRows.map((row) => row.id as string),
  );
  await deleteGeneratedRows(supabase, 'user_goals', userId, [goalId]);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      display_name: 'GLP-1 Demo',
      birth_date: '1988-04-15',
      sex: 'female',
      height_cm: 168,
      activity_level: 'moderate',
      onboarding_completed_at: new Date().toISOString(),
      tracking_method: 'glp1',
      tracking_day_start_time: '06:00',
    })
    .eq('id', userId);
  throwOnError(profileError, 'Demo-Profil aktualisieren');

  const { error: goalError } = await supabase.from('user_goals').insert({
    id: goalId,
    user_id: userId,
    child_profile_id: null,
    goal_type: 'lose',
    target_weight_kg: 95,
    rate_kg_per_week: 0.5,
    daily_kcal: 1800,
    protein_g: 120,
    carbs_g: 180,
    fat_g: 60,
    net_carbs_g: null,
    valid_from: dateOnly(new Date()),
  });
  throwOnError(goalError, 'Demo-Ziel anlegen');

  await insertRows(supabase, 'medication_logs', medicationRows);
  await insertRows(supabase, 'symptom_logs', symptomRows);
  await insertRows(supabase, 'food_entries', foodRows);
  await insertRows(supabase, 'weight_entries', weightRows);

  console.log(
    `✅ GLP-1-Demo für ${userId}: ${medicationRows.length} Injektionen, ` +
      `${symptomRows.length} Symptomtage, ${foodRows.length} Mahlzeiten, ` +
      `${weightRows.length} Gewichtswerte und 1 Ziel angelegt.`,
  );
}

async function main(): Promise<void> {
  const config = resolveConfig();
  const supabase = createClient<Database>(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const user = await findUser(supabase, config.email);

  if (!user) {
    throw new Error(
      `Kein Testaccount mit ${config.email} gefunden. Bitte zuerst "bun run user:create ${config.email}" ausführen.`,
    );
  }

  console.log(`⏳ Erzeuge lokalen GLP-1-Demo-Datensatz für ${config.email}...`);
  await seedAccount(supabase, user.id);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
