import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import {
  calculateServingNutrition,
  type ProductNutritionRow,
  type RecipeComponentRow,
} from '@/features/recipes/domain/nutrition';
import type {
  RecipeComponent,
  RecipeComponentItem,
} from '@/features/recipes/hooks/use-recipe-components';
import type { RecipeStep } from '@/features/recipes/hooks/use-recipe-steps';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getDatabase } from '@/lib/db/client';
import { parseJsonArray } from '@/lib/db/json-array';
import { enqueueMutation } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import type { DietaryTag, Difficulty, DishType } from '../wizard/recipe-metadata-options';

export type { DietaryTag, Difficulty, DishType } from '../wizard/recipe-metadata-options';

export type RecipeSubstitution = {
  forIngredientId: string;
  swap: string;
  savings?: string;
};

export type RecipeListItem = {
  id: string;
  household_id: string;
  title: string;
  instructions: string | null;
  cover_image_path: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes: number | null;
  storage_instructions?: string | null;
  reheating_instructions?: string | null;
  cheap_tips?: string[];
  substitutions?: RecipeSubstitution[];
  crispiness_level?: string | null;
  air_fryer_time_minutes?: number | null;
  air_fryer_temperature_f?: number | null;
  variant_group?: string | null;
  variant_type?: string | null;
  dorm_friendly?: boolean | null;
  meal_prep_friendly?: boolean | null;
  why_cheap?: string | null;
  healthier_tips?: string[];
  batch_prep_tips?: string[];
  optional_add_ins?: string[];
  difficulty: Difficulty | null;
  dish_types: DishType[];
  dietary_tags: DietaryTag[];
  hashtags: string[];
  default_servings: number;
  created_by: string | null;
  created_at: string | null;
  kcalPerServing?: number | null;
  proteinGPerServing?: number | null;
  carbsGPerServing?: number | null;
};

/** Rohzeile aus SQLite: die `text[]`-Server-Spalten kommen lokal als JSON-Text an. */
type RecipeRow = Omit<RecipeListItem, 'dish_types' | 'dietary_tags' | 'hashtags'> & {
  dish_types: string;
  dietary_tags: string;
  hashtags: string;
  cheap_tips: string;
  substitutions: string;
  healthier_tips: string;
  batch_prep_tips: string;
  optional_add_ins: string;
  dorm_friendly: number | null;
  meal_prep_friendly: number | null;
};

type RecipeComponentItemDbRow = Omit<RecipeComponentItem, 'note' | 'optional'> & {
  optional: number;
  note: string | null;
};

function nullableBoolean(value: number | null | undefined): boolean | null {
  return value === null || value === undefined ? null : value === 1;
}

function toRecipeListItem(row: RecipeRow): RecipeListItem {
  return {
    ...row,
    dish_types: parseJsonArray<DishType>(row.dish_types),
    dietary_tags: parseJsonArray<DietaryTag>(row.dietary_tags),
    hashtags: parseJsonArray<string>(row.hashtags),
    cheap_tips: parseJsonArray<string>(row.cheap_tips),
    substitutions: parseJsonArray<RecipeSubstitution>(row.substitutions),
    healthier_tips: parseJsonArray<string>(row.healthier_tips),
    batch_prep_tips: parseJsonArray<string>(row.batch_prep_tips),
    optional_add_ins: parseJsonArray<string>(row.optional_add_ins),
    dorm_friendly: nullableBoolean(row.dorm_friendly),
    meal_prep_friendly: nullableBoolean(row.meal_prep_friendly),
  };
}

const RECIPE_COLUMNS = `id, household_id, title, instructions, cover_image_path,
  prep_time_minutes, cook_time_minutes, storage_instructions, reheating_instructions,
  cheap_tips, substitutions, crispiness_level, air_fryer_time_minutes,
  air_fryer_temperature_f, variant_group, variant_type, dorm_friendly,
  meal_prep_friendly, why_cheap, healthier_tips, batch_prep_tips, optional_add_ins,
  difficulty, dish_types, dietary_tags, hashtags, default_servings,
  created_by, created_at`;

export type ProductRow = ProductNutritionRow & { name: string };

export type RecipeDetail = {
  recipe: RecipeListItem;
  components: RecipeComponent[];
  items: RecipeComponentItem[];
  steps: RecipeStep[];
  productsById: Map<string, ProductRow>;
};

type RecipeMetadataInput = {
  prep_time_minutes?: number | null;
  storage_instructions?: string | null;
  reheating_instructions?: string | null;
  cheap_tips?: string[];
  substitutions?: RecipeSubstitution[];
  crispiness_level?: string | null;
  air_fryer_time_minutes?: number | null;
  air_fryer_temperature_f?: number | null;
  variant_group?: string | null;
  variant_type?: string | null;
  dorm_friendly?: boolean | null;
  meal_prep_friendly?: boolean | null;
  why_cheap?: string | null;
  healthier_tips?: string[];
  batch_prep_tips?: string[];
  optional_add_ins?: string[];
};

