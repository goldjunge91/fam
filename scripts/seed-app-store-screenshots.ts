/**
 * Befuellt einen bestehenden Test-Haushalt mit fiktiven, aber realistischen
 * Daten (Vorrat, Einkaufsliste, Rezepte, Tracking) fuer App-Store-Screenshots.
 *
 * Schreibt gegen die Remote-Datenbank (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY),
 * NICHT gegen die lokale Supabase-Instanz. Idempotent: jeder Abschnitt wird
 * nur befuellt, wenn der Haushalt/Account dort noch leer ist.
 *
 *
 * [email] default: test@ecample.de (bestehender Testaccount)
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL (oder EXPO_PUBLIC_SUPABASE_URL) fehlt als Umgebungsvariable.');
}

// SUPABASE_SECRET_KEY statt des lokalen service-role-key.ts-Helpers, da dieses
// Skript bewusst gegen die Remote-DB laeuft, nicht gegen die lokale Instanz.
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SECRET_KEY) {
  throw new Error('SUPABASE_SECRET_KEY (oder SUPABASE_SERVICE_ROLE_KEY) fehlt als Umgebungsvariable.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TARGET_EMAIL = process.argv[2] ?? 'test@ecample.de';

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function mondayOfThisWeek(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sonntag
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function findUserIdByEmail(email: string): Promise<string> {
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 200) break;
    page++;
  }
  throw new Error(`Kein Account mit E-Mail "${email}" gefunden.`);
}

async function getHouseholdId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Der Account gehoert zu keinem Haushalt.');
  return data.household_id;
}

/** Legt Standard-Lagerorte an, sofern der Haushalt noch keine hat. Gibt id-Map nach kind zurueck. */
async function ensureStorageLocations(householdId: string) {
  const { data: existing, error } = await supabase
    .from('storage_locations')
    .select('id, kind')
    .eq('household_id', householdId)
    .is('deleted_at', null);
  if (error) throw error;
  if (existing && existing.length > 0) {
    console.log(`Lagerorte bereits vorhanden (${existing.length}), ueberspringe.`);
    return Object.fromEntries(existing.map((l) => [l.kind, l.id])) as Record<string, string>;
  }

  const rows = [
    { household_id: householdId, name: 'Kühlschrank', kind: 'fridge', sort_order: 0 },
    { household_id: householdId, name: 'Gefrierfach', kind: 'freezer', sort_order: 1 },
    { household_id: householdId, name: 'Vorratsschrank', kind: 'pantry', sort_order: 2 },
  ];
  const { data, error: insertError } = await supabase.from('storage_locations').insert(rows).select('id, kind');
  if (insertError) throw insertError;
  console.log(`${data.length} Lagerorte angelegt.`);
  return Object.fromEntries(data.map((l) => [l.kind, l.id])) as Record<string, string>;
}

async function ensureStores(householdId: string) {
  const { data: existing, error } = await supabase
    .from('stores')
    .select('id, name')
    .eq('household_id', householdId)
    .is('deleted_at', null);
  if (error) throw error;
  if (existing && existing.length > 0) {
    console.log(`Maerkte bereits vorhanden (${existing.length}), ueberspringe.`);
    return Object.fromEntries(existing.map((s) => [s.name, s.id])) as Record<string, string>;
  }

  const rows = [
    { household_id: householdId, name: 'REWE', color: '#CC071E', sort_order: 0 },
    { household_id: householdId, name: 'Aldi Süd', color: '#00549F', sort_order: 1 },
  ];
  const { data, error: insertError } = await supabase.from('stores').insert(rows).select('id, name');
  if (insertError) throw insertError;
  console.log(`${data.length} Maerkte angelegt.`);
  return Object.fromEntries(data.map((s) => [s.name, s.id])) as Record<string, string>;
}

