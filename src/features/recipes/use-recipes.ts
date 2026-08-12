import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import type {
  ProductNutritionRow,
  RecipeComponentItemRow,
  RecipeComponentRow,
} from '@/features/recipes/nutrition';
import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';

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
  steps: string[];
  cover_image_path: string | null;
  cook_time_minutes: number | null;
  difficulty: Difficulty | null;
  dish_types: DishType[];
  dietary_tags: DietaryTag[];
  hashtags: string[];
  default_servings: number;
  created_at: string | null;
};

/** Rohzeile aus SQLite: die `text[]`-Server-Spalten kommen lokal als JSON-Text an. */
type RecipeRow = Omit<RecipeListItem, 'steps' | 'dish_types' | 'dietary_tags' | 'hashtags'> & {
  steps: string;
  dish_types: string;
  dietary_tags: string;
  hashtags: string;
};

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function toRecipeListItem(row: RecipeRow): RecipeListItem {
  return {
    ...row,
    steps: parseJsonArray<string>(row.steps),
    dish_types: parseJsonArray<DishType>(row.dish_types),
    dietary_tags: parseJsonArray<DietaryTag>(row.dietary_tags),
    hashtags: parseJsonArray<string>(row.hashtags),
  };
}

const RECIPE_COLUMNS = `id, household_id, title, instructions, steps, cover_image_path,
  cook_time_minutes, difficulty, dish_types, dietary_tags, hashtags, default_servings, created_at`;

export type RecipeComponent = RecipeComponentRow & { name: string; recipe_id: string };
export type RecipeComponentItem = RecipeComponentItemRow & { id: string };

export type RecipeDetail = {
  recipe: RecipeListItem;
  components: RecipeComponent[];
  items: RecipeComponentItem[];
  productsById: Map<string, ProductNutritionRow>;
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
      return rows.map(toRecipeListItem);
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
        `select id, component_id, product_id, sub_component_id, grams
         from recipe_component_items
         where recipe_id = ? and deleted_at is null`,
        [recipeId],
      );

      const productIds = [
        ...new Set(items.map((i) => i.product_id).filter((id): id is string => !!id)),
      ];
      const productsById = new Map<string, ProductNutritionRow>();
      if (productIds.length > 0) {
        const placeholders = productIds.map(() => '?').join(', ');
        const products = await db.getAllAsync<ProductNutritionRow>(
          `select id, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100
           from products where id in (${placeholders})`,
          productIds,
        );
        for (const p of products) productsById.set(p.id, p);
      }

      return { recipe, components, items, productsById };
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
      steps?: string[];
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
        steps: input.steps ?? [],
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
        applyLocally: async (txn) => {
          await txn.runAsync(
            `insert into recipes (
               id, household_id, title, instructions, steps, cover_image_path,
               cook_time_minutes, difficulty, dish_types, dietary_tags, hashtags,
               default_servings, created_by, created_at, updated_at, _dirty
             ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              row.id,
              row.household_id,
              row.title,
              row.instructions,
              JSON.stringify(row.steps),
              row.cover_image_path,
              row.cook_time_minutes,
              row.difficulty,
              JSON.stringify(row.dish_types),
              JSON.stringify(row.dietary_tags),
              JSON.stringify(row.hashtags),
              row.default_servings,
              row.created_by,
              iso,
              ms,
            ],
          );
        },
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
      steps?: string[];
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
        steps: input.steps ?? [],
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
        applyLocally: async (txn) => {
          await txn.runAsync(
            `update recipes set
               title = ?, instructions = ?, steps = ?, cover_image_path = ?,
               cook_time_minutes = ?, difficulty = ?, dish_types = ?, dietary_tags = ?,
               hashtags = ?, default_servings = ?, updated_at = ?, _dirty = 1
             where id = ?`,
            [
              input.title,
              patch.instructions,
              JSON.stringify(patch.steps),
              patch.cover_image_path,
              patch.cook_time_minutes,
              patch.difficulty,
              JSON.stringify(patch.dish_types),
              JSON.stringify(patch.dietary_tags),
              JSON.stringify(patch.hashtags),
              patch.default_servings,
              ms,
              input.id,
            ],
          );
        },
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
          applyLocally: async (txn) => {
            await txn.runAsync(
              'update recipe_component_items set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
              [ms, ms, item.id],
            );
          },
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
          applyLocally: async (txn) => {
            await txn.runAsync(
              'update recipe_components set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
              [ms, ms, component.id],
            );
          },
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
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update recipes set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
            [ms, ms, input.id],
          );
        },
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
        applyLocally: async (txn) => {
          await txn.runAsync(
            `insert into recipe_components (id, recipe_id, household_id, name, serving_grams, created_at, updated_at, _dirty)
             values (?, ?, ?, ?, ?, ?, ?, 1)`,
            [id, input.recipe_id, input.household_id, input.name, servingGrams, iso, ms],
          );
        },
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
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update recipe_components set name = ?, serving_grams = ?, updated_at = ?, _dirty = 1 where id = ?',
            [input.name, servingGrams, ms, input.id],
          );
        },
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
          applyLocally: async (txn) => {
            await txn.runAsync(
              'update recipe_component_items set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
              [ms, ms, item.id],
            );
          },
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
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update recipe_components set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
            [ms, ms, input.id],
          );
        },
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
    }) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const { iso, ms } = nowStamp();
      const productId = input.product_id ?? null;
      const subComponentId = input.sub_component_id ?? null;

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
          created_at: iso,
          updated_at: iso,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            `insert into recipe_component_items
               (id, component_id, recipe_id, household_id, product_id, sub_component_id, grams, created_at, updated_at, _dirty)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              id,
              input.component_id,
              input.recipe_id,
              input.household_id,
              productId,
              subComponentId,
              input.grams,
              iso,
              ms,
            ],
          );
        },
      });

      return { id, ...input };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export function useUpdateItemGramsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      recipe_id: string;
      household_id: string;
      grams: number;
    }) => {
      const db = await getDatabase();
      const { iso, ms } = nowStamp();

      await enqueueMutation(db, {
        entity: 'recipe_component_items',
        entityId: input.id,
        op: 'update',
        payload: {
          id: input.id,
          household_id: input.household_id,
          grams: input.grams,
          updated_at: iso,
        },
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update recipe_component_items set grams = ?, updated_at = ?, _dirty = 1 where id = ?',
            [input.grams, ms, input.id],
          );
        },
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
        applyLocally: async (txn) => {
          await txn.runAsync(
            'update recipe_component_items set deleted_at = ?, updated_at = ?, _dirty = 1 where id = ?',
            [ms, ms, input.id],
          );
        },
      });

      return input.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipe-detail', variables.recipe_id] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