function nowStamp() {
  return { iso: new Date().toISOString(), ms: Date.now() };
}

// ------------------------------------------------------------------- Queries

export function useRecipes(householdId: string | undefined) {
  return useQuery({
    queryKey: ['recipes', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const db = await getDatabase();
      const rows = await db.getAllAsync<RecipeRow>(
        `select ${RECIPE_COLUMNS}
         from recipes
         where household_id = ? and deleted_at is null
         order by title collate nocase`,
        [householdId],
      );
      const recipes = rows.map(toRecipeListItem);
      if (recipes.length === 0) return recipes;

      const recipeIds = recipes.map((recipe) => recipe.id);
      const placeholders = recipeIds.map(() => '?').join(', ');
      type NutritionComponentRow = RecipeComponentRow & { recipe_id: string };
      type NutritionItemRow = RecipeComponentItem & { recipe_id: string };
      const [components, items] = await Promise.all([
        db.getAllAsync<NutritionComponentRow>(
          `select id, recipe_id, serving_grams
           from recipe_components
           where recipe_id in (${placeholders}) and deleted_at is null`,
          recipeIds,
        ),
        db.getAllAsync<NutritionItemRow>(
          `select component_id, recipe_id, product_id, sub_component_id, grams
           from recipe_component_items
           where recipe_id in (${placeholders}) and deleted_at is null`,
          recipeIds,
        ),
      ]);

      const productIds = [
        ...new Set(items.map((item) => item.product_id).filter((id): id is string => !!id)),
      ];
      const productsById = new Map<string, ProductNutritionRow>();
      if (productIds.length > 0) {
        const productPlaceholders = productIds.map(() => '?').join(', ');
        const products = await db.getAllAsync<ProductNutritionRow>(
          `select id, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100
           from products where id in (${productPlaceholders})`,
          productIds,
        );
        for (const product of products) productsById.set(product.id, product);
      }

      const componentsByRecipe = new Map<string, RecipeComponentRow[]>();
      for (const component of components) {
        const list = componentsByRecipe.get(component.recipe_id) ?? [];
        list.push(component);
        componentsByRecipe.set(component.recipe_id, list);
      }
      const itemsByRecipe = new Map<string, RecipeComponentItem[]>();
      for (const item of items) {
        const list = itemsByRecipe.get(item.recipe_id) ?? [];
        list.push(item);
        itemsByRecipe.set(item.recipe_id, list);
      }

      return recipes.map((recipe) => {
        const nutrition = calculateServingNutrition(
          componentsByRecipe.get(recipe.id) ?? [],
          itemsByRecipe.get(recipe.id) ?? [],
          productsById,
        );
        const hasNutrition = nutrition.kcal > 0;
        return {
          ...recipe,
          kcalPerServing: hasNutrition ? Math.round(nutrition.kcal) : null,
          proteinGPerServing: hasNutrition ? Math.round(nutrition.protein_g) : null,
          carbsGPerServing: hasNutrition ? Math.round(nutrition.carbs_g) : null,
        };
      });
    },
    enabled: !!householdId,
  });
}

