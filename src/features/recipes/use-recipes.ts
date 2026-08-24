import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import {
  calculateServingNutrition,
  type ProductNutritionRow,
  type RecipeComponentItemRow,
  type RecipeComponentRow,
} from '@/features/recipes/nutrition';
import { getDatabase } from '@/lib/db/client';
import { parseJsonArray } from '@/lib/db/json-array';
import { enqueueMutation } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type DishType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'dessert'
  | 'appetizer'
  | 'brunch';
export type DietaryTag =
  | 'vegetarian'
  | 'vegan'
  | 'high_fat'
  | 'low_fat'
  | 'lactose_free'
  | 'sugar_free'
  | 'gluten_free';

export type RecipeListItem = {
  id: string;
  household_id: string;
  title: string;
  instructions: string | null;
  cover_image_path: string | null;
  cook_time_minutes: number | null;
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
};

function toRecipeListItem(row: RecipeRow): RecipeListItem {
  return {
    ...row,
    dish_types: parseJsonArray<DishType>(row.dish_types),
    dietary_tags: parseJsonArray<DietaryTag>(row.dietary_tags),
    hashtags: parseJsonArray<string>(row.hashtags),
  };
}

const RECIPE_COLUMNS = `id, household_id, title, instructions, cover_image_path,
  cook_time_minutes, difficulty, dish_types, dietary_tags, hashtags, default_servings,
  created_by, created_at`;

export type RecipeComponent = RecipeComponentRow & { name: string; recipe_id: string };
export type RecipeComponentItem = RecipeComponentItemRow & {
  id: string;
  quantity: number | null;
  unit: string;
};

export type RecipeStep = {
  id: string;
  recipe_id: string;
  position: number;
  text: string;
  image_path: string | null;
  /** Optionaler, explizit gesetzter Kochmodus-Timer. */
  timer_minutes: number | null;
  /** IDs der referenzierten recipe_component_items (recipe_step_ingredients). */
  ingredientIds: string[];
};

/**
 * Nur um `name` erweitert gegenueber `ProductNutritionRow` — nutrition.ts
 * selbst bleibt bewusst frei von Anzeige-Feldern, `name` wird ausschliesslich
 * fuer Zutaten-Chips (Rezept-Detail/Wizard) gebraucht.
 */
export type ProductRow = ProductNutritionRow & { name: string };