type ProductSeed = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const PRODUCT_SEEDS: ProductSeed[] = [
  { name: 'Vollmilch', kcal: 64, protein: 3.3, carbs: 4.8, fat: 3.6 },
  { name: 'Eier', kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { name: 'Naturjoghurt', kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  { name: 'Bananen', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { name: 'Tomaten', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { name: 'Zwiebeln', kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  { name: 'Hackfleisch gemischt', kcal: 250, protein: 17, carbs: 0, fat: 20 },
  { name: 'Spaghetti', kcal: 158, protein: 5.8, carbs: 31, fat: 0.9 },
  { name: 'Hähnchenbrustfilet', kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Basmatireis', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: 'Gouda', kcal: 356, protein: 25, carbs: 2.2, fat: 27 },
  { name: 'Paprika rot', kcal: 31, protein: 1, carbs: 6, fat: 0.3 },
];

/** Legt fehlende Produkte an und gibt eine Name->id-Map fuer alle Seeds zurueck. */
async function ensureProducts(): Promise<Record<string, string>> {
  const names = PRODUCT_SEEDS.map((p) => p.name);
  const { data: existing, error } = await supabase.from('products').select('id, name').in('name', names);
  if (error) throw error;
  const map = Object.fromEntries((existing ?? []).map((p) => [p.name, p.id])) as Record<string, string>;

  const missing = PRODUCT_SEEDS.filter((p) => !map[p.name]);
  if (missing.length === 0) {
    console.log('Alle Seed-Produkte bereits vorhanden.');
    return map;
  }

  const rows = missing.map((p) => ({
    name: p.name,
    source: 'manual' as const,
    kcal_per_100: p.kcal,
    protein_g_per_100: p.protein,
    carbs_g_per_100: p.carbs,
    fat_g_per_100: p.fat,
  }));
  const { data, error: insertError } = await supabase.from('products').insert(rows).select('id, name');
  if (insertError) throw insertError;
  console.log(`${data.length} Produkte angelegt.`);
  for (const p of data) map[p.name] = p.id;
  return map;
}

async function seedFridgeItems(
  householdId: string,
  locations: Record<string, string>,
  products: Record<string, string>,
) {
  const { count, error } = await supabase
    .from('fridge_items')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .is('deleted_at', null);
  if (error) throw error;
  if ((count ?? 0) > 0) {
    console.log(`Vorrat bereits befuellt (${count} Artikel), ueberspringe.`);
    return;
  }

  const rows = [
    { name: 'Vollmilch', product: 'Vollmilch', location: 'fridge', qty: 1, unit: 'l', expiry: isoDate(2) },
    { name: 'Eier', product: 'Eier', location: 'fridge', qty: 6, unit: 'piece', expiry: isoDate(12) },
    { name: 'Naturjoghurt', product: 'Naturjoghurt', location: 'fridge', qty: 4, unit: 'piece', expiry: isoDate(1) },
    { name: 'Gouda', product: 'Gouda', location: 'fridge', qty: 200, unit: 'g', expiry: isoDate(9) },
    { name: 'Paprika rot', product: 'Paprika rot', location: 'fridge', qty: 3, unit: 'piece', expiry: isoDate(4) },
    { name: 'Hähnchenbrustfilet', product: 'Hähnchenbrustfilet', location: 'freezer', qty: 500, unit: 'g', expiry: isoDate(60) },
    { name: 'Hackfleisch gemischt', product: 'Hackfleisch gemischt', location: 'freezer', qty: 400, unit: 'g', expiry: isoDate(45) },
    { name: 'Spaghetti', product: 'Spaghetti', location: 'pantry', qty: 2, unit: 'package', expiry: null },
    { name: 'Basmatireis', product: 'Basmatireis', location: 'pantry', qty: 1, unit: 'kg', expiry: null },
    { name: 'Bananen', product: 'Bananen', location: 'pantry', qty: 5, unit: 'piece', expiry: isoDate(3) },
    { name: 'Zwiebeln', product: 'Zwiebeln', location: 'pantry', qty: 4, unit: 'piece', expiry: null },
    { name: 'Tomaten', product: 'Tomaten', location: 'fridge', qty: 6, unit: 'piece', expiry: isoDate(2) },
  ];

  const insertRows = rows.map((r) => ({
    household_id: householdId,
    location_id: locations[r.location] ?? null,
    product_id: products[r.product] ?? null,
    name: r.name,
    quantity: r.qty,
    unit: r.unit,
    expiry_date: r.expiry,
  }));

  const { data, error: insertError } = await supabase.from('fridge_items').insert(insertRows).select('id');
  if (insertError) throw insertError;
  console.log(`${data.length} Vorratsartikel angelegt.`);
}

async function seedShoppingListItems(householdId: string, stores: Record<string, string>) {
  const { count, error } = await supabase
    .from('shopping_list_items')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .is('deleted_at', null);
  if (error) throw error;
  if ((count ?? 0) > 0) {
    console.log(`Einkaufsliste bereits befuellt (${count} Artikel), ueberspringe.`);
    return;
  }

  const rewe = stores['REWE'] ?? null;
  const aldi = stores['Aldi Süd'] ?? null;

  const rows = [
    { name: 'Butter', qty: 1, unit: 'package', category_id: 'chilled_dairy_eggs', store: rewe },
    { name: 'Äpfel', qty: 1, unit: 'kg', category_id: 'fresh_produce', store: rewe },
    { name: 'Vollkornbrot', qty: 1, unit: 'piece', category_id: 'bakery', store: rewe },
    { name: 'Olivenöl', qty: 1, unit: 'piece', category_id: 'oils_spices', store: rewe },
    { name: 'Toilettenpapier', qty: 1, unit: 'package', category_id: 'household', store: aldi },
    { name: 'Orangensaft', qty: 2, unit: 'l', category_id: 'cold_drinks', store: aldi },
    { name: 'Haferflocken', qty: 1, unit: 'package', category_id: 'breakfast', store: aldi },
    { name: 'Tiefkühlerbsen', qty: 1, unit: 'package', category_id: 'frozen', store: aldi },
    { name: 'Kaffee', qty: 1, unit: 'package', category_id: 'hot_drinks', store: null, checked: true },
  ];

  const insertRows = rows.map((r, i) => ({
    household_id: householdId,
    name: r.name,
    quantity: r.qty,
    unit: r.unit,
    category_id: r.category_id,
    category_source: 'user' as const,
    store_id: r.store,
    sort_index: i,
    checked_at: r.checked ? new Date().toISOString() : null,
  }));

  const { data, error: insertError } = await supabase.from('shopping_list_items').insert(insertRows).select('id');
  if (insertError) throw insertError;
  console.log(`${data.length} Einkaufsartikel angelegt.`);
}

type RecipeSeed = {
  title: string;
  cookTimeMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  dishTypes: string[];
  servings: number;
  steps: string[];
  items: { product: string; grams: number }[];
};

const RECIPE_SEEDS: RecipeSeed[] = [
  {
    title: 'Spaghetti Bolognese',
    cookTimeMinutes: 35,
    difficulty: 'easy',
    dishTypes: ['dinner'],
    servings: 4,
    steps: [
      'Zwiebeln fein wuerfeln und das Hackfleisch scharf anbraten.',
      'Tomaten und Gewuerze dazugeben, 20 Minuten koecheln lassen.',
      'Spaghetti separat kochen und mit der Sauce servieren.',
    ],
    items: [
      { product: 'Hackfleisch gemischt', grams: 400 },
      { product: 'Zwiebeln', grams: 100 },
      { product: 'Tomaten', grams: 300 },
      { product: 'Spaghetti', grams: 400 },
    ],
  },
  {
    title: 'Hähnchen-Reis-Pfanne',
    cookTimeMinutes: 25,
    difficulty: 'easy',
    dishTypes: ['lunch', 'dinner'],
    servings: 2,
    steps: [
      'Hähnchenbrust in Streifen schneiden und anbraten.',
      'Paprika dazugeben und kurz mitbraten.',
      'Mit gekochtem Reis vermengen und abschmecken.',
    ],
    items: [
      { product: 'Hähnchenbrustfilet', grams: 300 },
      { product: 'Paprika rot', grams: 150 },
      { product: 'Basmatireis', grams: 200 },
    ],
  },
  {
    title: 'Klassisches Rührei',
    cookTimeMinutes: 10,
    difficulty: 'easy',
    dishTypes: ['breakfast'],
    servings: 2,
    steps: [
      'Eier verquirlen und leicht salzen.',
      'Bei mittlerer Hitze in der Pfanne stocken lassen, dabei ruehren.',
    ],
    items: [{ product: 'Eier', grams: 240 }],
  },
  {
    title: 'Joghurt mit Banane',
    cookTimeMinutes: 5,
    difficulty: 'easy',
    dishTypes: ['breakfast', 'snack'],
    servings: 1,
    steps: ['Banane in Scheiben schneiden und unter den Joghurt heben.'],
    items: [
      { product: 'Naturjoghurt', grams: 200 },
      { product: 'Bananen', grams: 120 },
    ],
  },
];

/** Legt Rezepte inkl. einer Komponente, Positionen und Schritten an. Gibt id-Map nach Titel zurueck. */
async function seedRecipes(householdId: string, products: Record<string, string>): Promise<Record<string, string>> {
  const { data: existing, error } = await supabase
    .from('recipes')
    .select('id, title')
    .eq('household_id', householdId)
    .is('deleted_at', null);
  if (error) throw error;
  if (existing && existing.length > 0) {
    console.log(`Rezepte bereits vorhanden (${existing.length}), ueberspringe.`);
    return Object.fromEntries(existing.map((r) => [r.title, r.id])) as Record<string, string>;
  }

  const recipeIds: Record<string, string> = {};

  for (const seed of RECIPE_SEEDS) {
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        household_id: householdId,
        title: seed.title,
        cook_time_minutes: seed.cookTimeMinutes,
        difficulty: seed.difficulty,
        dish_types: seed.dishTypes,
        default_servings: seed.servings,
      })
      .select('id')
      .single();
    if (recipeError) throw recipeError;
    recipeIds[seed.title] = recipe.id;

    const { data: component, error: componentError } = await supabase
      .from('recipe_components')
      .insert({
        recipe_id: recipe.id,
        household_id: householdId,
        name: 'Hauptkomponente',
        serving_grams: seed.items.reduce((sum, i) => sum + i.grams, 0) / seed.servings,
      })
      .select('id')
      .single();
    if (componentError) throw componentError;

    const itemRows = seed.items.map((item) => ({
      component_id: component.id,
      recipe_id: recipe.id,
      household_id: householdId,
      product_id: products[item.product] ?? null,
      grams: item.grams,
      unit: 'g' as const,
    }));
    const { error: itemsError } = await supabase.from('recipe_component_items').insert(itemRows);
    if (itemsError) throw itemsError;

    const stepRows = seed.steps.map((text, i) => ({
      recipe_id: recipe.id,
      household_id: householdId,
      position: i,
      text,
    }));
    const { error: stepsError } = await supabase.from('recipe_steps').insert(stepRows);
    if (stepsError) throw stepsError;
  }

  console.log(`${RECIPE_SEEDS.length} Rezepte inkl. Zutaten und Schritten angelegt.`);
  return recipeIds;
}

async function seedMealPlan(householdId: string, recipeIds: Record<string, string>) {
  const weekStart = mondayOfThisWeek();
  const { data: existingPlan, error } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('household_id', householdId)
    .eq('week_start_date', weekStart)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;

  let planId = existingPlan?.id;
  if (!planId) {
    const { data: plan, error: planError } = await supabase
      .from('meal_plans')
      .insert({ household_id: householdId, name: 'Diese Woche', week_start_date: weekStart })
      .select('id')
      .single();
    if (planError) throw planError;
    planId = plan.id;
  }

  const { count, error: countError } = await supabase
    .from('meal_plan_entries')
    .select('id', { count: 'exact', head: true })
    .eq('meal_plan_id', planId);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    console.log('Wochenplan bereits befuellt, ueberspringe.');
    return;
  }

  const boloRecipeId = recipeIds['Spaghetti Bolognese'];
  const eggRecipeId = recipeIds['Klassisches Rührei'];
  if (!boloRecipeId || !eggRecipeId) return;

  const { error: entriesError } = await supabase.from('meal_plan_entries').insert([
    {
      meal_plan_id: planId,
      household_id: householdId,
      recipe_id: boloRecipeId,
      entry_date: isoDate(0),
      meal_slot: 'dinner',
      servings_mode: 'people',
      portions: 4,
      people_count: 4,
    },
    {
      meal_plan_id: planId,
      household_id: householdId,
      recipe_id: eggRecipeId,
      entry_date: isoDate(0),
      meal_slot: 'breakfast',
      servings_mode: 'people',
      portions: 2,
      people_count: 2,
    },
  ]);
  if (entriesError) throw entriesError;
  console.log('Wochenplan mit 2 Eintraegen fuer heute angelegt.');
}

async function seedTracking(userId: string) {
  const { count, error } = await supabase
    .from('food_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (error) throw error;
  if ((count ?? 0) > 0) {
    console.log(`Ernaehrungstagebuch bereits befuellt (${count} Eintraege), ueberspringe.`);
  } else {
    const today = isoDate(0);
    const rows = [
      {
        user_id: userId,
        logged_on: today,
        meal_type: 'breakfast' as const,
        quantity: 240,
        unit: 'g' as const,
        name: 'Rührei mit Vollkornbrot',
        kcal: 320,
        protein_g: 22,
        carbs_g: 18,
        fat_g: 17,
      },
      {
        user_id: userId,
        logged_on: today,
        meal_type: 'lunch' as const,
        quantity: 350,
        unit: 'g' as const,
        name: 'Hähnchen-Reis-Pfanne',
        kcal: 540,
        protein_g: 38,
        carbs_g: 55,
        fat_g: 14,
      },
      {
        user_id: userId,
        logged_on: today,
        meal_type: 'snack' as const,
        quantity: 200,
        unit: 'g' as const,
        name: 'Naturjoghurt mit Banane',
        kcal: 180,
        protein_g: 7,
        carbs_g: 26,
        fat_g: 5,
      },
    ];
    const { data, error: insertError } = await supabase.from('food_entries').insert(rows).select('id');
    if (insertError) throw insertError;
    console.log(`${data.length} Tagebucheintraege angelegt.`);
  }

  const { count: weightCount, error: weightError } = await supabase
    .from('weight_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (weightError) throw weightError;
  if ((weightCount ?? 0) > 0) {
    console.log(`Gewichtseintraege bereits vorhanden (${weightCount}), ueberspringe.`);
  } else {
    const rows = [
      { user_id: userId, measured_on: isoDate(-14), weight_kg: 82.4 },
      { user_id: userId, measured_on: isoDate(-7), weight_kg: 81.6 },
      { user_id: userId, measured_on: isoDate(0), weight_kg: 80.9 },
    ];
    const { data, error: insertError } = await supabase.from('weight_entries').insert(rows).select('id');
    if (insertError) throw insertError;
    console.log(`${data.length} Gewichtseintraege angelegt.`);
  }

  const { data: existingGoal, error: goalError } = await supabase
    .from('user_goals')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (goalError) throw goalError;
  if (existingGoal) {
    console.log('Ziel bereits gesetzt, ueberspringe.');
  } else {
    const { error: insertError } = await supabase.from('user_goals').insert({
      user_id: userId,
      goal_type: 'lose',
      target_weight_kg: 76,
      rate_kg_per_week: 0.5,
      daily_kcal: 2000,
      protein_g: 140,
      carbs_g: 200,
      fat_g: 65,
    });
    if (insertError) throw insertError;
    console.log('Kalorienziel angelegt.');
  }
}

async function main() {
  console.log(`Suche Account "${TARGET_EMAIL}" ...`);
  const userId = await findUserIdByEmail(TARGET_EMAIL);
  const householdId = await getHouseholdId(userId);
  console.log(`Account ${userId} / Haushalt ${householdId} gefunden.`);

  const locations = await ensureStorageLocations(householdId);
  const stores = await ensureStores(householdId);
  const products = await ensureProducts();

  await seedFridgeItems(householdId, locations, products);
  await seedShoppingListItems(householdId, stores);
  const recipeIds = await seedRecipes(householdId, products);
  await seedMealPlan(householdId, recipeIds);
  await seedTracking(userId);

  console.log('Fertig.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