export function useRecipeDetail(recipeId: string | undefined) {
  return useQuery({
    queryKey: ['recipe-detail', recipeId],
    queryFn: async (): Promise<RecipeDetail | null> => {
      if (!recipeId) return null;
      const db = await getDatabase();

      const recipeRow = await db.getFirstAsync<RecipeRow>(
        `select ${RECIPE_COLUMNS} from recipes where id = ? and deleted_at is null`,
        [recipeId],
      );
      if (!recipeRow) return null;
      const recipe = toRecipeListItem(recipeRow);

      const components = await db.getAllAsync<RecipeComponent>(
        `select id, recipe_id, name, serving_grams
         from recipe_components
         where recipe_id = ? and deleted_at is null`,
        [recipeId],
      );

      const itemRows = await db.getAllAsync<RecipeComponentItemDbRow>(
        `select id, component_id, product_id, sub_component_id, grams, quantity, unit, optional, note
         from recipe_component_items
         where recipe_id = ? and deleted_at is null`,
        [recipeId],
      );
      const items: RecipeComponentItem[] = itemRows.map((row) => ({
        ...row,
        optional: row.optional === 1,
      }));

      const stepRows = await db.getAllAsync<Omit<RecipeStep, 'ingredientIds'>>(
        `select id, recipe_id, position, text, image_path, timer_minutes
         from recipe_steps
         where recipe_id = ? and deleted_at is null
         order by position`,
        [recipeId],
      );
      const stepIngredientRows = await db.getAllAsync<{ step_id: string; item_id: string }>(
        `select rsi.step_id, rsi.item_id
         from recipe_step_ingredients rsi
         join recipe_steps rs on rs.id = rsi.step_id
         where rs.recipe_id = ? and rsi.deleted_at is null and rs.deleted_at is null`,
        [recipeId],
      );
      const ingredientIdsByStep = new Map<string, string[]>();
      for (const row of stepIngredientRows) {
        const list = ingredientIdsByStep.get(row.step_id) ?? [];
        list.push(row.item_id);
        ingredientIdsByStep.set(row.step_id, list);
      }
      const steps: RecipeStep[] = stepRows.map((row) => ({
        ...row,
        ingredientIds: ingredientIdsByStep.get(row.id) ?? [],
      }));

      const productIds = [
        ...new Set(items.map((i) => i.product_id).filter((id): id is string => !!id)),
      ];
      const productsById = new Map<string, ProductRow>();
      if (productIds.length > 0) {
        const placeholders = productIds.map(() => '?').join(', ');
        const products = await db.getAllAsync<ProductRow>(
          `select id, name, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100
           from products where id in (${placeholders})`,
          productIds,
        );
        for (const p of products) productsById.set(p.id, p);
      }

      return { recipe, components, items, steps, productsById };
    },
    enabled: !!recipeId,
  });
}

// ----------------------------------------------------------------- Mutations