export type RecipeDetail = {
  recipe: RecipeListItem;
  components: RecipeComponent[];
  items: RecipeComponentItem[];
  steps: RecipeStep[];
  productsById: Map<string, ProductRow>;
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
      type NutritionItemRow = RecipeComponentItemRow & { recipe_id: string };
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
      const itemsByRecipe = new Map<string, RecipeComponentItemRow[]>();
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

      const items = await db.getAllAsync<RecipeComponentItem>(
        `select id, component_id, product_id, sub_component_id, grams, quantity, unit
         from recipe_component_items
         where recipe_id = ? and deleted_at is null`,
        [recipeId],
      );

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
    mutationFn: async (input: {
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
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();

      const row = {
        id,
        household_id: input.household_id,
        title: input.title,
        instructions: input.instructions ?? null,
        cover_image_path: input.cover_image_path ?? null,
        cook_time_minutes: input.cook_time_minutes ?? null,
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
    mutationFn: async (input: {
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
    }) => {
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
      queryClient.invalidateQueries({ queryKey: ['recipes', variables.household_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useAddComponentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      recipe_id: string;
      household_id: string;
      name: string;
      /** Nur bei obersten Komponenten gesetzt, siehe 11_recipes.sql. */
      serving_grams?: number | null;
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();
      const servingGrams = input.serving_grams ?? null;

      await enqueueMutation(db, {
        entity: 'recipe_components',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          recipe_id: input.recipe_id,
          household_id: input.household_id,
          name: input.name,
          serving_grams: servingGrams,
          created_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_components',
            'insert',
            {
              id,
              recipe_id: input.recipe_id,
              household_id: input.household_id,
              name: input.name,
              serving_grams: servingGrams,
              created_at: iso,
            },
            ms,
          ),
      });

      return { id, ...input };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateComponentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      recipe_id: string;
      household_id: string;
      name: string;
      serving_grams?: number | null;
    }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();
      const servingGrams = input.serving_grams ?? null;

      await enqueueMutation(db, {
        entity: 'recipe_components',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          name: input.name,
          serving_grams: servingGrams,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_components',
            'update',
            { id: input.id, name: input.name, serving_grams: servingGrams },
            ms,
          ),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useDeleteComponentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; recipe_id: string; household_id: string }) => {
      const db = await getDatabase();

      // UI-Limit 2 Ebenen (#123-AC): eine Komponente, die als Unterkomponente
      // einer anderen benutzt wird, darf nicht geloescht werden, ohne diese
      // Referenz zuerst aufzuloesen — sonst zeigt eine verbleibende Position
      // ins Leere.
      const usedAsSubComponent = await db.getFirstAsync<{ id: string }>(
        'select id from recipe_component_items where sub_component_id = ? and deleted_at is null',
        [input.id],
      );
      if (usedAsSubComponent) {
        throw new Error(
          'Diese Komponente wird von einer anderen Komponente verwendet und kann nicht geloescht werden.',
        );
      }

      const { iso, ms } = nowStamp();

      const items = await db.getAllAsync<{ id: string }>(
        'select id from recipe_component_items where component_id = ? and deleted_at is null',
        [input.id],
      );
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

      await enqueueMutation(db, {
        entity: 'recipe_components',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'recipe_components', 'delete', { id: input.id }, ms),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useAddItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      component_id: string;
      recipe_id: string;
      household_id: string;
      product_id?: string | null;
      sub_component_id?: string | null;
      grams: number;
      /** Rohe Nutzereingabe, siehe Kommentar auf recipe_component_items.quantity. */
      quantity?: number | null;
      unit?: string;
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();
      const productId = input.product_id ?? null;
      const subComponentId = input.sub_component_id ?? null;
      const quantity = input.quantity ?? null;
      const unit = input.unit ?? 'g';

      await enqueueMutation(db, {
        entity: 'recipe_component_items',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          component_id: input.component_id,
          recipe_id: input.recipe_id,
          household_id: input.household_id,
          product_id: productId,
          sub_component_id: subComponentId,
          grams: input.grams,
          quantity,
          unit,
          created_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_component_items',
            'insert',
            {
              id,
              component_id: input.component_id,
              recipe_id: input.recipe_id,
              household_id: input.household_id,
              product_id: productId,
              sub_component_id: subComponentId,
              grams: input.grams,
              quantity,
              unit,
              created_at: iso,
            },
            ms,
          ),
      });

      return { id, ...input, quantity, unit };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

/** War frueher `useUpdateItemGramsMutation` — aendert jetzt auch quantity/unit, nicht nur grams. */
export function useUpdateItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      recipe_id: string;
      household_id: string;
      grams: number;
      quantity?: number | null;
      unit?: string;
    }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();
      const quantity = input.quantity ?? null;
      const unit = input.unit ?? 'g';

      await enqueueMutation(db, {
        entity: 'recipe_component_items',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          grams: input.grams,
          quantity,
          unit,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_component_items',
            'update',
            { id: input.id, grams: input.grams, quantity, unit },
            ms,
          ),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useDeleteItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; recipe_id: string; household_id: string }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();

      await enqueueMutation(db, {
        entity: 'recipe_component_items',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'recipe_component_items', 'delete', { id: input.id }, ms),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

// ------------------------------------------------------------- Schritte (Wizard)

export function useAddStepMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      recipe_id: string;
      household_id: string;
      position: number;
      text: string;
      image_path?: string | null;
      timer_minutes?: number | null;
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();
      const imagePath = input.image_path ?? null;
      const timerMinutes = input.timer_minutes ?? null;

      await enqueueMutation(db, {
        entity: 'recipe_steps',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          recipe_id: input.recipe_id,
          household_id: input.household_id,
          position: input.position,
          text: input.text,
          image_path: imagePath,
          timer_minutes: timerMinutes,
          created_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_steps',
            'insert',
            {
              id,
              recipe_id: input.recipe_id,
              household_id: input.household_id,
              position: input.position,
              text: input.text,
              image_path: imagePath,
              timer_minutes: timerMinutes,
              created_at: iso,
            },
            ms,
          ),
      });

      return { id, ...input, image_path: imagePath, timer_minutes: timerMinutes };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateStepMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      recipe_id: string;
      household_id: string;
      position: number;
      text: string;
      image_path?: string | null;
      timer_minutes?: number | null;
    }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();
      const imagePath = input.image_path ?? null;
      const timerMinutes = input.timer_minutes ?? null;

      await enqueueMutation(db, {
        entity: 'recipe_steps',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          position: input.position,
          text: input.text,
          image_path: imagePath,
          timer_minutes: timerMinutes,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_steps',
            'update',
            {
              id: input.id,
              position: input.position,
              text: input.text,
              image_path: imagePath,
              timer_minutes: timerMinutes,
            },
            ms,
          ),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useDeleteStepMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; recipe_id: string; household_id: string }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();

      // Zutaten-Referenzen dieses Schritts muessen einzeln als geloescht
      // markiert werden — analog zum Loeschen eines Rezepts oben, kein
      // serverseitiges Kaskadieren bei Soft-Delete.
      const stepIngredients = await db.getAllAsync<{ id: string }>(
        'select id from recipe_step_ingredients where step_id = ? and deleted_at is null',
        [input.id],
      );
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

      await enqueueMutation(db, {
        entity: 'recipe_steps',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'recipe_steps', 'delete', { id: input.id }, ms),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useAddStepIngredientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      step_id: string;
      item_id: string;
      recipe_id: string;
      household_id: string;
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();

      await enqueueMutation(db, {
        entity: 'recipe_step_ingredients',
        entityId: id,
        op: 'insert',
        payload: {
          id,
          step_id: input.step_id,
          item_id: input.item_id,
          household_id: input.household_id,
          created_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(
            txn,
            'recipe_step_ingredients',
            'insert',
            {
              id,
              step_id: input.step_id,
              item_id: input.item_id,
              household_id: input.household_id,
              created_at: iso,
            },
            ms,
          ),
      });

      return { id, ...input };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useRemoveStepIngredientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; recipe_id: string; household_id: string }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();

      await enqueueMutation(db, {
        entity: 'recipe_step_ingredients',
        entityId: input.id,
        op: 'delete',
        payload: {
          id: input.id,
          household_id: input.household_id,
          deleted_at: iso,
          updated_at: iso,
        },
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'recipe_step_ingredients', 'delete', { id: input.id }, ms),
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