export function useAddRecipeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: {
        household_id: string;
        title: string;
        instructions?: string | null;
        cover_image_path?: string | null;
        cook_time_minutes?: number | null;
        difficulty?: Difficulty | null;
        dish_types?: DishType[];
        dietary_tags?: DietaryTag[];
        hashtags?: string[];
        default_servings?: number;
        created_by: string;
      } & RecipeMetadataInput,
    ) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();

      const row = {
        id,
        household_id: input.household_id,
        title: input.title,
        instructions: input.instructions ?? null,
        cover_image_path: input.cover_image_path ?? null,
        prep_time_minutes: input.prep_time_minutes ?? null,
        cook_time_minutes: input.cook_time_minutes ?? null,
        storage_instructions: input.storage_instructions ?? null,
        reheating_instructions: input.reheating_instructions ?? null,
        cheap_tips: input.cheap_tips ?? [],
        substitutions: input.substitutions ?? [],
        crispiness_level: input.crispiness_level ?? null,
        air_fryer_time_minutes: input.air_fryer_time_minutes ?? null,
        air_fryer_temperature_f: input.air_fryer_temperature_f ?? null,
        variant_group: input.variant_group ?? null,
        variant_type: input.variant_type ?? null,
        dorm_friendly: input.dorm_friendly ?? null,
        meal_prep_friendly: input.meal_prep_friendly ?? null,
        why_cheap: input.why_cheap ?? null,
        healthier_tips: input.healthier_tips ?? [],
        batch_prep_tips: input.batch_prep_tips ?? [],
        optional_add_ins: input.optional_add_ins ?? [],
        difficulty: input.difficulty ?? null,
        dish_types: input.dish_types ?? [],
        dietary_tags: input.dietary_tags ?? [],
        hashtags: input.hashtags ?? [],
        default_servings: input.default_servings ?? 1,
        created_by: input.created_by,
      };

      await enqueueMutation(db, {
        entity: 'recipes',
        entityId: id,
        op: 'insert',
        payload: { ...row, created_at: iso, updated_at: iso },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'recipes', 'insert', { ...row, created_at: iso }, ms),
      });

      return row;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipes', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateRecipeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: {
        id: string;
        household_id: string;
        title: string;
        instructions?: string | null;
        cover_image_path?: string | null;
        cook_time_minutes?: number | null;
        difficulty?: Difficulty | null;
        dish_types?: DishType[];
        dietary_tags?: DietaryTag[];
        hashtags?: string[];
        default_servings?: number;
      } & RecipeMetadataInput,
    ) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();

      const patch = {
        instructions: input.instructions ?? null,
        cover_image_path: input.cover_image_path ?? null,
        cook_time_minutes: input.cook_time_minutes ?? null,
        difficulty: input.difficulty ?? null,
        dish_types: input.dish_types ?? [],
        dietary_tags: input.dietary_tags ?? [],
        hashtags: input.hashtags ?? [],
        default_servings: input.default_servings ?? 1,
        ...(input.prep_time_minutes !== undefined && {
          prep_time_minutes: input.prep_time_minutes,
        }),
        ...(input.storage_instructions !== undefined && {
          storage_instructions: input.storage_instructions,
        }),
        ...(input.reheating_instructions !== undefined && {
          reheating_instructions: input.reheating_instructions,
        }),
        ...(input.cheap_tips !== undefined && { cheap_tips: input.cheap_tips }),
        ...(input.substitutions !== undefined && { substitutions: input.substitutions }),
        ...(input.crispiness_level !== undefined && {
          crispiness_level: input.crispiness_level,
        }),
        ...(input.air_fryer_time_minutes !== undefined && {
          air_fryer_time_minutes: input.air_fryer_time_minutes,
        }),
        ...(input.air_fryer_temperature_f !== undefined && {
          air_fryer_temperature_f: input.air_fryer_temperature_f,
        }),
        ...(input.variant_group !== undefined && { variant_group: input.variant_group }),
        ...(input.variant_type !== undefined && { variant_type: input.variant_type }),
        ...(input.dorm_friendly !== undefined && { dorm_friendly: input.dorm_friendly }),
        ...(input.meal_prep_friendly !== undefined && {
          meal_prep_friendly: input.meal_prep_friendly,
        }),
        ...(input.why_cheap !== undefined && { why_cheap: input.why_cheap }),
        ...(input.healthier_tips !== undefined && { healthier_tips: input.healthier_tips }),
        ...(input.batch_prep_tips !== undefined && { batch_prep_tips: input.batch_prep_tips }),
        ...(input.optional_add_ins !== undefined && {
          optional_add_ins: input.optional_add_ins,
        }),
      };

      await enqueueMutation(db, {
        entity: 'recipes',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          title: input.title,
          ...patch,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipes',
            'update',
            { id: input.id, title: input.title, ...patch },
            ms,
          ),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipes', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useDeleteRecipeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; household_id: string }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();

      // Soft-Delete kaskadiert nicht serverseitig (kein Hard-Delete, siehe
      // Kommentar in 11_recipes.sql) — Komponenten und Positionen muessen hier
      // einzeln als geloescht markiert werden, sonst blieben sie im Spiegel
      // und in der UI eines anderen Mitglieds sichtbar haengen.
      const components = await db.getAllAsync<{ id: string }>(
        'select id from recipe_components where recipe_id = ? and deleted_at is null',
        [input.id],
      );
      const items = await db.getAllAsync<{ id: string }>(
        'select id from recipe_component_items where recipe_id = ? and deleted_at is null',
        [input.id],
      );
      const steps = await db.getAllAsync<{ id: string }>(
        'select id from recipe_steps where recipe_id = ? and deleted_at is null',
        [input.id],
      );
      const stepIngredients =
        steps.length > 0
          ? await db.getAllAsync<{ id: string }>(
              `select id from recipe_step_ingredients
               where step_id in (${steps.map(() => '?').join(', ')}) and deleted_at is null`,
              steps.map((s) => s.id),
            )
          : [];

      for (const stepIngredient of stepIngredients) {
        await enqueueMutation(db, {
          entity: 'recipe_step_ingredients',
          entityId: stepIngredient.id,
          op: 'delete',
          payload: {
            id: stepIngredient.id,
            household_id: input.household_id,
            deleted_at: iso,
            updated_at: iso,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(
              txn,
              'recipe_step_ingredients',
              'delete',
              { id: stepIngredient.id },
              ms,
            ),
        });
      }

      for (const step of steps) {
        await enqueueMutation(db, {
          entity: 'recipe_steps',
          entityId: step.id,
          op: 'delete',
          payload: {
            id: step.id,
            household_id: input.household_id,
            deleted_at: iso,
            updated_at: iso,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(txn, 'recipe_steps', 'delete', { id: step.id }, ms),
        });
      }

      for (const item of items) {
        await enqueueMutation(db, {
          entity: 'recipe_component_items',
          entityId: item.id,
          op: 'delete',
          payload: {
            id: item.id,
            household_id: input.household_id,
            deleted_at: iso,
            updated_at: iso,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(txn, 'recipe_component_items', 'delete', { id: item.id }, ms),
        });
      }

      for (const component of components) {
        await enqueueMutation(db, {
          entity: 'recipe_components',
          entityId: component.id,
          op: 'delete',
          payload: {
            id: component.id,
            household_id: input.household_id,
            deleted_at: iso,
            updated_at: iso,
          },
          applyLocally: (txn) =>
            applyLocalMirrorWrite(txn, 'recipe_components', 'delete', { id: component.id }, ms),
        });
      }

      await enqueueMutation(db, {
        entity: 'recipes',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'recipes', 'delete', { id: input.id }, ms),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      trackAnalyticsEvent('recipe.delete.completed');
      queryClient.invalidateQueries({ queryKey: ['recipes', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
